import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export const handler = async (event: any) => {
  const headers = { 
    'Access-Control-Allow-Origin': '*', 
    'Access-Control-Allow-Headers': 'Content-Type', 
    'Access-Control-Allow-Methods': 'POST, OPTIONS' 
  };
  
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: 'ok' };

  try {
    // 🚨 Extraemos el audienceType (con 'leads' por defecto para compatibilidad)
    const { leadIds, campaignContext, approvedSequence, audienceType = 'leads' } = JSON.parse(event.body || '{}');

    if (!leadIds || leadIds.length === 0) {
      throw new Error("No se proporcionaron IDs de destino.");
    }

    // 1. Determinar la tabla y columna correcta según la audiencia
    const tableName = audienceType === 'clients' ? 'clients' : 'leads_prospecting';
    const nameColumn = audienceType === 'clients' ? 'name' : 'company_name';

    // 2. Extraemos todos los objetivos (leads o clientes) del segmento
    const { data: targets, error: targetErr } = await supabase
      .from(tableName)
      .select(`id, ${nameColumn}`)
      .in('id', leadIds);

    if (targetErr || !targets) throw new Error("Error obteniendo los datos de la audiencia.");

    const queueInserts: any[] = [];
    const campaignName = 'Drip ' + new Date().toLocaleDateString();

    // 3. Procesamos cada objetivo
    targets.forEach((target: any) => {
      // Extraemos el nombre crudo dependiendo de la tabla
      const rawName = audienceType === 'clients' ? target.name : target.company_name;
      
      // Limpiador dinámico para inyección de nombre (GmbH, S.L., etc.)
      const cleanName = rawName.replace(/,?\s*(GmbH & Co\. KG|GmbH|AG|KG|S\.L\.|S\.A\.|S\.A\.U\.|S\.L\.U\.|S\.L\. UNIPERSONAL)$/i, '');

      // Evaluamos cada correo de la secuencia para este cliente
      approvedSequence.forEach((email: any) => {
        const scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + email.delay_days);

        // Reemplazamos el comodín por el nombre limpio de esta empresa en específico
        const personalizedSubject = email.subject.replace(/{{company_name}}/gi, cleanName);
        const personalizedHtml = email.full_html.replace(/{{company_name}}/gi, cleanName);

        queueInserts.push({
          client_id: target.id,
          campaign_context: campaignContext,
          step: email.step,
          subject: personalizedSubject,
          html_body: personalizedHtml,
          scheduled_for: scheduledDate.toISOString(),
          status: 'pending'
        });
      });
    });

    // 4. Guardamos la cola masiva en un solo request (Batch Insert)
    const { error: queueError } = await supabase.from('email_queue').insert(queueInserts);
    if (queueError) throw queueError;

    // 5. Actualizamos el estado de la audiencia para reflejar que están en campaña
    if (audienceType === 'leads') {
      await supabase.from('leads_prospecting')
        .update({ status: 'in_pipeline', active_campaign: campaignName })
        .in('id', leadIds);
    } else {
      // Si tu tabla de clientes tiene columna active_campaign, la actualizamos aquí.
      await supabase.from('clients')
        .update({ active_campaign: campaignName })
        .in('id', leadIds);
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };

  } catch (error: any) {
    console.error("❌ Error en save-approved-campaign:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};