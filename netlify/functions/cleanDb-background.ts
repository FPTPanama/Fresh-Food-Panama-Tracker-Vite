import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const QUICK_EMAIL_API_KEY = process.env.QUICK_EMAIL_API_KEY;

// --- UTILIDADES DE VERIFICACIÓN ---
async function verifyWebsite(url: string): Promise<boolean> {
  if (!url || url === 'null') return false;
  try {
    const target = url.startsWith('http') ? url : `https://${url}`;
    const res = await axios.head(target, { timeout: 5000 }); 
    return res.status >= 200 && res.status < 400;
  } catch (e) { return false; }
}

async function hasMailServer(email: string): Promise<boolean> {
  if (!email || !email.includes('@')) return false;
  const domain = email.split('@')[1];
  try {
    const mxRecords = await resolveMx(domain);
    return mxRecords && mxRecords.length > 0;
  } catch { return false; }
}

async function verifyEmailDeep(email: string): Promise<boolean> {
  if (!QUICK_EMAIL_API_KEY) return true; 
  try {
    const res = await axios.get(`https://api.quickemailverification.com/v1/verify?email=${email}&apikey=${QUICK_EMAIL_API_KEY}`);
    return res.data.result === 'valid' || res.data.result === 'unknown';
  } catch (e) { return true; }
}

export const handler = async () => {
  console.log("🧹 INICIANDO PROTOCOLO DE LIMPIEZA MASIVA...");

  try {
    // 1. Traer leads sucios
    // 🚀 FIX: Filtramos usando 'source' para no chocar con las reglas estrictas de 'status'
    const { data: leads } = await supabase
      .from('leads_prospecting')
      .select('*')
      .not('source', 'in', '("mass-cleanup","ai-cron-verified")'); 

    if (!leads || leads.length === 0) {
      console.log("✅ Tu base de datos ya está limpia y verificada.");
      return { statusCode: 200 };
    }

    console.log(`🔍 Se encontraron ${leads.length} leads sin verificar. Analizando...`);

    const toDeleteIds: string[] = [];
    const toUpdate: any[] = [];
    let apiCreditsUsed = 0;
    const MAX_API_CREDITS = 80; // Dejamos 20 de reserva para tu minado diario

    // 2. Bucle de limpieza
    for (const lead of leads) {
      console.log(`Analizando: ${lead.company_name}...`);

      // A. Ping a la Web
      const isWebAlive = await verifyWebsite(lead.website);
      if (!isWebAlive) {
        console.warn(`🗑️ SENTENCIA DE MUERTE: Web caída para ${lead.company_name}`);
        toDeleteIds.push(lead.id); // Lo marcamos para borrarlo de la BD
        continue; 
      }

      // B. Verificación de Correo
      let emailFinal = lead.contact_email;
      
      if (emailFinal) {
        // Prueba DNS (Gratis)
        const hasMX = await hasMailServer(emailFinal);
        if (!hasMX) {
          console.warn(`📧 Email Falso Detectado (DNS): ${emailFinal}`);
          emailFinal = null;
        } 
        // Prueba API (Solo si pasó el DNS)
        else if (apiCreditsUsed < MAX_API_CREDITS) {
          apiCreditsUsed++;
          const isDeepValid = await verifyEmailDeep(emailFinal);
          if (!isDeepValid) {
            console.warn(`🚫 Email Rechazado por QuickEmail: ${emailFinal}`);
            emailFinal = null;
          }
        }
      }

      // 🚀 FIX CRÍTICO: Respetamos la regla de estado de tu base de datos
      toUpdate.push({
        ...lead,
        contact_email: emailFinal,
        status: lead.status || 'new', // Conserva el estado válido ('new', 'contacted', etc.)
        source: 'mass-cleanup'        // Con esto sabemos que ya fue limpiado
      });
    }

    // 3. EJECUTAR LOS CAMBIOS EN SUPABASE
    
    if (toDeleteIds.length > 0) {
      console.log(`🔥 Borrando ${toDeleteIds.length} empresas inexistentes...`);
      const { error: deleteError } = await supabase.from('leads_prospecting').delete().in('id', toDeleteIds);
      if (deleteError) throw deleteError;
    }

    if (toUpdate.length > 0) {
      console.log(`✨ Actualizando ${toUpdate.length} leads validados...`);
      const { error: updateError } = await supabase.from('leads_prospecting').upsert(toUpdate, { onConflict: 'id' });
      if (updateError) throw updateError;
    }

    console.log("---------------------------------------------------");
    console.log("🏁 RESUMEN DE LIMPIEZA:");
    console.log(`- Fantasmas Eliminados: ${toDeleteIds.length}`);
    console.log(`- Leads Rescatados/Limpios: ${toUpdate.length}`);
    console.log(`- Créditos de API Consumidos: ${apiCreditsUsed}/${MAX_API_CREDITS}`);
    console.log("---------------------------------------------------");

    return { statusCode: 200 };
  } catch (err: any) {
    console.error("❌ Error en la purga:", err.message);
    return { statusCode: 500 };
  }
};