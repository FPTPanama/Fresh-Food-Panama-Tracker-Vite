import type { Handler } from "@netlify/functions";
import { sbAdmin, getUserAndProfile, json, text, isPrivilegedRole, optionsResponse } from "./_util";

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  if (event.httpMethod !== "POST") return text(405, "Method not allowed");

  try {
    // 🛡️ 1. Validación de Seguridad (Solo Administradores)
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile) return text(401, "Unauthorized");
    if (!isPrivilegedRole(profile.role || "")) return text(403, "Forbidden");

    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;

    // 2. Buscar el último correlativo usando sbAdmin (salta el RLS frontal)
    const { data } = await sbAdmin
      .from("invoices")
      .select("invoice_number")
      .ilike("invoice_number", `${prefix}%`)
      .order("invoice_number", { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (data && data[0]?.invoice_number) {
      const last = String(data[0].invoice_number).split('-').pop();
      nextNum = Number(last) + 1;
    }
    const invoiceNumber = `${prefix}${String(nextNum).padStart(4, "0")}`;

    // 3. Crear factura en blanco
    const { data: newInv, error } = await sbAdmin
      .from("invoices")
      .insert({
        invoice_number: invoiceNumber,
        status: "UNPAID",
        issue_date: new Date().toISOString().split("T")[0],
        due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        items: [{ id: `item_${Date.now()}`, name: "Servicio Profesional", qty: 1, unit: 0, totalRow: 0 }],
        subtotal: 0,
        tax_amount: 0,
        total: 0,
        amount_paid: 0,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error BD Insert Invoice:", error);
      return text(500, "Error BD: " + error.message);
    }

    // 4. Retornar el ID para que el frontend redirija
    return json(200, { id: newInv.id });

  } catch (e: any) {
    console.error("Falla en createInvoice:", e);
    return text(500, "Server error: " + e.message);
  }
};