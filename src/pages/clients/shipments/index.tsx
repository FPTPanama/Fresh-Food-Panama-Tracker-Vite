import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  Search, Calendar, Package, RefreshCcw, Plane, ArrowRight, 
  Ship, ChevronRight, ChevronLeft, Loader2
} from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { getApiBase } from "../../../lib/apiBase";
import { ClientLayout } from "../../../components/ClientLayout";
import { useUILang } from "../../../lib/uiLanguage";

// --- HELPERS UI (Unificados con Admin + Traducción) ---
const getStatusConfig = (status: string, lang: 'es' | 'en') => {
  const s = status?.toLowerCase() || '';
  switch(s) {
    case 'created': return { label: lang === 'es' ? 'CREADO' : 'CREATED', class: 'bg-slate-100 text-slate-600' };
    case 'packed': return { label: lang === 'es' ? 'EMPACADO' : 'PACKED', class: 'bg-amber-100 text-amber-700' };
    case 'in_transit': return { label: lang === 'es' ? 'EN TRÁNSITO' : 'IN TRANSIT', class: 'bg-blue-100 text-blue-700' };
    case 'at_destination': return { label: lang === 'es' ? 'EN DESTINO' : 'ARRIVED', class: 'bg-purple-100 text-purple-700' };
    case 'delivered': return { label: lang === 'es' ? 'ENTREGADO' : 'DELIVERED', class: 'bg-emerald-100 text-emerald-700' };
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

export default function ShipmentsPage() {
  const navigate = useNavigate();
  const { lang } = useUILang();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros y Paginación
  const [search, setSearch] = useState("");
  const [destFilter, setDestFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 12;

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        navigate("/login");
        return;
      }

      const params = new URLSearchParams({ 
        page: page.toString(), 
        pageSize: itemsPerPage.toString(), 
        q: search, 
        destination: destFilter 
      });

      const res = await fetch(`${getApiBase()}/.netlify/functions/listShipments?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      
      setItems(json.items || []);
      setTotalItems(json.total || 0);
    } catch (e) { 
      console.error("Error cargando embarques:", e); 
    } finally { 
      setLoading(false); 
    }
  }, [search, destFilter, page, navigate]);

  useEffect(() => { 
    const delay = setTimeout(() => fetchShipments(), 300);
    return () => clearTimeout(delay);
  }, [fetchShipments]);

  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const handlePrevPage = () => setPage(p => Math.max(1, p - 1));
  const handleNextPage = () => setPage(p => Math.min(totalPages, p + 1));

  return (
    <ClientLayout title={lang === 'es' ? "Mis Embarques" : "My Shipments"} subtitle={lang === 'es' ? "Seguimiento de carga en tiempo real" : "Real-time cargo tracking"}>
      <div className="ff-shipments-index">
        
        {/* TOOLBAR UNIFICADA */}
        <div className="ff-toolbar">
          <div className="ff-search-group">
            <div className="ff-input-wrapper flex-grow">
              <Search size={16} />
              <input 
                placeholder={lang === 'es' ? "Buscar guía, contenedor o destino..." : "Search AWB, container or destination..."}
                value={search} 
                onChange={(e) => { setSearch(e.target.value); setPage(1); }} 
              />
            </div>
            <div className="ff-input-wrapper width-180">
              <select value={destFilter} onChange={(e) => { setDestFilter(e.target.value); setPage(1); }}>
                <option value="">{lang === 'es' ? 'Todos los Destinos' : 'All Destinations'}</option>
                <option value="MAD">Madrid (MAD)</option>
                <option value="AMS">Amsterdam (AMS)</option>
                <option value="CDG">Paris (CDG)</option>
                <option value="MXP">Milán (MXP)</option>
              </select>
            </div>
            <button className="ff-btn-icon" onClick={fetchShipments} title={lang === 'es' ? 'Actualizar' : 'Refresh'}>
              <RefreshCcw size={16} />
            </button>
          </div>
        </div>

        {/* CONTENEDOR DE LA LISTA */}
        <div className="ff-list-container">
          
          {/* ENCABEZADOS DE COLUMNA ALINEADOS POR GRID */}
          <div className="ff-list-header">
            <div className="col-code">{lang === 'es' ? 'ID EMBARQUE' : 'SHIPMENT ID'}</div>
            <div className="col-product">{lang === 'es' ? 'PRODUCTO' : 'PRODUCT'}</div>
            <div className="col-route">{lang === 'es' ? 'RUTA' : 'ROUTE'}</div>
            <div className="col-date">{lang === 'es' ? 'FECHAS' : 'DATES'}</div>
            <div className="col-status">{lang === 'es' ? 'ESTADO' : 'STATUS'}</div>
          </div>

          <div className="ff-list-body">
            {loading ? (
              <div className="ff-loading-state">
                <Loader2 className="animate-spin ff-loader-icon" size={36} />
                <span>{lang === 'es' ? 'Sincronizando con aerolíneas...' : 'Syncing with airlines...'}</span>
              </div>
            ) : items.length === 0 ? (
              <div className="ff-empty-state">
                <Package size={36} />
                <p>{lang === 'es' ? 'No se encontraron embarques activos en su historial.' : 'No active shipments found in your history.'}</p>
              </div>
            ) : (
              items.map(s => {
                const statusConf = getStatusConfig(s.status, lang as 'es' | 'en');
                const prodName = s.product_name || 'Piña Premium';
                const prodVariety = s.product_variety || 'MD2 Golden';
                const etdDate = s.etd || s.shipment_date || s.departure_date;

                return (
                  <Link key={s.id} to={`/clients/shipments/${s.id}`} className="ff-list-row">
                    
                    <div className="col-code">
                      <TransportIcon mode={s.product_mode || s.mode || 'AIR'} />
                      <span className="code-text">{s.code}</span>
                    </div>

                    <div className="col-product flex-col">
                      <span className="product-text">{prodName} {prodVariety}</span>
                      <div className="cargo-tags">
                        <span className="boxes-badge">{s.boxes || 0} {lang === 'es' ? 'CAJAS' : 'BOXES'}</span>
                        {s.pallets && <span className="boxes-badge pallets">{s.pallets} {lang === 'es' ? 'PALL' : 'PALL'}</span>}
                      </div>
                    </div>

                    <div className="col-route">
                      <div className="route-tags">
                        <span className="r-tag">{s.origin || 'PTY'}</span>
                        <ArrowRight size={12} className="r-arrow" />
                        <span className="r-tag dest">{s.destination || 'TBD'}</span>
                      </div>
                    </div>

                    <div className="col-date flex-col-dates">
                      <div className="date-main">
                        <Calendar size={12} className="date-icon" />
                        <span>{new Date(s.created_at).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { day: '2-digit', month: 'short' })}</span>
                      </div>
                      {etdDate && (
                        <div className="date-sub">
                          ETD: {new Date(etdDate).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { day: '2-digit', month: 'short' })}
                        </div>
                      )}
                    </div>

                    <div className="col-status">
                      <span className={`status-badge ${statusConf.class}`}>{statusConf.label}</span>
                      <ChevronRight size={16} className="row-chevron" />
                    </div>

                  </Link>
                )
              })
            )}
          </div>
        </div>

        {/* PAGINACIÓN */}
        {!loading && totalItems > itemsPerPage && (
          <div className="ff-pagination">
            <span className="page-info">
              {lang === 'es' ? 'Mostrando' : 'Showing'} {((page - 1) * itemsPerPage) + 1} - {Math.min(page * itemsPerPage, totalItems)} {lang === 'es' ? 'de' : 'of'} {totalItems}
            </span>
            <div className="page-controls">
              <button onClick={handlePrevPage} disabled={page === 1}><ChevronLeft size={16} /></button>
              <span className="page-number">{lang === 'es' ? 'Página' : 'Page'} {page} {lang === 'es' ? 'de' : 'of'} {totalPages}</span>
              <button onClick={handleNextPage} disabled={page === totalPages}><ChevronRight size={16} /></button>
            </div>
          </div>
        )}

      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .ff-shipments-index { display: flex; flex-direction: column; gap: 20px; font-family: 'Poppins', sans-serif !important; padding-bottom: 40px; }
        
        /* TOOLBAR UNIFICADA */
        .ff-toolbar { display: flex; justify-content: flex-start; align-items: center; gap: 20px; }
        .ff-search-group { display: flex; gap: 12px; flex-grow: 1; max-width: 700px; }
        
        .ff-input-wrapper { 
          position: relative; background: white; border: 1px solid rgba(34, 76, 34, 0.12); 
          border-radius: 12px; height: 44px; display: flex; align-items: center; padding: 0 14px; 
          color: var(--ff-green-dark); transition: all 0.2s ease; box-shadow: 0 2px 5px rgba(0,0,0,0.01);
        }
        .ff-input-wrapper:focus-within { border-color: var(--ff-green); box-shadow: 0 0 0 3px rgba(34, 116, 50, 0.05); }
        .ff-input-wrapper input, .ff-input-wrapper select { 
          border: none; background: transparent; width: 100%; height: 100%; 
          outline: none; font-size: 13px; font-weight: 600; color: var(--ff-green-dark); padding-left: 10px; cursor: pointer;
        }
        .ff-input-wrapper select { appearance: none; }
        
        .ff-btn-icon { background: white; border: 1px solid rgba(34, 76, 34, 0.12); border-radius: 12px; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--ff-green-dark); transition: 0.2s; box-shadow: 0 2px 5px rgba(0,0,0,0.01); }
        .ff-btn-icon:hover { border-color: var(--ff-green); background: #f9fbf9; transform: translateY(-1px); }

        /* CONTENEDOR DE LISTA */
        .ff-list-container { background: white; border-radius: 20px; border: 1px solid rgba(34,76,34,0.08); box-shadow: 0 6px 20px rgba(34,76,34,0.04); overflow: hidden; }
        
        /* ESTRUCTURA GRID */
        .ff-list-header { 
          display: grid; 
          grid-template-columns: 180px 1.5fr 1.5fr 120px 120px; 
          gap: 20px;
          align-items: center; 
          padding: 16px 24px; 
          border-bottom: 1px solid rgba(34,76,34,0.08);
          background: #f9fbf9; 
        }
        .ff-list-header div {
          font-family: 'Poppins', sans-serif;
          font-size: 10px; font-weight: 800; color: var(--ff-green-dark); 
          opacity: 0.6; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .ff-list-header .col-status { display: flex; justify-content: flex-end; padding-right: 28px; }
        
        .ff-list-body { display: flex; flex-direction: column; }
        .ff-list-row { 
          display: grid; 
          grid-template-columns: 180px 1.5fr 1.5fr 120px 120px; 
          gap: 20px;
          align-items: center; 
          padding: 14px 24px; 
          border-bottom: 1px solid rgba(34,76,34,0.04); 
          cursor: pointer; transition: all 0.2s ease; background: white;
          text-decoration: none;
        }
        .ff-list-row:last-child { border-bottom: none; }
        .ff-list-row:hover { background-color: #f8faf9; }

        /* ESTILOS INTERNOS DE COLUMNAS */
        .col-code { display: flex; align-items: center; gap: 12px; }
        .col-product { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; justify-content: center; }
        .col-route { display: flex; align-items: center; }
        .col-status { display: flex; align-items: center; justify-content: flex-end; gap: 12px; }

        .flex-col { display: flex; flex-direction: column; gap: 4px; }
        .code-text { font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 800; letter-spacing: -0.2px; color: var(--ff-green-dark); }
        
        .product-text { font-size: 13px; font-weight: 700; color: var(--ff-green-dark); opacity: 0.8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
        
        .cargo-tags { display: flex; gap: 6px; }
        .boxes-badge { font-size: 9px; font-weight: 800; background: rgba(34,76,34,0.06); color: var(--ff-green-dark); padding: 3px 8px; border-radius: 6px; display: inline-block; width: fit-content; }
        .boxes-badge.pallets { background: #e0e7ff; color: #3730a3; }
        
        /* FECHAS APILADAS */
        .flex-col-dates { display: flex; flex-direction: column; justify-content: center; gap: 4px; }
        .date-main { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: var(--ff-green-dark); opacity: 0.9; }
        .date-icon { opacity: 0.5; }
        .date-sub { font-size: 10px; font-weight: 800; color: var(--ff-green-dark); opacity: 0.5; margin-left: 2px; text-transform: uppercase; }

        /* RUTA LIMPIA */
        .route-tags { display: flex; align-items: center; gap: 8px; }
        .r-tag { font-size: 11px; font-weight: 800; background: rgba(34,76,34,0.06); color: var(--ff-green-dark); padding: 4px 10px; border-radius: 6px; opacity: 0.8; }
        .r-tag.dest { background: #e6efe2; opacity: 1; }
        .r-arrow { color: var(--ff-green-dark); opacity: 0.3; }

        /* ICONOS DE TRANSPORTE */
        .row-icon-box { display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0; }
        .row-icon-box.air { background: #e0f2fe; color: #0284c7; } 
        .row-icon-box.sea { background: #f1f5f9; color: #475569; }

        /* STATUS BADGES */
        .status-badge { 
          font-size: 9px; 
          font-weight: 800; 
          padding: 6px 0; 
          border-radius: 8px; 
          letter-spacing: 0.5px;
          width: 90px; 
          text-align: center;
          display: inline-block;
          box-sizing: border-box;
        }
        .bg-slate-100 { background: #f1f5f9; } .text-slate-600 { color: #475569; }
        .bg-amber-100 { background: #fef3c7; } .text-amber-700 { color: #b45309; }
        .bg-blue-100 { background: #dbeafe; } .text-blue-700 { color: #1d4ed8; }
        .bg-purple-100 { background: #f3e8ff; } .text-purple-700 { color: #7e22ce; }
        .bg-emerald-100 { background: #d1fae5; } .text-emerald-700 { color: #047857; }
        
        .row-chevron { color: var(--ff-green-dark); opacity: 0.2; transition: 0.2s; }
        .ff-list-row:hover .row-chevron { opacity: 1; transform: translateX(3px); }

        /* PAGINACIÓN */
        .ff-pagination { display: flex; justify-content: space-between; align-items: center; padding: 0 10px; margin-top: 10px; }
        .page-info { font-size: 12px; font-weight: 500; color: var(--ff-green-dark); opacity: 0.6; }
        .page-controls { display: flex; align-items: center; gap: 15px; }
        .page-controls button { background: white; border: 1px solid rgba(34,76,34,0.15); border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--ff-green-dark); transition: 0.2s; box-shadow: 0 2px 5px rgba(0,0,0,0.02);}
        .page-controls button:disabled { opacity: 0.3; cursor: not-allowed; box-shadow: none; }
        .page-controls button:hover:not(:disabled) { border-color: var(--ff-green); background: #f9fbf9; transform: translateY(-1px); }
        .page-number { font-size: 12px; font-weight: 700; color: var(--ff-green-dark); }

        /* EMPTY Y LOADING STATES */
        .ff-loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 250px; gap: 16px; }
        .ff-loader-icon { color: var(--ff-green-dark); opacity: 0.5; }
        .ff-loading-state span { font-size: 11px; font-weight: 800; color: var(--ff-green-dark); opacity: 0.6; text-transform: uppercase; letter-spacing: 2px; }
        
        .ff-empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; background: white; color: var(--ff-green-dark); opacity: 0.6; gap: 12px; }
        .ff-empty-state p { margin: 0; font-size: 13px; font-weight: 600; }
        
        .flex-grow { flex-grow: 1; }
        .width-180 { width: 180px; }
      ` }} />
    </ClientLayout>
  );
}