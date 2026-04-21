import type { Handler } from "@netlify/functions";
import { sbAdmin, getUserAndProfile, json, text, isPrivilegedRole, optionsResponse } from "./_util";

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  try {
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile) return text(401, "Unauthorized");

    const id = event.queryStringParameters?.id;
    if (!id) return text(400, "Missing id");
    const mode = String(event.queryStringParameters?.mode || "").toLowerCase();

    // 1. Obtener el embarque
    const { data: shipment, error } = await sbAdmin
      .from("shipments")
      .select(`*, client:clients(name)`)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Error BD Shipments:", error.message);
      return text(500, `Shipment Error: ${error.message}`);
    }
    if (!shipment) return text(404, "Not found");

    const privileged = isPrivilegedRole(profile.role || "");
    if (mode === "admin" && !privileged) return text(403, "Forbidden");

    // 🛡️ PARCHE DE SEGURIDAD: Validar que el cliente SÓLO pueda ver sus propios embarques
    if (!privileged && shipment.client_id !== profile.client_id) {
      console.warn(`Alerta de Seguridad: Usuario ${user.email} intentó acceder a un embarque ajeno.`);
      return text(403, "Acceso Denegado: No tienes permisos para ver este embarque.");
    }

    // 2. Obtener hitos (milestones) - ¡Con created_by mantenido!
    const { data: milestones, error: mErr } = await sbAdmin
      .from("milestones")
      .select(`id, type, at, note, actor_email, created_by`)
      .eq("shipment_id", shipment.id)
      .order("at", { ascending: true });

    if (mErr) console.error("Milestones Error:", mErr.message);

    // 3. Obtener archivos (shipment_files)
    const { data: files, error: fErr } = await sbAdmin
      .from("shipment_files")
      .select(`id, kind, doc_type, filename, created_at, bucket, storage_path`)
      .eq("shipment_id", shipment.id)
      .order("created_at", { ascending: false });

    if (fErr) console.error("Files Error:", fErr.message);

    const documents = (files || []).filter((x) => x.kind === "doc");
    const photos = (files || []).filter((x) => x.kind === "photo");

    // Firmar URLs de fotos
    const photosWithUrl = await Promise.all(
      photos.map(async (p) => {
        if (!p.storage_path) return { ...p, url: null };
        const { data } = await sbAdmin.storage
          .from(p.bucket || "shipment-photos")
          .createSignedUrl(p.storage_path, 3600);
        
        return { ...p, url: data?.signedUrl || null };
      })
    );

    return json(200, {
      ...shipment,
      client_name: (shipment.client as any)?.name ?? "Sin Cliente",
      milestones: milestones || [],
      documents,
      photos: photosWithUrl,
    });
  } catch (e: any) {
    console.error("Error General getShipment:", e);
    return text(500, e?.message || "Server error");
  }
};