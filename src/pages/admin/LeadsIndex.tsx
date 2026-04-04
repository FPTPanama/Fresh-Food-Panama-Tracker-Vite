import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { AdminLayout, notify } from '@/components/AdminLayout';
import { 
  Target, Cpu, Mail, Loader2, Search, Zap, 
  SortAsc, Building2, Trash2, UserPlus, MapPin, 
  ChevronLeft, ChevronRight, Filter, X, ExternalLink, RefreshCcw
} from 'lucide-react';

const getFlag = (country: string | null) => {
  if (!country) return '🌐';
  const flags: Record<string, string> = {
    'España': '🇪🇸', 'Panamá': '🇵🇦', 'Colombia': '🇨🇴', 'Costa Rica': '🇨🇷'
  };
  return flags[country] || '🌐';
};

const LeadSkeleton = () => (
  <div className="ff-list-row skeleton-row">
    <div className="col-ident"><div className="client-profile-box"><div className="skel-avatar"></div><div className="name-stack" style={{ flex: 1 }}><div className="skel-line w70"></div><div className="skel-line w40"></div></div></div></div>
    <div className="col-analysis"><div className="skel-line w100"></div><div className="skel-line w80"></div></div>
    <div className="col-route"><div className="skel-pill w60" style={{ height: '24px' }}></div></div>
    <div className="col-status"><div className="skel-pill w50"></div></div>
    <div className="col-actions"><div className="skel-line w40" style={{ marginLeft: 'auto' }}></div></div>
  </div>
);

