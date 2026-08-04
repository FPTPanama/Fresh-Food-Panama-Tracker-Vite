import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!, 
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Al ser background, Netlify no espera que devolvamos un statusCode al navegador,
// simplemente ejecuta el proceso hasta que termina o falla.
export const handler = async (event: any) => {
  console.log("🕵️‍♂️ INICIANDO CAZADOR SILENCIOSO (BACKGROUND) - Procesando Backlog...");

  try {
    // 1. EXTRAER EXACTAMENTE 5 LEADS ANTIGUOS QUE NO HAN SIDO CONTACTADOS
    const { data: leadsToProcess, error: fetchError } = await supabase
      .from('leads_prospecting')
      .select('id, company_name, city, country_code, preferred_language')
      .eq('status', 'new')
      .is('active_campaign', null)
      .order('created_at', { ascending: true }) // Tomamos los más viejos primero
      .limit(5);

    if (fetchError) throw fetchError;

    if (!leadsToProcess || leadsToProcess.length === 0) {
      console.log("✅ No hay leads pendientes en el backlog. Todo al día.");
      return; 
    }

    console.log(`Procesando lote de ${leadsToProcess.length} leads (Modo Sándwich Lento)...`);

    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.1-flash-lite-preview", 
      generationConfig: { responseMimeType: "application/json" } 
    });

    const queueInserts: any[] = [];
    const campaignName = 'Auto-Standard ' + new Date().toLocaleDateString();
    const delayDays = [0, 4, 10, 17, 25];

    // 2. DEFINIR LA "CARNE ESTÁTICA" (Blindada contra alucinaciones)
    const getCoreMeat = (step: number, isSpanish: boolean) => {
      const meat: Record<number, { es: string, en: string }> = {
        1: {
          es: "Nuestra piña MD2 llega vía aérea en 48h con Brix >13 y calibres 5-6. Nuestro Trial Order estándar para inicio es de exactamente 5 pallets (200 cajas) para optimizar sus costos de flete.",
          en: "Our MD2 pineapple arrives via air in 48h with Brix >13 and sizes 5-6. Our standard Trial Order to start is exactly 5 pallets (200 boxes) to optimize your freight costs."
        },
        2: {
          es: "Con nuestro sistema FreshConnect, usted no asume riesgos a ciegas: recibe fotos de su carga e inspección de calidad en tiempo real antes de que el avión despegue.",
          en: "With our FreshConnect system, you don't take blind risks: you receive photos of your cargo and real-time quality inspection before the plane takes off."
        },
        3: {
          es: "Para su total tranquilidad aduanera, contamos con certificación Global G.A.P. y registro FDA, operando desde el Hub logístico de Panamá para garantizar la cadena de frío ininterrumpida.",
          en: "For your complete customs peace of mind, we hold Global G.A.P. certification and FDA registration, operating from Panama's logistics hub to guarantee an uninterrupted cold chain."
        },
        4: {
          es: "Para que evalúen nuestra capacidad sin alterar sus líneas actuales, propongo enviar el Trial Order aéreo de exactamente 5 pallets. Su equipo de calidad podrá validar el Brix y el color por sí mismos.",
          en: "To evaluate our capacity without altering your current lines, I propose sending the aerial Trial Order of exactly 5 pallets. Your quality team can validate the Brix and color themselves."
        },
        5: {
          es: "Comprendo que ahora mismo pueden tener sus líneas de suministro cubiertas. Dejo este canal abierto y quedamos a su disposición como un proveedor de respaldo ágil para cuando lo requieran.",
          en: "I understand you may currently have your supply lines covered. I am leaving this channel open and we remain at your disposal as an agile backup provider whenever required."
        }
      };
      return isSpanish ? meat[step].es : meat[step].en;
    };

    // 3. PROCESAR CADA LEAD (Bilingüe y Personalizado)
    for (const lead of leadsToProcess) {
      const isSpanish = lead.country_code === 'ES' || lead.preferred_language === 'es';
      const lang = isSpanish ? 'ESPAÑOL' : 'INGLÉS (Professional English)';
      const role = isSpanish ? "Dirección Comercial" : "Commercial Directorate";
      
      const cleanName = lead.company_name.replace(/,?\s*(GmbH & Co\. KG|GmbH|AG|KG|S\.L\.|S\.A\.|S\.A\.U\.|S\.L\.U\.|S\.L\. UNIPERSONAL)$/i, '');

      // Petición a Gemini: SOLO Pan Superior (Intro) y Pan Inferior (Outro)
      const prompt = `
        Eres el Director B2B de Fresh Food Panama.
        Escribe los textos dinámicos para una secuencia de 5 correos dirigida a la empresa "${cleanName}" ubicada en ${lead.city}.
        IDIOMA ESTRICTO: ${lang}
        
        Debes generar un "subject" (asunto del correo), un "intro" (saludo hiper-personalizado y directo de 2 líneas) y un "outro" (Llamado a la acción o cierre de 1 línea).
        NO redactes el cuerpo principal (yo lo inyectaré).
        Cero relleno. Tono transaccional europeo.
        
        ESTRATEGIA PARA LOS ASUNTOS:
        Paso 1: Presentación.
        Paso 2: Trazabilidad.
        Paso 3: Certificaciones G.A.P.
        Paso 4: Trial order.
        Paso 5: Despedida (Breakup email).

        JSON ESPERADO:
        [
          { "step": 1, "subject": "...", "intro": "...", "outro": "..." },
          { "step": 2, "subject": "...", "intro": "...", "outro": "..." },
          { "step": 3, "subject": "...", "intro": "...", "outro": "..." },
          { "step": 4, "subject": "...", "intro": "...", "outro": "..." },
          { "step": 5, "subject": "...", "intro": "...", "outro": "..." }
        ]
      `;

      try {
        const aiResponse = await model.generateContent(prompt);
        const slices = JSON.parse(aiResponse.response.text());

        slices.forEach((slice: any) => {
          const coreMeat = getCoreMeat(slice.step, isSpanish);
          const scheduledDate = new Date();
          scheduledDate.setDate(scheduledDate.getDate() + delayDays[slice.step - 1]);

          const optOutText = isSpanish ? "Responder 'Baja' para no recibir correos." : "Reply 'Opt-out' to stop emails.";
          const finalHtml = `
            <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.5; max-width: 600px;">
              ${slice.intro.replace(/\n/g, '<br>')}
              <br><br>
              <strong>${coreMeat}</strong>
              <br><br>
              ${slice.outro.replace(/\n/g, '<br>')}
              <br><br>
              <p><strong>Freddy García</strong><br>${role} | Fresh Food Panamá C.A.<br>www.freshfoodpanama.com</p>
              <hr style="border: none; border-top: 1px solid #eee; margin-top: 25px; margin-bottom: 20px;" />
              <p style="font-size: 11px; color: #999;">${optOutText}</p>
            </div>
          `;

          queueInserts.push({
            client_id: lead.id,
            campaign_context: `Slow Drip Standard - Backlog`,
            step: slice.step,
            subject: slice.subject,
            html_body: finalHtml,
            scheduled_for: scheduledDate.toISOString(),
            status: 'pending'
          });
        });

      } catch (aiErr) {
        console.error(`❌ Error generando textos para ${lead.company_name}:`, aiErr);
      }
    }

    // 4. GUARDAR EN COLA MASIVA Y ACTUALIZAR STATUS
    if (queueInserts.length > 0) {
      const { error: queueError } = await supabase.from('email_queue').insert(queueInserts);
      if (queueError) throw queueError;

      const leadIdsToUpdate = leadsToProcess.map(l => l.id);
      await supabase.from('leads_prospecting')
        .update({ status: 'in_pipeline', active_campaign: campaignName })
        .in('id', leadIdsToUpdate);
        
      console.log(`✅ CAZADOR SILENCIOSO FINALIZADO: Lote de ${leadsToProcess.length} leads procesado y encolado en modo Sándwich.`);
    }

  } catch (error: any) {
    console.error("❌ Error Fatal en process-backlog-drip-background:", error.message);
    
  }

  
};

