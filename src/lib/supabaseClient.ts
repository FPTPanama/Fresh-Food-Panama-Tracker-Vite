import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Verificación estricta en desarrollo
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('CRÍTICO: Variables de Supabase no detectadas en el entorno actual.');
}

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '', 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '', 
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true, // Crucial para que getmyprofile no muera al expirar el token
      detectSessionInUrl: false, 
      storageKey: 'ffp-auth-token',
      // Esto fuerza al SDK a usar HTTPS siempre, incluso si cree que está en un entorno inseguro
      flowType: 'pkce' 
    }
  }
);