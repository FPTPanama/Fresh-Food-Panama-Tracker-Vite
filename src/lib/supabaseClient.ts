import { createClient } from '@supabase/supabase-js';

// En Vite se usa import.meta.env y el prefijo VITE_
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Verificación estricta en desarrollo
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('CRÍTICO: Variables de Supabase no detectadas. Asegúrate de que empiecen con VITE_ en tu archivo .env');
}

export const supabase = createClient(
  supabaseUrl, 
  supabaseAnonKey, 
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'implicit',
      storageKey: 'ffp-auth-v3' // Cambiamos a v3 para limpiar caché
    }
  }
);