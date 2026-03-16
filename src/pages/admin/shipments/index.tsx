import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; 
import {
  Search, PlusCircle, ChevronRight, Ship, Plane, 
  Loader2, TrendingUp, LayoutGrid, X, SortAsc, Truck
} from "lucide-react";

import { supabase } from "../../../lib/supabaseClient";
import { getApiBase } from "../../../lib/apiBase";
import { labelStatus } from "../../../lib/shipmentFlow";
import { requireAdminOrRedirect } from "../../../lib/requireAdmin";
import { AdminLayout } from "../../../components/AdminLayout";
// 1. Importamos el nuevo modal premium
import { NewShipmentModal } from "../../../components/shipments/NewShipmentModal";

// --- HELPERS ---
const getFlag = (dest: string) => {
  if (!dest) return "🌐";
  const d = dest.toUpperCase();
  const flags: Record<string, string> = {
    "MADRID": "🇪🇸", "BARCELONA": "🇪🇸", "MAD": "🇪🇸", "BCN": "🇪🇸",
    "MIAMI": "🇺🇸", "MIA": "🇺🇸", "USA": "🇺🇸",
    "AMSTERDAM": "🇳🇱", "AMS": "🇳🇱", "PARIS": "🇫🇷", "BOGOTA": "🇨🇴"
  };
  const found = Object.keys(flags).find(key => d.includes(key));
  return found ? flags[found] : "📍";
};

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("es-PA", { day: '2-digit', month: 'short' });
  } catch { return iso; }
}

function StatusPill({ status }: { status: string }) {
  const label = labelStatus(status);
  const s = status.toUpperCase();
  const isFinal = ["AT_DESTINATION", "DELIVERED", "CLOSED"].includes(s);
  const isTransit = ["IN_TRANSIT", "DEPARTED", "ARRIVED_PTY"].includes(s);
  
  const theme = isFinal 
    ? { bg: "#dcfce7", text: "#166534" } 
    : isTransit 
    ? { bg: "#eff6ff", text: "#1e40af" } 
    : { bg: "#f8fafc", text: "#475569" };

  return <span className="status-pill-modern" style={{ background: theme.bg, color: theme.text }}>{label}</span>;
}

const ShipmentSkeleton = () => (
  <div className="quote-row-item skeleton-row">
    <div className="col-ident">
      <div className="skel-line w50"></div>
      <div className="skel-line w80"></div>
      <div className="skel-pill w40" style={{height: '14px', marginTop: '4px'}}></div>
    </div>
    <div className="col-client"><div className="skel-line w100"></div></div>
    <div className="col-route"><div className="skel-pill"></div></div>
    <div className="col-amount"><div className="skel-line w60"></div></div>
    <div className="col-status"><div className="skel-pill w70"></div></div>
  </div>
);

