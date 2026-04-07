import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// --- FUNCIONES DE ENVÍO ---
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

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });
  return res.ok;
};

const sendEmail = async (to: string, subject: string, text: string) => {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return false;

  const res = await fetch("https://api.resend.com/emails", {
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
  return res.ok;
};

// --- HANDLER PRINCIPAL ---
export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const payload = JSON.parse(event.body || "{}");
    const { table, record, old_record } = payload;

    if (!table || !record) return { statusCode: 400, body: "Bad Request" };

    const { data: rules } = await supabase.from('automation_rules').select('*').eq('trigger_table', table).eq('is_active', true);
    if (!rules || rules.length === 0) return { statusCode: 200, body: "No rules" };

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
        for (const action of rule.actions) {
          const targetName = action.role.split(' (')[0].trim();
          const person = directory.find(p => p.full_name?.toLowerCase().includes(targetName.toLowerCase()));

          if (!person) continue;

          // Traductor e ID Humano
          const recordTypeMap: Record<string, string> = { 'quotes': 'Cotización', 'shipments': 'Embarque', 'milestones': 'Hito', 'leads_prospecting': 'Lead', 'clients': 'Cliente' };
          const recordType = recordTypeMap[table] || 'Registro';
          let refNum = record.id.slice(0, 8);
          if (table === 'quotes') refNum = record.quote_no || record.quote_number || refNum;
          if (table === 'shipments') refNum = record.code || record.awb || refNum;

          const messageText = `⚡ *Fresh Food Automations*\n\nHola ${person.full_name.split(' ')[0]},\nEvento: *${rule.title}*\n\n📌 *${recordType}:* ${refNum}\n📝 *Instrucción:*\n${action.action}`;

          // --- ENVÍO Y REGISTRO EN LOGS ---
          if (action.channels.whatsapp && person.phone) {
            const success = await sendTwilioMessage(person.phone, messageText);
            await supabase.from('automation_logs').insert({
              rule_title: rule.title,
              recipient_name: person.full_name,
              channel: 'WhatsApp',
              message_text: messageText,
              record_type: recordType,
              reference_number: refNum,
              status: success ? 'sent' : 'failed'
            });
          }

          if (action.channels.email && person.email) {
            const success = await sendEmail(person.email, `[Fresh Food] ${rule.title}`, messageText);
            await supabase.from('automation_logs').insert({
              rule_title: rule.title,
              recipient_name: person.full_name,
              channel: 'Email',
              message_text: messageText,
              record_type: recordType,
              reference_number: refNum,
              status: success ? 'sent' : 'failed'
            });
          }
        }
      }
    }
    return { statusCode: 200, body: "OK" };
  } catch (error: any) {
    return { statusCode: 500, body: error.message };
  }
};