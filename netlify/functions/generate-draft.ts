import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const handler = async (event: any) => {
  // Manejo estricto de CORS para evitar errores 500 silenciosos
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
    const isPineapple = productTarget.toLowerCase().includes('piña');

    // 2. Obtener datos de la Empresa
    const { data: biz } = await supabase
      .from('product_settings')
      .select('*')
      .ilike('product_name', `%${productTarget}%`)
      .single();

    if (!biz) throw new Error(`Sin configuración para: ${productTarget}`);

    // Usamos el modelo 2.5-flash por estabilidad, puedes cambiar a 3.1-flash-lite-preview si prefieres
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });

    // 3. Lógica Lingüística (Leyendo la columna correcta de Supabase)
    const lang = lead.preferred_language === 'en' ? 'INGLÉS (English)' : 'ESPAÑOL';
    
    const culturalContext = lang === 'ESPAÑOL' 
      ? "Usa 'Ustedes'. Prohibido el 'vosotros/vuestro'. Tono profesional latinoamericano." 
      : "High-level B2B professional English. Use 'You' (formal). Direct and clear value proposition.";

    // 4. Estrategias Dinámicas
    const strategies: Record<string, string> = {
      intro: `Enfoque: Calidad Boutique y Origen. 
              Menciona: Producto cosechado bajo demanda para máxima frescura.
              Diferencial: Calidad premium de exportación vs. fruta de volumen masivo de otros orígenes.`,
      
      vip: `Enfoque: Socio Estratégico de confianza. 
            Resalta: Capacidad de suministro estable, cumplimiento de normativas y certificaciones: ${biz.usp_1}. 
            Menciona: Salidas directas desde Panamá y total seriedad operativa.`,
      
      seguimiento_1: `Enfoque: Tecnología y Transparencia (Fresh Connect). 
                      Resalta: La capacidad de monitorear el embarque en vivo por nuestra plataforma propia. 
                      Valor: Seguridad total en la recepción y logística.`,
      
      seguimiento_2: `Enfoque: Invitación a Prueba Piloto. 
                      Resalta: Propuesta de coordinar un envío de prueba (Trial order) para validar la calidad. 
                      Detalle: Enfoque en la consistencia del producto y calibres de exportación.`
    };
    const currentStrategy = strategies[emailType] || strategies['intro'];

    // 5. Prompt Maestro con Reglas Estrictas
    const prompt = `
      Eres un vendedor B2B francotirador. Vas a redactar un correo de venta directa a ${lead.company_name} en ${lead.city}.

      REGLA DE IDIOMA: Redacta TODO el correo estrictamente en ${lang}.

      CONTEXTO DEL NEGOCIO:
      - Empresa: ${biz.company_name} (website: ${biz.website}).
      - Producto: ${biz.product_name}.
      - Ventajas: ${biz.usp_1} | ${biz.usp_2}.
      - Logística: Salidas desde Tocumen (PTY), Panamá.
      ${isPineapple ? '- Tiempo: <48h desde cosecha al aeropuerto.' : '- Tiempos optimizados de cadena de frío.'}

      OFERTA:
      ${currentStrategy}

      REGLAS DE REDACCIÓN "ANTI-FLUFF":
      1. LA PRIMERA LÍNEA DEBE SER EL ASUNTO: "ASUNTO: [Asunto directo y persuasivo en ${lang}]".
      2. PROHIBIDO SALUDAR POÉTICAMENTE: Nada de "I hope this finds you well". Inicia directamente con "Hola equipo de ${lead.company_name}," y ve al grano.
      3. LONGITUD: Máximo 4 a 5 oraciones.
      4. TONO: ${culturalContext}. Transaccional, profesional. 
      5. NO FIRMES: NO escribas "Sincerely", "Best regards", ni tu nombre al final.
    `;

    const result = await model.generateContent(prompt);
    let rawResponse = result.response.text().trim();

    // 6. Separación de Asunto y Cuerpo
    let dynamicSubject = `Oportunidad B2B - ${biz.company_name}`;
    let emailBody = rawResponse;

    const lines = rawResponse.split('\n');
    if (lines[0].toUpperCase().includes('ASUNTO:')) {
      dynamicSubject = lines[0].replace(/ASUNTO:/i, '').trim();
      emailBody = lines.slice(1).join('\n').trim();
    } else if (lines[0].toUpperCase().includes('SUBJECT:')) {
      dynamicSubject = lines[0].replace(/SUBJECT:/i, '').trim();
      emailBody = lines.slice(1).join('\n').trim();
    }

    // Filtro Anti-IA
    emailBody = emailBody.replace(/(Sincerely|Best regards|Regards|Atentamente|Saludos cordiales|Un saludo|Thank you|Gracias por su atención)[\s\S]*/gi, '').trim();

    // 7. Envoltura Spam-Proof
    const plainTextSignature = `\n\n--\n${biz.sender_name}\nDirector de Exportaciones | ${biz.company_name}\nWhatsApp: +507 6000-0000\nWeb: ${biz.website}\n\n---\nEste es un correo comercial B2B. Si deseas dejar de recibir nuestras alertas, responde "Baja".`;
    const finalPlainText = emailBody + plainTextSignature;

    const htmlBody = emailBody.replace(/\n/g, '<br>');
    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${htmlBody}
        <br><br>--<br>
        <strong>${biz.sender_name}</strong><br>
        Director de Exportaciones | ${biz.company_name}<br>
        WhatsApp: +507 6303-6338<br>
        <a href="${biz.website}" style="color: #d17711; text-decoration: none;">${biz.website}</a>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin-top: 30px; margin-bottom: 20px;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center; line-height: 1.4;">
          Este es un correo comercial operativo. Si no eres la persona adecuada en compras o deseas dejar de recibir nuestras actualizaciones de disponibilidad, simplemente responde a este correo con la palabra <strong>"Baja"</strong>.
        </p>
      </div>
    `;

    // 8. Guardar en Supabase (Guardamos la versión HTML formateada)
    await supabase.from('leads_prospecting').update({ 
      email_draft: emailHtml,
      last_email_type: emailType 
    }).eq('id', leadId);

    // Devolvemos toda la información útil al frontend
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
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }) 
    };
  }
};