import React, { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, MessageSquare, Ship, ChevronRight,
  Plus, Package, Hash, Building2, FileText, Plane, CheckCircle2, AlertCircle,
  Headset
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
      case 'solicitud': return { label: lang === 'es' ? 'NUEVA SOLICITUD' : 'NEW REQUEST', class: 'bg-orange-100 text-orange-700 border-orange' };
      case 'sent': return { label: lang === 'es' ? 'REVISIÓN' : 'REVIEW', class: 'bg-sky-100 text-sky-700' };
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

        // FIX ARQUITECTURA: Ahora extraemos totals (JSON) y filtramos borradores
        const [quotesRes, shipmentsRes, allQuotesStats] = await Promise.all([
          supabase.from('quotes').select('*').eq('client_id', client.id).neq('status', 'draft').order('created_at', { ascending: false }).limit(6),
          supabase.from('shipments').select(`*, milestones (type, at, note)`).eq('client_id', client.id).not('status', 'in', '("delivered", "cancelled", "AT_DESTINATION")').order('created_at', { ascending: false }).limit(6),
          supabase.from('quotes').select('total, totals, boxes, status').eq('client_id', client.id).neq('status', 'draft')
        ]);

        const allQuotes = allQuotesStats.data || [];
        const approvedQuotes = allQuotes.filter(q => q.status === 'approved');
        const pendingToReview = allQuotes.filter(q => q.status === 'sent').length;

        setData({
          stats: {
            totalBoxes: approvedQuotes.reduce((acc, q) => acc + (Number(q.boxes) || 0), 0),
            pendingQuotes: allQuotes.filter(q => q.status === 'sent' || q.status === 'Solicitud').length,
            // FIX ARQUITECTURA: Extraemos el valor seguro de totals.total
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
              <span className="c-tag"><Hash size={10}/> {clientProfile?.systemId}</span>
              <span className="c-tag"><Building2 size={10}/> {clientProfile?.taxId}</span>
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

        {/* HERO: MÉTRICAS COMPACTAS */}
        <div className="ff-hero-metrics">
          <div className="metric-card highlight">
            <span className="m-label"><TrendingUp size={12}/> {lang === 'es' ? 'Inversión Histórica' : 'Total Investment'}</span>
            <span className="m-value">{formatCurrency(data.stats.totalInvestment)}</span>
          </div>
          <div className="metric-card neutral">
            <span className="m-label"><Package size={12}/> {lang === 'es' ? 'Volumen Recibido' : 'Volume Received'}</span>
            <span className="m-value">{data.stats.totalBoxes.toLocaleString()} <span className="m-sub">{lang === 'es' ? 'Cajas' : 'Boxes'}</span></span>
          </div>
          <div className="metric-card success">
            <span className="m-label"><Ship size={12}/> {lang === 'es' ? 'Logística en Curso' : 'Active Logistics'}</span>
            <span className="m-value-small">{data.activeShipments.length} {lang === 'es' ? 'Embarques' : 'Shipments'}</span>
          </div>
        </div>

        {/* TABLAS PRINCIPALES */}
        <div className="ff-main-grid">
          
          {/* TRÁNSITOS ACTIVOS */}
          <section className="ff-panel">
            <div className="section-header">
              <h3 className="live-header">
                <Ship size={14}/> {lang === 'es' ? 'Tránsitos Activos' : 'Active Transits'}
                {data.activeShipments.length > 0 && <span className="live-ping" title="En Vivo"></span>}
              </h3>
              <button onClick={() => navigate('/clients/shipments')}>{lang === 'es' ? 'Ver todos' : 'View all'}</button>
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
                    
                    {/* Stepper Lineal Compacto */}
                    <div className="col-stepper-mini">
                      <div className="stepper-track">
                        <div className="stepper-fill" style={{ width: `${progressPct}%` }}></div>
                      </div>
                      <span className="stepper-lbl">{STEPS[currentIdx].label}</span>
                    </div>

                    <ChevronRight size={14} className="row-arrow" />
                  </div>
                );
              }) : (
                <div className="ff-empty-state">{lang === 'es' ? 'No hay embarques en tránsito.' : 'No active shipments.'}</div>
              )}
            </div>
          </section>

          {/* COTIZACIONES PENDIENTES / RECIENTES */}
          <section className="ff-panel">
            <div className="section-header">
              <h3><FileText size={14}/> {lang === 'es' ? 'Gestiones Recientes' : 'Recent Quotes'}</h3>
              <button onClick={() => navigate('/clients/quotes')}>{lang === 'es' ? 'Historial' : 'History'}</button>
            </div>
            
            <div className="ff-table-list">
              {data.recentQuotes.length > 0 ? data.recentQuotes.map(q => {
                const statusConfig = getStatusConfig(q.status, 'quote', lang as 'es' | 'en');
                // FIX ARQUITECTURA: Extraemos el valor del JSON totals?.total
                const quoteTotal = q.totals?.total || q.total || 0;
                
                return (
                  <div key={q.id} className={`ff-list-row quote ${q.status === 'sent' ? 'urgent' : ''}`} onClick={() => navigate(`/clients/quotes/${q.id}`)}>
                    <div className="col-code">
                      <div className="row-icon-box"><FileText size={14} className="row-icon" /></div>
                      <span className="code-text">{q.quote_number || 'NUEVA'}</span>
                    </div>
                    <div className="col-dest">{q.destination}</div>
                    
                    {/* Renderizamos el total corregido */}
                    <div className="col-amount">{formatCurrency(quoteTotal)}</div>
                    
                    <div className="col-status">
                      <span className={`status-badge ${statusConfig.class}`}>{statusConfig.label}</span>
                    </div>
                    <ChevronRight size={14} className="row-arrow" />
                  </div>
                );
              }) : (
                <div className="ff-empty-state">{lang === 'es' ? 'No hay cotizaciones pendientes.' : 'No pending quotes.'}</div>
              )}
            </div>
          </section>

        </div>

        <CustomerQuoteModal isOpen={isQuoteModalOpen} onClose={handleCloseModal} />
        
        {/* CSS COMPACTO Y "SLEEK" */}
        <style>{`
          .ff-dashboard-v2 { display: flex; flex-direction: column; gap: 24px; padding-bottom: 40px; font-family: 'Poppins', sans-serif !important; }
          
          /* TOP BAR & PROFILE COMPACTO */
          .ff-top-bar { display: flex; justify-content: space-between; align-items: center; }
          
          .ff-client-badge { display: flex; align-items: center; gap: 12px; background: white; padding: 8px 16px 8px 8px; border-radius: 999px; border: 1px solid rgba(34,76,34,0.08); box-shadow: 0 2px 10px rgba(0,0,0,0.02);}
          .c-avatar { width: 32px; height: 32px; background: #f8fafc; border-radius: 50%; display: grid; place-items: center; font-size: 14px; font-weight: 800; color: var(--ff-green-dark); overflow: hidden; border: 1px solid #e2e8f0;}
          .c-avatar img { width: 100%; height: 100%; object-fit: contain; padding: 2px;}
          .c-info { display: flex; flex-direction: column; }
          .c-greeting { font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase; line-height: 1;}
          .c-name { font-size: 13px; font-weight: 800; color: var(--ff-green-dark); line-height: 1.2; margin-top: 2px;}
          .c-tags { display: flex; gap: 6px; margin-left: 8px; border-left: 1px solid #e2e8f0; padding-left: 12px;}
          .c-tag { font-size: 10px; font-weight: 600; color: #64748b; font-family: 'JetBrains Mono', monospace; display: flex; align-items: center; gap: 4px; background: #f1f5f9; padding: 2px 8px; border-radius: 4px;}

          .ff-alert-hubs { display: flex; gap: 10px; }
          .alert-pill { position: relative; background: white; border: 1px solid rgba(34, 76, 34, 0.1); padding: 8px 16px; border-radius: 10px; display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px; font-weight: 700; color: var(--ff-green-dark); transition: 0.2s; }
          .alert-pill:hover { border-color: var(--ff-green-dark); box-shadow: 0 4px 12px rgba(34,76,34,0.05); }
          .alert-pill.support { border-color: rgba(16, 185, 129, 0.3); color: #047857; background: #f0fdf4; }
          .alert-pill.support:hover { border-color: #10b981; }

          .dot-pulse { position: absolute; top: -3px; right: -3px; width: 10px; height: 10px; border-radius: 50%; border: 2px solid white; }
          .dot-pulse.orange { background: var(--ff-orange); animation: pulse-orange 1.5s infinite; }
          @keyframes pulse-orange { 0% { box-shadow: 0 0 0 0 rgba(209, 119, 17, 0.7); } 100% { box-shadow: 0 0 0 6px rgba(209, 119, 17, 0); } }

          .btn-create { display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; }
          .btn-create.main { background: var(--ff-green-dark); color: white; border: none; box-shadow: 0 4px 10px rgba(34, 76, 34, 0.2); }
          .btn-create.main:hover { background: #16361a; box-shadow: 0 6px 15px rgba(34, 76, 34, 0.3); transform: translateY(-1px); }

          /* HERO METRICS */
          .ff-hero-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
          .metric-card { background: white; padding: 20px; border-radius: 16px; border: 1px solid rgba(34, 76, 34, 0.08); display: flex; flex-direction: column; gap: 6px; box-shadow: 0 2px 10px rgba(0,0,0,0.02); transition: 0.2s; }
          .metric-card:hover { transform: translateY(-2px); box-shadow: 0 6px 15px rgba(34,76,34,0.04); }
          .metric-card.highlight { border-left: 4px solid var(--ff-orange); }
          .metric-card.success { border-left: 4px solid var(--ff-green); }
          .metric-card.neutral { border-left: 4px solid var(--ff-green-dark); }
          
          .m-label { font-size: 10px; font-weight: 800; color: var(--ff-green-dark); opacity: 0.6; text-transform: uppercase; display: flex; align-items: center; gap: 6px; }
          .m-value { font-size: 24px; font-weight: 800; color: var(--ff-green-dark); letter-spacing: -0.5px; }
          .m-value-small { font-size: 20px; font-weight: 800; color: var(--ff-green-dark); }
          .m-sub { font-size: 14px; font-weight: 600; color: #94a3b8; letter-spacing: 0; }

          /* TABLAS Y PANELES */
          .ff-main-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
          .ff-panel { background: white; border-radius: 20px; border: 1px solid rgba(34,76,34,0.08); padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.02); }
          .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
          .section-header h3 { font-size: 12px; font-weight: 800; color: var(--ff-green-dark); text-transform: uppercase; display: flex; align-items: center; gap: 8px; margin: 0; }
          .section-header button { font-size: 11px; font-weight: 700; color: var(--ff-green); background: none; border: none; cursor: pointer; transition: 0.2s; }
          .section-header button:hover { color: var(--ff-green-dark); }
          
          .live-header { position: relative; }
          .live-ping { display: inline-block; width: 6px; height: 6px; background: var(--ff-green); border-radius: 50%; margin-left: 6px; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; }
          @keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }

          .ff-table-list { display: flex; flex-direction: column; gap: 8px; }
          .ff-list-row { display: flex; align-items: center; padding: 10px 14px; background: #fcfdfc; border: 1px solid rgba(34,76,34,0.05); border-radius: 12px; cursor: pointer; transition: all 0.2s ease; gap: 12px; }
          .ff-list-row:hover { border-color: var(--ff-green); background: white; transform: translateY(-1px); box-shadow: 0 4px 10px rgba(34,76,34,0.04); }
          .ff-list-row.urgent { background: #fffbeb; border-color: #fde68a; }
          .ff-list-row.urgent:hover { border-color: var(--ff-orange); }
          
          .col-code { min-width: 110px; display: flex; align-items: center; gap: 8px; }
          .code-text { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; color: var(--ff-green-dark); }
          
          .row-icon-box { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 6px; flex-shrink: 0; }
          .row-icon-box.air { background: #e0f2fe; color: #0284c7; }
          .row-icon-box.sea { background: #f1f5f9; color: #475569; }
          .row-icon { opacity: 0.4; }
          
          .col-dest { flex: 1; font-size: 12px; font-weight: 600; color: var(--ff-green-dark); opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .col-amount { font-size: 13px; font-weight: 700; color: var(--ff-green-dark); min-width: 80px; text-align: right; font-variant-numeric: tabular-nums; }
          .col-status { min-width: 90px; display: flex; justify-content: flex-end; }
          
          /* Mini Stepper */
          .col-stepper-mini { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; min-width: 100px; }
          .stepper-track { width: 100%; height: 4px; background: #e2e8f0; border-radius: 2px; overflow: hidden; }
          .stepper-fill { height: 100%; background: var(--ff-green); border-radius: 2px; transition: width 1s ease; }
          .stepper-lbl { font-size: 9px; font-weight: 800; color: var(--ff-green-dark); text-transform: uppercase; letter-spacing: 0.5px;}

          .status-badge { font-size: 9px; font-weight: 800; padding: 4px 8px; border-radius: 6px; letter-spacing: 0.5px; }
          .bg-slate-100 { background: #f1f5f9; } .text-slate-600 { color: #475569; }
          .bg-amber-100 { background: #fef3c7; } .text-amber-700 { color: #b45309; }
          .bg-blue-100 { background: #dbeafe; } .text-blue-700 { color: #1d4ed8; }
          .bg-purple-100 { background: #f3e8ff; } .text-purple-700 { color: #7e22ce; }
          .bg-emerald-100 { background: #d1fae5; } .text-emerald-700 { color: #047857; }
          .bg-sky-100 { background: #e0f2fe; } .text-sky-700 { color: #0369a1; }
          .bg-orange-100 { background: #ffedd5; } .text-orange-700 { color: #c2410c; } .border-orange { border: 1px solid #fed7aa; }
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
    </ClientLayout>
  );
}