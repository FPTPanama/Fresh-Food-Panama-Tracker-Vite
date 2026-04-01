// netlify/functions/listQuotes.ts
import type { Handler } from "@netlify/functions";
import { sbAdmin, getUserAndProfile, json, text, isPrivilegedRole, optionsResponse } from "./_util";

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  if (event.httpMethod !== "GET") return text(405, "Method not allowed");

  try {
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile) return text(401, "Unauthorized");
    
    const isAdmin = isPrivilegedRole(profile.role);
    const isClient = profile.role === 'client';

    if (!isAdmin && !isClient) return text(403, "Forbidden");

    const pageSize = 20;
    const page = Math.max(1, Number(event.queryStringParameters?.page || 1));
    const dir = (event.queryStringParameters?.dir || "desc").toLowerCase() === "asc" ? "asc" : "desc";
    const status = event.queryStringParameters?.status?.trim().toLowerCase();
    const q = event.queryStringParameters?.q?.trim().slice(0, 60);

    const fromIndex = (page - 1) * pageSize;
    const toIndex = fromIndex + pageSize - 1;

    let query = sbAdmin
      .from("quotes")
      .select(`
        id, 
        quote_number, 
        created_at, 
        updated_at, 
        status, 
        mode, 
        currency, 
        destination,
        total,
        boxes, 
        weight_kg, 
        margin_markup, 
        client_id, 
        client_snapshot, 
        totals,
        product_details, 
        clients (
          name, 
          contact_email
        )
      `, { count: "exact" });

    if (isClient) {
      if (!profile.client_id) return json(200, { items: [], total: 0 });
      query = query.eq("client_id", profile.client_id);
    }

    if (status) query = query.eq("status", status);
    
    if (q) {
      query = query.or(`destination.ilike.%${q}%, quote_number.ilike.%${q}%`);
    }

    query = query
      .order("created_at", { ascending: dir === "asc" })
      .range(fromIndex, toIndex);

    const { data, count, error } = await query;
    
    if (error) {
      console.error("Error de Supabase:", error);
      throw error;
    }

    const items = (data || []).map((r: any) => {
      // ✅ LOGICA DE TOTALES: Prioridad al valor calculado en el JSON 'totals'
      // Esto soluciona el problema de los totales en 0 cuando la columna 'total' no está sincronizada.
      const finalTotal = r.totals?.total ?? r.total ?? 0;

      return {
        id: r.id,
        quote_number: r.quote_number || "S/N",
        created_at: r.created_at,
        updated_at: r.updated_at,
        status: r.status,
        mode: r.mode,
        currency: r.currency,
        destination: r.destination,
        boxes: r.boxes,
        weight_kg: r.weight_kg,
        margin_markup: r.margin_markup,
        client_id: r.client_id,
        client_name: r.clients?.name || r.client_snapshot?.name || "Sin Nombre",
        client_email: r.clients?.contact_email || r.client_snapshot?.contact_email || null,
        total: finalTotal, 
        product_details: r.product_details || {} 
      };
    });

    return json(200, {
      items,
      page,
      pageSize,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / pageSize),
      sort: { field: "created_at", dir },
    });

  } catch (e: any) {
    console.error("Error fatal en listQuotes:", e.message);
    return text(500, e?.message || "Server error");
  }
};