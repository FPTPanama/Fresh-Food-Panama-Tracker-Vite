import type { Handler } from "@netlify/functions";
import { sbAdmin, getUserAndProfile, json, text, isPrivilegedRole } from "./_util";

export const handler: Handler = async (event) => {
  try {
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile || !isPrivilegedRole(profile.role)) {
      return text(403, "No autorizado para ver actividad de staff");
    }

    // 1. Obtener Actividad Reciente (Hitos + Modo de Embarque)
    // Traemos los últimos 15 hitos con el código y modo del embarque relacionado
    const { data: activities, error: actErr } = await sbAdmin
      .from("milestones")
      .select(`
        id, at, status, actor_email,
        shipments (
          code,
          product_mode
        )
      `)
      .order("at", { ascending: false })
      .limit(15);

    if (actErr) throw actErr;

    // 2. Obtener Staff Conectado
    const { data: staffProfiles, error: staffErr } = await sbAdmin
      .from("profiles")
      .select("user_id, role")
      .in("role", ["admin", "superadmin"]);

    if (staffErr) throw staffErr;

    // Cruzamos con la tabla de Auth (Capa Administrativa)
    const { data: userData, error: authErr } = await sbAdmin.auth.admin.listUsers();
    
    if (authErr || !userData) {
      throw new Error(authErr?.message || "No se pudo recuperar la lista de usuarios de Auth");
    }

    // Extraemos la lista de usuarios con seguridad
    const allUsers = userData.users || [];

    const onlineStaff = allUsers
      .filter(u => staffProfiles?.some(p => p.user_id === u.id))
      .map(u => {
        const p = staffProfiles?.find(profile => profile.user_id === u.id);
        return {
          id: u.id,
          email: u.email,
          last_sign_in_at: (u as any).last_sign_in_at || u.last_sign_in_at, // Cast por si la versión del SDK es antigua
          role: p?.role || "staff"
        };
      });

    return json(200, { activities, onlineStaff });
  } catch (e: any) {
    return text(500, e.message);
  }
};