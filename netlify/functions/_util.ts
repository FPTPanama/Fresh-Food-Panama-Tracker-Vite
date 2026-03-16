import { createClient } from "@supabase/supabase-js";
import type { HandlerEvent } from "@netlify/functions";

// Sin validaciones extra, directo a las variables
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const sbAdmin = createClient(supabaseUrl, supabaseServiceKey);

export const commonHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "*",
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
  if (qs?.token) return String(qs.token).trim();
  return null;
}

export function normRole(role: any) {
  return String(role ?? "").trim().toLowerCase();
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
      profile: profile ? { ...profile, role: normRole(profile.role) } : null 
    };
  } catch (err) {
    console.error("Error in getUserAndProfile:", err);
    return { token, user: null, profile: null };
  }
}

export function isPrivilegedRole(role: any) {
  const r = normRole(role);
  return r === "admin" || r === "superadmin";
}