export default function LeadsIndex() {
  const [activeTab, setActiveTab] = useState<'prospects' | 'history'>('prospects');
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMining, setIsMining] = useState(false);
  
  // FILTROS Y PAGINACIÓN (Sincronizado con tu estilo)
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 12;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      let query = supabase.from('leads_prospecting').select('*', { count: 'exact' });
      
      if (q) query = query.or(`company_name.ilike.%${q}%,contact_email.ilike.%${q}%`);
      if (statusFilter) query = query.eq('status', statusFilter);

      const { data, count, error } = await query
        .order('created_at', { ascending: dir === 'asc' })
        .range(from, to);

      if (error) throw error;
      setLeads(data || []);
      setTotalItems(count || 0);
    } catch (e) {
      notify("Error al cargar prospectos", "error");
    } finally {
      setLoading(false);
    }
  }, [page, q, statusFilter, dir]);

  useEffect(() => { 
    const delay = setTimeout(() => { fetchData(); }, 300);
    return () => clearTimeout(delay);
  }, [fetchData]);

  const runMining = async () => {
    if (!window.confirm("¿Activar Gemini Pro para buscar nuevos importadores premium?")) return;
    setIsMining(true);
    try {
      const res = await fetch('/.netlify/functions/mine-leads');
      const result = await res.json();
      notify(result.message || "Búsqueda completada", "success");
      fetchData();
    } catch (err) {
      notify("Error en el motor de IA", "error");
    } finally {
      setIsMining(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("¿Eliminar este prospecto del directorio?")) return;
    try {
      const { error } = await supabase.from('leads_prospecting').delete().eq('id', id);
      if (error) throw error;
      notify("Prospecto eliminado", "success");
      fetchData();
    } catch (e) { notify("Error al eliminar", "error"); }
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  return (
    <AdminLayout title="Centro de Prospección" subtitle="IA de búsqueda avanzada en Mercamadrid">
      <div className="ff-page-wrapper">
        
        {/* ENCABEZADO Y TABS */}
        <div className="ff-header-section">
          <div className="ff-tabs-pro">
            <button className={activeTab === 'prospects' ? 'active' : ''} onClick={() => setActiveTab('prospects')}>
              <Target size={16} /> Prospectos ({totalItems})
            </button>
            <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>
              <RefreshCcw size={16} /> Historial
            </button>
          </div>
          
          <button className="ff-btn-primary" onClick={runMining} disabled={isMining}>
            {isMining ? <Loader2 size={18} className="animate-spin" /> : <Cpu size={18} strokeWidth={2.5} />}
            {isMining ? "Buscando..." : "Minado IA (Nuevos)"}
          </button>
        </div>

        {/* BARRA DE HERRAMIENTAS */}
        <div className="ff-toolbar">
          <div className="ff-search-group">
            <div className="ff-input-wrapper flex-grow">
              <Search size={16} />
              <input 
                placeholder="Buscar por empresa o email..." 
                value={q} 
                onChange={e => { setQ(e.target.value); setPage(1); }} 
              />
              {q && <X size={14} className="clear-icon" onClick={() => { setQ(""); setPage(1); }} />}
            </div>
            
            <div className="ff-input-wrapper width-180">
              <Filter size={16} />
              <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                <option value="">Todos los estados</option>
                <option value="new">Solo Directorio</option>
                <option value="contacted">Contactados</option>
              </select>
            </div>
          </div>
          
          <button className="ff-btn-secondary" onClick={() => { setDir(dir === 'asc' ? 'desc' : 'asc'); setPage(1); }}>
            <SortAsc size={14} /> {dir === 'asc' ? 'Antiguos' : 'Recientes'}
          </button>
        </div>

        {/* TABLA PRINCIPAL (Grid clonado de Clientes) */}
        <div className="ff-list-container">
          <div className="ff-list-header lead-grid">
            <div className="col-ident">EMPRESA</div>
            <div className="col-analysis">ANÁLISIS IA (GEMINI PRO)</div>
            <div className="col-route">UBICACIÓN</div>
            <div className="col-status">ESTADO</div>
            <div className="col-actions">ACCIONES</div>
          </div>

          <div className="ff-list-body">
            {loading ? (
              <><LeadSkeleton /><LeadSkeleton /><LeadSkeleton /></>
            ) : leads.length === 0 ? (
              <div className="ff-empty-state">
                <Building2 size={32} />
                <p>No hay prospectos. Inicia una búsqueda con IA.</p>
              </div>
            ) : (
              leads.map((item) => (
                <div key={item.id} className="ff-list-row lead-grid no-cursor">
                  
                  <div className="col-ident">
                    <div className="client-profile-box">
                      <div className="avatar-mini client-bg">
                        <div className="avatar-initials-mini">{item.company_name.charAt(0)}</div>
                      </div>
                      <div className="name-stack">
                        <span className="client-name-text">{item.company_name}</span>
                        <a href={item.website} target="_blank" className="tax-id-sub web-link">
                          {item.website?.replace('https://','').replace('www.','')} <ExternalLink size={8} />
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="col-analysis">
                    <div className="ai-analysis-box">
                      <Zap size={12} className="ai-icon" />
                      <p>{item.ai_analysis}</p>
                    </div>
                  </div>

                  <div className="col-route">
                    <div className="location-badge">
                      <span className="country-flag">{getFlag(item.country)}</span>
                      <span className="country-name">{item.city}, {item.country}</span>
                    </div>
                  </div>

                  <div className="col-status">
                    <span className="status-pill-client pending">
                      {item.status === 'new' ? 'Solo Directorio' : item.status}
                    </span>
                  </div>

                  <div className="col-actions">
                    <div className="actions-inline">
                      <button className="ff-action-btn invite" title="Enviar Email IA">
                        <Mail size={14} />
                      </button>
                      <button className="ff-action-btn quote" title="Convertir a Cliente">
                        <UserPlus size={14} />
                      </button>
                      <button className="ff-action-btn trash" title="Eliminar" onClick={(e) => handleDelete(e, item.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                </div>
              ))
            )}
          </div>
        </div>

        {/* PAGINACIÓN */}
        {!loading && totalItems > 0 && (
          <div className="ff-pagination">
            <span className="page-info">Mostrando {((page - 1) * itemsPerPage) + 1} - {Math.min(page * itemsPerPage, totalItems)} de {totalItems}</span>
            <div className="page-controls">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft size={16} /></button>
              <span className="page-number">Página {page} de {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        /* HERENCIA EXACTA DE TUS ESTILOS */
        .ff-page-wrapper { display: flex; flex-direction: column; gap: 24px; font-family: 'Poppins', sans-serif !important; padding-bottom: 40px; }
        .ff-header-section { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 10px; }
        
        /* TABS */
        .ff-tabs-pro { display: flex; gap: 6px; background: white; padding: 6px; border-radius: 16px; border: 1px solid rgba(34, 76, 34, 0.1); }
        .ff-tabs-pro button { display: flex; align-items: center; gap: 8px; padding: 10px 24px; border: none; background: transparent; border-radius: 12px; font-size: 13px; font-weight: 700; color: #224c22; opacity: 0.6; cursor: pointer; transition: 0.3s; }
        .ff-tabs-pro button.active { background: #224c22; color: white; opacity: 1; }
        
        .ff-btn-primary { background: #d17711; color: white; border: none; padding: 0 20px; height: 44px; border-radius: 12px; font-weight: 800; font-size: 13px; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: 0.2s; }
        .ff-btn-primary:hover { background: #b4660e; transform: translateY(-2px); }

        /* GRID ESPECÍFICO PARA LEADS */
        .lead-grid {
          display: grid;
          grid-template-columns: 1.5fr 2fr 1fr 1fr 140px !important;
          gap: 15px;
        }

        .no-cursor { cursor: default !important; }

        /* TOOLBAR & INPUTS */
        .ff-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 20px; }
        .ff-search-group { display: flex; gap: 16px; flex-grow: 1; }
        .ff-input-wrapper { position: relative; background: white; border: 1.5px solid rgba(34, 76, 34, 0.15); border-radius: 12px; height: 44px; display: flex; align-items: center; padding: 0 14px; }
        .ff-input-wrapper input, .ff-input-wrapper select { border: none; background: transparent; width: 100%; height: 100%; outline: none; font-size: 13px; font-weight: 600; color: #224c22; }
        
        /* TABLE & ROWS */
        .ff-list-container { background: white; border-radius: 20px; border: 1px solid rgba(34,76,34,0.08); overflow: hidden; }
        .ff-list-header { padding: 16px 24px; border-bottom: 1px solid rgba(34,76,34,0.08); background: #f9fbf9; font-size: 10px; font-weight: 800; color: #224c22; opacity: 0.6; text-transform: uppercase; }
        .ff-list-row { padding: 14px 24px; border-bottom: 1px solid rgba(34,76,34,0.04); align-items: center; }
        
        /* AI ANALYSIS BOX */
        .ai_analysis-box { background: #f1f5f1; padding: 8px 12px; border-radius: 10px; border: 1px solid rgba(34,76,34,0.05); display: flex; gap: 10px; }
        .ai-analysis-box p { font-size: 11px; color: #224c22; font-style: italic; line-height: 1.4; margin: 0; }
        .ai-icon { color: #d17711; flex-shrink: 0; margin-top: 2px; }

        /* PROFILE & AVATAR */
        .client-profile-box { display: flex; align-items: center; gap: 14px; }
        .avatar-mini { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .client-bg { background: #e6efe2; color: #224c22; }
        .avatar-initials-mini { font-weight: 800; font-size: 16px; }
        .client-name-text { font-size: 13px; font-weight: 700; color: #224c22; }
        .web-link { text-decoration: none; display: flex; align-items: center; gap: 4px; }
        .web-link:hover { color: #d17711; }

        /* BADGES */
        .location-badge { display: flex; align-items: center; gap: 6px; }
        .country-name { font-size: 12px; font-weight: 700; color: #224c22; opacity: 0.7; }
        .status-pill-client { padding: 4px 10px; border-radius: 8px; font-size: 9px; font-weight: 900; text-transform: uppercase; background: rgba(34,76,34,0.05); color: #224c22; opacity: 0.6; }

        /* ACTIONS */
        .actions-inline { display: flex; gap: 6px; }
        .ff-action-btn { width: 32px; height: 32px; border-radius: 8px; border: 1.5px solid rgba(34,76,34,0.1); display: flex; align-items: center; justify-content: center; background: white; cursor: pointer; color: #224c22; opacity: 0.7; transition: 0.2s; }
        .ff-action-btn:hover { opacity: 1; transform: translateY(-2px); border-color: #224c22; }
        .ff-action-btn.trash:hover { border-color: #ef4444; color: #ef4444; background: #fef2f2; }

        /* PAGINACIÓN */
        .ff-pagination { display: flex; justify-content: space-between; align-items: center; margin-top: 15px; }
        .page-info { font-size: 12px; opacity: 0.6; font-weight: 500; }
        .page-controls { display: flex; align-items: center; gap: 10px; }
        .page-controls button { background: white; border: 1px solid rgba(34,76,34,0.1); border-radius: 6px; padding: 5px; cursor: pointer; }

        .width-180 { width: 180px; }
        .skeleton-row { pointer-events: none; opacity: 0.5; }
        .skel-line { height: 10px; background: #eee; border-radius: 4px; margin-bottom: 5px; }
        .w70 { width: 70%; } .w40 { width: 40%; } .w100 { width: 100%; } .w80 { width: 80%; }
      `}</style>
    </AdminLayout>
  );
}