import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const handler = async (event: any) => {
  const { leadId, emailType = 'intro' } = JSON.parse(event.body || '{}');

  try {
    // 1. Obtener datos del Lead
    const { data: lead } = await supabase.from('leads_prospecting').select('*').eq('id', leadId).single();
    if (!lead) throw new Error("Lead no encontrado");

    // Identificamos el producto (fallback a Piña Premium si no hay datos)
    const productTarget = (lead.interested_in && lead.interested_in[0]) || 'Piña Premium';
    const isPineapple = productTarget.toLowerCase().includes('piña');

    // 2. Obtener datos de la Empresa para el producto específico
    const { data: biz } = await supabase
      .from('product_settings')
      .select('*')
      .ilike('product_name', `%${productTarget}%`)
      .single();

    if (!biz) throw new Error(`Sin configuración para: ${productTarget}`);

const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 3. Lógica Lingüística
    const isSpain = lead.country_code === 'ES';
    const lang = isSpain ? 'ESPAÑOL' : 'INGLÉS (English)';
    
    const culturalContext = isSpain 
      ? "Usa 'Ustedes'. Prohibido el 'vosotros/vuestro'. Tono profesional latinoamericano." 
      : "High-level B2B professional English. Use 'You' (formal). Direct and clear value proposition.";

    // 4. Estrategias Dinámicas (Se alimentan de la DB para evitar errores de referencia)
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

    // 5. El Prompt Maestro con la regla Anti-Firma y Anti-Saludos Poéticos
    const prompt = `
      Eres un vendedor B2B francotirador. Vas a redactar el CUERPO de un correo de venta directa a ${lead.company_name} en ${lead.city}.

      REGLA DE IDIOMA: Redacta TODO el correo (Asunto y Cuerpo) estrictamente en ${lang}.

      CONTEXTO DEL NEGOCIO:
      - Empresa: ${biz.company_name} (website: ${biz.website}).
      - Producto: ${biz.product_name}.
      - Ventajas: ${biz.usp_1} | ${biz.usp_2}.
      - Logística: Salidas desde Tocumen (PTY), Panamá.
      ${isPineapple ? '- Tiempo: <48h desde cosecha al aeropuerto de destino.' : '- Tiempos optimizados de cadena de frío.'}
      - Tecnología: Trazabilidad en vivo "Fresh Connect".

      OFERTA O MOTIVO DEL CORREO:
      ${currentStrategy}

      REGLAS DE REDACCIÓN "ANTI-FLUFF" (¡CUMPLE ESTO AL 100%!):
      1. ESTILO DIRECTO Y HUMANO: Escribe como una persona real en su oficina. Cero lenguaje poético, cero adornos corporativos. PROHIBIDO usar palabras como "delighted to announce", "esteemed", "meticulously", "pride ourselves", "valued partners". 
      2. PROHIBIDO SALUDAR POÉTICAMENTE: NO digas "I hope this email finds you well", "I trust this email finds you well", "Espero que estés bien", ni "Dear...". Inicia directamente con un saludo simple ("Hi ${lead.company_name} team," o "Hola equipo de ${lead.company_name},") y ve al grano en la misma línea.
      3. LONGITUD EXTREMA: El comprador no tiene tiempo. Máximo 4 a 5 oraciones cortas en todo el correo. Ve directo al grano desde la primera línea.
      4. TONO: ${culturalContext}. Transaccional, profesional, pero conversacional. 
      5. PROHIBIDO FIRMAR: NO escribas "Sincerely", "Best regards", ni tu nombre al final. Yo pondré la firma mediante código.
      6. ASUNTO: Primera línea debe decir "ASUNTO: [Asunto directo, sin clickbait, max 5 palabras en ${lang}]".
      7. No uses corchetes [ ] en el texto final. 
      8. Recuerda: Mercamadrid o Mercabarna son centros logísticos, no ciudades.
    `;

    const result = await model.generateContent(prompt);
    let rawDraft = result.response.text();

    // ------------------------------------------------------------------
    // EL "FILTRO ANTI-IA" Y LA INYECCIÓN DE FIRMA DINÁMICA
    // ------------------------------------------------------------------
    
    // 1. Cortar cualquier despedida y saludos poéticos residuales
    rawDraft = rawDraft.replace(/(Sincerely|Best regards|Regards|Atentamente|Saludos cordiales|Un saludo|Thank you|Gracias por su atención|I trust this email|I hope this email)[\s\S]*/gi, '').trim();

    // 2. Construir la firma de forma manual y limpia 
    const signature = `\n\n--\n${biz.sender_name}\nDirector de Exportaciones | ${biz.company_name}\nWhatsApp: +507 6000-0000\nWeb: ${biz.website}`;

    // 3. Unir el cuerpo limpio con la firma impecable
    const finalDraftText = rawDraft + signature;

    // 6. Guardar borrador final en Supabase
    await supabase.from('leads_prospecting').update({ 
      email_draft: finalDraftText,
      last_email_type: emailType 
    }).eq('id', leadId);

    return { statusCode: 200, body: JSON.stringify({ draft: finalDraftText }) };

  } catch (err: any) {
    console.error("Error en Generator:", err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};