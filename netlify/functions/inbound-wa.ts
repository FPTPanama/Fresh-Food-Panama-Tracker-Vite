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
    const result = await response.json();
    console.log("📤 TWILIO RESPONSE:", result.sid);
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

    // 🛡️ SEGURIDAD FREDDY / DAVID / DAVID M.
    const AUTHORIZED_NUMBERS = ["+50763036338", "+50762256452", "+13059248876"];
    const normalizedSender = senderNumber?.startsWith('+') ? senderNumber : `+${senderNumber}`;
    if (!AUTHORIZED_NUMBERS.includes(normalizedSender)) return { statusCode: 200, body: "<Response></Response>" };

    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.1-flash", 
      generationConfig: { responseMimeType: "application/json" } 
    });

    const prompt = `
      Eres el Orquestador Operativo de Fresh Food Panamá.
      INTENCIÓN "OBTENER_ARCHIVO":
      - Si piden "enviame", "pasame", "mandame" un PDF, AWB, Factura o Reporte.
      MAPEO DOC_TYPE: "awb", "guia", "inspeccion", "reporte", "factura", "invoice".
      JSON: { "intent": "OBTENER_ARCHIVO", "file_request": { "resource": "quote" | "shipment_file", "client_name": "...", "doc_type": "...", "code": "..." } }
      Mensaje: "${incomingMessage}"
    `;

    const result = await model.generateContent(prompt);
    const ai = JSON.parse(result.response.text());
    const baseUrl = process.env.URL || 'https://app.freshfoodpanama.com';

    if (ai.intent === "OBTENER_ARCHIVO") {
      const fr = ai.file_request;
      let fileUrl = "";
      let fileName = "";

      if (fr.resource === "quote") {
        let qQuery = supabase.from('quotes').select('id, quote_number').order('created_at', { ascending: false });
        if (fr.code) qQuery = qQuery.ilike('quote_number', `%${fr.code}%`);
        else if (fr.client_name) {
          const { data: cl } = await supabase.from('clients').select('id').ilike('name', `%${fr.client_name}%`).limit(1).single();
          if (cl) qQuery = qQuery.eq('client_id', cl.id);
        }
        const { data: quote } = await qQuery.limit(1).maybeSingle();
        if (quote) {
            fileUrl = `${baseUrl}/.netlify/functions/renderQuotePdf?id=${quote.id}`;
            fileName = `Cotización ${quote.quote_number}`;
        }
      } 
      else if (fr.resource === "shipment_file") {
        let sQuery = supabase.from('shipments').select('id, code').order('created_at', { ascending: false });
        if (fr.code) sQuery = sQuery.ilike('code', `%${fr.code}%`);
        else if (fr.client_name) {
          const { data: cl } = await supabase.from('clients').select('id').ilike('name', `%${fr.client_name}%`).limit(1).single();
          if (cl) sQuery = sQuery.eq('client_id', cl.id);
        }
        const { data: ship } = await sQuery.limit(1).maybeSingle();
        
        if (ship) {
          const { data: file } = await supabase.from('shipment_files')
            .select('storage_path, doc_type')
            .eq('shipment_id', ship.id)
            .ilike('doc_type', `%${fr.doc_type || ''}%`)
            .limit(1).maybeSingle();

          if (file) {
            const { data: signed } = await supabase.storage.from('shipments').createSignedUrl(file.storage_path, 3600);
            fileUrl = signed?.signedUrl || "";
            fileName = `${file.doc_type.toUpperCase()} - ${ship.code}`;
          }
        }
      }

      if (fileUrl) {
        // EL CAMBIO CLAVE: Esperar el envío antes de responder a Netlify
        const sent = await sendTwilioMessage(normalizedSender, `📄 Aquí tiene: ${fileName}`, fileUrl);
        if (sent) return { statusCode: 200, body: "<Response></Response>" };
      }
      
      return { statusCode: 200, body: `<Response><Message>⚠️ Jefe, encontré el registro pero no pude generar el archivo adjunto. Verifique si el archivo físico existe en Storage.</Message></Response>` };
    }

    return { statusCode: 200, body: `<Response><Message>Entendido Jefe Freddy.</Message></Response>` };

  } catch (error: any) {
    return { statusCode: 200, body: `<Response><Message>⚠️ Error: ${error.message}</Message></Response>` };
  }
};