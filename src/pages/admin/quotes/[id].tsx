import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom"; 
import { 
  Save, FileText, Loader2, Plane, Ship, 
  Thermometer, Droplets, Calculator, MapPin, Shield, ArrowRight, Package,
  Maximize, AlertCircle
} from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { getApiBase } from "../../../lib/apiBase";
import { requireAdminOrRedirect } from "../../../lib/requireAdmin";
import { AdminLayout } from "../../../components/AdminLayout";
import { LocationSelector } from "../../../components/LocationSelector";

// --- TRADUCCIONES PARA EL HISTORIAL ---
const FIELD_LABELS: { [key: string]: string } = {
  boxes: "Cajas",
  weight_kg: "Peso (Kg)",
  destination: "Destino",
  status: "Estado",
  total: "Total Cotización",
  mode: "Modo",
  terms: "Términos",
  product_id: "Producto",
  costs: "Costos/Precios",
  product_details: "Especificaciones"
};

const statusBadgeClass = (status: string | undefined) => {
  const s = status?.toLowerCase() || 'draft';
  const base = "pill ";
  switch (s) {
    case 'solicitud': return base + "red";
    case 'draft': return base + "gray";
    case 'sent': return base + "blue";
    case 'approved': return base + "green";
    case 'rejected': return base + "red";
    case 'expired': return base + "orange";
    default: return base + "gray";
  }
};

const DEFAULT_TERMS = `• Validez de la oferta: 5 días hábiles.
• Precios basados en el Incoterm seleccionado.
• Sujeto a disponibilidad de espacio en aerolínea/naviera.
• Incluye inspección fitosanitaria y pre-enfriamiento.`;

interface CostLine { base: number; unitSale: number; label: string; tip: string; }
interface CostState { [key: string]: CostLine; }

