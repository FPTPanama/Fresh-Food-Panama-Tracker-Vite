import { schedule } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Resend } from 'resend';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const resend = new Resend(process.env.RESEND_API_KEY);

// 🔒 CONFIGURACIÓN DE DESTINATARIOS Y AUDITORÍA
const SALES_TEAM = [
  "rb@freshfoodpanama.com", // Ricardo
  "dv@freshfoodpanama.com", // David
  "pr@freshfoodpanama.com", // Pedro
  "vc@freshfoodpanama.com"  // Víctor
];
const ADMIN_AUDIT_EMAIL = "administracion@freshfoodpanama.com";

const geoInfo: Record<string, { flag: string }> = {
  'ES': { flag: '🇪🇸' }, 'FR': { flag: '🇫🇷' }, 'IT': { flag: '🇮🇹' }, 'DE': { flag: '🇩🇪' },
  'NL': { flag: '🇳🇱' }, 'PT': { flag: '🇵🇹' }, 'UK': { flag: '🇬🇧' }, 'JP': { flag: '🇯🇵' },
  'KR': { flag: '🇰🇷' }, 'TW': { flag: '🇹🇼' }, 'CN': { flag: '🇨🇳' }, 'HK': { flag: '🇭🇰' }
};

export const handler = schedule("0 7 * * 1", async () => {
  try {
    console.log("🚀 Generando Intelligence Digest para el equipo comercial...");

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const { data: weeklyLeads } = await supabase
      .from('leads_prospecting')
      .select('*')
      .gt('created_at', oneWeekAgo.toISOString());

    if (!weeklyLeads || weeklyLeads.length === 0) {
      console.log("No hay leads nuevos esta semana.");
      return { statusCode: 200 };
    }

    // 1. SEGMENTACIÓN ESTRATÉGICA
    const pineLeads = weeklyLeads
      .filter(l => l.interested_in?.some((p: string) => p.toLowerCase().includes('piña')))
      .sort((a, b) => b.lead_score - a.lead_score)
      .slice(0, 3);

    const otherLeads = weeklyLeads
      .filter(l => !l.interested_in?.some((p: string) => p.toLowerCase().includes('piña')))
      .sort((a, b) => b.lead_score - a.lead_score)
      .slice(0, 3);

    // 2. IA: MENSAJE EJECUTIVO PERSONALIZADO (STRICT MODE)
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });
    const aiRes = await model.generateContent(`
      Actúa como CEO de Fresh Food Panamá. Nuestra prioridad absoluta es la exportación de Piña Premium por vía aérea.
      Escribe un mensaje de 3 frases extremadamente motivadoras dirigido personalmente a nuestro equipo: Ricardo, David, Pedro y Víctor.
      Diles por qué estos leads de esta semana son oro puro y por qué deben contactarlos hoy mismo. 
      
      REGLA CRÍTICA: Devuelve ÚNICAMENTE el texto del mensaje motivador entre comillas. 
      NO incluyas introducciones como "Aquí tienes el mensaje" ni comentarios adicionales. 
      Solo el mensaje directo para el equipo.
    `);
    
    // Limpiamos cualquier posible prefijo que la IA intente colar
    let summary = aiRes.response.text().trim();
    summary = summary.replace(/^["']|["']$/g, ''); 
    summary = summary.replace(/^(Aquí tienes|Este es|Mensaje para).*:/i, ''); 

    // 3. RENDERIZADO DE TARJETAS (NUEVO BOTÓN WEB AÑADIDO)
    const renderCard = (l: any, color: string) => {
      const flag = geoInfo[l.country_code]?.flag || '🌍';
      
      // Formateamos la URL por si Gemini la trajo sin el "https://"
      const websiteUrl = l.website ? (l.website.startsWith('http') ? l.website : `https://${l.website}`) : '#';

      return `
        <div style="background: #ffffff; border-radius: 8px; border: 1px solid #e0e0e0; border-left: 6px solid ${color}; padding: 18px; margin-bottom: 15px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size: 24px; font-weight: bold; color: ${color}; width: 55px; vertical-align: top;">${Number(l.lead_score).toFixed(1)}</td>
              <td>
                <span style="font-size: 11px; color: #757575; font-weight: bold; text-transform: uppercase;">${flag} ${l.city}, ${l.country}</span><br>
                <strong style="font-size: 18px; color: #333; display: block; margin-top: 2px;">${l.company_name}</strong>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="font-size: 14px; color: #555; padding-top: 10px; line-height: 1.4;">
                ${l.ai_analysis}
              </td>
            </tr>
            <tr>
              <td colspan="2" style="padding-top: 15px;">
                <a href="tel:${l.contact_phone || ''}" style="background: ${color}; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-size: 12px; font-weight: bold; display: inline-block; margin-bottom: 5px;">📞 LLAMAR</a>
                <a href="mailto:${l.contact_email || ''}" style="border: 1px solid ${color}; color: ${color}; padding: 7px 15px; text-decoration: none; border-radius: 4px; font-size: 12px; font-weight: bold; display: inline-block; margin-left: 5px; margin-bottom: 5px;">✉️ EMAIL</a>
                <a href="${websiteUrl}" target="_blank" style="border: 1px solid #9e9e9e; color: #616161; padding: 7px 15px; text-decoration: none; border-radius: 4px; font-size: 12px; font-weight: bold; display: inline-block; margin-left: 5px; margin-bottom: 5px;">🌐 WEB</a>
              </td>
            </tr>
          </table>
        </div>`;
    };

    // 4. ENVÍO FINAL
    await resend.emails.send({
      from: 'Fresh Food Intelligence <ventas@freshfoodpanama.com>',
      to: SALES_TEAM,
      bcc: [ADMIN_AUDIT_EMAIL],
      subject: 'Nuevas oportunidades globales para exportación.',
      html: `
        <div style="background-color: #f4f7f6; padding: 30px 10px; font-family: Arial, sans-serif;">
          <table align="center" width="100%" style="max-width: 600px; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08);">
            
            <tr>
              <td style="background: #1b5e20; padding: 40px 20px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 24px; letter-spacing: 2px;">WEEKLY SALES DIGEST</h1>
                <p style="margin: 8px 0 0; opacity: 0.8; font-size: 13px; font-weight: bold;">INTELIGENCIA ESTRATÉGICA</p>
              </td>
            </tr>

            <tr>
              <td style="padding: 30px; background-color: #1b5e20; text-align: center;">
                <table width="100%">
                  <tr>
                    <td style="padding: 20px; border: 2px dashed #a5d6a7; border-radius: 10px;">
                      <p style="margin: 0; color: #ffffff; font-size: 16px; line-height: 1.6; font-style: italic; font-weight: 300;">
                        "${summary}"
                      </p>
                      <p style="margin: 15px 0 0; color: #a5d6a7; font-size: 12px; font-weight: bold; letter-spacing: 2px;">
                        — DIRECCIÓN GENERAL
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding: 25px;">
                <h3 style="color: #1b5e20; border-bottom: 3px solid #1b5e20; display: inline-block; margin-bottom: 20px; padding-bottom: 5px;">🍍 TOP 3: PIÑA (PRIORIDAD 1)</h3>
                ${pineLeads.map(l => renderCard(l, '#1b5e20')).join('') || '<p style="color: #999;">Sin nuevos leads de piña.</p>'}
                
                <div style="margin-top: 35px;"></div>

                <h3 style="color: #f57f17; border-bottom: 3px solid #f57f17; display: inline-block; margin-bottom: 20px; padding-bottom: 5px;">🌟 OTROS PRODUCTOS PREMIUM</h3>
                ${otherLeads.map(l => renderCard(l, '#f57f17')).join('') || '<p style="color: #999;">Sin otros rubros detectados.</p>'}
              </td>
            </tr>

            <tr>
              <td style="padding: 35px 25px; text-align: center; background: #f9f9f9;">
                <p style="margin-bottom: 20px; font-size: 13px; color: #2e7d32; font-weight: bold;">
                  🛡️ Todos los leads de este reporte han pasado verificación DNS y confirmación de existencia web.
                </p>
                <a href="https://fresh-food-tracker.netlify.app/admin/leads" style="background: #1b5e20; color: white; padding: 18px 35px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(27,94,32,0.3);">INGRESAR AL CRM</a>
                <p style="margin-top: 30px; font-size: 10px; color: #aaa;">Generado por Fresh Food AI. Confidencial.</p>
              </td>
            </tr>
          </table>
        </div>`
    });

    console.log("✅ Digest de Inteligencia enviado con éxito.");
    return { statusCode: 200 };
  } catch (err: any) {
    console.error("❌ Error enviando el Digest:", err.message);
    return { statusCode: 500, body: err.message };
  }
});