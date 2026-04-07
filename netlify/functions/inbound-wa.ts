import type { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

// Inicializamos clientes
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Función auxiliar para enviar WhatsApp por Twilio
const sendTwilioMessage = async (to: string, message: string) => {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const fromNumber = process.env.TWILIO_WA_FROM || "+14155238886";

  const params = new URLSearchParams();
  params.append("To", `whatsapp:${to.startsWith('+') ? to : '+' + to}`);
  params.append("From", `whatsapp:${fromNumber}`);
  params.append("Body", message);

  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const bodyParams = new URLSearchParams(event.body || "");
    const senderNumber = bodyParams.get("From")?.replace("whatsapp:", "");
    const incomingMessage = bodyParams.get("Body");

    if (!incomingMessage || !senderNumber) {
      return { statusCode: 200, body: "<Response></Response>", headers: { "Content-Type": "text/xml" } };
    }

    console.log(`🤖 Mensaje entrante de ${senderNumber}: "${incomingMessage}"`);

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    // --- EL NUEVO CEREBRO (PROMPT MAESTRO) ---
    const prompt = `
      Eres el Orquestador de Operaciones de Fresh Food Panamá.
      Lee el siguiente mensaje del CEO e identifica la intención.

      CONTEXTO DEL EQUIPO (NOMBRES Y CARGOS):
      - Gerente General: David Vazquez
      - Ventas: Ricardo Boccardo (apodo/alias: "Pipo") y Victor Centeno
      - Gestión Documental: Candida Ojo
      - Inspector: Ronald Chanis
      - Logística: Katia Peralta
      
      REGLAS DE INTENCIÓN:
      1. COORDINAR_EMBARQUE: Notifica al "Inspector" (omite cliente/precio, solo da fecha/volumen) y a "Gestión Documental" (preparar Guía Aérea y Factura).
      2. SOLICITAR_TARIFA: Notifica a "Logística".
      3. COTIZAR: Notifica a "Ventas".
      4. INSTRUCCION_DIRECTA: Si el CEO pide explícitamente decirle algo a alguien específico (ej. "reportale a David...", "dile a Pipo...", "habla con Victor"), la intención es INSTRUCCION_DIRECTA. El target DEBE ser el Nombre Completo de esa persona.
      
      Devuelve ÚNICAMENTE este formato JSON:
      {
        "intent": "COORDINAR_EMBARQUE" | "SOLICITAR_TARIFA" | "COTIZAR" | "INSTRUCCION_DIRECTA" | "OTRO",
        "extracted_info": { "destination": "", "pallets": "", "date": "", "client": "" },
        "tasks": [
          {
            "target": "Nombre Completo de la persona (ej. 'Ricardo Boccardo') O el Cargo (ej. 'Inspector')",
            "message_to_send": "Texto exacto y profesional que se le enviará por WhatsApp a esta persona"
          }
        ]
      }

      Mensaje del CEO: "${incomingMessage}"
    `;

    const result = await model.generateContent(prompt);
    const aiResponse = JSON.parse(result.response.text());
    
    console.log("🧠 Decisión de la IA:", JSON.stringify(aiResponse, null, 2));

    let processedTasks = 0;

    if (aiResponse.tasks && aiResponse.tasks.length > 0) {
      
      // NUEVO: Ahora extraemos también el full_name de la base de datos
      const [{ data: internal }, { data: external }] = await Promise.all([
        supabase.from('profiles').select('position, phone, full_name'),
        supabase.from('external_partners').select('position, phone, full_name')
      ]);
      const directory = [...(internal || []), ...(external || [])];

      for (const task of aiResponse.tasks) {
        // Búsqueda inteligente: Busca coincidencia por Cargo O por Nombre Completo
        const person = directory.find(p => 
          (p.position && p.position.toLowerCase() === task.target.toLowerCase()) ||
          (p.full_name && p.full_name.toLowerCase().includes(task.target.toLowerCase()))
        );
        
        if (person && person.phone) {
          await sendTwilioMessage(person.phone, `🤖 *Notificación del Sistema (Fresh Food):*\n\n${task.message_to_send}`);
          processedTasks++;
        } else {
          console.warn(`⚠️ No se encontró número para el target: ${task.target}`);
        }
      }
    }

    const replyText = processedTasks > 0 
      ? `✅ Procesado exitosamente (${aiResponse.intent}). Se han despachado ${processedTasks} instrucciones a tu equipo.`
      : `⚠️ Entendido, pero no encontré acciones operativas o roles registrados para procesar este mensaje de forma automática.`;

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/xml" },
      body: `<Response><Message>${replyText}</Message></Response>`
    };

  } catch (error: any) {
    console.error("❌ Error en inbound-wa:", error.message);
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/xml" },
      body: `<Response><Message>❌ Hubo un error procesando tu instrucción: ${error.message}</Message></Response>`
    };
  }
};