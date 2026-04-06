import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, Plane, TrendingUp, AlertCircle, 
  UserPlus, Ship, Clock, ChevronRight, MessageSquare, Mail, CheckCircle2, ArrowRight
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { AdminLayout } from "@/components/AdminLayout";
import { useNavigate } from 'react-router-dom';

// Importación de Modales
import { QuickQuoteModal } from '@/components/quotes/QuickQuoteModal';
import { NewClientModal } from '@/components/clients/NewClientModal';

// --- HELPERS DE UI ---
const getStatusConfig = (status: string, type: 'shipment' | 'quote') => {
  const s = status?.toLowerCase() || '';
  if (type === 'shipment') {
    switch(s) {
      case 'created': return { label: 'CREADO', class: 'bg-slate-100 text-slate-600' };
      case 'packed': return { label: 'EMPACADO', class: 'bg-amber-100 text-amber-700' };
      case 'in_transit': return { label: 'EN TRÁNSITO', class: 'bg-blue-100 text-blue-700' };
      case 'at_destination': return { label: 'EN DESTINO', class: 'bg-purple-100 text-purple-700' };
      case 'delivered': return { label: 'ENTREGADO', class: 'bg-emerald-100 text-emerald-700' };
      default: return { label: s.toUpperCase(), class: 'bg-gray-100 text-gray-600' };
    }
  } else {
    switch(s) {
      case 'draft': return { label: 'BORRADOR', class: 'bg-slate-100 text-slate-600' };
      case 'solicitud': return { label: 'NUEVA SOLICITUD', class: 'bg-orange-100 text-orange-700 border border-orange-200' };
      case 'sent': return { label: 'ENVIADA', class: 'bg-sky-100 text-sky-700' };
      case 'approved': return { label: 'APROBADA', class: 'bg-emerald-100 text-emerald-700' };
      case 'rejected': return { label: 'RECHAZADA', class: 'bg-rose-100 text-rose-700' };
      default: return { label: s.toUpperCase(), class: 'bg-gray-100 text-gray-600' };
    }
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

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  
  const [data, setData] = useState({
    stats: { 
      shipments: 0, 
      pipelineTotal: 0, 
      newRequests: 0, 
      unreadQuoteMsgs: 0,
      unreadGlobal: 0 
    },
    recentQuotes: [] as any[],
    recentShipments: [] as any[],
    unifiedInbox: [] as any[]
  });

  const fetchDashboardData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      // 1. Fetch de métricas base
      const [shipmentsCount, pipelineData, newReqs, unreadMsg, inboundEmails] = await Promise.all([
        supabase.from('shipments').select('id', { count: 'exact', head: true }).not('status', 'in', '("delivered", "cancelled")'),
        supabase.from('quotes').select('total, status').in('status', ['sent', 'approved', 'rejected']),
        supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('status', 'Solicitud'),
        // Chats de clientes
        supabase.from('quote_activity').select(`
            id, message, created_at, quote_id,
            quotes ( quote_number, clients (name) )
          `).eq('is_read', false).eq('sender_role', 'client').order('created_at', { ascending: false }).limit(5),
        // Correos del Command Center
        supabase.from('inbound_emails').select('*').order('created_at', { ascending: false }).limit(5)
      ]);

      const stats = { total: 0 };
      pipelineData.data?.forEach(q => { if (q.status === 'sent') stats.total += (Number(q.total) || 0); });

      const [quotes, ships] = await Promise.all([
        supabase.from('quotes').select('*, clients(name)').order('created_at', { ascending: false }).limit(5),
        supabase.from('shipments').select('*, clients(name), mode').order('created_at', { ascending: false }).limit(5)
      ]);

      // 2. Construcción del Unified Inbox (Blindado contra nulos y arrays)
      const emails = (inboundEmails.data || []).map(e => {
        let origin = (e.target_alias || '').split('@')[0].toUpperCase();
        if (origin.includes('ADMIN')) origin = 'ADMIN'; 
        
        return {
          id: e.id,
          type: 'email',
          origin: origin || 'SISTEMA',
          title: (e.from_email || '').split('<')[0].trim() || (e.from_email || '').split('@')[0] || 'Desconocido',
          message: e.subject || 'Sin Asunto',
          snippet: (e.body_text || '').substring(0, 80) + '...',
          time: e.created_at,
          link: '/admin/messages'
        };
      });

      const messages = (unreadMsg.data || []).map(m => {
        // BLINDAJE: Extracción segura de datos relacionales de Supabase
        const quoteObj = Array.isArray(m.quotes) ? m.quotes[0] : m.quotes;
        const clientObj = Array.isArray(quoteObj?.clients) ? quoteObj?.clients[0] : quoteObj?.clients;

        return {
          id: m.id,
          type: 'chat',
          origin: 'CLIENTE',
          title: clientObj?.name || 'Cliente',
          message: `Ref: ${quoteObj?.quote_number || 'N/A'}`,
          snippet: (m.message || '').substring(0, 80) + '...',
          time: m.created_at,
          link: `/admin/quotes/${m.quote_id}`
        };
      });

      const combinedInbox = [...emails, ...messages].sort((a, b) => 
        new Date(b.time).getTime() - new Date(a.time).getTime()
      ).slice(0, 6); // Mostrar solo los 6 más recientes

      setData({
        stats: {
          shipments: shipmentsCount.count || 0,
          pipelineTotal: stats.total,
          newRequests: newReqs.count || 0,
          unreadQuoteMsgs: unreadMsg.data?.length || 0,
          unreadGlobal: inboundEmails.data?.length || 0
        },
        recentQuotes: quotes.data || [],
        recentShipments: ships.data || [],
        unifiedInbox: combinedInbox
      });
    } catch (error) {
      console.error("Dashboard Error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    fetchDashboardData(); 
    // Suscripción dual para el Inbox
    const channel = supabase.channel('db-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'quote_activity' }, () => fetchDashboardData(true))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inbound_emails' }, () => fetchDashboardData(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchDashboardData]);

  const formatCurrency = (val: number | null) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val || 0);
  };

  if (loading) return (
    <AdminLayout title="Dashboard">
      <div className="ff-loading-full">
        <div className="ff-loader-ring"></div>
        <p className="ff-sync-text">Sincronizando Operaciones...</p>
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout title="Overview" subtitle="Monitor de Operaciones Globales">
      <div className="ff-dashboard-v2">
        
        {/* ACCIONES Y ALERTAS */}
        <div className="ff-top-bar">
          <div className="ff-creation-actions">
            <button className="btn-create main" onClick={() => setShowQuoteModal(true)}>
              <FileText size={14} /> Nueva Cotización
            </button>
            <button className="btn-create" onClick={() => setShowClientModal(true)}>
              <UserPlus size={14} /> Nuevo Cliente
            </button>
          </div>

          <div className="ff-alert-hubs">
            <div className={`alert-pill ${data.stats.newRequests > 0 ? 'pulse-orange' : ''}`} onClick={() => navigate('/admin/quotes')}>
              {data.stats.newRequests > 0 && <span className="dot-pulse orange" />}
              <AlertCircle size={14} />
              <span>{data.stats.newRequests} Solicitudes</span>
            </div>
            {data.stats.unreadQuoteMsgs > 0 && (
              <div className="alert-pill pulse-green" onClick={() => navigate('/admin/quotes')}>
                <span className="dot-pulse green" />
                <MessageSquare size={14} />
                <span>{data.stats.unreadQuoteMsgs} Mensajes</span>
              </div>
            )}
            <div className={`alert-pill ${data.stats.unreadGlobal > 0 ? 'pulse-emerald' : ''}`} onClick={() => navigate('/admin/messages')}>
              {data.stats.unreadGlobal > 0 && <span className="dot-pulse emerald" />}
              <Mail size={14} />
              <span>Inbox Global</span>
            </div>
          </div>
        </div>

        {/* HERO: MÉTRICAS QUIRÚRGICAS (Solo 2 para dar aire al inbox) */}
        <div className="ff-hero-metrics-split">
          <div className="metric-card highlight">
            <span className="m-label"><TrendingUp size={12}/> Total Cotizado (Pendiente)</span>
            <span className="m-value">{formatCurrency(data.stats.pipelineTotal)}</span>
          </div>
          <div className="metric-card neutral">
            <span className="m-label"><Ship size={12}/> En Tránsito</span>
            <span className="m-value-small">{data.stats.shipments} Embarques</span>
          </div>
        </div>

        {/* UNIFIED INBOX VERTICAL (High Density SaaS) */}
        <section className="ff-panel inbox-panel">
          <div className="section-header">
            <h3><Mail size={14}/> Inbox Operativo</h3>
            <button onClick={() => navigate('/admin/messages')}>Ir al Command Center</button>
          </div>
          <div className="ff-unified-list">
            {data.unifiedInbox.length > 0 ? data.unifiedInbox.map((item) => (
              <div key={`${item.type}-${item.id}`} className="unified-row" onClick={() => navigate(item.link)}>
                <div className={`row-badge badge-${item.origin.toLowerCase()}`}>
                  {item.origin}
                </div>
                <div className="row-core">
                  <span className="row-sender">{item.title}</span>
                  <span className="row-divider">•</span>
                  <span className="row-subject">{item.message}</span>
                  <span className="row-snippet">- {item.snippet}</span>
                </div>
                <div className="row-meta">
                  <span className="row-time">{new Date(item.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  <div className="row-action">Abrir <ArrowRight size={12}/></div>
                </div>
              </div>
            )) : (
              <div className="ff-empty-state">Bandeja al día. No hay mensajes pendientes.</div>
            )}
          </div>
        </section>

        {/* TABLAS OPERATIVAS INTACTAS */}
        <div className="ff-main-grid">
          <section className="ff-panel">
            <div className="section-header">
              <h3><Ship size={14}/> Tránsitos Recientes</h3>
              <button onClick={() => navigate('/admin/shipments')}>Ver todos</button>
            </div>
            <div className="ff-table-list">
              {data.recentShipments.length > 0 ? data.recentShipments.map(s => {
                const statusConfig = getStatusConfig(s.status, 'shipment');
                return (
                  <div key={s.id} className="ff-list-row ship" onClick={() => navigate(`/admin/shipments/${s.id}`)}>
                    <div className="col-code">
                      <TransportIcon mode={s.mode || 'SEA'} />
                      <span className="code-text">{s.code}</span>
                    </div>
                    <div className="col-client">{s.clients?.name}</div>
                    <div className="col-status">
                      <span className={`status-badge ${statusConfig.class}`}>{statusConfig.label}</span>
                    </div>
                    <ChevronRight size={14} className="row-arrow" />
                  </div>
                );
              }) : (
                <div className="ff-empty-state">No hay embarques recientes</div>
              )}
            </div>
          </section>

          <section className="ff-panel">
            <div className="section-header">
              <h3><Clock size={14}/> Actividad Comercial</h3>
              <button onClick={() => navigate('/admin/quotes')}>Ver todas</button>
            </div>
            <div className="ff-table-list">
              {data.recentQuotes.length > 0 ? data.recentQuotes.map(q => {
                const statusConfig = getStatusConfig(q.status, 'quote');
                return (
                  <div key={q.id} className={`ff-list-row quote ${q.status === 'Solicitud' ? 'urgent' : ''}`} onClick={() => navigate(`/admin/quotes/${q.id}`)}>
                    <div className="col-code">
                      <div className="row-icon-box"><FileText size={14} className="row-icon" /></div>
                      <span className="code-text">{q.quote_number || 'BR-000'}</span>
                    </div>
                    <div className="col-client">{q.clients?.name}</div>
                    <div className="col-amount">{formatCurrency(q.total)}</div>
                    <div className="col-status">
                      <span className={`status-badge ${statusConfig.class}`}>{statusConfig.label}</span>
                    </div>
                    <ChevronRight size={14} className="row-arrow" />
                  </div>
                );
              }) : (
                <div className="ff-empty-state">No hay cotizaciones recientes</div>
              )}
            </div>
          </section>
        </div>

        {showClientModal && <NewClientModal isOpen={true} onClose={() => setShowClientModal(false)} onSuccess={() => fetchDashboardData(true)} />}
        {showQuoteModal && <QuickQuoteModal isOpen={showQuoteModal} onClose={() => setShowQuoteModal(false)} />}
        
        {/* CSS ORIGINAL EXTENDIDO */}
        <style>{`
          .ff-dashboard-v2 { display: flex; flex-direction: column; gap: 24px; padding-bottom: 40px; font-family: 'Poppins', sans-serif !important; }
          
          /* TOP BAR & ACTIONS */
          .ff-top-bar { display: flex; justify-content: space-between; align-items: center; }
          .ff-creation-actions { display: flex; gap: 10px; }
          
          .btn-create { display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 10px; font-size: 12px; font-weight: 700; border: 1.5px solid var(--ff-green-dark); background: transparent; color: var(--ff-green-dark); cursor: pointer; transition: all 0.2s ease; }
          .btn-create.main { background: var(--ff-orange); color: white; border: none; box-shadow: 0 4px 10px rgba(209, 119, 17, 0.2); }
          .btn-create:hover { transform: translateY(-1px); }
          .btn-create.main:hover { background: #b4660e; box-shadow: 0 6px 15px rgba(209, 119, 17, 0.3); }

          .ff-alert-hubs { display: flex; gap: 10px; }
          .alert-pill { position: relative; background: white; border: 1px solid rgba(34, 76, 34, 0.1); padding: 8px 16px; border-radius: 10px; display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px; font-weight: 700; color: var(--ff-green-dark); transition: 0.2s; }
          .alert-pill:hover { border-color: var(--ff-green-dark); box-shadow: 0 4px 12px rgba(34,76,34,0.05); }

          .dot-pulse { position: absolute; top: -3px; right: -3px; width: 10px; height: 10px; border-radius: 50%; border: 2px solid white; }
          .dot-pulse.orange { background: var(--ff-orange); animation: pulse-orange 1.5s infinite; }
          .dot-pulse.green { background: var(--ff-green-dark); animation: pulse-green 1.5s infinite; }
          .dot-pulse.emerald { background: #10b981; animation: pulse-emerald 1.5s infinite; }
          
          @keyframes pulse-orange { 0% { box-shadow: 0 0 0 0 rgba(209, 119, 17, 0.7); } 100% { box-shadow: 0 0 0 6px rgba(209, 119, 17, 0); } }
          @keyframes pulse-green { 0% { box-shadow: 0 0 0 0 rgba(34, 76, 34, 0.7); } 100% { box-shadow: 0 0 0 6px rgba(34, 76, 34, 0); } }
          @keyframes pulse-emerald { 0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); } 100% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); } }

          /* HERO METRICS (2 Columnas en lugar de 4) */
          .ff-hero-metrics-split { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
          .metric-card { background: white; padding: 24px; border-radius: 16px; border: 1px solid rgba(34, 76, 34, 0.08); display: flex; flex-direction: column; gap: 6px; box-shadow: 0 2px 10px rgba(0,0,0,0.02); transition: 0.2s; }
          .metric-card:hover { transform: translateY(-2px); box-shadow: 0 6px 15px rgba(34,76,34,0.04); }
          .metric-card.highlight { border-left: 4px solid var(--ff-orange); }
          .metric-card.neutral { border-left: 4px solid var(--ff-green-dark); }
          .m-label { font-size: 11px; font-weight: 800; color: var(--ff-green-dark); opacity: 0.6; text-transform: uppercase; display: flex; align-items: center; gap: 6px; }
          .m-value { font-size: 32px; font-weight: 800; color: var(--ff-green-dark); letter-spacing: -0.5px; }
          .m-value-small { font-size: 28px; font-weight: 800; color: var(--ff-green-dark); }

          /* UNIFIED INBOX VERTICAL */
          .inbox-panel { padding-bottom: 8px; }
          .ff-unified-list { display: flex; flex-direction: column; }
          .unified-row { display: flex; align-items: center; gap: 16px; padding: 14px 20px; border-bottom: 1px solid rgba(34,76,34,0.05); cursor: pointer; transition: all 0.2s ease; background: #fff; }
          .unified-row:last-child { border-bottom: none; }
          .unified-row:hover { background: #f9fbf9; padding-left: 24px; }
          
          .row-badge { font-size: 9px; font-weight: 800; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px; min-width: 85px; text-align: center; flex-shrink: 0; }
          .badge-ventas { background: #ecfdf5; color: #047857; }
          .badge-operaciones { background: #eff6ff; color: #1d4ed8; }
          .badge-soporte { background: #f3e8ff; color: #7e22ce; }
          .badge-cliente { background: #fff7ed; color: #c2410c; }
          .badge-admin { background: #f1f5f9; color: #475569; }

          .row-core { flex: 1; display: flex; align-items: center; gap: 8px; overflow: hidden; white-space: nowrap; }
          .row-sender { font-size: 13px; font-weight: 700; color: var(--ff-green-dark); }
          .row-divider { color: #cbd5e1; font-size: 10px; }
          .row-subject { font-size: 13px; font-weight: 600; color: #334155; }
          .row-snippet { font-size: 13px; font-weight: 400; color: #94a3b8; text-overflow: ellipsis; overflow: hidden; }

          .row-meta { display: flex; align-items: center; gap: 16px; min-width: 80px; justify-content: flex-end; }
          .row-time { font-size: 11px; font-weight: 600; color: #94a3b8; transition: 0.2s; }
          .row-action { display: none; font-size: 11px; font-weight: 700; color: var(--ff-green); align-items: center; gap: 4px; }
          
          /* Microinteracción: Ocultar hora, mostrar botón de acción */
          .unified-row:hover .row-time { display: none; }
          .unified-row:hover .row-action { display: flex; animation: slideIn 0.2s ease; }
          @keyframes slideIn { from { opacity: 0; transform: translateX(-5px); } to { opacity: 1; transform: translateX(0); } }

          /* TABLAS DE UNA SOLA FILA */
          .ff-main-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
          .ff-panel { background: white; border-radius: 20px; border: 1px solid rgba(34,76,34,0.08); padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.02); }
          .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding: 0 4px; }
          .section-header h3 { font-size: 12px; font-weight: 800; color: var(--ff-green-dark); text-transform: uppercase; display: flex; align-items: center; gap: 8px; margin: 0; }
          .section-header button { font-size: 11px; font-weight: 700; color: var(--ff-green); background: none; border: none; cursor: pointer; transition: 0.2s; }
          .section-header button:hover { color: var(--ff-green-dark); }

          .ff-table-list { display: flex; flex-direction: column; gap: 8px; }
          .ff-list-row { display: flex; align-items: center; padding: 10px 14px; background: #fcfdfc; border: 1px solid rgba(34,76,34,0.05); border-radius: 12px; cursor: pointer; transition: all 0.2s ease; gap: 12px; }
          .ff-list-row:hover { border-color: var(--ff-green); background: white; transform: translateY(-1px); box-shadow: 0 4px 10px rgba(34,76,34,0.04); }
          .ff-list-row.urgent { background: #fff5f5; border-color: #fecdd3; }
          .ff-list-row.urgent:hover { border-color: #ef4444; }
          
          .col-code { min-width: 120px; display: flex; align-items: center; gap: 8px; }
          .code-text { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; color: var(--ff-green-dark); }
          
          .row-icon-box { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 6px; flex-shrink: 0; }
          .row-icon-box.air { background: #e0f2fe; color: #0284c7; }
          .row-icon-box.sea { background: #f1f5f9; color: #475569; }
          .row-icon { opacity: 0.4; }
          
          .col-client { flex: 1; font-size: 12px; font-weight: 600; color: var(--ff-green-dark); opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .col-amount { font-size: 13px; font-weight: 700; color: var(--ff-green-dark); min-width: 80px; text-align: right; font-variant-numeric: tabular-nums; }
          .col-status { min-width: 90px; display: flex; justify-content: flex-end; }
          
          .status-badge { font-size: 9px; font-weight: 800; padding: 4px 8px; border-radius: 6px; letter-spacing: 0.5px; }
          .bg-slate-100 { background: #f1f5f9; } .text-slate-600 { color: #475569; }
          .bg-amber-100 { background: #fef3c7; } .text-amber-700 { color: #b45309; }
          .bg-blue-100 { background: #dbeafe; } .text-blue-700 { color: #1d4ed8; }
          .bg-purple-100 { background: #f3e8ff; } .text-purple-700 { color: #7e22ce; }
          .bg-emerald-100 { background: #d1fae5; } .text-emerald-700 { color: #047857; }
          .bg-sky-100 { background: #e0f2fe; } .text-sky-700 { color: #0369a1; }
          .bg-orange-100 { background: #ffedd5; } .text-orange-700 { color: #c2410c; } .border-orange-200 { border: 1px solid #fed7aa; }
          .bg-rose-100 { background: #ffe4e6; } .text-rose-700 { color: #be123c; }
          
          .row-arrow { color: var(--ff-green-dark); opacity: 0.2; transition: 0.2s; }
          .ff-list-row:hover .row-arrow { opacity: 1; transform: translateX(2px); }
          
          .ff-empty-state { padding: 20px; text-align: center; color: var(--ff-green-dark); opacity: 0.5; font-weight: 600; font-size: 12px; background: #f9fbf9; border-radius: 12px; border: 1px dashed rgba(34,76,34,0.1); }

          /* LOADING */
          .ff-loading-full { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 400px; }
          .ff-loader-ring { width: 30px; height: 30px; border: 3px solid rgba(34,76,34,0.1); border-top-color: var(--ff-green-dark); border-radius: 50%; animation: spin 1s linear infinite; }
          .ff-sync-text { font-size: 10px; font-weight: 800; color: var(--ff-green-dark); opacity: 0.6; text-transform: uppercase; letter-spacing: 2px; margin-top: 16px; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </AdminLayout>
  );
}