import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; 
import { 
  PlusCircle, Search, Plane, Ship, 
  CheckCircle, SortAsc, AlertCircle, TrendingUp, ChevronRight, X,
  Calendar, FileText, ArrowRight, ChevronLeft
} from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { getApiBase } from "../../../lib/apiBase";
import { requireAdminOrRedirect } from "../../../lib/requireAdmin";
import { AdminLayout } from "../../../components/AdminLayout";
import { QuickQuoteModal } from "../../../components/quotes/QuickQuoteModal";
import { usePendingRequests } from "../../../hooks/usePendingRequests";

type QuoteRow = {
  id: string;
  quote_number?: string;
  quote_no?: string;
  created_at: string;
  status: string;
  mode: "AIR" | "SEA";
  currency: "USD" | "EUR";
  origin?: string;
  destination: string;
  boxes: number;
  client_name?: string | null;
  client_snapshot?: any;
  product_details?: {
    variety?: string;
    product?: string;
    customer_label?: string;
    requested_shipment_date?: string; 
    [key: string]: any;
  }; 
  total?: number | null;
  total_amount?: number | null;
};

type ApiResponse = {
  items: QuoteRow[];
  total: number;
};

// --- HELPERS DE UI ---
const getStatusConfig = (status: string) => {
  const s = status?.toLowerCase() || '';
  switch(s) {
    case 'draft': return { label: 'BORRADOR', class: 'bg-slate-100 text-slate-600' };
    case 'solicitud': return { label: 'NUEVA SOLICITUD', class: 'bg-orange-100 text-orange-700' };
    case 'sent': return { label: 'ENVIADA', class: 'bg-sky-100 text-sky-700' };
    case 'approved': return { label: 'APROBADA', class: 'bg-emerald-100 text-emerald-700' };
    case 'rejected': return { label: 'RECHAZADA', class: 'bg-rose-100 text-rose-700' };
    default: return { label: s.toUpperCase(), class: 'bg-gray-100 text-gray-600' };
  }
};

const TransportIcon = ({ mode }: { mode: string }) => {
  const isAir = mode?.toUpperCase() === 'AIR';
  return (
    <div className={`row-icon-box ${isAir ? 'air' : 'sea'}`}>
      {isAir ? <Plane size={14} /> : <Ship size={14} />}
    </div>
  );
};

const QuoteSkeleton = () => (
  <div className="ff-list-row skeleton-row">
    <div className="col-code"><div className="skel-pill w40" style={{ height: '24px' }}></div><div className="flex-col w100"><div className="skel-line w80"></div><div className="skel-line w50"></div></div></div>
    <div className="col-client"><div className="skel-line w80"></div></div>
    <div className="col-route"><div className="skel-pill w80" style={{ height: '24px' }}></div></div>
    <div className="col-amount"><div className="skel-line w60" style={{ marginLeft: 'auto' }}></div></div>
    <div className="col-status"><div className="skel-pill w70"></div></div>
  </div>
);

// --- HELPER TOOLTIP DE LOCACIÓN (Con colores de marca) ---
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

