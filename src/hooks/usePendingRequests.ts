import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient'; // <--- Verifica que esta ruta sea correcta

export function usePendingRequests() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // 1. Función para obtener el conteo inicial
    const fetchCount = async () => {
      const { count: total, error } = await supabase
        .from('quotes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Solicitud');
      
      if (!error) {
        setCount(total || 0);
      }
    };

    fetchCount();

    // 2. Suscripción Realtime para actualizar el contador automáticamente
    // Esto hace que si un cliente envía una solicitud, el número suba sin refrescar
    const channel = supabase
      .channel('quotes-pending-counter')
      .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'quotes', 
            filter: 'status=eq.Solicitud' 
          }, 
          () => {
            fetchCount();
          })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return count;
}