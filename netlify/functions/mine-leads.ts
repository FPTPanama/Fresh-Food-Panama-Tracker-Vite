import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Inicialización de clientes fuera del handler para reutilizar conexiones
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const handler = async () => {
  // Usamos gemini-1.5-flash o gemini-pro. 1.5 es más rápido y preciso para JSON.
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    generationConfig: { responseMimeType: "application/json" } // Forzamos salida JSON
  });

  const prompt = `
    Actúa como un Analista de Inteligencia de Mercados especializado en el sector hortofrutícola español.
    Tu objetivo es identificar 5 empresas REALES y ACTUALES ubicadas físicamente en MERCAMADRID (España) que importen "Piña MD2 Premium" vía aérea (Piña Avión) desde Costa Rica o Panamá.
    
    Busca mayoristas especializados en frutas tropicales exóticas de alta gama.
    
    Para cada empresa necesito este formato JSON exacto:
    {
      "company_name": "Nombre legal o comercial de la empresa",
      "city": "Madrid",
      "country": "España",
      "website": "URL del sitio web",
      "contact_email": "Email comercial, de compras o general",
      "preferred_language": "es",
      "ai_analysis": "Explicación de por qué venden piña premium y su relevancia en Mercamadrid"
    }
    
    Devuelve ÚNICAMENTE un arreglo de objetos JSON, sin texto adicional, sin formato markdown.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Limpieza de posibles bloques de código markdown
    const jsonCleaned = text.replace(/```json|```/g, "").trim();
    const leads = JSON.parse(jsonCleaned);

    if (!Array.isArray(leads)) {
      throw new Error("La IA no devolvió un formato de arreglo válido.");
    }

    // Insertar en la tabla que creamos en Supabase
    const { data, error: dbError } = await supabase
      .from('leads_prospecting')
      .insert(leads)
      .select();

    if (dbError) throw dbError;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        message: `${leads.length} prospectos de Mercamadrid minados con éxito`, 
        count: leads.length,
        data 
      }),
    };

  } catch (err: any) {
    console.error("Error en Lead Miner:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Error procesando leads", 
        details: err.message 
      }),
    };
  }
};