import type { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const sendTwilioMessage = async (to: string, message: string): Promise<boolean> => {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  let fromEnv = process.env.TWILIO_WA_FROM?.trim() || "+14155238886";

  const finalFrom = fromEnv.startsWith('whatsapp:') ? fromEnv : `whatsapp:${fromEnv}`;
  const cleanTo = to.replace(/\s+/g, '');
  const finalTo = cleanTo.startsWith('whatsapp:') ? cleanTo : `whatsapp:${cleanTo.startsWith('+') ? cleanTo : '+' + cleanTo}`;

  const params = new URLSearchParams();
  params.append("To", finalTo);
  params.append("From", finalFrom);
  params.append("Body", message);

  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params
    });
    return response.ok;
  } catch (error) {
    console.error("❌ EXCEPCIÓN TWILIO:", error);
    return false;
  }
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const bodyParams = new URLSearchParams(event.body || "");
    const senderNumber = bodyParams.get("From")?.replace("whatsapp:", "");
    const incomingMessage = bodyParams.get("Body");

    if (!incomingMessage) return { statusCode: 200, body: "<Response></Response>" };

    // ==========================================
    // 🛡️ ESCUDO DE SEGURIDAD (LISTA BLANCA)
    // ==========================================
    const AUTHORIZED_NUMBERS = [
      "+50761234567", // <-- Reemplaza con tu número (Freddy)
      "+50762256452",
      "+13059248876",// <-- Reemplaza con el número de David
      // "AÑADE_MAS_NUMEROS_AQUI_ENTRE_COMILLAS"
    ];

    // Aseguramos que el número tenga el símbolo + para compararlo bien
    const normalizedSender = senderNumber?.startsWith('+') ? senderNumber : `+${senderNumber}`;

    if (!AUTHORIZED_NUMBERS.includes(normalizedSender)) {
      console.warn(`🚨 ALERTA DE INTRUSO: Intento de acceso denegado desde el número ${normalizedSender}`);
      
      // Devolvemos una respuesta vacía. El intruso no recibirá NADA, pensará que el número no funciona.
      return { 
        statusCode: 200, 
        headers: { "Content-Type": "text/xml" }, 
        body: `<Response></Response>` 
      };
    }
    // ==========================================

    console.log(`\n📩 CHATOPS IN: "${incomingMessage}" de ${senderNumber}`);

    // --- 🧠 EXTRACCIÓN DE LA MEMORIA A LARGO PLAZO ---
    const { data: memories } = await supabase.from('agent_memory').select('rule_text');
    const systemMemory = memories && memories.length > 0 
      ? memories.map(m => `- ${m.rule_text}`).join('\n') 
      : "Ninguna regla aprendida aún.";

    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.1-flash-lite-preview", 
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      Eres el Orquestador B2B de Fresh Food Panamá.
      Respondes directamente a Freddy García (El Jefe / Creador del Sistema) y asistes a David Vazquez (Gerente General).

      CONTEXTO EQUIPO:
      - Ricardo Boccardo "Pipo" & Victor Centeno (Ventas)
      - Ronald Chanis (Inspector), Pedro Rojas (Finanzas)
      - Candida Ojo (Documental), Katia Peralta (Logística)

      REGLAS DE MEMORIA:
      ${systemMemory}

      REGLAS CONVERSACIONALES Y DE FORMATO (¡ESTRICTAS E INQUEBRANTABLES!):
      1. ETIQUETADO DE CLIENTE: SIEMPRE que menciones un número de cotización, embarque o AWB, DEBES incluir el nombre del cliente. (Ej: "Cotización Q-123 de Global Fruits", "Embarque SHP-456 de Importadora Rey"). NUNCA envíes un código solo.
      2. SUPERLATIVOS: Si te piden "el último", "el más reciente", usa "limit": 1 en tu query_config.
      3. BÚSQUEDA POR CONTEXTO: Si te piden "la cotización de ayer", "el embarque de Madrid" o "de Global Fruits", pon esa palabra clave en "search_term" dentro de query_config.
      4. DESEMPATE: Si buscan "la cotización de ayer" y el sistema devuelve varias, lístalas todas cumpliendo la Regla 1 y pregúntale a Freddy a cuál se refiere. NUNCA te quedes mudo ni asumas.
      5. PENDIENTES: Si Freddy dice "¿Qué tenemos pendiente?", usa REPORTE_GERENCIAL con filter_status: "draft" para cotizaciones.
      6. SALUDOS OPERATIVOS: Si te dicen "Buenos días" o "Cómo vamos", responde con un tono proactivo en CHAT_GENERAL indicando que estás listo para operar.
      7. CORRECCIONES: Si te dice "Me equivoqué, ponle X", corrige el dato sin reiniciar todo el flujo.
      8. TONO EJECUTIVO: Freddy quiere respuestas al grano. Cero rodeos. Usa "Entendido Jefe", "Listo Freddy" o "Anotado". Nada de "Con gusto le ayudo".
      
      CLASIFICACIÓN DE INTENCIONES:
      1. "GESTION_COTIZACION": Crear cotización (Requiere: Cliente, Destino, Pallets, Precio).
      2. "APROBAR_COTIZACION": Aprobar un borrador.
      3. "CONSULTA_EMBARQUE_DETALLE": Pedir estatus de un embarque específico.
      4. "CREAR_CLIENTE": Registrar cliente.
      5. "GENERAR_DOCUMENTO": Generar PDF (Factura/Cotización).
      6. "GESTION_INVENTARIO": Consultar/actualizar stock.
      7. "REPORTE_GERENCIAL": Pedir listas, "el último", búsquedas por destino/cliente, o pendientes.
      8. "INSTRUCCION_DIRECTA": Órdenes al equipo.
      9. "APRENDER_REGLA": Memorizar política/regla en la base de datos.
      10. "CHAT_GENERAL": Saludos o preguntas fuera de la operación.
      
      JSON ESTRICTO DE RESPUESTA:
      {
        "intent": "GESTION_COTIZACION" | "APROBAR_COTIZACION" | "CONSULTA_EMBARQUE_DETALLE" | "CREAR_CLIENTE" | "GENERAR_DOCUMENTO" | "GESTION_INVENTARIO" | "REPORTE_GERENCIAL" | "INSTRUCCION_DIRECTA" | "APRENDER_REGLA" | "CHAT_GENERAL",
        "chat_response": "Respuesta natural, directa y ejecutiva",
        "new_rule": "Texto de la regla a memorizar",
        "quote_data": { "ready": boolean, "reply_to_user": "...", "client_name": "...", "destination": "...", "pallets": 0, "price": 0 },
        "shipment_query": { "code": "..." },
        "client_data": { "ready": boolean, "reply_to_user": "...", "name": "...", "email": "...", "phone": "...", "tax_id": "..." },
        "doc_query": { "reference_code": "..." },
        "inventory_data": { "action": "consultar" | "actualizar", "updates": [ { "item_name": "Cajas", "operation": "add" | "subtract" | "set", "amount": 100 } ] },
        "query_config": { 
          "table": "quotes" | "shipments", 
          "filter_status": "opcional", 
          "search_term": "opcional (ej. nombre del cliente, destino, o fecha como 'ayer')",
          "limit": 3 
        },
        "tasks": [ { "target": "Persona", "message_to_send": "..." } ]
      }

      Mensaje de Freddy: "${incomingMessage}"
    `;

    const result = await model.generateContent(prompt);
    const ai = JSON.parse(result.response.text());
    const baseUrl = process.env.URL || 'https://app.freshfoodpanama.com';

    // ==========================================
    // 🧠 NUEVO FLUJO: APRENDER REGLAS
    // ==========================================
    if (ai.intent === "APRENDER_REGLA" && ai.new_rule) {
      const { error: memErr } = await supabase.from('agent_memory').insert({ rule_text: ai.new_rule });
      
      if (memErr) {
        return { statusCode: 200, headers: { "Content-Type": "text/xml" }, body: `<Response><Message>⚠️ Jefe, tuve un problema guardando eso en mi memoria: ${memErr.message}</Message></Response>` };
      }
      return { statusCode: 200, headers: { "Content-Type": "text/xml" }, body: `<Response><Message>🧠 ¡Anotado Jefe! A partir de ahora recordaré que: "${ai.new_rule}"</Message></Response>` };
    }

    // ==========================================
    // 1. INVENTARIO (Consultas y Actualizaciones)
    // ==========================================
    else if (ai.intent === "GESTION_INVENTARIO") {
      const inv = ai.inventory_data;
      if (inv.action === "actualizar" && inv.updates?.length > 0) {
        let msg = "✅ *INVENTARIO ACTUALIZADO:*\n\n";
        for (const u of inv.updates) {
          const { data: current } = await supabase.from('inventory').select('quantity').ilike('item_name', u.item_name).single();
          let newQty = u.amount;
          if (current) {
            if (u.operation === 'add') newQty = current.quantity + u.amount;
            if (u.operation === 'subtract') newQty = current.quantity - u.amount;
            await supabase.from('inventory').update({ quantity: newQty, last_updated: new Date().toISOString() }).ilike('item_name', u.item_name);
          } else {
            await supabase.from('inventory').insert({ item_name: u.item_name, quantity: newQty });
          }
          msg += `📦 ${u.item_name}: *${newQty} uds* \n`;
        }
        return { statusCode: 200, headers: { "Content-Type": "text/xml" }, body: `<Response><Message>${msg}</Message></Response>` };
      } else {
        const { data: items } = await supabase.from('inventory').select('*').order('item_name');
        let msg = "📦 *ESTADO DEL INVENTARIO:*\n\n";
        if (!items || items.length === 0) msg += "No hay items registrados.";
        items?.forEach(i => msg += `- *${i.item_name}*: ${i.quantity.toLocaleString()} uds.\n`);
        return { statusCode: 200, headers: { "Content-Type": "text/xml" }, body: `<Response><Message>${msg}</Message></Response>` };
      }
    }

    // ==========================================
    // 2. GENERAR DOCUMENTO (Factura / Cotización)
    // ==========================================
    else if (ai.intent === "GENERAR_DOCUMENTO") {
      const code = ai.doc_query?.reference_code;
      if (!code) return { statusCode: 200, headers: { "Content-Type": "text/xml" }, body: `<Response><Message>⚠️ Por favor especifica el número de documento que deseas generar.</Message></Response>` };
      const { data: q } = await supabase.from('quotes').select('id, quote_number, status').ilike('quote_number', `%${code}%`).single();
      if (q) {
        const url = `${baseUrl}/.netlify/functions/renderQuotePdf?id=${q.id}`;
        return { statusCode: 200, headers: { "Content-Type": "text/xml" }, body: `<Response><Message>📄 *Documento Generado: ${q.quote_number}*\nEstado: ${q.status}\n\nEnlace seguro:\n${url}</Message></Response>` };
      }
      return { statusCode: 200, headers: { "Content-Type": "text/xml" }, body: `<Response><Message>⚠️ No encontré ningún documento con el código "${code}".</Message></Response>` };
    }

    // ==========================================
    // 3. ESCÁNER DE EMBARQUES PROFUNDO
    // ==========================================
    else if (ai.intent === "CONSULTA_EMBARQUE_DETALLE" && ai.shipment_query?.code) {
      const code = ai.shipment_query.code;
      const { data: ship, error: shipErr } = await supabase.from('shipments').select('*').ilike('code', `%${code}%`).single();
      if (shipErr || !ship) return { statusCode: 200, headers: { "Content-Type": "text/xml" }, body: `<Response><Message>⚠️ No encontré el embarque "${code}". Verifica el número.</Message></Response>` };

      const { data: docs } = await supabase.from('shipment_files').select('doc_type').eq('shipment_id', ship.id);
      const requiredDocs = { 'invoice': 'Factura', 'packing_list': 'Packing List', 'awb': 'AWB / BL', 'phytosanitary': 'Fitosanitario', 'export_declaration': 'Decl. Exportación' };
      const uploadedTypes = docs?.map(d => d.doc_type) || [];
      const missingDocs = Object.entries(requiredDocs).filter(([key]) => !uploadedTypes.includes(key)).map(([_, label]) => label);

      let flightInfo = `Vuelo: ${ship.flight_number || 'Por asignar'}`;
      if (ship.status === 'IN_TRANSIT' || ship.flight_departure_time) {
        const dep = ship.flight_departure_time ? new Date(ship.flight_departure_time).toLocaleString('es-PA', {hour: '2-digit', minute:'2-digit', day:'2-digit', month:'short'}) : 'TBD';
        const arr = ship.flight_arrival_time ? new Date(ship.flight_arrival_time).toLocaleString('es-PA', {hour: '2-digit', minute:'2-digit', day:'2-digit', month:'short'}) : 'TBD';
        flightInfo += `\n🛫 Salida: ${dep}\n🛬 LLegada (Est): ${arr}`;
      }

      const statusEmoji = ship.status === 'DELIVERED' ? '✅' : ship.status === 'IN_TRANSIT' ? '✈️' : '⏳';
      let reportMsg = `📦 *ESCÁNER DE EMBARQUE*\n\n*Código:* ${ship.code}\n*Destino:* ${ship.destination}\n*Estado:* ${statusEmoji} ${ship.status}\n*AWB:* ${ship.awb || 'Pendiente'}\n*Carga:* ${ship.pallets || 0} pallets (${ship.weight_kg || 0} kg)\n\n✈️ *Logística:*\n${flightInfo}\n\n📄 *Documentos:*\n`;
      
      if (missingDocs.length === 0) reportMsg += `✅ Expediente completo.`;
      else reportMsg += `⚠️ *FALTAN SUBIR:*\n${missingDocs.map(d => `- ${d}`).join('\n')}`;

      return { statusCode: 200, headers: { "Content-Type": "text/xml" }, body: `<Response><Message>${reportMsg}</Message></Response>` };
    }

    // ==========================================
    // 4. CREAR CLIENTE
    // ==========================================
    else if (ai.intent === "CREAR_CLIENTE") {
      const cData = ai.client_data;
      if (!cData.ready) return { statusCode: 200, headers: { "Content-Type": "text/xml" }, body: `<Response><Message>${cData.reply_to_user}</Message></Response>` };

      const { data: newClient, error: insertErr } = await supabase
        .from('clients')
        .insert({ name: cData.name, contact_email: cData.email, phone: cData.phone || null, tax_id: cData.tax_id || null, status: 'active' })
        .select('id, name')
        .single();

      if (insertErr) return { statusCode: 200, headers: { "Content-Type": "text/xml" }, body: `<Response><Message>⚠️ Error DB: ${insertErr.message}</Message></Response>` };
      return { statusCode: 200, headers: { "Content-Type": "text/xml" }, body: `<Response><Message>✅ Cliente *${newClient.name}* registrado con éxito.</Message></Response>` };
    }

    // ==========================================
    // 5 Y 6. COTIZACIONES B2B
    // ==========================================
    else if (ai.intent === "GESTION_COTIZACION") {
      const qData = ai.quote_data;
      if (!qData.ready) return { statusCode: 200, headers: { "Content-Type": "text/xml" }, body: `<Response><Message>${qData.reply_to_user}</Message></Response>` };

      const { data: newQuote, error: insertErr } = await supabase
        .from('quotes')
        .insert({ status: 'draft', mode: 'AIR', destination: qData.destination, pallets: qData.pallets || 0, boxes: (qData.pallets || 0) * 60, total: (qData.pallets || 0) * 60 * (qData.price || 0) })
        .select('id, quote_number')
        .single();
      
      if (insertErr) throw insertErr;
      const pdfUrl = `${baseUrl}/.netlify/functions/renderQuotePdf?id=${newQuote.id}`;
      return { statusCode: 200, headers: { "Content-Type": "text/xml" }, body: `<Response><Message>✅ Borrador Creado.\n\nDestino: ${qData.destination} | ${qData.pallets} pallets\nCotización: ${newQuote.quote_number}\n\nPDF: ${pdfUrl}\n\nResponde: "Aprobar cotización" para enviarla.</Message></Response>` };
    }
    else if (ai.intent === "APROBAR_COTIZACION") {
      const { data: draftQuote } = await supabase.from('quotes').select('id, quote_number').eq('status', 'draft').order('created_at', { ascending: false }).limit(1).single();
      if (draftQuote) {
        await supabase.from('quotes').update({ status: 'sent' }).eq('id', draftQuote.id);
        return { statusCode: 200, headers: { "Content-Type": "text/xml" }, body: `<Response><Message>🚀 ¡Listo! La cotización ${draftQuote.quote_number} ha sido ENVIADA.</Message></Response>` };
      }
      return { statusCode: 200, headers: { "Content-Type": "text/xml" }, body: `<Response><Message>⚠️ No encontré borradores recientes.</Message></Response>` };
    }

    // ==========================================
    // 7 Y 8. REPORTES Y TAREAS
    // ==========================================
    else if (ai.intent === "REPORTE_GERENCIAL" && ai.query_config) {
      const { table, filter_status, limit } = ai.query_config;
      let query = supabase.from(table || 'quotes').select('*').order('created_at', { ascending: false }).limit(limit || 3);
      if (filter_status) query = query.ilike('status', `%${filter_status}%`);
      const { data: dbRows } = await query;
      let reportBody = `📊 *REPORTE FRESH FOOD*\n`;
      if (table === 'quotes') dbRows?.forEach(q => reportBody += `• *${q.quote_number}*: Destino ${q.destination} - *$${q.total}*\n`);
      else dbRows?.forEach(s => reportBody += `• *${s.code}*: ${s.pallets} pal. a ${s.destination} (${s.status})\n`);
      return { statusCode: 200, headers: { "Content-Type": "text/xml" }, body: `<Response><Message>${reportBody}</Message></Response>` };
    } 
    else if (ai.intent === "INSTRUCCION_DIRECTA" && ai.tasks) {
      const [{ data: internal }, { data: external }] = await Promise.all([
        supabase.from('profiles').select('position, phone, full_name'),
        supabase.from('external_partners').select('position, phone, full_name')
      ]);

      const directory = [...(internal || []), ...(external || [])];
      
      let confirmMsg = "✅ Tareas asignadas:\n";
      for (const task of ai.tasks) {
        const person = directory.find(p => p.position?.toLowerCase().includes(task.target.toLowerCase()) || p.full_name?.toLowerCase().includes(task.target.toLowerCase()));
        if (person?.phone) {
          await sendTwilioMessage(person.phone, `🤖 *Operaciones Fresh Food:*\n\n${task.message_to_send}`);
          confirmMsg += `- ${person.full_name} notificado.\n`;
        } else {
          confirmMsg += `- ⚠️ No encontré a ${task.target}.\n`;
        }
      }
      return { statusCode: 200, headers: { "Content-Type": "text/xml" }, body: `<Response><Message>${confirmMsg}</Message></Response>` };
    }

    // ==========================================
    // FLUJO 9: CHARLA GENERAL / PREGUNTAS
    // ==========================================
    else if (ai.intent === "CHAT_GENERAL" && ai.chat_response) {
      return { 
        statusCode: 200, 
        headers: { "Content-Type": "text/xml" }, 
        body: `<Response><Message>${ai.chat_response}</Message></Response>` 
      };
    }

    return { statusCode: 200, headers: { "Content-Type": "text/xml" }, body: `<Response><Message>✅ Comando recibido, pero no logré clasificar la acción.</Message></Response>` };

  } catch (error: any) {
    console.error("❌ ERROR CHATOPS:", error.message);
    return { statusCode: 200, headers: { "Content-Type": "text/xml" }, body: `<Response><Message>⚠️ Error del Agente: ${error.message}</Message></Response>` };
  }
};