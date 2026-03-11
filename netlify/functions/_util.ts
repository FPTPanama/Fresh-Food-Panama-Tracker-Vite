import { createClient } from "@supabase/supabase-js";
import type { HandlerEvent } from "@netlify/functions";

// 1. Inicialización Singleton con Service Role (Uso interno de funciones)
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Faltan variables de entorno de Supabase en las funciones.");
}

export const sbAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { 
    persistSession: false, 
    autoRefreshToken: false 
  },
});

// 2. Encabezados Globales (Soluciona CORS desde localhost y otros orígenes)
export const commonHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Cache-Control, X-Requested-With, Accept",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// 3. Funciones de Respuesta Estándar
export function json(statusCode: number, body: any) {
  return {
    statusCode,
    headers: commonHeaders,
    body: JSON.stringify(body),
  };
}

export function text(statusCode: number, message: string) {
  return {
    statusCode,
    headers: { ...commonHeaders, "Content-Type": "text/plain; charset=utf-8" },
    body: message,
  };
}

// 4. Lógica de Autenticación y Perfil
export function getBearerToken(event: HandlerEvent) {
  const h = event.headers.authorization || event.headers.Authorization;
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(String(h));
  return m?.[1] ?? null;
}

export function normRole(role: any) {
  return String(role ?? "").trim().toLowerCase();
}

export async function getUserAndProfile(event: HandlerEvent) {
  const token = getBearerToken(event);
  if (!token) return { token: null, user: null, profile: null };

  try {
    // Verificamos el token con Supabase Auth
    const { data: authData, error: authError } = await sbAdmin.auth.getUser(token);
    if (authError || !authData?.user) return { token, user: null, profile: null };

    // Buscamos el perfil asociado en la tabla pública de perfiles
    const { data: profile, error: pErr } = await sbAdmin
      .from("profiles")
      .select("user_id, role, client_id")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (pErr) throw pErr;

    return { 
      token, 
      user: authData.user, 
      profile: profile ? { ...profile, role: normRole(profile.role) } : null 
    };
  } catch (err) {
    console.error("Error en getUserAndProfile:", err);
    return { token, user: null, profile: null };
  }
}

export function isPrivilegedRole(role: any) {
  const r = normRole(role);
  return r === "admin" || r === "superadmin";
}