import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

// Inicializamos Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!, 
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const handler: Handler = async (event) => {
  // Solo aceptamos peticiones POST que vengan de Resend
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const payload = JSON.parse(event.body || "{}");
    const { type, data } = payload;

    // Si no es un evento válido o no trae correo, lo ignoramos educadamente
    if (!type || !data || !data.to || data.to.length === 0) {
      return { statusCode: 200, body: "Evento ignorado" };
    }

    const recipientEmail = data.to[0]; // El correo del cliente que abrió el mensaje
    const now = new Date().toISOString();

    console.log(`📩 Resend Webhook recibido: [${type}] para ${recipientEmail}`);

    // === LÓGICA DE EVENTOS ===

    if (type === 'email.opened' || type === 'email.clicked') {
      // 1. Buscamos en Prospectos y actualizamos
      await supabase.from('leads_prospecting')
        .update({ opened_at: now })
        .eq('contact_email', recipientEmail);

      // 2. Buscamos en Clientes Actuales y actualizamos
      await supabase.from('clients')
        .update({ opened_at: now })
        .eq('contact_email', recipientEmail);
    }

    if (type === 'email.bounced' || type === 'email.complained') {
      // Si el correo rebota (falso) o nos marcan como SPAM (complained), bloqueamos el lead
      await supabase.from('leads_prospecting')
        .update({ pipeline_stage: 'error_bounced' })
        .eq('contact_email', recipientEmail);
        
      await supabase.from('clients')
        .update({ pipeline_stage: 'error_bounced' })
        .eq('contact_email', recipientEmail);
    }

    return { statusCode: 200, body: "Webhook procesado exitosamente" };

  } catch (error: any) {
    console.error("❌ Error procesando webhook de Resend:", error);
    return { statusCode: 500, body: error.message };
  }
};