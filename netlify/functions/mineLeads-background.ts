import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Configuración de clientes con variables de entorno de Netlify
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const handler = async (event: any) => {
  // Parámetros por defecto para el minado
  let location = "Mercamadrid, España";
  let product = "Piña Premium"; 
  
  // Soporte para disparar el minado con parámetros personalizados desde el body
  if (event.body) {
    try {
      const body = JSON.parse(event.body);
      if (body.location) location = body.location;
      if (body.product) product = body.product;
    } catch (e) {
      console.log("No body provided or invalid JSON, using defaults");
    }
  }

  console.log(`Iniciando minado de fondo: 20 leads para ${product} en ${location}...`);

  try {
    // Mantenemos estrictamente tu modelo gemini-2.5-flash
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    // 1. Obtener empresas existentes para evitar duplicados (Blacklist)
    const { data: existing } = await supabase.from('leads_prospecting').select('company_name').limit(500);
    const blacklist = existing?.map(e => e.company_name).join(', ') || 'Ninguna';

    const prompt = `
      Actúa como un analista de mercado B2B experto en el sector agrícola.
      Identifica EXACTAMENTE 20 empresas reales en ${location} que importen o distribuyan ${product}.
      EXCLUYE estas empresas: [${blacklist}].
      
      REGLAS DE FORMATO:
      1. country_code: Código ISO 3166-1 alpha-2 (ej: 'ES').
      2. tags: Array con 3 etiquetas de operación (ej: ["Mayorista", "Importador", "Retail"]).
      3. ai_analysis: Una frase de máximo 15 palabras sobre su potencial.
      
      Devuelve ÚNICAMENTE un array JSON válido con: 
      company_name, city, country, country_code, website, contact_email, contact_phone, company_size, tags (array), ai_analysis, lead_score (1-5).
    `;

    // 2. Ejecución de la IA
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // 3. Extracción y parsing del JSON
    const cleanJson = text.substring(text.indexOf('['), text.lastIndexOf(']') + 1);
    const leads = JSON.parse(cleanJson);

    // 4. Preparación de datos para la base de datos de Fresh Food Panamá
    const formattedLeads = leads.map((l: any) => ({ 
      ...l, 
      status: 'new',
      pipeline_stage: 'inbox',
      interested_in: [product], 
      source: `ai_mining_bg_${product.substring(0,10).toLowerCase().replace(/\s/g, '_')}`,
      created_at: new Date().toISOString()
    }));

    // 5. Inserción masiva en Supabase
    const { error } = await supabase.from('leads_prospecting').insert(formattedLeads);

    if (error) throw error;
    
    console.log(`Éxito: Se han minado e insertado ${leads.length} leads correctamente.`);
    
    // Al ser background, Netlify ya respondió 202 al cliente antes de llegar aquí.
    return { statusCode: 200 };

  } catch (err: any) {
    console.error("Error crítico en mineLeads-background:", err.message);
    return { statusCode: 500 };
  }
};