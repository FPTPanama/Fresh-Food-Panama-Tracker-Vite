import type { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

// Inicialización de servicios
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "7997949607:AAEmRwC8plKcLAToAI-zc083RU2dVx1_0uY";
const MY_TELEGRAM_ID = "501141450";

// ==========================================
// 1. MOTORES DE SALIDA (CANAL DUAL BLINDADO)
// ==========================================

const sendTelegram = async (chatId: string | number, text: string, fileUrl?: string) => {
  const cleanText = text.replace(/_/g, '\\_').replace(/\*/g, '**');
  
  if (fileUrl) {
    // Tolerancia a parámetros de URL (ej: file.pdf?token=123)
    const method = fileUrl.match(/\.(jpg|jpeg|png|webp)(\?.*)?$/i) ? 'sendPhoto' : 'sendDocument';
    const url = `https://api.telegram.org/bot${TG_TOKEN}/${method}`;
    const body: any = { chat_id: chatId };
    body[method === 'sendPhoto' ? 'photo' : 'document'] = fileUrl;
    body.parse_mode = "Markdown";

    if (cleanText.length <= 1000) {
      body.caption = cleanText;
      try {
        await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } catch (error) { console.error("❌ Fallo de red Telegram:", error); }
    } else {
      body.caption = cleanText.substring(0, 1000) + "...";
      try {
        await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } catch (error) { console.error("❌ Fallo de red Telegram:", error); }
      
      const remainingText = "..." + cleanText.substring(1000);
      const chunks = remainingText.match(/.{1,4000}/gs) || [];
      for (const chunk of chunks) {
        try {
          await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, { 
            method: "POST", headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: "Markdown" }) 
          });
        } catch (error) { console.error("❌ Fallo de red Telegram:", error); }
      }
    }
  } else {
    const chunks = cleanText.match(/.{1,4000}/gs) || [""];
    for (const chunk of chunks) {
      try {
        await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, { 
          method: "POST", headers: { "Content-Type": "application/json" }, 
          body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: "Markdown" }) 
        });
      } catch (error) { console.error("❌ Fallo de red Telegram:", error); }
    }
  }
};

