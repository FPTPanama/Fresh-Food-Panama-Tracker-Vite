import type { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// 1. Ajustamos la función para que devuelva 'true' si tuvo éxito o 'false' si falló
const sendTwilioMessage = async (to: string, message: string): Promise<boolean> => {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  let fromEnv = process.env.TWILIO_WA_FROM?.trim() || "+14155238886";

  const finalFrom = fromEnv.startsWith('whatsapp:') ? fromEnv : `whatsapp:${fromEnv}`;
  const cleanTo = to.replace(/\s+/g, '');
  const finalTo = cleanTo.startsWith('whatsapp:') ? cleanTo : `whatsapp:${cleanTo.startsWith('+') ? cleanTo : '+' + cleanTo}`;

  console.log(`🔍 DIAGNÓSTICO: Usando SID: ...${sid?.slice(-5)} | From: ${finalFrom} | To: ${finalTo}`);

  const params = new URLSearchParams();
  params.append("To", finalTo);
  params.append("From", finalFrom);
  params.append("Body", message);

  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("❌ ERROR TWILIO:", JSON.stringify(data, null, 2));
      return false;
    }
    console.log(`✅ MENSAJE ENVIADO. SID: ${data.sid}`);
    return true;
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

    console.log(`\n📩 NUEVO MENSAJE CHATOPS: "${incomingMessage}" de ${senderNumber}`);

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash", 
      generationConfig: { responseMimeType: "application/json" }
    });

    // 2. Prompt unificado y preciso
    const prompt = `
      Eres el Orquestador Operador de Fresh Food Panamá.
      
      CONTEXTO EQUIPO:
      - David Vazquez (Gerente)
      - Ricardo Boccardo "Pipo" (Ventas)
      - Victor Centeno (Ventas)
      - Ronald Chanis (Inspector)
      - Pedro Rojas (Finanzas / Administrativo)
      - Daniel Vazquez (Marketing / Diseño)
      - Candida Ojo (Documental)
      - Katia Peralta (Logística)
      
      Debes clasificar el mensaje entrante en una de estas dos intenciones:
      1. "REPORTE_GERENCIAL": Si piden métricas, resúmenes o datos de cotizaciones/embarques.
      2. "INSTRUCCION_DIRECTA": Si piden ordenar a alguien del equipo hacer una tarea.
      
      JSON de respuesta estricto:
      {
        "intent": "REPORTE_GERENCIAL" | "INSTRUCCION_DIRECTA",
        "query_config": {
          "table": "quotes" | "shipments",
          "filter_status": "ej: approved, IN_TRANSIT",
          "limit": 3,
          "target_name": "Nombre de a quién se le envía el reporte, si se especifica"
        },
        "tasks": [
          {
            "target": "Nombre de la persona a asignar",
            "message_to_send": "Instrucción clara redactada para esa persona"
          }
        ]
      }

      Mensaje: "${incomingMessage}"
    `;

    const result = await model.generateContent(prompt);
    const ai = JSON.parse(result.response.text());
    console.log("🧠 Inteligencia:", JSON.stringify(ai, null, 2));

    const [{ data: internal }, { data: external }] = await Promise.all([
      supabase.from('profiles').select('position, phone, full_name'),
      supabase.from('external_partners').select('position, phone, full_name')
    ]);
    const directory = [...(internal || []), ...(external || [])];

    // --- LÓGICA DE REPORTES ---
    if (ai.intent === "REPORTE_GERENCIAL" && ai.query_config) {
      const { table, filter_status, limit, target_name } = ai.query_config;
      let query = supabase.from(table || 'quotes').select('*').order('created_at', { ascending: false }).limit(limit || 3);
      if (filter_status) query = query.ilike('status', `%${filter_status}%`);
      
      const { data: dbRows } = await query;
      
      let reportBody = `📊 *REPORTE FRESH FOOD (ChatOps)*\n`;
      if (table === 'quotes') {
        reportBody += `_Últimas ${dbRows?.length || 0} cotizaciones:_\n\n`;
        dbRows?.forEach(q => reportBody += `• *${q.quote_number}*: ${q.client_snapshot?.name || 'Cliente'} - *$${q.total}* (${q.status})\n`);
      } else {
        reportBody += `_Últimos ${dbRows?.length || 0} embarques:_\n\n`;
        dbRows?.forEach(s => reportBody += `• *AWB ${s.awb || 'S/G'}*: ${s.pallets} pal. a ${s.destination} (${s.status})\n`);
      }

      const targetPerson = directory.find(p => p.full_name?.toLowerCase().includes(target_name?.toLowerCase() || ''));
      const finalDest = targetPerson?.phone || senderNumber;
      const recipientName = targetPerson?.full_name || 'Gerente / Admin';
      
      const success = await sendTwilioMessage(finalDest, reportBody);

      // 📝 LOG DE AUDITORÍA (Reporte)
      await supabase.from('automation_logs').insert({
        rule_title: '🤖 ChatOps: Reporte Generado',
        recipient_name: recipientName,
        channel: 'WhatsApp',
        message_text: reportBody,
        record_type: 'Comando IA',
        reference_number: ai.intent,
        status: success ? 'sent' : 'failed'
      });
    } 
    
    // --- LÓGICA DE INSTRUCCIONES (ASIGNACIÓN DE TAREAS) ---
    else if (ai.intent === "INSTRUCCION_DIRECTA" && ai.tasks) {
      for (const task of ai.tasks) {
        const person = directory.find(p => 
          p.position?.toLowerCase().includes(task.target.toLowerCase()) || 
          p.full_name?.toLowerCase().includes(task.target.toLowerCase())
        );

        if (person?.phone) {
          const msg = `🤖 *Asignación vía ChatOps:*\n\n${task.message_to_send}`;
          const success = await sendTwilioMessage(person.phone, msg);

          // 📝 LOG DE AUDITORÍA (Instrucción)
          await supabase.from('automation_logs').insert({
            rule_title: '🤖 ChatOps: Instrucción Directa',
            recipient_name: person.full_name,
            channel: 'WhatsApp',
            message_text: msg,
            record_type: 'Comando IA',
            reference_number: ai.intent,
            status: success ? 'sent' : 'failed'
          });
        } else {
          console.warn(`⚠️ ChatOps no encontró a ${task.target} en el directorio.`);
        }
      }
    }

    // Respondemos al Twilio Inbound Webhook con XML válido
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/xml" },
      body: `<Response><Message>✅ Comando ChatOps ejecutado con éxito.</Message></Response>`
    };

  } catch (error: any) {
    console.error("❌ ERROR CHATOPS:", error.message);
    return { statusCode: 200, headers: { "Content-Type": "text/xml" }, body: `<Response><Message>⚠️ Orquestador Error: ${error.message}</Message></Response>` };
  }
};