export default function AdminShipments() {
  const navigate = useNavigate(); 
  const [authOk, setAuthOk] = useState(false);
  const [showModal, setShowModal] = useState(false);
  
  const [items, setItems] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [q, setQ] = useState("");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    requireAdminOrRedirect().then(r => { if (r.ok) setAuthOk(true); });
  }, []);

  const loadBaseData = useCallback(async () => {
    if (items.length === 0) setLoadingList(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const params = new URLSearchParams({ mode: 'admin', q: q.trim(), dir });
      const res = await fetch(`${getApiBase()}/.netlify/functions/listShipments?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      
      if (res.ok) {
        const json = await res.json();
        setItems(json.items || []);
      }
    } finally {
      setLoadingList(false);
    }
  }, [q, dir, items.length]);

  useEffect(() => { if (authOk) loadBaseData(); }, [authOk, loadBaseData]);

  return (
    <AdminLayout title="Logística">
      <div className="quotes-page-wrapper">
        <div className="header-section">
          <div className="title-group">
            <h1>Panel Logístico</h1>
            <p>Administración central de embarques y carga activa.</p>
          </div>
          {/* BOTÓN QUE ACTIVA EL NUEVO MODAL */}
          <button className="btn-main-action" onClick={() => setShowModal(true)}>
            <PlusCircle size={20} strokeWidth={2} /> Nuevo Embarque
          </button>
        </div>

        <div className="stats-dashboard">
          <div className="metric-card">
            <div className="metric-content">
              <span className="metric-label">Total Activos     </span>
              <span className="value">{items.length}</span>
            </div>
            <div className="metric-icon blue"><LayoutGrid size={24} /></div>
          </div>
          <div className="metric-card">
            <div className="metric-content">
              <span className="metric-label">En Tránsito     </span>
              <span className="value">{items.filter(i => i.status?.includes('TRANSIT') || i.status?.includes('DEPARTED')).length}</span>
            </div>
            <div className="metric-icon orange"><Truck size={24} /></div>
          </div>
          <div className="metric-card">
            <div className="metric-content">
              <span className="metric-label">KPI Operativo     </span>
              <span className="value">98%</span>
            </div>
            <div className="metric-icon slate"><TrendingUp size={24} /></div>
          </div>
        </div>

        <div className="filters-bar">
          <div className="search-container">
            <Search size={18} className="search-icon" />
            <input placeholder="Buscar por cliente, destino o # embarque..." value={q} onChange={e => setQ(e.target.value)} />
            {q && <X size={16} className="clear-search" onClick={() => setQ("")} />}
          </div>
          <button className="sort-toggle" onClick={() => setDir(dir === 'asc' ? 'desc' : 'asc')}>
            <SortAsc size={16} /> {dir === 'desc' ? 'Recientes' : 'Antiguos'}
          </button>
        </div>

        <div className="quotes-list-container">
          {loadingList && items.length === 0 ? (
            [...Array(6)].map((_, i) => <ShipmentSkeleton key={i} />)
          ) : (
            items.map((s: any) => (
              <div key={s.id} className="quote-row-item" onClick={() => navigate(`/admin/shipments/${s.id}`)}>
                <div className="col-ident">
                  <span className="id-number">{s.code || 'S/REF'}</span>
                  <span className="product-variety">{s.product_name} {s.product_variety || ''}</span>
                  <span className="badge-boxes">{s.boxes || 0} CAJAS</span>
                </div>
                <div className="col-client"><span className="client-name">{s.client_name || '---'}</span></div>
                <div className="col-route">
                  <div className="route-timeline">
                    <span className="flag">🇵🇦</span>
                    <div className="connector">
                      <div className="line"></div>
                      <div className="mode-icon">{s.product_mode === 'Aérea' ? <Plane size={12} /> : <Ship size={12} />}</div>
                    </div>
                    <span className="flag">{getFlag(s.destination)}</span>
                    <span className="dest-text">{s.destination}</span>
                  </div>
                </div>
                <div className="col-amount"><span className="amount-val"><small>Creación:</small> {fmtDate(s.created_at)}</span></div>
                <div className="col-status"><StatusPill status={s.status} /><ChevronRight size={20} className="entry-chevron" /></div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 2. REEMPLAZO DEL MODAL ANTIGUO POR EL NUEVO PREMIUM */}
      <NewShipmentModal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        onSuccess={() => {
          loadBaseData(); // Recargar lista al crear
          setShowModal(false);
        }}
      />

      <style>{`
        /* Mantengo tus estilos originales de la página index */
        .quotes-page-wrapper { padding: 30px; max-width: 1400px; margin: 0 auto; }
        .header-section { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 35px; }
        .title-group h1 { font-size: 28px; font-weight: 700; color: #0f172a; margin: 0; }
        .title-group p { color: #64748b; font-size: 14px; margin-top: 4px; }
        .btn-main-action { background: #0f172a; color: white; border: none; padding: 12px 24px; border-radius: 12px; font-weight: 600; display: flex; align-items: center; gap: 10px; cursor: pointer; transition: 0.2s; }
        .btn-main-action:hover { background: #1e293b; transform: translateY(-2px); }
        
        .stats-dashboard { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 40px; }
        .metric-card { background: white; padding: 20px; border-radius: 16px; border: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        .metric-label { font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
        .metric-card .value { font-size: 24px; font-weight: 700; color: #0f172a; }
        .metric-icon { width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; }
        .metric-icon.blue { background: #eff6ff; color: #3b82f6; }
        .metric-icon.orange { background: #fff7ed; color: #f97316; }
        .metric-icon.slate { background: #f8fafc; color: #64748b; }

        .filters-bar { display: flex; align-items: center; gap: 16px; margin-bottom: 25px; }
        .search-container { position: relative; flex: 1; }
        .search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
        .search-container input { width: 100%; padding: 10px 16px 10px 42px; border-radius: 12px; border: 1px solid #e2e8f0; background: white; font-size: 14px; outline: none; }
        .sort-toggle { background: white; border: 1px solid #e2e8f0; padding: 8px 14px; border-radius: 10px; display: flex; align-items: center; gap: 8px; font-weight: 600; color: #64748b; cursor: pointer; font-size: 12px; }

        .quotes-list-container { display: flex; flex-direction: column; gap: 10px; min-height: 400px; }
        .quote-row-item { 
          background: white; padding: 14px 24px; border-radius: 16px; border: 1px solid #f1f5f9;
          display: grid; grid-template-columns: 1.2fr 1.5fr 2fr 1fr 1.2fr; align-items: center;
          cursor: pointer; transition: 0.2s ease;
        }
        .quote-row-item:hover { border-color: #cbd5e1; transform: translateX(4px); box-shadow: 0 4px 12px rgba(0,0,0,0.03); }

        .col-ident { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
        .id-number { font-family: monospace; font-size: 11px; font-weight: 700; color: #1e293b; line-height: 1; }
        .product-variety { font-size: 10px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px; line-height: 1.2; }
        .badge-boxes { background: #f0fdf4; color: #16a34a; font-size: 9px; font-weight: 800; padding: 1px 6px; border-radius: 4px; width: fit-content; margin-top: 2px; }

        .client-name { font-size: 14px; font-weight: 600; color: #334155; }
        .route-timeline { display: flex; align-items: center; gap: 8px; background: #f8fafc; padding: 4px 12px; border-radius: 50px; width: fit-content; border: 1px solid #f1f5f9; }
        .route-timeline .connector { display: flex; align-items: center; position: relative; width: 35px; }
        .route-timeline .line { width: 100%; height: 1px; border-top: 2px dotted #e2e8f0; }
        .route-timeline .mode-icon { position: absolute; left: 50%; transform: translateX(-50%); background: #f8fafc; padding: 0 2px; color: #94a3b8; }
        .route-timeline .dest-text { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; }
        .col-amount { text-align: right; padding-right: 20px; }
        .amount-val { font-size: 14px; font-weight: 600; color: #475569; }
        .amount-val small { font-size: 9px; font-weight: 800; color: #94a3b8; margin-right: 4px; }
        .col-status { display: flex; align-items: center; justify-content: flex-end; gap: 12px; }
        .status-pill-modern { padding: 4px 12px; border-radius: 50px; font-size: 10px; font-weight: 800; text-transform: uppercase; }
        .entry-chevron { color: #cbd5e1; }

        .skeleton-row { cursor: default !important; pointer-events: none; border-color: #f8fafc !important; }
        .skel-line { height: 10px; background: #f1f5f9; border-radius: 4px; margin-bottom: 6px; position: relative; overflow: hidden; }
        .skel-pill { height: 24px; background: #f1f5f9; border-radius: 50px; position: relative; overflow: hidden; }
        .skel-line::after, .skel-pill::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent); animation: shimmer 1.6s infinite; }
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        .w40 { width: 40%; } .w50 { width: 50%; } .w60 { width: 60%; } .w70 { width: 70%; } .w80 { width: 80%; } .w100 { width: 100%; }
      `}</style>
    </AdminLayout>
  );
}