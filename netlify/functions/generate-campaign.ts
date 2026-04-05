import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const handler = async (event: any) => {
  // AQUÍ ESTÁ LA CLAVE: Esta es la función que recibe leadIds (plural) y campaignContext
  const { leadIds, campaignContext, productName } = JSON.parse(event.body || '{}');

  try {
    const { data: biz } = await supabase
      .from('product_settings')
      .select('*')
      .ilike('product_name', `%${productName}%`)
      .single();
      
    if (!biz) throw new Error(`Configuración de producto no encontrada para: ${productName}`);

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const safeContext = campaignContext || "Campaña General";
    const campaignName = safeContext.substring(0, 40) + (safeContext.length > 40 ? '...' : '');

    console.log(`Iniciando generación de campaña: "${campaignName}" para ${leadIds.length} leads.`);

    await Promise.all(leadIds.map(async (id: string) => {
      const { data: lead } = await supabase.from('leads_prospecting').select('*').eq('id', id).single();
      if (!lead) return;

      const isSpain = lead.country_code === 'ES';
      const lang = isSpain ? 'Español' : 'Inglés (English)';
      const isPineapple = biz.product_name.toLowerCase().includes('piña');
      
      const culturalContext = isSpain 
        ? "Usa 'Ustedes'. Prohibido el 'vosotros/vuestro'. Tono profesional latinoamericano." 
        : "High-level B2B professional English. Use 'You' (formal). Direct and clear value proposition.";

      // EL PROMPT "FRANCOTIRADOR B2B"
      const prompt = `
        Eres un vendedor B2B francotirador. Vas a redactar el CUERPO de un correo de venta directa a ${lead.company_name} en ${lead.city}.
        
        OFERTA ESPECÍFICA: ${safeContext}
        PRODUCTO: ${biz.product_name}
        
        REGLAS DE ORO EXTREMAS (CÚMPLELAS AL 100%):
        1. IDIOMA: Estrictamente en ${lang}.
        2. PROHIBIDO SALUDAR: NO digas "I hope this email finds you well", "Espero que estés bien", ni "Dear...". Inicia directamente con un saludo simple ("Hi ${lead.company_name} team," o "Hola equipo de ${lead.company_name},") y ve al grano en la misma línea.
        3. LONGITUD: Máximo 3 oraciones en todo el correo. Corto, al grano y transaccional.
        4. CERO ADORNOS: Elimina palabras como "delighted", "exclusive", "meticulously", "I trust this email finds you well", "valued partners". 
        5. PROHIBIDO FIRMAR: NO escribas "Sincerely", "Best regards", ni tu nombre al final. Yo pondré la firma.
        6. ASUNTO: Primera línea debe decir "ASUNTO: [Máximo 5 palabras]"
        7. TONO: ${culturalContext}
      `;

      const result = await model.generateContent(prompt);
      let rawDraft = result.response.text();

      // EL FILTRO ANTI-IA (Corta despedidas indeseadas)
      rawDraft = rawDraft.replace(/(Sincerely|Best regards|Regards|Atentamente|Saludos cordiales|Thank you|I trust this email)[\s\S]*/gi, '').trim();

      // LA FIRMA MANUAL
      const signature = `\n\n--\n${biz.sender_name}\nDirector de Exportaciones | Fresh Food Panamá\nWhatsApp: +507 6000-0000\nWeb: ${biz.website}`;
      
      const finalDraftText = rawDraft + signature;

      // GUARDADO EN BASE DE DATOS
      const { error: updateError } = await supabase.from('leads_prospecting').update({ 
        email_draft: finalDraftText,
        pipeline_stage: 'queued', 
        last_email_type: 'campaña_especial',
        active_campaign: campaignName 
      }).eq('id', id);

      if (updateError) {
        console.error(`Error guardando campaña para lead ${id}:`, updateError.message);
      }
    }));

    return { statusCode: 200, body: JSON.stringify({ message: "Campaña encolada correctamente" }) };
  } catch (err: any) {
    console.error("Error crítico en generate-campaign:", err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};