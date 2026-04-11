import type { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const sendTwilioMessage = async (to: string, message: string, mediaUrl?: string): Promise<boolean> => {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  let fromEnv = process.env.TWILIO_WA_FROM?.trim() || "+14155238886";

  const finalFrom = fromEnv.startsWith('whatsapp:') ? fromEnv : `whatsapp:${fromEnv}`;
  const cleanTo = to.replace('whatsapp:', '').replace(/\s+/g, '');
  const finalTo = `whatsapp:${cleanTo.startsWith('+') ? cleanTo : '+' + cleanTo}`;

  const params = new URLSearchParams();
  params.append("To", finalTo);
  params.append("From", finalFrom);
  if (message) params.append("Body", message);
  if (mediaUrl) params.append("MediaUrl", mediaUrl);

  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params
    });
    return response.ok;
  } catch (error) {
    console.error("❌ EXCEPCIÓN TWILIO:", error);
    return false;
  }
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const bodyParams = new URLSearchParams(event.body || "");
    const senderNumber = bodyParams.get("From")?.replace("whatsapp:", "");
    const incomingMessage = bodyParams.get("Body");

    if (!incomingMessage) return { statusCode: 200, body: "<Response></Response>" };

    // 🛡️ SEGURIDAD
    const AUTHORIZED_NUMBERS = ["+50763036338", "+50762256452", "+13059248876"];
    const normalizedSender = senderNumber?.startsWith('+') ? senderNumber : `+${senderNumber}`;
    if (!AUTHORIZED_NUMBERS.includes(normalizedSender)) return { statusCode: 200, body: "<Response></Response>" };

    const { data: memories } = await supabase.from('agent_memory').select('rule_text');
    const systemMemory = memories?.map(m => `- ${m.rule_text}`).join('\n') || "";

    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.1-flash", 
      generationConfig: { responseMimeType: "application/json" } 
    });

    const prompt = `
      Eres el Orquestador B2B de Fresh Food Panamá. Jefe: Freddy García. Gerente: David Vazquez.

      INTENCIONES DE ARCHIVOS:
      - "OBTENER_ARCHIVO": Cuando pidan un documento específico (PDF, AWB, Reporte, Factura).
      
      MAPEO DE TIPOS DE DOCUMENTO (doc_type):
      - "inspeccion", "reporte de inspeccion" -> inspeccion
      - "awb", "guia" -> awb
      - "factura", "invoice" -> invoice
      - "fitosanitario" -> phytosanitary

      REGLAS:
      1. Si piden "la última cotización de [Cliente]", identifica que el recurso es "quote".
      2. Si piden "el AWB de [Cliente]" o "[Embarque]", identifica que el recurso es "shipment_file".
      3. Respuestas directas.

      JSON RESPUESTA:
      {
        "intent": "OBTENER_ARCHIVO" | "GESTION_COTIZACION" | "REPORTE_GERENCIAL" | "CHAT_GENERAL" | "APRENDER_REGLA",
        "file_request": {
          "resource": "quote" | "shipment_file",
          "client_name": "Nombre del cliente si se menciona",
          "doc_type": "awb | inspeccion | invoice | phytosanitary",
          "code": "Código si se menciona (Q-XXX o SHP-XXX)"
        },
        "chat_response": "..."
      }

      Mensaje: "${incomingMessage}"
    `;

    const result = await model.generateContent(prompt);
    const ai = JSON.parse(result.response.text());
    const baseUrl = process.env.URL || 'https://app.freshfoodpanama.com';

    if (ai.intent === "OBTENER_ARCHIVO") {
      const fr = ai.file_request;
      
      // --- CASO A: COTIZACIÓN (Generada por sistema) ---
      if (fr.resource === "quote") {
        let query = supabase.from('quotes').select('id, quote_number, client_snapshot').order('created_at', { ascending: false });
        
        if (fr.code) query = query.ilike('quote_number', `%${fr.code}%`);
        else if (fr.client_name) {
            const { data: client } = await supabase.from('clients').select('id').ilike('name', `%${fr.client_name}%`).limit(1).single();
            if (client) query = query.eq('client_id', client.id);
        }

        const { data: quote } = await query.limit(1).single();
        if (!quote) return { statusCode: 200, body: `<Response><Message>Jefe, no encontré esa cotización.</Message></Response>` };

        const pdfUrl = `${baseUrl}/.netlify/functions/renderQuotePdf?id=${quote.id}`;
        await sendTwilioMessage(normalizedSender, `📄 Aquí tiene la cotización ${quote.quote_number} de ${quote.client_snapshot?.name}`, pdfUrl);
        return { statusCode: 200, body: `<Response></Response>` };
      }

      // --- CASO B: ARCHIVO DE EMBARQUE (AWB, Inspección, etc.) ---
      else if (fr.resource === "shipment_file") {
        let shipQuery = supabase.from('shipments').select('id, code').order('created_at', { ascending: false });
        
        if (fr.code) shipQuery = shipQuery.ilike('code', `%${fr.code}%`);
        else if (fr.client_name) {
            const { data: client } = await supabase.from('clients').select('id').ilike('name', `%${fr.client_name}%`).limit(1).single();
            if (client) shipQuery = shipQuery.eq('client_id', client.id);
        }

        const { data: ship } = await shipQuery.limit(1).single();
        if (!ship) return { statusCode: 200, body: `<Response><Message>Jefe, no encontré el embarque para ese archivo.</Message></Response>` };

        // Buscamos el archivo en shipment_files por tipo
        const { data: file } = await supabase.from('shipment_files')
            .select('storage_path, filename')
            .eq('shipment_id', ship.id)
            .ilike('doc_type', `%${fr.doc_type}%`)
            .order('created_at', { ascending: false })
            .limit(1).single();

        if (!file) return { statusCode: 200, body: `<Response><Message>Jefe, el embarque ${ship.code} no tiene subido el documento tipo: ${fr.doc_type}</Message></Response>` };

        // Generamos la URL firmada o pública de Supabase Storage
        const { data: signedUrl } = await supabase.storage.from('shipments').createSignedUrl(file.storage_path, 600);

        await sendTwilioMessage(normalizedSender, `📦 Aquí tiene el ${fr.doc_type} del embarque ${ship.code}`, signedUrl?.signedUrl);
        return { statusCode: 200, body: `<Response></Response>` };
      }
    }

    // ... (Mantener aquí tus otros else if de GESTION_COTIZACION, REPORTE_GERENCIAL, etc.)
    
    // Fallback conversacional si no es archivo
    else if (ai.chat_response) {
        return { statusCode: 200, body: `<Response><Message>${ai.chat_response}</Message></Response>` };
    }

    return { statusCode: 200, body: `<Response><Message>Entendido Jefe.</Message></Response>` };

  } catch (error: any) {
    return { statusCode: 200, body: `<Response><Message>⚠️ Error: ${error.message}</Message></Response>` };
  }
};