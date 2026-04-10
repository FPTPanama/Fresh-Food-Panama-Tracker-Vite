import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const handler = async (event: any) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: 'ok' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

  try {
    // 🚨 Agregamos 'previewOnly' al payload
    const { leadIds, campaignContext, isClientBroadcast, previewOnly = false } = JSON.parse(event.body || '{}');

    if (!leadIds || leadIds.length === 0) return { statusCode: 400, headers, body: JSON.stringify({ error: "No se enviaron IDs" }) };

    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });

    if (isClientBroadcast) {
      const { data: clients, error: clientErr } = await supabase.from('clients').select('*').in('id', leadIds);
      if (clientErr) throw clientErr;

      let previewData = null; // Guardará la vista previa
      let enviosExitosos = 0;

      for (const client of clients) {
        if (!client.contact_email) continue;

        // 🚨 AQUÍ USAMOS EL IDIOMA DE LA BD (O fallback a español)
        const lang = client.preferred_language === 'en' ? 'INGLÉS (English)' : 'ESPAÑOL';

        // 🚨 PROMPT ACTUALIZADO PARA PEDIR UN ASUNTO DINÁMICO
        const prompt = `
          Eres el Director de Exportaciones B2B de Fresh Food Panama.
          Vas a redactar un correo directo a nuestro cliente actual: ${client.name}.
          MOTIVO: ${campaignContext}
          
          REGLAS ESTRICTAS:
          1. Idioma: ${lang}.
          2. LA PRIMERA LÍNEA DEBE SER EL ASUNTO EXACTO, usando este formato: 
             ASUNTO: [Tu asunto dinámico y persuasivo aquí]
          3. A partir de la segunda línea, redacta el cuerpo del correo. Inicia con un saludo formal pero directo.
          4. Tono: Transaccional, experto. Cero poesía ("espero que este correo le encuentre bien").
          5. NO FIRMES el correo.
        `;

        const result = await model.generateContent(prompt);
        let rawResponse = result.response.text().trim();

        // 🚨 SEPARAR EL ASUNTO DEL CUERPO
        let dynamicSubject = "Actualización Operativa - Fresh Food Panama";
        let emailBody = rawResponse;

        const lines = rawResponse.split('\n');
        if (lines[0].toUpperCase().includes('ASUNTO:')) {
          dynamicSubject = lines[0].replace(/ASUNTO:/i, '').trim();
          emailBody = lines.slice(1).join('\n').trim();
        } else if (lines[0].toUpperCase().includes('SUBJECT:')) {
          dynamicSubject = lines[0].replace(/SUBJECT:/i, '').trim();
          emailBody = lines.slice(1).join('\n').trim();
        }

        emailBody = emailBody.replace(/(Sincerely|Best regards|Regards|Atentamente|Saludos cordiales|Un saludo)[\s\S]*/gi, '').trim();
        
        const plainTextSignature = `\n\n--\nDirección Comercial\nFresh Food Panamá\nWeb: freshfoodpanama.com\n\n---\nSi deseas dejar de recibir estas alertas, responde "Baja".`;
        const finalPlainText = emailBody + plainTextSignature;

        const htmlBody = emailBody.replace(/\n/g, '<br>');
        const emailHtml = `
          <div style="font-family: -apple-system, sans-serif; font-size: 14px; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
            ${htmlBody}
            <br><br>--<br><strong>Dirección Comercial</strong><br>Fresh Food Panamá<br><a href="https://freshfoodpanama.com" style="color: #d17711; text-decoration: none;">freshfoodpanama.com</a>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin-top: 30px; margin-bottom: 20px;" />
            <p style="font-size: 11px; color: #94a3b8; text-align: center;">Si deseas dejar de recibir nuestras alertas, responde "Baja".</p>
          </div>
        `;

        // 🚨 MODO VISTA PREVIA (Si es true, guardamos los datos y ROMPEMOS el ciclo sin enviar nada)
        if (previewOnly) {
          previewData = { subject: dynamicSubject, html: emailHtml };
          break; // Rompemos el for loop
        }

        // Si no es preview, enviamos por Resend
        const resendReq = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Fresh Food Panama <ventas@freshfoodpanama.com>', // 🚨 Verifica tu dominio
            to: client.contact_email,
            subject: dynamicSubject,
            html: emailHtml,
            text: finalPlainText
          })
        });

        if (resendReq.ok) enviosExitosos++;
      }

      // Si estábamos en modo preview, devolvemos el borrador generado
      if (previewOnly) {
        return { statusCode: 200, headers, body: JSON.stringify({ isPreview: true, previewData }) };
      }

      return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: `Se enviaron ${enviosExitosos} correos exitosamente.` }) };
    }

    // ... (La Ruta B de Leads se mantiene igual) ...

  } catch (error: any) {
    console.error("Error en generate-campaign:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};