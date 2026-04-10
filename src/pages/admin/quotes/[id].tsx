import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom"; 
import { 
  Save, FileText, Loader2, Plane, Ship, 
  Thermometer, Droplets, Calculator, MapPin, Shield, ArrowRight, Package,
  Maximize, AlertCircle, TrendingDown, ChevronLeft, ChevronRight,
  Calendar, MessageSquare, Clock
} from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { getApiBase } from "../../../lib/apiBase";
import { requireAdminOrRedirect } from "../../../lib/requireAdmin";
import { AdminLayout } from "../../../components/AdminLayout";
import { LocationSelector } from "../../../components/LocationSelector";

// --- CONSTANTES ---
const GLOBAL_MARGIN_THRESHOLD = 10.0; 
const LOGS_PER_PAGE = 5; 

// FIX: Diccionario expandido con TODOS los campos posibles de la cotización
const FIELD_LABELS: { [key: string]: string } = {
  boxes: "Cajas",
  weight_kg: "Peso (Kg)",
  origin: "Origen",
  destination: "Destino",
  status: "Estado",
  total: "Venta Total",
  mode: "Vía de Transporte",
  terms: "Términos y Condiciones",
  product_id: "ID Producto",
  product_details: "Especificaciones",
  pallets: "Pallets",
  incoterm: "Incoterm",
  variety: "Variedad",
  color: "Color",
  brix: "Brix",
  caliber: "Calibre",
  requested_shipment_date: "ETD (Salida)",
  c_fruit: "Costo Fruta", s_fruit: "Venta Fruta",
  c_freight: "Costo Flete", s_freight: "Venta Flete",
  c_origin: "Costo Origen", s_origin: "Venta Origen",
  c_aduana: "Costo Aduana", s_aduana: "Venta Aduana",
  c_insp: "Costo Inspección", s_insp: "Venta Inspección",
  c_itbms: "Costo ITBMS", s_itbms: "Venta ITBMS",
  c_handling: "Costo Handling", s_handling: "Venta Handling",
  c_other: "Otros Costos", s_other: "Otras Ventas",
  costs: "Costos/Precios",
  totals: "Totales"
};

