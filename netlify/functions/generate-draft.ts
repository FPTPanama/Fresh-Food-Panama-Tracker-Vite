import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
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
    const { leadId, emailType = 'intro' } = JSON.parse(event.body || '{}');

    // 1. Obtener datos del Lead
    const { data: lead } = await supabase.from('leads_prospecting').select('*').eq('id', leadId).single();
    if (!lead) throw new Error("Lead no encontrado");

    // Identificamos el producto
    const productTarget = (lead.interested_in && lead.interested_in[0]) || 'Piña Premium';
    const isPineapple = productTarget.toLowerCase().includes('piña') || productTarget.toLowerCase().includes('pineapple');

    // 2. Obtener datos de la Empresa
    const { data: biz } = await supabase.from('product_settings').select('*').ilike('product_name', `%${productTarget}%`).single();
    if (!biz) throw new Error(`Sin configuración para: ${productTarget}`);

    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });

    // 3. 🚀 FIX: Lógica Bilingüe Inteligente y Limpieza de Nombre
    // Si no es explícitamente español ('es'), usamos Inglés por defecto para el mercado internacional.
    const isSpanish = lead.preferred_language === 'es';
    const lang = isSpanish ? 'ESPAÑOL' : 'INGLÉS (Professional English)';
    
    // Limpiamos los sufijos corporativos (Alemania, España, etc.)
    const cleanName = lead.company_name.replace(/,?\s*(GmbH & Co\. KG|GmbH|AG|KG|S\.L\.|S\.A\.|S\.A\.U\.|S\.L\.U\.|S\.L\. UNIPERSONAL)$/i, '');

    const culturalContext = isSpanish 
      ? "Usa 'Ustedes'. Tono profesional, directo y orientado a resultados." 
      : "German/European B2B style: Highly professional, fact-based, no fluff, direct to the point. Use formal 'You'.";

    // 4. 🚀 FIX: Estrategias Inyectadas con Datos Duros
    const hardFacts = isPineapple 
      ? "MENCIONA ESTOS DATOS: Certificación Global G.A.P. y FDA, Calibres 5-6, Color 2.5-3, Brix >13, y logística aérea en 48 horas a Europa."
      : "";

    const strategies: Record<string, string> = {
      intro: `Enfoque: Presentación de capacidad exportadora directa.
              Meta: Solicitar una reunión breve para mostrar tarifas.
              ${hardFacts}`,
      
      vip: `Enfoque: Socio Estratégico para gran volumen. 
            Resalta: Estabilidad de suministro y consistencia de calidad.
            ${hardFacts}`,
      
      seguimiento_1: `Enfoque: Trazabilidad y Tecnología.
                      MENCIONA ESTO EXACTAMENTE: Nuestro protocolo "FreshConnect", que permite acceso a documentos de embarque en vivo e inspección visual desde origen.`,
      
      seguimiento_2: `Enfoque: Envío de prueba (Trial order).
                      Meta: Proponer un palet de prueba vía aérea para que validen la calidad (color y brix) por sí mismos.`
    };
    const currentStrategy = strategies[emailType] || strategies['intro'];

    // 5. Prompt Maestro Blindado
    const prompt = `
      Eres un director comercial B2B de alto nivel. Vas a redactar un correo a ${cleanName} en ${lead.city}.

      REGLA DE IDIOMA: Redacta TODO el correo estrictamente en ${lang}.

      CONTEXTO:
      - Empresa remitente: Fresh Food Panamá.
      - Producto: ${productTarget}.

      ESTRATEGIA A APLICAR:
      ${currentStrategy}

      REGLAS DE REDACCIÓN "ANTI-SPAM":
      1. PRIMERA LÍNEA: Escribe solo "ASUNTO: [Tu asunto aquí]" o "SUBJECT: [Your subject here]". El asunto debe ser técnico y generar curiosidad (ej: Direct supply of Premium MD2 Pineapples).
      2. SALUDO: Inicia directamente con "Hola equipo de ${cleanName}," o "Hello ${cleanName} team,".
      3. ESTRUCTURA: Ve directo al grano. Máximo 4 párrafos cortos.
      4. TONO: ${culturalContext}.
      5. DESPEDIDA: NO escribas "Sincerely", "Best regards", ni tu nombre al final. Yo pondré la firma mediante código. Termina con la última pregunta o frase de cierre.
    `;

    const result = await model.generateContent(prompt);
    let rawResponse = result.response.text().trim();

    // 6. Separación de Asunto y Cuerpo
    let dynamicSubject = isSpanish ? `Suministro B2B - ${biz.company_name}` : `B2B Supply - ${biz.company_name}`;
    let emailBody = rawResponse;

    const lines = rawResponse.split('\n');
    if (lines[0].toUpperCase().includes('ASUNTO:') || lines[0].toUpperCase().includes('SUBJECT:')) {
      dynamicSubject = lines[0].replace(/ASUNTO:|SUBJECT:/i, '').trim();
      emailBody = lines.slice(1).join('\n').trim();
    }

    // Limpieza de despedidas huérfanas de la IA
    emailBody = emailBody.replace(/(Sincerely|Best regards|Kind regards|Regards|Atentamente|Saludos cordiales|Un saludo)[\s\S]*/gi, '').trim();

    // 7. 🚀 FIX: Firma y Disclaimer Bilingües
    const role = isSpanish ? "Director de Exportaciones" : "Export Director";
    const optOutText = isSpanish 
      ? "Este es un correo comercial. Si deseas dejar de recibir nuestras actualizaciones, responde 'Baja'." 
      : "This is a commercial email. If you prefer not to receive further updates, simply reply 'Opt-out'.";

    const finalPlainText = `${emailBody}\n\n--\nFreddy García\n${role} | Fresh Food Panamá C.A.\nWhatsApp: +507 6303-6338\nWeb: www.freshfoodpanama.com\n\n---\n${optOutText}`;

    const htmlBody = emailBody.replace(/\n/g, '<br>');
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.5; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${htmlBody}
        <br><br>
        <p>
          <strong>Freddy García</strong><br>
          ${role} | Fresh Food Panamá C.A.<br>
          WhatsApp: +507 6303-6338<br>
          <a href="https://www.freshfoodpanama.com" style="color: #1b5e20; text-decoration: none; font-weight: bold;">www.freshfoodpanama.com</a>
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px; margin-bottom: 20px;" />
        <p style="font-size: 11px; color: #999; text-align: justify; line-height: 1.4;">
          ${optOutText}
        </p>
      </div>
    `;

    // 8. Guardar en Supabase
    await supabase.from('leads_prospecting').update({ 
      email_draft: emailHtml,
      last_email_type: emailType 
    }).eq('id', leadId);

    return { 
      statusCode: 200, 
      headers,
      body: JSON.stringify({ 
        subject: dynamicSubject,
        draft: emailHtml,
        textFallback: finalPlainText 
      }) 
    };

  } catch (err: any) {
    console.error("Error en Generator:", err.message);
    return { 
      statusCode: 500, 
      headers,
      body: JSON.stringify({ error: err.message }) 
    };
  }
};