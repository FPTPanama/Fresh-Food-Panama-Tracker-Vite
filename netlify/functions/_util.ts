// netlify/functions/_util.ts
import { createClient } from "@supabase/supabase-js";
import type { HandlerEvent } from "@netlify/functions";

// 1. Inicialización de Supabase
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const sbAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { 
    persistSession: false, 
    autoRefreshToken: false 
  },
});

// 2. Encabezados Globales (Soluciona el error de CORS y Cache-Control)
export const commonHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, cache-control",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

// 3. Funciones de Respuesta (Lo que pedía el error: json y text)
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

// 4. Lógica de Sesión (Lo que pedía el error: getUserAndProfile)
export function getBearerToken(event: HandlerEvent) {
  const h = event.headers.authorization || event.headers.Authorization;
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(String(h));
  return m?.[1] ?? null;
}

export async function getUserAndProfile(event: HandlerEvent) {
  const token = getBearerToken(event);
  if (!token) return { token: null, user: null, profile: null };

  try {
    const { data: authData, error: authError } = await sbAdmin.auth.getUser(token);
    if (authError || !authData?.user) return { token, user: null, profile: null };

    const { data: profile, error: pErr } = await sbAdmin
      .from("profiles")
      .select("user_id, role, client_id")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (pErr) throw pErr;

    return { 
      token, 
      user: authData.user, 
      profile: profile ? { ...profile, role: String(profile.role).toLowerCase() } : null 
    };
  } catch (err) {
    console.error("Error en getUserAndProfile:", err);
    return { token, user: null, profile: null };
  }
}

export function isPrivilegedRole(role: any) {
  const r = String(role || "").toLowerCase();
  return r === "admin" || r === "superadmin";
}