import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { schedule } from '@netlify/functions'; // Importamos el helper

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Definimos la lógica de la función
const cronHandler = async () => {
  console.log("--- EJECUTANDO CRON DE MINADO (MADRID/BARCELONA) ---");
  
  try {
    const { data: existing } = await supabase.from('leads_prospecting').select('company_name').limit(150);
    const blacklist = existing?.map(e => e.company_name).join(', ') || 'Ninguna';

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      Actúa como un analista de mercado hispanohablante.
      Identifica 10 empresas REALES: 5 en Mercamadrid y 5 en Mercabarna que importen piña premium. 
      EXCLUYE: [${blacklist}]. 
      
      REGLA DE ORO: Todo el contenido del JSON debe estar ESTRICTAMENTE EN ESPAÑOL.
      
      Para el campo "ai_analysis", usa estrictamente este formato de 4 puntos:
      "Foco: [Su nicho] | Vol: [Alto/Medio/Bajo] | Log: [Aérea/Marítima/Terrestre] | Segmento: [Minorista/Mayorista/Horeca]"
      
      Devuelve solo el array JSON con los campos estándar solicitados.
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start === -1) throw new Error("IA no devolvió JSON");
    
    const leads = JSON.parse(text.substring(start, end + 1));

    const { error } = await supabase.from('leads_prospecting').insert(
      leads.map((l: any) => ({ 
        ...l, 
        status: 'new', 
        source: 'cron_weekly_es' 
      }))
    );

    if (error) throw error;
    console.log(`--- CRON COMPLETADO: ${leads.length} LEADS INSERTADOS ---`);
    
    return { statusCode: 200 };
  } catch (err: any) {
    console.error("ERROR EN CRON:", err.message);
    return { statusCode: 500 };
  }
};

// 🚀 LA SOLUCIÓN AL ERROR: Envolvemos el handler con el horario aquí mismo
// Lunes y Miércoles a las 8:00 AM (0 8 * * 1,3)
export const handler = schedule("0 8 * * 1,3", cronHandler);