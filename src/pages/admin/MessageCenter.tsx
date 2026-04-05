import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { requireAdminOrRedirect } from '@/lib/requireAdmin';
import { AdminLayout } from '@/components/AdminLayout';
import { useNavigate } from 'react-router-dom';
import { 
  Loader2, RefreshCw, Mail, Archive, Reply, 
  FileText, Package, CheckCircle2 
} from 'lucide-react';

interface Email {
  id: string;
  created_at: string;
  from_email: string;
  subject: string;
  body_text: string;
  target_alias: string;
  status: 'pending' | 'resolved'; 
}

export default function MessageCenter() {
  const [authReady, setAuthReady] = useState(false);
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('todos');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  
  const navigate = useNavigate();

  const tabs = [
    { id: 'todos', label: 'Bandeja' },
    { id: 'ventas', label: 'Ventas' },
    { id: 'operaciones', label: 'Operaciones' },
    { id: 'soporte', label: 'Soporte' }
  ];

  const fetchEmails = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('inbound_emails')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      const mappedData = data.map(e => ({ ...e, status: e.status || 'pending' }));
      setEmails(mappedData);
    }
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (r.ok) {
        setAuthReady(true);
        fetchEmails();

        const channel = supabase
          .channel('public:inbound_emails')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inbound_emails' }, (payload) => {
            const newEmail = { ...payload.new, status: payload.new.status || 'pending' } as Email;
            setEmails((current) => [newEmail, ...current]);
          })
          .subscribe();

        return () => supabase.removeChannel(channel);
      }
    })();
  }, []);

  const handleResolve = async (id: string) => {
    setEmails(current => current.filter(e => e.id !== id));
    setSelectedEmail(null);
  };

  const filteredEmails = emails.filter(email => {
    if (email.status === 'resolved') return false;
    if (activeTab === 'todos') return true;
    return email.target_alias.toLowerCase().includes(activeTab);
  });

  const renderContextualActions = (email: Email) => {
    const alias = email.target_alias.toLowerCase();
    
    if (alias.includes('ventas')) {
      return (
        <button onClick={() => navigate('/admin/quotes')} className="btn-contextual">
          <FileText size={16} /> Cotizar Solicitud
        </button>
      );
    }
    if (alias.includes('operaciones')) {
      return (
        <button onClick={() => navigate('/admin/shipments')} className="btn-contextual">
          <Package size={16} /> Vincular a Embarque
        </button>
      );
    }
    return null;
  };

  if (!authReady) return <div className="loader-full"><Loader2 className="animate-spin" size={40}/></div>;

  return (
    <AdminLayout title="Command Center">
      <div className="inbox-container">
        
        {/* HEADER */}
        <div className="inbox-header">
          <div>
            <h1 className="inbox-title">Command Center</h1>
            <p className="inbox-subtitle">Soluciona rápido. Mantén la bandeja en cero.</p>
          </div>
          <button onClick={fetchEmails} className="btn-outline" disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> 
            {loading ? 'Sincronizando...' : 'Actualizar'}
          </button>
        </div>

        {/* LAYOUT PRINCIPAL (SPLIT PANE) */}
        <div className="inbox-layout">
          
          {/* PANEL IZQUIERDO: LISTA */}
          <aside className="inbox-sidebar">
            {/* TABS */}
            <div className="inbox-tabs">
              {tabs.map((tab) => {
                const count = activeTab === 'todos' && tab.id === 'todos' ? filteredEmails.length : null;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id); setSelectedEmail(null); }}
                    className={`inbox-tab ${isActive ? 'active' : ''}`}
                  >
                    {tab.label}
                    {count !== null && <span className="tab-badge">{count}</span>}
                  </button>
                );
              })}
            </div>

            {/* LISTA DE CORREOS */}
            <div className="inbox-list">
              {loading ? (
                <div className="empty-state"><Loader2 className="animate-spin spin-icon" size={24} /></div>
              ) : filteredEmails.length === 0 ? (
                <div className="empty-state">
                  <CheckCircle2 size={36} className="success-icon" />
                  <h4>Todo al día</h4>
                  <p>No hay tareas pendientes en esta bandeja.</p>
                </div>
              ) : (
                <div className="list-wrapper">
                  {filteredEmails.map((email) => {
                    const isSelected = selectedEmail?.id === email.id;
                    return (
                      <div 
                        key={email.id} 
                        onClick={() => setSelectedEmail(email)}
                        className={`inbox-item ${isSelected ? 'selected' : ''}`}
                      >
                        <div className="item-header">
                          <span className="item-sender">{email.from_email.split('<')[0] || email.from_email.split('@')[0]}</span>
                          <span className="item-date">{new Date(email.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                        </div>
                        <div className="item-subject">{email.subject}</div>
                        <div className="item-preview">{email.body_text}</div>
                        <div className="item-footer">
                          <span className="alias-pill">{email.target_alias.split('@')[0]}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          {/* PANEL DERECHO: VISTA DE LECTURA */}
          <main className="inbox-viewer">
            {selectedEmail ? (
              <div className="viewer-inner">
                {/* TOOLBAR */}
                <div className="viewer-toolbar">
                  <button onClick={() => handleResolve(selectedEmail.id)} className="btn-ghost" title="Marcar como Resuelto">
                    <Archive size={16} /> Resolver
                  </button>
                  <div className="toolbar-actions">
                    {renderContextualActions(selectedEmail)}
                    <a href={`mailto:${selectedEmail.from_email}?subject=Re: ${selectedEmail.subject}`} className="btn-outline">
                      <Reply size={16} /> Responder
                    </a>
                  </div>
                </div>

                {/* CONTENIDO DEL CORREO */}
                <div className="viewer-body">
                  <div className="viewer-content-wrapper">
                    <h2 className="mail-subject">{selectedEmail.subject}</h2>
                    
                    <div className="mail-meta">
                      <div className="meta-avatar">
                        {selectedEmail.from_email.charAt(0).toUpperCase()}
                      </div>
                      <div className="meta-details">
                        <div className="meta-sender">{selectedEmail.from_email}</div>
                        <div className="meta-to">Enviado a: <strong>{selectedEmail.target_alias}</strong></div>
                      </div>
                      <div className="meta-date">
                        {new Date(selectedEmail.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </div>
                    </div>

                    <div className="mail-body">
                      <pre>{selectedEmail.body_text}</pre>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state viewer-empty">
                <div className="icon-circle"><Mail size={24} /></div>
                <h3>Ningún mensaje seleccionado</h3>
                <p>Haz clic en un correo de la lista izquierda para leerlo y acceder a las herramientas de gestión.</p>
              </div>
            )}
          </main>

        </div>
      </div>

      <style>{`
        /* --- ESTRUCTURA BASE --- */
        .inbox-container { max-width: 1400px; margin: 0 auto; padding: 20px; font-family: 'Inter', sans-serif; color: #0f172a; height: calc(100vh - 80px); display: flex; flex-direction: column; }
        .loader-full { height: 100vh; display: flex; align-items: center; justify-content: center; color: #047857; }
        
        /* --- HEADER --- */
        .inbox-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; }
        .inbox-title { font-size: 24px; font-weight: 800; color: #1e293b; margin: 0; letter-spacing: -0.5px; }
        .inbox-subtitle { font-size: 13px; color: #64748b; margin: 4px 0 0 0; }

        /* --- BOTONES BASE --- */
        .btn-outline { background: white; border: 1px solid #cbd5e1; color: #334155; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: 0.2s; text-decoration: none; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
        .btn-outline:hover:not(:disabled) { background: #f8fafc; border-color: #94a3b8; }
        .btn-outline:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-ghost { background: transparent; border: none; color: #64748b; padding: 8px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: 0.2s; }
        .btn-ghost:hover { background: #f1f5f9; color: #0f172a; }
        
        /* BOTÓN CONTEXTUAL (Cotizar/Embarque) - ESTILO PRO */
        .btn-contextual { background: #047857; border: 1px solid #047857; color: white; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: 0.2s; box-shadow: 0 1px 3px rgba(4,120,87,0.2); }
        .btn-contextual:hover { background: #065f46; border-color: #065f46; }

        /* --- LAYOUT SPLIT PANE --- */
        .inbox-layout { display: grid; grid-template-columns: 340px 1fr; flex: 1; background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); min-height: 500px; }
        
        /* --- PANEL IZQUIERDO --- */
        .inbox-sidebar { display: flex; flex-direction: column; border-right: 1px solid #e2e8f0; background: #f8fafc; overflow: hidden; }
        
        /* TABS */
        .inbox-tabs { display: flex; overflow-x: auto; background: white; border-bottom: 1px solid #e2e8f0; }
        .inbox-tab { padding: 12px 16px; font-size: 13px; font-weight: 600; color: #64748b; border: none; background: transparent; border-bottom: 2px solid transparent; cursor: pointer; white-space: nowrap; transition: 0.2s; display: flex; align-items: center; gap: 6px; margin-bottom: -1px; }
        .inbox-tab:hover { color: #0f172a; }
        .inbox-tab.active { color: #047857; border-bottom-color: #047857; }
        .tab-badge { background: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 10px; font-size: 10px; font-weight: 700; }

        /* LISTA */
        .inbox-list { flex: 1; overflow-y: auto; background: white; }
        .list-wrapper { display: flex; flex-direction: column; }
        .inbox-item { padding: 16px; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: 0.2s; border-left: 3px solid transparent; }
        .inbox-item:hover { background: #f8fafc; }
        .inbox-item.selected { background: #ecfdf5; border-left-color: #10b981; }
        
        .item-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
        .item-sender { font-size: 13px; font-weight: 600; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 8px; }
        .inbox-item.selected .item-sender { color: #064e3b; font-weight: 700; }
        .item-date { font-size: 11px; font-weight: 500; color: #94a3b8; white-space: nowrap; }
        .item-subject { font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .item-preview { font-size: 12px; color: #64748b; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        
        .item-footer { margin-top: 8px; }
        .alias-pill { display: inline-block; padding: 2px 6px; background: white; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }

        /* --- PANEL DERECHO (VISOR) --- */
        .inbox-viewer { display: flex; flex-direction: column; background: white; overflow: hidden; }
        .viewer-inner { display: flex; flex-direction: column; height: 100%; }
        
        .viewer-toolbar { display: flex; justify-content: space-between; align-items: center; padding: 12px 24px; border-bottom: 1px solid #e2e8f0; background: rgba(255,255,255,0.9); }
        .toolbar-actions { display: flex; align-items: center; gap: 12px; }
        
        .viewer-body { flex: 1; overflow-y: auto; padding: 32px 40px; background: #fafafa; }
        .viewer-content-wrapper { max-width: 800px; margin: 0 auto; }
        
        .mail-subject { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 24px 0; line-height: 1.3; }
        
        .mail-meta { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid #e2e8f0; }
        .meta-avatar { width: 40px; height: 40px; border-radius: 50%; background: #d1fae5; color: #047857; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; border: 1px solid #a7f3d0; }
        .meta-details { flex: 1; }
        .meta-sender { font-size: 14px; font-weight: 600; color: #0f172a; }
        .meta-to { font-size: 12px; color: #64748b; margin-top: 2px; }
        .meta-to strong { color: #334155; font-weight: 600; }
        .meta-date { font-size: 12px; font-weight: 500; color: #94a3b8; text-align: right; }
        
        .mail-body { background: white; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
        .mail-body pre { margin: 0; font-family: 'Inter', sans-serif; font-size: 14px; color: #334155; line-height: 1.6; white-space: pre-wrap; word-wrap: break-word; }

        /* --- EMPTY STATES --- */
        .empty-state { padding: 40px 20px; display: flex; flex-direction: column; align-items: center; text-align: center; justify-content: center; height: 100%; }
        .empty-state.viewer-empty { background: #fafafa; }
        .spin-icon { color: #94a3b8; }
        .success-icon { color: #34d399; margin-bottom: 12px; }
        .icon-circle { width: 56px; height: 56px; background: white; border: 1px solid #e2e8f0; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #cbd5e1; margin-bottom: 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
        .empty-state h3 { font-size: 16px; font-weight: 700; color: #1e293b; margin: 0 0 8px 0; }
        .empty-state h4 { font-size: 14px; font-weight: 600; color: #334155; margin: 0 0 4px 0; }
        .empty-state p { font-size: 13px; color: #64748b; margin: 0; max-width: 300px; line-height: 1.5; }
      `}</style>
    </AdminLayout>
  );
}