export default function AdminQuotesIndex() {
  const navigate = useNavigate();
  const [authOk, setAuthOk] = useState(true); 
  const [items, setItems] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pendingCount = usePendingRequests();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [locationsMap, setLocationsMap] = useState<Record<string, any>>({});
  
  // --- ESTADOS DE FILTRO Y PAGINACIÓN ---
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 12;

  // --- ESTADO PARA MÉTRICAS GLOBALES ---
  const [globalStats, setGlobalStats] = useState({ pipeline: 0, countApproved: 0 });

  const loadGlobalStats = async () => {
    try {
      const { data } = await supabase.from('quotes').select('total, total_amount, status');
      if (data) {
        const approved = data.filter(i => i.status === 'approved').length;
        const pipeline = data.reduce((acc, curr) => acc + (Number(curr.total || curr.total_amount) || 0), 0);
        setGlobalStats({ pipeline, countApproved: approved });
      }
    } catch (err) { console.error("Error loading stats", err); }
  };

  // --- CARGA DE LOCACIONES ---
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return navigate("/admin/login");
      
      const p = new URLSearchParams();
      p.set("dir", dir);
      p.set("sortField", "created_at");
      p.set("page", page.toString());
      p.set("pageSize", itemsPerPage.toString());
      if (status) p.set("status", status);
      if (q.trim()) p.set("q", q.trim());
      
      const url = `${getApiBase()}/.netlify/functions/listQuotes?${p.toString()}&t=${new Date().getTime()}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` } });
      
      if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
      const json = await res.json() as ApiResponse;
      
      setItems(json.items || []);
      setTotalItems(json.total || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [dir, status, q, page, navigate]);

  useEffect(() => {
    requireAdminOrRedirect().then(r => {
      if (r.ok) {
        load();
        loadGlobalStats();
      } else setAuthOk(false);
    });
  }, [load]);

  // Helpers de Paginación
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const handlePrevPage = () => setPage(p => Math.max(1, p - 1));
  const handleNextPage = () => setPage(p => Math.min(totalPages, p + 1));

  if (!authOk) return null;

  return (
    <AdminLayout title="Cotizaciones" subtitle="Administración de Cotizaciones">
      <div className="ff-page-wrapper">
        
        {/* ENCABEZADO */}
        <div className="ff-header-section">
          <div className="ff-title-group">
            <div className="title-flex">
                <h1>Panel de Cotizaciones</h1>
                {pendingCount > 0 && <span className="pulse-badge">{pendingCount} SOLICITUDES</span>}
            </div>
            <p>Monitorea el pipeline comercial y estados de envío</p>
          </div>
          <button className="ff-btn-primary" onClick={() => setIsModalOpen(true)}>
            <PlusCircle size={16} strokeWidth={2.5} /> Nueva Cotización
          </button>
        </div>

        {error && <div className="ff-error-banner"><AlertCircle size={16} /> {error}</div>}

        {/* METRICAS HERO GLOBALES */}
        <div className="ff-hero-metrics">
          <div className="metric-card highlight">
            <span className="m-label"><TrendingUp size={14}/> Pipeline Total</span>
            <span className="m-value"><small>USD</small> {globalStats.pipeline.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
          <div 
            className={`metric-card interactive ${pendingCount > 0 ? 'danger-active' : 'neutral'}`} 
            onClick={() => { setStatus(status === 'Solicitud' ? '' : 'Solicitud'); setPage(1); }}
          >
            <span className="m-label"><AlertCircle size={14}/> Solicitudes Pendientes</span>
            <span className="m-value">{pendingCount}</span>
          </div>
          <div className="metric-card success">
            <span className="m-label"><CheckCircle size={14}/> Aprobadas</span>
            <span className="m-value">{globalStats.countApproved}</span>
          </div>
        </div>

        {/* BARRA DE HERRAMIENTAS */}
        <div className="ff-toolbar">
          <div className="ff-search-group">
            <div className="ff-input-wrapper flex-grow">
              <Search size={16} />
              <input 
                placeholder="Buscar cliente, destino o número..." 
                value={q} 
                onChange={e => { setQ(e.target.value); setPage(1); }} 
              />
              {q && <X size={14} className="clear-icon" onClick={() => { setQ(""); setPage(1); }} />}
            </div>
            
            <div className="ff-filters-pills">
              {['Solicitud', 'draft', 'sent', 'approved'].map(s => {
                const conf = getStatusConfig(s);
                return (
                  <button 
                    key={s} 
                    className={`ff-pill ${status === s ? 'active' : ''} ${s === 'Solicitud' && pendingCount > 0 ? 'has-pulse' : ''}`} 
                    onClick={() => { setStatus(status === s ? "" : s); setPage(1); }}
                  >
                    {conf.label}
                  </button>
                )
              })}
            </div>
          </div>
          
          <button className="ff-btn-secondary" onClick={() => { setDir(dir === 'asc' ? 'desc' : 'asc'); setPage(1); }}>
            <SortAsc size={14} /> {dir === 'desc' ? 'Más Recientes' : 'Más Antiguas'}
          </button>
        </div>

        {/* LISTADO DE COTIZACIONES */}
        <div className="ff-list-container">
          <div className="ff-list-header">
            <div className="col-code">CÓDIGO & PRODUCTO</div>
            <div className="col-client">CLIENTE</div>
            <div className="col-route">RUTA & FECHA</div>
            <div className="col-amount">MONTO</div>
            <div className="col-status">ESTADO</div>
          </div>

          <div className="ff-list-body">
            {loading ? ( <><QuoteSkeleton /><QuoteSkeleton /><QuoteSkeleton /></> ) : items.length === 0 ? (
              <div className="ff-empty-state">
                <FileText size={32} />
                <p>No se encontraron cotizaciones para estos filtros.</p>
              </div>
            ) : (
              items.map((r) => {
                const isRequest = r.status === 'Solicitud';
                const statusConf = getStatusConfig(r.status);
                const displayId = r.quote_number || r.quote_no || `RFQ-${r.id.slice(0,5).toUpperCase()}`;
                const shipmentDate = r.product_details?.requested_shipment_date;

                let details = r.product_details;
                if (typeof details === 'string') {
                  try { details = JSON.parse(details); } catch { details = {}; }
                }
                const variety = details?.variety || details?.customer_label || "";
                const productInfo = variety.toLowerCase().includes('piña') ? variety : `Piña ${variety}`.trim();

                return (
                  <div 
                    key={r.id} 
                    className={`ff-list-row ${isRequest ? 'urgent' : ''}`} 
                    onClick={() => r.id && navigate(`/admin/quotes/${r.id}`)}
                  > 
                    <div className="col-code">
                      <TransportIcon mode={r.mode || 'SEA'} />
                      <div className="flex-col">
                        <span className="code-text">{displayId}</span>
                        <div className="product-stack">
                          <span className="boxes-badge">{r.boxes || 0} CAJAS</span>
                          <span className="sub-text">{productInfo || 'S/D'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="col-client font-semi">
                      {r.client_name || r.client_snapshot?.name || 'Cliente sin registrar'}
                    </div>

                    <div className="col-route">
                      <div className="route-tags">
                        <LocationTooltip code={r.origin || 'PTY'} locMap={locationsMap}>
                          <span className="r-tag tooltip-trigger">{r.origin || 'PTY'}</span>
                        </LocationTooltip>
                        <ArrowRight size={12} className="r-arrow" />
                        <LocationTooltip code={r.destination || 'TBD'} locMap={locationsMap}>
                          <span className="r-tag dest tooltip-trigger">{r.destination || 'TBD'}</span>
                        </LocationTooltip>
                      </div>
                      {shipmentDate && (
                        <div className="r-date">
                          <Calendar size={10} />
                          <span>ETD: {new Date(shipmentDate).toLocaleDateString('es-PA', { day: '2-digit', month: 'short' })}</span>
                        </div>
                      )}
                    </div>

                    <div className="col-amount">
                      {isRequest ? (
                        <span className="text-orange-600 font-bold text-xs uppercase">Por Definir</span>
                      ) : (
                        <span className="amount-text">
                          <small>USD</small> {(r.total_amount || r.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>

                    <div className="col-status">
                      <span className={`status-badge ${statusConf.class}`}>{statusConf.label}</span>
                      <ChevronRight size={16} className="row-chevron" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* PAGINACIÓN ELEGANTE */}
        {!loading && totalItems > 0 && (
          <div className="ff-pagination">
            <span className="page-info">Mostrando {((page - 1) * itemsPerPage) + 1} - {Math.min(page * itemsPerPage, totalItems)} de {totalItems} cotizaciones</span>
            <div className="page-controls">
              <button onClick={handlePrevPage} disabled={page === 1}><ChevronLeft size={16} /></button>
              <span className="page-number">Página {page} de {totalPages}</span>
              <button onClick={handleNextPage} disabled={page === totalPages}><ChevronRight size={16} /></button>
            </div>
          </div>
        )}

      </div>

      <QuickQuoteModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); load(); loadGlobalStats(); }} initialClientId={undefined} />

      <style>{`
        .ff-page-wrapper { display: flex; flex-direction: column; gap: 24px; font-family: 'Poppins', sans-serif !important; padding-bottom: 40px; }
        
        /* HEADER */
        .ff-header-section { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 10px; }
        .title-flex { display: flex; align-items: center; gap: 12px; }
        .ff-title-group h1 { font-size: 28px; font-weight: 800; color: var(--ff-green-dark); margin: 0; letter-spacing: -1px; }
        .ff-title-group p { color: var(--ff-green-dark); opacity: 0.6; font-size: 13px; font-weight: 500; margin: 4px 0 0; }
        
        .pulse-badge { background: var(--ff-orange); color: white; font-size: 10px; font-weight: 900; padding: 4px 10px; border-radius: 8px; animation: pulse-orange 2s infinite; letter-spacing: 0.5px; }
        
        .ff-btn-primary { 
          background: var(--ff-orange); color: white; border: none; padding: 0 20px; height: 44px;
          border-radius: 12px; font-weight: 800; font-size: 13px; display: flex; align-items: center; gap: 8px; 
          cursor: pointer; transition: all 0.2s ease; box-shadow: 0 4px 10px rgba(209, 119, 17, 0.2); 
        }
        .ff-btn-primary:hover { background: #b4660e; transform: translateY(-2px); box-shadow: 0 6px 15px rgba(209, 119, 17, 0.3); }

        .ff-error-banner { background: #fee2e2; border: 1px solid #fecaca; color: #b91c1c; padding: 12px 16px; border-radius: 12px; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px; }

        /* HERO METRICS */
        .ff-hero-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .metric-card { 
          background: white; padding: 24px; border-radius: 20px; 
          border: 1px solid rgba(34, 76, 34, 0.08); display: flex; flex-direction: column; gap: 10px; 
          box-shadow: 0 2px 10px rgba(0,0,0,0.02); transition: 0.2s;
        }
        .metric-card.interactive { cursor: pointer; }
        .metric-card.interactive:hover { transform: translateY(-2px); box-shadow: 0 6px 15px rgba(34,76,34,0.04); }
        .metric-card.highlight { border-left: 5px solid var(--ff-orange); }
        .metric-card.success { border-left: 5px solid var(--ff-green); }
        .metric-card.danger-active { border-left: 5px solid #ef4444; background: #fff5f5; border-color: #fecdd3; }
        .metric-card.neutral { border-left: 5px solid var(--ff-green-dark); }
        
        .m-label { font-size: 11px; font-weight: 800; color: var(--ff-green-dark); opacity: 0.6; text-transform: uppercase; display: flex; align-items: center; gap: 8px; }
        .m-value { font-size: 28px; font-weight: 900; color: var(--ff-green-dark); letter-spacing: -0.5px; }
        .m-value small { font-size: 16px; opacity: 0.5; font-weight: 700; margin-right: 4px; }

        /* TOOLBAR */
        .ff-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 20px; }
        .ff-search-group { display: flex; gap: 16px; flex-grow: 1; align-items: center; }
        
        .ff-input-wrapper { 
          position: relative; background: white; border: 1.5px solid rgba(34, 76, 34, 0.15); 
          border-radius: 12px; height: 44px; display: flex; align-items: center; padding: 0 14px; 
          color: var(--ff-green-dark); transition: 0.2s; max-width: 400px;
        }
        .ff-input-wrapper:focus-within { border-color: var(--ff-green); box-shadow: 0 0 0 3px rgba(34, 116, 50, 0.05); }
        .ff-input-wrapper input { 
          border: none; background: transparent; width: 100%; height: 100%; 
          outline: none; font-size: 13px; font-weight: 600; color: var(--ff-green-dark); padding-left: 10px;
        }
        .clear-icon { cursor: pointer; opacity: 0.4; transition: 0.2s; }
        .clear-icon:hover { opacity: 1; color: #ef4444; }

        .ff-filters-pills { display: flex; gap: 8px; }
        .ff-pill { 
          position: relative; padding: 0 16px; height: 36px; border-radius: 10px; 
          border: 1.5px solid rgba(34,76,34,0.15); background: white; font-size: 11px; 
          font-weight: 700; color: var(--ff-green-dark); cursor: pointer; transition: 0.2s; 
        }
        .ff-pill:hover { border-color: var(--ff-green); background: #f9fbf9; }
        .ff-pill.active { background: var(--ff-green-dark); color: white; border-color: var(--ff-green-dark); }
        .ff-pill.has-pulse::after { content: ''; position: absolute; top: -3px; right: -3px; width: 10px; height: 10px; background: var(--ff-orange); border-radius: 50%; border: 2px solid white; }

        .ff-btn-secondary { 
          background: white; border: 1.5px solid rgba(34, 76, 34, 0.15); padding: 0 16px; height: 44px;
          border-radius: 12px; font-weight: 700; font-size: 12px; display: flex; align-items: center; gap: 8px; 
          cursor: pointer; color: var(--ff-green-dark); transition: 0.2s; 
        }
        .ff-btn-secondary:hover { background: #f9fbf9; border-color: var(--ff-green); }

        /* LISTADO DE COTIZACIONES */
        .ff-list-container { background: white; border-radius: 20px; border: 1px solid rgba(34,76,34,0.08); box-shadow: 0 2px 10px rgba(0,0,0,0.02); overflow: hidden; }
        
        .ff-list-header { 
          display: grid;
          grid-template-columns: 240px 1.5fr 1fr 140px 140px;
          gap: 20px;
          align-items: center; padding: 16px 24px; border-bottom: 1px solid rgba(34,76,34,0.08);
          background: #f9fbf9; 
        }
        .ff-list-header div {
          font-family: 'Poppins', sans-serif;
          font-size: 10px; font-weight: 800; color: var(--ff-green-dark); opacity: 0.6; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .ff-list-header .col-amount { text-align: right; }
        .ff-list-header .col-status { display: flex; justify-content: flex-end; padding-right: 28px; }
        
        .ff-list-body { display: flex; flex-direction: column; }
        .ff-list-row { 
          display: grid;
          grid-template-columns: 240px 1.5fr 1fr 140px 140px;
          gap: 20px;
          align-items: center; padding: 14px 24px; 
          border-bottom: 1px solid rgba(34,76,34,0.04); cursor: pointer; transition: all 0.2s ease; background: white;
        }
        .ff-list-row:last-child { border-bottom: none; }
        .ff-list-row:hover { background: #fcfdfc; transform: translateY(-1px); box-shadow: 0 4px 10px rgba(34,76,34,0.03); border-color: var(--ff-green); }
        
        .ff-list-row.urgent { background: #fff5f5; border-bottom: 1px solid #fecdd3; }
        .ff-list-row.urgent:hover { border-color: #ef4444; }

        /* ESTRUCTURA INTERNA DE COLUMNAS */
        .col-code { display: flex; align-items: center; gap: 12px; }
        .col-client { font-size: 13px; font-weight: 600; color: var(--ff-green-dark); opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 20px; }
        .col-route { display: flex; flex-direction: column; justify-content: center; gap: 4px; }
        .col-amount { text-align: right; }
        .col-status { display: flex; align-items: center; justify-content: flex-end; gap: 12px; }

        .flex-col { display: flex; flex-direction: column; gap: 4px; }
        .code-text { font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 800; letter-spacing: -0.2px; color: var(--ff-green-dark); line-height: 1; }
        
        .product-stack { display: flex; align-items: center; gap: 8px; }
        .boxes-badge { font-size: 9px; font-weight: 800; background: rgba(34,76,34,0.06); color: var(--ff-green-dark); padding: 2px 6px; border-radius: 4px; line-height: 1.2; }
        .urgent .boxes-badge { background: #fee2e2; color: #ef4444; }
        .sub-text { font-size: 11px; font-weight: 600; color: var(--ff-green-dark); opacity: 0.7; }
        
        /* RUTA Y FECHA */
        .route-tags { display: flex; align-items: center; gap: 6px; }
        .r-tag { font-size: 10px; font-weight: 800; background: rgba(34,76,34,0.05); color: var(--ff-green-dark); padding: 4px 8px; border-radius: 6px; opacity: 0.7; transition: 0.2s; }
        .r-tag.dest { background: #e6efe2; opacity: 1; }
        .r-tag:hover { background: rgba(34,76,34,0.1); opacity: 1; }
        .r-tag.dest:hover { background: #d0ebd4; }
        .r-arrow { color: var(--ff-green-dark); opacity: 0.3; }
        .r-date { display: flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 700; color: var(--ff-green-dark); opacity: 0.5; margin-left: 2px; }
        .urgent .r-date { color: #ef4444; opacity: 0.8; }

        /* AMOUNT */
        .amount-text { font-size: 14px; font-weight: 700; color: var(--ff-green-dark); font-variant-numeric: tabular-nums; }
        .amount-text small { font-size: 11px; opacity: 0.5; margin-right: 2px; font-weight: 800; }
        .text-orange-600 { color: #ea580c; }

        /* ICONOS DE TRANSPORTE */
        .row-icon-box { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0; }
        .row-icon-box.air { background: #e0f2fe; color: #0284c7; } 
        .row-icon-box.sea { background: #f1f5f9; color: #475569; }

        /* STATUS BADGES */
        .status-badge { 
          font-size: 9px; font-weight: 800; padding: 6px 0; border-radius: 8px; letter-spacing: 0.5px; 
          width: 90px; text-align: center; display: inline-block; box-sizing: border-box;
        }
        .bg-slate-100 { background: #f1f5f9; color: #475569; } 
        .bg-amber-100 { background: #fef3c7; color: #b45309; } 
        .bg-blue-100 { background: #dbeafe; color: #1d4ed8; } 
        .bg-purple-100 { background: #f3e8ff; color: #7e22ce; } 
        .bg-emerald-100 { background: #d1fae5; color: #047857; } 
        .bg-sky-100 { background: #e0f2fe; color: #0369a1; } 
        .bg-orange-100 { background: #fff7ed; color: #ea580c; }
        .bg-rose-100 { background: #ffe4e6; color: #be123c; } 
        
        .row-chevron { color: var(--ff-green-dark); opacity: 0.2; transition: 0.2s; }
        .ff-list-row:hover .row-chevron { opacity: 1; transform: translateX(3px); }

        /* PAGINACIÓN */
        .ff-pagination { display: flex; justify-content: space-between; align-items: center; padding: 0 10px; margin-top: 10px; }
        .page-info { font-size: 12px; font-weight: 500; color: var(--ff-green-dark); opacity: 0.6; }
        .page-controls { display: flex; align-items: center; gap: 15px; }
        .page-controls button { background: white; border: 1px solid rgba(34,76,34,0.15); border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--ff-green-dark); transition: 0.2s; }
        .page-controls button:disabled { opacity: 0.3; cursor: not-allowed; }
        .page-controls button:hover:not(:disabled) { border-color: var(--ff-green); background: #f9fbf9; }
        .page-number { font-size: 12px; font-weight: 700; color: var(--ff-green-dark); }

        /* TOOLTIPS (NUEVOS COLORES DE MARCA) */
        .ff-tooltip-wrapper { position: relative; display: inline-flex; align-items: center; }
        .ff-tooltip-content {
          position: absolute; bottom: 120%; left: 50%; transform: translateX(-50%) translateY(10px);
          background: var(--ff-green-dark); color: white; padding: 10px 14px; border-radius: 12px;
          font-size: 11px; font-weight: 500; white-space: nowrap; z-index: 100;
          opacity: 0; visibility: hidden; pointer-events: none; transition: all 0.2s ease;
          box-shadow: 0 10px 25px -5px rgba(34, 76, 34, 0.4);
          border: 1px solid rgba(255,255,255,0.1);
        }
        .ff-tooltip-content::after {
          content: ''; position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
          border-width: 5px; border-style: solid; border-color: var(--ff-green-dark) transparent transparent transparent;
        }
        .ff-tooltip-wrapper:hover .ff-tooltip-content { opacity: 1; visibility: visible; transform: translateX(-50%) translateY(0); }
        .loc-tooltip { display: flex; flex-direction: column; gap: 4px; align-items: center; }
        .loc-tooltip strong { font-size: 12px; font-weight: 800; color: var(--ff-orange); letter-spacing: 0.5px; }
        .tooltip-trigger { cursor: help; }

        /* SKELETON & EMPTY */
        .skeleton-row { pointer-events: none; opacity: 0.6; }
        .skel-line { height: 12px; background: rgba(34,76,34,0.05); border-radius: 4px; margin-bottom: 6px; }
        .skel-pill { height: 24px; background: rgba(34,76,34,0.05); border-radius: 8px; }
        .w40 { width: 40px; } .w50 { width: 50%; } .w60 { width: 60%; } .w70 { width: 70%; } .w80 { width: 80%; } .w100 { width: 100%; }
        
        .ff-empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; color: var(--ff-green-dark); opacity: 0.5; gap: 12px; }
        .ff-empty-state p { margin: 0; font-size: 13px; font-weight: 600; }

        @keyframes pulse-orange { 0% { box-shadow: 0 0 0 0 rgba(209, 119, 17, 0.7); } 100% { box-shadow: 0 0 0 6px rgba(209, 119, 17, 0); } }
      `}</style>
    </AdminLayout>
  );
}