export default function AdminQuoteDetailPage() {
  const { id } = useParams(); 
  const navigate = useNavigate();

  const [authOk, setAuthOk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [varieties, setVarieties] = useState<string[]>([]);
  const [logs, setLogs] = useState<any[]>([]); // Estado para el historial
  
  const [status, setStatus] = useState("draft");
  const [boxes, setBoxes] = useState(0);
  const [weightKg, setWeightKg] = useState(0);
  const [pallets, setPallets] = useState(0);
  const [mode, setMode] = useState<"AIR" | "SEA">("AIR");
  const [incoterm, setIncoterm] = useState("CIP");
  const [place, setPlace] = useState("");
  const [productId, setProductId] = useState("");
  const [variety, setVariety] = useState("");
  const [color, setColor] = useState("");
  const [brix, setBrix] = useState("");
  const [caliber, setCaliber] = useState(""); 
  const [termsConditions, setTermsConditions] = useState(DEFAULT_TERMS);

  const [costs, setCosts] = useState<CostState>({
    fruta: { base: 13.30, unitSale: 0, label: "Fruta (Base Cajas)", tip: "Precio de compra por caja." },
    flete: { base: 0, unitSale: 0, label: "Flete Internacional", tip: "Costo por Kg estimado." },
    origen: { base: 0, unitSale: 0, label: "Gastos de Origen", tip: "Transporte interno y manejo PA." },
    aduana: { base: 0, unitSale: 0, label: "Gestión Aduanera", tip: "Corredor y trámites." },
    inspeccion: { base: 0, unitSale: 0, label: "Inspecciones / Fiton", tip: "Costo fijo MIDA." },
    itbms: { base: 0, unitSale: 0, label: "ITBMS / Tasas", tip: "Impuestos aplicables." },
    handling: { base: 0, unitSale: 0, label: "Handling", tip: "Manejo de carga." },
    otros: { base: 0, unitSale: 0, label: "Otros Gastos", tip: "Gastos no previstos." }
  });

  const headerInfo = useMemo(() => {
    if (!data) return { name: "Cargando...", tax: "...", code: "Q-2026-0000" };
    return {
      name: data.clients?.name || data.client_snapshot?.name || "Cliente no asignado",
      tax: data.clients?.tax_id || data.client_snapshot?.tax_id || "N/A",
      code: data.quote_number || data.quote_no || `SOLICITUD`
    };
  }, [data]);

  const analysis = useMemo(() => {
    const lines = Object.entries(costs).map(([key, val]) => {
      let qty = 1;
      if (key === 'fruta') qty = boxes;
      if (key === 'flete') qty = weightKg;
      const baseTotalCost = (val.base || 0) * qty;
      const totalSaleRow = (val.unitSale || 0) * qty;
      const currentMargin = totalSaleRow > 0 ? ((1 - (baseTotalCost / totalSaleRow)) * 100).toFixed(2) : "0.00";
      return { key, ...val, qty, baseTotalCost, totalSaleRow, margin: currentMargin };
    });
    const totalCost = lines.reduce((acc, curr) => acc + curr.baseTotalCost, 0);
    const totalSale = lines.reduce((acc, curr) => acc + curr.totalSaleRow, 0);
    const profit = totalSale - totalCost;
    const perBox = boxes > 0 ? totalSale / boxes : 0;
    return { lines, totalCost, totalSale, profit, perBox };
  }, [costs, boxes, weightKg]);

  const loadLogs = useCallback(async () => {
    if (!id) return;
    const { data: logsData } = await supabase
      .from("quote_logs")
      .select("*")
      .eq("quote_id", id)
      .order("created_at", { ascending: false });
    if (logsData) setLogs(logsData);
  }, [id]);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [qRes, pRes] = await Promise.all([
        supabase.from("quotes").select(`*, clients (*)`).eq("id", id).single(),
        supabase.from("products").select("*")
      ]);

      if (pRes.data) setProducts(pRes.data);
      if (qRes.data) {
        const q = qRes.data;
        setData(q);
        setStatus(q.status || "draft");
        setBoxes(Number(q.boxes || 0));
        setWeightKg(Number(q.weight_kg || 0));
        setMode(q.mode || "AIR");
        setPlace(q.destination || "");
        setProductId(q.product_id || "");
        setTermsConditions(q.terms || DEFAULT_TERMS);
        const det = q.product_details || {};
        setVariety(det.variety || "");
        setColor(det.color || "");
        setBrix(det.brix || "");
        setCaliber(det.caliber || "");

        if (q.product_id) {
          const prod = pRes.data?.find(p => p.id === q.product_id);
          setVarieties(prod?.variety ? (Array.isArray(prod.variety) ? prod.variety : [prod.variety]) : []);
        }

        const c = q.costs || {};
        setCosts({
          fruta: { base: Number(c.c_fruit || 13.30), unitSale: Number(c.s_fruit || 0), label: "Fruta (Base Cajas)", tip: "Precio de compra." },
          flete: { base: Number(c.c_freight || 0), unitSale: Number(c.s_freight || 0), label: "Flete Internacional", tip: "Costo por Kg." },
          origen: { base: Number(c.c_origin || 0), unitSale: Number(c.s_origin || 0), label: "Gastos de Origen", tip: "Manejo local." },
          aduana: { base: Number(c.c_aduana || 0), unitSale: Number(c.s_aduana || 0), label: "Gestión Aduanera", tip: "Corredor." },
          inspeccion: { base: Number(c.c_insp || 0), unitSale: Number(c.s_insp || 0), label: "Inspecciones / Fiton", tip: "MIDA." },
          itbms: { base: Number(c.c_itbms || 0), unitSale: Number(c.s_itbms || 0), label: "ITBMS / Tasas", tip: "Impuestos." },
          handling: { base: Number(c.c_handling || 0), unitSale: Number(c.s_handling || 0), label: "Handling", tip: "Manejo carga." },
          otros: { base: Number(c.c_other || 0), unitSale: Number(c.s_other || 0), label: "Otros Gastos", tip: "Extras." }
        });

        const m = q.totals?.meta || {};
        setIncoterm(m.incoterm || "CIP");
        setPallets(Number(m.pallets || 0));
      }
      loadLogs();
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [id, loadLogs]);

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (r.ok) setAuthOk(true);
    })();
  }, []);

  useEffect(() => {
    if (authOk && id) loadData();
  }, [authOk, id, loadData]);

  const updateCostLine = (key: string, field: 'base' | 'unitSale', value: string) => {
    const numValue = value === "" ? 0 : parseFloat(value);
    setCosts((prev) => ({ ...prev, [key]: { ...prev[key], [field]: numValue } }));
  };

  async function handleSave() {
    if (!id) return;
    setBusy(true);
    try {
      const totalVentaCientifico = analysis.lines.reduce((acc, curr) => acc + curr.totalSaleRow, 0);
      const payload = {
        total: totalVentaCientifico, 
        status, mode, destination: place,
        boxes: Number(boxes), weight_kg: Number(weightKg),
        terms: termsConditions,
        costs: {
          c_fruit: Number(costs.fruta.base), s_fruit: Number(costs.fruta.unitSale),
          c_freight: Number(costs.flete.base), s_freight: Number(costs.flete.unitSale),
          c_origin: Number(costs.origen.base), s_origin: Number(costs.origen.unitSale),
          c_aduana: Number(costs.aduana.base), s_aduana: Number(costs.aduana.unitSale),
          c_insp: Number(costs.inspeccion.base), s_insp: Number(costs.inspeccion.unitSale),
          c_itbms: Number(costs.itbms.base), s_itbms: Number(costs.itbms.unitSale),
          c_handling: Number(costs.handling.base), s_handling: Number(costs.handling.unitSale),
          c_other: Number(costs.otros.base), s_other: Number(costs.otros.unitSale)
        },
        totals: {
          total: totalVentaCientifico,
          items: analysis.lines.map(l => ({ name: l.label, total: l.unitSale })).filter(it => it.total > 0),
          meta: { incoterm, place, pallets: Number(pallets) }
        },
        product_id: productId || null,
        product_details: { variety, color, brix, caliber }
      };
      const { error } = await supabase.from("quotes").update(payload).eq("id", id);
      if (error) throw error;
      setToast("¡Cotización guardada!");
      loadLogs(); // Recargar historial después de guardar
      setTimeout(() => setToast(null), 3000);
    } catch (err) { setToast("Error al guardar"); } finally { setBusy(false); }
  }

  const handlePrintPdf = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const pdfUrl = `${getApiBase()}/.netlify/functions/renderQuotePdf?id=${id}&token=${session?.access_token}&t=${Date.now()}`;
    window.open(pdfUrl, '_blank');
  };

  const handleProductChange = (val: string) => {
    setProductId(val);
    const selectedProd = products.find(p => p.id === val);
    setVarieties(selectedProd?.variety ? (Array.isArray(selectedProd.variety) ? selectedProd.variety : [selectedProd.variety]) : []);
    setVariety(""); 
  };

  if (loading) return <AdminLayout title="Cargando..."><div className="p-10 text-center"><Loader2 className="spin" /></div></AdminLayout>;

  return (
    <AdminLayout title={`Cotización: ${headerInfo.name}`}>
      <div className="ff-container">
        
        <div className="hero">
          <div className="heroLeft">
            <div className="codeRow">
              <div className="codeIcon"><FileText size={20} color="#166534" /></div>
              <div style={{ minWidth: 0 }}>
                <div className="heroLabel">Identificador Único</div>
                <div className="code">{headerInfo.code}</div>
                <div className="productLine"><b>{headerInfo.name}</b></div>
              </div>
            </div>
          </div>
          <div className="heroRight">
            <div className="head-actions">
              <div className="kpi-box"><span className="kpi-val">USD {analysis.perBox.toFixed(2)}</span><span className="kpi-lab">PRECIO POR CAJA</span></div>
              <button onClick={handlePrintPdf} className="pdf-link"><FileText size={18}/> PDF</button>
              <button className="btn-save" onClick={handleSave} disabled={busy}>{busy ? <Loader2 size={18} className="spin"/> : <Save size={18}/>} {busy ? 'Guardando...' : 'Guardar'}</button>
            </div>
            <span className="pill green"><MapPin size={14}/> PTY <ArrowRight size={12}/> {place || 'Destino'}</span>
            <span className="pill blue"><Shield size={14}/> {incoterm}</span>
            <select className={statusBadgeClass(status)} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="Solicitud">Nueva Solicitud</option>
              <option value="draft">Borrador</option>
              <option value="sent">Enviada</option>
              <option value="approved">Aprobada</option>
              <option value="rejected">Rechazada</option>
            </select>
          </div>
        </div>

        {/* --- FRAGMENTOS DE UI ORIGINALES --- */}
        <div className="ff-card strip">
          <div className="strip-label">CALIDAD</div>
          <div className="strip-grid">
            <div className="f"><label>Producto</label><select value={productId} onChange={e => handleProductChange(e.target.value)}><option value="">Seleccionar...</option>{products.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}</select></div>
            <div className="f"><label>Variedad</label><select value={variety} onChange={e => setVariety(e.target.value)}><option value="">Seleccionar...</option>{varieties.map((v, i) => (<option key={i} value={v}>{v}</option>))}</select></div>
            <div className="f"><label><Maximize size={10}/> Calibre</label><input value={caliber} onChange={e => setCaliber(e.target.value)} /></div>
            <div className="f"><label><Thermometer size={10}/> Color</label><input value={color} onChange={e => setColor(e.target.value)} /></div>
            <div className="f"><label><Droplets size={10}/> Brix</label><input value={brix} onChange={e => setBrix(e.target.value)} /></div>
          </div>
        </div>

        <div className="ff-card strip blue">
          <div className="strip-label">LOGÍSTICA</div>
          <div className="strip-grid">
            <div className="f" style={{flex: 0.6}}><label>Modo</label><div className="toggle"><button className={mode==='AIR'?'active':''} onClick={()=>setMode('AIR')}><Plane size={14}/></button><button className={mode==='SEA'?'active':''} onClick={()=>setMode('SEA')}><Ship size={14}/></button></div></div>
            <div className="f" style={{flex: 0.6}}><label>Incoterm</label><select value={incoterm} onChange={e => setIncoterm(e.target.value)}><option value="EXW">EXW</option><option value="FOB">FOB</option><option value="CIP">CIP</option><option value="CIF">CIF</option><option value="DDP">DDP</option></select></div>
            <div className="f" style={{flex: 2}}><label>Destino</label><LocationSelector mode={mode} value={place} onChange={setPlace}/></div>
            <div className="f small"><label>Cajas</label><input type="number" className="no-spin" value={boxes} onChange={e => setBoxes(Number(e.target.value))}/></div>
            <div className="f small"><label>Pallets</label><input type="number" className="no-spin" value={pallets} onChange={e => setPallets(Number(e.target.value))}/></div>
            <div className="f small"><label>Peso (Kg)</label><input type="number" className="no-spin" value={weightKg} onChange={e => setWeightKg(Number(e.target.value))}/></div>
          </div>
        </div>

        <div className="ff-card">
          <div className="table-h"><Calculator size={18} color="#16a34a"/> <span>Análisis Comercial</span></div>
          <table className="a-table">
            <thead><tr><th align="left">CONCEPTO</th><th align="right">COSTO UNIT.</th><th align="center">CANT.</th><th align="right">P. UNIT. VENTA</th><th align="right">VENTA TOTAL</th><th align="center">MARGEN %</th></tr></thead>
            <tbody>
              {analysis.lines.map(l => (
                <tr key={l.key}>
                  <td><div className="c-box"><b>{l.label}</b><span>{l.tip}</span></div></td>
                  <td align="right"><input className="in no-spin" type="number" step="any" value={costs[l.key].base || ""} onChange={e => updateCostLine(l.key, 'base', e.target.value)} /></td>
                  <td align="center" style={{fontWeight: 800, color: '#64748b'}}>{l.qty}</td>
                  <td align="right"><input className="in s no-spin" type="number" step="any" value={costs[l.key].unitSale || ""} onChange={e => updateCostLine(l.key, 'unitSale', e.target.value)} /></td>
                  <td align="right" style={{fontWeight: 700}}>${l.totalSaleRow.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                  <td align="center"><span className="m-badge">{l.margin}%</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="a-footer">
            <div className="stat">COSTO OPERATIVO <b>${analysis.totalCost.toLocaleString(undefined, {minimumFractionDigits:2})}</b></div>
            <div className="stat">VALOR VENTA <b className="g">${analysis.totalSale.toLocaleString(undefined, {minimumFractionDigits:2})}</b></div>
            <div className="stat">UTILIDAD <b className="b">${analysis.profit.toLocaleString(undefined, {minimumFractionDigits:2})}</b></div>
            <div className="stat featured">PRECIO/CAJA <b>USD {analysis.perBox.toFixed(2)}</b></div>
          </div>
        </div>

        <div className="ff-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="table-h" style={{ color: '#b45309' }}><AlertCircle size={18}/> <span>Términos y Condiciones (Visibles en PDF)</span></div>
          <textarea className="terms-editor" value={termsConditions} onChange={(e) => setTermsConditions(e.target.value)} />
        </div>

        {/* --- NUEVO HISTORIAL DE ACTIVIDAD (LOGS) --- */}
        <div className="ff-card">
          <div className="table-h"><Package size={18} color="#64748b"/> <span>Historial de Actividad</span></div>
          <div className="log-list">
            {logs.length === 0 && <div className="no-logs">No hay cambios registrados aún.</div>}
            {logs.map((log) => (
              <div key={log.id} className="log-item-wrapper">
                <div className="log-item">
                  <div className="log-meta">
                    <span className="log-user">{log.user_email?.split('@')[0] || 'Sistema'}</span>
                    <span className="log-date">{new Date(log.created_at).toLocaleString('es-PA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="log-action-area">
                    <div className="ff-dot-wrapper">
                      <div className="ff-step-dot is-active"><div className="ff-note-indicator-dot"></div></div>
                      <div className="ff-note-tooltip ff-history-tooltip">
                        <div className="ff-tooltip-tag">CAMBIOS REALIZADOS</div>
                       <div className="ff-history-changes-grid">
  {Object.entries(log.changes || {})
    .filter(([key, val]: [string, any]) => typeof val.new !== 'object')
    .map(([key, val]: [string, any]) => {
      // Si son términos, no mostramos el texto largo
      const isTerms = key === 'terms';
      
      return (
        <div key={key} className="ff-history-row">
          <span className="ff-history-label">{FIELD_LABELS[key] || key}</span>
          <div className="ff-history-vals">
            <span className="ff-history-old">
              {isTerms ? "Texto anterior" : String(val.old ?? '—')}
            </span>
            <ArrowRight size={10} style={{ opacity: 0.5 }} />
            <span className="ff-history-new">
              {isTerms ? "Texto actualizado" : String(val.new ?? '—')}
            </span>
          </div>
        </div>
      );
    })}
</div>
                        <div className="ff-tooltip-arrow"></div>
                      </div>
                    </div>
                    <span className="log-summary-text">Actualizó {Object.keys(log.changes || {}).length} campos</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {toast && <div className="toast">{toast}</div>}
      </div>

      <style>{`
        .ff-container { padding: 30px; max-width: 1250px; margin: 0 auto; font-family: sans-serif; }
        .ff-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
        .hero { display: flex; justify-content: space-between; align-items: center; background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
        .heroLeft { display: flex; align-items: center; flex: 1; }
        .codeRow { display: flex; gap: 15px; align-items: center; }
        .codeIcon { width: 44px; height: 44px; background: #f0fdf4; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
        .heroLabel { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; }
        .code { font-size: 22px; font-weight: 900; color: #1e293b; }
        .productLine { font-size: 13px; color: #64748b; margin-top: 2px; }
        .heroRight { display: flex; gap: 10px; align-items: center; }
        .head-actions { display: flex; gap: 20px; align-items: center; margin-right: 15px; border-right: 1px solid #e2e8f0; padding-right: 20px; }
        .kpi-box { text-align: right; }
        .kpi-val { display: block; font-size: 18px; font-weight: 900; color: #10b981; }
        .kpi-lab { font-size: 9px; font-weight: 800; color: #94a3b8; }
        .pdf-link { background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0; padding: 10px 18px; border-radius: 8px; font-weight: 700; display: flex; gap: 8px; align-items: center; text-decoration: none; cursor: pointer; }
        .btn-save { background: #10b981; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; cursor: pointer; display: flex; gap: 8px; align-items: center; }
        .pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; border: 1px solid transparent; }
        .pill.green { background: #f0fdf4; color: #166534; border-color: #bbf7d0; }
        .pill.blue { background: #eff6ff; color: #1e40af; border-color: #bfdbfe; }
        .pill.red { background: #fee2e2; color: #b91c1c; border-color: #fecaca; }
        .pill.gray { background: #f8fafc; color: #475569; border-color: #e2e8f0; }
        .pill.orange { background: #fff7ed; color: #c2410c; border-color: #ffedd5; }
        .strip { display: flex; gap: 20px; align-items: center; padding: 12px 20px; }
        .strip-label { width: 80px; font-size: 10px; font-weight: 900; color: #10b981; border-right: 1px solid #f1f5f9; }
        .strip.blue .strip-label { color: #3b82f6; }
        .strip-grid { display: flex; flex: 1; gap: 15px; }
        .f { display: flex; flex-direction: column; gap: 5px; flex: 1; }
        .f.small { flex: 0.4; }
        .f label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; display: flex; align-items: center; gap: 4px; }
        .f input, .f select, .toggle { height: 38px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0 10px; font-size: 13px; font-weight: 600; outline: none; }
        .toggle { display: flex; background: #f1f5f9; padding: 2px; height: 38px; border-radius: 6px; }
        .toggle button { flex: 1; border: none; background: none; cursor: pointer; color: #94a3b8; display: flex; align-items: center; justify-content: center; }
        .toggle button.active { background: white; color: #3b82f6; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .table-h { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; font-weight: 800; text-transform: uppercase; font-size: 12px; }
        .a-table { width: 100%; border-collapse: collapse; }
        .a-table th { font-size: 10px; color: #94a3b8; padding: 10px; border-bottom: 2px solid #f8fafc; text-align: left; }
        .a-table td { padding: 12px 10px; border-bottom: 1px solid #f8fafc; }
        .c-box b { display: block; font-size: 13px; color: #1e293b; }
        .c-box span { font-size: 10px; color: #94a3b8; }
        .in { width: 100px; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px; text-align: right; font-weight: 700; }
        .in.s { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
        .m-badge { background: #f1f5f9; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; color: #475569; }
        .a-footer { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-top: 25px; padding-top: 20px; border-top: 2px solid #f1f5f9; }
        .stat { background: #f8fafc; padding: 15px; border-radius: 10px; font-size: 10px; color: #64748b; font-weight: 700; }
        .stat b { display: block; font-size: 18px; color: #1e293b; margin-top: 5px; }
        .stat b.g { color: #10b981; }
        .stat b.b { color: #3b82f6; }
        .stat.featured { background: #1e293b; color: #94a3b8; }
        .stat.featured b { color: white; }
        .toast { position: fixed; bottom: 30px; right: 30px; background: #1e293b; color: white; padding: 12px 25px; border-radius: 10px; z-index: 100; box-shadow: 0 10px 15px rgba(0,0,0,0.2); }
        .spin { animation: spin 1s linear infinite; }
        .terms-editor { width: 100%; min-height: 100px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 13px; color: #475569; line-height: 1.5; outline: none; resize: vertical; background: #fffbeb; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .no-spin::-webkit-inner-spin-button, .no-spin::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }

        /* --- HISTORIAL Actividad --- */
        .log-list { display: flex; flex-direction: column; }
        .no-logs { padding: 20px; text-align: center; color: #94a3b8; font-size: 13px; }
        .log-item-wrapper { position: relative; }
        .log-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; background: #fff; border-bottom: 1px solid #f1f5f9; transition: 0.2s; }
        .log-item:hover { background: #f8fafc; }
        .log-meta { display: flex; flex-direction: column; }
        .log-user { font-size: 12px; font-weight: 800; color: #1e293b; text-transform: capitalize; }
        .log-date { font-size: 10px; color: #94a3b8; font-weight: 600; }
        .log-action-area { display: flex; align-items: center; gap: 12px; }
        .log-summary-text { font-size: 11px; font-weight: 700; color: #64748b; }

        /* Tooltip Glass Apple Identity */
        .ff-dot-wrapper { height: 14px; width: 14px; position: relative; display: flex; align-items: center; justify-content: center; }
        .ff-step-dot { width: 8px; height: 8px; background: #e2e8f0; border-radius: 50%; transition: 0.4s; position: relative; }
        .ff-step-dot.is-active { background: #166534; transform: scale(1.2); }
        .ff-note-indicator-dot { position: absolute; top: -3px; right: -3px; width: 6px; height: 6px; background: #ea580c; border: 1.5px solid #fff; border-radius: 50%; }
        .ff-note-tooltip { position: absolute; bottom: 25px; left: 50%; transform: translateX(-50%) translateY(10px); width: 280px; background: #1e293b; padding: 14px; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3); z-index: 100; opacity: 0; visibility: hidden; transition: 0.2s; }
        .log-action-area:hover .ff-note-tooltip { opacity: 1; visibility: visible; transform: translateX(-50%) translateY(0); }
        .ff-tooltip-tag { font-size: 9px; font-weight: 800; color: #94a3b8; margin-bottom: 8px; letter-spacing: 0.5px; }
        .ff-tooltip-arrow { position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%); border-left: 7px solid transparent; border-right: 7px solid transparent; border-top: 7px solid #1e293b; }
        
        /* Grid de cambios dentro del tooltip */
        .ff-history-changes-grid { display: flex; flex-direction: column; gap: 8px; }
        .ff-history-row { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px; }
        .ff-history-label { font-size: 9px; color: #94a3b8; font-weight: 800; text-transform: uppercase; }
        .ff-history-vals { display: flex; align-items: center; gap: 8px; font-family: monospace; }
        .ff-history-old { color: #f87171; font-size: 10px; text-decoration: line-through; }
        .ff-history-new { color: #4ade80; font-size: 11px; font-weight: 700; }
      `}</style>
    </AdminLayout>
  ); 
}