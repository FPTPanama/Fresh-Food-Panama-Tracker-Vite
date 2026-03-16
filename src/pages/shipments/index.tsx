import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
  clients?: {
    name: string;
    legal_name: string;
    logo_url?: string | null;
    tax_id?: string | null;
    billing_address?: string | null;
    phone?: string | null;
    website?: string | null;
  }; 
};

export default function ShipmentsPage() {
  const [items, setItems] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [destFilter, setDestFilter] = useState("");

  const ProductIcon = ({ name }: { name: string }) => {
    const n = name?.toLowerCase() || "";
    let iconColor = "var(--ff-green)"; 
    let bgColor = "rgba(35, 77, 35, 0.05)";

    if (n.includes("piña")) { iconColor = "#ca8a04"; bgColor = "#fefce8"; }
    else if (n.includes("papaya")) { iconColor = "var(--ff-orange)"; bgColor = "#fff7ed"; }

    return (
      <div className="md-prod-icon-wrapper" style={{ backgroundColor: bgColor }}>
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

      const params = new URLSearchParams({ page: "1", pageSize: "40", q: search, destination: destFilter });
      const res = await fetch(`${getApiBase()}/.netlify/functions/listShipments?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setItems(json.items || []);
    } catch (e) {
      console.error("Error fetching shipments:", e);
    } finally {
      setLoading(false);
    }
  }, [search, destFilter]);

  useEffect(() => { fetchShipments(); }, [fetchShipments]);

  const client = items[0]?.clients;

  return (
    <ClientLayout title="Panel de Logística" wide>
      <div className="ff-page-wrapper">
        
        {/* HEADER PREMIUM - Sincronizado con tus verdes */}
        <header className="ff-header-premium">
          <div className="ff-client-profile">
            <div className="ff-logo-wrapper">
              {client?.logo_url ? (
                <img 
                  src={`https://oqgkbduqztrpfhfclker.supabase.co/storage/v1/object/public/client-logos/${client.logo_url}`} 
                  alt="Logo" className="ff-logo-img"
                />
              ) : (
                <div className="ff-logo-placeholder">{client?.name?.charAt(0) || 'C'}</div>
              )}
            </div>
            
            <div className="ff-client-info">
              <h1 className="ff-client-name-display">{client?.legal_name || client?.name || 'Mi Cuenta'}</h1>
              <div className="ff-client-meta-stack">
                <div className="ff-meta-row">
                  <span className="ff-meta-label">TAX ID:</span>
                  <span className="ff-meta-value">{client?.tax_id || '—'}</span>
                </div>
                <div className="ff-meta-row">
                  <span className="ff-meta-value">{client?.billing_address || '—'}</span>
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
              <span>NUEVA COTIZACIÓN</span>
            </button>
          </div>
        </header>

        {/* TOOLBAR - Usando variables de globals.css */}
        <div className="md-toolbar">
          <div className="md-search-box">
            <Search size={18} color="var(--ff-muted)" />
            <input 
              placeholder="Buscar envío o producto..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchShipments()}
            />
          </div>
          
          <div className="md-filters">
            <div className="md-select-group">
              <MapPin size={16} color="var(--ff-green)" />
              <select value={destFilter} onChange={(e) => setDestFilter(e.target.value)}>
                <option value="">Destinos</option>
                <option value="MAD">MAD</option>
                <option value="AMS">AMS</option>
              </select>
            </div>
            <button className="md-btn-refresh" onClick={fetchShipments}>
              <RefreshCcw size={16} className={loading ? "spin" : ""} />
            </button>
          </div>
        </div>

        {/* GRID DE TARJETAS - Reparado */}
        <div className="md-grid">
          {loading ? (
            <div className="md-loading-state">Actualizando información...</div>
          ) : (
            items.map((s) => (
              <Link key={s.id} to={`/shipments/${s.id}`} className="md-card-link">
                <div className="md-card ff-card">
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
                      <ArrowRight size={14} color="var(--ff-border)" />
                      <span className="md-badge-city active">{s.destination || "TBD"}</span>
                    </div>
                    <div className="md-cargo-details">
                      <Layers size={12} />
                      <span>{s.pallets || 0} Pallets • {s.boxes || 0} Cajas</span>
                    </div>
                  </div>

                  <div className="md-col-flight">
                    <div className="md-flight-row">
                      <Plane size={14} color="var(--ff-green)" />
                      <span>{s.flight_number || "---"}</span>
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
        .ff-page-wrapper { max-width: 100%; padding: 10px; }
        
        .ff-header-premium {
          background: white; padding: 24px; border-radius: var(--ff-radius);
          border: 1px solid var(--ff-border); display: flex; align-items: center;
          justify-content: space-between; margin-bottom: 24px; box-shadow: var(--ff-shadow);
        }

        .ff-logo-wrapper { 
          width: 60px; height: 60px; background: #f8fafc; border-radius: 12px; 
          border: 1px solid var(--ff-border); overflow: hidden; display: flex; align-items: center; justify-content: center;
        }
        .ff-logo-img { width: 100%; height: 100%; object-fit: contain; }

        .ff-client-name-display { font-size: 20px; font-weight: 800; color: var(--ff-green); margin: 0; }
        
        .ff-btn-quote-minimal {
          border: 2px solid var(--ff-orange); color: var(--ff-orange);
          padding: 10px 20px; border-radius: 12px; font-size: 12px; font-weight: 800;
          display: flex; align-items: center; gap: 8px; cursor: pointer; background: transparent;
          transition: all 0.2s;
        }
        .ff-btn-quote-minimal:hover { background: var(--ff-orange); color: white; }

        .md-toolbar { display: flex; gap: 12px; margin-bottom: 20px; }
        .md-search-box { 
          flex: 1; background: white; border: 1px solid var(--ff-border); border-radius: 14px; 
          display: flex; align-items: center; padding: 0 15px; gap: 10px;
        }
        .md-search-box input { border: none; outline: none; width: 100%; height: 48px; font-size: 14px; background: transparent; }

        .md-grid { display: flex; flex-direction: column; gap: 12px; }
        .md-card { 
          display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; 
          align-items: center; padding: 18px 24px; transition: all 0.2s ease;
        }
        .md-card-link:hover .md-card { 
          border-color: var(--ff-green); transform: translateX(5px);
        }

        .md-ship-code { font-size: 17px; font-weight: 800; color: var(--ff-text); margin: 0; }
        .md-prod-icon-wrapper { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }

        .md-badge-city.active { color: var(--ff-green); background: rgba(35, 77, 35, 0.08); font-weight: 800; }
        
        .md-status-pill { 
          padding: 8px 14px; border-radius: 10px; font-size: 10px; font-weight: 800; text-transform: uppercase;
        }
        /* Colores dinámicos del ShipmentFlow */
        .status-confirmed, .confirmed { background: #e0f2fe; color: #0369a1; }
        .status-in_transit, .in_transit { background: #fef9c3; color: #a16207; }
        .status-delivered, .delivered { background: #dcfce7; color: #15803d; }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        @media (max-width: 900px) {
          .md-card { grid-template-columns: 1fr 1fr; gap: 15px; }
          .md-col-flight, .md-col-status { display: none; }
          .ff-header-premium { flex-direction: column; align-items: flex-start; }
        }
      ` }} />
    </ClientLayout>
  );
}