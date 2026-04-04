import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const handler = async () => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Prompt ultra-simplificado para evitar timeouts y errores de formato
    const prompt = `Genera un JSON con exactamente 2 empresas reales de Mercamadrid importadoras de fruta. 
    Usa estrictamente este formato de array: 
    [{"company_name": "Nombre", "city": "Madrid", "country": "España", "website": "URL", "contact_email": "email", "ai_analysis": "breve nota"}]`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Limpieza de JSON
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start === -1) throw new Error("La IA no generó un JSON válido");
    const leads = JSON.parse(text.substring(start, end + 1));

    // Mapeo manual para asegurar que los campos sean EXACTOS a tu DB
    const cleanLeads = leads.map((l: any) => ({
      company_name: l.company_name || 'Sin nombre',
      city: l.city || 'Madrid',
      country: l.country || 'España',
      website: l.website || '',
      contact_email: l.contact_email || '',
      ai_analysis: l.ai_analysis || 'Identificado vía Gemini Pro',
      status: 'new'
    }));

    const { error: dbError } = await supabase
      .from('leads_prospecting')
      .insert(cleanLeads);

    if (dbError) throw new Error(`Supabase Error: ${dbError.message}`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: "Éxito", count: cleanLeads.length }),
    };

  } catch (err: any) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message })
    };
  }
};