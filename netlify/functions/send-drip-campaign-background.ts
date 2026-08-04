import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// Inicialización de clientes
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!, 
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY);

// Utilidades para el goteo humano
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

export const handler = async () => {
  console.log("🕒 Iniciando despacho de la cola de envíos (Email Queue)...");

  try {
    const now = new Date().toISOString();

    // 1. Buscamos correos pendientes cuya fecha de envío ya llegó o pasó
    const { data: queue, error } = await supabase
      .from('email_queue')
      .select(`
        id,
        subject,
        html_body,
        step,
        client_id,
        clients (
          contact_email,
          name
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .limit(50); 

    if (error) throw error;

    if (!queue || queue.length === 0) {
      console.log("✅ No hay correos programados para este momento.");
      return;
    }

    console.log(`🎯 Encontrados ${queue.length} correos listos para salir.`);

    for (const item of queue) {
      // 🚀 FIX TS2339: Manejamos el join de Supabase sin importar si lo devuelve como array o como objeto
      const clientData: any = Array.isArray(item.clients) ? item.clients[0] : item.clients;
      
      const recipientEmail = clientData?.contact_email;
      const clientName = clientData?.name || "Cliente";

      if (!recipientEmail) {
        console.warn(`⚠️ Saltando ID ${item.id}: El cliente no tiene correo.`);
        await supabase.from('email_queue').update({ status: 'failed' }).eq('id', item.id);
        continue;
      }

      try {
        // 2. Ejecución del envío vía Resend
        const { error: resendError } = await resend.emails.send({
          from: 'Freddy García - Fresh Food Panama <ventas@freshfoodpanama.com>',
          to: recipientEmail,
          subject: item.subject,
          html: item.html_body,
          replyTo: 'ventas@freshfoodpanama.com', // 🚀 FIX: Corregido a replyTo
          tags: [
            { name: 'step', value: item.step.toString() },
            { name: 'campaign_unit', value: 'drip_automated' }
          ]
        });

        if (resendError) throw resendError;

        // 3. Marcamos como enviado con éxito
        await supabase
          .from('email_queue')
          .update({ status: 'sent' })
          .eq('id', item.id);

        console.log(`✅ Correo (Paso ${item.step}) enviado exitosamente a: ${clientName}`);

        // 4. Goteo Anti-SPAM: Pausa aleatoria entre 5 y 10 segundos
        await delay(randomDelay(5000, 10000));

      } catch (err: any) {
        console.error(`❌ Error enviando a ${recipientEmail}:`, err.message);
        await supabase
          .from('email_queue')
          .update({ status: 'failed' })
          .eq('id', item.id);
      }
    }

    console.log("🎉 Despacho de cola finalizado con éxito.");

  } catch (err: any) {
    console.error("❌ Error crítico en el Músculo de envíos:", err.message);
  }
};