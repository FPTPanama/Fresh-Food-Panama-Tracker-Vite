import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { schedule } from '@netlify/functions';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const cronHandler = async () => {
  console.log("--- EJECUTANDO CRON DE MINADO (MADRID/BARCELONA) ---");
  
  try {
    const { data: existing } = await supabase.from('leads_prospecting').select('company_name').limit(200);
    const blacklist = existing?.map(e => e.company_name).join(', ') || 'Ninguna';

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // PROMPT ACTUALIZADO PARA LA NUEVA ARQUITECTURA DE DATOS
    const prompt = `
      Actúa como un analista de mercado hispanohablante experto en B2B agrícola.
      Identifica 10 empresas REALES: Que importen frutas exóticas (especialmente piña aérea) y sten ubicados en los principales mercados mayoristas.
      EXCLUYE: [${blacklist}]. 
      
      REGLAS DE FORMATO ESTRICTAS:
      1. Todo el contenido debe estar en ESPAÑOL.
      2. country_code: DEBE ser estrictamente 'ES' (código ISO 3166-1 alpha-2 para España).
      3. tags: Un array de strings con 3 etiquetas exactas sobre su operación. Usa palabras clave como "Mayorista", "Retail", "Aéreo", "Marítimo", "Horeca".
      4. ai_analysis: Una sola frase corta (máximo 15 palabras) resumiendo por qué son un buen objetivo.
      
      Devuelve ÚNICAMENTE un array JSON válido con estos campos: 
      company_name, city, country, country_code, website, contact_email, contact_phone, company_size, tags (array), ai_analysis, lead_score (1-5).
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start === -1) throw new Error("IA no devolvió JSON");
    
    const leads = JSON.parse(text.substring(start, end + 1));

    // FORMATEAMOS PARA EL NUEVO PIPELINE
    const formattedLeads = leads.map((l: any) => ({ 
      ...l, 
      status: 'new', 
      pipeline_stage: 'inbox',
      interested_in: ['Piña Premium'],
      source: 'cron_weekly_es' 
    }));

    const { error } = await supabase.from('leads_prospecting').insert(formattedLeads);

    if (error) throw error;
    console.log(`--- CRON COMPLETADO: ${leads.length} LEADS INSERTADOS ---`);
    
    return { statusCode: 200 };
  } catch (err: any) {
    console.error("ERROR EN CRON:", err.message);
    return { statusCode: 500 };
  }
};

// Lunes y Miércoles a las 8:00 AM (0 8 * * 1,3)
export const handler = schedule("0 8 * * 1,3", cronHandler);