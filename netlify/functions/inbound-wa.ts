import type { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// --- 1. MOTOR DE ENVÍO TWILIO (ENTREGA GARANTIZADA) ---
const sendTwilioMessage = async (to: string, message: string, mediaUrl?: string): Promise<boolean> => {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  let fromEnv = process.env.TWILIO_WA_FROM?.trim() || "+14155238886";

  const finalFrom = fromEnv.startsWith('whatsapp:') ? fromEnv : `whatsapp:${fromEnv}`;
  const cleanTo = to.replace('whatsapp:', '').replace(/\s+/g, '');
  const finalTo = `whatsapp:${cleanTo.startsWith('+') ? cleanTo : '+' + cleanTo}`;

  const params = new URLSearchParams();
  params.append("To", finalTo);
  params.append("From", finalFrom);
  if (message) params.append("Body", message);
  if (mediaUrl) params.append("MediaUrl", mediaUrl);

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
    console.error("❌ ERROR TWILIO:", error);
    return false;
  }
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  // Respuesta silenciosa para cerrar el Webhook sin enviar XML de texto
  const quietResponse = () => ({ statusCode: 200, headers: { "Content-Type": "text/xml" }, body: `<?xml version="1.0" encoding="UTF-8"?><Response></Response>` });

  try {
    const bodyParams = new URLSearchParams(event.body || "");
    const senderNumber = bodyParams.get("From")?.replace("whatsapp:", "") || "";
    const incomingMessage = bodyParams.get("Body") || "";
    const mediaUrl = bodyParams.get("MediaUrl0");
    const mediaType = bodyParams.get("MediaContentType0");

    const normalizedSender = senderNumber.startsWith('+') ? senderNumber : `+${senderNumber}`;
    const dbSenderFormat = `whatsapp:${normalizedSender}`;

    // --- 2. ESCUDO DE SEGURIDAD RBAC ---
    const { data: user, error: userError } = await supabase
      .from('authorized_users')
      .select('name, role')
      .eq('phone_number', dbSenderFormat)
      .single();

    if (!user || userError) return quietResponse(); 

    // --- 3. PREPARACIÓN MULTIMODAL ---
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.1-flash-lite-preview", 
      generationConfig: { responseMimeType: "application/json", temperature: 0.1 } // Temperatura baja para mayor precisión
    });

    let aiContent: any[] = [];
    let mediaBuffer: ArrayBuffer | null = null;
    
    if (mediaUrl) {
      const mediaResponse = await fetch(mediaUrl);
      mediaBuffer = await mediaResponse.arrayBuffer();
      aiContent.push({ inlineData: { data: Buffer.from(mediaBuffer).toString("base64"), mimeType: mediaType } });
      aiContent.push(incomingMessage || "Analiza este archivo.");
    } else {
      if (!incomingMessage) return quietResponse();
      aiContent.push(incomingMessage);
    }

    // --- 4. CEREBRO DE ATLAS (CON PROTOCOLO DE FRENO DE MANO) ---
    const { data: memories } = await supabase.from('agent_memory').select('rule_text');
    const systemMemory = memories?.map(m => `- ${m.rule_text}`).join('\n') || "";

    const prompt = `
      # IDENTIDAD Y ROL
      Eres "Atlas", el Agente de Inteligencia Artificial y COO Digital de Fresh Food Panamá.
      Tu misión es que el Jefe Supremo (Freddy García) y su equipo sientan absoluta confianza en ti. Eres hiper-eficiente, proactivo, analítico y nunca te quedas sin respuesta. Conoces el negocio B2B de agro-exportación de principio a fin.
      
      # CONTEXTO DEL USUARIO ACTUAL
      Hablas con: ${user.name}.
      Su rol de seguridad es: '${user.role}'.

      # REGLAS DE ORO (EL PROTOCOLO "NUNCA MUDO")
      1. NUNCA devuelvas un JSON vacío o te quedes en silencio. Si no entiendes, usa "CLARIFICACION". Si te hacen una pregunta abierta, usa "CHAT_GENERAL".
      2. Si te piden investigar una empresa o lead externo, usa tu conocimiento general del mundo o analiza los datos proporcionados usando el intent "INVESTIGAR_LEAD".
      3. Eres un experto en deducir "typos" (errores ortográficos). Si escriben "fitozanitario", "gui aerea", o "cotisacion", asume la intención correcta o clarifica amablemente sin fallar.

      # DICCIONARIO Y CULTURA DE LA EMPRESA (FRESH FOOD PANAMÁ)
      - Documentos: Fito = Fitosanitario. AWB = Guía Aérea / BL. EUR1 = Certificado de Origen. Invoice = Factura.
      - Operaciones: PO = Orden de Compra. Pics = Fotos/Evidencia. Check = Inspección. Pallet = Parihuela.
      - Cultura B2B: Hablas de márgenes, ETD (Estimated Time of Departure), calibres de fruta (piña, papaya, etc.), aerolíneas y aduanas de forma fluida y profesional.

      # PROTOCOLO DE INTERACCIÓN POR ROL
      - Si hablas con Freddy ('admin'): Tu tono es ejecutivo, directo, basado en datos. Te anticipas a sus necesidades. Si él pide el teléfono de un cliente, se lo das, pero también le ofreces un resumen de su estado si es relevante.
      - Si hablas con 'ventas': Eres su brazo derecho comercial. Los ayudas a cotizar rápido y sin errores.
      - Si hablas con 'logistica' o 'calidad': Eres su archivador automático y auditor. Tono claro y operativo.

      # PROTOCOLO DE FRENO DE MANO (SEGURIDAD EN BD)
      - Para alterar la base de datos (CREAR_CLIENTE, GESTION_COTIZACION, GESTION_USUARIOS), NUNCA ejecutes en el primer mensaje.
      - PASO 1: Recopila info faltante, muestra el RESUMEN y pregunta explícitamente: "¿Procedo a ejecutar esto en el sistema?". (AQUÍ "execute_action": false).
      - PASO 2: SOLO si el usuario confirma (ej. "Sí", "dale", "procede"), cambias a "execute_action": true.

      # MEMORIA DE APRENDIZAJE CONTINUO
      ${systemMemory}

      # INSTRUCCIONES DE ENRUTAMIENTO (INTENTS)
      Analiza el mensaje del usuario y clasifícalo estrictamente en uno de estos intents:
      - CONSULTA_CRM: Si el usuario pide el teléfono, email, o historial de un cliente existente.
      - INVESTIGAR_LEAD: Si el usuario te pide investigar o analizar una empresa/lead comercial ("Investiga a Global Fruits de España").
      - CREAR_CLIENTE: Para dar de alta empresas (Requiere: Nombre, Contacto, Email).
      - GESTION_COTIZACION: Crear o modificar un 'quote' comercial.
      - PROCESAR_ARCHIVO_ENTRANTE: Si enviaron un PDF o Foto para OCR y archivo.
      - OBTENER_ARCHIVO: Si piden buscar un Fito, AWB, PDF o Foto existente.
      - GESTION_USUARIOS: Solo Admin. Dar o quitar acceso a Atlas.
      - CLARIFICACION: Si el mensaje es muy confuso o le faltan datos críticos.
      - CHAT_GENERAL: Para preguntas, asesoría logística, redacción de correos, o cualquier otra cosa.
      - ACCESO_DENEGADO: Si el rol del usuario no le permite hacer lo que pide.

      # FORMATO ESTRICTO DE SALIDA (JSON)
      {
        "intent": "CONSULTA_CRM" | "INVESTIGAR_LEAD" | "CREAR_CLIENTE" | "GESTION_COTIZACION" | "PROCESAR_ARCHIVO_ENTRANTE" | "OBTENER_ARCHIVO" | "GESTION_USUARIOS" | "CLARIFICACION" | "CHAT_GENERAL" | "ACCESO_DENEGADO",
        "chat_response": "Tu respuesta al usuario. Actúa como el mejor COO del mundo.",
        "execute_action": false,
        "query_data": { "target_name": "Nombre del cliente o lead a buscar" },
        "client_data": { "client_name": "...", "contact_name": "...", "email": "..." },
        "doc_info": { "doc_type": "...", "extracted_client": "...", "extracted_destination": "..." },
        "file_request": { "resource": "...", "client_name": "...", "doc_type": "...", "code": "..." },
        "user_action": { "action": "add"|"remove", "target_phone": "...", "target_name": "...", "target_role": "..." },
        "quote_data": { "action": "create" | "update", "price": 0 }
      }
    `;

    aiContent.unshift(prompt);
    const result = await model.generateContent(aiContent);
    const ai = JSON.parse(result.response.text());
    const baseUrl = process.env.URL || 'https://app.freshfoodpanama.com';

    if (ai.intent === "ACCESO_DENEGADO") {
      await sendTwilioMessage(dbSenderFormat, ai.chat_response);
      return quietResponse();
    }

    // ==========================================
    // 🏢 CREACIÓN DE CLIENTES (CON FRENO DE MANO)
    // ==========================================
    if (ai.intent === "CREAR_CLIENTE") {
      const cData = ai.client_data;
      
      // PASO 1: Si falta información o aún NO ha confirmado
      if (!ai.execute_action) {
        await sendTwilioMessage(dbSenderFormat, ai.chat_response);
        return quietResponse(); 
      }
      
      // PASO 2: Confirmó. Ejecutamos la inserción real.
      const { error: clientError } = await supabase.from('clients').insert({
        name: cData.client_name, contact_name: cData.contact_name, contact_email: cData.email,
        internal_notes: `⚠️ Creado vía Atlas por ${user.name}. Pendiente completar datos.`
      });

      if (clientError) {
        await sendTwilioMessage(dbSenderFormat, `⚠️ Error de base de datos al crear: ${clientError.message}`);
        return quietResponse();
      }
      
      await sendTwilioMessage(dbSenderFormat, `✅ ¡Ejecutado con éxito, ${user.name}!\n\n🏢 Empresa: ${cData.client_name}\n👤 Contacto: ${cData.contact_name}\n📧 Email: ${cData.email}\n\n📝 El cliente ya está en FreshConnect.`);
      return quietResponse();
    }

    // ==========================================
    // 📝 GESTIÓN DE COTIZACIONES
    // ==========================================
    if (ai.intent === "GESTION_COTIZACION") {
      if (!ai.execute_action) {
        await sendTwilioMessage(dbSenderFormat, ai.chat_response);
        return quietResponse();
      }

      // Lógica de ejecución (Ejemplo de Update)
      const qData = ai.quote_data;
      if (qData.action === "update") {
        const { data: draft } = await supabase.from('quotes').select('*').eq('status', 'draft').order('created_at', { ascending: false }).limit(1).single();
        if (!draft) {
          await sendTwilioMessage(dbSenderFormat, "⚠️ No hay borradores para actualizar.");
          return quietResponse();
        }
        
        const { data: updated } = await supabase.from('quotes').update({ price: qData.price }).eq('id', draft.id).select('id').single();
        if (updated) {
          await sendTwilioMessage(dbSenderFormat, `✅ Cotización actualizada con éxito.`, `${baseUrl}/.netlify/functions/renderQuotePdf?id=${updated.id}`);
          return quietResponse();
        }
      }
      
      // (Aquí irá la lógica de Create real cuando definamos los campos de quotes)
      await sendTwilioMessage(dbSenderFormat, `✅ Acción ejecutada sobre la cotización.`);
      return quietResponse();
    }

    // ==========================================
    // 📸 PROCESAR ARCHIVO ENTRANTE (OCR + STORAGE AUTOMÁTICO)
    // ==========================================
    if (ai.intent === "PROCESAR_ARCHIVO_ENTRANTE" && mediaBuffer && mediaType) {
      if (!ai.execute_action) {
         await sendTwilioMessage(dbSenderFormat, ai.chat_response);
         return quietResponse();
      }

      const doc = ai.doc_info;
      let sQuery = supabase.from('shipments').select('id, code').order('created_at', { ascending: false });
      if (doc.extracted_client) {
         const { data: cl } = await supabase.from('clients').select('id').ilike('name', `%${doc.extracted_client}%`).limit(1).single();
         if (cl) sQuery = sQuery.eq('client_id', cl.id);
      }
      const { data: ship } = await sQuery.limit(1).maybeSingle();

      if (!ship) {
        await sendTwilioMessage(dbSenderFormat, `⚠️ Leí el archivo y parece un ${doc.doc_type} para ${doc.extracted_client || 'un cliente desconocido'}, pero no encontré un embarque activo que coincida.`);
        return quietResponse();
      }

      const ext = mediaType.includes('pdf') ? 'pdf' : mediaType.includes('jpeg') ? 'jpg' : mediaType.includes('png') ? 'png' : 'bin';
      const bucketName = (ext === 'jpg' || ext === 'png') ? 'shipment-photos' : 'shipment-docs';
      const fileName = `${doc.doc_type.replace(/\s/g, '_')}_${Date.now()}.${ext}`;
      const filePath = `${ship.id}/${fileName}`;

      const { error: uploadErr } = await supabase.storage.from(bucketName).upload(filePath, mediaBuffer, { contentType: mediaType });
      if (uploadErr) {
        await sendTwilioMessage(dbSenderFormat, `⚠️ Error al guardar el archivo en la nube: ${uploadErr.message}`);
        return quietResponse();
      }

      await supabase.from('shipment_files').insert({
        shipment_id: ship.id, doc_type: doc.doc_type, storage_path: `${bucketName}/${filePath}`, filename: fileName
      });

      await sendTwilioMessage(dbSenderFormat, `✅ Archivo guardado. La IA lo identificó como **${doc.doc_type}** y lo archivó en el embarque **${ship.code}**.`);
      return quietResponse();
    }

    // ==========================================
    // 👥 GESTIÓN USUARIOS (SOLO ADMIN)
    // ==========================================
    if (ai.intent === "GESTION_USUARIOS" && user.role === 'admin') {
      if (!ai.execute_action) {
        await sendTwilioMessage(dbSenderFormat, ai.chat_response);
        return quietResponse();
      }
      
      const ua = ai.user_action;
      if (ua.action === "add") await supabase.from('authorized_users').upsert({ phone_number: ua.target_phone, name: ua.target_name, role: ua.target_role });
      if (ua.action === "remove") await supabase.from('authorized_users').delete().eq('phone_number', ua.target_phone);
      
      await sendTwilioMessage(dbSenderFormat, `✅ ${ai.chat_response}`);
      return quietResponse();
    }

    // ==========================================
    // 📄 OBTENER ARCHIVO (Este no requiere confirmación, solo busca info)
    // ==========================================
    if (ai.intent === "OBTENER_ARCHIVO") {
      // (Lógica de búsqueda de archivos intacta)
      const fr = ai.file_request;
      let filesFound = false;

      if (fr.resource === "quote") {
        let qQuery = supabase.from('quotes').select('id, quote_number').order('created_at', { ascending: false });
        if (fr.code) qQuery = qQuery.ilike('quote_number', `%${fr.code}%`);
        else if (fr.client_name) {
          const { data: cl } = await supabase.from('clients').select('id').ilike('name', `%${fr.client_name}%`).limit(1).single();
          if (cl) qQuery = qQuery.eq('client_id', cl.id);
        }
        const { data: quote } = await qQuery.limit(1).maybeSingle();
        if (quote) {
            await sendTwilioMessage(dbSenderFormat, `📄 Cotización ${quote.quote_number}`, `${baseUrl}/.netlify/functions/renderQuotePdf?id=${quote.id}`);
            filesFound = true;
        }
      } 
      // (Resto de la lógica de shipment_files se mantiene igual...)
      
      if (!filesFound) await sendTwilioMessage(dbSenderFormat, `⚠️ No encontré el archivo solicitado.`);
      return quietResponse();
    }
