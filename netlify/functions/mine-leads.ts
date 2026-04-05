import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const handler = async (event: any) => {
  let location = "Mercamadrid, España";
  let product = "Piña Premium"; 
  
  if (event.body) {
    const body = JSON.parse(event.body);
    if (body.location) location = body.location;
    if (body.product) product = body.product;
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const { data: existing } = await supabase.from('leads_prospecting').select('company_name').limit(200);
    const blacklist = existing?.map(e => e.company_name).join(', ') || 'Ninguna';

    const prompt = `
      Actúa como un analista de mercado hispanohablante experto en B2B agrícola.
      Identifica 10 empresas reales en ${location} que importen/distribuyan ${product}.
      EXCLUYE: [${blacklist}].
      
      REGLAS DE FORMATO ESTRICTAS:
      1. country_code: DEBE ser estrictamente el código ISO 3166-1 alpha-2 (Ej: 'ES' para España, 'IT' para Italia, 'FR' para Francia).
      2. tags: Un array de strings con 3 etiquetas exactas sobre su operación. Usa palabras clave como "Mayorista", "Retail", "Aéreo", "Marítimo", "Alto Volumen".
      3. ai_analysis: Una sola frase corta (máximo 15 palabras) resumiendo por qué son un buen objetivo para ${product}.
      
      Devuelve ÚNICAMENTE un array JSON válido con estos campos: 
      company_name, city, country, country_code, website, contact_email, contact_phone, company_size, tags (array), ai_analysis, lead_score (1-5).
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleanJson = text.substring(text.indexOf('['), text.lastIndexOf(']') + 1);
    const leads = JSON.parse(cleanJson);

    // Formateamos los datos antes de guardarlos para el nuevo CRM
    const formattedLeads = leads.map((l: any) => ({ 
      ...l, 
      status: 'new',
      pipeline_stage: 'inbox',
      interested_in: [product], // Lo guardamos como Array
      source: `manual_${product.substring(0,10).replace(/\s/g, '_')}` 
    }));

    const { error } = await supabase.from('leads_prospecting').insert(formattedLeads);

    if (error) throw error;
    return { statusCode: 200, body: JSON.stringify({ message: `Minado estructurado completado para ${product}`, count: leads.length }) };

  } catch (err: any) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};