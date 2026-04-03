import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, Plane, ArrowRight, TrendingUp,
  AlertCircle, Activity, UserPlus, Ship, Sparkles, Clock, Check, ChevronRight, MessageSquare, Mail,
  TrendingDown, CheckCircle2, XCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { AdminLayout } from "@/components/AdminLayout";
import { useNavigate } from 'react-router-dom';

// Importación de Modales
import { QuickQuoteModal } from '@/components/quotes/QuickQuoteModal';
import { NewClientModal } from '@/components/clients/NewClientModal';

// --- 1. HELPERS DE UI (ESTADOS E ICONOS) ---
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
      clients: 0, 
      pipelineTotal: 0, 
      pipelineApproved: 0, 
      pipelineRejected: 0,
      newRequests: 0, 
      unreadMessages: 0 
    },
    recentQuotes: [] as any[],
    recentShipments: [] as any[],
    unreadList: [] as any[]
  });

  const fetchDashboardData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [shipmentsCount, clientsCount, pipelineData, newReqs, unreadMsg] = await Promise.all([
        supabase.from('shipments').select('id', { count: 'exact', head: true }).not('status', 'in', '("delivered", "cancelled")'),
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        supabase.from('quotes').select('total, status').in('status', ['sent', 'approved', 'rejected']),
        supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('status', 'Solicitud'),
        supabase.from('quote_activity').select(`
            id, message, created_at, quote_id,
            quotes ( quote_number, clients (name) )
          `, { count: 'exact' })
          .eq('is_read', false)
          .eq('sender_role', 'client')
          .order('created_at', { ascending: false })
      ]);

      const stats = {
        total: 0,
        approved: 0,
        rejected: 0
      };
      pipelineData.data?.forEach(q => {
        const val = Number(q.total) || 0;
        if (q.status === 'sent') stats.total += val;
        if (q.status === 'approved') stats.approved += val;
        if (q.status === 'rejected') stats.rejected += val;
      });

      const [quotes, ships] = await Promise.all([
        supabase.from('quotes').select('*, clients(name)').order('created_at', { ascending: false }).limit(6),
        // Ahora sí traemos el mode correctamente porque la base de datos ya lo tiene
        supabase.from('shipments').select('*, clients(name), mode').order('created_at', { ascending: false }).limit(6)
      ]);

      setData({
        stats: {
          shipments: shipmentsCount.count || 0,
          clients: clientsCount.count || 0,
          pipelineTotal: stats.total,
          pipelineApproved: stats.approved,
          pipelineRejected: stats.rejected,
          newRequests: newReqs.count || 0,
          unreadMessages: unreadMsg.count || 0
        },
        recentQuotes: quotes.data || [],
        recentShipments: ships.data || [],
        unreadList: unreadMsg.data || []
      });
    } catch (error) {
      console.error("Dashboard Error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    fetchDashboardData(); 
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quote_activity' }, () => {
        fetchDashboardData(true);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchDashboardData]);

  const formatCurrency = (val: number | null) => {
    return new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD',
        maximumFractionDigits: 0 
    }).format(val || 0);
  };

  if (loading) return (
    <AdminLayout title="Dashboard">
      <div className="ff-loading-full">
        <div className="ff-loader-ring"></div>
        <p className="ff-sync-text">Sincronizando Inteligencia Logística</p>
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
            <div className={`alert-pill ${data.stats.unreadMessages > 0 ? 'pulse-green' : ''}`} onClick={() => navigate('/admin/quotes')}>
              {data.stats.unreadMessages > 0 && <span className="dot-pulse green" />}
              <MessageSquare size={14} />
              <span>{data.stats.unreadMessages} Mensajes</span>
            </div>
          </div>
        </div>

        {/* HERO: MÉTRICAS DE CONVERSIÓN */}
        <div className="ff-hero-metrics">
          <div className="metric-card highlight">
            <span className="m-label"><TrendingUp size={12}/> Total Cotizado (Pendiente)</span>
            <span className="m-value">{formatCurrency(data.stats.pipelineTotal)}</span>
          </div>
          <div className="metric-card success">
            <span className="m-label"><CheckCircle2 size={12}/> Aprobado</span>
            <span className="m-value">{formatCurrency(data.stats.pipelineApproved)}</span>
          </div>
          <div className="metric-card danger">
            <span className="m-label"><XCircle size={12}/> Rechazado</span>
            <span className="m-value">{formatCurrency(data.stats.pipelineRejected)}</span>
          </div>
          <div className="metric-card neutral">
            <span className="m-label"><Ship size={12}/> En Tránsito</span>
            <span className="m-value-small">{data.stats.shipments} Embarques</span>
          </div>
        </div>

        {/* INBOX */}
        {data.unreadList.length > 0 && (
          <section className="ff-inbox-mini">
            <div className="section-header">
              <h3><Mail size={14}/> Bandeja de Entrada</h3>
            </div>
            <div className="inbox-row-scroll">
              {data.unreadList.map((msg) => (
                <div key={msg.id} className="inbox-item" onClick={() => navigate(`/admin/quotes/${msg.quote_id}`)}>
                  <div className="i-dot" />
                  <div className="i-content">
                    <span className="i-client">{msg.quotes?.clients?.name}</span>
                    <p className="i-text">{msg.message}</p>
                  </div>
                  <span className="i-time">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="ff-main-grid">
          {/* TRÁNSITOS */}
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

          {/* COTIZACIONES */}
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
        
        {showQuoteModal && (
          <QuickQuoteModal 
            isOpen={showQuoteModal} 
            onClose={() => setShowQuoteModal(false)} 
          />
        )}
        
        {/* CSS COMPACTO Y "SLEEK" */}
        <style>{`
          .ff-dashboard-v2 { display: flex; flex-direction: column; gap: 24px; padding-bottom: 40px; font-family: 'Poppins', sans-serif !important; }
          
          /* TOP BAR & ACTIONS */
          .ff-top-bar { display: flex; justify-content: space-between; align-items: center; }
          .ff-creation-actions { display: flex; gap: 10px; }
          
          .btn-create { 
            display: flex; align-items: center; gap: 8px; padding: 8px 16px; 
            border-radius: 10px; font-size: 12px; font-weight: 700; 
            border: 1.5px solid var(--ff-green-dark); background: transparent; 
            color: var(--ff-green-dark); cursor: pointer; transition: all 0.2s ease; 
          }
          .btn-create.main { background: var(--ff-orange); color: white; border: none; box-shadow: 0 4px 10px rgba(209, 119, 17, 0.2); }
          .btn-create:hover { transform: translateY(-1px); }
          .btn-create.main:hover { background: #b4660e; box-shadow: 0 6px 15px rgba(209, 119, 17, 0.3); }

          .ff-alert-hubs { display: flex; gap: 10px; }
          .alert-pill { 
            position: relative; background: white; border: 1px solid rgba(34, 76, 34, 0.1); 
            padding: 8px 16px; border-radius: 10px; display: flex; align-items: center; gap: 8px; 
            cursor: pointer; font-size: 12px; font-weight: 700; color: var(--ff-green-dark); transition: 0.2s; 
          }
          .alert-pill:hover { border-color: var(--ff-green-dark); box-shadow: 0 4px 12px rgba(34,76,34,0.05); }

          .dot-pulse { position: absolute; top: -3px; right: -3px; width: 10px; height: 10px; border-radius: 50%; border: 2px solid white; }
          .dot-pulse.orange { background: var(--ff-orange); animation: pulse-orange 1.5s infinite; }
          .dot-pulse.green { background: var(--ff-green-dark); animation: pulse-green 1.5s infinite; }
          
          @keyframes pulse-orange { 0% { box-shadow: 0 0 0 0 rgba(209, 119, 17, 0.7); } 100% { box-shadow: 0 0 0 6px rgba(209, 119, 17, 0); } }
          @keyframes pulse-green { 0% { box-shadow: 0 0 0 0 rgba(34, 76, 34, 0.7); } 100% { box-shadow: 0 0 0 6px rgba(34, 76, 34, 0); } }

          /* HERO METRICS */
          .ff-hero-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
          .metric-card { 
            background: white; padding: 20px; border-radius: 16px; 
            border: 1px solid rgba(34, 76, 34, 0.08); display: flex; flex-direction: column; gap: 6px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.02); transition: 0.2s;
          }
          .metric-card:hover { transform: translateY(-2px); box-shadow: 0 6px 15px rgba(34,76,34,0.04); }
          .metric-card.highlight { border-left: 4px solid var(--ff-orange); }
          .metric-card.success { border-left: 4px solid var(--ff-green); }
          .metric-card.danger { border-left: 4px solid #ef4444; }
          .metric-card.neutral { border-left: 4px solid var(--ff-green-dark); }
          
          .m-label { font-size: 10px; font-weight: 800; color: var(--ff-green-dark); opacity: 0.6; text-transform: uppercase; display: flex; align-items: center; gap: 6px; }
          .m-value { font-size: 24px; font-weight: 800; color: var(--ff-green-dark); letter-spacing: -0.5px; }
          .m-value-small { font-size: 20px; font-weight: 800; color: var(--ff-green-dark); }

          /* TABLAS DE UNA SOLA FILA */
          .ff-main-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
          .ff-panel { background: white; border-radius: 20px; border: 1px solid rgba(34,76,34,0.08); padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.02); }
          .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
          .section-header h3 { font-size: 12px; font-weight: 800; color: var(--ff-green-dark); text-transform: uppercase; display: flex; align-items: center; gap: 8px; margin: 0; }
          .section-header button { font-size: 11px; font-weight: 700; color: var(--ff-green); background: none; border: none; cursor: pointer; transition: 0.2s; }
          .section-header button:hover { color: var(--ff-green-dark); }

          .ff-table-list { display: flex; flex-direction: column; gap: 8px; }
          .ff-list-row { 
            display: flex; align-items: center; padding: 10px 14px; 
            background: #fcfdfc; border: 1px solid rgba(34,76,34,0.05); 
            border-radius: 12px; cursor: pointer; transition: all 0.2s ease; gap: 12px; 
          }
          .ff-list-row:hover { border-color: var(--ff-green); background: white; transform: translateY(-1px); box-shadow: 0 4px 10px rgba(34,76,34,0.04); }
          .ff-list-row.urgent { background: #fff5f5; border-color: #fecdd3; }
          .ff-list-row.urgent:hover { border-color: #ef4444; }
          
          /* Tipografía y Espacios Reducidos */
          .col-code { min-width: 120px; display: flex; align-items: center; gap: 8px; }
          .code-text { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; color: var(--ff-green-dark); }
          
          .row-icon-box { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 6px; flex-shrink: 0; }
          .row-icon-box.air { background: #e0f2fe; color: #0284c7; }
          .row-icon-box.sea { background: #f1f5f9; color: #475569; }
          .row-icon { opacity: 0.4; }
          
          .col-client { flex: 1; font-size: 12px; font-weight: 600; color: var(--ff-green-dark); opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .col-amount { font-size: 13px; font-weight: 700; color: var(--ff-green-dark); min-width: 80px; text-align: right; font-variant-numeric: tabular-nums; }
          .col-status { min-width: 90px; display: flex; justify-content: flex-end; }
          
          /* Status Badges Compactos */
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

          /* INBOX MINI */
          .ff-inbox-mini { background: white; border-radius: 20px; padding: 20px; border: 1px solid rgba(34,76,34,0.08); box-shadow: 0 2px 10px rgba(0,0,0,0.02); }
          .inbox-row-scroll { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; }
          .inbox-item { min-width: 280px; background: #fcfdfc; padding: 14px 16px; border-radius: 14px; border: 1px solid rgba(34,76,34,0.05); display: flex; align-items: center; gap: 12px; cursor: pointer; transition: 0.2s; }
          .inbox-item:hover { transform: translateY(-1px); border-color: var(--ff-green); box-shadow: 0 4px 10px rgba(34,76,34,0.04); background: white; }
          .i-dot { width: 6px; height: 6px; background: var(--ff-green-dark); border-radius: 50%; }
          .i-client { display: block; font-size: 10px; font-weight: 800; color: var(--ff-green-dark); opacity: 0.5; text-transform: uppercase; }
          .i-text { font-size: 12px; font-weight: 500; color: var(--ff-green-dark); margin: 2px 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }
          .i-time { font-size: 9px; font-weight: 800; color: var(--ff-green-dark); opacity: 0.3; }

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