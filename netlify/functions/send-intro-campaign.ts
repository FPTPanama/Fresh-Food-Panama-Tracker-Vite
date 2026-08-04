import type { Handler } from "@netlify/functions";
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const resend = new Resend(process.env.RESEND_API_KEY);

// Función para simular comportamiento humano (evitar SPAM corporativo)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

export const handler: Handler = async (event) => {
  console.log("🚀 MÚSCULO INICIADO: Revisando la cola de correos (email_queue)...");

  try {
    const now = new Date().toISOString();

    // 1. Extraer correos de la cola que están 'pending' y cuya fecha de envío ya llegó o pasó
    const { data: queue, error: queueError } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .limit(30); // Procesamos de 30 en 30 máximo por ronda para proteger el dominio

    if (queueError) throw queueError;

    if (!queue || queue.length === 0) {
      console.log("✅ La cola está vacía o no hay correos programados para hoy.");
      return { statusCode: 200, body: "Queue empty" };
    }

    console.log(`🎯 Encontrados ${queue.length} correos listos para envío. Iniciando goteo...`);

    let sentCount = 0;

    // 2. Bucle de envío con Goteo Asimétrico
    for (const emailTask of queue) {
      // Necesitamos buscar el correo real del cliente (Puede ser un Lead o un Cliente activo)
      // Buscamos primero en prospectos
      let contactEmail = null;
      let targetTable = 'leads_prospecting';

      let { data: target } = await supabase.from('leads_prospecting').select('contact_email, id').eq('id', emailTask.client_id).single();
      
      if (target && target.contact_email) {
        contactEmail = target.contact_email;
      } else {
        // Si no está en leads, buscamos en clientes
        targetTable = 'clients';
        const { data: clientTarget } = await supabase.from('clients').select('contact_email, id').eq('id', emailTask.client_id).single();
        if (clientTarget) contactEmail = clientTarget.contact_email;
      }

      // Si definitivamente no hay correo, marcamos la tarea como fallida y saltamos
      if (!contactEmail) {
        await supabase.from('email_queue').update({ status: 'failed_no_email' }).eq('id', emailTask.id);
        console.error(`⚠️ Sin email para client_id: ${emailTask.client_id}`);
        continue;
      }

      try {
        // 3. ENVIAR VÍA RESEND
        await resend.emails.send({
          from: 'Freddy García - Fresh Food Panama <ventas@freshfoodpanama.com>', // Usa tu dominio verificado
          to: contactEmail,
          subject: emailTask.subject,
          html: emailTask.html_body,
          replyTo: 'ventas@freshfoodpanama.com',
          tags: [ { name: 'campaign', value: 'auto_drip' } ]
        });

        console.log(`✅ Enviado Paso ${emailTask.step} a: ${contactEmail}`);
        sentCount++;

        // 4. ACTUALIZAR BASE DE DATOS
        // Marcamos la tarea en la cola como 'sent'
        await supabase.from('email_queue')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', emailTask.id);

        // Actualizamos el Dashboard para que el globo de "Enviados" suba
        await supabase.from(targetTable)
          .update({ sent_at: new Date().toISOString() })
          .eq('id', emailTask.client_id);

        // 5. PAUSA HUMANA (Entre 4 y 9 segundos por correo)
        const waitTime = randomDelay(4000, 9000);
        await delay(waitTime);

      } catch (emailError: any) {
        console.error(`❌ Error enviando a ${contactEmail}:`, emailError.message);
        await supabase.from('email_queue')
          .update({ status: 'failed_resend_error' })
          .eq('id', emailTask.id);
      }
    }

    console.log(`🎉 Ronda finalizada. ${sentCount} correos despachados exitosamente.`);
    return { statusCode: 200, body: `Sent ${sentCount}` };

  } catch (err: any) {
    console.error("❌ Error general en El Músculo:", err.message);
    return { statusCode: 500, body: err.message };
  }
};