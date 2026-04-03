import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, Plus, Filter, ChevronLeft, ChevronRight, 
  ArrowRight, Ship, Plane, Package, Calendar
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { AdminLayout } from "@/components/AdminLayout";
import { useNavigate } from 'react-router-dom';

// --- HELPERS DE UI (Para consistencia total con el Dashboard) ---
const getStatusConfig = (status: string) => {
  const s = status?.toLowerCase() || '';
  switch(s) {
    case 'created': return { label: 'CREADO', class: 'bg-slate-100 text-slate-600' };
    case 'packed': return { label: 'EMPACADO', class: 'bg-amber-100 text-amber-700' };
    case 'in_transit': return { label: 'EN TRÁNSITO', class: 'bg-blue-100 text-blue-700' };
    case 'at_destination': return { label: 'EN DESTINO', class: 'bg-purple-100 text-purple-700' };
    case 'delivered': return { label: 'ENTREGADO', class: 'bg-emerald-100 text-emerald-700' };
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

export default function AdminShipmentsPage() {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // --- ESTADOS DE FILTRO Y PAGINACIÓN ---
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 12; 

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('shipments')
        .select('*, clients(name)', { count: 'exact' });

      // FIX: Buscador Universal 360 REAL (Ahora incluye Búsqueda por Origen)
      if (search) {
        const safeSearchTerm = `"%${search}%"`;
        
        const { data: clientMatches } = await supabase
          .from('clients')
          .select('id')
          .ilike('name', `%${search}%`);
          
        const clientIds = clientMatches?.map(c => `"${c.id}"`) || [];

        // Agregamos origin.ilike para que puedas buscar "BOG", "PTY", etc.
        let orString = `code.ilike.${safeSearchTerm},destination.ilike.${safeSearchTerm},origin.ilike.${safeSearchTerm}`;
        
        if (clientIds.length > 0) {
          orString += `,client_id.in.(${clientIds.join(',')})`;
        }
        
        query = query.or(orString);
      }

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      
      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      setShipments(data || []);
      if (count !== null) setTotalItems(count);
      
    } catch (error) {
      console.error("Error fetching shipments:", error);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => { 
    const delay = setTimeout(() => fetchShipments(), 300);
    return () => clearTimeout(delay);
  }, [fetchShipments]);

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const handlePrevPage = () => setPage(p => Math.max(1, p - 1));
  const handleNextPage = () => setPage(p => Math.min(totalPages, p + 1));

  return (
    <AdminLayout title="Panel Logístico" subtitle="Administración central de embarques y carga activa">
      <div className="ff-shipments-index">
        
        {/* TOOLBAR UNIFICADA */}
        <div className="ff-toolbar">
          <div className="ff-search-group">
            <div className="ff-input-wrapper flex-grow">
              <Search size={16} />
              <input 
                placeholder="Buscar por código, destino, origen o cliente..." 
                value={search} 
                onChange={(e) => { setSearch(e.target.value); setPage(1); }} 
              />
            </div>
            <div className="ff-input-wrapper width-180">
              <Filter size={16} />
              <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                <option value="">Todos los estados</option>
                <option value="CREATED">Creados</option>
                <option value="PACKED">Empacados</option>
                <option value="IN_TRANSIT">En Tránsito</option>
                <option value="AT_DESTINATION">En Destino</option>
                <option value="DELIVERED">Entregados</option>
              </select>
            </div>
          </div>
          
          <button className="ff-btn-primary" onClick={() => navigate('/admin/shipments/new')}>
            <Plus size={16} /> Nuevo Embarque
          </button>
        </div>

        {/* CONTENEDOR DE LA LISTA */}
        <div className="ff-list-container">
          
          {/* ENCABEZADOS DE COLUMNA ALINEADOS POR GRID */}
          <div className="ff-list-header">
            <div className="col-code">ID EMBARQUE</div>
            <div className="col-product">PRODUCTO</div>
            <div className="col-client">CLIENTE</div>
            <div className="col-route">RUTA & CARGA</div>
            <div className="col-date">CREACIÓN</div>
            <div className="col-status">ESTADO</div>
          </div>

          <div className="ff-list-body">
            {loading ? (
              <div className="ff-loading-state">
                <div className="ff-loader-ring"></div>
                <span>Cargando embarques...</span>
              </div>
            ) : shipments.length === 0 ? (
              <div className="ff-empty-state">
                <Package size={32} />
                <p>No se encontraron embarques que coincidan con la búsqueda.</p>
              </div>
            ) : (
              shipments.map(s => {
                const statusConf = getStatusConfig(s.status);
                
                const prodName = s.product_name || 'Piña';
                const prodVariety = s.product_variety || 'MD2 Golden';

                const etdDate = s.etd || s.shipment_date || s.departure_date || s.product_details?.requested_shipment_date;

                return (
                  <div key={s.id} className="ff-list-row" onClick={() => navigate(`/admin/shipments/${s.id}`)}>
                    
                    <div className="col-code">
                      <TransportIcon mode={s.mode || 'SEA'} />
                      <span className="code-text">{s.code}</span>
                    </div>

                    <div className="col-product flex-col">
                      <span className="product-text">{prodName} {prodVariety}</span>
                      <span className="boxes-badge">{s.boxes || 0} CAJAS</span>
                    </div>

                    <div className="col-client font-semi">
                      {s.clients?.name || 'Cliente Desconocido'}
                    </div>

                    <div className="col-route">
                      <div className="route-tags">
                        {/* AQUÍ ESTÁ EL ORIGEN DINÁMICO */}
                        <span className="r-tag">{s.origin || 'PTY'}</span>
                        <ArrowRight size={12} className="r-arrow" />
                        <span className="r-tag dest">{s.destination || 'TBD'}</span>
                      </div>
                    </div>

                    <div className="col-date flex-col-dates">
                      <div className="date-main">
                        <Calendar size={12} className="date-icon" />
                        <span>{new Date(s.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
                      </div>
                      {etdDate && (
                        <div className="date-sub">
                          ETD: {new Date(etdDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                        </div>
                      )}
                    </div>

                    <div className="col-status">
                      <span className={`status-badge ${statusConf.class}`}>{statusConf.label}</span>
                      <ChevronRight size={16} className="row-chevron" />
                    </div>

                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* PAGINACIÓN */}
        {!loading && totalItems > 0 && (
          <div className="ff-pagination">
            <span className="page-info">Mostrando {((page - 1) * itemsPerPage) + 1} - {Math.min(page * itemsPerPage, totalItems)} de {totalItems} embarques</span>
            <div className="page-controls">
              <button onClick={handlePrevPage} disabled={page === 1}><ChevronLeft size={16} /></button>
              <span className="page-number">Página {page} de {totalPages}</span>
              <button onClick={handleNextPage} disabled={page === totalPages}><ChevronRight size={16} /></button>
            </div>
          </div>
        )}

      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .ff-shipments-index { display: flex; flex-direction: column; gap: 20px; font-family: 'Poppins', sans-serif !important; padding-bottom: 40px; }
        
        /* TOOLBAR UNIFICADA */
        .ff-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 20px; }
        .ff-search-group { display: flex; gap: 12px; flex-grow: 1; max-width: 700px; }
        
        .ff-input-wrapper { 
          position: relative; background: white; border: 1.5px solid rgba(34, 76, 34, 0.15); 
          border-radius: 12px; height: 44px; display: flex; align-items: center; padding: 0 14px; 
          color: var(--ff-green-dark); transition: 0.2s;
        }
        .ff-input-wrapper:focus-within { border-color: var(--ff-green); box-shadow: 0 0 0 3px rgba(34, 116, 50, 0.05); }
        .ff-input-wrapper input, .ff-input-wrapper select { 
          border: none; background: transparent; width: 100%; height: 100%; 
          outline: none; font-size: 13px; font-weight: 600; color: var(--ff-green-dark); padding-left: 10px; cursor: pointer;
        }
        .ff-input-wrapper select { appearance: none; }
        
        .ff-btn-primary { 
          background: var(--ff-orange); color: white; border: none; padding: 0 20px; height: 44px;
          border-radius: 12px; font-weight: 800; font-size: 13px; display: flex; align-items: center; gap: 8px; 
          cursor: pointer; transition: all 0.2s ease; box-shadow: 0 4px 10px rgba(209, 119, 17, 0.2); 
        }
        .ff-btn-primary:hover { background: #b4660e; transform: translateY(-2px); box-shadow: 0 6px 15px rgba(209, 119, 17, 0.3); }

        /* CONTENEDOR DE LISTA */
        .ff-list-container { background: white; border-radius: 20px; border: 1px solid rgba(34,76,34,0.08); box-shadow: 0 4px 15px rgba(0,0,0,0.02); overflow: hidden; }
        
        /* ESTRUCTURA GRID PERFECTA PARA ALINEACIÓN MILIMÉTRICA */
        .ff-list-header { 
          display: grid; 
          grid-template-columns: 160px 180px 1.5fr 1.2fr 110px 110px; 
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
          grid-template-columns: 160px 180px 1.5fr 1.2fr 110px 110px; 
          gap: 20px;
          align-items: center; 
          padding: 14px 24px; 
          border-bottom: 1px solid rgba(34,76,34,0.04); 
          cursor: pointer; transition: all 0.2s ease; background: white;
        }
        .ff-list-row:last-child { border-bottom: none; }
        .ff-list-row:hover { background: #fcfdfc; background-color: #f8faf9; }

        /* ESTILOS INTERNOS DE COLUMNAS */
        .col-code { display: flex; align-items: center; gap: 12px; }
        .col-product { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; justify-content: center; }
        .col-client { font-size: 13px; font-weight: 600; color: var(--ff-green-dark); opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .col-route { display: flex; align-items: center; }
        .col-status { display: flex; align-items: center; justify-content: flex-end; gap: 12px; }

        .flex-col { display: flex; flex-direction: column; gap: 4px; }
        .code-text { font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 800; letter-spacing: -0.2px; color: var(--ff-green-dark); }
        .sub-text { font-size: 11px; font-weight: 600; color: var(--ff-green-dark); opacity: 0.5; }
        
        .product-text { font-size: 12px; font-weight: 700; color: var(--ff-green-dark); opacity: 0.8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
        .boxes-badge { font-size: 9px; font-weight: 800; background: rgba(34,76,34,0.06); color: var(--ff-green-dark); padding: 2px 6px; border-radius: 4px; display: inline-block; width: fit-content; }
        
        /* FECHAS APILADAS */
        .flex-col-dates { display: flex; flex-direction: column; justify-content: center; gap: 4px; }
        .date-main { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: var(--ff-green-dark); opacity: 0.9; }
        .date-icon { opacity: 0.5; }
        .date-sub { font-size: 10px; font-weight: 800; color: var(--ff-green-dark); opacity: 0.5; margin-left: 2px; text-transform: uppercase; }

        /* RUTA LIMPIA */
        .route-tags { display: flex; align-items: center; gap: 6px; }
        .r-tag { font-size: 10px; font-weight: 800; background: rgba(34,76,34,0.05); color: var(--ff-green-dark); padding: 4px 8px; border-radius: 6px; opacity: 0.7; }
        .r-tag.dest { background: #e6efe2; opacity: 1; }
        .r-arrow { color: var(--ff-green-dark); opacity: 0.3; }

        /* ICONOS DE TRANSPORTE */
        .row-icon-box { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0; }
        .row-icon-box.air { background: #e0f2fe; color: #0284c7; } 
        .row-icon-box.sea { background: #f1f5f9; color: #475569; }

        /* STATUS BADGES (ANCHO FIJO 90px) */
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
        .ff-list-row:hover .row-chevron { opacity: 1; transform: translateX(2px); }

        /* PAGINACIÓN */
        .ff-pagination { display: flex; justify-content: space-between; align-items: center; padding: 0 10px; margin-top: 10px; }
        .page-info { font-size: 12px; font-weight: 500; color: var(--ff-green-dark); opacity: 0.6; }
        .page-controls { display: flex; align-items: center; gap: 15px; }
        .page-controls button { background: white; border: 1px solid rgba(34,76,34,0.15); border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--ff-green-dark); transition: 0.2s; }
        .page-controls button:disabled { opacity: 0.3; cursor: not-allowed; }
        .page-controls button:hover:not(:disabled) { border-color: var(--ff-green); background: #f9fbf9; }
        .page-number { font-size: 12px; font-weight: 700; color: var(--ff-green-dark); }

        /* EMPTY Y LOADING STATES */
        .ff-loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; gap: 16px; }
        .ff-loader-ring { width: 36px; height: 36px; border: 3px solid rgba(34,76,34,0.1); border-top-color: var(--ff-green-dark); border-radius: 50%; animation: spin 1s linear infinite; }
        .ff-loading-state span { font-size: 11px; font-weight: 800; color: var(--ff-green-dark); opacity: 0.6; text-transform: uppercase; letter-spacing: 2px; }
        
        .ff-empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; background: white; color: var(--ff-green-dark); opacity: 0.6; gap: 12px; }
        .ff-empty-state p { margin: 0; font-size: 13px; font-weight: 600; }
        
        .flex-grow { flex-grow: 1; }
        .width-180 { width: 180px; }
        
        @keyframes spin { to { transform: rotate(360deg); } }
      ` }} />
    </AdminLayout>
  );
}