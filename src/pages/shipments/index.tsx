import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom"; // Cambiado para Vite
import { Search, Calendar, Package, MapPin, RefreshCcw, Plane, ArrowRight, Plus, Layers } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { getApiBase } from "../../lib/apiBase";
import { labelStatus, statusBadgeClass } from "../../lib/shipmentFlow";
import { ClientLayout } from "../../components/ClientLayout";

type Shipment = {
  id: string;
  code: string;
  status: string;
  created_at: string;
  destination: string;
  product_name: string;
  product_variety: string;
  pallets: number;
  boxes: number;
  awb: string;
  flight_number: string;
  client_name?: string;
  last_event_at?: string;
  clients?: {
    id: string;
    name: string;
    legal_name: string;
    logo_url?: string | null;
    tax_id?: string | null;
    billing_address?: string | null;
    phone?: string | null;
    website?: string | null;
    country?: string | null;
  }; 
};

export default function ShipmentsPage() {
  const [items, setItems] = useState<Shipment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [destFilter, setDestFilter] = useState("");

  const ProductIcon = ({ name }: { name: string }) => {
    const n = name?.toLowerCase() || "";
    let iconColor = "#64748b"; 
    let bgColorClass = "bg-slate";

    if (n.includes("piña")) {
      iconColor = "#ca8a04"; 
      bgColorClass = "bg-yellow";
    } else if (n.includes("aguacate") || n.includes("avocado")) {
      iconColor = "#16a34a";
      bgColorClass = "bg-green";
    } else if (n.includes("papaya")) {
      iconColor = "#ea580c";
      bgColorClass = "bg-orange";
    }

    return (
      <div className={`md-prod-icon-wrapper ${bgColorClass}`}>
        <Package size={22} color={iconColor} strokeWidth={2.5} />
      </div>
    );
  };

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return;

      const params = new URLSearchParams({
        page: "1",
        pageSize: "40",
        q: search,
        destination: destFilter
      });

      const res = await fetch(`${getApiBase()}/.netlify/functions/listShipments?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
      const json = await res.json();
      setItems(json.items || []);
      setTotal(json.total || 0);
    } catch (e) {
      console.error("Error fetching shipments:", e);
    } finally {
      setLoading(false);
    }
  }, [search, destFilter]);

  useEffect(() => { fetchShipments(); }, [fetchShipments]);

  return (
    <ClientLayout title="Panel de Logística" wide>
      <div className="ff-page-wrapper">
        <header className="ff-header-premium">
          <div className="ff-client-profile">
            <div className="ff-logo-wrapper">
              {items[0]?.clients?.logo_url ? (
                <img 
                  src={`https://oqgkbduqztrpfhfclker.supabase.co/storage/v1/object/public/client-logos/${items[0].clients.logo_url}`} 
                  alt="Logo" 
                  className="ff-logo-img"
                  style={{ width: '64px', height: '64px' }}
                />
              ) : (
                <div className="ff-logo-placeholder">
                  {items[0]?.clients?.name?.charAt(0) || 'C'}
                </div>
              )}
            </div>
            
            <div className="ff-client-info">
              <h1 className="ff-client-name-display">
                {items[0]?.clients?.legal_name || items[0]?.clients?.name || 'Panel de Control'}
              </h1>
              
              <div className="ff-client-meta-stack">
                <div className="ff-meta-row">
                  <span className="ff-meta-label">TAX ID:</span>
                  <span className="ff-meta-value">{items[0]?.clients?.tax_id || '—'}</span>
                </div>
                <div className="ff-meta-row">
                  <span className="ff-meta-value">{items[0]?.clients?.billing_address || '—'}</span>
                </div>
                <div className="ff-meta-row ff-secondary-meta">
                  <span className="ff-meta-value">T: {items[0]?.clients?.phone || '—'}</span>
                  {items[0]?.clients?.website && (
                    <>
                      <span className="ff-meta-divider">|</span>
                      <span className="ff-meta-value ff-website-link">{items[0].clients.website}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="ff-header-actions">
            <button 
              className="ff-btn-quote-minimal"
              onClick={() => window.open(`https://wa.me/34932620121?text=Hola, deseo solicitar una nueva cotización.`, '_blank')}
            >
              <Plus size={14} />
              <span>SOLICITAR COTIZACIÓN</span>
            </button>
          </div>
        </header>

        <div className="md-toolbar">
          <div className="md-search-box">
            <Search size={18} className="md-icon-muted" />
            <input 
              placeholder="Buscar por código, AWB o producto..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchShipments()}
            />
          </div>
          
          <div className="md-filters">
            <div className="md-select-group">
              <MapPin size={16} className="md-icon-muted" />
              <select value={destFilter} onChange={(e) => setDestFilter(e.target.value)}>
                <option value="">Todos los Destinos</option>
                <option value="MAD">Madrid (MAD)</option>
                <option value="AMS">Amsterdam (AMS)</option>
                <option value="MIA">Miami (MIA)</option>
              </select>
            </div>
            <button className="md-btn-refresh" onClick={fetchShipments} disabled={loading}>
              <RefreshCcw size={16} className={loading ? "spin" : ""} />
            </button>
          </div>
        </div>

        <div className="md-grid">
          {loading ? (
            <div className="md-loading-state">Sincronizando flota...</div>
          ) : (
            items.map((s) => (
              <Link key={s.id} to={`/shipments/${s.id}`} className="md-card-link">
                <div className="md-card">
                  <div className="md-col-info">
                    <ProductIcon name={s.product_name} /> 
                    <div>
                      <h2 className="md-ship-code">{s.code}</h2>
                      <p className="md-product-sub">
                        {s.product_name} <span className="md-variety-dot">•</span> {s.product_variety}
                      </p>
                    </div>
                  </div>

                  <div className="md-col-logistics">
                    <div className="md-route">
                      <span className="md-badge-city">PTY</span>
                      <ArrowRight size={14} className="md-arrow" />
                      <span className="md-badge-city active">{s.destination || "TBD"}</span>
                    </div>
                    <div className="md-cargo-details">
                      <Layers size={12} />
                      <span>{s.pallets || 0} Pallets • {s.boxes || 0} Cajas</span>
                    </div>
                  </div>

                  <div className="md-col-flight">
                    <div className="md-flight-row">
                      <Plane size={14} />
                      <span>{s.flight_number || "— — —"}</span>
                    </div>
                    <div className="md-date-row">
                      <Calendar size={14} />
                      <span>{new Date(s.created_at).toLocaleDateString('es-PA', { day:'2-digit', month:'short' }).toUpperCase()}</span>
                    </div>
                  </div>

                  <div className="md-col-status">
                    <span className={`md-status-pill ${statusBadgeClass(s.status)}`}>
                      {labelStatus(s.status)}
                    </span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

    <style dangerouslySetInnerHTML={{ __html: `
  /* RESET Y BASE */
  .ff-page-wrapper { max-width: 1200px; margin: 0 auto; padding: 20px; font-family: 'Inter', sans-serif; }
  
  /* HEADER PREMIUM */
  .ff-header-premium {
    background: white;
    padding: 32px;
    border-radius: 24px;
    border: 1px solid #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 30px;
    margin-bottom: 32px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  }
  .ff-client-profile { display: flex; align-items: center; gap: 24px; }
  .ff-logo-wrapper { 
    width: 64px; height: 64px; background: #f8fafc; border-radius: 16px; 
    display: flex; align-items: center; justify-content: center; border: 1px solid #e2e8f0;
    overflow: hidden;
  }
  .ff-logo-img { width: 100%; height: 100%; object-fit: contain; }
  .ff-client-name-display { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0; letter-spacing: -0.02em; }
  .ff-client-meta-stack { display: flex; flex-direction: column; gap: 2px; }
  .ff-meta-row { font-size: 13px; color: #64748b; font-weight: 500; }
  .ff-meta-label { font-weight: 700; color: #94a3b8; font-size: 11px; margin-right: 6px; }
  
  .ff-btn-quote-minimal {
    border: 2px solid #f59e0b; color: #d97706;
    padding: 10px 24px; border-radius: 12px; font-size: 12px; font-weight: 700;
    display: flex; align-items: center; gap: 8px; cursor: pointer; background: #fffbeb;
    transition: all 0.2s;
  }
  .ff-btn-quote-minimal:hover { background: #fef3c7; transform: translateY(-1px); }

  /* TOOLBAR */
  .md-toolbar { display: flex; gap: 16px; margin-bottom: 24px; }
  .md-search-box { 
    flex: 1; background: white; border: 1px solid #e2e8f0; border-radius: 16px; 
    display: flex; align-items: center; padding: 0 20px; gap: 12px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  }
  .md-search-box input { border: none; outline: none; width: 100%; height: 56px; font-size: 15px; background: transparent; }
  .md-filters { display: flex; gap: 12px; }
  .md-select-group { 
    background: white; border: 1px solid #e2e8f0; border-radius: 16px; 
    display: flex; align-items: center; padding: 0 16px; 
  }
  .md-select-group select { border: none; outline: none; height: 56px; font-weight: 600; color: #475569; background: transparent; cursor: pointer; }
  .md-btn-refresh { 
    width: 56px; height: 56px; border-radius: 16px; border: 1px solid #e2e8f0; 
    background: white; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #64748b;
  }

  /* GRID DE TARJETAS */
  .md-grid { display: flex; flex-direction: column; gap: 12px; }
  .md-card-link { text-decoration: none; display: block; }
  .md-card { 
    background: white; border: 1px solid #e2e8f0; border-radius: 20px; 
    display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; 
    align-items: center; padding: 20px 32px; transition: all 0.2s ease;
  }
  .md-card-link:hover .md-card { 
    border-color: #3b82f6; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); 
    transform: translateX(4px);
  }

  /* COLUMNAS ESPECÍFICAS */
  .md-col-info { display: flex; align-items: center; gap: 20px; }
  .md-ship-code { font-size: 18px; font-weight: 800; color: #1e293b; margin: 0; }
  .md-product-sub { font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; margin: 2px 0 0 0; }
  .md-variety-dot { color: #cbd5e1; margin: 0 4px; }

  .md-prod-icon-wrapper { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; }
  .bg-yellow { background-color: #fefce8; border: 1px solid #fef9c3; }
  .bg-green  { background-color: #f0fdf4; border: 1px solid #dcfce7; }
  .bg-orange { background-color: #fff7ed; border: 1px solid #ffedd5; }
  .bg-slate  { background-color: #f8fafc; border: 1px solid #f1f5f9; }

  .md-route { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .md-badge-city { font-size: 10px; font-weight: 800; color: #64748b; background: #f1f5f9; padding: 3px 10px; border-radius: 6px; }
  .md-badge-city.active { color: #2563eb; background: #eff6ff; }
  .md-arrow { color: #cbd5e1; }
  .md-cargo-details { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #94a3b8; font-weight: 600; }

  .md-flight-row, .md-date-row { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: #475569; }
  .md-date-row { margin-top: 4px; color: #94a3b8; font-size: 11px; }

  /* ESTADOS (Pills) */
  .md-status-pill { 
    display: inline-block; padding: 8px 16px; border-radius: 12px; 
    font-size: 11px; font-weight: 800; text-transform: uppercase; text-align: center; width: fit-content;
  }
  .status-draft { background: #f1f5f9; color: #64748b; }
  .status-confirmed { background: #e0f2fe; color: #0369a1; }
  .status-in_transit { background: #fef9c3; color: #a16207; }
  .status-delivered { background: #dcfce7; color: #15803d; }

  .md-loading-state { padding: 100px; text-align: center; color: #94a3b8; font-weight: 600; font-size: 15px; }
  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

  @media (max-width: 1024px) {
    .md-card { grid-template-columns: 1.5fr 1fr; gap: 20px; }
    .md-col-flight, .md-col-status { display: none; }
  }
` }} />
    </ClientLayout>
  );
}