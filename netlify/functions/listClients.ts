import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  // CAMBIO 1: Safari prefiere minúsculas en los headers de control
  "Access-Control-Allow-Headers": "authorization, content-type, cache-control",
  // CAMBIO 2: Aseguramos que OPTIONS esté en la lista de permitidos
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  // CAMBIO 3: Safari a veces requiere este header para confirmar la validez del preflight
  "Access-Control-Max-Age": "86400", 
};




export const handler: Handler = async (event) => {
  // CAMBIO 4: Para Safari, el status 200 es más confiable que el 204 en local
  if (event.httpMethod === "OPTIONS") {
    return { 
      statusCode: 200, 
      headers: corsHeaders, 
      body: "" 
    };
  }

  if (event.httpMethod !== 'GET') {
    return { 
      statusCode: 405, 
      headers: corsHeaders, 
      body: 'Method Not Allowed' 
    };
  }

  try {
    const { data, error } = await supabase
      .from('clients')
      .select(`
        id, 
        name, 
        legal_name, 
        tax_id, 
        contact_email, 
        phone, 
        country, 
        has_platform_access,
        billing_address,
        created_at
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ items: data || [] }),
    };
  } catch (error: any) {
    // CAMBIO 5: Siempre devolver corsHeaders incluso en errores
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: error.message }),
    };
  }
  
};
