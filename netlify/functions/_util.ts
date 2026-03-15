import { createClient } from "@supabase/supabase-js";
import type { HandlerEvent } from "@netlify/functions";

// 1. Cargamos y limpiamos las variables inmediatamente
const rawUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseUrl = rawUrl.trim();
const supabaseServiceKey = rawKey.trim();

// 2. Validación crítica: Si fallan, la función se detiene con un error claro
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Faltan variables de entorno de Supabase en las funciones o están vacías.");
}

// 3. Inicialización del cliente (ahora TypeScript sabe que no están vacías) 🚀
export const sbAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { 
    persistSession: false, 
    autoRefreshToken: false 
  },
});

export const commonHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Cache-Control, X-Requested-With, Accept, cache-control",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export const optionsResponse = () => ({
  statusCode: 200,
  headers: commonHeaders,
  body: "",
});

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

export function getBearerToken(event: HandlerEvent) {
  const h = event.headers?.authorization || event.headers?.Authorization;
  if (h) {
    const m = /^Bearer\s+(.+)$/i.exec(String(h));
    if (m?.[1]) return m[1];
  }
  const qs = (event as any).queryStringParameters;
  if (qs?.token) return String(qs.token).trim() || null;
  try {
    const body = (event as any).body;
    if (body) {
      const parsed = typeof body === "string" ? JSON.parse(body) : body;
      if (parsed?.token) return String(parsed.token).trim() || null;
    }
  } catch (_) {}
  return null;
}

export function normRole(role: any) {
  return String(role ?? "").trim().toLowerCase();
}

export async function getUserAndProfile(event: HandlerEvent) {
  const token = getBearerToken(event);
  if (!token) return { token: null, user: null, profile: null };

  try {
    // Usamos el cliente administrativo para verificar el token del usuario
    const { data: authData, error: authError } = await sbAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      console.error("Auth error:", authError);
      return { token, user: null, profile: null };
    }

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