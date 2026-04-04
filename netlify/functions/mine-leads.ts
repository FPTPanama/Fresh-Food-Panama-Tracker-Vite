import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const handler = async (event: any) => {
  // 1. Recibimos Ubicación y PRODUCTO desde la interfaz
  let location = "Mercamadrid, España";
  let product = "Piña Premium y frutas exóticas"; // Valor por defecto
  
  if (event.body) {
    const body = JSON.parse(event.body);
    if (body.location) location = body.location;
    if (body.product) product = body.product;
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const { data: existing } = await supabase.from('leads_prospecting').select('company_name').limit(100);
    const blacklist = existing?.map(e => e.company_name).join(', ') || 'Ninguna';

    // 2. El Prompt ahora es 100% dinámico
    const prompt = `
      Actúa como un analista de mercado hispanohablante.
      Identifica 10 empresas reales en ${location} que sean importadores o distribuidores de ${product}.
      EXCLUYE estas empresas: [${blacklist}].
      
      REGLA DE ORO: Todo el contenido del JSON debe estar ESTRICTAMENTE EN ESPAÑOL.
      
      Para el campo "ai_analysis", usa estrictamente este formato de 4 puntos en español:
      "Foco: [Su nicho] | Vol: [Alto/Medio/Bajo] | Log: [Aérea/Marítima/Terrestre] | Segmento: [Minorista/Mayorista/Horeca]"
      
      Devuelve ÚNICAMENTE un array JSON con: company_name, city, country, website, contact_email, contact_phone, company_size, air_experience, ai_analysis, lead_score (1-5).
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleanJson = text.substring(text.indexOf('['), text.lastIndexOf(']') + 1);
    const leads = JSON.parse(cleanJson);

    // Guardamos en la fuente (source) el producto para saber de qué campaña vino
    const { error } = await supabase.from('leads_prospecting').insert(
      leads.map((l: any) => ({ 
        ...l, 
        status: 'new', 
        source: `manual_${product.substring(0,10).replace(/\s/g, '_')}` 
      }))
    );

    if (error) throw error;
    return { statusCode: 200, body: JSON.stringify({ message: `Minado exitoso: 10 leads para ${product}`, count: leads.length }) };

  } catch (err: any) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};