import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { AdminLayout, notify } from '@/components/AdminLayout';
import { 
  BrainCircuit, Cpu, Mail, Loader2, Search, Zap, 
  Trash2, UserPlus, RefreshCw, Phone, Star, 
  MapPin, Clock, Flame, Snowflake, Sparkles, X, 
  Send, Filter, Tag, LayoutGrid, ListChecks, Target, 
  Archive, Package, ExternalLink, Trophy, ChevronLeft, ChevronRight
} from 'lucide-react';

// --- HELPERS ---
const getFlag = (c: string | null) => {
  if (!c) return '🌐';
  if (c.includes('España') || c === 'ES') return '🇪🇸';
  if (c.includes('Italia') || c === 'IT') return '🇮🇹';
  if (c.includes('Francia') || c === 'FR') return '🇫🇷';
  if (c.includes('Panamá') || c === 'PA') return '🇵🇦';
  return '🌐';
};

const getTimeAgo = (dateString: string) => {
  if (!dateString) return 'Desconocido';
  const days = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  return `Hace ${days} días`;
};

// --- DEFINICIÓN DE ETAPAS ---
const KANBAN_STAGES = [
  { id: 'inbox', title: 'Bandeja de Entrada', icon: BrainCircuit, color: '#64748b' },
  { id: 'contacted', title: 'Contactados (Draft)', icon: Send, color: '#8b5cf6' },
  { id: 'queued', title: 'Aprobados (Drip)', icon: Zap, color: '#224c22' },
  { id: 'converted', title: 'Convertidos 🏆', icon: Trophy, color: '#eab308' }
];

