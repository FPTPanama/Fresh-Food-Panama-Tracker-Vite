import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };
  
  const { leadId } = JSON.parse(event.body);

  try {
    // 1. Extraemos el lead
    const { data: lead, error: fError } = await supabase.from('leads_prospecting').select('*').eq('id', leadId).single();
    if (fError || !lead) throw new Error("Lead no encontrado");

    // 2. Lo movemos a la tabla 'clients' (Mapeo 1:1 según tu esquema)
    const { data: client, error: iError } = await supabase.from('clients').insert([{
      name: lead.company_name,
      contact_name: lead.contact_name,
      contact_email: lead.contact_email,
      phone: lead.contact_phone,
      website: lead.website,
      country: lead.country,
      city: lead.city,
      status: 'active',
      internal_notes: `PROSPECTO IA: ${lead.ai_analysis} | Score: ${lead.lead_score}/5`,
      lead_source: 'ai_mining'
    }]).select().single();

    if (iError) throw iError;

    // 3. Marcamos el lead como convertido para que no estorbe en la lista
    await supabase.from('leads_prospecting').update({ status: 'converted' }).eq('id', leadId);

    return { statusCode: 200, body: JSON.stringify({ message: "Conversión exitosa", clientId: client.id }) };
  } catch (err: any) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};