import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Calendar, Package, MapPin, RefreshCcw, Plane, ArrowRight, Plus, Layers } from "lucide-react";
import { supabase } from "@/lib/supabaseClient"; 
import { getApiBase } from "@/lib/apiBase";
import { labelStatus, statusBadgeClass } from "@/lib/shipmentFlow";
import { ClientLayout } from "@/components/ClientLayout";

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
    let iconColor = "#64748b"; 
    let bgColorClass = "bg-slate";

    if (n.includes("piña")) { iconColor = "#ca8a04"; bgColorClass = "bg-yellow"; }
    else if (n.includes("aguacate") || n.includes("avocado")) { iconColor = "#16a34a"; bgColorClass = "bg-green"; }
    else if (n.includes("papaya")) { iconColor = "#ea580c"; bgColorClass = "bg-orange"; }

    return (
      <div className={`md-prod-icon-wrapper ${bgColorClass}`}>
        <Package size={22} color={iconColor} strokeWidth={2.5} />
      </div>
    );
  };

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return;

    const params = new URLSearchParams({
      page: "1",
      pageSize: "40",
      q: search,
      destination: destFilter
    });

    try {
      const res = await fetch(`${getApiBase()}/.netlify/functions/listShipments?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
      const json = await res.json();
      setItems(json.items || []);
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
                      <p className="md-product-sub">{s.product_name} • {s.product_variety}</p>
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
    </ClientLayout>
  );
}