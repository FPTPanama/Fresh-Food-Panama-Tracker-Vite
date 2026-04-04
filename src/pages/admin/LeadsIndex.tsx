import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { AdminLayout, notify } from '@/components/AdminLayout';
import { 
  // 1. CAMBIAMOS Target POR BrainCircuit AQUÍ
  BrainCircuit, Cpu, Mail, Loader2, Search, Zap, 
  Trash2, UserPlus, ChevronLeft, ChevronRight, 
  ExternalLink, RefreshCcw, Phone, Star, 
  MapPin, Archive, Trophy, Package, Clock, Flame, Snowflake
} from 'lucide-react';

const getFlag = (c: string | null) => {
  if (!c) return '🌐';
  if (c.includes('España')) return '🇪🇸';
  if (c.includes('Francia')) return '🇫🇷';
  if (c.includes('Panamá')) return '🇵🇦';
  return '🌐';
};

// Utilidad para calcular "Hace X días"
const getTimeAgo = (dateString: string) => {
  if (!dateString) return 'Desconocido';
  const days = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  return `Hace ${days} días`;
};

export default function LeadsIndex() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMining, setIsMining] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // FILTROS
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("new");
  
  // MOTOR MULTI-PRODUCTO
  const [targetLocation, setTargetLocation] = useState("Mercamadrid, España");
  const [targetProduct, setTargetProduct] = useState("Piña Premium"); // <-- Nuevo Estado
  
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 10;

  const fetchData = useCallback(async () => {
    setLoading(true);
    const from = (page - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;

    try {
      let query = supabase.from('leads_prospecting').select('*', { count: 'exact' });
      if (q) query = query.ilike('company_name', `%${q}%`);
      if (statusFilter) query = query.eq('status', statusFilter);

      const { data, count, error } = await query
        .order('lead_score', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      setLeads(data || []);
      setTotalItems(count || 0);
    } catch (e) {
      notify("Error al cargar datos", "error");
    } finally {
      setLoading(false);
    }
  }, [page, q, statusFilter]);

  useEffect(() => { 
    const delayDebounce = setTimeout(() => { fetchData(); }, 400);
    return () => clearTimeout(delayDebounce);
  }, [fetchData]);

  const runMining = async () => {
    if (!window.confirm(`¿Buscar 10 importadores de ${targetProduct} en ${targetLocation}?`)) return;
    setIsMining(true);
    try {
      const res = await fetch('/.netlify/functions/mine-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: targetLocation, product: targetProduct }) // Enviamos ambos
      });
      if (res.ok) {
        notify(`Completado: Búsqueda de ${targetProduct}`, "success");
        setPage(1);
        fetchData();
      }
    } catch (err) { notify("Error", "error"); } finally { setIsMining(false); }
  };

  const handleConvert = async (leadId: string) => {
    setProcessingId(leadId);
    try {
      const res = await fetch('/.netlify/functions/convert-lead', { method: 'POST', body: JSON.stringify({ leadId }) });
      if (res.ok) { notify("¡Cliente creado!", "success"); fetchData(); }
    } finally { setProcessingId(null); }
  };

  const handleArchive = async (id: string) => {
    await supabase.from('leads_prospecting').update({ status: 'rejected' }).eq('id', id);
    notify("Lead archivado", "success");
    fetchData();
  };

  const renderIntelligence = (text: string) => {
    if (!text || !text.includes('|')) return <span className="ai-text-fallback">{text}</span>;
    const tags = text.split('|').map(t => t.trim());
    return (
      <div className="intelligence-tags">
        {tags.map((tag, i) => {
          const [label, value] = tag.split(':');
          return (
            <div key={i} className="intel-badge">
              <span className="intel-label">{label}</span>
              <span className="intel-value">{value}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  return (
    <AdminLayout title="Intelligence Hub" subtitle="Motor Multi-Commodity de Prospección">
      <div className="ff-page-wrapper">
        
        {/* HEADER & CONTROLS */}
        <div className="ff-header-section">
          <div className="ff-tabs-slack">
            <button className={statusFilter === 'new' ? 'active' : ''} onClick={() => { setStatusFilter('new'); setPage(1); }}>
              <BrainCircuit size={14} strokeWidth={2.5} /> Bandeja
            </button>
            <button className={statusFilter === 'converted' ? 'active' : ''} onClick={() => { setStatusFilter('converted'); setPage(1); }}>
              <Zap size={14} strokeWidth={2.5} /> Convertidos
            </button>
            <button className={statusFilter === 'rejected' ? 'active' : ''} onClick={() => { setStatusFilter('rejected'); setPage(1); }}>
              <Archive size={14} strokeWidth={2.5} /> Archivados
            </button>
          </div>

          {/* NUEVA BARRA DE COMANDOS DIVIDIDA */}
          <div className="ff-command-bar">
            <div className="cmd-group border-right">
              <Package size={14} className="cmd-icon" />
              <input 
                value={targetProduct} 
                onChange={(e) => setTargetProduct(e.target.value)} 
                className="cmd-input"
                placeholder="Ej. Café, Aguacate..."
              />
            </div>
            <div className="cmd-group">
              <MapPin size={14} className="cmd-icon" />
              <input 
                value={targetLocation} 
                onChange={(e) => setTargetLocation(e.target.value)} 
                className="cmd-input"
                placeholder="Ciudad o Mercado..."
              />
            </div>
            <button className="cmd-btn" onClick={runMining} disabled={isMining}>
              {isMining ? <Loader2 size={14} className="animate-spin" /> : <Cpu size={14} />}
              {isMining ? "Procesando" : "Minar IA"}
            </button>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="ff-search-bar">
          <Search size={15} className="search-icon" />
          <input 
            placeholder="Buscar por nombre de empresa..." 
            value={q} 
            onChange={e => {setQ(e.target.value); setPage(1);}} 
          />
        </div>

        {/* DATA TABLE */}
        <div className="ff-table-container">
          <div className="ff-table-header lead-grid">
            <div className="th-cell">EMPRESA & STATUS</div>
            <div className="th-cell">OPERACIÓN IA</div>
            <div className="th-cell">CONTACTO</div>
            <div className="th-cell">SCORE</div>
            <div className="th-cell text-right">ACCIONES</div>
          </div>

          <div className="ff-table-body">
            {loading ? (
              <div className="loading-state"><Loader2 className="animate-spin" size={24} /> Cargando datos...</div>
            ) : leads.length === 0 ? (
              <div className="empty-state">
                <BrainCircuit size={32} />
                <p>Bandeja limpia. Todo bajo control.</p>
              </div>
            ) : (
              leads.map((item) => {
                // Cálculo de antigüedad para visuales
                const daysOld = Math.floor((new Date().getTime() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24));
                const isHot = item.lead_score >= 4 && daysOld <= 3;
                const isCold = statusFilter === 'new' && daysOld > 14;

                return (
                  <div key={item.id} className={`ff-table-row lead-grid ${isCold ? 'opacity-70' : ''}`}>
                    
                    <div className="td-cell col-ident">
                      <div className="name-with-vip">
                        <span className="client-name">{item.company_name}</span>
                        {Number(item.lead_score) >= 5 && (
  <span title="Top Priority" style={{ display: 'flex' }}>
    <Trophy size={14} className="vip-trophy" />
  </span>
)}
                      </div>
                      
                      {/* METADATOS SAAS: Edad y Frescura */}
                      <div className="meta-sub">
                        <span className="meta-item"><Clock size={10} /> {getTimeAgo(item.created_at)}</span>
                        <span className="meta-separator">•</span>
                        <span>{getFlag(item.country)} {item.city}</span>
                        
                        {isHot && <span className="meta-hot" title="Lead Caliente (Nuevo y buen score)"><Flame size={12}/> Hot</span>}
                        {isCold && <span className="meta-cold" title="Lead Frío (Más de 14 días sin tocar)"><Snowflake size={12}/> Cold</span>}
                      </div>
                    </div>

                    <div className="td-cell col-analysis">
                      {renderIntelligence(item.ai_analysis)}
                    </div>

                    <div className="td-cell col-contact">
                      <div className="contact-line"><Mail size={12} /> {item.contact_email || '—'}</div>
                      <div className="contact-line"><Phone size={12} /> {item.contact_phone || '—'}</div>
                    </div>

                    <div className="td-cell col-score">
                      <div className="star-rating">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={12} fill={i < item.lead_score ? "#eab308" : "none"} color={i < item.lead_score ? "#eab308" : "#cbd5e1"} />
                        ))}
                      </div>
                    </div>

                    <div className="td-cell text-right">
                      <div className="actions-group">
                        {item.status === 'new' && (
                          <>
                            <button className="ghost-btn action-convert" title="Convertir a Cliente" onClick={() => handleConvert(item.id)} disabled={!!processingId}>
                              {processingId === item.id ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                            </button>
                            <button className="ghost-btn action-archive" title="Archivar Lead" onClick={() => handleArchive(item.id)}>
                              <Archive size={16} />
                            </button>
                          </>
                        )}
                        <a href={item.website} target="_blank" title="Visitar Web" className="ghost-btn action-link">
                          <ExternalLink size={16} />
                        </a>
                      </div>
                    </div>

                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* PAGINATION */}
        {totalItems > 0 && (
          <div className="ff-pagination-slack">
            <span className="page-stats">Mostrando {(page - 1) * itemsPerPage + 1} - {Math.min(page * itemsPerPage, totalItems)} de {totalItems}</span>
            <div className="page-actions">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="pager-btn">
                <ChevronLeft size={16} />
              </button>
              <span className="page-current">{page}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} className="pager-btn">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        /* SE MANTIENE TODO TU CSS ANTERIOR INTACTO... */
        .ff-page-wrapper { display: flex; flex-direction: column; gap: 16px; font-family: 'Inter', 'Poppins', sans-serif; color: #1e293b; }
        .ff-header-section { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
        
        .ff-tabs-slack { display: flex; background: #f1f5f9; padding: 4px; border-radius: 8px; }
        .ff-tabs-slack button { padding: 6px 14px; border: none; background: transparent; border-radius: 6px; font-size: 13px; font-weight: 600; color: #64748b; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s; }
        .ff-tabs-slack button:hover { color: #0f172a; }
        .ff-tabs-slack button.active { background: white; color: #224c22; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

        /* NUEVA COMMAND BAR DIVIDIDA */
        .ff-command-bar { display: flex; align-items: center; background: white; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.02); overflow: hidden; height: 38px;}
        .cmd-group { display: flex; align-items: center; padding: 0 12px; height: 100%; }
        .border-right { border-right: 1px solid #e2e8f0; }
        .cmd-icon { color: #94a3b8; margin-right: 6px;}
        .cmd-input { border: none; outline: none; font-size: 13px; font-weight: 500; color: #0f172a; width: 140px; background: transparent; }
        .cmd-btn { background: #224c22; color: white; border: none; padding: 0 16px; height: 100%; font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: 0.2s; }
        .cmd-btn:hover { background: #1a3a1a; }
        .cmd-btn:disabled { opacity: 0.7; cursor: wait; }

        .ff-search-bar { display: flex; align-items: center; background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0 12px; height: 40px; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
        .search-icon { color: #94a3b8; margin-right: 8px; }
        .ff-search-bar input { border: none; outline: none; width: 100%; font-size: 14px; color: #0f172a; }

        .ff-table-container { background: white; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); overflow: hidden; }
        .lead-grid { display: grid; grid-template-columns: minmax(220px, 1.4fr) 2.5fr 1.2fr 80px 120px; gap: 16px; align-items: center; }
        
        .ff-table-header { background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 12px 20px; }
        .th-cell { font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 0.5px; }
        
        .ff-table-row { padding: 12px 20px; border-bottom: 1px solid #f1f5f9; transition: background 0.15s; }
        .ff-table-row:hover { background: #f8fafc; }

        .client-name { font-size: 14px; font-weight: 600; color: #0f172a; letter-spacing: -0.01em; }
        .name-with-vip { display: flex; align-items: center; gap: 6px; }
        .vip-trophy { color: #eab308; animation: float 3s ease-in-out infinite; }
        @keyframes float { 0% { transform: translateY(0); } 50% { transform: translateY(-2px); } 100% { transform: translateY(0); } }

        /* NUEVOS METADATOS DE SAAS */
        .meta-sub { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #64748b; margin-top: 4px; }
        .meta-item { display: flex; align-items: center; gap: 3px; }
        .meta-separator { opacity: 0.4; }
        .meta-hot { display: flex; align-items: center; gap: 2px; color: #ea580c; font-weight: 700; background: #ffedd5; padding: 1px 6px; border-radius: 4px; font-size: 10px; margin-left: 4px;}
        .meta-cold { display: flex; align-items: center; gap: 2px; color: #3b82f6; font-weight: 700; background: #dbeafe; padding: 1px 6px; border-radius: 4px; font-size: 10px; margin-left: 4px;}
        .opacity-70 { opacity: 0.7; }

        .contact-line { font-size: 12px; color: #475569; display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
        
        .intelligence-tags { display: flex; flex-wrap: wrap; gap: 6px; }
        .intel-badge { display: flex; align-items: center; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden; }
        .intel-label { background: #e2e8f0; color: #475569; padding: 3px 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
        .intel-value { padding: 3px 8px; color: #0f172a; font-size: 11px; font-weight: 500; }

        .actions-group { display: flex; justify-content: flex-end; gap: 4px; }
        .ghost-btn { background: transparent; border: none; color: #94a3b8; width: 32px; height: 32px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
        .ghost-btn:hover { color: #0f172a; background: #f1f5f9; }
        .ghost-btn.action-convert:hover { color: #224c22; background: #e0eee0; }
        .ghost-btn.action-archive:hover { color: #ea580c; background: #ffedd5; }
        .ghost-btn.action-link:hover { color: #2563eb; background: #dbeafe; }

        .text-right { text-align: right; }
        .loading-state, .empty-state { padding: 40px; text-align: center; color: #64748b; font-size: 14px; display: flex; flex-direction: column; align-items: center; gap: 12px; }

        .ff-pagination-slack { display: flex; justify-content: space-between; align-items: center; padding: 8px 4px; }
        .page-stats { font-size: 13px; color: #64748b; }
        .page-actions { display: flex; align-items: center; gap: 8px; background: white; border: 1px solid #e2e8f0; padding: 4px; border-radius: 8px; }
        .pager-btn { background: transparent; border: none; color: #64748b; padding: 4px; border-radius: 4px; cursor: pointer; transition: 0.1s; display: flex;}
        .pager-btn:hover:not(:disabled) { background: #f1f5f9; color: #0f172a; }
        .pager-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .page-current { font-size: 13px; font-weight: 600; color: #0f172a; padding: 0 8px; min-width: 24px; text-align: center; }
        .ff-page-wrapper { display: flex; flex-direction: column; gap: 16px; font-family: 'Inter', 'Poppins', sans-serif; color: #1e293b; }
        .ff-header-section { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
        
        .ff-tabs-slack { display: flex; background: #f1f5f9; padding: 4px; border-radius: 8px; }
        .ff-tabs-slack button { padding: 6px 14px; border: none; background: transparent; border-radius: 6px; font-size: 13px; font-weight: 600; color: #64748b; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s; }
        .ff-tabs-slack button:hover { color: #0f172a; }
        .ff-tabs-slack button.active { background: white; color: #224c22; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

        /* UN TOQUE DE COLOR AL CEREBRO CUANDO ESTÁ ACTIVO */
        .ff-tabs-slack button.active .ai-brain-icon {
          color: #224c22;
          filter: drop-shadow(0 0 3px rgba(34, 76, 34, 0.2));
        }
      `}</style>
    </AdminLayout>
  );
}