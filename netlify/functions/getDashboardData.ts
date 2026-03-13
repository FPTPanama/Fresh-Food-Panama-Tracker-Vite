import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export const handler: Handler = async () => {
  try {
    // 1. Conteo de embarques ACTIVOS (No entregados)
    const { count: shipmentsCount } = await supabase
      .from('shipments')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'Delivered'); // Ajusta 'Delivered' según tu data real

    // 2. Conteo de cotizaciones totales
    const { count: quotesCount } = await supabase
      .from('quotes')
      .select('*', { count: 'exact', head: true });

    // 3. Últimos movimientos (JOIN con shipments para ver el código)
    const { data: recentActivity } = await supabase
      .from('activity_log') // Asumiendo este nombre por lógica de logs
      .select(`*, shipments(code, product_mode)`)
      .order('created_at', { ascending: false })
      .limit(5);

    return {
      statusCode: 200,
      body: JSON.stringify({
        shipmentsCount: shipmentsCount || 0,
        quotesCount: quotesCount || 0,
        recentActivity: recentActivity || [],
        onlineStaffCount: 3 // Valor de ejemplo o consulta a presencia
      }),
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};