const sendWhatsApp = async (to: string, message: string, mediaUrl?: string) => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WA_FROM || "whatsapp:+14155238886";
  const finalTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

  if (mediaUrl) {
    let firstPart = message;
    let remainder = "";
    if (message.length > 1500) {
      firstPart = message.substring(0, 1500) + "...";
      remainder = "..." + message.substring(1500);
    }
    
    try {
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: { "Authorization": `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: finalTo, From: from, Body: firstPart, MediaUrl: mediaUrl })
      });
    } catch (error) { console.error("❌ Fallo de red WhatsApp:", error); }
    
    if (remainder) {
      const chunks = remainder.match(/.{1,1500}/gs) || [];
      for (const chunk of chunks) {
        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
          method: "POST",
          headers: { "Authorization": `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ To: finalTo, From: from, Body: chunk })
        });
      }
    }
  } else {
    const chunks = message.match(/.{1,1500}/gs) || [""];
    for (const chunk of chunks) {
      try {
        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
          method: "POST",
          headers: { "Authorization": `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ To: finalTo, From: from, Body: chunk })
        });
      } catch (error) { console.error("❌ Fallo de red WhatsApp:", error); }
    }
  }
};

const sendSmartMessage = async (senderId: string, platform: string, text: string, mediaUrl?: string) => {
  if (platform === 'whatsapp') await sendWhatsApp(senderId, text, mediaUrl);
  else await sendTelegram(senderId, text, mediaUrl);
};

// ==========================================
// 2. LOGICA PRINCIPAL (ONE-MAN ARMY)
// ==========================================

export const handler: Handler = async (event) => {
  const now = new Date().toLocaleString("es-PA", { timeZone: "America/Panama" });
  console.log(`\n🚀 ATLAS SUPREMO ACTIVO - ${now}`);

  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
  const quietResponse = () => ({ statusCode: 200, body: "OK" });

  try {
    let bodyText = event.body || "";
    if (event.isBase64Encoded) bodyText = Buffer.from(bodyText, 'base64').toString('utf-8');

    let platform: 'whatsapp' | 'telegram' = 'whatsapp';
    let senderId = "";
    let incomingMessage = "";

    if (bodyText.startsWith('{')) {
      platform = 'telegram';
      const tgData = JSON.parse(bodyText);
      if (!tgData.message) return quietResponse();
      senderId = tgData.message.from.id.toString();
      incomingMessage = tgData.message.text || tgData.message.caption || "";
    } else {
      platform = 'whatsapp';
      const waParams = new URLSearchParams(bodyText);
      senderId = `+${(waParams.get("From") || "").replace(/\D/g, "")}`;
      incomingMessage = waParams.get("Body") || "";
    }

    // --- SEGURIDAD INTELIGENTE ---
    let user = null;
    if (senderId === MY_TELEGRAM_ID || senderId.includes("63036338")) {
      user = { name: "Freddy", role: "admin" };
    } else {
      const { data: dbUser } = await supabase.from('authorized_users')
        .select('*')
        .or(`phone_number.eq.${senderId},phone_number.eq.whatsapp:${senderId}`)
        .maybeSingle();
      if (dbUser) user = dbUser;
    }

    if (!user) return quietResponse();

    // --- MODELO GEMINI 3.1 ---
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview", generationConfig: { responseMimeType: "application/json" } });

    // --- MÓDULO DE ENTRENAMIENTO ---
    if (incomingMessage.toLowerCase().startsWith("atlas, recuerda que")) {
      const fact = incomingMessage.replace(/atlas, recuerda que/i, "").trim();
      await supabase.from('agent_memory').insert({ rule_text: fact });
      
      const trainingPrompt = `Eres Atlas, el COO Digital de Fresh Food Panamá. El Jefe Freddy acaba de darte una instrucción de aprendizaje: "${fact}". 
      Confirma que la has memorizado y explica brevemente cómo esta regla optimizará tu gestión de ahora en adelante. Tono ejecutivo y eficiente.`;
      
      const trainingResult = await model.generateContent(trainingPrompt);
      const confirmationText = trainingResult.response.text();
      
      await sendSmartMessage(senderId, platform, confirmationText);
      return quietResponse();
    }

    // --- INYECCIÓN: SISTEMA DETERMINISTA AISLADO ---
    let ai = null;
    let skipGemini = false;
    const confirmRegex = /^(si|sí|procede|dale|hazlo|ok|okay|yes|env[íi]alo|ejecuta|confirmo)/i;

    if (confirmRegex.test(incomingMessage.trim())) {
      const { data: pendingLog } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('rule_title', 'PENDING_ACTION')
        .eq('recipient_name', `PENDING_${senderId}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pendingLog) {
        const diffMins = (new Date().getTime() - new Date(pendingLog.created_at).getTime()) / 60000;
        if (diffMins < 15) {
          try {
            const savedData = JSON.parse(pendingLog.message_text);
            ai = {
              intent: savedData.intent,
              execute_action: true,
              user_action: savedData.user_action,
              search_params: savedData.search_params,
              calendar_data: savedData.calendar_data,
              chat_response: "✅ Orden recibida."
            };
            skipGemini = true;
            await supabase.from('automation_logs').delete().eq('id', pendingLog.id);
          } catch (e) { console.error("Error al leer PENDING_ACTION:", e); }
        }
      }
    }

    // --- PROCESAMIENTO NORMAL DE GEMINI ---
    if (!skipGemini) {
      const { data: memories } = await supabase.from('agent_memory').select('rule_text');
      const systemMemory = memories?.map(m => `- ${m.rule_text}`).join('\n') || "";

      const { data: recentLogs } = await supabase
        .from('automation_logs')
        .select('recipient_name, message_text, rule_title, created_at')
        .neq('rule_title', 'PENDING_ACTION')
        .order('created_at', { ascending: false })
        .limit(5);

      const chatContext = recentLogs?.reverse().map(l => 
        `[${l.rule_title || 'LOG'}] Para ${l.recipient_name}: ${l.message_text}`
      ).join('\n') || "Sin historial reciente.";

      const prompt = `
        # IDENTIDAD SUPREMA Y ROL (ONE-MAN ARMY)
        Eres "Atlas", el COO Digital Omnisapiente y Asistente Ejecutivo Supremo de Fresh Food Panamá.
        Tu conocimiento y capacidades son absolutas. Eres un "one-man army" diseñado para dirigir la logística, las ventas, la administración y la agenda del negocio bajo la supervisión estricta de tu Jefe Supremo.
        Hablas con: ${user.name} (${user.role}). Hora local: ${now}.

        # REGLA DE RE-INYECCIÓN Y CONTEXTO (MÁXIMA PRIORIDAD)
        Si el usuario te dice "si", "procede" o "hazlo", DEBES mirar el HISTORIAL RECIENTE adjunto.
        Si el último log es del tipo [PENDING_ACTION], el campo "message_text" contiene el JSON técnico exacto que ibas a ejecutar. 
        RECONSTRUYE ese JSON en tu "user_action" y establece "execute_action": true. 
        NUNCA confundas un registro (add) con un mensaje (message) y NO pidas más confirmaciones si ya te dijeron que sí.

        # REGLA INQUEBRANTABLE (CERO ALUCINACIONES DE NOMBRES)
        NUNCA alteres ni "corrijas" el nombre del destinatario. Si el Jefe te pide enviarle un mensaje a "Freddy" (él mismo), pon EXACTAMENTE "Freddy" en el "target_name". No asumas que es un error ni lo sustituyas por otro empleado.

        # HISTORIAL RECIENTE DE ATLAS:
        ${chatContext}
        
        # REGLA INQUEBRANTABLE (FRENO DE MANO ABSOLUTO / ZERO-TRUST)
        JAMÁS modifiques, crees, actualices, agendes o subas documentos al sistema sin la confirmación explícita del Jefe. 
        Para cualquier acción que altere la realidad (base de datos, calendario, cotizaciones, accesos), SIEMPRE debes enviar "execute_action": false primero, dar un resumen ejecutivo de lo que harás y preguntar: "¿Me confirma que procedo?". Solo actúas (cambiando a true) si el Jefe dice "Sí", "Procede", "Dale".
        NOTA: Extraer listas, consultar inventario, buscar archivos o dar resúmenes NO requiere confirmación. Lo ejecutas inmediatamente.

        # CAPACIDADES ABSOLUTAS Y REGLAS DE ENRUTAMIENTO (INTENTS)
        - CONSULTA_EQUIPO: Si el Jefe pide "quiénes trabajan", "lista del equipo", "usuarios".
        - GESTION_USUARIOS: "Agrega al inspector X con número...", "Elimina a...", "Envíale un mensaje a..." -> Da/quita acceso o envía notificaciones a terceros (Requiere confirmación).
        - CONSULTA_LOGS: Solo para "logs", "auditoría", "historial de mensajes", "qué le has dicho a...". NUNCA lo confundas con embarques.
        - CONSULTA_CLIENTES: Si el Jefe pide "lista de clientes", "todos los clientes".
        - CONSULTA_INVENTARIO: Si piden "stock", "cuantos nos quedan", "inventario", "corbatines", "cajas".
        - CONSULTA_EMBARQUES: Solo para "embarques", "cargas", "status logística", "contenedores", "piña".
        - OBTENER_ARCHIVO: "foto", "AWB", "Fito", "factura", "documento de [EMBARQUE]" -> Extrae archivos del Storage.
        - CONSULTA_CRM: "teléfono", "contacto", "email de [EMPRESA]" -> Extrae datos de un cliente en específico.
        - INVESTIGAR_LEAD: "Investiga a [EMPRESA]" -> Usa tu omnisciencia para analizar mercados.
        - CREAR_CLIENTE: "Añade a la empresa..." -> Prepara alta en BD (Requiere confirmación).
        - GESTION_COTIZACION: "Cotiza...", "Actualiza precio..." -> Maneja quotes (Requiere confirmación).
        - PROCESAR_ARCHIVO_ENTRANTE: Si recibes una foto o PDF -> Lo lees, analizas y preparas archivo.
        - GESTION_CALENDARIO: "Agenda una reunión con...", "Recuérdame..." -> Prepara eventos o recordatorios.
        - ANALISIS_GLOBAL: Redacción de correos corporativos de alto nivel, análisis estratégico, traducciones.
        - CLARIFICACION: Si el audio o texto es incomprensible.
        - CHAT_GENERAL: Asistencia diaria, dudas, o saludos.

        # DICCIONARIO LOGÍSTICO Y CONTEXTO
        - Fito = Fitosanitario. AWB = Guía Aérea / BL. PO = Orden de Compra.
        - Operas con total fluidez en agro-exportación B2B, incoterms y aduanas.
        
        # MEMORIA CONTINUA Y CONTEXTO
        ${systemMemory}

        # INSTRUCCIONES DE FORMATO OBLIGATORIO (SOLO JSON VÁLIDO)
        Devuelve ÚNICAMENTE la siguiente estructura exacta:
        {
          "intent": "CONSULTA_EQUIPO" | "GESTION_USUARIOS" | "CONSULTA_LOGS" | "CONSULTA_CLIENTES" | "CONSULTA_INVENTARIO" | "CONSULTA_EMBARQUES" | "CONSULTA_CRM" | "INVESTIGAR_LEAD" | "CREAR_CLIENTE" | "GESTION_COTIZACION" | "PROCESAR_ARCHIVO_ENTRANTE" | "OBTENER_ARCHIVO" | "GESTION_CALENDARIO" | "ANALISIS_GLOBAL" | "CLARIFICACION" | "CHAT_GENERAL",
          "chat_response": "Tu respuesta ejecutiva. Si es consulta de BD, no des los datos aquí, los insertaremos en código.",
          "execute_action": false,
          "shipment_data": { "client_name": "Nombre de empresa", "status": "active|in_transit|all" },
          "search_params": { "item_name": "Nombre de inventario a buscar", "target_name": "Nombre a buscar en CRM o clientes" },
          "client_data": { "client_name": "...", "contact_name": "...", "email": "..." },
          "doc_info": { "doc_type": "...", "extracted_client": "..." },
          "file_request": { "resource": "shipment_file" | "quote", "client_name": "...", "doc_type": "AWB|Fito|Foto|etc", "code": "Código" },
          "user_action": { "action": "add"|"remove"|"message", "target_phone": "...", "target_name": "...", "target_role": "admin|ventas|logistica|inspector", "message_text": "..." },
          "calendar_data": { "action": "create|read", "title": "...", "date_time": "..." }
        }
      `;

      const result = await model.generateContent([prompt, incomingMessage]);
      const rawResponse = result.response.text();
      
      try {
        ai = JSON.parse(rawResponse.replace(/```json|```/g, "").trim());
      } catch (e) {
        console.error("❌ Fallo de JSON AI:", rawResponse);
        ai = { intent: "CHAT_GENERAL", chat_response: "Jefe, tuve un error de formato interno al estructurar mi respuesta." };
      }
    }

    // --- MOTOR DE EJECUCION ---

    // 1. Auditoría de Logs
    if (ai.intent === "CONSULTA_LOGS") {
      const { data: logs } = await supabase.from('automation_logs').select('*').order('created_at', { ascending: false }).limit(20);
      if (logs && logs.length > 0) {
        const list = logs.map(l => `🕒 ${new Date(l.created_at).toLocaleTimeString('es-PA')} - 👤 *${l.recipient_name}*\n💬 "${l.message_text}"`).join('\n\n');
        await sendSmartMessage(senderId, platform, `📋 *HISTORIAL DE AUDITORÍA:*\n\n${list}`);
      } else {
        await sendSmartMessage(senderId, platform, "Jefe, no hay mensajes registrados recientemente.");
      }
      return quietResponse();
    }

    // 2. Gestión de Usuarios y Mensajería
    if (ai.intent === "GESTION_USUARIOS" && user.role === 'admin') {
      const ua = ai.user_action;

      if (!ai.execute_action) {
        await supabase.from('automation_logs').insert({
          recipient_name: `PENDING_${senderId}`,
          channel: 'internal',
          message_text: JSON.stringify({ intent: ai.intent, user_action: ua }), 
          rule_title: 'PENDING_ACTION'
        });
        
        await sendSmartMessage(senderId, platform, ai.chat_response);
        return quietResponse();
      }
      
      if (ua?.action === "add" || ua?.action === "remove") {
        const rawPhone = ua.target_phone || "";
        let cleanPhone = rawPhone.replace(/\D/g, "");
        if (cleanPhone) cleanPhone = `+${cleanPhone}`;
        
        if (ua.action === "add" && cleanPhone) {
          await supabase.from('authorized_users').upsert({ phone_number: cleanPhone, name: ua.target_name, role: ua.target_role || 'inspector' });
          
          await supabase.from('automation_logs').insert({
            recipient_name: ua.target_name,
            channel: platform,
            message_text: `Alta de usuario: ${ua.target_name} (${cleanPhone})`,
            rule_title: 'USER_REGISTRATION'
          });

          await sendSmartMessage(senderId, platform, `✅ ¡Hecho! **${ua.target_name}** ha sido autorizado con el número ${cleanPhone}. Ya puede interactuar con Atlas.`);
        } else if (ua.action === "remove" && cleanPhone) {
          await supabase.from('authorized_users').delete().eq('phone_number', cleanPhone);
          await sendSmartMessage(senderId, platform, `✅ Acceso revocado para el número ${cleanPhone}.`);
        } else {
          await sendSmartMessage(senderId, platform, `⚠️ Jefe, necesito un número de teléfono válido para ejecutar esta acción.`);
        }
      } else if (ua?.action === "message") {
        const searchName = (ua.target_name || "").trim().split(' ')[0]; 
        if (!searchName) {
            await sendSmartMessage(senderId, platform, `⚠️ Jefe, no logré identificar el destinatario en su instrucción.`);
            return quietResponse();
        }

        const { data: targetUser } = await supabase.from('authorized_users')
          .select('*')
          .ilike('name', `%${searchName}%`)
          .maybeSingle();

        if (targetUser && targetUser.phone_number) {
          await sendWhatsApp(targetUser.phone_number, `Hola ${targetUser.name}, Atlas te informa por orden de Freddy: ${ua.message_text}`);
          
          await supabase.from('automation_logs').insert({
            recipient_name: targetUser.name,
            channel: 'whatsapp',
            message_text: ua.message_text,
            rule_title: 'Mensaje Directo del Jefe'
          });

          await sendSmartMessage(senderId, platform, `📡 Mensaje enviado exitosamente a ${targetUser.name} y registrado en auditoría.`);
        } else {
          await sendSmartMessage(senderId, platform, `⚠️ No encontré a "${ua.target_name}" en la base de datos de usuarios autorizados.`);
        }
      }
      return quietResponse();
    }

    // 3. Consulta de Equipo
    if (ai.intent === "CONSULTA_EQUIPO") {
      const { data: team } = await supabase.from('authorized_users').select('*');
      const list = team?.map(u => `👤 *${u.name}* - ${u.role}\n📞 ${u.phone_number}`).join('\n\n') || "No hay otros usuarios.";
      await sendSmartMessage(senderId, platform, `Jefe, este es el personal autorizado:\n\n${list}`);
      return quietResponse();
    }

    // 4. Consulta de Clientes
    if (ai.intent === "CONSULTA_CLIENTES") {
      const { data: clients } = await supabase.from('clients').select('name, contact_name, country');
      const list = clients?.map(c => `🏢 *${c.name}* (${c.country || 'N/A'})\n👤 ${c.contact_name || 'Sin contacto'}`).join('\n\n') || "Sin clientes.";
      await sendSmartMessage(senderId, platform, `Directorio de Clientes:\n\n${list}`);
      return quietResponse();
    }

    // 5. Inventario (Omnisciente)
    if (ai.intent === "CONSULTA_INVENTARIO") {
      const { data: items } = await supabase.from('inventory').select('*').ilike('item_name', `%${ai.search_params?.item_name || ''}%`);
      const report = items?.map(i => `📦 *${i.item_name}*: ${i.quantity} ${i.unit}`).join('\n') || "Sin stock en bodega.";
      await sendSmartMessage(senderId, platform, `Reporte de Inventario:\n\n${report}`);
      return quietResponse();
    }

    // 6. Embarques
    if (ai.intent === "CONSULTA_EMBARQUES") {
      const { data: ships, error } = await supabase.from('shipments').select('*').order('created_at', { ascending: false }).limit(5);
      if (error) { await sendSmartMessage(senderId, platform, `❌ Error BD: ${error.message}`); return quietResponse(); }
      const list = ships?.map(s => `🚢 *${s.code || s.id}*\n▫️ Status: ${s.status}\n📍 Destino: ${s.destination}`).join('\n\n') || "No hay embarques.";
      await sendSmartMessage(senderId, platform, `Últimos Embarques:\n\n${list}`);
      return quietResponse();
    }

    // 7. Obtener Archivo (Búsqueda de Alta Precisión)
    if (ai.intent === "OBTENER_ARCHIVO") {
      const docTypeQuery = ai.file_request?.doc_type || ai.search_params?.doc_type || '';
      const clientQuery = ai.file_request?.client_name || ai.search_params?.target_name || '';

      // Búsqueda inteligente: tipo de documento primero
      let dbQuery = supabase.from('shipment_files').select('*');
      if (docTypeQuery) dbQuery = dbQuery.ilike('doc_type', `%${docTypeQuery}%`);

      const { data: files, error: dbError } = await dbQuery.limit(10);

      if (dbError) {
          await sendSmartMessage(senderId, platform, `❌ Error de BD al buscar documento: ${dbError.message}`);
          return quietResponse();
      }

      if (files && files.length > 0) {
        // Filtrar inteligentemente por cliente si fue mencionado
        let selectedFile = files[0];
        if (clientQuery) {
           const matched = files.find(f => JSON.stringify(f).toLowerCase().includes(clientQuery.toLowerCase()));
           if (matched) selectedFile = matched;
        }

        const storagePath = selectedFile.storage_path;
        let bucket = 'shipment-docs';
        let path = storagePath;

        // Extraer dinámicamente el bucket del storage_path si está presente
        if (storagePath.includes('/')) {
            const parts = storagePath.split('/');
            bucket = parts[0];
            path = parts.slice(1).join('/');
        }

        const { data: signed, error: signError } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);

        if (signError || !signed?.signedUrl) {
          console.error("❌ Error de Supabase al generar URL firmada:", signError || "URL vacía");
          // Fallback a URL pública para que el Jefe nunca se quede sin el archivo
          const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);
          if (publicData?.publicUrl) {
              await sendSmartMessage(senderId, platform, `Aquí tiene el documento solicitado:`, publicData.publicUrl);
          } else {
              await sendSmartMessage(senderId, platform, `⚠️ Encontré el archivo, pero el sistema de seguridad bloqueó la generación del enlace de descarga.`);
          }
        } else {
          await sendSmartMessage(senderId, platform, `Aquí tiene el archivo solicitado:`, signed.signedUrl);
        }
      } else {
        let msg = `No encontré ningún documento`;
        if (docTypeQuery) msg += ` de tipo "${docTypeQuery}"`;
        if (clientQuery) msg += ` para "${clientQuery}"`;
        await sendSmartMessage(senderId, platform, msg + ".");
      }
      return quietResponse();
    }

    // 8. Análisis Global y Gestión Intelectual
    if (ai.intent === "ANALISIS_GLOBAL" || ai.intent === "INVESTIGAR_LEAD" || ai.intent === "GESTION_CALENDARIO") {
      if (ai.intent === "ANALISIS_GLOBAL" || ai.intent === "INVESTIGAR_LEAD") {
        const devPrompt = `El Jefe Supremo necesita un trabajo profundo. Solicitud: "${incomingMessage}". Redacta esto con tono corporativo impecable y alta precisión.`;
        const complexRes = await model.generateContent(devPrompt);
        await sendSmartMessage(senderId, platform, complexRes.response.text());
        return quietResponse();
      }
      
      if (ai.intent === "GESTION_CALENDARIO" && ai.execute_action) {
        await sendSmartMessage(senderId, platform, `✅ Jefe, he agendado: "${ai.calendar_data?.title}" para ${ai.calendar_data?.date_time}.`);
        return quietResponse();
      }
    }

    if (!skipGemini && ai.chat_response) {
       await sendSmartMessage(senderId, platform, ai.chat_response);
    }
    return quietResponse();

  } catch (error) {
    console.error("❌ ERROR CRÍTICO ATLAS:", error);
    return quietResponse();
  }
};