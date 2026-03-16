import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Calendar, Package, MapPin, RefreshCcw, Plane, ArrowRight, Plus, Layers } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { getApiBase } from "../../lib/apiBase";
import { labelStatus, statusBadgeClass } from "../../lib/shipmentFlow";
import { ClientLayout } from "../../components/ClientLayout";
import { CustomerQuoteModal } from "../../components/quotes/CustomerQuoteModal"; // CAMINO A

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
  }; 
};

export default function ShipmentsPage() {
  const [items, setItems] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [destFilter, setDestFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false); // Estado para el modal

  const ProductIcon = ({ name }: { name: string }) => {
    const n = name?.toLowerCase() || "";
    let iconColor = "var(--ff-green)"; 
    let bgColor = "rgba(35, 77, 35, 0.05)";
    if (n.includes("piña")) { iconColor = "#ca8a04"; bgColor = "#fefce8"; }
    else if (n.includes("papaya")) { iconColor = "var(--ff-orange)"; bgColor = "#fff7ed"; }

    return (
      <div className="md-prod-icon-wrapper" style={{ backgroundColor: bgColor }}>
        <Package size={20} color={iconColor} strokeWidth={2.5} />
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
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, destFilter]);

  useEffect(() => { fetchShipments(); }, [fetchShipments]);

  const client = items[0]?.clients;

  return (
    <ClientLayout title="Panel de Logística" wide>
      <div className="ff-page-wrapper">
        
        {/* HEADER CLIENTE */}
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
              <p className="ff-client-tax">{client?.tax_id ? `TAX ID: ${client.tax_id}` : 'Portal de Clientes'}</p>
            </div>
          </div>

          <div className="ff-header-actions">
            <button className="ff-btn-quote-main" onClick={() => setIsModalOpen(true)}>
              <Plus size={16} />
              <span>NUEVA COTIZACIÓN</span>
            </button>
          </div>
        </header>

        {/* TOOLBAR */}
        <div className="md-toolbar">
          <div className="md-search-box">
            <Search size={18} color="var(--ff-muted)" />
            <input 
              placeholder="Buscar envío o producto..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div className="md-filters">
            <select className="md-select" value={destFilter} onChange={(e) => setDestFilter(e.target.value)}>
              <option value="">Todos los destinos</option>
              <option value="MAD">Madrid (MAD)</option>
              <option value="AMS">Amsterdam (AMS)</option>
              <option value="BCN">Barcelona (BCN)</option>
            </select>
            <button className="md-btn-refresh" onClick={fetchShipments}>
              <RefreshCcw size={18} className={loading ? "spin" : ""} />
            </button>
          </div>
        </div>

        {/* LISTA DE ENVIOS */}
        <div className="md-grid">
          {loading ? (
            <div className="md-loading">Actualizando flota...</div>
          ) : items.length > 0 ? (
            items.map((s) => (
              <Link key={s.id} to={`/shipments/${s.id}`} className="md-card-link">
                <div className="md-card ff-card">
                  <div className="md-col-info">
                    <ProductIcon name={s.product_name} /> 
                    <div>
                      <h2 className="md-ship-code">{s.code}</h2>
                      <p className="md-product-sub">{s.product_name} • {s.product_variety}</p>
                    </div>
                  </div>

                  <div className="md-col-logistics">
                    <div className="md-route">
                      <span className="md-city">PTY</span>
                      <ArrowRight size={14} color="var(--ff-border)" />
                      <span className="md-city active">{s.destination || "TBD"}</span>
                    </div>
                    <div className="md-mini-meta">
                      <Layers size={12} /> {s.pallets || 0} Pallets
                    </div>
                  </div>

                  <div className="md-col-flight hide-mobile">
                    <div className="md-mini-meta"><Plane size={14} color="var(--ff-green)" /> {s.flight_number || "---"}</div>
                    <div className="md-mini-meta"><Calendar size={14} /> {new Date(s.created_at).toLocaleDateString('es-PA')}</div>
                  </div>

                  <div className="md-col-status">
                    <span className={`md-pill ${statusBadgeClass(s.status)}`}>
                      {labelStatus(s.status)}
                    </span>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="md-empty">No hay envíos activos.</div>
          )}
        </div>
      </div>

      {/* MODAL DE COTIZACIÓN PARA CLIENTES */}
      <CustomerQuoteModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      <style dangerouslySetInnerHTML={{ __html: `
        .ff-page-wrapper { max-width: 1400px; margin: 0 auto; padding: 20px; }
        
        .ff-header-premium {
          background: white; padding: 25px; border-radius: 20px;
          border: 1px solid var(--ff-border); display: flex; align-items: center;
          justify-content: space-between; margin-bottom: 30px;
        }
        .ff-client-profile { display: flex; align-items: center; gap: 20px; }
        .ff-logo-wrapper { width: 64px; height: 64px; border-radius: 14px; border: 1px solid var(--ff-border); overflow: hidden; }
        .ff-logo-img { width: 100%; height: 100%; object-fit: contain; padding: 5px; }
        .ff-logo-placeholder { background: var(--ff-green); color: white; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 24px; }
        
        .ff-client-name-display { font-size: 22px; font-weight: 900; color: var(--ff-text); margin: 0; letter-spacing: -0.5px; }
        .ff-client-tax { font-size: 12px; color: var(--ff-muted); font-weight: 700; margin-top: 2px; }

        .ff-btn-quote-main {
          background: var(--ff-orange); color: white; border: none;
          padding: 12px 24px; border-radius: 12px; font-size: 13px; font-weight: 800;
          display: flex; align-items: center; gap: 10px; cursor: pointer;
          box-shadow: 0 10px 20px rgba(249, 115, 22, 0.2); transition: 0.2s;
        }
        .ff-btn-quote-main:hover { transform: translateY(-2px); box-shadow: 0 12px 25px rgba(249, 115, 22, 0.3); }

        .md-toolbar { display: flex; gap: 15px; margin-bottom: 25px; }
        .md-search-box { 
          flex: 1; background: white; border: 1px solid var(--ff-border); border-radius: 14px; 
          display: flex; align-items: center; padding: 0 18px; gap: 12px; height: 52px;
        }
        .md-search-box input { border: none; outline: none; width: 100%; font-size: 15px; background: transparent; }

        .md-filters { display: flex; gap: 10px; }
        .md-select { border: 1px solid var(--ff-border); border-radius: 14px; padding: 0 15px; font-weight: 700; font-size: 13px; color: var(--ff-text); }
        .md-btn-refresh { width: 52px; height: 52px; border-radius: 14px; border: 1px solid var(--ff-border); background: white; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--ff-muted); }

        .md-grid { display: flex; flex-direction: column; gap: 12px; }
        .md-card { 
          display: grid; grid-template-columns: 2.5fr 1.5fr 1.5fr 1fr; 
          align-items: center; padding: 20px 25px; transition: 0.2s;
        }
        .md-card-link { text-decoration: none; color: inherit; }
        .md-card-link:hover .md-card { border-color: var(--ff-green); transform: translateX(6px); }

        .md-col-info { display: flex; align-items: center; gap: 18px; }
        .md-prod-icon-wrapper { flex-shrink: 0; }
        .md-ship-code { font-size: 17px; font-weight: 800; color: var(--ff-green); margin: 0; }
        .md-product-sub { font-size: 11px; color: var(--ff-muted); text-transform: uppercase; font-weight: 700; margin: 2px 0 0 0; }

        .md-route { display: flex; align-items: center; gap: 10px; margin-bottom: 5px; }
        .md-city { font-size: 12px; font-weight: 800; background: #f1f5f9; padding: 3px 8px; border-radius: 6px; }
        .md-city.active { color: var(--ff-green); background: rgba(35, 77, 35, 0.1); }
        .md-mini-meta { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ff-muted); font-weight: 600; margin-top: 3px; }

        .md-pill { padding: 8px 15px; border-radius: 10px; font-size: 10px; font-weight: 800; text-transform: uppercase; text-align: center; }
        .md-col-status { display: flex; justify-content: flex-end; }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        @media (max-width: 900px) {
          .md-card { grid-template-columns: 1fr 1fr; padding: 15px; }
          .hide-mobile { display: none; }
          .ff-header-premium { flex-direction: column; gap: 20px; align-items: flex-start; }
          .ff-btn-quote-main { width: 100%; justify-content: center; }
        }
      ` }} />
    </ClientLayout>
  );
}