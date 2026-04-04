import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Inicializamos Supabase con la Service Role Key para saltar RLS en el insert
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const handler = async () => {
  // CONFIGURACIÓN 2026: Usamos el ID de modelo estándar sin sufijos beta
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash" 
  });

  const prompt = `
    Actúa como un Analista de Inteligencia de Mercados especializado en frutas tropicales.
    Identifica 5 empresas REALES que operen en MERCAMADRID (España) y que sean importadores activos de "Piña Avión" (MD2 Premium) o frutas exóticas de alta gama.
    
    Es vital que los datos sean coherentes. Devuelve ÚNICAMENTE un arreglo JSON (sin texto extra, sin markdown) con este formato:
    [{
      "company_name": "Nombre de la Empresa",
      "city": "Madrid",
      "country": "España",
      "website": "https://url-real-o-vacia.com",
      "contact_email": "email-de-contacto@empresa.com",
      "preferred_language": "es",
      "ai_analysis": "Análisis de por qué es buen prospecto para Piña Panameña"
    }]
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // LIMPIEZA "BULL-PROOF" DEL JSON
    // Buscamos el primer '[' y el último ']' por si la IA devuelve markdown (```json ...)
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    
    if (start === -1 || end === -1) {
      console.error("Respuesta cruda de la IA:", text);
      throw new Error("La IA no devolvió un formato JSON válido.");
    }
    
    const cleanJson = text.substring(start, end + 1);
    const leads = JSON.parse(cleanJson);

    // INSERCIÓN EN SUPABASE
    const { data, error: dbError } = await supabase
      .from('leads_prospecting')
      .insert(leads)
      .select();

    if (dbError) throw dbError;

    return {
      statusCode: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      },
      body: JSON.stringify({ 
        message: `${leads.length} prospectos identificados y guardados.`, 
        count: leads.length 
      }),
    };

  } catch (err: any) {
    console.error("Error crítico en Lead Miner:", err.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        error: "Fallo en el proceso de minado", 
        details: err.message 
      })
    };
  }
};