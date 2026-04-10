const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

exports.handler = async (event) => {
  // ============================================================================
  // 🧪 MODO LABORATORIO (PRUEBA DIRECTA SIN BASE DE DATOS)
  // ============================================================================
  // Se activa si entras a: http://localhost:8888/.netlify/functions/trackFlights?test=CM123
  if (event.queryStringParameters && event.queryStringParameters.test) {
    const testFlight = event.queryStringParameters.test.toUpperCase();
    console.log(`🧪 [TEST MODE] Consultando vuelo ${testFlight} directamente...`);
    
    try {
      const res = await axios.get(`https://api.aviationstack.com/v1/flights`, {
        params: {
          access_key: process.env.AVIATIONSTACK_KEY,
          flight_iata: testFlight,
          limit: 1
        }
      });

      const flightData = res.data.data[0];
      
      if (!flightData) {
        return { 
          statusCode: 404, 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: `El radar no encontró el vuelo ${testFlight} en vivo. Asegúrate de que esté volando ahora mismo.` }) 
        };
      }

      // Devolvemos la info tal cual la leería tu código en producción
      return { 
        statusCode: 200, 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje: "✅ CONEXIÓN EXITOSA CON EL RADAR",
          vuelo: testFlight,
          estatus_crudo_api: flightData.flight_status,
          estado_traducido_app: flightData.flight_status === 'active' ? 'IN_TRANSIT' : (flightData.flight_status === 'landed' ? 'AT_DESTINATION' : 'OTRO'),
          salida: flightData.departure.actual || flightData.departure.estimated,
          llegada: flightData.arrival.actual || flightData.arrival.estimated
        }, null, 2)
      };

    } catch (err) {
      console.error("❌ Error en Modo Test:", err.message);
      return { statusCode: 500, body: JSON.stringify({ error: "Fallo al conectar con Aviationstack", detalle: err.message }) };
    }
  }


  // ============================================================================
  // 🚀 MODO PRODUCCIÓN (EL CRONJOB NORMAL)
  // ============================================================================
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // 1. Buscamos embarques activos
  const { data: activeShipments } = await supabase
    .from('shipments')
    .select('id, flight_number, code, status')
    .in('status', ['AT_ORIGIN', 'IN_TRANSIT'])
    .or('flight_status.neq.landed,flight_status.is.null');

  if (!activeShipments || activeShipments.length === 0) {
    return { statusCode: 200, body: "No hay embarques activos para rastrear." };
  }

  for (const ship of activeShipments) {
    if (!ship.flight_number) continue;

    try {
      console.log(`✈️ Consultando radar para ${ship.code} (Vuelo: ${ship.flight_number})...`);
      
      const res = await axios.get(`https://api.aviationstack.com/v1/flights`, {
        params: { access_key: process.env.AVIATIONSTACK_KEY, flight_iata: ship.flight_number, limit: 1 }
      });

      const flightData = res.data.data[0];
      if (!flightData) continue;

      const status = flightData.flight_status; 
      // 3. Mapeo de hito automático
      let newStatus = ship.status;
      if (status === 'active') newStatus = 'IN_TRANSIT';
      if (status === 'landed') newStatus = 'AT_DESTINATION';

      // 4. Actualizamos el embarque
      await supabase.from('shipments').update({
        flight_status: status,
        flight_departure_time: flightData.departure.actual || flightData.departure.estimated,
        flight_arrival_time: flightData.arrival.actual || flightData.arrival.estimated,
        status: newStatus,
        last_api_sync: new Date().toISOString()
      }).eq('id', ship.id);

      // 🚨 LA PIEZA FALTANTE: Si el estatus cambió, el "Bot" anota en la bitácora
      if (newStatus !== ship.status) {
        console.log(`📝 Escribiendo hito en el timeline para ${ship.code}: ${newStatus}`);
        
        await supabase.from('milestones').insert({
          shipment_id: ship.id,
          type: newStatus,
          note: newStatus === 'IN_TRANSIT' 
            ? `Despegue detectado (Vuelo ${ship.flight_number})` 
            : `Aterrizaje confirmado (Vuelo ${ship.flight_number})`,
          actor_email: 'radar@freshconnect.system', // El autor será el sistema
          at: new Date().toISOString()
        });
      }

    } catch (err) {
      console.error(`Error tracking ${ship.code}:`, err.message);
    }
  }
  
  return { statusCode: 200, body: "Sync complete" };
};