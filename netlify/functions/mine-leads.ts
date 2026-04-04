import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const handler = async () => {
  try {
    // 2026 Standard: Usamos el ID de modelo limpio
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Actúa como un experto en mercados de frutas. 
    Encuentra 3 empresas reales en Mercamadrid que importen piña premium. 
    Responde ÚNICAMENTE con un array JSON: 
    [{"company_name": "Nombre", "city": "Madrid", "country": "España", "website": "URL", "contact_email": "Email", "ai_analysis": "breve análisis"}]`;

    // Generar contenido
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Limpiador robusto de JSON (ignora si la IA pone texto antes o después)
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start === -1) throw new Error("La IA no devolvió un formato JSON.");
    
    const leads = JSON.parse(text.substring(start, end + 1));

    // Inserción en Supabase
    const { error: dbError } = await supabase
      .from('leads_prospecting')
      .insert(leads);

    if (dbError) throw new Error(`Supabase: ${dbError.message}`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: "Éxito", count: leads.length }),
    };

  } catch (err: any) {
    // Si el error persiste, nos dirá exactamente por qué
    console.error("ERROR EN EL MINADO:", err.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message })
    };
  }
};