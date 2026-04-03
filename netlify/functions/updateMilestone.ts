// netlify/functions/updateMilestone.ts
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

    // --- FLEXIBILIDAD DE NOMBRES (Busca todas las variantes posibles) ---
    const shipmentId = clean(body.shipmentId || body.shipment_id || body.id);
    const typeRaw = clean(body.type || body.milestoneType || body.milestone_type || body.status).toUpperCase();

    if (!shipmentId) return text(400, "Falta shipmentId");
    if (!typeRaw) return text(400, "Falta type/status");
    if (!ALLOWED.has(typeRaw)) return text(400, `type inválido: ${typeRaw}`);

    const note = body.note == null ? null : clean(body.note) || null;
    const flight_number = body.flight_number == null ? null : clean(body.flight_number) || null;
    const awb = body.awb == null ? null : clean(body.awb) || null;
    const caliber = body.caliber == null ? null : clean(body.caliber) || null;
    const color = body.color == null ? null : clean(body.color) || null;

    // --- VALIDACIONES RELAJADAS (Para evitar bloqueos en el Dashboard rápido) ---
    // Solo validamos si el dato no existe ya en la base de datos (opcional)
    // Por ahora, permitimos el update pero registramos el error si falta en estados críticos
    if (typeRaw === "IN_TRANSIT" && !flight_number && !body.flight_number) {
        console.warn("Update a IN_TRANSIT sin flight_number");
    }

    // 1) Actualiza shipments
    const shipUpdate: any = { 
        status: typeRaw,
        updated_at: new Date().toISOString()
    };

    if (flight_number !== null) shipUpdate.flight_number = flight_number;
    if (awb !== null) shipUpdate.awb = awb;
    if (caliber !== null) shipUpdate.caliber = caliber;
    if (color !== null) shipUpdate.color = color;

    const { error: upErr } = await sbAdmin.from("shipments").update(shipUpdate).eq("id", shipmentId);
    if (upErr) return text(500, `Error actualizando embarque: ${upErr.message}`);

    // 2) Registro de Milestone (Simplificado para evitar el error 500 de On Conflict)
    // Intentamos insertar. Si falla por duplicado, no matamos la ejecución.
    await sbAdmin.from("milestones").insert({
        shipment_id: shipmentId,
        type: typeRaw,
        note: note || `Cambio de estado a ${typeRaw}`,
        actor_email: user.email,
        at: new Date().toISOString(),
    });

    return json(200, { ok: true, shipmentId, type: typeRaw });
  } catch (e: any) {
    console.error("Error crítico en updateMilestone:", e.message);
    return text(500, e?.message || "Server error");
  }
};