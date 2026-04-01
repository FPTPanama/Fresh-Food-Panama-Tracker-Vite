import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, Plane, ArrowRight, TrendingUp,
  AlertCircle, Activity, UserPlus, Ship, Sparkles, Clock, Check, ChevronRight, MessageSquare, Mail
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { AdminLayout } from "@/components/AdminLayout";
import { useNavigate } from 'react-router-dom';

// Importación de Modales
import { QuickQuoteModal } from '@/components/quotes/QuickQuoteModal';
import { NewClientModal } from '@/components/clients/NewClientModal';

const STEPS = [
  { type: "CREATED", label: "Creado" },
  { type: "PACKED", label: "Empaque" },
  { type: "DOCS_READY", label: "Docs" },
  { type: "AT_ORIGIN", label: "Terminal" },
  { type: "IN_TRANSIT", label: "Tránsito" },
  { type: "AT_DESTINATION", label: "Destino" },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  
  const [data, setData] = useState({
    stats: { shipments: 0, clients: 0, quotes: 0, pipeline: 0, newRequests: 0, unreadMessages: 0 },
    recentQuotes: [] as any[],
    recentShipments: [] as any[],
    unreadList: [] as any[] // Nueva lista de mensajes para el Inbox
  });

  const getStepIndex = (status: string) => {
    const s = status?.toUpperCase() || '';
    if (s.includes('DESTINATION')) return 5;
    if (s.includes('TRANSIT')) return 4;
    if (s.includes('ORIGIN')) return 3;
    if (s.includes('DOCS')) return 2;
    if (s.includes('PACKED')) return 1;
    return 0; 
  };

  const fetchDashboardData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [shipmentsCount, clientsCount, pipelineData, newReqs, unreadMsg] = await Promise.all([
        supabase.from('shipments').select('id', { count: 'exact', head: true }).not('status', 'in', '("delivered", "cancelled")'),
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        supabase.from('quotes').select('total').in('status', ['sent', 'approved']),
        supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('status', 'Solicitud'),
        // Conteo y data de mensajes no leídos
        supabase.from('quote_activity').select(`
            id, message, created_at, quote_id,
            quotes ( quote_number, clients (name) )
          `, { count: 'exact' })
          .eq('is_read', false)
          .eq('sender_role', 'client')
          .order('created_at', { ascending: false })
      ]);

      const totalPipeline = pipelineData.data?.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0) || 0;

      const [quotes, ships] = await Promise.all([
        supabase.from('quotes').select('*, clients(name)').order('created_at', { ascending: false }).limit(4),
        supabase.from('shipments').select('*, clients(name)').order('created_at', { ascending: false }).limit(4)
      ]);

      setData({
        stats: {
          shipments: shipmentsCount.count || 0,
          clients: clientsCount.count || 0,
          quotes: 0, 
          pipeline: totalPipeline,
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

  const handleModalSuccess = () => {
    fetchDashboardData(true);
    setShowClientModal(false);
    setShowQuoteModal(false);
  };

  if (loading) return (
    <AdminLayout title="Dashboard">
      <div className="ff-loading-full">
        <div className="ff-loader-ring"></div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mt-4 text-center">Sincronizando Inteligencia Logística</p>
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout title="Overview" subtitle="Monitor de Operaciones Globales">
      <div className="ff-compact-dashboard">
        
        {/* ACTION HUB */}
        <div className="ff-action-hub">
          <div className={`hub-pill ${data.stats.newRequests > 0 ? 'urgent' : ''}`} onClick={() => navigate('/admin/quotes')}>
            <AlertCircle size={16} />
            <div className="hub-data">
              <span className="h-val">{data.stats.newRequests}</span>
              <span className="h-lab">Solicitudes RFQ</span>
            </div>
          </div>
          <div className={`hub-pill ${data.stats.unreadMessages > 0 ? 'active' : ''}`} onClick={() => navigate('/admin/quotes')}>
            <MessageSquare size={16} />
            <div className="hub-data">
              <span className="h-val">{data.stats.unreadMessages}</span>
              <span className="h-lab">Mensajes Chat</span>
            </div>
          </div>
          <div className="hub-pill bg-slate-900 text-white border-none" onClick={() => setShowQuoteModal(true)}>
            <FileText size={16} />
            <div className="hub-data">
              <span className="h-lab text-slate-400 text-[8px]">Nueva</span>
              <span className="h-lab text-white">Cotización</span>
            </div>
          </div>
          <div className="hub-pill" onClick={() => setShowClientModal(true)}>
            <UserPlus size={16} />
            <div className="hub-data">
              <span className="h-lab text-slate-400 text-[8px]">Registrar</span>
              <span className="h-lab text-slate-900">Nuevo Cliente</span>
            </div>
          </div>
        </div>

        {/* INBOX DE MENSAJES (EVOLUCIÓN) */}
        {data.unreadList.length > 0 && (
          <section className="ff-inbox-section">
            <div className="p-header">
              <h3><Mail size={14}/> Bandeja de Entrada</h3>
              <span className="badge-count">{data.stats.unreadMessages} Pendientes</span>
            </div>
            <div className="inbox-scroll">
              {data.unreadList.map((msg) => (
                <div key={msg.id} className="inbox-card" onClick={() => navigate(`/admin/quotes/${msg.quote_id}`)}>
                  <div className="card-top">
                    <span className="c-client">{msg.quotes?.clients?.name}</span>
                    <span className="c-time">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <p className="c-text">"{msg.message}"</p>
                  <div className="card-foot">
                    <span className="c-quote">{msg.quotes?.quote_number}</span>
                    <ArrowRight size={12} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* HERO ROW */}
        <div className="ff-hero-compact">
          <div className="hero-main-stat">
            <div className="stat-left">
              <span className="hero-label">Pipeline Comercial Activo</span>
              <span className="hero-value">{formatCurrency(data.stats.pipeline)}</span>
            </div>
            <div className="stat-right">
              <div className="mini-box">
                <span className="m-val">{data.stats.shipments}</span>
                <span className="m-lab">Tránsitos</span>
              </div>
              <div className="mini-box border-none">
                <span className="m-val">{data.stats.clients}</span>
                <span className="m-lab">Clientes</span>
              </div>
            </div>
          </div>
        </div>

        <div className="ff-grid-main">
          {/* ÚLTIMAS COTIZACIONES */}
          <section className="ff-glass-panel">
            <div className="p-header">
              <h3><Clock size={14}/> Actividad Comercial</h3>
              <button onClick={() => navigate('/admin/quotes')}>Ver todo</button>
            </div>
            <div className="p-list">
              {data.recentQuotes.map(q => (
                <div key={q.id} className={`q-row ${q.status === 'Solicitud' ? 'alert' : ''}`} onClick={() => navigate(`/admin/quotes/${q.id}`)}>
                  <div className="q-info">
                    <span className="q-client-name">{q.clients?.name}</span>
                    <span className="q-meta">{q.quote_number || 'BORRADOR'}</span>
                  </div>
                  <div className="q-side">
                    <span className="q-amount">{formatCurrency(q.total)}</span>
                    <span className={`q-badge ${q.status?.toLowerCase().replace(/\s/g, '-')}`}>{q.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* SEGUIMIENTO SIMPLIFICADO */}
          <section className="ff-glass-panel">
            <div className="p-header">
              <h3><Ship size={14}/> Tránsitos Recientes</h3>
              <button onClick={() => navigate('/admin/shipments')}>Mapa</button>
            </div>
            <div className="p-list">
              {data.recentShipments.map(s => {
                const currentIdx = getStepIndex(s.status);
                return (
                  <div key={s.id} className="s-row" onClick={() => navigate(`/admin/shipments/${s.id}`)}>
                    <div className="s-top">
                        <span className="s-code">{s.code}</span>
                        <span className="s-client">{s.clients?.name}</span>
                    </div>
                    <div className="s-stepper-mini">
                        {STEPS.map((_, i) => (
                            <div key={i} className={`s-dot ${i <= currentIdx ? 'done' : ''} ${i === currentIdx ? 'pulse' : ''}`} />
                        ))}
                        <span className="s-current-label">{STEPS[currentIdx].label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {showClientModal && <NewClientModal isOpen={true} onClose={() => setShowClientModal(false)} onSuccess={handleModalSuccess} />}
        {showQuoteModal && <QuickQuoteModal isOpen={true} onClose={handleModalSuccess} />}

        <style>{`
          .ff-compact-dashboard { display: flex; flex-direction: column; gap: 20px; }
          
          /* ACTION HUB */
          .ff-action-hub { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
          .hub-pill { background: white; border: 1px solid #e2e8f0; padding: 10px 15px; border-radius: 14px; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: 0.2s; }
          .hub-pill:hover { transform: translateY(-2px); border-color: #cbd5e1; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
          .hub-pill.urgent { background: #fff1f2; border-color: #fecdd3; color: #e11d48; }
          .hub-pill.active { background: #f0f9ff; border-color: #bae6fd; color: #0284c7; }
          .hub-data { display: flex; flex-direction: column; }
          .h-val { font-size: 14px; font-weight: 800; line-height: 1; }
          .h-lab { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; color: #64748b; }

          /* HERO COMPACTO */
          .ff-hero-compact { background: #0f172a; border-radius: 20px; padding: 25px 30px; color: white; }
          .hero-main-stat { display: flex; justify-content: space-between; align-items: center; }
          .hero-label { display: block; font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
          .hero-value { font-size: 32px; font-weight: 800; letter-spacing: -1px; }
          .stat-right { display: flex; gap: 40px; }
          .mini-box { border-right: 1px solid rgba(255,255,255,0.1); padding-right: 40px; }
          .m-val { display: block; font-size: 20px; font-weight: 700; color: #10b981; }
          .m-lab { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; }

          /* INBOX SECTION */
          .ff-inbox-section { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 20px; padding: 20px; }
          .badge-count { font-size: 10px; font-weight: 800; background: #3b82f6; color: white; padding: 2px 8px; border-radius: 6px; }
          .inbox-scroll { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 5px; }
          .inbox-card { min-width: 260px; background: white; border: 1px solid #edf2f7; padding: 15px; border-radius: 14px; cursor: pointer; transition: 0.2s; flex-shrink: 0; }
          .inbox-card:hover { transform: translateY(-3px); border-color: #3b82f6; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
          .card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
          .c-client { font-size: 10px; font-weight: 800; color: #1e293b; text-transform: uppercase; }
          .c-time { font-size: 9px; color: #94a3b8; font-weight: 600; }
          .c-text { font-size: 12px; color: #475569; margin-bottom: 10px; font-style: italic; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
          .card-foot { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f1f5f9; padding-top: 8px; font-size: 9px; font-weight: 800; color: #64748b; }

          /* GRID & PANELS */
          .ff-grid-main { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
          .ff-glass-panel { background: white; border-radius: 20px; border: 1px solid #f1f5f9; padding: 20px; }
          .p-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
          .p-header h3 { font-size: 13px; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 8px; margin: 0; text-transform: uppercase; }
          .p-header button { font-size: 11px; font-weight: 700; color: #3b82f6; background: none; border: none; cursor: pointer; }

          .q-row { display: flex; justify-content: space-between; padding: 12px; border-radius: 12px; border: 1px solid #f8fafc; cursor: pointer; transition: 0.2s; margin-bottom: 4px; }
          .q-row:hover { background: #f8fafc; transform: translateX(4px); }
          .q-row.alert { background: #fff1f2; border-color: #ffe4e6; }
          .q-client-name { display: block; font-size: 13px; font-weight: 600; color: #334155; }
          .q-meta { font-size: 10px; font-weight: 700; color: #94a3b8; font-family: 'JetBrains Mono', monospace; }
          .q-side { text-align: right; }
          .q-amount { display: block; font-size: 14px; font-weight: 800; color: #1e293b; }
          .q-badge { font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 6px; text-transform: uppercase; background: #f1f5f9; color: #475569; }
          .q-badge.sent { background: #dcfce7; color: #166534; }
          .q-badge.solicitud { background: #ef4444; color: white; }

          .s-row { padding: 12px; border-radius: 12px; border: 1px solid #f8fafc; cursor: pointer; margin-bottom: 8px; }
          .s-row:hover { border-color: #10b981; }
          .s-top { display: flex; justify-content: space-between; margin-bottom: 8px; }
          .s-code { font-size: 11px; font-weight: 800; color: #0f172a; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
          .s-client { font-size: 12px; font-weight: 600; color: #64748b; }
          .s-stepper-mini { display: flex; align-items: center; gap: 4px; }
          .s-dot { width: 6px; height: 6px; border-radius: 50%; background: #e2e8f0; }
          .s-dot.done { background: #10b981; }
          .s-dot.pulse { animation: dot-pulse 1.5s infinite; }
          .s-current-label { font-size: 9px; font-weight: 800; color: #10b981; text-transform: uppercase; margin-left: 8px; }

          @keyframes dot-pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.5); opacity: 0.5; } 100% { transform: scale(1); opacity: 1; } }
          @keyframes spin { to { transform: rotate(360deg); } }
          .ff-loader-ring { width: 24px; height: 24px; border: 3px solid #e2e8f0; border-top-color: #10b981; border-radius: 50%; animation: spin 1s linear infinite; }
        `}</style>
      </div>
    </AdminLayout>
  );
}