// Función robusta para formatear valores en el historial
const formatChangeVal = (val: any, isDocs: boolean = false) => {
  if (isDocs) return "Documento Modificado";
  if (val === null || val === undefined || val === '') return "Vacío";
  if (typeof val === 'object') return "Dato Actualizado"; 
  return String(val);
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

// --- HELPER TOOLTIP DE LOCACIÓN ---
const LocationTooltip = ({ code, locMap, children }: { code: string, locMap: Record<string, any>, children: React.ReactNode }) => {
  const locInfo = locMap[code?.toUpperCase()];
  const displayName = locInfo ? `${locInfo.name}${locInfo.country ? `, ${locInfo.country}` : ''}` : 'Locación Desconocida';
  
  return (
    <div className="ff-tooltip-wrapper">
      {children}
      <div className="ff-tooltip-content loc-tooltip">
        <strong>{code || 'N/A'}</strong>
        <span>{displayName}</span>
      </div>
    </div>
  );
};

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
  const [logs, setLogs] = useState<any[]>([]); 
  const [locationsMap, setLocationsMap] = useState<Record<string, any>>({});
  
  const [currentPage, setCurrentPage] = useState(1);

  // Estados del Chatter
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  const [status, setStatus] = useState("draft");
  const [boxes, setBoxes] = useState(0);
  const [weightKg, setWeightKg] = useState(0);
  const [pallets, setPallets] = useState(0);
  const [mode, setMode] = useState<"AIR" | "SEA">("AIR");
  const [incoterm, setIncoterm] = useState("CIP");
  const [origin, setOrigin] = useState("PTY"); 
  const [place, setPlace] = useState("");
  const [productId, setProductId] = useState("");
  const [variety, setVariety] = useState("");
  const [color, setColor] = useState("");
  const [brix, setBrix] = useState("");
  const [caliber, setCaliber] = useState(""); 
  const [shipmentDate, setShipmentDate] = useState(""); 
  const [termsConditions, setTermsConditions] = useState(DEFAULT_TERMS);

  const isReadOnly = useMemo(() => status?.toLowerCase() === 'approved', [status]);

  const [costs, setCosts] = useState<CostState>({
    fruta: { base: 13.30, unitSale: 0, label: "Fruta (Base Cajas)", tip: "Precio de compra por caja." },
    flete: { base: 0, unitSale: 0, label: "Flete Internacional", tip: "Costo por Kg estimado." },
    origen: { base: 0, unitSale: 0, label: "Gastos de Origen", tip: "Transporte interno y manejo." },
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
      const currentMarginNum = totalSaleRow > 0 ? (1 - (baseTotalCost / totalSaleRow)) * 100 : 0;
      return { key, ...val, qty, baseTotalCost, totalSaleRow, margin: currentMarginNum.toFixed(2) };
    });

    const totalCost = lines.reduce((acc, curr) => acc + curr.baseTotalCost, 0);
    const totalSale = lines.reduce((acc, curr) => acc + curr.totalSaleRow, 0);
    const profit = totalSale - totalCost;
    const perBox = boxes > 0 ? totalSale / boxes : 0;
    const globalMargin = totalSale > 0 ? (profit / totalSale) * 100 : 0;
    const isRisk = globalMargin < GLOBAL_MARGIN_THRESHOLD && totalSale > 0;

    return { lines, totalCost, totalSale, profit, perBox, globalMargin, isRisk };
  }, [costs, boxes, weightKg]);

  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * LOGS_PER_PAGE;
    return logs.slice(start, start + LOGS_PER_PAGE);
  }, [logs, currentPage]);

  const totalPages = Math.ceil(logs.length / LOGS_PER_PAGE);

  useEffect(() => {
    async function fetchLocations() {
      const { data } = await supabase.from('master_locations').select('code, name, country');
      if (data) {
        const map: Record<string, any> = {};
        data.forEach(loc => { map[loc.code.toUpperCase()] = loc; });
        setLocationsMap(map);
      }
    }
    fetchLocations();
  }, []);

  const loadLogs = useCallback(async () => {
    if (!id) return;
    const { data: logsData } = await supabase
      .from("quote_logs")
      .select("*")
      .eq("quote_id", id)
      .order("created_at", { ascending: false });
    if (logsData) setLogs(logsData);
  }, [id]);

  const loadChatAndClearNotify = useCallback(async () => {
    if (!id) return;
    
    await supabase
      .from('quote_activity')
      .update({ is_read: true })
      .eq('quote_id', id)
      .eq('is_read', false)
      .eq('sender_role', 'client');

    const { data: chatData } = await supabase
      .from('quote_activity')
      .select('*')
      .eq('quote_id', id)
      .order('created_at', { ascending: true });

    if (chatData) setMessages(chatData);
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
        setOrigin(q.origin || "PTY"); 
        setPlace(q.destination || "");
        setProductId(q.product_id || "");
        setTermsConditions(q.terms || DEFAULT_TERMS);
        const det = q.product_details || {};
        setVariety(det.variety || "");
        setColor(det.color || "");
        setBrix(det.brix || "");
        setCaliber(det.caliber || "");
        setShipmentDate(det.requested_shipment_date || ""); 

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
      loadChatAndClearNotify();
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [id, loadLogs, loadChatAndClearNotify]);

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
    if (isReadOnly) return;
    const numValue = value === "" ? 0 : parseFloat(value);
    setCosts((prev) => ({ ...prev, [key]: { ...prev[key], [field]: numValue } }));
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !id) return;
    setSendingMsg(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        setToast("Error: Sesión expirada");
        return;
      }

      const { error } = await supabase.from('quote_activity').insert({
        quote_id: id,
        sender_id: user.id,
        sender_role: 'admin',
        message: newMessage.trim(),
        is_read: true 
      });

      if (!error) {
        setNewMessage("");
        loadChatAndClearNotify();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSendingMsg(false);
    }
  };

  async function handleSave() {
    if (!id) return;
    if (analysis.isRisk) {
      if (!window.confirm(`RIESGO: La utilidad (${analysis.globalMargin.toFixed(2)}%) es inferior al 10%. ¿Proceder?`)) return;
    }
    setBusy(true);
    try {
      const totalVentaCientifico = analysis.lines.reduce((acc, curr) => acc + curr.totalSaleRow, 0);
      const payload = {
        id,
        total: totalVentaCientifico, 
        status, 
        mode, 
        origin, 
        destination: place,
        boxes: Number(boxes), 
        weight_kg: Number(weightKg),
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
        product_details: { 
          variety, color, brix, caliber,
          requested_shipment_date: shipmentDate 
        }
      };

      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${getApiBase()}/.netlify/functions/updateQuote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("Error Servidor");

      if (status.toLowerCase() === 'approved') {
        const { data: existingShip } = await supabase
          .from('shipments')
          .select('id')
          .eq('quote_id', id)
          .maybeSingle();

        if (!existingShip) {
          const selectedProd = products.find(p => p.id === productId);
          const { error: shipError } = await supabase
            .from('shipments')
            .insert({
              quote_id: id,
              client_id: data.client_id || data.clients?.id,
              boxes: Number(boxes),
              pallets: Number(pallets),
              weight_kg: Number(weightKg),
              product_name: selectedProd?.name || "Fruta",
              product_variety: variety,
              product_mode: mode,
              caliber: caliber,
              color: color,
              brix_grade: brix,
              origin: origin, 
              destination: place,
              incoterm: incoterm,
              status: 'CREATED',
              code: `SHP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
            });
          
          if (shipError) console.error("Error al crear embarque:", shipError);
          else setToast("Aprobada y Embarque Generado");
        }
      }
      
      if (!toast) setToast("Sincronizado");
      await loadData(); 
      setTimeout(() => setToast(null), 3000);
    } catch (err) { setToast("Error"); } finally { setBusy(false); }
  }

  const handlePrintPdf = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const pdfUrl = `${getApiBase()}/.netlify/functions/renderQuotePdf?id=${id}&token=${session?.access_token}&t=${Date.now()}`;
    window.open(pdfUrl, '_blank');
  };

  const handleProductChange = (val: string) => {
    if (isReadOnly) return;
    setProductId(val);
    const selectedProd = products.find(p => p.id === val);
    setVarieties(selectedProd?.variety ? (Array.isArray(selectedProd.variety) ? selectedProd.variety : [selectedProd.variety]) : []);
    setVariety(""); 
  };

  if (loading) return <AdminLayout title="Cargando..."><div className="p-10 text-center"><Loader2 className="spin" /></div></AdminLayout>;

  return (
    <AdminLayout title={`Cotización: ${headerInfo.name}`}>
      <div className="ff-container">
        
        {analysis.isRisk && (
          <div className="ff-alert-banner">
            <TrendingDown size={18} />
            <span><b>BAJA RENTABILIDAD:</b> El margen global es inferior al 10%.</span>
          </div>
        )}

        <div className="hero">
          <div className="heroLeft">
            <div className="codeRow">
              <div className="codeIcon"><FileText size={20} color="#166534" /></div>
              <div style={{ minWidth: 0 }}>
                <div className="heroLabel">Identificador de Gestión</div>
                <div className="code">{headerInfo.code}</div>
                <div className="productLine"><b>{headerInfo.name}</b></div>
              </div>
            </div>
          </div>
          <div className="heroRight">
            <div className="head-actions">
              <div className="kpi-box">
                <span className={`kpi-val ${analysis.isRisk ? 'txt-danger' : ''}`}>USD {analysis.perBox.toFixed(2)}</span>
                <span className="kpi-lab">PRECIO POR CAJA</span>
              </div>
              <button onClick={handlePrintPdf} className="pdf-link"><FileText size={18}/> PDF</button>
              <button className={`btn-save ${analysis.isRisk ? 'btn-danger' : ''}`} onClick={handleSave} disabled={busy || (isReadOnly && data?.status === 'approved')}>
                {busy ? <Loader2 size={18} className="spin"/> : <Save size={18}/>} 
                {busy ? 'Guardando...' : isReadOnly ? 'Cotización Aprobada' : 'Guardar'}
              </button>
            </div>
            
            <span className="pill green">
              <MapPin size={14}/> 
              <LocationTooltip code={origin || 'PTY'} locMap={locationsMap}>
                <span style={{ cursor: 'help' }}>{origin || 'PTY'}</span>
              </LocationTooltip>
              <ArrowRight size={12}/> 
              <LocationTooltip code={place || 'TBD'} locMap={locationsMap}>
                <span style={{ cursor: 'help' }}>{place || 'Destino'}</span>
              </LocationTooltip>
            </span>
            
            <span className="pill blue"><Shield size={14}/> {incoterm}</span>
            <select 
              className={statusBadgeClass(status)} 
              value={status} 
              onChange={(e) => setStatus(e.target.value)}
              disabled={isReadOnly && data?.status === 'approved'}
            >
              <option value="Solicitud">Nueva Solicitud</option>
              <option value="draft">Borrador</option>
              <option value="sent">Enviada</option>
              <option value="approved">Aprobada</option>
              <option value="rejected">Rechazada</option>
            </select>
          </div>
        </div>

        {/* --- CALIDAD --- */}
        <div className="ff-card strip">
          <div className="strip-label">CALIDAD</div>
          <div className="strip-grid">
            <div className="f"><label>Producto</label><select disabled={isReadOnly} value={productId} onChange={e => handleProductChange(e.target.value)}><option value="">Seleccionar...</option>{products.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}</select></div>
            <div className="f"><label>Variedad</label><select disabled={isReadOnly} value={variety} onChange={e => setVariety(e.target.value)}><option value="">Seleccionar...</option>{varieties.map((v, i) => (<option key={i} value={v}>{v}</option>))}</select></div>
            <div className="f"><label><Maximize size={10}/> Calibre</label><input disabled={isReadOnly} value={caliber} onChange={e => setCaliber(e.target.value)} placeholder="Ej: 5-6" /></div>
            <div className="f"><label><Thermometer size={10}/> Color</label><input disabled={isReadOnly} value={color} onChange={e => setColor(e.target.value)} placeholder="Ej: 2.5 - 3" /></div>
            <div className="f"><label><Droplets size={10}/> Brix</label><input disabled={isReadOnly} value={brix} onChange={e => setBrix(e.target.value)} placeholder="Ej: > 13" /></div>
          </div>
        </div>

        {/* --- LOGÍSTICA --- */}
        <div className="ff-card strip blue">
          <div className="strip-label">LOGÍSTICA</div>
          <div className="strip-grid">
            <div className="f" style={{ flex: "0 0 85px" }}>
              <label>Modo</label>
              <div className={`toggle ${isReadOnly ? 'readonly' : ''}`}>
                <button className={mode === 'AIR' ? 'active' : ''} onClick={() => !isReadOnly && setMode('AIR')}><Plane size={14} /></button>
                <button className={mode === 'SEA' ? 'active' : ''} onClick={() => !isReadOnly && setMode('SEA')}><Ship size={14} /></button>
              </div>
            </div>

            <div className="f" style={{ flex: "0 0 90px" }}>
              <label>Incoterm</label>
              <select disabled={isReadOnly} value={incoterm} onChange={e => setIncoterm(e.target.value)}>
                <option value="EXW">EXW</option><option value="FOB">FOB</option><option value="CIP">CIP</option><option value="CIF">CIF</option><option value="DDP">DDP</option><option value="FCA">FCA</option>
              </select>
            </div>

            <div className="f" style={{ flex: "1", minWidth: "120px" }}>
              <label>Origen</label>
              {isReadOnly 
                ? <LocationTooltip code={origin} locMap={locationsMap}><input disabled value={origin} className="tooltip-trigger-input" /></LocationTooltip> 
                : <LocationTooltip code={origin} locMap={locationsMap}><LocationSelector mode={mode} value={origin} onChange={setOrigin} /></LocationTooltip>
              }
            </div>

            <div className="f" style={{ flex: "1", minWidth: "120px" }}>
              <label>Destino</label>
              {isReadOnly 
                ? <LocationTooltip code={place} locMap={locationsMap}><input disabled value={place} className="tooltip-trigger-input" /></LocationTooltip> 
                : <LocationTooltip code={place} locMap={locationsMap}><LocationSelector mode={mode} value={place} onChange={setPlace} /></LocationTooltip>
              }
            </div>
            
            <div className="f" style={{ flex: "0 0 120px" }} title="Fecha estimada de embarque (Estimated Time of Departure)">
              <label className="ff-help-cursor"><Calendar size={10} /> ETD</label>
              <input 
                disabled={isReadOnly}
                type="date" 
                value={shipmentDate} 
                onChange={e => setShipmentDate(e.target.value)} 
                className="ff-input-compact no-spin"
              />
            </div>

            <div className="f" style={{ flex: "0 0 70px" }}>
              <label>Cajas</label>
              <input disabled={isReadOnly} type="number" className="no-spin" value={boxes} onChange={e => setBoxes(Number(e.target.value))} />
            </div>

            <div className="f" style={{ flex: "0 0 70px" }}>
              <label>Pallets</label>
              <input disabled={isReadOnly} type="number" className="no-spin" value={pallets} onChange={e => setPallets(Number(e.target.value))} />
            </div>

            <div className="f" style={{ flex: "0 0 80px" }}>
              <label>Peso (Kg)</label>
              <input disabled={isReadOnly} type="number" className="no-spin" value={weightKg} onChange={e => setWeightKg(Number(e.target.value))} />
            </div>
          </div>
        </div>

        {/* --- ANÁLISIS --- */}
        <div className="ff-card">
          <div className="table-h"><Calculator size={18} color="#16a34a"/> <span>Matriz Comercial</span></div>
          <table className="a-table">
            <thead><tr><th align="left">CONCEPTO</th><th align="right">COSTO UNIT.</th><th align="center">CANT.</th><th align="right">P. UNIT. VENTA</th><th align="right">VENTA TOTAL</th><th align="center">MARGEN %</th></tr></thead>
            <tbody>
              {analysis.lines.map(l => (
                <tr key={l.key}>
                  <td><div className="c-box"><b>{l.label}</b><span>{l.tip}</span></div></td>
                  <td align="right"><input disabled={isReadOnly} className="in no-spin" type="number" step="any" value={costs[l.key].base || ""} onChange={e => updateCostLine(l.key, 'base', e.target.value)} /></td>
                  <td align="center" style={{fontWeight: 800, color: '#64748b'}}>{l.qty}</td>
                  <td align="right"><input disabled={isReadOnly} className="in s no-spin" type="number" step="any" value={costs[l.key].unitSale || ""} onChange={e => updateCostLine(l.key, 'unitSale', e.target.value)} /></td>
                  <td align="right" style={{fontWeight: 700}}>${l.totalSaleRow.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                  <td align="center"><span className="m-badge">{l.margin}%</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="a-footer">
            <div className="stat">INVERSIÓN <b>${analysis.totalCost.toLocaleString(undefined, {minimumFractionDigits:2})}</b></div>
            <div className="stat">VENTA BRUTA <b className="g">${analysis.totalSale.toLocaleString(undefined, {minimumFractionDigits:2})}</b></div>
            <div className="stat">UTILIDAD <b className="b">${analysis.profit.toLocaleString(undefined, {minimumFractionDigits:2})}</b></div>
            <div className={`stat featured ${analysis.isRisk ? 'stat-danger' : ''}`}>
               PRECIO/CAJA <b>USD {analysis.perBox.toFixed(2)}</b>
               <div className="stat-sub">M. Global: {analysis.globalMargin.toFixed(2)}%</div>
            </div>
          </div>
        </div>

        <div className="ff-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="table-h" style={{ color: '#b45309' }}><AlertCircle size={18}/> <span>Términos Contractuales</span></div>
          <textarea disabled={isReadOnly} className="terms-editor" value={termsConditions} onChange={(e) => setTermsConditions(e.target.value)} />
        </div>

        {/* --- CHATTER LOGÍSTICO --- */}
        <div className="ff-card chatter-box">
          <div className="table-h">
            <MessageSquare size={18} color="#3b82f6"/> 
            <span>Chat de Negociación</span>
          </div>
          
          <div className="chat-viewport">
            {messages.length === 0 && (
              <div className="empty-chat">No hay mensajes en esta cotización.</div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`chat-bubble-wrapper ${m.sender_role}`}>
                <div className="chat-bubble">
                  <div className="bubble-meta">
                    {m.sender_role === 'admin' ? 'Tú (Admin)' : 'Cliente'} • {new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </div>
                  <div className="bubble-text">{m.message}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="chat-input-area">
            <textarea 
              placeholder="Escribe una respuesta al cliente..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
            />
            <button 
              onClick={handleSendMessage} 
              disabled={sendingMsg || !newMessage.trim()}
              className="btn-send"
            >
              {sendingMsg ? <Loader2 size={16} className="spin" /> : <ArrowRight size={18} />}
            </button>
          </div>
        </div>

        {/* --- HISTORIAL DE ACTIVIDAD (REDISEÑO PLANO ODOO) --- */}
        <div className="ff-card">
          <div className="table-h"><Clock size={18} color="#64748b"/> <span>Historial de Actividad</span></div>
          
          <div className="odoo-log-feed">
            {logs.length === 0 && <div className="no-logs">Sin cambios registrados.</div>}
            
            {paginatedLogs.map((log) => {
              const changes = Object.entries(log.changes || {});
              if (changes.length === 0) return null;

              return (
                <div key={log.id} className="odoo-log-item">
                  <div className="odoo-log-header">
                    <div className="odoo-avatar">{log.user_email?.charAt(0).toUpperCase() || 'S'}</div>
                    <div className="odoo-meta">
                      <span className="odoo-user">{log.user_email?.split('@')[0] || 'Sistema'}</span>
                      <span className="odoo-date">{new Date(log.created_at).toLocaleString('es-PA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                  
                  <div className="odoo-log-body">
                    {changes.map(([key, val]: [string, any]) => {
                      const isDocs = key === 'terms';
                      return (
                        <div key={key} className="odoo-change-line">
                          <span className="o-label">{FIELD_LABELS[key] || key}:</span>
                          <span className="o-old">{formatChangeVal(val?.old, isDocs)}</span>
                          <ArrowRight size={10} className="o-arrow" />
                          <span className="o-new">{formatChangeVal(val?.new, isDocs)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* CONTROLES DE PAGINACIÓN */}
          {logs.length > LOGS_PER_PAGE && (
            <div className="log-pagination">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="pag-btn">
                <ChevronLeft size={16} /> Anterior
              </button>
              <span className="pag-info">Página {currentPage} de {totalPages}</span>
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="pag-btn">
                Siguiente <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        {toast && <div className="toast">{toast}</div>}
      </div>

      <style>{`
        .ff-container { padding: 30px; max-width: 1250px; margin: 0 auto; font-family: 'Inter', sans-serif; }
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
        .txt-danger { color: #ef4444 !important; }
        .kpi-lab { font-size: 9px; font-weight: 800; color: #94a3b8; }
        .pdf-link { background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0; padding: 10px 18px; border-radius: 8px; font-weight: 700; display: flex; gap: 8px; align-items: center; text-decoration: none; cursor: pointer; }
        .btn-save { background: #10b981; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; cursor: pointer; display: flex; gap: 8px; align-items: center; }
        .btn-danger { background: #ef4444 !important; }
        .pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; border: 1px solid transparent; }
        .pill.green { background: #f0fdf4; color: #166534; border-color: #bbf7d0; }
        .pill.blue { background: #eff6ff; color: #1e40af; border-color: #bfdbfe; }
        .pill.red { background: #fee2e2; color: #b91c1c; border-color: #fecaca; }
        .pill.gray { background: #f8fafc; color: #475569; border-color: #e2e8f0; }
        .pill.orange { background: #fff7ed; color: #c2410c; border-color: #ffedd5; }
        
        .strip { display: flex; gap: 20px; align-items: center; padding: 12px 20px; }
        .strip-label { width: 80px; font-size: 10px; font-weight: 900; color: #10b981; border-right: 1px solid #f1f5f9; }
        
        .strip-grid { 
          display: flex; 
          flex: 1; 
          gap: 12px; 
          flex-wrap: wrap; 
          align-items: flex-end; 
        }

        .f { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 0; }
        .f label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; display: flex; align-items: center; gap: 4px; white-space: nowrap; }
        
        .ff-help-cursor { cursor: help; text-decoration: underline dotted #94a3b8; }

        .f input, .f select, .toggle { 
          height: 38px; 
          border: 1px solid #e2e8f0; 
          border-radius: 6px; 
          padding: 0 10px; 
          font-size: 13px; 
          font-weight: 600; 
          outline: none; 
          width: 100%;
          background: white;
        }
        
        .tooltip-trigger-input { cursor: help !important; }

        .toggle.readonly { opacity: 0.7; cursor: not-allowed; pointer-events: none; }

        .ff-input-compact { font-size: 12px !important; padding: 0 8px !important; }

        .toggle { display: flex; background: #f1f5f9; padding: 2px; height: 38px; border-radius: 6px; width: auto; }
        .toggle button { flex: 1; border: none; background: none; cursor: pointer; color: #94a3b8; display: flex; align-items: center; justify-content: center; padding: 0 10px; }
        .toggle button.active { background: white; color: #3b82f6; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        
        /* TOOLTIPS PARA COTIZACIONES */
        .ff-tooltip-wrapper { position: relative; display: inline-flex; align-items: center; width: 100%; }
        .ff-tooltip-content {
          position: absolute; bottom: 110%; left: 50%; transform: translateX(-50%) translateY(10px);
          background: #1e293b; color: white; padding: 10px 14px; border-radius: 12px;
          font-size: 11px; font-weight: 500; white-space: nowrap; z-index: 100;
          opacity: 0; visibility: hidden; pointer-events: none; transition: all 0.2s ease;
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.2);
        }
        .ff-tooltip-content::after {
          content: ''; position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
          border-width: 5px; border-style: solid; border-color: #1e293b transparent transparent transparent;
        }
        .ff-tooltip-wrapper:hover .ff-tooltip-content { opacity: 1; visibility: visible; transform: translateX(-50%) translateY(0); }
        .loc-tooltip { display: flex; flex-direction: column; gap: 4px; align-items: center; }
        .loc-tooltip strong { font-size: 12px; font-weight: 800; color: #34d399; letter-spacing: 0.5px; }

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
        .stat-danger { background: #450a0a !important; border: 2px solid #ef4444; }
        .stat-sub { font-size: 9px; margin-top: 4px; opacity: 0.8; display: block; }
        .ff-alert-banner { background: #fee2e2; border: 1px solid #fecaca; padding: 12px 20px; border-radius: 12px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px; color: #b91c1c; font-size: 13px; font-weight: 600; }
        .toast { position: fixed; bottom: 30px; right: 30px; background: #1e293b; color: white; padding: 12px 25px; border-radius: 10px; z-index: 100; box-shadow: 0 10px 15px rgba(0,0,0,0.2); }
        .spin { animation: spin 1s linear infinite; }
        .terms-editor { width: 100%; min-height: 100px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 13px; color: #475569; line-height: 1.5; outline: none; resize: vertical; background: #fffbeb; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .no-spin::-webkit-inner-spin-button, .no-spin::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        
        input:disabled, select:disabled, textarea:disabled { 
          background-color: #f8fafc !important; color: #64748b !important; cursor: not-allowed !important; border-color: #e2e8f0 !important;
        }

        /* CHATTER LOGÍSTICO ESTILOS */
        .chatter-box { background: #f8fafc !important; border-left: 4px solid #3b82f6 !important; }
        .chat-viewport { max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 15px; padding: 15px; background: white; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 15px; }
        .empty-chat { text-align: center; color: #94a3b8; font-size: 13px; padding: 40px; }
        .chat-bubble-wrapper { display: flex; width: 100%; }
        .chat-bubble-wrapper.client { justify-content: flex-start; }
        .chat-bubble-wrapper.admin { justify-content: flex-end; }
        .chat-bubble { max-width: 75%; padding: 12px 16px; border-radius: 16px; position: relative; }
        .client .chat-bubble { background: #f1f5f9; color: #1e293b; border-bottom-left-radius: 2px; }
        .admin .chat-bubble { background: #3b82f6; color: white; border-bottom-right-radius: 2px; }
        .bubble-meta { font-size: 9px; font-weight: 800; text-transform: uppercase; margin-bottom: 4px; opacity: 0.8; }
        .bubble-text { font-size: 13px; font-weight: 500; line-height: 1.4; }
        .chat-input-area { display: flex; gap: 10px; background: white; padding: 10px; border-radius: 12px; border: 1px solid #e2e8f0; }
        .chat-input-area textarea { flex: 1; border: none; resize: none; height: 45px; font-family: inherit; font-size: 13px; outline: none; }
        .btn-send { background: #3b82f6; color: white; border: none; width: 45px; height: 45px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
        .btn-send:hover:not(:disabled) { background: #2563eb; transform: scale(1.05); }
        .btn-send:disabled { background: #cbd5e1; cursor: not-allowed; }

        /* HISTORIAL (ESTILO ODOO COMPACTO) */
        .odoo-log-feed { display: flex; flex-direction: column; padding: 0 10px; }
        .no-logs { padding: 20px; text-align: center; color: #94a3b8; font-size: 13px; }
        
        .odoo-log-item { display: flex; flex-direction: column; gap: 6px; padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
        .odoo-log-item:last-child { border-bottom: none; padding-bottom: 0; }
        
        .odoo-log-header { display: flex; align-items: center; gap: 10px; }
        .odoo-avatar { 
          width: 24px; height: 24px; background: #e2e8f0; color: #475569; 
          border-radius: 50%; display: flex; align-items: center; justify-content: center; 
          font-size: 10px; font-weight: 800; text-transform: uppercase;
        }
        .odoo-meta { display: flex; align-items: center; gap: 8px; }
        .odoo-user { font-size: 12px; font-weight: 700; color: #1e293b; text-transform: capitalize; }
        .odoo-date { font-size: 11px; color: #94a3b8; }
        
        .odoo-log-body { padding-left: 34px; display: flex; flex-direction: column; gap: 4px; }
        .odoo-change-line { 
          display: flex; align-items: center; gap: 8px; 
          font-size: 11.5px; font-family: 'JetBrains Mono', monospace; 
        }
        .o-label { 
          color: #64748b; font-weight: 600; font-family: 'Inter', sans-serif; 
          font-size: 11px; min-width: 120px;
        }
        .o-old { color: #94a3b8; text-decoration: line-through; }
        .o-arrow { color: #cbd5e1; }
        .o-new { color: #10b981; font-weight: 700; }
        
        .log-pagination { display: flex; justify-content: center; align-items: center; gap: 20px; padding: 15px 0 0; margin-top: 10px; border-top: 1px solid #f1f5f9; }
        .pag-btn { display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: white; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 11px; font-weight: 700; color: #64748b; cursor: pointer; transition: 0.2s; }
        .pag-btn:hover:not(:disabled) { background: #f1f5f9; color: #1e293b; }
        .pag-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .pag-info { font-size: 11px; font-weight: 600; color: #94a3b8; }
      `}</style>
    </AdminLayout>
  ); 
}