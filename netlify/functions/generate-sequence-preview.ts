import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);



export const handler = async (event: any) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: 'ok' };

  try {
   const { leadIds, campaignContext, audienceType = 'leads' } = JSON.parse(event.body || '{}');

// Determinar la tabla correcta
const tableName = audienceType === 'clients' ? 'clients' : 'leads_prospecting';

const { data: sampleLead } = await supabase.from(tableName).select('*').eq('id', leadIds[0]).single();

    const isSpanish = sampleLead.preferred_language === 'es';
    const lang = isSpanish ? 'ESPAÑOL' : 'INGLÉS (Professional English)';
    const role = isSpanish ? "Dirección Comercial" : "Commercial Directorate";

    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview", generationConfig: { responseMimeType: "application/json" } });

    const prompt = `
      Eres el Director de Exportaciones B2B de Fresh Food Panama.
      Vas a diseñar una secuencia de goteo de 5 correos para un segmento de clientes.
      
      CONTEXTO: ${campaignContext}
      IDIOMA ESTRICTO: ${lang}
      
      ESTRATEGIA (5 PASOS):
      - Correo 1 (Día 0): Intro. Logística aérea en 48h a Europa, Brix >13. Pedido mínimo: 5 pallets (200 cajas).
      - Correo 2 (Día 4): Trazabilidad FreshConnect (documentos e inspección visual).
      - Correo 3 (Día 10): Autoridad. Global G.A.P., FDA, cadena de frío desde Panamá.
      - Correo 4 (Día 17): Trial Order. Proponer prueba exacta de 5 pallets (200 cajas).
      - Correo 5 (Día 25): Breakup email. Despedida profesional, dejas la puerta abierta.

      REGLAS CRÍTICAS DE REDACCIÓN:
      - Tono transaccional B2B.
      - NO incluyas firmas al final.
      - 🚨 IMPORTANTE: En lugar de un nombre real, usa EXACTAMENTE el comodín {{company_name}} en el saludo. Ejemplo: "Hola equipo de {{company_name}}," o "Hello {{company_name}} team,".

      DEVUELVE UN ARRAY JSON EXACTAMENTE CON ESTA ESTRUCTURA:
      [
        { "step": 1, "name": "Presentación", "delay_days": 0, "subject": "Asunto 1", "body": "Texto con {{company_name}}..." },
        { "step": 2, "name": "FreshConnect Follow-up", "delay_days": 4, "subject": "Asunto 2", "body": "Texto con {{company_name}}..." },
        { "step": 3, "name": "Global G.A.P", "delay_days": 10, "subject": "Asunto 3", "body": "..." },
        { "step": 4, "name": "Trial Order (5 Pallets)", "delay_days": 17, "subject": "Asunto 4", "body": "..." },
        { "step": 5, "name": "Despedida", "delay_days": 25, "subject": "Asunto 5", "body": "..." }
      ]
    `;

    const result = await model.generateContent(prompt);
    const sequenceJson = JSON.parse(result.response.text());

    const formattedSequence = sequenceJson.map((email: any) => {
      const htmlBody = email.body.replace(/\n/g, '<br>');
      const optOutText = isSpanish ? "Si deseas dejar de recibir estas propuestas, responde 'Baja'." : "If you prefer not to receive these proposals, reply 'Opt-out'.";
      
      const fullHtml = `
        <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.5; max-width: 600px;">
          ${htmlBody}
          <br><br>
          <p><strong>Freddy García</strong><br>${role} | Fresh Food Panamá C.A.<br>www.freshfoodpanama.com</p>
          <hr style="border: none; border-top: 1px solid #eee; margin-top: 25px; margin-bottom: 20px;" />
          <p style="font-size: 11px; color: #999;">${optOutText}</p>
        </div>
      `;
      return { ...email, full_html: fullHtml };
    });

    return { statusCode: 200, headers, body: JSON.stringify({ sequence: formattedSequence }) };
  } catch (error: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};