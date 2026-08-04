import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Función para pausar la ejecución (Freno)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const handler = async () => {
  const { data: testLeads } = await supabase
    .from('leads_prospecting')
    .select('*')
    .ilike('company_name', '%Test%');

  if (!testLeads || testLeads.length === 0) return { statusCode: 404, body: "No test leads found." };

  // Usa el modelo que tienes habilitado
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview", generationConfig: { responseMimeType: "application/json" } });
  const queueInserts: any[] = [];

  const getCoreMeat = (step: number, isSpanish: boolean) => {
    const meat: any = {
      1: { es: "Nuestra piña MD2 llega vía aérea en 48h con Brix >13 y calibres 5-6. Pedido mín 5 pallets.", en: "Our MD2 pineapple arrives via air in 48h with Brix >13 and sizes 5-6. Min order 5 pallets." },
      2: { es: "Con FreshConnect recibe fotos e inspección en tiempo real.", en: "With FreshConnect receive photos and real-time inspection." },
      3: { es: "Certificación Global G.A.P. y FDA garantizada.", en: "Global G.A.P. and FDA certified." },
      4: { es: "Propongo un Trial Order de 5 pallets para validar calidad.", en: "I propose a 5-pallet Trial Order to validate quality." },
      5: { es: "Quedamos como su proveedor de respaldo ágil.", en: "We remain your agile backup provider." }
    };
    return isSpanish ? meat[step].es : meat[step].en;
  };

  for (const lead of testLeads) {
    const isSpanish = lead.country_code === 'ES';
    const lang = isSpanish ? 'ESPAÑOL' : 'INGLÉS';

   const prompt = `
      Eres el Director B2B de Fresh Food Panama, especialistas en exportación aérea de Piña Fresca MD2 a Europa.
      Escribe los textos dinámicos para una secuencia de 5 correos dirigida a la empresa importadora/mayorista "${lead.company_name}".
      IDIOMA ESTRICTO: ${lang}.
      
      REGLAS DE ORO:
      - Cero tecnología, software o "white papers". Tu mundo es la fruta fresca, importaciones, logística de frío, exóticos y Mercados Mayoristas.
      - "intro": Un saludo directo y profesional (1-2 líneas) mencionando el abastecimiento de frutas exóticas o frescura.
      - "outro": Una pregunta directa (1 línea) para agendar una llamada rápida o enviar tarifas de nuestra piña.
      
      ESTRATEGIA PARA LOS ASUNTOS (Subjects):
      Paso 1: Abastecimiento de piña premium.
      Paso 2: Trazabilidad logística.
      Paso 3: Certificaciones de calidad.
      Paso 4: Propuesta de prueba (Trial).
      Paso 5: Mantener el contacto.

      JSON ESPERADO:
      [
        { "step": 1, "subject": "...", "intro": "...", "outro": "..." },
        { "step": 2, "subject": "...", "intro": "...", "outro": "..." },
        { "step": 3, "subject": "...", "intro": "...", "outro": "..." },
        { "step": 4, "subject": "...", "intro": "...", "outro": "..." },
        { "step": 5, "subject": "...", "intro": "...", "outro": "..." }
      ]
    `;
    
    let aiRes;
    let retries = 3;
    
    // Bucle de reintentos anti-colapso
   while (retries > 0) {
      try {
        console.log(`Generando textos para ${lead.company_name}...`);
        aiRes = await model.generateContent(prompt);
        break; // Si tiene éxito, sale del bucle de reintentos
      } catch (e: any) {
        console.warn(`Error con Gemini (503/429). Reintentos restantes: ${retries - 1}`);
        retries--;
        if (retries === 0) throw e; // Si falla 3 veces, aborta
        await delay(5000); // Espera 5 segundos antes de volver a intentar
      }
    }

    // 👇 AQUÍ ESTÁ LA SOLUCIÓN MÁGICA PARA TYPESCRIPT 👇
    if (!aiRes) {
      console.error(`Omitiendo a ${lead.company_name} por fallo en la IA.`);
      continue; // Salta al siguiente cliente
    }

    const slices = JSON.parse(aiRes.response.text());

    slices.forEach((slice: any) => {
      const meat = getCoreMeat(slice.step, isSpanish);
      queueInserts.push({
        client_id: lead.id,
        step: slice.step,
        subject: `[TEST] ${slice.subject}`,
        html_body: `${slice.intro}<br><br><strong>${meat}</strong><br><br>${slice.outro}`,
        scheduled_for: new Date().toISOString(), // Todo para hoy
        status: 'pending'
      });
    });

    // Pausa obligatoria entre leads para no reventar la cuota de la API
    console.log("Pausando 4 segundos para respetar el Rate Limit de Google...");
    await delay(4000); 
  }

  await supabase.from('email_queue').insert(queueInserts);
  return { statusCode: 200, body: "Prueba encolada exitosamente." };
};