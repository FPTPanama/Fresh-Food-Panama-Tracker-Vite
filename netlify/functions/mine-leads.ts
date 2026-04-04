import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const handler = async () => {
  // CAMBIO: Usamos "gemini-1.5-flash-latest" o "gemini-pro" para mayor compatibilidad
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash-latest" 
  });

  const prompt = `
    Actúa como un Analista de Inteligencia de Mercados.
    Identifica 5 empresas REALES en MERCAMADRID (España) que importen "Piña Avión" (MD2 Premium) desde Panamá o Costa Rica.
    
    Devuelve ÚNICAMENTE un arreglo JSON con este formato:
    [{
      "company_name": "Nombre",
      "city": "Madrid",
      "country": "España",
      "website": "URL",
      "contact_email": "Email",
      "preferred_language": "es",
      "ai_analysis": "Análisis corto"
    }]
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Limpiador de JSON por si la IA añade texto extra
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start === -1) throw new Error("No se encontró JSON en la respuesta");
    
    const leads = JSON.parse(text.substring(start, end + 1));

    const { data, error: dbError } = await supabase
      .from('leads_prospecting')
      .insert(leads)
      .select();

    if (dbError) throw dbError;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: `${leads.length} prospectos minados con éxito`, data }),
    };

  } catch (err: any) {
    console.error("Error en Lead Miner:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message })
    };
  }
};