import type { Handler } from "@netlify/functions";
import { sbAdmin, getUserAndProfile, json, text, optionsResponse } from "./_util";

function pad5(n: number) { return String(Math.max(0, Math.floor(n))).padStart(5, "0"); }

async function getNextPONumber(year: number) {
  const prefix = `PO-${year}-`;
  const { data } = await sbAdmin.from("quotes").select("po_number").ilike("po_number", `${prefix}%`).order("po_number", { ascending: false }).limit(1);
  const lastN = Number(String(data?.[0]?.po_number || "").trim().slice(prefix.length));
  return `${prefix}${pad5(Number.isFinite(lastN) ? lastN + 1 : 1)}`;
}

async function getNextShipmentNumber(year: number) {
  const prefix = `SHP-${year}-`;
  const { data } = await sbAdmin.from("shipments").select("code").ilike("code", `${prefix}%`).order("code", { ascending: false }).limit(1);
  const lastN = Number(String(data?.[0]?.code || "").trim().slice(prefix.length));
  return `${prefix}${String(Number.isFinite(lastN) ? lastN + 1 : 1).padStart(4, "0")}`;
}

async function getNextInvoiceNumber(year: number) {
  const prefix = `INV-${year}-`;
  const { data } = await sbAdmin.from("invoices").select("invoice_number").ilike("invoice_number", `${prefix}%`).order("invoice_number", { ascending: false }).limit(1);
  const last = String(data?.[0]?.invoice_number || "").split('-').pop();
  return `${prefix}${String(last ? Number(last) + 1 : 1).padStart(4, "0")}`;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  if (event.httpMethod !== "POST") return text(405, "Method not allowed");

  try {
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile) return text(401, "Unauthorized");

    const { quoteId } = JSON.parse(event.body || "{}");
    if (!quoteId) return text(400, "Quote ID is required");

    const { data: quote, error: fetchErr } = await sbAdmin.from("quotes").select("*").eq("id", quoteId).single();
    if (fetchErr || !quote) return text(404, "Quote not found");
    if (quote.status !== 'sent') return json(400, { error: "Solo se pueden aprobar cotizaciones en estado 'Enviada'" });

    const year = new Date().getFullYear();
    const po_number = await getNextPONumber(year);
    const shipmentCode = await getNextShipmentNumber(year);
    const invoiceNumber = await getNextInvoiceNumber(year);

    await sbAdmin.from("quotes").update({ status: 'approved', po_number, updated_at: new Date().toISOString() }).eq("id", quoteId);

    // 📦 4. EMBARQUE
    let prodName = "Fruta";
    if (quote.product_id) {
      const { data: p } = await sbAdmin.from('products').select('name').eq('id', quote.product_id).single();
      if (p) prodName = p.name;
    }

    await sbAdmin.from('shipments').insert({
        quote_id: quoteId, client_id: quote.client_id,
        boxes: Number(quote.boxes || 0), pallets: Number(quote.totals?.meta?.pallets || 0),
        weight_kg: Number(quote.weight_kg || 0), product_name: prodName,
        product_variety: quote.product_details?.variety || "", product_mode: quote.mode || "AIR",
        caliber: quote.product_details?.caliber || quote.product_details?.calibre || "",
        color: quote.product_details?.color || "", brix_grade: quote.product_details?.brix || "",
        origin: quote.origin || "PTY", destination: quote.destination || "TBD",
        incoterm: quote.totals?.meta?.incoterm || "CIP", status: 'CREATED', code: shipmentCode
    });

    // 💰 5. FACTURA Y TRADUCTOR INTELIGENTE
    const totalAmount = Number(quote.totals?.total || 0);
    const subtotal = Number(quote.totals?.subtotal || totalAmount);
    let invoiceItems: any[] = [];
    
    // 🚀 LA MAGIA: Apuntamos exactamente a totals.items
    const quoteLines = quote.totals?.items;

    if (quoteLines && Array.isArray(quoteLines) && quoteLines.length > 0) {
      invoiceItems = quoteLines.map((c: any, index: number) => {
        const q = Number(c.qty || 1);
        const u = Number(c.unit || 0);
        let itemName = c.name || "Concepto";
        
        // UX: Mejoramos el nombre de la fruta para el cliente final
        if (itemName.includes("Fruta")) {
           const variety = quote.product_details?.variety || "";
           const calibre = quote.product_details?.caliber || quote.product_details?.calibre || "";
           itemName = `Exportación: ${variety} ${calibre ? `(Calibre ${calibre})` : ''}`.trim();
        }

        return {
          id: `item_auto_${Date.now()}_${index}`,
          name: itemName,
          qty: q,
          unit: u,
          totalRow: Number(c.totalRow || (q * u))
        };
      });
    } else {
      invoiceItems.push({ id: `item_fallback_${Date.now()}`, name: `Exportación General`, qty: 1, unit: subtotal, totalRow: subtotal });
    }

    // Línea en blanco para recargos manuales futuros
    invoiceItems.push({ id: `item_extra_${Date.now()}`, name: "Recargos / Servicios Adicionales", qty: 1, unit: 0, totalRow: 0 });

    await sbAdmin.from("invoices").insert({
        invoice_number: invoiceNumber, quote_id: quote.id, client_id: quote.client_id,
        status: "UNPAID", issue_date: new Date().toISOString().split("T")[0],
        due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], 
        items: invoiceItems, subtotal: subtotal, tax_amount: 0, total: totalAmount, amount_paid: 0,
    });

    await sbAdmin.from("quote_logs").insert({
      quote_id: quoteId, user_id: user.id, user_email: user.email,
      changes: { status: { old: 'sent', new: 'approved' }, po_number: { old: null, new: po_number } }
    });

    return json(200, { ok: true, po_number, shipment_code: shipmentCode, invoice_number: invoiceNumber });
  } catch (e: any) {
    return text(500, "Server error");
  }
};