export default function LeadsIndex() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMining, setIsMining] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // NAVEGACIÓN Y PAGINACIÓN
  const [activeTab, setActiveTab] = useState('inbox');
  const [page, setPage] = useState(1);
  const itemsPerPage = 24; 
  
  // MASTER SWITCH
  const [autoEnabled, setAutoEnabled] = useState(false);
  
  // MODAL
  const [draftModal, setDraftModal] = useState<{isOpen: boolean, lead: any, loading: boolean, emailType: string, editValue: string}>({
    isOpen: false, lead: null, loading: false, emailType: 'intro', editValue: ''
  });
  
  // FILTROS AVANZADOS COMBINADOS
  const [filters, setFilters] = useState({
    q: "",
    country: "",
    score: "",
    tag: "", 
    sortBy: "score_desc", 
    showArchived: false
  });
  
  const [targetLocation, setTargetLocation] = useState("Roma, Italia");
  const [targetProduct, setTargetProduct] = useState("Piña Premium"); 

  // RESETEAR PÁGINA SI CAMBIAN FILTROS O TABS
  useEffect(() => { setPage(1); }, [filters, activeTab]);

  useEffect(() => {
    const getSettings = async () => {
      const { data } = await supabase.from('global_settings').select('automation_enabled').single();
      if (data) setAutoEnabled(data.automation_enabled);
    };
    getSettings();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from('leads_prospecting').select('*');
      
      if (!filters.showArchived) {
        query = query.neq('status', 'rejected');
      } else {
        query = query.eq('status', 'rejected');
      }

      const { data, error } = await query;
      setLeads(data || []);
    } catch (e) {
      notify("Error al cargar datos", "error");
    } finally {
      setLoading(false);
    }
  }, [filters.showArchived]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // LÓGICA DE FILTRADO Y ORDENAMIENTO
  const filteredLeads = useMemo(() => {
    let result = leads.filter(lead => {
      const matchQuery = !filters.q || lead.company_name.toLowerCase().includes(filters.q.toLowerCase());
      const matchCountry = !filters.country || lead.country_code === filters.country;
      const matchScore = !filters.score || lead.lead_score >= parseInt(filters.score);
      
      const matchTag = !filters.tag || 
        (lead.tags && Array.isArray(lead.tags) && lead.tags.some((t:string) => t.toLowerCase().includes(filters.tag.toLowerCase()))) ||
        (lead.ai_analysis && typeof lead.ai_analysis === 'string' && lead.ai_analysis.toLowerCase().includes(filters.tag.toLowerCase()));

      return matchQuery && matchCountry && matchScore && matchTag;
    });

    result.sort((a, b) => {
      if (filters.sortBy === 'recent') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else {
        if (b.lead_score !== a.lead_score) {
          return (b.lead_score || 0) - (a.lead_score || 0);
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return result;
  }, [leads, filters]);

  const groupedLeads = useMemo(() => {
    const groups: Record<string, any[]> = { inbox: [], contacted: [], queued: [], converted: [] };
    filteredLeads.forEach(lead => {
      if (lead.status === 'converted') { groups.converted.push(lead); return; }
      let stage = lead.pipeline_stage || 'inbox';
      if (stage === 'inbox' && lead.email_draft) stage = 'contacted';
      if (groups[stage]) groups[stage].push(lead);
      else groups.inbox.push(lead); 
    });
    return groups;
  }, [filteredLeads]);

  const currentTabLeads = groupedLeads[activeTab] || [];
  const totalPages = Math.ceil(currentTabLeads.length / itemsPerPage);
  const displayedLeads = currentTabLeads.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const toggleGlobalAutomation = async () => {
    const newValue = !autoEnabled;
    const { error } = await supabase.from('global_settings').update({ automation_enabled: newValue }).eq('id', 1);
    if (!error) {
      setAutoEnabled(newValue);
      notify(`Autopilot ${newValue ? 'ACTIVADO' : 'PAUSADO'}`, "success");
    } else notify("Error al actualizar", "error");
  };

  const handleArchive = async (id: string) => {
    if(!window.confirm("¿Archivar este lead?")) return;
    await supabase.from('leads_prospecting').update({ status: 'rejected', pipeline_stage: 'archived' }).eq('id', id);
    notify("Lead archivado", "success");
    fetchData();
  };

  const handleConvert = async (leadId: string) => {
    setProcessingId(leadId);
    try {
      const res = await fetch('/.netlify/functions/convert-lead', { method: 'POST', body: JSON.stringify({ leadId }) });
      if (res.ok) { notify("¡Cliente creado!", "success"); fetchData(); }
    } finally { setProcessingId(null); }
  };

  const handleGenerateDraft = async (lead: any, type: string = 'intro', forceRegenerate: boolean = false) => {
    if (!forceRegenerate && lead.email_draft && !draftModal.isOpen) {
      setDraftModal({ isOpen: true, lead, loading: false, emailType: lead.last_email_type || 'intro', editValue: lead.email_draft });
      return;
    }
    setDraftModal({ isOpen: true, lead, loading: true, emailType: type, editValue: '' });
    try {
      const res = await fetch('/.netlify/functions/generate-draft', { method: 'POST', body: JSON.stringify({ leadId: lead.id, emailType: type }) });
      const result = await res.json();
      if (res.ok) {
        setDraftModal({ isOpen: true, lead: { ...lead, email_draft: result.draft, last_email_type: type }, loading: false, emailType: type, editValue: result.draft });
        setLeads(prev => prev.map(l => l.id === lead.id ? {...l, email_draft: result.draft, pipeline_stage: 'contacted'} : l));
      } else throw new Error(result.error);
    } catch (err) {
      notify("Error al generar borrador", "error");
      setDraftModal(prev => ({ ...prev, loading: false }));
    }
  };

  const runMining = async () => {
    if (!window.confirm(`¿Buscar importadores de ${targetProduct} en ${targetLocation}?`)) return;
    setIsMining(true);
    try {
      const res = await fetch('/.netlify/functions/mineLeads-background', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: targetLocation, product: targetProduct })
      });
      if (res.ok || res.status === 202) notify(`Proceso iniciado. La IA está buscando. Refresca en ~1 min.`, "success"); 
    } catch (err) { notify("Error de conexión", "error"); } 
    finally { setIsMining(false); }
  };

  const handleMailTo = () => {
    const subject = encodeURIComponent(`Borrador Prospección: ${draftModal.lead.company_name}`);
    const body = encodeURIComponent(draftModal.editValue);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const renderAiBadges = (tagsArray: string[] | string) => {
    const tags = Array.isArray(tagsArray) ? tagsArray : (typeof tagsArray === 'string' ? tagsArray.split('|').map(t => t.trim()) : []);
    if (!tags || tags.length === 0) return null;
    return (
      <div className="card-tags">
        {tags.slice(0, 3).map((tag, i) => {
          const cleanTag = tag.replace(/Foco:|Vol:|Log:|Segmento:/ig, '').trim();
          return <span key={i} className="tag-badge" title={cleanTag}>{cleanTag}</span>;
        })}
        {tags.length > 3 && <span className="tag-more">+{tags.length - 3}</span>}
      </div>
    );
  };

  // --- COMPONENTE CARD ---
  const LeadCard = ({ item }: { item: any }) => {
    const daysOld = Math.floor((new Date().getTime() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24));
    const isHot = item.lead_score >= 4 && daysOld <= 3;
    const isCold = daysOld > 21;
    const isEnglish = item.country_code !== 'ES' && item.country_code !== 'PA';

    // Verificamos si tiene datos de contacto
    const hasContactInfo = item.contact_email || item.contact_phone;

    return (
      <div className={`kanban-card ${isCold ? 'opacity-70' : ''}`}>
        <div className="card-header">
          <div className="company-info">
            <span className="company-name" title={item.company_name}>{item.company_name}</span>
            <div className="location-line">
              {getFlag(item.country_code)} {item.city}
              <span className={`lang-badge ${isEnglish ? 'en' : 'es'}`}>{isEnglish ? 'EN' : 'ES'}</span>
            </div>
          </div>
          <div className="score-badge">
            <Star size={10} fill="#eab308" color="#eab308" />
            {item.lead_score}
          </div>
        </div>

        {/* NUEVA LÍNEA MICRO-CONTACTO */}
        {hasContactInfo && (
          <div className="card-contact-mini">
            {item.contact_email && (
              <a href={`mailto:${item.contact_email}`} className="contact-item" title={item.contact_email} onClick={e => e.stopPropagation()}>
                <Mail size={10} /> {item.contact_email}
              </a>
            )}
            {item.contact_phone && (
              <a href={`tel:${item.contact_phone}`} className="contact-item" title={item.contact_phone} onClick={e => e.stopPropagation()}>
                <Phone size={10} /> {item.contact_phone}
              </a>
            )}
          </div>
        )}

        {renderAiBadges(item.tags || item.ai_analysis)}

        <div className="card-meta">
          <span className="time-ago"><Clock size={10} /> {getTimeAgo(item.created_at)}</span>
          {isHot && <span className="status-badge hot"><Flame size={10}/> HOT</span>}
          {isCold && <span className="status-badge cold"><Snowflake size={10}/> COLD</span>}
        </div>

        <div className="card-actions">
          {item.status === 'new' && (
            <>
              <button className={`card-btn action-draft ${item.email_draft ? 'has-draft' : ''}`} title={item.email_draft ? "Ver Borrador" : "Generar Email IA"} onClick={() => handleGenerateDraft(item)}>
                <Sparkles size={12} /> outreach
              </button>
              {item.pipeline_stage !== 'queued' && (
                 <button className="card-btn action-convert" title="Convertir a Cliente" onClick={() => handleConvert(item.id)} disabled={!!processingId}>
                    {processingId === item.id ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
                 </button>
              )}
            </>
          )}
          
          {item.website && (
            <a href={item.website} target="_blank" title="Visitar Web" rel="noreferrer" className="card-btn action-link"><ExternalLink size={12} /></a>
          )}
          
          {!['converted', 'rejected'].includes(item.status) && (
             <button className="card-btn action-archive" title="Archivar" onClick={() => handleArchive(item.id)}><Trash2 size={12} /></button>
          )}
        </div>
      </div>
    );
  };

  return (
    <AdminLayout title="Intelligence Hub" subtitle="Motor de Prospección Inteligente B2B">
      <div className="ff-kanban-page">
        
        {/* BARRA DE MINERÍA */}
        <div className="ff-mining-bar">
          <div className="mining-title">
            <Target size={18} className="text-brand" />
            <div>
              <h3>Objetivo de Caza</h3>
              <p>Define producto y mercado para activar la IA</p>
            </div>
          </div>
          <div className="cmd-group border-right">
            <Package size={14} className="cmd-icon" />
            <input value={targetProduct} onChange={(e) => setTargetProduct(e.target.value)} className="cmd-input" placeholder="Ej. Piña..." />
          </div>
          <div className="cmd-group">
            <MapPin size={14} className="cmd-icon" />
            <input value={targetLocation} onChange={(e) => setTargetLocation(e.target.value)} className="cmd-input" placeholder="Ciudad o Mercado..." />
          </div>
          <button className="mining-btn" onClick={runMining} disabled={isMining}>
            {isMining ? <Loader2 size={14} className="animate-spin" /> : <Cpu size={14} />}
            {isMining ? "Minando..." : "Activar Caza IA"}
          </button>
        </div>

        {/* BARRA DE FILTROS GLOBALES */}
        <div className="ff-filters-bar-kanban">
          <div className="search-box">
            <Search size={16} className="search-icon" />
            <input placeholder="Buscar empresa..." value={filters.q} onChange={e => setFilters(prev => ({...prev, q: e.target.value}))} />
          </div>

          <div className="filter-group">
            <Filter size={14} className="text-gray" />
            <select value={filters.sortBy} onChange={(e) => setFilters(prev => ({...prev, sortBy: e.target.value}))}>
              <option value="score_desc">Mejor Score primero</option>
              <option value="recent">Más Recientes (Nuevos)</option>
            </select>
          </div>
          
          <div className="filter-group">
            <Tag size={14} className="text-gray" />
            <select value={filters.tag} onChange={(e) => setFilters(prev => ({...prev, tag: e.target.value}))}>
              <option value="">Todos los Segmentos</option>
              <option value="mayorista">Mayoristas</option>
              <option value="retail">Retailers / Supermercados</option>
              <option value="horeca">HORECA</option>
              <option value="premium">Premium / Luxury</option>
              <option value="importador">Importadores Directos</option>
            </select>
          </div>

          <div className="filter-group">
            <MapPin size={14} className="text-gray" />
            <select value={filters.country} onChange={(e) => setFilters(prev => ({...prev, country: e.target.value}))}>
              <option value="">Todos los países</option>
              <option value="ES">🇪🇸 España</option>
              <option value="IT">🇮🇹 Italia</option>
              <option value="FR">🇫🇷 Francia</option>
              <option value="NL">🇳🇱 Países Bajos</option>
            </select>
          </div>

          <div className="filter-group">
            <Star size={14} className="text-gray" />
            <select value={filters.score} onChange={(e) => setFilters(prev => ({...prev, score: e.target.value}))}>
              <option value="">Cualquier Score</option>
              <option value="4">🔥 Priority (4+)</option>
              <option value="3">⭐ Regular (3+)</option>
            </select>
          </div>

          <button className={`archive-toggle ${filters.showArchived ? 'active' : ''}`} onClick={() => setFilters(prev => ({...prev, showArchived: !prev.showArchived}))}>
            <Archive size={14} /> {filters.showArchived ? 'Ver Activos' : 'Archivados'}
          </button>

          {/* MASTER SWITCH */}
          <div className="master-control">
            <span className={`status-label ${autoEnabled ? 'active' : ''}`}>AUTOPILOT {autoEnabled ? 'ON' : 'OFF'}</span>
            <button className={`ff-switch ${autoEnabled ? 'on' : 'off'}`} onClick={toggleGlobalAutomation}>
              <div className="switch-handle" />
            </button>
          </div>
        </div>

        {/* NAVEGACIÓN POR PESTAÑAS */}
        <div className="ff-tabs-container">
          {KANBAN_STAGES.map(stage => {
            const count = (groupedLeads[stage.id] || []).length;
            const isActive = activeTab === stage.id;
            const Icon = stage.icon;
            return (
              <button key={stage.id} className={`ff-tab-btn ${isActive ? 'active' : ''}`} onClick={() => setActiveTab(stage.id)} style={{ borderBottomColor: isActive ? stage.color : 'transparent' }}>
                <Icon size={15} style={{ color: isActive ? stage.color : '#94a3b8' }} />
                <span className="tab-title" style={{ color: isActive ? '#0f172a' : '#64748b' }}>{stage.title}</span>
                <span className="tab-badge" style={{ background: isActive ? stage.color : '#e2e8f0', color: isActive ? 'white' : '#475569' }}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* CONTENIDO DE LA PESTAÑA ACTIVA CON PAGINACIÓN */}
        {loading ? (
            <div className="kanban-loading"><Loader2 className="animate-spin" size={32} /> <p>Sincronizando embudo de ventas...</p></div>
        ) : (
          <div className="tab-content-area">
            {displayedLeads.length === 0 ? (
                <div className="empty-tab-state">
                    <ListChecks size={32} />
                    <h3>No hay leads en esta etapa</h3>
                    <p>Prueba ajustando los filtros o minando nuevos prospectos.</p>
                </div>
            ) : (
                <>
                  <div className="cards-grid">
                    {displayedLeads.map(lead => <LeadCard key={lead.id} item={lead} />)}
                  </div>
                  
                  {/* CONTROLES DE PAGINACIÓN */}
                  {totalPages > 1 && (
                    <div className="ff-pagination">
                      <span className="page-info">Mostrando {(page - 1) * itemsPerPage + 1} - {Math.min(page * itemsPerPage, currentTabLeads.length)} de {currentTabLeads.length} leads</span>
                      <div className="page-controls">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="page-btn"><ChevronLeft size={16} /> Anterior</button>
                        <span className="page-current">Página {page} de {totalPages}</span>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="page-btn">Siguiente <ChevronRight size={16} /></button>
                      </div>
                    </div>
                  )}
                </>
            )}
          </div>
        )}
      </div>

      {/* --- MODAL DEL BORRADOR --- */}
      {draftModal.isOpen && draftModal.lead && (
        <div className="ff-modal-overlay" onClick={() => setDraftModal({isOpen: false, lead: null, loading: false, emailType: 'intro', editValue: ''})}>
          <div className="ff-modal-card animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title"><Sparkles size={16} className="text-purple" /> Estrategia: {draftModal.lead.company_name}</div>
              <button className="modal-close" onClick={() => setDraftModal({isOpen: false, lead: null, loading: false, emailType: 'intro', editValue: ''})}><X size={16} /></button>
            </div>
            
            <div className="modal-controls">
              <select className="ff-select" value={draftModal.emailType} onChange={(e) => handleGenerateDraft(draftModal.lead, e.target.value, true)} disabled={draftModal.loading}>
                <option value="intro">Primer Contacto (Intro)</option>
                <option value="vip">Socio Estratégico (VIP)</option>
                <option value="seguimiento_1">Seguimiento 1 (Transparencia)</option>
              </select>
              <button className="ff-btn-secondary" onClick={() => handleGenerateDraft(draftModal.lead, draftModal.emailType, true)} disabled={draftModal.loading}>
                <RefreshCw size={14} className={draftModal.loading ? 'animate-spin' : ''} /> Regenerar
              </button>
            </div>

            <div className="modal-body">
              {draftModal.loading ? (
                <div className="modal-loading-state"><Loader2 className="animate-spin" size={24} /><p>Gemini AI aplicando estrategia...</p></div>
              ) : (
                <div className="draft-editor-container">
                  <textarea className="draft-textarea" value={draftModal.editValue} onChange={(e) => setDraftModal(prev => ({...prev, editValue: e.target.value}))} rows={12}/>
                  <div className="modal-footer-actions">
                    <button className="ff-btn-mailto" onClick={handleMailTo}><Send size={14} /> Enviar manual</button>
                    <button className="ff-btn-primary" onClick={async () => {
                      await supabase.from('leads_prospecting').update({ pipeline_stage: 'queued' }).eq('id', draftModal.lead.id);
                      notify("Lead aprobado para goteo automático.", "success");
                      setDraftModal({isOpen: false, lead: null, loading: false, emailType: 'intro', editValue: ''});
                      fetchData(); 
                    }}><Zap size={14} /> Aprobar para Drip</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* ESTILOS BASE Y BARRA SUPERIOR */
        .ff-kanban-page { display: flex; flex-direction: column; gap: 16px; font-family: 'Inter', sans-serif; padding-bottom: 40px; }
        .ff-mining-bar { display: flex; align-items: center; background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.02); flex-wrap: wrap; gap: 12px;}
        .mining-title { display: flex; align-items: center; gap: 12px; flex-grow: 1; border-right: 1px solid #e2e8f0; margin-right: 12px; padding-right: 16px; }
        .mining-title h3 { font-size: 14px; font-weight: 700; color: #0f172a; margin: 0; }
        .mining-title p { font-size: 11px; color: #64748b; margin: 2px 0 0 0; }
        .text-brand { color: #224c22; }
        
        .cmd-group { display: flex; align-items: center; gap: 8px; padding: 0 10px; }
        .border-right { border-right: 1px solid #e2e8f0; }
        .cmd-icon { color: #94a3b8; }
        .cmd-input { border: none; outline: none; font-size: 12px; font-weight: 600; color: #0f172a; width: 140px; background: transparent; }
        .mining-btn { background: #224c22; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 700; font-size: 12px; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: 0.2s; margin-left: auto;}
        .mining-btn:hover { background: #1a3a1a; }
        .mining-btn:disabled { opacity: 0.7; cursor: wait; }

        /* BARRA DE FILTROS */
        .ff-filters-bar-kanban { display: flex; gap: 10px; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 14px; flex-wrap: wrap;}
        .search-box { display: flex; align-items: center; gap: 8px; background: white; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0 10px; flex-grow: 1; max-width: 250px; height: 32px;}
        .search-icon { color: #94a3b8; }
        .search-box input { border: none; outline: none; width: 100%; font-size: 12px; color: #0f172a; background: transparent; }
        
        .filter-group { display: flex; align-items: center; gap: 6px; background: white; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0 8px; height: 32px;}
        .filter-group select { border: none; outline: none; font-size: 12px; color: #0f172a; font-weight: 600; background: transparent; cursor: pointer; height: 100%; width: 100%;}
        .text-gray { color: #94a3b8; }

        .archive-toggle { background: white; border: 1px solid #cbd5e1; color: #64748b; padding: 0 12px; border-radius: 6px; font-size: 12px; font-weight: 600; height: 32px; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: 0.2s;}
        .archive-toggle:hover { border-color: #94a3b8; color: #0f172a; }
        .archive-toggle.active { background: #fee2e2; border-color: #fecaca; color: #991b1b; }

        .master-control { margin-left: auto; display: flex; align-items: center; gap: 10px; border-left: 1px solid #e2e8f0; padding-left: 14px;}
        .status-label { font-size: 10px; font-weight: 800; color: #94a3b8; letter-spacing: 0.5px; }
        .status-label.active { color: #224c22; }
        
        .ff-switch { width: 36px; height: 18px; border-radius: 18px; border: none; padding: 2px; cursor: pointer; transition: 0.3s; position: relative; }
        .ff-switch.off { background: #cbd5e1; }
        .ff-switch.on { background: #224c22; }
        .switch-handle { width: 14px; height: 14px; background: white; border-radius: 50%; transition: 0.3s; transform: translateX(0); box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
        .ff-switch.on .switch-handle { transform: translateX(18px); }

        /* TABS NAVIGATION */
        .ff-tabs-container { display: flex; gap: 4px; border-bottom: 1px solid #e2e8f0; margin-bottom: 8px; padding: 0 4px; }
        .ff-tab-btn { display: flex; align-items: center; gap: 6px; padding: 10px 14px; background: transparent; border: none; border-bottom: 3px solid transparent; cursor: pointer; transition: 0.2s; margin-bottom: -1px; }
        .ff-tab-btn:hover:not(.active) { background: #f8fafc; border-bottom-color: #cbd5e1; }
        .tab-title { font-size: 13px; font-weight: 700; transition: 0.2s; }
        .tab-badge { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 10px; transition: 0.2s; }

        /* CARDS GRID & PAGINATION */
        .cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; align-items: start; }
        
        .ff-pagination { display: flex; justify-content: space-between; align-items: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
        .page-info { font-size: 12px; color: #64748b; font-weight: 500; }
        .page-controls { display: flex; align-items: center; gap: 12px; background: white; padding: 4px; border-radius: 8px; border: 1px solid #e2e8f0;}
        .page-btn { background: transparent; border: none; color: #0f172a; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 4px; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: 0.15s;}
        .page-btn:hover:not(:disabled) { background: #f1f5f9; }
        .page-btn:disabled { color: #cbd5e1; cursor: not-allowed; }
        .page-current { font-size: 12px; color: #64748b; font-weight: 500; }

        .empty-tab-state { text-align: center; padding: 60px 20px; color: #94a3b8; background: #f8fafc; border-radius: 10px; border: 1px dashed #cbd5e1; }
        .empty-tab-state h3 { color: #475569; margin: 12px 0 4px 0; font-size: 14px; font-weight: 600; }
        .empty-tab-state p { font-size: 12px; margin: 0; }
        .kanban-loading { text-align: center; padding: 60px; color: #64748b; display: flex; flex-direction: column; align-items: center; gap: 12px; font-size: 13px;}

        /* --- CARD STYLES OPTIMIZADOS PARA ESPACIO --- */
        .kanban-card { background: white; border-radius: 8px; padding: 12px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.02); transition: 0.15s; position: relative;}
        .kanban-card:hover { border-color: #cbd5e1; box-shadow: 0 4px 8px -2px rgba(0,0,0,0.05); transform: translateY(-1px); }
        .opacity-70 { opacity: 0.7; }
        
        .card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px; } /* Ajuste de margen */
        .company-name { font-size: 13px; font-weight: 700; color: #0f172a; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;}
        .location-line { font-size: 11px; color: #64748b; margin-top: 2px; display: flex; align-items: center; gap: 4px; }
        .lang-badge { font-size: 8px; font-weight: 800; padding: 1px 3px; border-radius: 3px; }
        .lang-badge.es { background: #fef3c7; color: #92400e; }
        .lang-badge.en { background: #dbeafe; color: #1e40af; }
        
        .score-badge { display: flex; align-items: center; gap: 3px; background: #fef9c3; color: #a16207; font-size: 11px; font-weight: 700; padding: 1px 6px; border-radius: 4px; border: 1px solid #fde68a;}

        /* NUEVA MICRO-LÍNEA DE CONTACTO */
        .card-contact-mini { display: flex; gap: 10px; margin-bottom: 6px; align-items: center; }
        .contact-item { display: flex; align-items: center; gap: 4px; font-size: 10px; color: #64748b; text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 125px;}
        .contact-item:hover { color: #2563eb; }

        /* TAGS DISCRETOS */
        .card-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; } /* Ajuste de margen */
        .tag-badge { background: transparent; color: #64748b; font-size: 9px; font-weight: 600; padding: 1px 5px; border-radius: 4px; border: 1px solid #e2e8f0; max-width: 80px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;}
        .tag-more { font-size: 9px; color: #94a3b8; font-weight: 600; padding-left: 2px; }

        .card-meta { display: flex; align-items: center; gap: 6px; border-top: 1px solid #f1f5f9; padding-top: 6px; margin-bottom: 8px; } /* Ajuste de padding/margen */
        .time-ago { font-size: 10px; color: #94a3b8; display: flex; align-items: center; gap: 3px; }
        .status-badge { font-size: 9px; font-weight: 700; padding: 1px 4px; border-radius: 3px; display: flex; align-items: center; gap: 2px;}
        .status-badge.hot { background: #ffedd5; color: #ea580c; }
        .status-badge.cold { background: #dbeafe; color: #2563eb; }

        .card-actions { display: flex; gap: 4px; justify-content: flex-end; }
        .card-btn { background: #f8fafc; border: 1px solid #e2e8f0; color: #64748b; width: 26px; height: 26px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.15s; font-size: 10px; font-weight: 600;}
        .card-btn:hover { background: #f1f5f9; color: #0f172a; border-color: #cbd5e1; }
        
        .card-btn.action-draft { width: auto; padding: 0 8px; gap: 4px;}
        .card-btn.action-draft:hover { color: #8b5cf6; background: #ede9fe; border-color: #ddd6fe; }
        .card-btn.action-draft.has-draft { color: #8b5cf6; border-color: #c4b5fd; background: #f5f3ff;}
        .card-btn.action-convert:hover { color: #224c22; background: #e0eee0; border-color: #c1d5c1; }
        .card-btn.action-archive:hover { color: #dc2626; background: #fee2e2; border-color: #fecaca; }
        .card-btn.action-link:hover { color: #2563eb; background: #dbeafe; border-color: #bfdbfe; }

        /* MODALES */
        .text-purple { color: #8b5cf6; }
        .ff-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.5); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px; }
        .ff-modal-card { background: white; width: 100%; max-width: 600px; border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); overflow: hidden; }
        .animate-slide-up { animation: slideUpModal 0.2s ease-out; }
        @keyframes slideUpModal { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        
        .modal-header { padding: 14px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; }
        .modal-title { font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 8px; font-size: 14px; }
        .modal-close { background: transparent; border: none; color: #94a3b8; cursor: pointer; padding: 4px; border-radius: 6px; display: flex;}
        .modal-close:hover { background: white; color: #0f172a; border: 1px solid #e2e8f0;}

        .modal-controls { display: flex; gap: 10px; padding: 12px 20px; background: white; border-bottom: 1px solid #f1f5f9; }
        .ff-select { padding: 8px 10px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 12px; color: #1e293b; flex-grow: 1; outline: none; font-weight: 500; }
        .ff-select:focus { border-color: #8b5cf6; box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1); }
        .ff-btn-secondary { background: white; border: 1px solid #cbd5e1; color: #475569; padding: 0 14px; border-radius: 6px; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: 0.2s;}
        .ff-btn-secondary:hover { border-color: #94a3b8; color: #0f172a; background: #f8fafc;}

        .modal-body { padding: 20px; }
        .modal-loading-state { text-align: center; padding: 30px; color: #64748b; display: flex; flex-direction: column; align-items: center; gap: 10px; font-size: 13px;}
        .draft-editor-container { display: flex; flex-direction: column; gap: 14px; }
        .draft-textarea { width: 100%; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; font-family: 'Inter', sans-serif; font-size: 12px; line-height: 1.6; color: #1e293b; outline: none; resize: vertical; background: #f8fafc;}
        .draft-textarea:focus { background: white; border-color: #8b5cf6; box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1); }
        
        .modal-footer-actions { display: flex; justify-content: flex-end; align-items: center; gap: 10px; }
        .ff-btn-mailto { background: white; color: #2563eb; border: 1px solid #bfdbfe; padding: 8px 14px; border-radius: 6px; font-weight: 700; font-size: 12px; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: 0.2s; }
        .ff-btn-mailto:hover { background: #eff6ff; }
        .ff-btn-primary { background: #0f172a; color: white; border: none; padding: 8px 14px; border-radius: 6px; font-weight: 700; font-size: 12px; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: 0.2s; }
        .ff-btn-primary:hover { background: #1e293b; }
      `}</style>
    </AdminLayout>
  );
}