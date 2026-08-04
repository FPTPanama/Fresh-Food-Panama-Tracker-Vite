import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from 'axios';
import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const QUICK_EMAIL_API_KEY = process.env.QUICK_EMAIL_API_KEY; 

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- 🛡️ PIPELINE DE VERIFICACIÓN HÍBRIDO ---
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
  if (!email || !QUICK_EMAIL_API_KEY) return true; 
  try {
    const res = await axios.get(`https://api.quickemailverification.com/v1/verify?email=${email}&apikey=${QUICK_EMAIL_API_KEY}`);
    return res.data.result === 'valid' || res.data.result === 'unknown';
  } catch (e) { return true; }
}

export const handler = async (event: any) => {
  let location = "Mercamadrid, España";
  let product = "Piña Premium"; 
  
  if (event.body) {
    try {
      const payload = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
      const body = JSON.parse(payload);
      if (body.location) location = body.location;
      if (body.product) product = body.product;
    } catch (e) { console.log("Using defaults"); }
  }

  const TOTAL_BATCHES = 7; 
  const LEADS_PER_BATCH = 3; 

  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.1-flash-lite-preview", 
      generationConfig: { responseMimeType: "application/json" }
    });
    
    const { data: existing } = await supabase.from('leads_prospecting').select('company_name').limit(1500);
    let currentBlacklist = existing?.map(e => e.company_name) || [];
    let allLeads: any[] = [];

    // BUCLE DE MICRO-LOTES CON GOTEO
    for (let lote = 1; lote <= TOTAL_BATCHES; lote++) {
      console.log(`⏳ Lote ${lote}/${TOTAL_BATCHES}...`);
      const blacklistStr = currentBlacklist.length > 0 ? currentBlacklist.join(', ') : 'Ninguna';
      
      const prompt = `Actúa como analista B2B. Encuentra EXACTAMENTE ${LEADS_PER_BATCH} empresas REALES en ${location} para ${product}.
      EXCLUYE: [${blacklistStr}].
      REGLAS:
      1. PROHIBIDO INVENTAR. Si no sabes el email o web, devuelve null.
      2. Solo empresas con presencia digital verificable.
      3. Estructura JSON: [{company_name, city, country, country_code, website, contact_email, contact_phone, company_size, tags, ai_analysis, lead_score}]`;

      let text = "";
      let retries = 2;
      while (retries > 0) {
        try {
          const result = await model.generateContent(prompt);
          text = result.response.text();
          break; 
        } catch (apiError: any) {
          if (apiError.message && (apiError.message.includes('429') || apiError.message.includes('503'))) {
            await delay(20000);
            retries--;
          } else {
            throw apiError;
          }
        }
      }

      if (!text) continue;

      try {
        const batchLeads = JSON.parse(text);
        allLeads = [...allLeads, ...batchLeads];
        currentBlacklist = [...currentBlacklist, ...batchLeads.map((l: any) => l.company_name)];
      } catch (e) { console.error("Error parseando JSON"); }
      
      if (lote < TOTAL_BATCHES) await delay(15000);
    }

    console.log(`🧐 Verificando ${allLeads.length} prospectos...`);
    const verifiedLeads = [];

    for (const lead of allLeads) {
      const isWebAlive = await verifyWebsite(lead.website);
      if (!isWebAlive) {
        console.warn(`🗑️ Descartado (Web Down): ${lead.company_name}`);
        continue;
      }

      let emailFinal = lead.contact_email;
      if (emailFinal) {
        const hasMX = await hasMailServer(emailFinal);
        if (!hasMX) {
          console.warn(`📧 Email falso (DNS fail): ${emailFinal}`);
          emailFinal = null; 
        } else {
          const isDeepValid = await verifyEmailDeep(emailFinal);
          if (!isDeepValid) {
            console.warn(`🚫 Email rechazado por API: ${emailFinal}`);
            emailFinal = null;
          }
        }
      }

      verifiedLeads.push({
        ...lead,
        contact_email: emailFinal,
        lead_score: lead.lead_score ? Number(lead.lead_score) : 0,
        // 🚀 FIX CRÍTICO: Guardamos el status como 'new' para que Supabase lo acepte
        status: 'new',
        pipeline_stage: 'inbox',
        interested_in: [product], 
        source: 'ai-cron-verified',
        created_at: new Date().toISOString()
      });
    }

    if (verifiedLeads.length === 0) throw new Error("Cero leads pasaron la verificación.");

    // GUARDADO FINAL
    const { error } = await supabase.from('leads_prospecting').upsert(verifiedLeads, {
      onConflict: 'company_name,city',
      ignoreDuplicates: true 
    });

    if (error) throw error;
    
    console.log(`🚀 ÉXITO: ${verifiedLeads.length} leads blindados guardados.`);
    return { statusCode: 200 };

  } catch (err: any) {
    console.error("❌ Error:", err.message);
    return { statusCode: 500 };
  }
};