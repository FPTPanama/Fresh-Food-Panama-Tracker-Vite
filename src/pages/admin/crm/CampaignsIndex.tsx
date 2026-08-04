import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { AdminLayout } from '@/components/AdminLayout';
import { BarChart3, MailOpen, Send, Clock, Play, RefreshCw, CheckCircle2, X, MessageSquare, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Users, ArchiveRestore, Plus, Loader2, Filter, Target, Briefcase } from 'lucide-react';

export default function CampaignsIndex() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Pestañas y Paginación
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedCamp, setExpandedCamp] = useState<string | null>(null);
  const itemsPerPage = 5;
  
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [replyNotes, setReplyNotes] = useState('');
  const [savingReply, setSavingReply] = useState(false);

  // === ESTADOS DEL SEGMENTADOR (BUILDER) ===
  const [showBuilder, setShowBuilder] = useState(false);
  
  // Fuente de Audiencia
  const [audienceSource, setAudienceSource] = useState<'leads' | 'clients'>('leads');
  const [availableLeads, setAvailableLeads] = useState<any[]>([]);
  const [availableClients, setAvailableClients] = useState<any[]>([]);
  
  const [filterCountry, setFilterCountry] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [builderContext, setBuilderContext] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingSequence, setIsSavingSequence] = useState(false);
  const [previewSequence, setPreviewSequence] = useState<any[] | null>(null);

  // --- FETCH DATA ---
  const fetchCampaigns = async () => {
    setRefreshing(true);
    try {
      // 1. Buscamos en Prospectos
      const { data: leadsData, error: leadsErr } = await supabase
        .from('leads_prospecting')
        .select('id, company_name, city, country_code, active_campaign, pipeline_stage, status, sent_at, opened_at, replied_at, email_draft, reply_notes')
        .not('active_campaign', 'is', null);

      if (leadsErr) throw leadsErr;

      // 2. Buscamos en Clientes Actuales
      const { data: clientsData, error: clientsErr } = await supabase
        .from('clients')
        .select('id, name, city, country, active_campaign, pipeline_stage, sent_at, opened_at, replied_at, email_draft, reply_notes')
        .not('active_campaign', 'is', null);

      if (clientsErr) throw clientsErr;

      // 3. Normalizamos y unimos ambas listas
      const combinedData = [
        ...(leadsData || []).map(l => ({ ...l, type: 'prospecto' })),
        ...(clientsData || []).map(c => ({
          ...c,
          company_name: c.name, 
          country_code: c.country,
          status: 'in_pipeline', 
          type: 'cliente'
        }))
      ];

      // 4. Agrupamos por nombre de campaña
      const grouped = combinedData.reduce((acc: any, item: any) => {
        const camp = item.active_campaign;
        if (!acc[camp]) {
          acc[camp] = { name: camp, total: 0, queued: 0, sent: 0, opened: 0, replied: 0, leads: [] };
        }
        acc[camp].total += 1;
        acc[camp].leads.push(item);
        
        // Lógica de métricas
        if (item.pipeline_stage === 'queued' || item.status === 'in_pipeline' || !item.sent_at) acc[camp].queued += 1;
        if (item.sent_at) acc[camp].sent += 1;
        if (item.opened_at) acc[camp].opened += 1;
        if (item.replied_at || item.pipeline_stage === 'replied') acc[camp].replied += 1;
        
        return acc;
      }, {});

      setCampaigns(Object.values(grouped).sort((a: any, b: any) => b.name.localeCompare(a.name)));
      
    } catch (error) {
      console.error("Error cargando campañas unificadas:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchAudiences = async () => {
    const { data: leads } = await supabase.from('leads_prospecting').select('id, company_name, city, country_code, preferred_language, tags').eq('status', 'new');
    if (leads) setAvailableLeads(leads.map(l => ({ ...l, display_name: l.company_name })));

    const { data: clients } = await supabase.from('clients').select('id, name, city, country, preferred_language');
    if (clients) {
      setAvailableClients(clients.map(c => ({ 
        ...c, 
        display_name: c.name,
        country_code: c.country, 
        tags: [] 
      })));
    }
  };

  useEffect(() => {
    fetchCampaigns();
    fetchAudiences();
  }, []);

  // --- LÓGICA DE INTERFAZ ---
  const handleSaveReply = async () => {
    if (!selectedLead) return;
    setSavingReply(true);
    try {
      const now = new Date().toISOString();
      // Dependiendo del tipo, actualizamos la tabla correcta
      const tableName = selectedLead.type === 'cliente' ? 'clients' : 'leads_prospecting';
      
      const { error } = await supabase.from(tableName).update({
        replied_at: now,
        reply_notes: replyNotes,
        pipeline_stage: 'replied'
      }).eq('id', selectedLead.id);

      if (error) throw error;
      setReplyNotes('');
      setSelectedLead(null);
      fetchCampaigns();
    } catch (error: any) {
      alert("Error al guardar la respuesta: " + error.message);
    } finally {
      setSavingReply(false);
    }
  };

  const toggleExpand = (campName: string) => setExpandedCamp(expandedCamp === campName ? null : campName);
  const handleTabChange = (tab: 'active' | 'history') => { setActiveTab(tab); setCurrentPage(1); setExpandedCamp(null); };

  // --- LÓGICA DEL SEGMENTADOR (BUILDER) ---
  const currentAudienceList = audienceSource === 'leads' ? availableLeads : availableClients;

  const uniqueCountries = useMemo(() => Array.from(new Set(currentAudienceList.map(l => l.country_code).filter(Boolean))), [currentAudienceList]);
  const uniqueLanguages = useMemo(() => Array.from(new Set(currentAudienceList.map(l => l.preferred_language).filter(Boolean))), [currentAudienceList]);
  const uniqueTags = useMemo(() => Array.from(new Set(currentAudienceList.flatMap(l => l.tags || []).filter(Boolean))), [currentAudienceList]);

  const filteredAudience = useMemo(() => {
    return currentAudienceList.filter(l => {
      if (filterCountry && l.country_code !== filterCountry) return false;
      if (filterLanguage && l.preferred_language !== filterLanguage) return false;
      if (filterTag && (!l.tags || !l.tags.includes(filterTag))) return false;
      return true;
    });
  }, [currentAudienceList, filterCountry, filterLanguage, filterTag]);

  useEffect(() => {
    setSelectedLeadIds([]);
    setFilterCountry(''); setFilterLanguage(''); setFilterTag('');
  }, [audienceSource]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelectedLeadIds(filteredAudience.map(l => l.id));
    else setSelectedLeadIds([]);
  };

  const toggleLeadSelection = (id: string) => {
    setSelectedLeadIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleGeneratePreview = async () => {
    if (selectedLeadIds.length === 0 || !builderContext) return alert("Selecciona al menos un cliente y escribe un contexto.");
    setIsGenerating(true); setPreviewSequence(null);
    try {
      const response = await fetch('/.netlify/functions/generate-sequence-preview', {
        method: 'POST',
        body: JSON.stringify({ leadIds: selectedLeadIds, campaignContext: builderContext, audienceType: audienceSource })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setPreviewSequence(data.sequence);
    } catch (err: any) { alert("Error generando secuencia: " + err.message); } finally { setIsGenerating(false); }
  };

  const handleApproveAndEnqueue = async () => {
    if (!previewSequence) return;
    setIsSavingSequence(true);
    try {
      const response = await fetch('/.netlify/functions/save-approved-campaign', {
        method: 'POST',
        body: JSON.stringify({ leadIds: selectedLeadIds, campaignContext: builderContext, approvedSequence: previewSequence, audienceType: audienceSource })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      alert("¡Campaña encolada para " + selectedLeadIds.length + (audienceSource === 'leads' ? " prospectos!" : " clientes!"));
      setShowBuilder(false); setPreviewSequence(null); setBuilderContext(''); setSelectedLeadIds([]);
      fetchCampaigns(); fetchAudiences();
    } catch (err: any) { alert("Error al encolar: " + err.message); } finally { setIsSavingSequence(false); }
  };

  const activeCampaigns = campaigns.filter(c => c.queued > 0);
  const historyCampaigns = campaigns.filter(c => c.queued === 0);
  const displayedCampaigns = activeTab === 'active' ? activeCampaigns : historyCampaigns;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = displayedCampaigns.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(displayedCampaigns.length / itemsPerPage) || 1;

  return (
    <AdminLayout title="Performance de Campañas" subtitle="Rastreo de Aperturas y Goteo de Correos">
      <div className="ff-campaigns-wrapper">
        <div className="top-bar">
          <div className="ff-tabs">
            <button className={`ff-tab ${activeTab === 'active' ? 'active' : ''}`} onClick={() => handleTabChange('active')}><Play size={16}/> En Curso</button>
            <button className={`ff-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => handleTabChange('history')}><ArchiveRestore size={16}/> Historial</button>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="ff-btn-secondary" onClick={fetchCampaigns} disabled={refreshing}><RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Actualizar</button>
            <button className="ff-btn-primary" onClick={() => setShowBuilder(true)}><Plus size={16} /> Segmentar & Nueva Campaña</button>
          </div>
        </div>

        {loading ? (
          <div className="empty-state"><RefreshCw className="animate-spin text-gray" size={32} /><p>Cargando métricas...</p></div>
        ) : displayedCampaigns.length === 0 ? (
          <div className="empty-state">
            <BarChart3 size={32} className="text-gray" />
            <p>{activeTab === 'active' ? 'No hay campañas en progreso actualmente.' : 'El historial está vacío.'}</p>
          </div>
        ) : (
          <div className="campaigns-list">
            {currentItems.map((camp: any, idx: number) => {
              const openRate = camp.sent > 0 ? Math.round((camp.opened / camp.sent) * 100) : 0;
              const replyRate = camp.sent > 0 ? Math.round((camp.replied / camp.sent) * 100) : 0;
              const progress = Math.round((camp.sent / camp.total) * 100);
              const isExpanded = expandedCamp === camp.name;

              return (
                <div key={idx} className={`campaign-card compact ${isExpanded ? 'expanded' : ''}`}>
                  <div className="camp-header-linear" onClick={() => toggleExpand(camp.name)}>
                    <div className="camp-info-main">
                      <BarChart3 size={16} className="text-brand flex-shrink-0" />
                      <span className="camp-name-text">{camp.name}</span>
                      {camp.queued > 0 ? <span className="badge active"><Play size={10}/> En Progreso</span> : <span className="badge completed"><CheckCircle2 size={10}/> Completada</span>}
                    </div>

                    <div className="camp-quick-metrics">
                      <div className="qm-item" title="Audiencia Total"><Users size={14}/> {camp.total}</div>
                      <div className="qm-item text-orange" title="En Cola"><Clock size={14}/> {camp.queued}</div>
                      <div className="qm-item text-blue" title="Enviados"><Send size={14}/> {camp.sent}</div>
                      <div className="qm-item text-green" title="Aperturas"><MailOpen size={14}/> {openRate}%</div>
                      <div className="qm-item text-purple" title="Respuestas"><MessageSquare size={14}/> {replyRate}%</div>
                    </div>

                    <div className="camp-quick-progress">
                      <div className="progress-bar-bg"><div className="progress-bar-fill" style={{ width: `${progress}%` }}></div></div>
                    </div>

                    <button className="expand-btn">
                      {isExpanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="camp-expanded-content">
                      <div className="camp-leads-table">
                        <div className="camp-lead-header">
                          <div>EMPRESA</div>
                          <div>ESTADO</div>
                          <div>ÚLTIMA ACTIVIDAD</div>
                        </div>
                        {camp.leads.map((l: any) => (
                          <div key={l.id} className="camp-lead-row hoverable" onClick={(e) => { e.stopPropagation(); setSelectedLead(l); }}>
                            <div className="col-name">
                              {l.company_name} <span style={{fontSize: '10px', color: '#94a3b8', fontWeight: 'normal', marginLeft: '4px'}}>{l.type === 'cliente' ? '(Cliente)' : ''}</span>
                            </div>
                            <div className="col-status">
                              {l.replied_at ? <span className="status-badge replied">Respondido</span> :
                               l.opened_at ? <span className="status-badge opened">Abierto</span> : 
                               l.sent_at ? <span className="status-badge sent">Enviado</span> : 
                               l.pipeline_stage?.includes('error') || l.pipeline_stage?.includes('skipped') ? <span className="status-badge error">Fallido / Saltado</span> :
                               <span className="status-badge queued">En Cola</span>}
                            </div>
                            <div className="col-date">
                              {l.replied_at ? new Date(l.replied_at).toLocaleString() :
                               l.opened_at ? new Date(l.opened_at).toLocaleString() : 
                               l.sent_at ? new Date(l.sent_at).toLocaleString() : 
                               l.pipeline_stage?.includes('error') || l.pipeline_stage?.includes('skipped') ? 'Cancelado' : 'Pendiente'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {totalPages > 1 && (
              <div className="pagination-controls">
                <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="page-btn">
                  <ChevronLeft size={16} /> Anterior
                </button>
                <span className="page-info">Página {currentPage} de {totalPages}</span>
                <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="page-btn">
                  Siguiente <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- PANEL LATERAL: CRM TIMELINE --- */}
      {selectedLead && (
        <div className="panel-overlay" onClick={() => setSelectedLead(null)}>
          <div className="side-panel" onClick={(e) => e.stopPropagation()}>
            <div className="panel-header">
              <div>
                <h2 className="panel-title">{selectedLead.company_name}</h2>
                <span className="panel-subtitle">{selectedLead.type === 'cliente' ? 'Cliente Actual' : 'Prospecto'} | {selectedLead.city}, {selectedLead.country_code}</span>
              </div>
              <button className="close-btn" onClick={() => setSelectedLead(null)}><X size={20} /></button>
            </div>

            <div className="panel-body">
              <h4 className="section-title">Timeline de Campaña</h4>
              <div className="timeline">
                <div className="timeline-item">
                  <div className="tl-icon sent"><Send size={12}/></div>
                  <div className="tl-content">
                    <strong>Enviado vía Resend</strong>
                    <span>{selectedLead.sent_at ? new Date(selectedLead.sent_at).toLocaleString() : 'Pendiente'}</span>
                  </div>
                </div>
                {selectedLead.opened_at && (
                  <div className="timeline-item">
                    <div className="tl-icon opened"><MailOpen size={12}/></div>
                    <div className="tl-content">
                      <strong>Correo Abierto por el cliente</strong>
                      <span>{new Date(selectedLead.opened_at).toLocaleString()}</span>
                    </div>
                  </div>
                )}
                {selectedLead.replied_at && (
                  <div className="timeline-item">
                    <div className="tl-icon replied"><MessageSquare size={12}/></div>
                    <div className="tl-content">
                      <strong>Marcado como Respondido</strong>
                      <span>{new Date(selectedLead.replied_at).toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>

              <h4 className="section-title" style={{marginTop: '24px'}}>Registrar Respuesta</h4>
              {selectedLead.replied_at ? (
                <div className="reply-locked">
                  <strong>Respuesta registrada:</strong>
                  <p>{selectedLead.reply_notes}</p>
                </div>
              ) : (
                <div className="reply-form">
                  <textarea 
                    placeholder="Pega aquí lo que te respondió el cliente en tu correo personal..."
                    value={replyNotes}
                    onChange={(e) => setReplyNotes(e.target.value)}
                    rows={4}
                  ></textarea>
                  <button onClick={handleSaveReply} disabled={savingReply || !replyNotes.trim()}>
                    {savingReply ? 'Guardando...' : 'Marcar como Respondido'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL CREADOR DE CAMPAÑAS AVANZADO --- */}
      {showBuilder && (
        <div className="panel-overlay" onClick={() => setShowBuilder(false)}>
          <div className="builder-panel" onClick={(e) => e.stopPropagation()}>
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Segmentador de Audiencia B2B</h2>
                <span className="panel-subtitle">Filtra tu base de datos y genera una secuencia en lote</span>
              </div>
              <button className="close-btn" onClick={() => setShowBuilder(false)}><X size={20} /></button>
            </div>

            <div className="panel-body builder-scrollable">
              {!previewSequence ? (
                <div className="builder-form">
                  
                  <div className="audience-toggle-wrapper">
                    <button className={`aud-toggle-btn ${audienceSource === 'leads' ? 'active' : ''}`} onClick={() => setAudienceSource('leads')}>
                      <Target size={16}/> Prospectos ({availableLeads.length})
                    </button>
                    <button className={`aud-toggle-btn ${audienceSource === 'clients' ? 'active' : ''}`} onClick={() => setAudienceSource('clients')}>
                      <Briefcase size={16}/> Clientes ({availableClients.length})
                    </button>
                  </div>

                  <h4 className="section-title"><Filter size={14} style={{display:'inline', marginRight:'4px'}}/> 1. Filtra tu Audiencia</h4>
                  
                  <div className="filters-row">
                    <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)}>
                      <option value="">Todos los Países</option>
                      {uniqueCountries.map(c => <option key={c as string} value={c as string}>{c as string}</option>)}
                    </select>
                    <select value={filterLanguage} onChange={e => setFilterLanguage(e.target.value)}>
                      <option value="">Todos los Idiomas</option>
                      {uniqueLanguages.map(l => <option key={l as string} value={l as string}>{l as string}</option>)}
                    </select>
                  </div>

                  <div className="leads-selector-box">
                    <div className="ls-header">
                      <label style={{display:'flex', alignItems:'center', gap:'8px', margin: 0, cursor: 'pointer'}}>
                        <input type="checkbox" checked={selectedLeadIds.length === filteredAudience.length && filteredAudience.length > 0} onChange={handleSelectAll} />
                        Seleccionar Todos ({filteredAudience.length} encontrados)
                      </label>
                    </div>
                    <div className="ls-body">
                      {filteredAudience.length === 0 ? <div style={{padding:'10px', color:'#94a3b8', fontSize:'12px'}}>No hay registros con estos filtros.</div> : 
                        filteredAudience.map(l => (
                          <label key={l.id} className="lead-check-item">
                            <input type="checkbox" checked={selectedLeadIds.includes(l.id)} onChange={() => toggleLeadSelection(l.id)} />
                            <span><strong>{l.display_name}</strong> - {l.country_code} ({l.preferred_language})</span>
                          </label>
                        ))
                      }
                    </div>
                  </div>

                  <h4 className="section-title" style={{marginTop: '20px'}}>2. Contexto de la Campaña</h4>
                  <textarea 
                    rows={3} 
                    placeholder={audienceSource === 'leads' ? "Ej. Ofrecer Trial Order de 5 pallets para apertura de cuenta." : "Ej. Actualización operativa de temporada para clientes activos."}
                    value={builderContext}
                    onChange={(e) => setBuilderContext(e.target.value)}
                  />

                  <button className="generate-btn" onClick={handleGeneratePreview} disabled={isGenerating || selectedLeadIds.length === 0}>
                    {isGenerating ? <><Loader2 className="animate-spin" size={16}/> Diseñando Secuencia B2B...</> : `Generar Secuencia para ${selectedLeadIds.length} objetivos`}
                  </button>
                </div>
              ) : (
                <div className="preview-container">
                  <div className="preview-alert">
                    Revisa las plantillas. El sistema inyectará el nombre real de cada {audienceSource === 'leads' ? 'empresa' : 'cliente'} en el comodín <strong>{"{{company_name}}"}</strong>.
                  </div>
                  {previewSequence.map((email: any, idx: number) => (
                    <div key={idx} className="email-preview-card">
                      <div className="ep-header">
                        <span className="ep-step">Paso {email.step}: {email.name}</span>
                        <span className="ep-delay"><Clock size={12}/> {email.delay_days === 0 ? 'Se envía Hoy' : `Se envía en ${email.delay_days} días`}</span>
                      </div>
                      <div className="ep-subject"><strong>Asunto:</strong> {email.subject}</div>
                      <div className="ep-body" dangerouslySetInnerHTML={{ __html: email.full_html }}></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {previewSequence && (
               <div className="builder-footer-sticky">
                 <button className="ff-btn-secondary" onClick={() => setPreviewSequence(null)}>Descartar y Rehacer</button>
                 <button className="ff-btn-success" onClick={handleApproveAndEnqueue} disabled={isSavingSequence}>
                   {isSavingSequence ? 'Encolando...' : <><CheckCircle2 size={16}/> Encolar a {selectedLeadIds.length} objetivos</>}
                 </button>
               </div>
            )}
          </div>
        </div>
      )}

      {/* ESTILOS UNIFICADOS */}
      <style>{`
        /* LAYOUT Y GLOBALES */
        .ff-campaigns-wrapper { display: flex; flex-direction: column; gap: 24px; font-family: 'Inter', sans-serif; color: #1e293b; padding-bottom: 40px;}
        .top-bar { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px;}
        
        .ff-tabs { display: flex; gap: 8px; }
        .ff-tab { background: transparent; border: none; padding: 8px 16px; font-size: 14px; font-weight: 600; color: #64748b; cursor: pointer; border-radius: 6px; display: flex; align-items: center; gap: 8px; transition: 0.2s; }
        .ff-tab:hover { background: #f1f5f9; color: #0f172a; }
        .ff-tab.active { background: #224c22; color: white; }
        
        .ff-btn-secondary { background: white; border: 1px solid #cbd5e1; color: #475569; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: 0.2s; }
        .ff-btn-secondary:hover:not(:disabled) { background: #f1f5f9; color: #0f172a; }
        .ff-btn-primary { background: #224c22; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: 0.2s; }
        .ff-btn-primary:hover { background: #1a3c1a; }
        .ff-btn-success { background: #16a34a; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: 0.2s; }
        .ff-btn-success:hover:not(:disabled) { background: #15803d; }
        .ff-btn-success:disabled { opacity: 0.6; cursor: not-allowed; }

        /* LISTA DE CAMPAÑAS */
        .empty-state { background: white; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 60px 20px; display: flex; flex-direction: column; align-items: center; gap: 16px; color: #64748b; font-weight: 500; font-size: 14px; text-align: center; }
        .campaigns-list { display: flex; flex-direction: column; gap: 12px; }
        .campaign-card { background: white; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; transition: box-shadow 0.2s; }
        .campaign-card:hover { box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .campaign-card.expanded { border-color: #cbd5e1; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); }
        
        .camp-header-linear { display: flex; align-items: center; padding: 16px 20px; cursor: pointer; gap: 24px; user-select: none; }
        .camp-header-linear:hover { background: #f8fafc; }
        .camp-info-main { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;}
        .camp-name-text { font-size: 14px; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;}
        
        .badge { padding: 4px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;}
        .badge.active { background: #fef08a; color: #854d0e; } .badge.completed { background: #dcfce3; color: #166534; }
        
        .camp-quick-metrics { display: flex; gap: 16px; align-items: center; font-size: 13px; font-weight: 600; color: #64748b;}
        .qm-item { display: flex; align-items: center; gap: 6px; }
        .text-orange { color: #ea580c; } .text-blue { color: #2563eb; } .text-green { color: #16a34a; } .text-purple { color: #c026d3; } .text-brand { color: #224c22; }
        
        .camp-quick-progress { width: 100px; }
        .progress-bar-bg { background: #e2e8f0; height: 6px; border-radius: 3px; overflow: hidden; }
        .progress-bar-fill { background: #224c22; height: 100%; transition: width 0.5s ease; }
        
        .expand-btn { background: none; border: none; color: #94a3b8; cursor: pointer; display: flex; padding: 4px; border-radius: 4px; }
        .expand-btn:hover { background: #e2e8f0; color: #0f172a; }

        /* TABLA DENTRO DE CAMPAÑA */
        .camp-expanded-content { padding: 0 20px 20px 20px; border-top: 1px solid #f1f5f9; background: #f8fafc; }
        .camp-leads-table { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-top: 20px; }
        .camp-lead-header { display: grid; grid-template-columns: 2fr 1fr 1fr; padding: 10px 16px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 0.5px; }
        .camp-lead-row { display: grid; grid-template-columns: 2fr 1fr 1fr; padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; align-items: center; transition: background 0.15s; }
        .camp-lead-row.hoverable { cursor: pointer; }
        .camp-lead-row.hoverable:hover { background: #f8fafc; }
        .col-name { font-weight: 600; color: #0f172a; }
        .col-date { color: #64748b; font-size: 12px; font-variant-numeric: tabular-nums; }
        
        .status-badge { font-size: 10px; padding: 3px 8px; border-radius: 12px; font-weight: 700; letter-spacing: 0.3px; display: inline-flex; }
        .status-badge.opened { background: #dcfce3; color: #166534; }
        .status-badge.sent { background: #dbeafe; color: #1e40af; }
        .status-badge.queued { background: #f1f5f9; color: #64748b; }
        .status-badge.replied { background: #fdf4ff; color: #a21caf; border: 1px solid #fbcfe8; }
        .status-badge.error { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }

        .pagination-controls { display: flex; justify-content: center; align-items: center; gap: 16px; margin-top: 24px; }
        .page-btn { display: flex; align-items: center; gap: 4px; padding: 8px 12px; background: white; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; font-weight: 600; color: #475569; cursor: pointer; transition: 0.2s;}
        .page-btn:hover:not(:disabled) { background: #f1f5f9; color: #0f172a; }
        .page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .page-info { font-size: 13px; font-weight: 500; color: #64748b; }

        /* MODALES Y PANELES */
        .panel-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.6); z-index: 1000; display: flex; justify-content: flex-end; backdrop-filter: blur(2px);}
        
        .side-panel { background: white; width: 450px; height: 100%; box-shadow: -4px 0 15px rgba(0,0,0,0.1); display: flex; flex-direction: column; animation: slideIn 0.3s ease forwards;}
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        
        .builder-panel { background: white; width: 700px; height: 95vh; margin: auto; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); display: flex; flex-direction: column; animation: scaleIn 0.2s ease; overflow: hidden; }
        @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }

        .panel-header { padding: 20px 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-start; background: #f8fafc;}
        .panel-title { font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0; }
        .panel-subtitle { font-size: 12px; color: #64748b; font-weight: 500; }
        .close-btn { background: transparent; border: none; color: #64748b; cursor: pointer; border-radius: 4px; padding: 4px; transition: 0.2s;}
        .close-btn:hover { background: #e2e8f0; color: #0f172a; }
        
        .panel-body { padding: 24px; overflow-y: auto; flex: 1; }
        .builder-scrollable { padding-bottom: 40px; }

        /* TIMELINE DEL CRM */
        .section-title { font-size: 12px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 16px 0; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;}
        .timeline { display: flex; flex-direction: column; gap: 16px; margin-left: 8px; border-left: 2px solid #e2e8f0; padding-left: 20px; }
        .timeline-item { position: relative; }
        .tl-icon { position: absolute; left: -31px; top: 0; width: 20px; height: 20px; border-radius: 50%; display: flex; justify-content: center; align-items: center; color: white; border: 2px solid white;}
        .tl-icon.sent { background: #3b82f6; } .tl-icon.opened { background: #22c55e; } .tl-icon.replied { background: #d946ef; }
        .tl-content strong { display: block; font-size: 13px; color: #334155; }
        .tl-content span { font-size: 11px; color: #94a3b8; }
        
        .reply-form { display: flex; flex-direction: column; gap: 12px; }
        .reply-form textarea { width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-family: 'Inter', sans-serif; font-size: 13px; resize: vertical; }
        .reply-form textarea:focus { outline: none; border-color: #224c22; box-shadow: 0 0 0 2px rgba(34,76,34,0.1); }
        .reply-form button { background: #224c22; color: white; font-weight: 600; font-size: 13px; padding: 10px; border-radius: 6px; border: none; cursor: pointer; transition: 0.2s;}
        .reply-form button:hover:not(:disabled) { background: #1a3c1a; }
        .reply-locked { background: #fdf4ff; border: 1px solid #fbcfe8; padding: 16px; border-radius: 8px; font-size: 13px; color: #701a75; }

        /* SEGMENTADOR (BUILDER) */
        .audience-toggle-wrapper { display: flex; background: #f1f5f9; padding: 4px; border-radius: 8px; margin-bottom: 24px; }
        .aud-toggle-btn { flex: 1; display: flex; justify-content: center; align-items: center; gap: 8px; padding: 10px; border: none; background: transparent; color: #64748b; font-size: 13px; font-weight: 700; border-radius: 6px; cursor: pointer; transition: 0.2s;}
        .aud-toggle-btn:hover { color: #0f172a; }
        .aud-toggle-btn.active { background: white; color: #0f172a; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        
        .builder-form { display: flex; flex-direction: column; gap: 8px; }
        .builder-form textarea { width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-family: 'Inter', sans-serif; font-size: 13px; resize: vertical; }
        
        .filters-row { display: flex; gap: 12px; margin-bottom: 20px; }
        .filters-row select { flex: 1; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; color: #0f172a; background: white;}
        
        .leads-selector-box { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: white; }
        .ls-header { background: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 700; color: #0f172a;}
        .ls-body { max-height: 250px; overflow-y: auto; }
        .lead-check-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #334155; cursor: pointer; transition: 0.15s; margin: 0;}
        .lead-check-item:hover { background: #f8fafc; }
        .lead-check-item:last-child { border-bottom: none; }
        
        .generate-btn { margin-top: 24px; background: #0f172a; color: white; padding: 14px; border-radius: 8px; border: none; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 8px; transition: 0.2s; }
        .generate-btn:hover:not(:disabled) { background: #1e293b; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .generate-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        
        /* RESULTADOS DE SECUENCIA */
        .preview-container { display: flex; flex-direction: column; gap: 16px; }
        .preview-alert { background: #eff6ff; color: #1e3a8a; padding: 14px; border-radius: 8px; font-size: 13px; font-weight: 500; border: 1px solid #bfdbfe; }
        .email-preview-card { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.05);}
        .ep-header { background: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
        .ep-step { font-weight: 800; font-size: 13px; color: #0f172a; }
        .ep-delay { font-size: 12px; font-weight: 700; color: #ea580c; display: flex; align-items: center; gap: 4px; background: #ffedd5; padding: 4px 10px; border-radius: 12px;}
        .ep-subject { padding: 14px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #0f172a; background: white;}
        .ep-body { padding: 16px; background: white; font-size: 13px; max-height: 250px; overflow-y: auto; color: #334155; line-height: 1.6; }
        
        /* STICKY FOOTER */
        .builder-footer-sticky { position: sticky; bottom: 0; background: white; border-top: 1px solid #e2e8f0; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; z-index: 10;}
      `}</style>
    </AdminLayout>
  );
}