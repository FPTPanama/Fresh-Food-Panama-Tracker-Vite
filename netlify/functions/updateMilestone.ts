import type { Handler } from "@netlify/functions";
import { sbAdmin, getUserAndProfile, json, text, isPrivilegedRole, optionsResponse } from "./_util";

const ALLOWED = new Set(["PACKED", "DOCS_READY", "AT_ORIGIN", "IN_TRANSIT", "AT_DESTINATION", "CREATED"]);

function clean(v: any) {
  return String(v ?? "").trim();
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  if (event.httpMethod !== "POST") return text(405, "Method not allowed");

  try {
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile) return text(401, "Unauthorized");
    if (!isPrivilegedRole(profile.role || "")) return text(403, "Forbidden");

    let body: any = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return text(400, "Body inválido (JSON requerido)");
    }

    // --- FLEXIBILIDAD DE NOMBRES ---
    const shipmentId = clean(body.shipmentId || body.shipment_id || body.id);
    const typeRaw = clean(body.type || body.milestoneType || body.milestone_type || body.status).toUpperCase();

    if (!shipmentId) return text(400, "Falta shipmentId");
    if (!typeRaw) return text(400, "Falta type/status");
    if (!ALLOWED.has(typeRaw)) return text(400, `type inválido: ${typeRaw}`);

    const note = body.note == null ? null : clean(body.note) || null;
    const flight_number = body.flight_number == null ? null : clean(body.flight_number) || null;
    const awb = body.awb == null ? null : clean(body.awb) || null;
    const color = body.color == null ? null : clean(body.color) || null;
    
    // 🚨 ARREGLO DE SPANGLISH: Aceptamos ambas del frontend, pero guardaremos estrictamente como 'caliber'
    const calibreRaw = body.calibre ?? body.caliber;
    const caliberFinal = calibreRaw == null ? null : clean(calibreRaw) || null;

    if (typeRaw === "IN_TRANSIT" && !flight_number && !body.flight_number) {
        console.warn(`[WARN] Embarque ${shipmentId} pasado a IN_TRANSIT sin número de vuelo.`);
    }

    // 1) Actualiza shipments
    const shipUpdate: any = { status: typeRaw };
    
    // Asignaciones quirúrgicas a los nombres de columna confirmados
    if (flight_number !== null) shipUpdate.flight_number = flight_number;
    if (awb !== null) shipUpdate.awb = awb;
    if (color !== null) shipUpdate.color = color;
    
    // 👇 ESTA ES LA LÍNEA CORREGIDA PARA SUPABASE 👇
    if (caliberFinal !== null) shipUpdate.caliber = caliberFinal; 

    console.log(`Intentando actualizar shipment ${shipmentId} con:`, shipUpdate);

    const { error: upErr } = await sbAdmin.from("shipments").update(shipUpdate).eq("id", shipmentId);
    if (upErr) {
        console.error("❌ Error de Supabase al actualizar shipment:", upErr.message);
        return text(500, `Error BD actualizando embarque: ${upErr.message}`);
    }

    // 2) Registro de Milestone
    const { error: msErr } = await sbAdmin.from("milestones").insert({
        shipment_id: shipmentId,
        type: typeRaw,
        note: note || `Cambio de estado a ${typeRaw}`,
        actor_email: user.email,
        at: new Date().toISOString(),
    });

    if (msErr) {
        console.warn(`[WARN] Milestone no insertado (posible duplicado): ${msErr.message}`);
    }

    console.log(`✅ Embarque ${shipmentId} actualizado a ${typeRaw} exitosamente.`);
    return json(200, { ok: true, shipmentId, type: typeRaw });
    
  } catch (e: any) {
    console.error("❌ Error crítico no controlado en updateMilestone:", e.message);
    return text(500, e?.message || "Server error");
  }
};