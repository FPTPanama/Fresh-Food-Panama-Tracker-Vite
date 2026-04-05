import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { AdminLayout, notify } from '@/components/AdminLayout';
import { 
  BrainCircuit, Cpu, Mail, Loader2, Search, Zap, 
  Trash2, UserPlus, ChevronLeft, ChevronRight, 
  ExternalLink, RefreshCw, Phone, Star, 
  MapPin, Archive, Trophy, Package, Clock, Flame, Snowflake,
  Sparkles, X, Send, CheckSquare, Square, Filter, Tag, Play
} from 'lucide-react';

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

export default function LeadsIndex() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMining, setIsMining] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // MASTER SWITCH (Autopilot)
  const [autoEnabled, setAutoEnabled] = useState(false);

  // SELECCIÓN MASIVA (Bulk Actions)
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  
  // ESTADOS DEL MODAL
  const [draftModal, setDraftModal] = useState<{isOpen: boolean, lead: any, loading: boolean, emailType: string, editValue: string}>({
    isOpen: false, lead: null, loading: false, emailType: 'intro', editValue: ''
  });
  
  // FILTROS AVANZADOS
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("new");
  const [countryFilter, setCountryFilter] = useState("");
  
  const [targetLocation, setTargetLocation] = useState("Roma, Italia");
  const [targetProduct, setTargetProduct] = useState("Piña Premium"); 
  
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 10;

  // CARGAR CONFIGURACIÓN GLOBAL AL INICIO
  useEffect(() => {
    const getSettings = async () => {
      const { data } = await supabase.from('global_settings').select('automation_enabled').single();
      if (data) setAutoEnabled(data.automation_enabled);
    };
    getSettings();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const from = (page - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;

    try {
      let query = supabase.from('leads_prospecting').select('*', { count: 'exact' });
      if (q) query = query.ilike('company_name', `%${q}%`);
      if (statusFilter) query = query.eq('status', statusFilter);
      if (countryFilter) query = query.eq('country_code', countryFilter);

      const { data, count, error } = await query
        .order('lead_score', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      setLeads(data || []);
      setTotalItems(count || 0);
      setSelectedLeads([]); 
    } catch (e) {
      notify("Error al cargar datos", "error");
    } finally {
      setLoading(false);
    }
  }, [page, q, statusFilter, countryFilter]);

  useEffect(() => { 
    const delayDebounce = setTimeout(() => { fetchData(); }, 400);
    return () => clearTimeout(delayDebounce);
  }, [fetchData]);

  // TOGGLE MASTER SWITCH
  const toggleGlobalAutomation = async () => {
    const newValue = !autoEnabled;
    const { error } = await supabase.from('global_settings').update({ automation_enabled: newValue }).eq('id', 1);
    if (!error) {
      setAutoEnabled(newValue);
      notify(`Autopilot ${newValue ? 'ACTIVADO (Goteo iniciado)' : 'PAUSADO'}`, "success");
    } else {
      notify("Error al actualizar configuración", "error");
    }
  };

  // LOGICA DE SELECCIÓN
  const toggleSelection = (id: string) => {
    setSelectedLeads(prev => prev.includes(id) ? prev.filter(leadId => leadId !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedLeads.length === leads.length) setSelectedLeads([]);
    else setSelectedLeads(leads.map(l => l.id));
  };

  // ACCIONES MASIVAS
  const handleRunCampaign = async () => {
    if (selectedLeads.length === 0) return;
    const context = window.prompt(
      `🚀 LANZAR CAMPAÑA PARA ${selectedLeads.length} LEADS\n\n` +
      `Describe la oferta (ej: Tarifas especiales Iberia/AirEuropa, salidas diarias):`
    );
    if (!context) return;
  
    setLoading(true);
    try {
      const res = await fetch('/.netlify/functions/generate-campaign', {
        method: 'POST',
        body: JSON.stringify({ leadIds: selectedLeads, campaignContext: context, productName: targetProduct })
      });
  
      if (res.ok) {
        notify(`Campaña generada. ${selectedLeads.length} correos en cola de envío.`, "success");
        setSelectedLeads([]);
        fetchData();
      } else {
        throw new Error("Fallo en el servidor al generar campaña");
      }
    } catch (err) {
      notify("Error al lanzar campaña", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkApprove = async () => {
    if(!window.confirm(`¿Aprobar ${selectedLeads.length} leads para la cola de envío?`)) return;
    const { error } = await supabase.from('leads_prospecting').update({ pipeline_stage: 'queued' }).in('id', selectedLeads);
    if (!error) {
      notify(`${selectedLeads.length} leads enviados a la cola de goteo`, "success");
      setSelectedLeads([]);
      fetchData();
    }
  };

  // FUNCIONES INDIVIDUALES
  const runMining = async () => {
    if (!window.confirm(`¿Buscar 10 importadores de ${targetProduct} en ${targetLocation}?`)) return;
    setIsMining(true);
    try {
      const res = await fetch('/.netlify/functions/mine-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: targetLocation, product: targetProduct })
      });
      if (res.ok) { notify(`Completado: Búsqueda de ${targetProduct}`, "success"); setPage(1); fetchData(); }
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
        fetchData(); 
      } else throw new Error(result.error);
    } catch (err) {
      notify("Error al generar borrador", "error");
      setDraftModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleMailTo = () => {
    const subject = encodeURIComponent(`Borrador Prospección: ${draftModal.lead.company_name}`);
    const body = encodeURIComponent(draftModal.editValue);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const renderIntelligence = (tagsArray: string[] | string) => {
    const tags = Array.isArray(tagsArray) ? tagsArray : (typeof tagsArray === 'string' ? tagsArray.split('|').map(t => t.trim()) : []);
    if (!tags || tags.length === 0) return <span className="ai-text-fallback">Sin datos</span>;
    return (
      <div className="intelligence-tags">
        {tags.map((tag, i) => (
          <div key={i} className="intel-badge">
            <span className="intel-value">{tag.replace(/Foco:|Vol:|Log:|Segmento:/g, '')}</span>
          </div>
        ))}
      </div>
    );
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  return (
    <AdminLayout title="Intelligence Hub" subtitle="Motor Multi-Commodity de Prospección">
      <div className="ff-page-wrapper">
        
        {/* HEADER & COMANDOS */}
        <div className="ff-header-section">
          <div className="ff-tabs-slack">
            <button className={statusFilter === 'new' ? 'active' : ''} onClick={() => { setStatusFilter('new'); setPage(1); }}>
              <BrainCircuit size={15} strokeWidth={2.5} className="ai-brain-icon" /> Bandeja
            </button>
            <button className={statusFilter === 'converted' ? 'active' : ''} onClick={() => { setStatusFilter('converted'); setPage(1); }}>
              <Zap size={14} strokeWidth={2.5} /> Convertidos
            </button>
            <button className={statusFilter === 'rejected' ? 'active' : ''} onClick={() => { setStatusFilter('rejected'); setPage(1); }}>
              <Archive size={14} strokeWidth={2.5} /> Archivados
            </button>
          </div>

          <div className="ff-command-bar">
            <div className="cmd-group border-right">
              <Package size={14} className="cmd-icon" />
              <input value={targetProduct} onChange={(e) => setTargetProduct(e.target.value)} className="cmd-input" placeholder="Ej. Piña..." />
            </div>
            <div className="cmd-group">
              <MapPin size={14} className="cmd-icon" />
              <input value={targetLocation} onChange={(e) => setTargetLocation(e.target.value)} className="cmd-input" placeholder="Ciudad o Mercado..." />
            </div>
            <button className="cmd-btn" onClick={runMining} disabled={isMining}>
              {isMining ? <Loader2 size={14} className="animate-spin" /> : <Cpu size={14} />}
              {isMining ? "Procesando" : "Minar IA"}
            </button>
          </div>
        </div>

        {/* BARRA DE FILTROS AVANZADOS Y SWITCH MAESTRO */}
        <div className="ff-filters-bar">
          <div className="filter-item search-box">
            <Search size={15} className="search-icon" />
            <input placeholder="Buscar empresa..." value={q} onChange={e => {setQ(e.target.value); setPage(1);}} />
          </div>
          
          <div className="filter-item">
            <Filter size={14} className="filter-icon" />
            <select value={countryFilter} onChange={(e) => {setCountryFilter(e.target.value); setPage(1);}}>
              <option value="">Todos los países</option>
              <option value="ES">🇪🇸 España</option>
              <option value="IT">🇮🇹 Italia</option>
              <option value="FR">🇫🇷 Francia</option>
              <option value="DE">🇩🇪 Alemania</option>
            </select>
          </div>

          {/* MASTER SWITCH */}
          <div className="master-control">
            <span className={`status-label ${autoEnabled ? 'active' : ''}`}>
              {autoEnabled ? 'AUTOPILOT ON' : 'AUTOPILOT OFF'}
            </span>
            <button 
              className={`ff-switch ${autoEnabled ? 'on' : 'off'}`} 
              onClick={toggleGlobalAutomation}
            >
              <div className="switch-handle" />
            </button>
          </div>
        </div>

        {/* DATA TABLE */}
        <div className="ff-table-container">
          <div className="ff-table-header lead-grid">
            <div className="th-cell checkbox-cell" onClick={toggleSelectAll} style={{cursor: 'pointer'}}>
              {selectedLeads.length === leads.length && leads.length > 0 ? <CheckSquare size={16} className="text-brand"/> : <Square size={16} className="text-gray"/>}
            </div>
            <div className="th-cell">EMPRESA & STATUS</div>
            <div className="th-cell">ETIQUETAS IA</div>
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
                <p>No se encontraron resultados para esta búsqueda.</p>
              </div>
            ) : (
              leads.map((item) => {
                const daysOld = Math.floor((new Date().getTime() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24));
                const isHot = item.lead_score >= 4 && daysOld <= 3;
                const isCold = statusFilter === 'new' && daysOld > 14;
                const isSelected = selectedLeads.includes(item.id);
                const isEnglish = item.country_code !== 'ES'; // Lógica para el badge de idioma

                return (
                  <div key={item.id} className={`ff-table-row lead-grid ${isCold ? 'opacity-70' : ''} ${isSelected ? 'row-selected' : ''}`}>
                    
                    {/* CHECKBOX */}
                    <div className="td-cell checkbox-cell" onClick={() => toggleSelection(item.id)} style={{cursor: 'pointer'}}>
                      {isSelected ? <CheckSquare size={16} className="text-brand"/> : <Square size={16} className="text-gray hover-show"/>}
                    </div>

                    <div className="td-cell col-ident" onClick={() => toggleSelection(item.id)}>
                      <div className="name-with-vip">
                        <span className="client-name">{item.company_name}</span>
                        {Number(item.lead_score) >= 5 && (
                          <span title="Top Priority" style={{ display: 'flex' }}>
                            <Trophy size={14} className="vip-trophy" />
                          </span>
                        )}
                      </div>
                      
                      <div className="meta-sub">
                        {/* BADGE DE IDIOMA DINÁMICO */}
                        <span className={`lang-badge ${isEnglish ? 'en' : 'es'}`}>
                          {isEnglish ? 'EN' : 'ES'}
                        </span>
                        <span className="meta-item"><Clock size={10} /> {getTimeAgo(item.created_at)}</span>
                        <span className="meta-separator">•</span>
                        <span>{getFlag(item.country_code || item.country)} {item.city}</span>
                        {isHot && <span className="meta-hot"><Flame size={12}/> Hot</span>}
                        {isCold && <span className="meta-cold"><Snowflake size={12}/> Cold</span>}
                      </div>
                    </div>

                    <div className="td-cell col-analysis">
                      {renderIntelligence(item.tags || item.ai_analysis)}
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
                            <button 
                              className={`ghost-btn action-draft ${item.email_draft ? 'has-draft' : ''}`} 
                              title={item.email_draft ? "Ver Borrador" : "Generar Email IA"} 
                              onClick={(e) => { e.stopPropagation(); handleGenerateDraft(item, item.last_email_type || 'intro', false); }}
                            >
                              <Sparkles size={16} />
                            </button>
                            <button className="ghost-btn action-convert" title="Convertir a Cliente" onClick={(e) => { e.stopPropagation(); handleConvert(item.id); }} disabled={!!processingId}>
                              {processingId === item.id ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                            </button>
                          </>
                        )}
                        <a href={item.website} target="_blank" title="Visitar Web" className="ghost-btn action-link" onClick={e => e.stopPropagation()}>
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
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="pager-btn"><ChevronLeft size={16} /></button>
              <span className="page-current">{page}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} className="pager-btn"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}

        {/* BULK ACTIONS BAR (Centro de Comando Global) */}
        {selectedLeads.length > 0 && (
          <div className="ff-bulk-bar">
            <div className="bulk-count">
              <span className="badge">{selectedLeads.length}</span> leads seleccionados
            </div>
            <div className="bulk-actions">
              <button className="bulk-btn primary" onClick={handleRunCampaign}>
                <Zap size={14} /> Lanzar Campaña Masiva
              </button>
              <button className="bulk-btn" onClick={handleBulkApprove}>
                <Play size={14} /> Aprobar para Goteo
              </button>
              <button className="bulk-btn danger" onClick={() => {
                if (window.confirm("¿Archivar seleccionados?")) {
                  selectedLeads.forEach(id => handleArchive(id));
                  setSelectedLeads([]);
                }
              }}>
                <Trash2 size={14} /> Archivar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DEL BORRADOR DE EMAIL */}
      {draftModal.isOpen && draftModal.lead && (
        <div className="ff-modal-overlay" onClick={() => setDraftModal({isOpen: false, lead: null, loading: false, emailType: 'intro', editValue: ''})}>
          <div className="ff-modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title"><Sparkles size={16} className="modal-icon" /> Outreach: {draftModal.lead.company_name}</div>
              <button className="modal-close" onClick={() => setDraftModal({isOpen: false, lead: null, loading: false, emailType: 'intro', editValue: ''})}><X size={16} /></button>
            </div>
            
            <div className="modal-controls">
              <select className="ff-select" value={draftModal.emailType} onChange={(e) => handleGenerateDraft(draftModal.lead, e.target.value, true)} disabled={draftModal.loading}>
                <option value="intro">Primer Contacto (Intro)</option>
                <option value="vip">Socio Estratégico (VIP)</option>
                <option value="seguimiento_1">Seguimiento 1 (Transparencia)</option>
                <option value="seguimiento_2">Seguimiento 2 (Prueba Piloto)</option>
              </select>
              <button className="ff-btn-secondary" onClick={() => handleGenerateDraft(draftModal.lead, draftModal.emailType, true)} disabled={draftModal.loading}>
                <RefreshCw size={14} className={draftModal.loading ? 'animate-spin' : ''} /> Regenerar
              </button>
            </div>

            <div className="modal-body">
              {draftModal.loading ? (
                <div className="modal-loading"><Loader2 className="animate-spin" size={24} /><p>Gemini 2.5 Flash aplicando estrategia...</p></div>
              ) : (
                <div className="draft-container">
                  <textarea className="draft-editor" value={draftModal.editValue} onChange={(e) => setDraftModal(prev => ({...prev, editValue: e.target.value}))} rows={12}/>
                  <div className="modal-footer">
                    <button className="ff-btn-mailto" onClick={handleMailTo}><Send size={14} /> Enviar a Gerencia</button>
                    <button className="ff-btn-primary" onClick={async () => {
                      await supabase.from('leads_prospecting').update({ pipeline_stage: 'queued' }).eq('id', draftModal.lead.id);
                      notify("Lead encolado para envío. Revisa el Master Switch.", "success");
                      setDraftModal({isOpen: false, lead: null, loading: false, emailType: 'intro', editValue: ''});
                      fetchData();
                    }}><Mail size={14} /> Aprobar</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* --- ESTILOS BASE --- */
        .ff-page-wrapper { display: flex; flex-direction: column; gap: 16px; font-family: 'Inter', 'Poppins', sans-serif; color: #1e293b; padding-bottom: 80px; }
        .ff-header-section { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
        
        .ff-tabs-slack { display: flex; background: #f1f5f9; padding: 4px; border-radius: 8px; }
        .ff-tabs-slack button { padding: 6px 14px; border: none; background: transparent; border-radius: 6px; font-size: 13px; font-weight: 600; color: #64748b; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s; }
        .ff-tabs-slack button:hover { color: #0f172a; }
        .ff-tabs-slack button.active { background: white; color: #224c22; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .ff-tabs-slack button.active .ai-brain-icon { color: #224c22; filter: drop-shadow(0 0 3px rgba(34, 76, 34, 0.2)); }

        .ff-command-bar { display: flex; align-items: center; background: white; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.02); overflow: hidden; height: 38px;}
        .cmd-group { display: flex; align-items: center; padding: 0 12px; height: 100%; }
        .border-right { border-right: 1px solid #e2e8f0; }
        .cmd-icon { color: #94a3b8; margin-right: 6px;}
        .cmd-input { border: none; outline: none; font-size: 13px; font-weight: 500; color: #0f172a; width: 140px; background: transparent; }
        .cmd-btn { background: #224c22; color: white; border: none; padding: 0 16px; height: 100%; font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: 0.2s; }
        .cmd-btn:hover { background: #1a3a1a; }
        .cmd-btn:disabled { opacity: 0.7; cursor: wait; }

        /* --- FILTROS AVANZADOS Y SWITCH --- */
        .ff-filters-bar { display: flex; gap: 12px; align-items: center; background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
        .filter-item { display: flex; align-items: center; gap: 8px; }
        .search-box { flex-grow: 1; border-right: 1px solid #e2e8f0; padding-right: 12px; }
        .search-icon, .filter-icon { color: #94a3b8; }
        .search-box input { border: none; outline: none; width: 100%; font-size: 13px; color: #0f172a; }
        .filter-item select { border: none; outline: none; font-size: 13px; color: #0f172a; font-weight: 500; background: transparent; cursor: pointer; }

        .master-control { border-left: 1px solid #e2e8f0; padding-left: 16px; margin-left: auto; display: flex; align-items: center; gap: 12px; }
        .status-label { font-size: 11px; font-weight: 800; color: #94a3b8; letter-spacing: 0.5px; }
        .status-label.active { color: #224c22; }
        .ff-switch { width: 44px; height: 22px; border-radius: 20px; border: none; padding: 2px; cursor: pointer; transition: 0.3s; position: relative; }
        .ff-switch.off { background: #cbd5e1; }
        .ff-switch.on { background: #224c22; }
        .switch-handle { width: 18px; height: 18px; background: white; border-radius: 50%; transition: 0.3s; transform: translateX(0); box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .ff-switch.on .switch-handle { transform: translateX(22px); }

        /* --- DATA GRID --- */
        .ff-table-container { background: white; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); overflow: hidden; }
        .lead-grid { display: grid; grid-template-columns: 40px minmax(200px, 1.4fr) 2fr 1.2fr 80px 100px; gap: 16px; align-items: center; }
        
        .ff-table-header { background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 12px 20px; }
        .th-cell { font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 0.5px; }
        
        .ff-table-row { padding: 12px 20px; border-bottom: 1px solid #f1f5f9; transition: background 0.15s; }
        .ff-table-row:hover { background: #f8fafc; }
        .ff-table-row.row-selected { background: #f0fdf4 !important; border-left: 3px solid #224c22; }
        
        .checkbox-cell { display: flex; align-items: center; justify-content: center; }
        .text-gray { color: #cbd5e1; transition: 0.2s; }
        .text-brand { color: #224c22; }
        .ff-table-row:hover .hover-show { color: #94a3b8; }

        .client-name { font-size: 14px; font-weight: 600; color: #0f172a; letter-spacing: -0.01em; }
        .name-with-vip { display: flex; align-items: center; gap: 6px; }
        .vip-trophy { color: #eab308; animation: float 3s ease-in-out infinite; }

        /* --- LANGUAGE BADGES --- */
        .lang-badge { font-size: 9px; font-weight: 800; padding: 1px 4px; border-radius: 4px; letter-spacing: 0.5px; }
        .lang-badge.es { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
        .lang-badge.en { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }

        .meta-sub { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #64748b; margin-top: 4px; }
        .meta-item { display: flex; align-items: center; gap: 3px; }
        .meta-separator { opacity: 0.4; }
        .meta-hot { display: flex; align-items: center; gap: 2px; color: #ea580c; font-weight: 700; background: #ffedd5; padding: 1px 6px; border-radius: 4px; font-size: 10px; margin-left: 4px;}
        .meta-cold { display: flex; align-items: center; gap: 2px; color: #3b82f6; font-weight: 700; background: #dbeafe; padding: 1px 6px; border-radius: 4px; font-size: 10px; margin-left: 4px;}
        .opacity-70 { opacity: 0.7; }

        .contact-line { font-size: 12px; color: #475569; display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
        
        .intelligence-tags { display: flex; flex-wrap: wrap; gap: 6px; }
        .intel-badge { display: flex; align-items: center; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden; }
        .intel-value { padding: 3px 8px; color: #475569; font-size: 11px; font-weight: 600; }

        .actions-group { display: flex; justify-content: flex-end; gap: 4px; }
        .ghost-btn { background: transparent; border: none; color: #94a3b8; width: 32px; height: 32px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
        .ghost-btn:hover { color: #0f172a; background: #f1f5f9; }
        .ghost-btn.action-convert:hover { color: #224c22; background: #e0eee0; }
        .ghost-btn.action-archive:hover { color: #ea580c; background: #ffedd5; }
        .ghost-btn.action-link:hover { color: #2563eb; background: #dbeafe; }
        .ghost-btn.action-draft:hover { color: #8b5cf6; background: #ede9fe; }
        .ghost-btn.action-draft.has-draft { color: #8b5cf6; } 

        .loading-state, .empty-state { padding: 40px; text-align: center; color: #64748b; font-size: 14px; display: flex; flex-direction: column; align-items: center; gap: 12px; }

        .ff-pagination-slack { display: flex; justify-content: space-between; align-items: center; padding: 8px 4px; }
        .page-stats { font-size: 13px; color: #64748b; }
        .page-actions { display: flex; align-items: center; gap: 8px; background: white; border: 1px solid #e2e8f0; padding: 4px; border-radius: 8px; }
        .pager-btn { background: transparent; border: none; color: #64748b; padding: 4px; border-radius: 4px; cursor: pointer; transition: 0.1s; display: flex;}
        .pager-btn:hover:not(:disabled) { background: #f1f5f9; color: #0f172a; }
        .pager-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .page-current { font-size: 13px; font-weight: 600; color: #0f172a; padding: 0 8px; min-width: 24px; text-align: center; }

        /* --- BULK ACTIONS FLOATING BAR --- */
        .ff-bulk-bar { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: #0f172a; color: white; padding: 12px 24px; border-radius: 50px; display: flex; gap: 24px; align-items: center; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.3); z-index: 100; animation: slideUpBulk 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes slideUpBulk { from { transform: translate(-50%, 40px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        
        .bulk-count { font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 8px; border-right: 1px solid rgba(255,255,255,0.1); padding-right: 24px; }
        .bulk-count .badge { background: #224c22; color: white; padding: 2px 8px; border-radius: 12px; font-weight: 700; }
        
        .bulk-actions { display: flex; gap: 12px; }
        .bulk-btn { background: transparent; border: none; color: #cbd5e1; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 20px; transition: 0.2s; }
        .bulk-btn:hover { background: rgba(255,255,255,0.1); color: white; }
        .bulk-btn.primary { color: #a7f3d0; }
        .bulk-btn.primary:hover { background: #064e3b; color: #34d399; }
        .bulk-btn.danger { color: #fecaca; }
        .bulk-btn.danger:hover { background: #7f1d1d; color: #f87171; }

        /* MODALES */
        .ff-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; z-index: 9999; }
        .ff-modal-card { background: white; width: 100%; max-width: 600px; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); overflow: hidden; animation: slideUp 0.2s ease-out; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .modal-header { padding: 16px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; }
        .modal-title { font-weight: 600; color: #0f172a; display: flex; align-items: center; gap: 8px; font-size: 14px; }
        .modal-icon { color: #8b5cf6; }
        .modal-close { background: transparent; border: none; color: #64748b; cursor: pointer; padding: 4px; border-radius: 4px; }
        .modal-controls { display: flex; gap: 12px; padding: 12px 20px; background: white; border-bottom: 1px solid #f1f5f9; }
        .ff-select { padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 13px; color: #334155; flex-grow: 1; outline: none; }
        .ff-btn-secondary { background: white; border: 1px solid #cbd5e1; color: #475569; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; cursor: pointer; }
        .modal-body { padding: 20px; }
        .draft-editor { width: 100%; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; font-family: 'Inter', sans-serif; font-size: 13px; line-height: 1.6; color: #1e293b; outline: none; resize: vertical; }
        .modal-footer { display: flex; justify-content: flex-end; align-items: center; gap: 12px; padding-top: 8px; }
        .ff-btn-mailto { background: white; color: #2563eb; border: 1px solid #bfdbfe; padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 6px; cursor: pointer; }
        .ff-btn-primary { background: #0f172a; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 6px; cursor: pointer; }
      `}</style>
    </AdminLayout>
  );
}