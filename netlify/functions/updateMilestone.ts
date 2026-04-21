import type { Handler } from "@netlify/functions";
import { sbAdmin, getUserAndProfile, json, text, optionsResponse } from "./_util";

export const handler: Handler = async (event) => {
  // Manejo de pre-vuelo para CORS
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  if (event.httpMethod !== "POST") return text(405, "Method Not Allowed");

  try {
    // 1. Verificación de Seguridad
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile) return text(401, "Unauthorized");

    // 2. Parseo del Payload
    const body = JSON.parse(event.body || "{}");
    const { 
      shipmentId, 
      type, 
      note, 
      flight_number, 
      awb, 
      calibre, // Viene del frontend
      caliber, // Por si acaso
      color, 
      brix_grade 
    } = body;

    if (!shipmentId || !type) return text(400, "Faltan datos obligatorios (shipmentId o type)");

    // 3. Actualizar la tabla principal de Embarques (Shipments)
    const shipmentPayload = {
      status: type,
      flight_number: flight_number || null,
      awb: awb || null,
      caliber: caliber || calibre || null,
      color: color || null,
      brix_grade: brix_grade || null
    };

    const { error: shipErr } = await sbAdmin
      .from("shipments")
      .update(shipmentPayload)
      .eq("id", shipmentId);

    if (shipErr) {
      console.error("Error BD Shipments:", shipErr.message);
      throw new Error(`Fallo al actualizar embarque: ${shipErr.message}`);
    }

    // 4. Insertar o Actualizar el Hito (Idempotencia Inteligente)
    const { error: mileErr } = await sbAdmin
      .from("milestones")
      .upsert(
        {
          shipment_id: shipmentId,
          type: type,
          note: note || null,
          actor_email: user.email,
          created_by: user.id // Relación directa con el UUID del admin
          
          // 💡 AL NO ENVIAR EL CAMPO FECHA: 
          // Postgres generará un timestamp automático si es nuevo, 
          // o mantendrá LA FECHA ORIGINAL si es una actualización de nota.
        },
        { 
          // Instrucción estricta para resolver el error "duplicate key value"
          onConflict: "milestones_shipment_id_type_key" 
        }
      );

    if (mileErr) {
      console.error("Error BD Milestones:", mileErr.message);
      throw new Error(`Fallo al registrar el hito: ${mileErr.message}`);
    }

    // 5. Respuesta Exitosa
    return json(200, { success: true, message: "Hito actualizado correctamente" });

  } catch (e: any) {
    console.error("Error crítico en updateMilestone:", e.message);
    // Devolvemos el error exacto al frontend para que no sea un 500 "ciego"
    return text(500, e.message || "Internal Server Error");
  }
};