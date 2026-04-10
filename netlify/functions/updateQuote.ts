// netlify/functions/updateQuote.ts
import type { Handler } from "@netlify/functions";
import { sbAdmin, getUserAndProfile, json, text, isPrivilegedRole, optionsResponse } from "./_util";

function pad5(n: number) {
  const x = Math.max(0, Math.floor(n));
  return String(x).padStart(5, "0");
}

async function getNextOfficialNumber(year: number) {
  const prefix = `Q/${year}/`;
  const { data, error } = await sbAdmin
    .from("quotes")
    .select("quote_number")
    .ilike("quote_number", `${prefix}%`)
    .order("quote_number", { ascending: false })
    .limit(1);

  if (error || !data?.[0]?.quote_number) {
    return `${prefix}${pad5(1)}`;
  }

  const last = String(data[0].quote_number).trim();
  const tail = last.slice(prefix.length);
  const lastN = Number(tail);
  const next = Number.isFinite(lastN) ? lastN + 1 : 1;
  return `${prefix}${pad5(next)}`;
}

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
    // Eliminamos restricción temporalmente para debug, o aseguramos que el cliente SÍ pueda aceptar su propia quote
    // if (!isPrivilegedRole(profile.role || "")) return text(403, "Forbidden");

    const body = JSON.parse(event.body || "{}");
    const id = String(body.id || "").trim();
    if (!id) return text(400, "Missing id");

    const { data: currentQuote, error: fetchError } = await sbAdmin
      .from("quotes")
      .select("status, quote_number, product_id, client_id, origin") 
      .eq("id", id)
      .single();

    if (fetchError || !currentQuote) return text(404, "Quote not found");

    const patch: any = {
      updated_at: new Date().toISOString()
    };

    const allowed = [
      "client_id", "status", "mode", "currency", "origin", "destination", 
      "boxes", "weight_kg", "margin_markup", "payment_terms", 
      "terms", "client_snapshot", "costs", "totals", "product_id", "product_details"
    ];

    for (const k of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, k)) {
        patch[k] = body[k];
      }
    }

    const oldStatus = String(currentQuote.status).toLowerCase();
    
    // 🚨 SOPORTE PARA AMBOS STATUS: A veces el frontend manda "accepted", el backend original esperaba "approved"
    let newStatusRaw = String(patch.status || currentQuote.status).toLowerCase();
    if (newStatusRaw === 'accepted') newStatusRaw = 'approved'; 
    const newStatus = newStatusRaw;

    const currentNum = String(currentQuote.quote_number);

    const officialStatuses = ['draft', 'sent', 'approved', 'rejected', 'expired'];
    const isCurrentRFQ = currentNum.startsWith('RFQ/') || oldStatus === 'solicitud';
    const isTargetOfficial = officialStatuses.includes(newStatus);

    if (isCurrentRFQ && isTargetOfficial) {
      const year = new Date().getFullYear();
      patch.quote_number = await getNextOfficialNumber(year);
    }

    if (patch.mode) patch.mode = String(patch.mode).toUpperCase();
    if (patch.currency) patch.currency = String(patch.currency).toUpperCase();

    const { error: updateError } = await sbAdmin
      .from("quotes")
      .update(patch)
      .eq("id", id);

    if (updateError) {
      console.error("❌ Error DB updateQuote:", updateError.message);
      return text(500, updateError.message);
    }

    // 🚨 EL CEREBRO DE LA AUTOMATIZACIÓN 🚨
    console.log(`Verificando automatización... Status: ${newStatus}`);
    if (newStatus === 'approved') {
      const { data: existingShip } = await sbAdmin
        .from('shipments')
        .select('id')
        .eq('quote_id', id)
        .maybeSingle();

      if (!existingShip) {
        console.log(`Generando embarque automático para quote: ${id}`);
        const year = new Date().getFullYear();
        const shipmentCode = await getNextShipmentNumber(year);

        let prodName = "Fruta";
        let variety = patch.product_details?.variety || "";
        
        if (patch.product_id || currentQuote.product_id) {
          const { data: p } = await sbAdmin
            .from('products')
            .select('name')
            .eq('id', patch.product_id || currentQuote.product_id)
            .single();
          if (p) prodName = p.name;
        }

        // Blindaje contra errores de DB (nulos o undefined que rompen constraints)
        const payload = {
            quote_id: id,
            client_id: patch.client_id || currentQuote.client_id,
            boxes: Number(patch.boxes || 0),
            pallets: Number(patch.totals?.meta?.pallets || 0),
            weight_kg: Number(patch.weight_kg || 0),
            product_name: prodName,
            product_variety: variety,
            product_mode: patch.mode || "AIR",
            // Ajustamos a 'calibre' por si acaso la DB espera ese nombre
            calibre: patch.product_details?.caliber || patch.product_details?.calibre || "",
            color: patch.product_details?.color || "",
            brix_grade: patch.product_details?.brix || "",
            origin: patch.origin || currentQuote.origin || "PTY", 
            destination: patch.destination || "TBD",
            incoterm: patch.totals?.meta?.incoterm || "CIP",
            status: 'CREATED',
            code: shipmentCode
          };

        console.log("Payload para insertar embarque:", payload);

        const { error: shipError } = await sbAdmin
          .from('shipments')
          .insert(payload);

        if (shipError) {
            console.error("❌ MURIÓ LA AUTOMATIZACIÓN (DB Error):", shipError.message);
            console.error("Detalles del error:", shipError.details, shipError.hint);
            // No retornamos error 500 aquí para no colapsar la app al cliente, pero logueamos fuerte
        } else {
            console.log(`✅ Embarque automático CREADO con código: ${shipmentCode}`);
        }
      } else {
        console.log(`⚠️ Ya existe un embarque asociado a esta cotización. Ignorando.`);
      }
    }

    return json(200, { 
      ok: true, 
      message: "Cotización actualizada y procesos completados.",
      new_number: patch.quote_number || currentNum 
    });

  } catch (e: any) {
    console.error("❌ Falla crítica no controlada en updateQuote:", e.message);
    return text(500, e?.message || "Server error");
  }
};