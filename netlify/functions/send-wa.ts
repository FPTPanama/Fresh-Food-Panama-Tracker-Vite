import type { Handler } from "@netlify/functions";
import { optionsResponse, text, commonHeaders } from "./_util"; // Asumiendo que tienes tu archivo de utilidades

export const handler: Handler = async (event) => {
  // 1. Manejo de CORS (Preflight)
  if (event.httpMethod === "OPTIONS") return optionsResponse();

  // 2. Validar método POST
  if (event.httpMethod !== "POST") {
    return text(405, "Método no permitido. Usa POST.");
  }

  try {
    // 3. Extraer el destino y el mensaje del body
    const body = JSON.parse(event.body || "{}");
    const { to, message } = body;

    if (!to || !message) {
      return text(400, "Faltan parámetros: 'to' (número con código de país) y 'message'.");
    }

    // 4. Credenciales de Twilio desde las variables de entorno
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_WA_FROM || "+14155238886";

    if (!sid || !token) {
      return text(500, "Error de configuración de Twilio en el servidor.");
    }

    // 5. Preparar la llamada a la API de Twilio usando fetch nativo
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const authString = Buffer.from(`${sid}:${token}`).toString('base64');
    
    const params = new URLSearchParams();
    params.append("To", `whatsapp:${to.startsWith('+') ? to : '+' + to}`);
    params.append("From", `whatsapp:${fromNumber}`);
    params.append("Body", message);

    // 6. Ejecutar el envío
    const twilioResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authString}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params
    });

    const result = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error("Twilio Error:", result);
      return text(twilioResponse.status, `Error de Twilio: ${result.message}`);
    }

    // 7. Éxito
    return {
      statusCode: 200,
      headers: commonHeaders,
      body: JSON.stringify({ 
        success: true, 
        messageId: result.sid,
        status: result.status
      })
    };

  } catch (error: any) {
    console.error("Internal Error:", error);
    return text(500, `Error interno: ${error.message}`);
  }
};