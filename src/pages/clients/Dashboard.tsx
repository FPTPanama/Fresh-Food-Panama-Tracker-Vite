import React, { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, MessageSquare, Ship, ChevronRight,
  Plus, Package, Hash, Building2, FileText, Plane, CheckCircle2, AlertCircle,
  Headset, Inbox
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { ClientLayout } from "@/components/ClientLayout";
import { useNavigate } from 'react-router-dom';
import { CustomerQuoteModal } from '@/components/quotes/CustomerQuoteModal';
import { useUILang } from '@/lib/uiLanguage';

// --- HELPERS UI ---
const getStatusConfig = (status: string, type: 'shipment' | 'quote', lang: 'es' | 'en') => {
  const s = status?.toLowerCase() || '';
  if (type === 'shipment') {
    switch(s) {
      case 'created': return { label: lang === 'es' ? 'CREADO' : 'CREATED', class: 'bg-slate-100 text-slate-600' };
      case 'packed': return { label: lang === 'es' ? 'EMPACADO' : 'PACKED', class: 'bg-amber-100 text-amber-700' };
      case 'in_transit': return { label: lang === 'es' ? 'EN TRÁNSITO' : 'IN TRANSIT', class: 'bg-blue-100 text-blue-700' };
      case 'at_destination': return { label: lang === 'es' ? 'EN DESTINO' : 'ARRIVED', class: 'bg-purple-100 text-purple-700' };
      case 'delivered': return { label: lang === 'es' ? 'ENTREGADO' : 'DELIVERED', class: 'bg-emerald-100 text-emerald-700' };
      default: return { label: s.toUpperCase(), class: 'bg-gray-100 text-gray-600' };
    }
  } else {
    switch(s) {
      case 'draft': return { label: lang === 'es' ? 'BORRADOR' : 'DRAFT', class: 'bg-slate-100 text-slate-600' };
      case 'solicitud': return { label: lang === 'es' ? 'EN REVISIÓN' : 'IN REVIEW', class: 'bg-orange-100 text-orange-700 border-orange' };
      case 'sent': return { label: lang === 'es' ? 'ESPERANDO APROBACIÓN' : 'PENDING APPROVAL', class: 'bg-sky-100 text-sky-700' };
      case 'approved': return { label: lang === 'es' ? 'APROBADA' : 'APPROVED', class: 'bg-emerald-100 text-emerald-700' };
      case 'rejected': return { label: lang === 'es' ? 'RECHAZADA' : 'REJECTED', class: 'bg-rose-100 text-rose-700' };
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

export default function ClientDashboard() {
  const navigate = useNavigate();
  const { lang } = useUILang();
  
  const [loading, setLoading] = useState(true);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [clientProfile, setClientProfile] = useState<any>(null);
  const [data, setData] = useState({
    stats: { totalBoxes: 0, pendingQuotes: 0, totalInvestment: 0, newToReview: 0 },
    recentQuotes: [] as any[],
    activeShipments: [] as any[]
  });

  const STEPS = [
    { type: "CREATED", label: lang === 'es' ? "Origen" : "Origin" },
    { type: "PACKED", label: lang === 'es' ? "Empaque" : "Packed" },
    { type: "DOCS_READY", label: lang === 'es' ? "Docs" : "Docs" },
    { type: "AT_ORIGIN", label: lang === 'es' ? "Terminal" : "Terminal" },
    { type: "IN_TRANSIT", label: lang === 'es' ? "Tránsito" : "In Transit" },
    { type: "AT_DESTINATION", label: lang === 'es' ? "Destino" : "Destination" },
  ];

  const fetchDashboardData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile, error: pError } = await supabase
        .from('profiles')
        .select('*, clients!inner(*)')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (pError) throw pError;

      const client = profile?.clients;
      if (client) {
        setClientProfile({
          id: client.id,
          name: client.name,
          taxId: client.tax_id || "N/A",
          systemId: client.id?.slice(0, 8).toUpperCase(),
          logo: client.logo_url ? `https://oqgkbduqztrpfhfclker.supabase.co/storage/v1/object/public/client-logos/${client.logo_url}` : null,
          initial: client.name?.charAt(0).toUpperCase()
        });

        // 🚨 FILTRO BLINDADO (NEQ ENCADENADOS)
        const [quotesRes, shipmentsRes, allQuotesStats] = await Promise.all([
          supabase.from('quotes').select('*')
            .eq('client_id', client.id)
            .neq('status', 'draft')     // No borradores
            .neq('status', 'archived')  // No archivados
            .order('created_at', { ascending: false }).limit(6),
          
          supabase.from('shipments').select(`*, milestones (type, at, note)`)
            .eq('client_id', client.id)
            .neq('status', 'delivered')
            .neq('status', 'cancelled')
            .neq('status', 'CANCELLED')
            .neq('status', 'AT_DESTINATION')
            .order('created_at', { ascending: false }).limit(6),
          
          supabase.from('quotes').select('total, totals, boxes, status')
            .eq('client_id', client.id)
            .neq('status', 'draft')     // Estadísticas sin borradores
            .neq('status', 'archived')  // Estadísticas sin archivados
        ]);

        const allQuotes = allQuotesStats.data || [];
        const approvedQuotes = allQuotes.filter(q => q.status === 'approved');
        const pendingToReview = allQuotes.filter(q => q.status === 'sent').length;

        setData({
          stats: {
            totalBoxes: approvedQuotes.reduce((acc, q) => acc + (Number(q.boxes) || 0), 0),
            pendingQuotes: allQuotes.filter(q => q.status === 'sent' || q.status === 'Solicitud').length,
            totalInvestment: approvedQuotes.reduce((acc, q) => acc + (Number(q.totals?.total) || Number(q.total) || 0), 0),
            newToReview: pendingToReview
          },
          recentQuotes: quotesRes.data || [],
          activeShipments: shipmentsRes.data || []
        });
      }
    } catch (e) { console.error("Sync Error:", e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  const handleCloseModal = () => {
    setIsQuoteModalOpen(false);
    setTimeout(() => { fetchDashboardData(true); }, 100);
  };

  const getCurrentStepIndex = (milestones: any[], flightStatus?: string) => {
    if (!milestones || milestones.length === 0) return 0;
    const types = new Set(milestones.map((m) => String(m.type).toUpperCase()));
    let idx = 0;
    for (let i = 0; i < STEPS.length; i++) { if (types.has(String(STEPS[i].type).toUpperCase())) idx = i; }
    if (flightStatus?.toLowerCase() === 'landed') return STEPS.length - 1;
    return idx;
  };

  const formatCurrency = (val: number | null) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val || 0);
  };

  if (loading) return (
    <ClientLayout title={lang === 'es' ? "Panel de Control" : "Dashboard"}>
      <div className="ff-loading-full">
        <div className="ff-loader-ring"></div>
        <p className="ff-sync-text">{lang === 'es' ? 'Sincronizando sus datos...' : 'Syncing your data...'}</p>
      </div>
    </ClientLayout>
  );

  return (
    <ClientLayout title={lang === 'es' ? "Panel de Control" : "Dashboard"} subtitle={lang === 'es' ? "Resumen de Operaciones Activas" : "Active Operations Overview"}>
      <div className="ff-dashboard-v2">
        
        {/* TOP BAR: PERFIL COMPACTO Y ACCIONES */}
        <div className="ff-top-bar">
          
          <div className="ff-client-badge">
            <div className="c-avatar">
              {clientProfile?.logo ? <img src={clientProfile.logo} alt="Logo" /> : <span>{clientProfile?.initial}</span>}
            </div>
            <div className="c-info">
              <span className="c-greeting">{lang === 'es' ? 'Bienvenido,' : 'Welcome back,'}</span>
              <span className="c-name">{clientProfile?.name}</span>
            </div>
            <div className="c-tags">
              <span className="c-tag" title="System ID"><Hash size={10}/> {clientProfile?.systemId}</span>
              <span className="c-tag" title="Tax ID"><Building2 size={10}/> {clientProfile?.taxId}</span>
            </div>
          </div>

          <div className="ff-alert-hubs">
            {/* Alerta de Cotizaciones (Pill) */}
            <div className={`alert-pill ${data.stats.newToReview > 0 ? 'pulse-orange' : ''}`} onClick={() => navigate('/clients/quotes?filter=pending')}>
              {data.stats.newToReview > 0 && <span className="dot-pulse orange" />}
              <AlertCircle size={14} />
              <span>{data.stats.newToReview} {lang === 'es' ? 'Por revisar' : 'To review'}</span>
            </div>

            {/* Asistencia 24/7 Compacta */}
            <div className="alert-pill support" onClick={() => window.open('https://wa.me/50762256452')}>
              <Headset size={14} />
              <span>{lang === 'es' ? 'Soporte 24/7' : '24/7 Support'}</span>
            </div>

            <button className="btn-create main" onClick={() => setIsQuoteModalOpen(true)}>
              <Plus size={14} /> {lang === 'es' ? 'Nueva Solicitud' : 'New Request'}
            </button>
          </div>
        </div>

        {/* HERO: MÉTRICAS REDISEÑADAS */}
        <div className="ff-hero-metrics">
          <div className="metric-card">
            <span className="m-label"><TrendingUp size={14}/> {lang === 'es' ? 'Inversión Histórica' : 'Total Investment'}</span>
            <span className="m-value">{formatCurrency(data.stats.totalInvestment)}</span>
          </div>
          <div className="metric-card">
            <span className="m-label"><Package size={14}/> {lang === 'es' ? 'Volumen Recibido' : 'Volume Received'}</span>
            <span className="m-value">{data.stats.totalBoxes.toLocaleString()} <span className="m-sub">{lang === 'es' ? 'Cajas' : 'Boxes'}</span></span>
          </div>
          <div className="metric-card">
            <span className="m-label"><Ship size={14}/> {lang === 'es' ? 'Logística en Curso' : 'Active Logistics'}</span>
            <div className="m-value-flex">
              <span className="m-value-small">{data.activeShipments.length}</span>
              <span className="m-sub">{lang === 'es' ? 'Embarques Activos' : 'Active Shipments'}</span>
            </div>
          </div>
        </div>

        {/* TABLAS PRINCIPALES */}
        <div className="ff-main-grid">
          
          {/* TRÁNSITOS ACTIVOS */}
          <section className="ff-panel">
            <div className="section-header">
              <h3 className="live-header">
                <Ship size={16} color="#0f766e"/> {lang === 'es' ? 'Tránsitos Activos' : 'Active Transits'}
                {data.activeShipments.length > 0 && <span className="live-ping" title="En Vivo"></span>}
              </h3>
              {data.activeShipments.length > 0 && <button onClick={() => navigate('/clients/shipments')}>{lang === 'es' ? 'Ver todos' : 'View all'}</button>}
            </div>
            
            <div className="ff-table-list">
              {data.activeShipments.length > 0 ? data.activeShipments.map(s => {
                const currentIdx = getCurrentStepIndex(s.milestones, s.flight_status);
                const progressPct = (currentIdx / (STEPS.length - 1)) * 100;
                
                return (
                  <div key={s.id} className="ff-list-row ship" onClick={() => navigate(`/clients/shipments/${s.id}`)}>
                    <div className="col-code">
                      <TransportIcon mode={s.product_mode || 'AIR'} />
                      <span className="code-text">{s.code}</span>
                    </div>
                    <div className="col-dest">{s.destination}</div>
                    
                    <div className="col-stepper-mini">
                      <div className="stepper-track">
                        <div className="stepper-fill" style={{ width: `${progressPct}%` }}></div>
                      </div>
                      <span className="stepper-lbl">{STEPS[currentIdx].label}</span>
                    </div>

                    <ChevronRight size={16} className="row-arrow" />
                  </div>
                );
              }) : (
                <div className="ff-empty-state">
                  <div className="empty-icon"><Ship size={24} /></div>
                  <p>{lang === 'es' ? 'No hay operaciones logísticas en curso.' : 'No active shipments.'}</p>
                </div>
              )}
            </div>
          </section>

          {/* COTIZACIONES PENDIENTES / RECIENTES */}
          <section className="ff-panel">
            <div className="section-header">
              <h3><FileText size={16} color="#0f766e"/> {lang === 'es' ? 'Gestiones Recientes' : 'Recent Quotes'}</h3>
              {data.recentQuotes.length > 0 && <button onClick={() => navigate('/clients/quotes')}>{lang === 'es' ? 'Ver historial' : 'View history'}</button>}
            </div>
            
            <div className="ff-table-list">
              {data.recentQuotes.length > 0 ? data.recentQuotes.map(q => {
                const statusConfig = getStatusConfig(q.status, 'quote', lang as 'es' | 'en');
                const quoteTotal = q.totals?.total || q.total || 0;
                
                return (
                  <div key={q.id} className={`ff-list-row quote ${q.status === 'sent' ? 'urgent' : ''}`} onClick={() => navigate(`/clients/quotes/${q.id}`)}>
                    <div className="col-code">
                      <div className="row-icon-box"><FileText size={14} className="row-icon" /></div>
                      <span className="code-text">{q.quote_number || 'SOLICITUD'}</span>
                    </div>
                    <div className="col-dest">{q.destination}</div>
                    
                    <div className="col-amount">{formatCurrency(quoteTotal)}</div>
                    
                    <div className="col-status">
                      <span className={`status-badge ${statusConfig.class}`}>{statusConfig.label}</span>
                    </div>
                    <ChevronRight size={16} className="row-arrow" />
                  </div>
                );
              }) : (
                <div className="ff-empty-state">
                  <div className="empty-icon"><Inbox size={24} /></div>
                  <p>{lang === 'es' ? 'No hay cotizaciones pendientes.' : 'No pending quotes.'}</p>
                </div>
              )}
            </div>
          </section>

        </div>

        <CustomerQuoteModal isOpen={isQuoteModalOpen} onClose={handleCloseModal} />
        
        {/* CSS PULIDO Y MEJORADO */}
        <style dangerouslySetInnerHTML={{__html: `
          .ff-dashboard-v2 { display: flex; flex-direction: column; gap: 24px; padding-bottom: 40px; font-family: 'Inter', 'Poppins', sans-serif !important; }
          
          /* TOP BAR */
          .ff-top-bar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;}
          
          .ff-client-badge { display: flex; align-items: center; gap: 12px; background: white; padding: 6px 16px 6px 6px; border-radius: 999px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.04);}
          .c-avatar { width: 36px; height: 36px; background: #f8fafc; border-radius: 50%; display: grid; place-items: center; font-size: 14px; font-weight: 800; color: var(--ff-green-dark); overflow: hidden; border: 1px solid #e2e8f0;}
          .c-avatar img { width: 100%; height: 100%; object-fit: contain; padding: 2px;}
          .c-info { display: flex; flex-direction: column; }
          .c-greeting { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; line-height: 1;}
          .c-name { font-size: 13px; font-weight: 800; color: var(--ff-green-dark); line-height: 1.2; margin-top: 2px;}
          .c-tags { display: flex; gap: 6px; margin-left: 8px; border-left: 1px solid #e2e8f0; padding-left: 12px;}
          .c-tag { font-size: 10px; font-weight: 600; color: #64748b; font-family: 'JetBrains Mono', monospace; display: flex; align-items: center; gap: 4px; background: #f8fafc; padding: 4px 8px; border-radius: 6px;}

          .ff-alert-hubs { display: flex; gap: 10px; align-items: center;}
          .alert-pill { position: relative; background: white; border: 1px solid #e2e8f0; padding: 8px 16px; border-radius: 10px; display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px; font-weight: 700; color: var(--ff-green-dark); transition: all 0.2s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.02);}
          .alert-pill:hover { border-color: #cbd5e1; box-shadow: 0 4px 12px rgba(0,0,0,0.05); transform: translateY(-1px);}
          .alert-pill.support { border-color: #bbf7d0; color: #047857; background: #f0fdf4; }
          .alert-pill.support:hover { border-color: #34d399; }

          .dot-pulse { position: absolute; top: -4px; right: -4px; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; }
          .dot-pulse.orange { background: var(--ff-orange); animation: pulse-orange 1.5s infinite; }
          @keyframes pulse-orange { 0% { box-shadow: 0 0 0 0 rgba(209, 119, 17, 0.7); } 100% { box-shadow: 0 0 0 6px rgba(209, 119, 17, 0); } }

          .btn-create { display: flex; align-items: center; gap: 8px; padding: 10px 18px; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; }
          .btn-create.main { background: var(--ff-green-dark); color: white; border: none; box-shadow: 0 2px 8px rgba(34, 76, 34, 0.25); }
          .btn-create.main:hover { background: #16361a; box-shadow: 0 4px 12px rgba(34, 76, 34, 0.35); transform: translateY(-1px); }

          /* HERO METRICS REDISEÑO */
          .ff-hero-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
          .metric-card { background: white; padding: 22px; border-radius: 16px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; justify-content: center; gap: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); transition: all 0.2s ease; }
          .metric-card:hover { transform: translateY(-2px); box-shadow: 0 8px 16px rgba(0,0,0,0.06); border-color: #cbd5e1; }
          
          .m-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px; }
          .m-value { font-size: 28px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; line-height: 1;}
          .m-value-flex { display: flex; align-items: baseline; gap: 6px; }
          .m-value-small { font-size: 28px; font-weight: 800; color: #0f172a; line-height: 1;}
          .m-sub { font-size: 13px; font-weight: 600; color: #94a3b8; letter-spacing: 0; }

          /* TABLAS Y PANELES */
          .ff-main-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
          .ff-panel { background: white; border-radius: 16px; border: 1px solid #e2e8f0; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
          .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
          .section-header h3 { font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase; display: flex; align-items: center; gap: 8px; margin: 0; letter-spacing: 0.5px;}
          .section-header button { font-size: 12px; font-weight: 700; color: #0f766e; background: none; border: none; cursor: pointer; transition: 0.2s; padding: 4px 8px; border-radius: 6px;}
          .section-header button:hover { background: #f0fdfa; }
          
          .live-header { position: relative; }
          .live-ping { display: inline-block; width: 8px; height: 8px; background: #10b981; border-radius: 50%; margin-left: 6px; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; }
          @keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }

          .ff-table-list { display: flex; flex-direction: column; gap: 10px; }
          .ff-list-row { display: flex; align-items: center; padding: 12px 16px; background: #fff; border: 1px solid #f1f5f9; border-radius: 12px; cursor: pointer; transition: all 0.2s ease; gap: 12px; }
          .ff-list-row:hover { border-color: #cbd5e1; background: #f8fafc; transform: translateY(-1px); box-shadow: 0 4px 10px rgba(0,0,0,0.04); }
          .ff-list-row.urgent { background: #fffbeb; border-color: #fde68a; }
          .ff-list-row.urgent:hover { border-color: #f59e0b; box-shadow: 0 4px 10px rgba(245,158,11,0.1); }
          
          .col-code { min-width: 120px; display: flex; align-items: center; gap: 10px; }
          .code-text { font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 700; color: #1e293b; }
          
          .row-icon-box { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0; }
          .row-icon-box.air { background: #e0f2fe; color: #0284c7; }
          .row-icon-box.sea { background: #f1f5f9; color: #475569; }
          .row-icon { opacity: 0.6; }
          
          .col-dest { flex: 1; font-size: 13px; font-weight: 600; color: #475569; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .col-amount { font-size: 14px; font-weight: 800; color: #0f172a; min-width: 90px; text-align: right; font-variant-numeric: tabular-nums; }
          .col-status { min-width: 110px; display: flex; justify-content: flex-end; }
          
          /* Mini Stepper */
          .col-stepper-mini { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; min-width: 110px; }
          .stepper-track { width: 100%; height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden; }
          .stepper-fill { height: 100%; background: #10b981; border-radius: 3px; transition: width 1s ease; }
          .stepper-lbl { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;}

          .status-badge { font-size: 9.5px; font-weight: 800; padding: 4px 10px; border-radius: 6px; letter-spacing: 0.5px; }
          .bg-slate-100 { background: #f1f5f9; } .text-slate-600 { color: #475569; }
          .bg-amber-100 { background: #fef3c7; } .text-amber-700 { color: #b45309; }
          .bg-blue-100 { background: #dbeafe; } .text-blue-700 { color: #1d4ed8; }
          .bg-purple-100 { background: #f3e8ff; } .text-purple-700 { color: #7e22ce; }
          .bg-emerald-100 { background: #d1fae5; } .text-emerald-700 { color: #047857; }
          .bg-sky-100 { background: #e0f2fe; } .text-sky-700 { color: #0369a1; }
          .bg-orange-100 { background: #ffedd5; } .text-orange-700 { color: #c2410c; } .border-orange { border: 1px solid #fed7aa; }
          .bg-rose-100 { background: #ffe4e6; } .text-rose-700 { color: #be123c; }
          
          .row-arrow { color: #94a3b8; transition: 0.2s; margin-left: 4px;}
          .ff-list-row:hover .row-arrow { color: #0f172a; transform: translateX(3px); }
          
          /* EMPTY STATES ELEGANTES */
          .ff-empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; background: #f8fafc; border-radius: 12px; border: 1px dashed #cbd5e1; gap: 12px;}
          .empty-icon { width: 48px; height: 48px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
          .ff-empty-state p { margin: 0; font-size: 13px; font-weight: 600; color: #64748b; }

          /* LOADING */
          .ff-loading-full { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 400px; }
          .ff-loader-ring { width: 40px; height: 40px; border: 3px solid #f1f5f9; border-top-color: #10b981; border-radius: 50%; animation: spin 1s linear infinite; }
          .ff-sync-text { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-top: 16px; }
          @keyframes spin { to { transform: rotate(360deg); } }
          
          @media (max-width: 1024px) {
            .ff-hero-metrics { grid-template-columns: 1fr; }
            .ff-main-grid { grid-template-columns: 1fr; }
            .ff-top-bar { flex-direction: column; align-items: flex-start; gap: 15px;}
            .ff-alert-hubs { width: 100%; justify-content: space-between; overflow-x: auto; padding-bottom: 5px;}
          }

          /* --- RESPONSIVE MOBILE & TABLET --- */
          @media (max-width: 1024px) {
            .ff-hero-metrics { grid-template-columns: 1fr; }
            .ff-main-grid { grid-template-columns: 1fr; }
            .ff-top-bar { flex-direction: column; align-items: flex-start; gap: 15px;}
            .ff-alert-hubs { width: 100%; justify-content: space-between; overflow-x: auto; padding-bottom: 5px;}
          }
          
          @media (max-width: 768px) {
            .ff-container { padding: 15px; }
            .ff-client-badge { width: 100%; justify-content: space-between; }
            .c-tags { display: none; /* Ocultamos tags en mobile para limpiar vista */ }
            .ff-alert-hubs { flex-direction: column; align-items: stretch; width: 100%; }
            .btn-create, .alert-pill { justify-content: center; width: 100%; }
            
            /* Tablas a Tarjetas en Mobile */
            .ff-list-row { flex-wrap: wrap; gap: 10px; padding: 15px; }
            .col-code { width: 100%; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; justify-content: space-between; }
            .col-dest { width: 100%; font-size: 12px; margin-top: 5px; }
            .col-amount, .col-status { flex: 1; align-items: flex-start; text-align: left; }
            .col-stepper-mini { min-width: 100%; margin-top: 10px; align-items: flex-start; }
            .row-arrow { display: none; }
          }
            
        `}} />
      </div>
    </ClientLayout>
  );
}