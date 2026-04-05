import { Handler, HandlerResponse } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
const Busboy = require('busboy');

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
  if (!event.body) return { statusCode: 400, body: "Bad Request: No body" };

  return new Promise<HandlerResponse>((resolve) => {
    const busboy = Busboy({ headers: event.headers });
    const result: any = {};

    busboy.on('field', (fieldname: string, val: string) => { 
      result[fieldname] = val; 
    });

    busboy.on('finish', async () => {
      // Extraer datos del correo
      const from = result.from || "Desconocido";
      const subject = result.subject || "Sin asunto";
      const text = result.text || "";
      const to = result.to || "";
      
      const cleanTo = to.toLowerCase();
      const subjectLower = subject.toLowerCase();

      // 1. GUARDAR EN SUPABASE
      // Guardamos SIEMPRE, sin importar el alias, para tener el registro en el Message Center
      const { data: inserted, error: dbError } = await supabase
        .from('inbound_emails')
        .insert([{
          from_email: from,
          subject: subject,
          body_text: text,
          target_alias: to
        }]).select().single();

      if (dbError) {
        console.error("Error guardando en Supabase:", dbError.message);
      }

      // 2. LÓGICA DE FILTRADO PARA WHATSAPP
      let shouldNotify = false;
      let icon = "📩";

      // Detectamos el departamento basándonos en el alias de destino
      if (cleanTo.includes("ventas")) { 
        shouldNotify = true; 
        icon = "💰 VENTAS"; 
      } 
      else if (cleanTo.includes("soporte")) { 
        shouldNotify = true; 
        icon = "🛠️ SOPORTE"; 
      } 
      else if (cleanTo.includes("administracion") || cleanTo.includes("admin")) { 
        shouldNotify = true; 
        icon = "💼 ADMIN"; 
      }
      else if (cleanTo.includes("operaciones")) {
        shouldNotify = true; 
        icon = "🚢 OPERACIONES";
      }

      // 3. DISPARAR WHATSAPP VÍA TWILIO
      if (shouldNotify) {
        const waMsg = `${icon} Nuevo Correo\nDe: ${from}\nAsunto: ${subject}`;
        
        const twilioSid = process.env.TWILIO_ACCOUNT_SID;
        const twilioToken = process.env.TWILIO_AUTH_TOKEN;
        const twilioFrom = process.env.TWILIO_WA_FROM; 
        const myWhatsApp = process.env.ADMIN_WHATSAPP_NUMBER;

        if (twilioSid && twilioToken && twilioFrom && myWhatsApp) {
          const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
          const waPayload = new URLSearchParams({
            From: twilioFrom,
            To: myWhatsApp,
            Body: waMsg
          });

          try {
            const twilioRes = await fetch(twilioUrl, {
              method: 'POST',
              headers: {
                'Authorization': 'Basic ' + Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: waPayload
            });

            if (twilioRes.ok) {
              console.log(`WhatsApp enviado con éxito para ${cleanTo}`);
            } else {
              const errData = await twilioRes.json();
              console.error("Twilio devolvió error:", errData);
            }
          } catch (waError) {
            console.error("Error de conexión con Twilio:", waError);
          }
        } else {
          console.error("Faltan variables de Twilio en Netlify");
        }
      }

      resolve({ statusCode: 200, body: "OK" });
    });

    const bodyBuffer = Buffer.from(event.body || "", event.isBase64Encoded ? "base64" : "utf8");
    busboy.write(bodyBuffer);
    busboy.end();
  });
};