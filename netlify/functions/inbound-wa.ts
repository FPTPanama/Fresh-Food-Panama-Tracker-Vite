import type { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// --- 1. MOTOR DE ENVÍO TWILIO ---
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

  const quietResponse = (message?: string) => {
    const xml = message 
      ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`
      : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
    return { statusCode: 200, headers: { "Content-Type": "text/xml" }, body: xml };
  };

  try {
    const bodyParams = new URLSearchParams(event.body || "");
    const senderNumber = bodyParams.get("From")?.replace("whatsapp:", "") || "";
    const incomingMessage = bodyParams.get("Body") || "";
    const mediaUrl = bodyParams.get("MediaUrl0");
    const mediaType = bodyParams.get("MediaContentType0");

    const normalizedSender = senderNumber.startsWith('+') ? senderNumber : `+${senderNumber}`;
    const dbSenderFormat = `whatsapp:${normalizedSender}`;

    // --- 2. ESCUDO DE SEGURIDAD RBAC (SUPABASE) ---
    const { data: user, error: userError } = await supabase
      .from('authorized_users')
      .select('name, role')
      .eq('phone_number', dbSenderFormat)
      .single();

    if (!user || userError) {
      console.warn(`🚨 INTRUSO BLOQUEADO: ${dbSenderFormat}`);
      return quietResponse(); 
    }

    console.log(`\n📩 IN: "${incomingMessage}" de ${user.name} (Rol: ${user.role})`);

    // --- 3. PREPARACIÓN MULTIMODAL (Audio, PDFs, Fotos) ---
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.1-flash-lite-preview", 
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 } 
    });

    let aiContent: any[] = [];
    let mediaBuffer: ArrayBuffer | null = null;
    
    if (mediaUrl) {
      const mediaResponse = await fetch(mediaUrl);
      mediaBuffer = await mediaResponse.arrayBuffer();
      aiContent.push({
        inlineData: { data: Buffer.from(mediaBuffer).toString("base64"), mimeType: mediaType }
      });
      aiContent.push(incomingMessage || "Analiza este archivo (PDF/Foto) o escucha este Audio y ejecuta la acción según mi rol.");
    } else {
      if (!incomingMessage) return quietResponse();
      aiContent.push(incomingMessage);
    }

    // --- 4. CEREBRO DE ATLAS ---
    const { data: memories } = await supabase.from('agent_memory').select('rule_text');
    const systemMemory = memories?.map(m => `- ${m.rule_text}`).join('\n') || "";

    const prompt = `
      Te llamas "Atlas", el Agente Operativo B2B de Fresh Food Panamá.
      Hablas con: ${user.name} (Rol: '${user.role}'). El Jefe Supremo es Freddy García.

      MEMORIA DE REGLAS:
      ${systemMemory}

      DICCIONARIO LOGÍSTICO:
      - Fito = Fitosanitario. AWB = Guía Aérea. EUR1 = Certificado de Origen. Pics = Fotos.

      REGLAS POR ROL:
      - 'admin': Todo.
      - 'ventas': CREAR_CLIENTE, GESTION_COTIZACION, OBTENER_ARCHIVO.
      - 'logistica': PROCESAR_ARCHIVO_ENTRANTE, OBTENER_ARCHIVO.
      - 'calidad': SOLO envía fotos o audios de inspección (PROCESAR_ARCHIVO_ENTRANTE).
      
      ACCIONES PARA EL MODELO:
      - SI EL USUARIO ENVIÓ UN AUDIO (Nota de voz): Escucha la instrucción que te dio y clasifícala en CREAR_CLIENTE, GESTION_COTIZACION, etc.
      - SI EL USUARIO ENVIÓ UN PDF O FOTO DOCUMENTAL: Haz OCR. Extrae el tipo de documento (AWB, Factura, Fito), el Cliente (Consignatario) y el Destino. Usa el intent PROCESAR_ARCHIVO_ENTRANTE.

      ESTRUCTURA JSON DE RESPUESTA ESTRICTA:
      {
        "intent": "CREAR_CLIENTE" | "GESTION_USUARIOS" | "OBTENER_ARCHIVO" | "GESTION_COTIZACION" | "PROCESAR_ARCHIVO_ENTRANTE" | "CHAT_GENERAL" | "ACCESO_DENEGADO",
        "chat_response": "Respuesta natural",
        "doc_info": { "doc_type": "Fitosanitario | AWB | Foto_Inspeccion", "extracted_client": "...", "extracted_destination": "..." },
        "client_data": { "ready": boolean, "client_name": "...", "contact_name": "...", "email": "..." },
        "file_request": { "resource": "quote" | "shipment_file", "client_name": "...", "doc_type": "...", "code": "..." },
        "user_action": { "action": "add"|"remove", "target_phone": "whatsapp:+...", "target_name": "...", "target_role": "..." }
      }
    `;

    aiContent.unshift(prompt);
    const result = await model.generateContent(aiContent);
    const ai = JSON.parse(result.response.text());
    const baseUrl = process.env.URL || 'https://app.freshfoodpanama.com';

    if (ai.intent === "ACCESO_DENEGADO") return quietResponse(ai.chat_response);

    // ==========================================
    // 📸 PROCESAR ARCHIVO ENTRANTE (OCR + STORAGE AUTOMÁTICO)
    // ==========================================
    if (ai.intent === "PROCESAR_ARCHIVO_ENTRANTE" && mediaBuffer && mediaType) {
      const doc = ai.doc_info;
      
      // 1. Buscar a qué cliente/embarque pertenece según lo que la IA leyó (OCR)
      let sQuery = supabase.from('shipments').select('id, code').order('created_at', { ascending: false });
      if (doc.extracted_client) {
         const { data: cl } = await supabase.from('clients').select('id').ilike('name', `%${doc.extracted_client}%`).limit(1).single();
         if (cl) sQuery = sQuery.eq('client_id', cl.id);
      }
      const { data: ship } = await sQuery.limit(1).maybeSingle();

      if (!ship) {
        return quietResponse(`⚠️ Leí el archivo y parece un ${doc.doc_type} para ${doc.extracted_client || 'un cliente desconocido'}, pero no encontré un embarque activo que coincida.`);
      }

      // 2. Determinar extensión y bucket
      const ext = mediaType.includes('pdf') ? 'pdf' : mediaType.includes('jpeg') ? 'jpg' : mediaType.includes('png') ? 'png' : 'bin';
      const bucketName = (ext === 'jpg' || ext === 'png') ? 'shipment-photos' : 'shipment-docs';
      const fileName = `${doc.doc_type.replace(/\\s/g, '_')}_${Date.now()}.${ext}`;
      const filePath = `${ship.id}/${fileName}`;

      // 3. Subir archivo al Storage de Supabase
      const { error: uploadErr } = await supabase.storage.from(bucketName).upload(filePath, mediaBuffer, { contentType: mediaType });
      
      if (uploadErr) return quietResponse(`⚠️ Error al guardar el archivo en la nube: ${uploadErr.message}`);

      // 4. Registrar en la tabla shipment_files
      await supabase.from('shipment_files').insert({
        shipment_id: ship.id,
        doc_type: doc.doc_type,
        storage_path: `${bucketName}/${filePath}`,
        filename: fileName
      });

      return quietResponse(`✅ ${user.name}, archivo guardado. La IA lo identificó como **${doc.doc_type}** y lo archivó automáticamente en el embarque **${ship.code}**.`);
    }

    // ==========================================
    // 🏢 CREACIÓN DE CLIENTES (FLUJO DE VERIFICACIÓN)
    // ==========================================
    if (ai.intent === "CREAR_CLIENTE") {
      const cData = ai.client_data;
      if (!cData.ready) return quietResponse(ai.chat_response); 
      
      const { error: clientError } = await supabase.from('clients').insert({
        name: cData.client_name, contact_name: cData.contact_name, contact_email: cData.email,
        internal_notes: `⚠️ Creado vía Atlas por ${user.name}. Pendiente completar datos.`
      });

      if (clientError) return quietResponse(`⚠️ Error al crear: ${clientError.message}`);
      return quietResponse(`✅ ¡Listo!\n🏢 Empresa: ${cData.client_name}\n👤 Contacto: ${cData.contact_name}\n📧 Email: ${cData.email}\n📝 Nota: Faltan datos fiscales.`);
    }

    // ==========================================
    // 👥 GESTIÓN USUARIOS (SOLO ADMIN)
    // ==========================================
    if (ai.intent === "GESTION_USUARIOS" && user.role === 'admin') {
      const ua = ai.user_action;
      if (ua.action === "add") await supabase.from('authorized_users').upsert({ phone_number: ua.target_phone, name: ua.target_name, role: ua.target_role });
      if (ua.action === "remove") await supabase.from('authorized_users').delete().eq('phone_number', ua.target_phone);
      return quietResponse(ai.chat_response);
    }

    // ==========================================
    // 📄 OBTENER ARCHIVO
    // ==========================================
    if (ai.intent === "OBTENER_ARCHIVO") {
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
      else if (fr.resource === "shipment_file") {
        let sQuery = supabase.from('shipments').select('id, code').order('created_at', { ascending: false });
        if (fr.code) sQuery = sQuery.ilike('code', `%${fr.code}%`);
        const { data: ship } = await sQuery.limit(1).maybeSingle();
        if (ship) {
          const searchTag = fr.doc_type?.toLowerCase() || "";
          const isMultiple = searchTag.includes('foto') || incomingMessage.toLowerCase().includes('fotos');
          const { data: files } = await supabase.from('shipment_files').select('storage_path, doc_type').eq('shipment_id', ship.id).or(`doc_type.ilike.%${searchTag}%,filename.ilike.%${searchTag}%`).limit(isMultiple ? 5 : 1);
          if (files && files.length > 0) {
            for (const f of files) {
              const bucket = f.doc_type.toLowerCase().includes('foto') ? 'shipment-photos' : 'shipment-docs';
              const cleanPath = f.storage_path.replace(`${bucket}/`, '');
              const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(cleanPath, 3600);
              if (signed?.signedUrl) {
                await sendTwilioMessage(dbSenderFormat, `📦 ${f.doc_type.toUpperCase()} (${ship.code})`, signed.signedUrl);
                filesFound = true;
              }
            }
          }
        }
      }
      return filesFound ? quietResponse() : quietResponse(`⚠️ No encontré el archivo solicitado.`);
    }

    return quietResponse(ai.chat_response || "Entendido.");

  } catch (error: any) {
    console.error("❌ ERROR ATLAS:", error.message);
    return quietResponse(`⚠️ Error de sistema en Atlas: ${error.message}`);
  }
};