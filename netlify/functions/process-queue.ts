import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { schedule } from '@netlify/functions';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const resend = new Resend(process.env.RESEND_API_KEY);

const queueHandler = async () => {
  try {
    // 1. Verificar si el Master Switch está en ON
    const { data: settings } = await supabase.from('global_settings').select('*').eq('id', 1).single();
    if (!settings?.automation_enabled) {
      console.log("Autopilot OFF. No se envían correos.");
      return { statusCode: 200 };
    }

    // 2. Buscar el lead más antiguo en cola ('queued')
    const { data: lead } = await supabase
      .from('leads_prospecting')
      .select('*')
      .eq('pipeline_stage', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (!lead) {
      console.log("Cola de envíos vacía.");
      return { statusCode: 200 };
    }

   // 🔴 VALIDACIÓN CRÍTICA 1: ¿Tiene correo electrónico válido?
    if (!lead.contact_email || lead.contact_email.trim() === '' || !lead.contact_email.includes('@')) {
      console.log(`Lead sin correo válido: ${lead.company_name}. Saltando...`);
      await supabase.from('leads_prospecting').update({ pipeline_stage: 'skipped_no_email' }).eq('id', lead.id);
      return { statusCode: 200, body: "Lead saltado (Sin email)" };
    }

    // 🔴 VALIDACIÓN CRÍTICA 2: ¿Tiene texto redactado? (Filtro anti-atascos)
    if (!lead.email_draft) {
      console.log(`Lead sin borrador redactado: ${lead.company_name}. Saltando...`);
      await supabase.from('leads_prospecting').update({ pipeline_stage: 'error_no_draft' }).eq('id', lead.id);
      return { statusCode: 200, body: "Lead saltado (Sin borrador)" };
    }

    // 3. Extraer Asunto y Cuerpo del borrador
    const lines = lead.email_draft.split('\n');
    const subjectLine = lines.find((l: string) => l.toUpperCase().includes('ASUNTO:'));
    const subject = subjectLine ? subjectLine.replace(/ASUNTO:/i, '').trim() : `Propuesta Comercial - ${lead.company_name}`;
    const body = lead.email_draft.replace(subjectLine || '', '').trim();

    // 4. Enviar vía Resend (MODO PRUEBA)
    const { data, error } = await resend.emails.send({
      from: 'Acme <onboarding@resend.dev>', // ⚠️ DEJA ESTE CORREO EXACTO, es el de pruebas de Resend
      to: ['freddy.garcia@fptworld.com'], // ⚠️ PON TU CORREO AQUÍ (El que usaste para registrarte en Resend)
      subject: subject,
      text: body,
    });

    if (error) {
      console.error("❌ Error devuelto por Resend:", error);
      // Si Resend falla, lo marcamos como error para revisar
      await supabase.from('leads_prospecting').update({ pipeline_stage: 'error_resend' }).eq('id', lead.id);
      throw new Error(error.message);
    }

    // 5. Actualizar estado y guardar el ID de Resend + la fecha de envío
    const { error: updateError } = await supabase.from('leads_prospecting').update({ 
      pipeline_stage: 'contacted',
      last_contact_at: new Date().toISOString(),
      sent_at: new Date().toISOString(),
      resend_id: data?.id // GUARDAMOS EL ID DE SEGUIMIENTO (webhook de aperturas)
    }).eq('id', lead.id);

    // 🛑 SISTEMA DE DEBUG PARA BASE DE DATOS
    if (updateError) {
      console.error(`❌ ERROR GRAVE: El correo se envió, pero Supabase falló al actualizar el lead ${lead.id}. Motivo:`, updateError.message);
      return { statusCode: 500, body: "Error guardando en BD" };
    }

    console.log(`✅ Email enviado con éxito a: ${lead.company_name} (Resend ID: ${data?.id})`);
    return { statusCode: 200 };
  } catch (err: any) {
    console.error("❌ Error en Process Queue:", err.message);
    return { statusCode: 500, body: err.message };
  }
};

// Se ejecuta cada 20 minutos
export const handler = schedule("*/20 * * * *", queueHandler);