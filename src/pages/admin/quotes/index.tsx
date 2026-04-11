import { useCallback, useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom"; 
import { 
  PlusCircle, Search, Plane, Ship, 
  CheckCircle, SortAsc, AlertCircle, TrendingUp, ChevronRight, X,
  Calendar, FileText, ArrowRight, ChevronLeft, MessageSquare, Archive
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
    case 'archived': return { label: 'ARCHIVADA', class: 'bg-gray-200 text-gray-500' };
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
  
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [sortField, setSortField] = useState("created_at");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const itemsPerPage = 12;

  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
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
      p.set("sortField", sortField);
      if (status) p.set("status", status);
      p.set("page", "1");
      p.set("pageSize", "1000"); 
      
      const url = `${getApiBase()}/.netlify/functions/listQuotes?${p.toString()}&t=${new Date().getTime()}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` } });
      
      if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
      const json = await res.json() as ApiResponse;
      
      setItems(json.items || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [dir, sortField, status, navigate]);

  useEffect(() => {
    requireAdminOrRedirect().then(r => {
      if (r.ok) {
        load();
        loadGlobalStats();
      } else setAuthOk(false);
    });
  }, [load]);

  useEffect(() => {
    async function fetchUnreadMessages() {
      if (items.length === 0) return;
      const quoteIds = items.map(i => i.id);
      
      try {
        const { data } = await supabase
          .from('quote_activity')
          .select('quote_id')
          .eq('is_read', false)
          .eq('sender_role', 'client')
          .in('quote_id', quoteIds);
          
        if (data) {
          const counts: Record<string, number> = {};
          data.forEach(msg => {
            counts[msg.quote_id] = (counts[msg.quote_id] || 0) + 1;
          });
          setUnreadCounts(counts);
        }
      } catch (err) { console.error("Error al buscar mensajes:", err); }
    }
    fetchUnreadMessages();
  }, [items]);

  const handleArchive = async (e: React.MouseEvent, id: string, currentStatus: string) => {
    e.stopPropagation(); 
    if (currentStatus === 'archived') {
      alert("Esta cotización ya está archivada.");
      return;
    }
    const confirm = window.confirm("¿Estás seguro de archivar esta cotización? Esto la ocultará del cliente y cancelará cualquier embarque asociado.");
    if (!confirm) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No hay sesión de usuario activa.");

      const { data: fullQuote, error: fetchErr } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', id)
        .single();
        
      if (fetchErr) throw fetchErr;

      const payload = {
        id: id,
        total: fullQuote.total || fullQuote.total_amount,
        status: 'archived',
        mode: fullQuote.mode,
        origin: fullQuote.origin,
        destination: fullQuote.destination,
        boxes: fullQuote.boxes,
        weight_kg: fullQuote.weight_kg,
        terms: fullQuote.terms,
        payment_terms: fullQuote.payment_terms,
        valid_until: fullQuote.valid_until,
        costs: fullQuote.costs,
        totals: fullQuote.totals,
        product_id: fullQuote.product_id,
        product_details: fullQuote.product_details
      };

      const res = await fetch(`${getApiBase()}/.netlify/functions/updateQuote`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${session.access_token}` 
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Fallo en el servidor al intentar archivar.");

      await supabase
        .from('shipments')
        .update({ status: 'CANCELLED' })
        .eq('quote_id', id);

      load(); 
      loadGlobalStats();
      
    } catch (err: any) {
      alert("Error al archivar: " + err.message);
    }
  };

  // 🚨 LÓGICA DE BÚSQUEDA, ORDENAMIENTO Y OCULTAMIENTO EN EL FRONTEND
  const filteredItems = useMemo(() => {
    let result = [...items];

    // 1. REGLA MAESTRA: Ocultar archivadas de la vista general.
    // Solo se muestran si el usuario hace clic explícitamente en el filtro "Archivada"
    if (status !== 'archived') {
      result = result.filter(r => r.status?.toLowerCase() !== 'archived');
    }

    // 2. Filtrar por búsqueda
    if (q.trim()) {
      const lowerQ = q.toLowerCase();
      result = result.filter(r => {
        const code = (r.quote_number || r.quote_no || "").toLowerCase();
        const client = (r.client_name || r.client_snapshot?.name || "").toLowerCase();
        const origin = (r.origin || "").toLowerCase();
        const dest = (r.destination || "").toLowerCase();
        return code.includes(lowerQ) || client.includes(lowerQ) || origin.includes(lowerQ) || dest.includes(lowerQ);
      });
    }

    // 3. Ordenar
    result.sort((a, b) => {
      let valA: any = a[sortField as keyof QuoteRow] || '';
      let valB: any = b[sortField as keyof QuoteRow] || '';

      if (sortField === 'created_at') {
        valA = new Date(a.created_at).getTime();
        valB = new Date(b.created_at).getTime();
      }

      if (valA < valB) return dir === 'asc' ? -1 : 1;
      if (valA > valB) return dir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [items, q, sortField, dir, status]);

  const totalFiltered = filteredItems.length;
  const totalPages = Math.ceil(totalFiltered / itemsPerPage) || 1;
  
  const paginatedItems = useMemo(() => {
    const startIndex = (page - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, page, itemsPerPage]);

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
                placeholder="Buscar cliente, destino o código..." 
                value={q} 
                onChange={e => { setQ(e.target.value); setPage(1); }} 
              />
              {q && <X size={14} className="clear-icon" onClick={() => { setQ(""); setPage(1); }} />}
            </div>
            
            <select 
              className="ff-sort-select"
              value={sortField}
              onChange={(e) => { setSortField(e.target.value); setPage(1); }}
            >
              <option value="created_at">Por Fecha</option>
              <option value="quote_number">Por Número</option>
              <option value="destination">Por Destino</option>
            </select>
            
            <div className="ff-filters-pills">
              {['Solicitud', 'draft', 'sent', 'approved', 'archived'].map(s => {
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
            <SortAsc size={14} /> {dir === 'desc' ? 'Más Recientes' : 'Más Antiguos'}
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
            {loading ? ( <><QuoteSkeleton /><QuoteSkeleton /><QuoteSkeleton /></> ) : paginatedItems.length === 0 ? (
              <div className="ff-empty-state">
                <FileText size={32} />
                <p>No se encontraron cotizaciones activas.</p>
              </div>
            ) : (
              paginatedItems.map((r) => {
                const isRequest = r.status === 'Solicitud';
                const isArchived = r.status === 'archived';
                const statusConf = getStatusConfig(r.status);
                const displayId = r.quote_number || r.quote_no || `RFQ-${r.id.slice(0,5).toUpperCase()}`;
                const shipmentDate = r.product_details?.requested_shipment_date;
                
                const hasUnread = unreadCounts[r.id] > 0;

                let details = r.product_details;
                if (typeof details === 'string') {
                  try { details = JSON.parse(details); } catch { details = {}; }
                }
                const variety = details?.variety || details?.customer_label || "";
                const productInfo = variety.toLowerCase().includes('piña') ? variety : `Piña ${variety}`.trim();

                return (
                  <div 
                    key={r.id} 
                    className={`ff-list-row ${isRequest ? 'urgent' : ''} ${isArchived ? 'archived-row' : ''}`} 
                    onClick={() => r.id && navigate(`/admin/quotes/${r.id}`)}
                  > 
                    <div className="col-code">
                      <TransportIcon mode={r.mode || 'SEA'} />
                      <div className="flex-col">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="code-text">{displayId}</span>
                          {hasUnread && (
                            <div className="unread-bubble" title="Nuevo mensaje del cliente">
                              <div className="pulse-dot"></div>
                              <MessageSquare size={12} />
                            </div>
                          )}
                        </div>
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
                      
                      <div className="row-actions">
                        <button 
                          className="archive-btn" 
                          title={isArchived ? "Archivada" : "Archivar (Ocultar al cliente)"}
                          onClick={(e) => handleArchive(e, r.id, r.status)}
                        >
                          <Archive size={14} />
                        </button>
                        <ChevronRight size={16} className="row-chevron" />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* PAGINACIÓN ELEGANTE */}
        {!loading && totalFiltered > 0 && (
          <div className="ff-pagination">
            <span className="page-info">Mostrando {((page - 1) * itemsPerPage) + 1} - {Math.min(page * itemsPerPage, totalFiltered)} de {totalFiltered} resultados</span>
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

        /* TOOLBAR Y NUEVO SELECTOR DE ORDEN */
        .ff-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 15px; flex-wrap: wrap; }
        .ff-search-group { display: flex; gap: 12px; flex-grow: 1; align-items: center; flex-wrap: wrap; }
        
        .ff-input-wrapper { 
          position: relative; background: white; border: 1.5px solid rgba(34, 76, 34, 0.15); 
          border-radius: 10px; height: 40px; display: flex; align-items: center; padding: 0 14px; 
          color: var(--ff-green-dark); transition: 0.2s; min-width: 250px; flex: 1; max-width: 350px;
        }
        .ff-input-wrapper:focus-within { border-color: var(--ff-green); box-shadow: 0 0 0 3px rgba(34, 116, 50, 0.05); }
        .ff-input-wrapper input { 
          border: none; background: transparent; width: 100%; height: 100%; 
          outline: none; font-size: 12px; font-weight: 600; color: var(--ff-green-dark); padding-left: 10px;
        }
        .clear-icon { cursor: pointer; opacity: 0.4; transition: 0.2s; }
        .clear-icon:hover { opacity: 1; color: #ef4444; }

        .ff-sort-select {
          height: 40px; border-radius: 10px; border: 1.5px solid rgba(34, 76, 34, 0.15);
          padding: 0 12px; font-size: 12px; font-weight: 700; color: var(--ff-green-dark);
          background: white; outline: none; cursor: pointer; transition: 0.2s;
        }
        .ff-sort-select:hover { border-color: var(--ff-green); }

        .ff-filters-pills { display: flex; gap: 6px; flex-wrap: wrap; }
        .ff-pill { 
          position: relative; padding: 0 12px; height: 32px; border-radius: 8px; 
          border: 1px solid rgba(34,76,34,0.15); background: white; font-size: 10.5px; 
          font-weight: 700; color: var(--ff-green-dark); cursor: pointer; transition: 0.2s; 
        }
        .ff-pill:hover { border-color: var(--ff-green); background: #f9fbf9; }
        .ff-pill.active { background: var(--ff-green-dark); color: white; border-color: var(--ff-green-dark); }
        .ff-pill.has-pulse::after { content: ''; position: absolute; top: -3px; right: -3px; width: 10px; height: 10px; background: var(--ff-orange); border-radius: 50%; border: 2px solid white; }

        .ff-btn-secondary { 
          background: white; border: 1.5px solid rgba(34, 76, 34, 0.15); padding: 0 16px; height: 40px;
          border-radius: 10px; font-weight: 700; font-size: 12px; display: flex; align-items: center; gap: 8px; 
          cursor: pointer; color: var(--ff-green-dark); transition: 0.2s; flex-shrink: 0;
        }
        .ff-btn-secondary:hover { background: #f9fbf9; border-color: var(--ff-green); }

        /* LISTADO DE COTIZACIONES */
        .ff-list-container { background: white; border-radius: 20px; border: 1px solid rgba(34,76,34,0.08); box-shadow: 0 2px 10px rgba(0,0,0,0.02); overflow: hidden; margin-top: 5px; }
        
        .ff-list-header { 
          display: grid;
          grid-template-columns: 260px 1.5fr 1fr 140px 160px;
          gap: 20px;
          align-items: center; padding: 16px 24px; border-bottom: 1px solid rgba(34,76,34,0.08);
          background: #f9fbf9; 
        }
        .ff-list-header div {
          font-family: 'Poppins', sans-serif;
          font-size: 10px; font-weight: 800; color: var(--ff-green-dark); opacity: 0.6; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .ff-list-header .col-amount { text-align: right; }
        .ff-list-header .col-status { display: flex; justify-content: flex-end; padding-right: 32px; }
        
        .ff-list-body { display: flex; flex-direction: column; }
        .ff-list-row { 
          display: grid;
          grid-template-columns: 260px 1.5fr 1fr 140px 160px;
          gap: 20px;
          align-items: center; padding: 14px 24px; 
          border-bottom: 1px solid rgba(34,76,34,0.04); cursor: pointer; transition: all 0.2s ease; background: white;
        }
        .ff-list-row:last-child { border-bottom: none; }
        .ff-list-row:hover { background: #fcfdfc; transform: translateY(-1px); box-shadow: 0 4px 10px rgba(34,76,34,0.03); border-color: var(--ff-green); z-index: 10; position: relative; }
        
        /* ESTADOS ESPECIALES DE FILA */
        .ff-list-row.urgent { background: #fff5f5; border-bottom: 1px solid #fecdd3; }
        .ff-list-row.urgent:hover { border-color: #ef4444; }
        .ff-list-row.archived-row { opacity: 0.5; filter: grayscale(100%); background: #f8fafc; }
        .ff-list-row.archived-row:hover { opacity: 0.8; filter: none; }

        /* ESTRUCTURA INTERNA DE COLUMNAS */
        .col-code { display: flex; align-items: center; gap: 12px; }
        .col-client { font-size: 13px; font-weight: 600; color: var(--ff-green-dark); opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 20px; }
        .col-route { display: flex; flex-direction: column; justify-content: center; gap: 4px; }
        .col-amount { text-align: right; }
        .col-status { display: flex; align-items: center; justify-content: flex-end; gap: 10px; }

        .flex-col { display: flex; flex-direction: column; gap: 4px; }
        .code-text { font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 800; letter-spacing: -0.2px; color: var(--ff-green-dark); line-height: 1; }
        
        /* BURBUJA DE MENSAJE NO LEÍDO */
        .unread-bubble { 
          display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; 
          background: #fee2e2; color: #ef4444; border-radius: 6px; position: relative; 
        }
        .unread-bubble .pulse-dot { 
          position: absolute; top: -3px; right: -3px; width: 8px; height: 8px; 
          background: #ef4444; border-radius: 50%; border: 1.5px solid white; animation: pulse-orange 1.5s infinite; 
        }

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

        /* STATUS BADGES Y ACCIONES */
        .status-badge { 
          font-size: 9px; font-weight: 800; padding: 6px 0; border-radius: 6px; letter-spacing: 0.5px; 
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
        .bg-gray-200 { background: #e2e8f0; color: #64748b; }
        
        .row-actions { display: flex; align-items: center; gap: 8px; margin-left: 5px; }
        
        .archive-btn { 
          background: transparent; border: none; color: #94a3b8; cursor: pointer; padding: 4px; 
          border-radius: 6px; transition: 0.2s; display: flex; align-items: center; justify-content: center;
        }
        .archive-btn:hover { background: #fee2e2; color: #ef4444; }
        .archived-row .archive-btn { color: #cbd5e1; cursor: not-allowed; }
        .archived-row .archive-btn:hover { background: transparent; color: #cbd5e1; }

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

        /* TOOLTIPS */
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

        @keyframes pulse-orange { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6); } 100% { box-shadow: 0 0 0 5px rgba(239, 68, 68, 0); } }
      `}</style>
    </AdminLayout>
  );
}