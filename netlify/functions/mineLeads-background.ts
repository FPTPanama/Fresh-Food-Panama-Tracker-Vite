import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const handler = async (event: any) => {
  let location = "Mercamadrid, España";
  let product = "Piña Premium"; 
  
  // Manejo seguro del body para Netlify
  if (event.body) {
    try {
      const payload = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
      const body = JSON.parse(payload);
      if (body.location) location = body.location;
      if (body.product) product = body.product;
    } catch (e) {
      console.log("No body provided or invalid JSON, using defaults");
    }
  }

  // CONFIGURACIÓN DE MICRO-LOTES
  const TOTAL_BATCHES = 7; // 7 iteraciones
  const LEADS_PER_BATCH = 3; // 3 leads por iteración (Total esperado: 21 leads)

  console.log(`🤖 Iniciando minado de ALTA PRECISIÓN en Micro-Lotes (${TOTAL_BATCHES}x${LEADS_PER_BATCH}) para ${product} en ${location}...`);

  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });
    
    // 1. Obtener Blacklist inicial de la base de datos (ampliamos el límite para no repetir nunca)
    const { data: existing } = await supabase.from('leads_prospecting').select('company_name').limit(1500);
    let currentBlacklist = existing?.map(e => e.company_name) || [];
    
    let allLeads: any[] = [];

    // 2. EJECUCIÓN DEL BUCLE DE MICRO-LOTES
    for (let lote = 1; lote <= TOTAL_BATCHES; lote++) {
      console.log(`⏳ Procesando Micro-Lote ${lote} de ${TOTAL_BATCHES}...`);
      
      const blacklistStr = currentBlacklist.length > 0 ? currentBlacklist.join(', ') : 'Ninguna';
      
      // Pedimos SOLO 3 leads para máxima calidad y evitar cortes
      const prompt = `
        Actúa como un analista de mercado B2B experto en el sector agrícola.
        Identifica EXACTAMENTE ${LEADS_PER_BATCH} empresas reales en ${location} que importen o distribuyan ${product}.
        EXCLUYE estrictamente estas empresas: [${blacklistStr}].
        
        REGLAS DE FORMATO (Devuelve ÚNICAMENTE JSON VÁLIDO):
        1. country_code: Código ISO 3166-1 alpha-2 (ej: 'ES').
        2. tags: Array con 3 etiquetas de operación (ej: ["Mayorista", "Importador", "Retail"]).
        3. ai_analysis: Una frase de máximo 15 palabras sobre su potencial.
        
        Estructura JSON requerida: [{company_name, city, country, country_code, website, contact_email, contact_phone, company_size, tags, ai_analysis, lead_score}]
      `;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      try {
        const batchLeads = JSON.parse(text);
        allLeads = [...allLeads, ...batchLeads];
        
        // Alimentamos el blacklist para la siguiente vuelta del bucle
        const newNames = batchLeads.map((l: any) => l.company_name);
        currentBlacklist = [...currentBlacklist, ...newNames];
        
        console.log(`✅ Lote ${lote} extraído con éxito (${batchLeads.length} leads). Acumulados: ${allLeads.length}`);
      } catch (parseError) {
        console.error(`❌ Error al leer JSON en el Lote ${lote}. Posible microcorte de Google.`);
        // Si hay un fallo de red o de Google, rompemos el bucle PERO salvamos todo lo acumulado hasta ahora.
        if (allLeads.length === 0) throw new Error("Fallo desde el primer lote, JSON truncado");
        else break;
      }
    }

    if (allLeads.length === 0) throw new Error("No se pudo extraer ningún lead válido.");

    // 3. Formateo e Inserción Masiva
    const formattedLeads = allLeads.map((l: any) => ({ 
      ...l, 
      status: 'new',
      pipeline_stage: 'inbox',
      interested_in: [product], 
      source: 'ai-cron', 
      created_at: new Date().toISOString()
    }));

    const { error } = await supabase.from('leads_prospecting').insert(formattedLeads);
    if (error) throw error;
    
    console.log(`🚀 ÉXITO TOTAL: Se han minado e insertado ${allLeads.length} leads de alta precisión correctamente.`);
    return { statusCode: 200 };

  } catch (err: any) {
    console.error("❌ Error crítico en mineLeads-background:", err.message);
    return { statusCode: 500 };
  }
};