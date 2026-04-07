import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const sendTwilioMessage = async (to: string, message: string) => {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  let fromEnv = process.env.TWILIO_WA_FROM?.trim() || "+14155238886";

  const finalFrom = fromEnv.startsWith('whatsapp:') ? fromEnv : `whatsapp:${fromEnv}`;
  const cleanTo = to.replace(/\s+/g, '');
  const finalTo = cleanTo.startsWith('whatsapp:') ? cleanTo : `whatsapp:${cleanTo.startsWith('+') ? cleanTo : '+' + cleanTo}`;

  const params = new URLSearchParams();
  params.append("To", finalTo);
  params.append("From", finalFrom);
  params.append("Body", message);

  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });
};

const sendEmail = async (to: string, subject: string, text: string) => {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.warn("⚠️ No hay RESEND_API_KEY configurada. Omitiendo email a:", to);
    return;
  }

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "Notificaciones Fresh Food <alertas@freshfoodpanama.com>",
      to: to,
      subject: subject,
      text: text
    })
  });
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const payload = JSON.parse(event.body || "{}");
    const { table, record, old_record } = payload;

    if (!table || !record) return { statusCode: 400, body: "Bad Request: Missing payload data" };

    const { data: rules } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('trigger_table', table)
      .eq('is_active', true);

    if (!rules || rules.length === 0) {
      return { statusCode: 200, body: "No active rules for this table." };
    }

    // Ya no fallará porque agregamos la columna 'email' por SQL
    const [{ data: internal }, { data: external }] = await Promise.all([
      supabase.from('profiles').select('full_name, phone, email'),
      supabase.from('external_partners').select('full_name, phone, email')
    ]);
    const directory = [...(internal || []), ...(external || [])];

    for (const rule of rules) {
      const col = rule.trigger_column; 
      const val = rule.trigger_value;  

      const isMatchNow = record[col]?.toString().toLowerCase() === val.toLowerCase();
      const wasDifferentBefore = old_record ? old_record[col]?.toString().toLowerCase() !== val.toLowerCase() : true;

      if (isMatchNow && wasDifferentBefore) {
        console.log(`🚀 [DISPARANDO REGLA]: ${rule.title}`);

        for (const action of rule.actions) {
          const targetName = action.role.split(' (')[0].trim();
          const person = directory.find(p => p.full_name?.toLowerCase().includes(targetName.toLowerCase()));

          if (!person) {
            console.warn(`⚠️ No se encontró contacto para: ${targetName}`);
            continue;
          }

          // Traductor Inteligente de Tablas
          const recordTypeMap: Record<string, string> = {
            'quotes': 'Cotización',
            'shipments': 'Embarque',
            'milestones': 'Hito Operativo',
            'leads_prospecting': 'Prospecto (Lead)',
            'clients': 'Cliente'
          };
          const recordType = recordTypeMap[table] || 'Registro';

          // Extractor Inteligente de IDs
          let referenceNumber = record.id.slice(0, 8);
          if (table === 'quotes') referenceNumber = record.quote_no || record.quote_number || referenceNumber;
          if (table === 'shipments') referenceNumber = record.code || record.awb || referenceNumber;
          if (table === 'leads_prospecting') referenceNumber = record.company_name || record.contact_name || referenceNumber;
          if (table === 'clients') referenceNumber = record.name || record.legal_name || referenceNumber;

          const messageText = `⚡ *Fresh Food Automations*\n\n` +
                              `Hola ${person.full_name.split(' ')[0]},\n` +
                              `Evento: *${rule.title}*\n\n` +
                              `📌 *${recordType}:* ${referenceNumber}\n` +
                              `📝 *Instrucción:*\n${action.action}\n\n` +
                              `_Generado automáticamente por ChatOps_`;

          if (action.channels.whatsapp && person.phone) {
            console.log(`-> Enviando WA a ${person.full_name} (${person.phone})`);
            await sendTwilioMessage(person.phone, messageText);
          }

          if (action.channels.email && person.email) {
            console.log(`-> Enviando Email a ${person.full_name} (${person.email})`);
            const subject = `[Fresh Food Alert] ${rule.title}`;
            await sendEmail(person.email, subject, messageText);
          }
        }
      }
    }

    return { statusCode: 200, body: "Webhook procesado con éxito" };

  } catch (error: any) {
    console.error("❌ Error procesando webhook:", error);
    return { statusCode: 500, body: `Error: ${error.message}` };
  }
};