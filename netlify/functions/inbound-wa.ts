import type { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const sendTwilioMessage = async (to: string, message: string) => {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const fromNumber = process.env.TWILIO_WA_FROM || "+14155238886";
  const cleanNumber = to.replace(/\s+/g, '');
  const formattedTo = `whatsapp:${cleanNumber.startsWith('+') ? cleanNumber : '+' + cleanNumber}`;

  console.log(`📤 Enviando WhatsApp a ${formattedTo}...`);

  const params = new URLSearchParams();
  params.append("To", formattedTo);
  params.append("From", `whatsapp:${fromNumber}`);
  params.append("Body", message);

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`Twilio Error: ${data.message}`);
  console.log(`✅ Mensaje entregado a Twilio. SID: ${data.sid}`);
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const bodyParams = new URLSearchParams(event.body || "");
    const senderNumber = bodyParams.get("From")?.replace("whatsapp:", "");
    const incomingMessage = bodyParams.get("Body");

    if (!incomingMessage) return { statusCode: 200, body: "<Response></Response>" };

    console.log(`\n📩 NUEVO MENSAJE: "${incomingMessage}" de ${senderNumber}`);

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash", // Usamos 2.5 Flash para mayor velocidad y precisión en JSON
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      Eres el Orquestador IA de Fresh Food Panamá. Tienes acceso a la base de datos.
      
      EQUIPO: David Vazquez (Gerente), Ricardo Boccardo (Ventas, apodo: "Pipo"), Victor Centeno (Ventas), Candida Ojo (Documental), Ronald Chanis (Inspector), Katia Peralta (Logística).

      TABLAS DISPONIBLES:
      - 'quotes': columnas [quote_number, total, status, client_snapshot (jsonb con nombre), destination]
      - 'shipments': columnas [awb, destination, status, pallets, boxes, product_name, flight_number]

      INTENCIONES:
      1. COORDINAR_EMBARQUE: Avisar a Inspector y Documental.
      2. SOLICITAR_TARIFA: Avisar a Logística.
      3. REPORTE_DATOS: El CEO pide info de la BD (ej. "últimas cotizaciones", "embarques en tránsito").
      4. INSTRUCCION_DIRECTA: Mensaje de persona a persona.

      Responde ÚNICAMENTE este JSON:
      {
        "intent": "REPORTE_DATOS" | "COORDINAR_EMBARQUE" | "INSTRUCCION_DIRECTA" | "SOLICITAR_TARIFA",
        "query_config": { "table": "quotes" | "shipments", "filter_status": "texto opcional", "limit": 3, "target_name": "Nombre de quien recibirá el reporte" },
        "tasks": [{ "target": "Rol o Nombre", "message_to_send": "texto" }]
      }

      Mensaje: "${incomingMessage}"
    `;

    const result = await model.generateContent(prompt);
    const ai = JSON.parse(result.response.text());
    console.log("🧠 Inteligencia:", JSON.stringify(ai, null, 2));

    // 1. Obtener Directorio
    const [{ data: internal }, { data: external }] = await Promise.all([
      supabase.from('profiles').select('position, phone, full_name'),
      supabase.from('external_partners').select('position, phone, full_name')
    ]);
    const directory = [...(internal || []), ...(external || [])];

    // 2. Ejecutar Lógica de Reportes
    if (ai.intent === "REPORTE_DATOS") {
      const { table, filter_status, limit, target_name } = ai.query_config;
      let query = supabase.from(table).select('*').order('created_at', { ascending: false }).limit(limit || 3);
      
      if (filter_status) query = query.ilike('status', `%${filter_status}%`);
      
      const { data: dbRows } = await query;
      
      let reportBody = `📊 *REPORTE FRESH FOOD*\n`;
      if (table === 'quotes') {
        reportBody += `_Últimas ${dbRows?.length} cotizaciones:_\n\n`;
        dbRows?.forEach(q => {
          const clientName = q.client_snapshot?.name || 'Cliente';
          reportBody += `• *${q.quote_number}*: ${clientName} - *$${q.total}* (${q.status})\n`;
        });
      } else if (table === 'shipments') {
        reportBody += `_Embarques ${filter_status || ''}:_\n\n`;
        dbRows?.forEach(s => {
          reportBody += `• *AWB ${s.awb || 'S/G'}*: ${s.pallets} pal. a ${s.destination} (${s.status})\n`;
        });
      }

      // ¿A quién se le envía? Si el CEO dijo "Reportale a David", buscamos a David. Si no, al CEO.
      const targetPerson = directory.find(p => p.full_name?.toLowerCase().includes(target_name?.toLowerCase()));
      const finalDest = targetPerson?.phone || senderNumber;
      
      await sendTwilioMessage(finalDest, reportBody);
    } 
    
    // 3. Ejecutar Lógica de Mensajes Directos / Coordinación
    else if (ai.tasks) {
      for (const task of ai.tasks) {
        const person = directory.find(p => 
          p.position?.toLowerCase() === task.target.toLowerCase() || 
          p.full_name?.toLowerCase().includes(task.target.toLowerCase())
        );
        if (person?.phone) {
          await sendTwilioMessage(person.phone, `🤖 *Mensaje de Gerencia:*\n\n${task.message_to_send}`);
        }
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/xml" },
      body: `<Response><Message>✅ Entendido. He procesado la solicitud: ${ai.intent}</Message></Response>`
    };

  } catch (error: any) {
    console.error("❌ ERROR:", error.message);
    return { statusCode: 200, body: `<Response><Message>⚠️ Error: ${error.message}</Message></Response>` };
  }
};