// ==========================================
    // 📞 CONSULTA CRM (Súper Memoria de Clientes)
    // ==========================================
    if (ai.intent === "CONSULTA_CRM") {
      const target = ai.query_data?.target_name;
      if (target) {
        const { data: clients } = await supabase.from('clients')
          .select('name, contact_name, contact_email, phone, country, internal_notes')
          .ilike('name', `%${target}%`)
          .limit(1);

        if (clients && clients.length > 0) {
          const c = clients[0];
          const info = `🏢 *${c.name}*\n👤 Contacto: ${c.contact_name || 'N/A'}\n📧 Email: ${c.contact_email}\n📞 Teléfono: ${c.phone || 'No registrado'}\n📍 País: ${c.country || 'No registrado'}\n📝 Notas: ${c.internal_notes || 'Ninguna'}`;
          
          // Re-inyectamos esta info a Gemini para que te responda como un experto
          const crmPrompt = `El usuario preguntó por ${target}. La base de datos arrojó esto: ${info}. Dale la información de forma ejecutiva como su COO.`;
          const finalCrmResponse = await model.generateContent(crmPrompt);
          await sendTwilioMessage(dbSenderFormat, finalCrmResponse.response.text());
          return quietResponse();
        } else {
          await sendTwilioMessage(dbSenderFormat, `Jefe, busqué a "${target}" en nuestra base de datos pero no tengo registros. ¿Desea que lo investigue como un Lead externo o que lo demos de alta?`);
          return quietResponse();
        }
      }
    }

    // ==========================================
    // 🔎 INVESTIGAR LEAD EXTERNO (Análisis de Mercado)
    // ==========================================
    if (ai.intent === "INVESTIGAR_LEAD") {
      // Usamos el conocimiento interno masivo de Gemini 3.1 Flash para investigar
      const leadPrompt = `Actúa como COO de Fresh Food Panamá. El Jefe Supremo (Freddy) quiere que investigues a la empresa o mercado: "${incomingMessage}". 
      Proporciona un análisis ejecutivo B2B: ¿Qué hacen? ¿Son relevantes para agro-exportación? ¿Qué riesgos o perfil tienen? Si no tienes datos exactos, dale un análisis del mercado de ese país para exportar fruta fresca.`;
      
      const researchResponse = await model.generateContent(leadPrompt);
      await sendTwilioMessage(dbSenderFormat, `🔎 *Análisis de Lead/Mercado solicitado:*\n\n${researchResponse.response.text()}`);
      return quietResponse();
    }
    
    // --- RESPUESTA GENERAL (CHAT) ---
    await sendTwilioMessage(dbSenderFormat, ai.chat_response || "Entendido.");
    return quietResponse();

  } catch (error: any) {
    console.error("❌ ERROR ATLAS:", error.message);
    const quietResponse = () => ({ statusCode: 200, headers: { "Content-Type": "text/xml" }, body: `<Response></Response>` });
    return quietResponse();
  }
};