import { Handler, HandlerResponse } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
const Busboy = require('busboy');

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
  
  // Seguridad extra: Si no hay body, no hacemos nada
  if (!event.body) return { statusCode: 400, body: "Bad Request: No body" };

  // SOLUCIÓN AQUÍ: Le decimos a TypeScript que esta promesa devuelve un <HandlerResponse>
  return new Promise<HandlerResponse>((resolve) => {
    const busboy = Busboy({ headers: event.headers });
    const result: any = {};

    busboy.on('field', (fieldname: string, val: string) => { 
      result[fieldname] = val; 
    });

    busboy.on('finish', async () => {
      // Asegurarnos de que las variables existen para no romper el código
      const from = result.from || "Desconocido";
      const subject = result.subject || "Sin asunto";
      const text = result.text || "";
      const to = result.to || "";
      
      const cleanTo = to.toLowerCase();
      const subjectLower = subject.toLowerCase();

      // 1. GUARDAR EN SUPABASE
      const { data: inserted, error: dbError } = await supabase
        .from('inbound_emails')
        .insert([{
          from_email: from,
          subject: subject,
          body_text: text,
          target_alias: to
        }]).select().single();

      // 2. LÓGICA DE FILTRADO PARA WHATSAPP
      const opKeywords = ["factura", "cotización", "cotizacion", "retraso", "cambio de vuelo", "vuelo"];
      let shouldNotify = false;
      let icon = "📩";

      if (cleanTo.includes("ventas")) { shouldNotify = true; icon = "💰 VENTAS"; }
      else if (cleanTo.includes("soporte")) { shouldNotify = true; icon = "🛠️ SOPORTE"; }
      else if (cleanTo.includes("operaciones") && opKeywords.some(k => subjectLower.includes(k))) {
        shouldNotify = true; icon = "🚢 OPERACIONES";
      }

      // 3. DISPARAR WHATSAPP
      if (shouldNotify && !dbError) {
        const waMsg = `${icon}\nDe: ${from}\nAsunto: ${subject}`;
        console.log("Notificación lista para WhatsApp:", waMsg);
        
        // Aquí conectaremos tu función de Twilio después
      }

      resolve({ statusCode: 200, body: "OK" });
    });

    // SendGrid a veces manda en base64, a veces en utf8
    const bodyBuffer = Buffer.from(event.body || "", event.isBase64Encoded ? "base64" : "utf8");
    busboy.write(bodyBuffer);
    busboy.end();
  });
};