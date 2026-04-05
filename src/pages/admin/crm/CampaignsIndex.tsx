import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { AdminLayout } from '@/components/AdminLayout';
import { BarChart3, MailOpen, Send, Clock, Play, RefreshCw, CheckCircle2, X, MessageSquare, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Users, ArchiveRestore } from 'lucide-react';

export default function CampaignsIndex() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Pestañas (Tabs)
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  // Paginación y Acordeón
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedCamp, setExpandedCamp] = useState<string | null>(null);
  const itemsPerPage = 5;
  
  // Estados para el Panel Lateral (CRM Timeline)
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [replyNotes, setReplyNotes] = useState('');
  const [savingReply, setSavingReply] = useState(false);

  const fetchCampaigns = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('leads_prospecting')
        .select('*')
        .not('active_campaign', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const grouped = data.reduce((acc: any, lead: any) => {
          const camp = lead.active_campaign;
          if (!acc[camp]) {
            acc[camp] = { name: camp, total: 0, queued: 0, sent: 0, opened: 0, replied: 0, leads: [] };
          }
          acc[camp].total += 1;
          acc[camp].leads.push(lead);
          
          if (lead.pipeline_stage === 'queued') acc[camp].queued += 1;
          if (lead.sent_at) acc[camp].sent += 1;
          if (lead.opened_at) acc[camp].opened += 1;
          if (lead.replied_at || lead.pipeline_stage === 'replied') acc[camp].replied += 1;
          
          return acc;
        }, {});

        setCampaigns(Object.values(grouped));
      }
    } catch (error) {
      console.error("Error cargando campañas:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleSaveReply = async () => {
    if (!selectedLead) return;
    setSavingReply(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from('leads_prospecting').update({
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

  // Lógica de Filtrado por Pestañas
  const activeCampaigns = campaigns.filter(c => c.queued > 0);
  const historyCampaigns = campaigns.filter(c => c.queued === 0);
  const displayedCampaigns = activeTab === 'active' ? activeCampaigns : historyCampaigns;

  // Lógica de Paginación adaptada a la pestaña actual
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = displayedCampaigns.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(displayedCampaigns.length / itemsPerPage) || 1;

  const toggleExpand = (campName: string) => {
    setExpandedCamp(expandedCamp === campName ? null : campName);
  };

  // Cambiar pestaña resetea la página a 1
  const handleTabChange = (tab: 'active' | 'history') => {
    setActiveTab(tab);
    setCurrentPage(1);
    setExpandedCamp(null);
  };

  return (
    <AdminLayout title="Performance de Campañas" subtitle="Rastreo de Aperturas y Goteo de Correos">
      <div className="ff-campaigns-wrapper">
        
        <div className="top-bar">
          <div className="ff-tabs">
            <button className={`ff-tab ${activeTab === 'active' ? 'active' : ''}`} onClick={() => handleTabChange('active')}>
              <Play size={16}/> En Curso ({activeCampaigns.length})
            </button>
            <button className={`ff-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => handleTabChange('history')}>
              <ArchiveRestore size={16}/> Historial ({historyCampaigns.length})
            </button>
          </div>

          <button className="ff-btn-secondary" onClick={fetchCampaigns} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> 
            {refreshing ? 'Actualizando...' : 'Actualizar'}
          </button>
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
                            <div className="col-name">{l.company_name}</div>
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
                               l.pipeline_stage?.includes('error') || l.pipeline_stage?.includes('skipped') ? 'Cancelado por sistema' : 'Pendiente'}
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
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                  disabled={currentPage === 1}
                  className="page-btn"
                >
                  <ChevronLeft size={16} /> Anterior
                </button>
                <span className="page-info">Página {currentPage} de {totalPages}</span>
                <button 
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                  disabled={currentPage === totalPages}
                  className="page-btn"
                >
                  Siguiente <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* PANEL LATERAL: CRM TIMELINE (Se mantiene exactamente igual) */}
      {selectedLead && (
        <div className="panel-overlay" onClick={() => setSelectedLead(null)}>
          <div className="side-panel" onClick={(e) => e.stopPropagation()}>
            <div className="panel-header">
              <div>
                <h2 className="panel-title">{selectedLead.company_name}</h2>
                <span className="panel-subtitle">{selectedLead.contact_email || 'Sin correo visible'} | {selectedLead.city}, {selectedLead.country_code}</span>
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

              <h4 className="section-title" style={{marginTop: '24px'}}>Correo Enviado (IA)</h4>
              <div className="email-preview-box">
                {selectedLead.email_draft || 'Sin borrador generado aún.'}
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

      <style>{`
        .ff-campaigns-wrapper { display: flex; flex-direction: column; gap: 24px; font-family: 'Inter', sans-serif; color: #1e293b; padding-bottom: 40px;}
        
        .top-bar { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px;}
        .ff-tabs { display: flex; gap: 8px; }
        .ff-tab { background: transparent; border: none; padding: 8px 16px; font-size: 14px; font-weight: 600; color: #64748b; cursor: pointer; border-radius: 6px; display: flex; align-items: center; gap: 8px; transition: 0.2s; }
        .ff-tab:hover { background: #f1f5f9; color: #0f172a; }
        .ff-tab.active { background: #224c22; color: white; }
        
        .ff-btn-secondary { background: white; border: 1px solid #cbd5e1; color: #475569; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: 0.2s; }
        .ff-btn-secondary:hover:not(:disabled) { background: #f1f5f9; color: #0f172a; }
        
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

        .camp-expanded-content { padding: 0 20px 20px 20px; border-top: 1px solid #f1f5f9; background: #f8fafc; }
        
        .camp-leads-table { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-top: 20px; }
        .camp-lead-header { display: grid; grid-template-columns: 2fr 1fr 1fr; padding: 10px 16px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 0.5px; }
        .camp-lead-row { display: grid; grid-template-columns: 2fr 1fr 1fr; padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; align-items: center; transition: background 0.15s; }
        .camp-lead-row.hoverable { cursor: pointer; }
        .camp-lead-row.hoverable:hover { background: #f8fafc; }
        .camp-lead-row:last-child { border-bottom: none; }
        .col-name { font-weight: 600; color: #0f172a; }
        .status-badge { font-size: 10px; padding: 3px 8px; border-radius: 12px; font-weight: 700; letter-spacing: 0.3px; display: inline-flex; }
        .status-badge.opened { background: #dcfce3; color: #166534; }
        .status-badge.sent { background: #dbeafe; color: #1e40af; }
        .status-badge.queued { background: #f1f5f9; color: #64748b; }
        .status-badge.replied { background: #fdf4ff; color: #a21caf; border: 1px solid #fbcfe8; }
        .status-badge.error { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
        .col-date { color: #64748b; font-size: 12px; font-variant-numeric: tabular-nums; }

        .pagination-controls { display: flex; justify-content: center; align-items: center; gap: 16px; margin-top: 24px; }
        .page-btn { display: flex; align-items: center; gap: 4px; padding: 8px 12px; background: white; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; font-weight: 600; color: #475569; cursor: pointer; transition: 0.2s;}
        .page-btn:hover:not(:disabled) { background: #f1f5f9; color: #0f172a; }
        .page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .page-info { font-size: 13px; font-weight: 500; color: #64748b; }

        /* MODAL LATERAL */
        .panel-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.4); z-index: 1000; display: flex; justify-content: flex-end; backdrop-filter: blur(2px);}
        .side-panel { background: white; width: 450px; height: 100%; box-shadow: -4px 0 15px rgba(0,0,0,0.1); display: flex; flex-direction: column; animation: slideIn 0.3s ease forwards;}
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .panel-header { padding: 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-start; background: #f8fafc;}
        .panel-title { font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0; }
        .panel-subtitle { font-size: 12px; color: #64748b; font-weight: 500; }
        .close-btn { background: transparent; border: none; color: #64748b; cursor: pointer; border-radius: 4px; padding: 4px; transition: 0.2s;}
        .close-btn:hover { background: #e2e8f0; color: #0f172a; }
        .panel-body { padding: 24px; overflow-y: auto; flex: 1; }
        .section-title { font-size: 12px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 16px 0; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;}
        .timeline { display: flex; flex-direction: column; gap: 16px; margin-left: 8px; border-left: 2px solid #e2e8f0; padding-left: 20px; }
        .timeline-item { position: relative; }
        .tl-icon { position: absolute; left: -31px; top: 0; width: 20px; height: 20px; border-radius: 50%; display: flex; justify-content: center; align-items: center; color: white; border: 2px solid white;}
        .tl-icon.sent { background: #3b82f6; } .tl-icon.opened { background: #22c55e; } .tl-icon.replied { background: #d946ef; }
        .tl-content strong { display: block; font-size: 13px; color: #334155; }
        .tl-content span { font-size: 11px; color: #94a3b8; }
        .email-preview-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; font-size: 13px; color: #334155; white-space: pre-wrap; line-height: 1.6; max-height: 250px; overflow-y: auto;}
        .reply-form { display: flex; flex-direction: column; gap: 12px; }
        .reply-form textarea { width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-family: 'Inter', sans-serif; font-size: 13px; resize: vertical; }
        .reply-form textarea:focus { outline: none; border-color: #224c22; box-shadow: 0 0 0 2px rgba(34,76,34,0.1); }
        .reply-form button { background: #224c22; color: white; font-weight: 600; font-size: 13px; padding: 10px; border-radius: 6px; border: none; cursor: pointer; transition: 0.2s;}
        .reply-form button:hover:not(:disabled) { background: #1a3c1a; }
        .reply-form button:disabled { opacity: 0.5; cursor: not-allowed; }
        .reply-locked { background: #fdf4ff; border: 1px solid #fbcfe8; padding: 16px; border-radius: 8px; font-size: 13px; color: #701a75; }
        .reply-locked strong { display: block; margin-bottom: 4px; color: #a21caf;}
      `}</style>
    </AdminLayout>
  );
}