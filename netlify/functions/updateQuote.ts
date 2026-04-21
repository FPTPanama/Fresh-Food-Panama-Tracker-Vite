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

// 🚀 NUEVA FUNCIÓN: Generador correlativo de Facturas
async function getNextInvoiceNumber(year: number) {
  const prefix = `INV-${year}-`;
  const { data, error } = await sbAdmin
    .from("invoices")
    .select("invoice_number")
    .ilike("invoice_number", `${prefix}%`)
    .order("invoice_number", { ascending: false })
    .limit(1);

  if (error || !data?.[0]?.invoice_number) {
    return `${prefix}0001`;
  }

  const last = String(data[0].invoice_number).trim();
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
    const id = String(body.id || "").trim();
    if (!id) return text(400, "Missing id");

    // Agregamos campos extra al select para asegurar que la factura herede todo si viene vacío en el patch
    const { data: currentQuote, error: fetchError } = await sbAdmin
      .from("quotes")
      .select("status, quote_number, product_id, client_id, origin, boxes, weight_kg, totals, terms, valid_until") 
      .eq("id", id)
      .single();

    if (fetchError || !currentQuote) return text(404, "Quote not found");

    const patch: any = {
      updated_at: new Date().toISOString()
    };

    const allowed = [
      "client_id", "status", "mode", "currency", "origin", "destination", 
      "boxes", "weight_kg", "margin_markup", "payment_terms", 
      "terms", "client_snapshot", "costs", "totals", "product_id", "product_details", "valid_until"
    ];

    for (const k of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, k)) {
        patch[k] = body[k];
      }
    }

    const oldStatus = String(currentQuote.status).toLowerCase();
    
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

    // 🚨 EL CEREBRO DE LA AUTOMATIZACIÓN DUAL (EMBARQUE + FACTURA) 🚨
    console.log(`Verificando automatización... Status: ${newStatus}`);
    
    if (newStatus === 'approved') {
      const year = new Date().getFullYear();

      // ==========================================
      // 1. AUTOMATIZACIÓN DE EMBARQUE OPERATIVO
      // ==========================================
      const { data: existingShip } = await sbAdmin.from('shipments').select('id').eq('quote_id', id).maybeSingle();

      if (!existingShip) {
        console.log(`Generando embarque automático para quote: ${id}`);
        const shipmentCode = await getNextShipmentNumber(year);

        let prodName = "Fruta";
        let variety = patch.product_details?.variety || "";
        
        if (patch.product_id || currentQuote.product_id) {
          const { data: p } = await sbAdmin.from('products').select('name').eq('id', patch.product_id || currentQuote.product_id).single();
          if (p) prodName = p.name;
        }

        const shipPayload = {
            quote_id: id,
            client_id: patch.client_id || currentQuote.client_id,
            boxes: Number(patch.boxes || currentQuote.boxes || 0),
            pallets: Number(patch.totals?.meta?.pallets || currentQuote.totals?.meta?.pallets || 0),
            weight_kg: Number(patch.weight_kg || currentQuote.weight_kg || 0),
            product_name: prodName,
            product_variety: variety,
            product_mode: patch.mode || "AIR",
            calibre: patch.product_details?.caliber || patch.product_details?.calibre || "",
            color: patch.product_details?.color || "",
            brix_grade: patch.product_details?.brix || "",
            origin: patch.origin || currentQuote.origin || "PTY", 
            destination: patch.destination || "TBD",
            incoterm: patch.totals?.meta?.incoterm || "CIP",
            status: 'CREATED',
            code: shipmentCode
          };

        const { error: shipError } = await sbAdmin.from('shipments').insert(shipPayload);
        if (shipError) console.error("❌ ERROR AL CREAR EMBARQUE:", shipError.message);
        else console.log(`✅ Embarque automático CREADO con código: ${shipmentCode}`);
      } else {
        console.log(`⚠️ Ya existe un embarque asociado a esta cotización.`);
      }

      // ==========================================
      // 2. AUTOMATIZACIÓN DE FACTURA COMERCIAL
      // ==========================================
      const { data: existingInvoice } = await sbAdmin.from('invoices').select('id').eq('quote_id', id).maybeSingle();

      if (!existingInvoice) {
        console.log(`Generando factura automática para quote: ${id}`);
        const invoiceNumber = await getNextInvoiceNumber(year);

        // Calcular fechas
        const issueDate = new Date().toISOString().split('T')[0];
        const validUntil = patch.valid_until || currentQuote.valid_until;
        let dueDate = validUntil;
        if (!dueDate) {
          const d = new Date();
          d.setDate(d.getDate() + 5); // Por defecto 5 días si no había fecha
          dueDate = d.toISOString().split('T')[0];
        }

        // Extraer totales de donde vengan (del patch o de la data actual)
        const finalTotals = patch.totals || currentQuote.totals || {};
        const totalAmount = Number(finalTotals.total || 0);

        const invPayload = {
          invoice_number: invoiceNumber,
          quote_id: id,
          client_id: patch.client_id || currentQuote.client_id,
          status: 'UNPAID', // Nace como cuenta por cobrar
          issue_date: issueDate,
          due_date: dueDate,
          boxes: Number(patch.boxes || currentQuote.boxes || 0),
          pallets: Number(finalTotals.meta?.pallets || 0),
          weight_kg: Number(patch.weight_kg || currentQuote.weight_kg || 0),
          items: finalTotals.items || [], // Matriz comercial clonada idéntica
          subtotal: totalAmount, 
          tax_amount: 0, 
          total: totalAmount,
          amount_paid: 0,
          notes: patch.terms || currentQuote.terms || ""
        };

        const { error: invError } = await sbAdmin.from('invoices').insert(invPayload);
        if (invError) console.error("❌ ERROR AL CREAR FACTURA:", invError.message);
        else console.log(`✅ Factura automática CREADA con código: ${invoiceNumber}`);
      } else {
        console.log(`⚠️ Ya existe una factura asociada a esta cotización.`);
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