import type { Handler } from "@netlify/functions";
import { sbAdmin, getUserAndProfile, json, text, optionsResponse } from "./_util";

function pad5(n: number) {
  const x = Math.max(0, Math.floor(n));
  return String(x).padStart(5, "0");
}

/**
 * Genera el siguiente correlativo PO-YEAR-XXXXX
 */
async function getNextPONumber(year: number) {
  const prefix = `PO-${year}-`;

  const { data, error } = await sbAdmin
    .from("quotes")
    .select("po_number")
    .ilike("po_number", `${prefix}%`)
    .order("po_number", { ascending: false })
    .limit(1);

  if (error || !data?.[0]?.po_number) {
    return `${prefix}${pad5(1)}`;
  }

  const last = String(data[0].po_number).trim();
  const tail = last.slice(prefix.length);
  const lastN = Number(tail);
  const next = Number.isFinite(lastN) ? lastN + 1 : 1;
  return `${prefix}${pad5(next)}`;
}

/**
 * Genera el correlativo de Embarques SHP-YYYY-NNNN
 */
async function getNextShipmentNumber(year: number) {
  const prefix = `SHP-${year}-`;
  const { data, error } = await sbAdmin
    .from("shipments")
    .select("code")
    .ilike("code", `${prefix}%`)
    .order("code", { ascending: false })
    .limit(1);

  if (error || !data?.[0]?.code) {
    return `${prefix}0001`;
  }

  const last = String(data[0].code).trim();
  const tail = last.slice(prefix.length);
  const lastN = Number(tail);
  const next = Number.isFinite(lastN) ? lastN + 1 : 1;
  
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  if (event.httpMethod !== "POST") return text(405, "Method not allowed");

  try {
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile) return text(401, "Unauthorized");

    const body = JSON.parse(event.body || "{}");
    const { quoteId } = body;

    if (!quoteId) return text(400, "Quote ID is required");

    // 1. Verificar estado y traer TODOS los datos necesarios para el embarque
    const { data: quote, error: fetchErr } = await sbAdmin
      .from("quotes")
      .select(`
        status, quote_number, client_id, product_id, 
        boxes, weight_kg, mode, origin, destination, 
        totals, product_details
      `)
      .eq("id", quoteId)
      .single();

    if (fetchErr || !quote) return text(404, "Quote not found");
    
    // Seguridad: Solo se puede aprobar si está en status 'sent'
    if (quote.status !== 'sent') {
      return json(400, { error: "Solo se pueden aprobar cotizaciones en estado 'Enviada'" });
    }

    // 2. Generar número de PO
    const year = new Date().getFullYear();
    const po_number = await getNextPONumber(year);

    // 3. Actualizar Cotización a 'approved' e inyectar el PO_Number
    const { error: updateErr } = await sbAdmin
      .from("quotes")
      .update({
        status: 'approved',
        po_number: po_number,
        updated_at: new Date().toISOString()
      })
      .eq("id", quoteId);

    if (updateErr) return json(500, { error: updateErr.message });

    // ==========================================
    // 🚨 4. LA AUTOMATIZACIÓN RECUPERADA (EMBARQUES) 🚨
    // ==========================================
    console.log(`Generando embarque automático para quote aprobada: ${quoteId}`);
    const shipmentCode = await getNextShipmentNumber(year);

    let prodName = "Fruta";
    if (quote.product_id) {
      const { data: p } = await sbAdmin
        .from('products')
        .select('name')
        .eq('id', quote.product_id)
        .single();
      if (p) prodName = p.name;
    }

    const { error: shipError } = await sbAdmin
      .from('shipments')
      .insert({
        quote_id: quoteId,
        client_id: quote.client_id,
        boxes: Number(quote.boxes || 0),
        pallets: Number(quote.totals?.meta?.pallets || 0),
        weight_kg: Number(quote.weight_kg || 0),
        product_name: prodName,
        product_variety: quote.product_details?.variety || "",
        product_mode: quote.mode || "AIR",
        caliber: quote.product_details?.caliber || quote.product_details?.calibre || "", // 🚨 AQUÍ ESTÁ EL CAMBIO
        color: quote.product_details?.color || "",
        brix_grade: quote.product_details?.brix || "",
        origin: quote.origin || "PTY",
        destination: quote.destination || "TBD",
        incoterm: quote.totals?.meta?.incoterm || "CIP",
        status: 'CREATED',
        code: shipmentCode
      });

    if (shipError) {
      console.error("❌ Error creando embarque automático:", shipError.message);
      // 🚨 AHORA SÍ: Matamos el proceso y le enviamos el error exacto a tu pantalla
      return json(500, { 
        error: `Supabase bloqueó el embarque: ${shipError.message}. Detalles: ${shipError.details || ''}` 
      });
    } else {
      console.log(`✅ Embarque automático CREADO exitosamente: ${shipmentCode}`);
    }

    // 5. Log de actividad
    await sbAdmin.from("quote_logs").insert({
      quote_id: quoteId,
      user_id: user.id,
      user_email: user.email,
      changes: {
        status: { old: 'sent', new: 'approved' },
        po_number: { old: null, new: po_number }
      }
    });

    return json(200, { 
      ok: true, 
      message: "Cotización aprobada y Embarque generado exitosamente",
      po_number 
    });

  } catch (e: any) {
    console.error("Error crítico en approveQuote:", e.message);
    return text(500, "Server error");
  }
};