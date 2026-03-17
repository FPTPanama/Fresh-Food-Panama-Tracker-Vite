import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, Plane, ArrowRight, TrendingUp,
  AlertCircle, Activity, UserPlus, Ship, Sparkles, Clock, Check, ChevronRight
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { AdminLayout } from "@/components/AdminLayout";
import { useNavigate } from 'react-router-dom';

// Importación de Modales
import { QuickQuoteModal } from '@/components/quotes/QuickQuoteModal';
import { NewClientModal } from '@/components/clients/NewClientModal';

// Definición de pasos idéntica a la del cliente (6 PASOS)
const STEPS = [
  { type: "CREATED", label: "Creado" },
  { type: "PACKED", label: "Empaque" },
  { type: "DOCS_READY", label: "Docs" },
  { type: "AT_ORIGIN", label: "Terminal" },
  { type: "IN_TRANSIT", label: "En Vuelo" },
  { type: "AT_DESTINATION", label: "Destino" },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  
  const [data, setData] = useState({
    stats: { shipments: 0, clients: 0, quotes: 0, pipeline: 0, newRequests: 0 },
    recentQuotes: [] as any[],
    recentShipments: [] as any[]
  });

  const getStepIndex = (status: string) => {
    const s = status?.toUpperCase() || '';
    if (s.includes('DESTINATION') || s.includes('DESTINO')) return 5;
    if (s.includes('TRANSIT') || s.includes('VUELO') || s.includes('IN_TRANSIT')) return 4;
    if (s.includes('ORIGIN') || s.includes('TERMINAL') || s.includes('AT_ORIGIN')) return 3;
    if (s.includes('DOCS') || s.includes('DOCS_READY')) return 2;
    if (s.includes('PACKED') || s.includes('EMPAQUE')) return 1;
    return 0; 
  };

  const fetchDashboardData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [shipmentsCount, clientsCount, pipelineData, newReqs] = await Promise.all([
        supabase.from('shipments').select('*', { count: 'exact', head: true }).not('status', 'in', '("delivered", "cancelled")'),
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase.from('quotes').select('total').in('status', ['sent', 'approved']),
        supabase.from('quotes').select('*', { count: 'exact', head: true }).eq('status', 'Solicitud')
      ]);

      const totalPipeline = pipelineData.data?.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0) || 0;

      const [quotes, ships] = await Promise.all([
        supabase.from('quotes').select('*, clients(name)').order('created_at', { ascending: false }).limit(3),
        supabase.from('shipments').select('*, clients(name)').order('created_at', { ascending: false }).limit(3)
      ]);

      setData({
        stats: {
          shipments: shipmentsCount.count || 0,
          clients: clientsCount.count || 0,
          quotes: 0, 
          pipeline: totalPipeline,
          newRequests: newReqs.count || 0
        },
        recentQuotes: quotes.data || [],
        recentShipments: ships.data || []
      });
    } catch (error) {
      console.error("Dashboard Error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  const handleModalSuccess = () => {
    fetchDashboardData(true);
    setShowClientModal(false);
    setShowQuoteModal(false);
  };

  const formatCurrency = (val: number | null) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);
  };

  if (loading) {
    return (
      <AdminLayout title="Dashboard">
        <div className="ff-loading-full">
          <div className="ff-loader-ring"></div>
          <p>Sincronizando Inteligencia Logística...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Overview" subtitle="Monitor de Operaciones Globales">
      <div className="ff-pro-dashboard">
        
        {data.stats.newRequests > 0 && (
          <div className="ff-alert-strip animate-slide-down">
            <div className="alert-content">
              <AlertCircle size={18} className="pulse-icon" />
              <span>Tienes <b>{data.stats.newRequests} nuevas solicitudes</b> esperando respuesta comercial.</span>
            </div>
            <button onClick={() => navigate('/admin/quotes')} className="btn-alert-action">
              Atender Ahora <ArrowRight size={14}/>
            </button>
          </div>
        )}

        {/* HERO ROW - IGUALDAD DE ALTURA (STRETCH) */}
        <div className="ff-hero-row">
          <div className="ff-pipeline-section">
            <div className="stat-pro-card main">
              <div className="stat-icon"><Activity size={24} /></div>
              <div className="stat-data">
                <span className="label">Pipeline Comercial</span>
                <span className="value">{formatCurrency(data.stats.pipeline)}</span>
                <div className="growth"><TrendingUp size={14} /> +12.5% proyectado</div>
              </div>
              <div className="mini-stats-inline">
                 <div className="mini-item">
                    <span className="m-label">Operaciones</span>
                    <span className="m-value">{data.stats.shipments}</span>
                 </div>
                 <div className="mini-item">
                    <span className="m-label">Clientes</span>
                    <span className="m-value">{data.stats.clients}</span>
                 </div>
              </div>
            </div>
          </div>

          <div className="ff-growth-panel-strong">
             <div className="growth-header">
                <Sparkles size={16} />
                <span>Panel de Crecimiento</span>
             </div>
             <div className="growth-actions">
               <button className="btn-action-strong" onClick={() => setShowClientModal(true)}>
                 <div className="icon-circle"><UserPlus size={18} /></div>
                 <span>Nuevo Cliente</span>
               </button>
               <button className="btn-action-strong" onClick={() => setShowQuoteModal(true)}>
                 <div className="icon-circle"><FileText size={18} /></div>
                 <span>Nueva Cotización</span>
               </button>
             </div>
          </div>
        </div>

        <div className="ff-dual-grid">
          
          {/* COLUMNA 1: COTIZACIONES (Estética Recuperada) */}
          <section className="ff-panel">
            <div className="panel-header">
              <div className="title-box"><Clock size={18} /><h3>Últimas Cotizaciones</h3></div>
              <button className="btn-ghost" onClick={() => navigate('/admin/quotes')}>Ver todas</button>
            </div>
            <div className="items-list">
              {data.recentQuotes.map(q => {
                const clientName = q.clients?.name || q.client_snapshot?.name || 'Cliente No Identificado';
                return (
                  <div key={q.id} className={`quote-item-wide ${q.status === 'Solicitud' ? 'urgent' : ''}`} onClick={() => navigate(`/admin/quotes/${q.id}`)}>
                    <div className="q-main">
                      <span className="q-client">{clientName}</span>
                      <span className="q-code">{q.quote_number || 'Borrador'}</span>
                    </div>
                    <div className="q-status-box">
                      <span className="q-price">{formatCurrency(q.total)}</span>
                      <span className={`badge-status ${q.status?.toLowerCase().replace(/\s/g, '-')}`}>
                        {q.status}
                      </span>
                    </div>
                    <div className="q-arrow-box"><ChevronRight size={18} /></div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* COLUMNA 2: SEGUIMIENTO (Espaciado Refinado) */}
          <section className="ff-panel">
            <div className="panel-header">
              <div className="title-box"><Ship size={18} /><h3>Seguimiento Activo</h3></div>
              <button className="btn-ghost" onClick={() => navigate('/admin/shipments')}>Operaciones</button>
            </div>
            <div className="items-list">
              {data.recentShipments.map(s => {
                const currentIdx = getStepIndex(s.status);
                const isAir = s.product_mode?.toLowerCase().includes('aére') || s.product_mode?.toLowerCase().includes('air');

                return (
                  <div key={s.id} className="ship-stepper-card" onClick={() => navigate(`/admin/shipments/${s.id}`)}>
                    <div className="ship-info-row">
                      <div className="ship-badge-main">
                        {isAir ? <Plane size={14}/> : <Ship size={14}/>}
                        <span>{s.code}</span>
                      </div>
                      <span className="ship-client-name">{s.clients?.name || 'Cliente'}</span>
                    </div>

                    <div className="stepper-ui-pro">
                      {STEPS.map((step, i) => (
                        <React.Fragment key={i}>
                          <div className={`step-node ${i <= currentIdx ? 'filled' : ''} ${i === currentIdx ? 'active' : ''}`}>
                            {i < currentIdx ? <Check size={10} strokeWidth={4} /> : <div className="inner-dot" />}
                          </div>
                          {i < STEPS.length - 1 && (
                            <div className={`step-bar ${i < currentIdx ? 'filled' : ''}`} />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                    <div className="stepper-labels-pro">
                      {STEPS.map((step, i) => (
                        <span key={i} className={i === currentIdx ? 'active' : ''}>{step.label}</span>
                      ))}
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
          .ff-pro-dashboard { display: flex; flex-direction: column; gap: 24px; padding: 10px 0; }
          .ff-alert-strip { background: #fff1f2; border: 1px solid #fda4af; padding: 14px 24px; border-radius: 20px; display: flex; justify-content: space-between; align-items: center; color: #9f1239; box-shadow: 0 4px 15px rgba(159, 18, 57, 0.1); }
          .btn-alert-action { background: #9f1239; color: white; border: none; padding: 8px 16px; border-radius: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s; }

          /* HERO GRID - ALINEACIÓN DE ALTURA POR DEFECTO */
          .ff-hero-row { display: grid; grid-template-columns: 3fr 1fr; gap: 24px; align-items: stretch; }
          .stat-pro-card.main { height: 100%; background: #0f172a; color: white; border-radius: 30px; padding: 35px; display: flex; align-items: center; gap: 40px; box-shadow: 0 20px 40px -15px rgba(15, 23, 42, 0.4); }
          .ff-growth-panel-strong { height: 100%; background: linear-gradient(135deg, #059669 0%, #10b981 100%); border-radius: 30px; padding: 25px; display: flex; flex-direction: column; justify-content: center; box-shadow: 0 20px 40px -15px rgba(16, 185, 129, 0.4); }

          .stat-icon { background: rgba(255,255,255,0.08); width: 64px; height: 64px; border-radius: 20px; display: flex; align-items: center; justify-content: center; color: #10b981; border: 1px solid rgba(255,255,255,0.1); }
          .stat-pro-card .label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 800; }
          .stat-pro-card .value { font-size: 42px; font-weight: 800; display: block; letter-spacing: -2px; margin: 5px 0; }
          .mini-stats-inline { margin-left: auto; display: flex; gap: 45px; border-left: 1px solid rgba(255,255,255,0.1); padding-left: 45px; }
          .m-label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 800; }
          .m-value { font-size: 24px; font-weight: 700; color: white; }

          .growth-header { display: flex; align-items: center; gap: 8px; color: white; font-size: 11px; font-weight: 800; text-transform: uppercase; margin-bottom: 20px; }
          .btn-action-strong { width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px; background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 18px; color: white; font-weight: 700; cursor: pointer; margin-bottom: 10px; transition: 0.3s; }
          .btn-action-strong:hover { background: white; color: #059669; transform: translateY(-3px); }
          .icon-circle { width: 32px; height: 32px; background: white; color: #059669; border-radius: 10px; display: flex; align-items: center; justify-content: center; }

          /* DUAL GRID */
          .ff-dual-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
          .ff-panel { background: white; border-radius: 30px; border: 1px solid #f1f5f9; padding: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.02); }
          .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
          .title-box h3 { font-size: 18px; font-weight: 800; color: #0f172a; margin: 0; }

          /* COTIZACIONES - ESTÉTICA REFORZADA */
          .quote-item-wide { display: flex; align-items: center; padding: 20px; border-radius: 22px; border: 1px solid #f1f5f9; margin-bottom: 15px; cursor: pointer; transition: 0.3s ease; position: relative; }
          .quote-item-wide:hover { transform: translateX(8px); background: #f8fafc; border-color: #e2e8f0; box-shadow: 0 10px 20px rgba(0,0,0,0.03); }
          .quote-item-wide.urgent { background: #fff1f2; border-color: #fecdd3; }
          .q-main { flex: 1; }
          .q-client { display: block; font-weight: 600; font-size: 14px; color: #1e293b; margin-bottom: 4px; }
          .q-code { font-size: 11px; font-family: 'JetBrains Mono', monospace; color: #94a3b8; }
          .q-status-box { text-align: right; margin-right: 20px; }
          .q-price { display: block; font-weight: 800; font-size: 18px; color: #0f172a; }
          .badge-status { font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 8px; text-transform: uppercase; background: #f1f5f9; color: #64748b; }
          .badge-status.sent { background: #dcfce7; color: #15803d; }
          .badge-status.solicitud { background: #9f1239; color: white; }
          .q-arrow-box { color: #cbd5e1; }

          /* SEGUIMIENTO ACTIVO - ESPACIADO MEJORADO */
          .ship-stepper-card { padding: 24px; border-radius: 25px; border: 1px solid #f1f5f9; margin-bottom: 15px; cursor: pointer; transition: 0.3s; }
          .ship-stepper-card:hover { border-color: #10b981; background: #f0fdf4; }
          .ship-info-row { display: flex; align-items: center; gap: 18px; margin-bottom: 22px; }
          .ship-badge-main { display: flex; align-items: center; gap: 8px; background: rgba(15, 23, 42, 0.12); color: #0f172a; padding: 5px 14px; border-radius: 10px; font-weight: 800; font-size: 11px; flex-shrink: 0; }
          .ship-client-name { font-weight: 600; color: #64748b; font-size: 13px; }

          /* STEPPER UI */
          .stepper-ui-pro { display: flex; align-items: center; justify-content: space-between; padding: 0 10px; margin-top: 10px; }
          .step-node { width: 22px; height: 22px; border-radius: 50%; border: 3px solid #e2e8f0; background: white; display: flex; align-items: center; justify-content: center; z-index: 2; transition: 0.4s; }
          .step-node.filled { background: #166534; border-color: #166534; color: white; }
          .step-node.active { transform: scale(1.3); border-color: #10b981; box-shadow: 0 0 15px rgba(16, 185, 129, 0.4); }
          .step-bar { flex: 1; height: 4px; background: #e2e8f0; margin: 0 -2px; z-index: 1; border-radius: 2px; }
          .step-bar.filled { background: #166534; }
          .stepper-labels-pro { display: flex; justify-content: space-between; margin-top: 12px; }
          .stepper-labels-pro span { font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase; text-align: center; width: 55px; line-height: 1.2; letter-spacing: 0.2px; }
          .stepper-labels-pro span.active { color: #166534; }

          @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
          .ff-loader-ring { width: 40px; height: 40px; border: 4px solid #f1f5f9; border-top-color: #10b981; border-radius: 50%; animation: spin 1s linear infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </AdminLayout>
  );
}