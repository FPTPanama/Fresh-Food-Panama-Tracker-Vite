import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Calendar, Package, RefreshCcw, Plane, ArrowRight, Plus, Layers } from "lucide-react";
import { supabase } from "@/lib/supabaseClient"; 
import { getApiBase } from "@/lib/apiBase";
import { labelStatus, statusBadgeClass } from "@/lib/shipmentFlow";
import { ClientLayout } from "@/components/ClientLayout";
// RUTA CORREGIDA AQUÍ:
import { CustomerQuoteModal } from "@/components/quotes/CustomerQuoteModal"; 

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
  const [isQuoteOpen, setIsQuoteOpen] = useState(false);

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return;

    try {
      const res = await fetch(`${getApiBase()}/.netlify/functions/listShipments?q=${search}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setItems(json.items || []);
    } catch (e) {
      console.error("Error fetching shipments:", e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchShipments(); }, [fetchShipments]);

  // Extraemos el nombre del cliente para pasárselo al modal
  const clientName = items[0]?.clients?.legal_name || items[0]?.clients?.name || "";

  return (
    <ClientLayout title="Mis Embarques" wide={true}>
      <div className="ff-page-wrapper">
        
        {/* HEADER PREMIUM DEL CLIENTE */}
        {items.length > 0 && items[0]?.clients && (
          <header className="ff-header-premium">
            <div className="ff-client-profile">
              <div className="ff-logo-wrapper">
                {items[0].clients.logo_url ? (
                  <img 
                    src={`https://oqgkbduqztrpfhfclker.supabase.co/storage/v1/object/public/client-logos/${items[0].clients.logo_url}`} 
                    alt="Logo" 
                    className="ff-logo-img"
                  />
                ) : (
                  <div className="ff-logo-placeholder">{items[0].clients.name?.charAt(0)}</div>
                )}
              </div>
              <div className="ff-client-info">
                <h1 className="ff-client-name-display">{items[0].clients.legal_name || items[0].clients.name}</h1>
                <div className="ff-client-meta-stack">
                  <span className="ff-meta-row"><strong>TAX ID:</strong> {items[0].clients.tax_id || '—'}</span>
                  <span className="ff-meta-row">{items[0].clients.billing_address || '—'}</span>
                </div>
              </div>
            </div>
            <button className="ff-btn-quote" onClick={() => setIsQuoteOpen(true)}>
              <Plus size={16} /> SOLICITAR COTIZACIÓN
            </button>
          </header>
        )}

        {/* TOOLBAR DE BÚSQUEDA */}
        <div className="md-toolbar">
          <div className="md-search-box">
            <Search size={18} />
            <input 
              placeholder="Buscar por código o producto..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="md-btn-refresh" onClick={fetchShipments} disabled={loading}>
            <RefreshCcw size={16} className={loading ? "spin" : ""} />
          </button>
        </div>

        {/* CUADRÍCULA DE TARJETAS */}
        <div className="md-grid">
          {loading ? (
            <div className="md-loading">Sincronizando flota...</div>
          ) : items.length > 0 ? (
            items.map((s) => (
              <Link key={s.id} to={`/shipments/${s.id}`} className="md-card-link">
                <div className="md-card">
                  <div className="md-col-info">
                    <div className="md-prod-icon-wrapper"><Package size={22} /></div>
                    <div>
                      <h2 className="md-ship-code">{s.code}</h2>
                      <p className="md-product-sub">{s.product_name} • {s.product_variety}</p>
                    </div>
                  </div>

                  <div className="md-col-logistics">
                    <div className="md-route">
                      <span className="md-badge-city">PTY</span>
                      <ArrowRight size={14} />
                      <span className="md-badge-city active">{s.destination || "TBD"}</span>
                    </div>
                    <div className="md-cargo-details">
                      <Layers size={12} />
                      <span>{s.pallets || 0} Pallets • {s.boxes || 0} Cajas</span>
                    </div>
                  </div>

                  <div className="md-col-flight">
                    <div className="md-flight-row"><Plane size={14} /> <span>{s.flight_number || "— — —"}</span></div>
                    <div className="md-date-row"><Calendar size={14} /> <span>{new Date(s.created_at).toLocaleDateString()}</span></div>
                  </div>

                  <div className="md-col-status">
                    <span className={`md-status-pill ${statusBadgeClass(s.status)}`}>
                      {labelStatus(s.status)}
                    </span>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="md-empty">No se encontraron embarques.</div>
          )}
        </div>
      </div>

      {/* MODAL DE COTIZACIÓN */}
      <CustomerQuoteModal 
        isOpen={isQuoteOpen} 
        onClose={() => setIsQuoteOpen(false)} 
        initialCustomerName={clientName}
      />

      <style>{`
        .ff-page-wrapper { display: flex; flex-direction: column; gap: 24px; }
        .ff-header-premium { background: white; padding: 24px; border-radius: 16px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .ff-client-profile { display: flex; align-items: center; gap: 20px; }
        .ff-logo-wrapper { width: 64px; height: 64px; background: #f8fafc; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; }
        .ff-logo-img { width: 100%; height: 100%; object-fit: contain; }
        .ff-logo-placeholder { font-size: 24px; font-weight: 800; color: #10b981; }
        .ff-client-name-display { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0; }
        .ff-client-meta-stack { font-size: 13px; color: #64748b; margin-top: 4px; display: flex; flex-direction: column; }
        .ff-btn-quote { background: #0f172a; color: white; border: none; padding: 12px 24px; border-radius: 12px; font-weight: 700; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: 0.2s; }
        .ff-btn-quote:hover { background: #10b981; transform: translateY(-2px); }

        .md-toolbar { display: flex; gap: 12px; }
        .md-search-box { flex: 1; background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 0 16px; display: flex; align-items: center; gap: 12px; height: 52px; }
        .md-search-box input { border: none; outline: none; width: 100%; font-size: 14px; background: transparent; }
        .md-btn-refresh { background: white; border: 1px solid #e2e8f0; border-radius: 12px; width: 52px; height: 52px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #64748b; }

        .md-grid { display: flex; flex-direction: column; gap: 12px; }
        .md-card-link { text-decoration: none; color: inherit; }
        .md-card { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px 24px; display: grid; grid-template-columns: 2fr 1.5fr 1fr 150px; align-items: center; transition: 0.2s; }
        .md-card:hover { border-color: #10b981; transform: translateX(5px); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
        
        .md-col-info { display: flex; align-items: center; gap: 16px; }
        .md-prod-icon-wrapper { width: 48px; height: 48px; background: #f0fdf4; border-radius: 14px; display: flex; align-items: center; justify-content: center; color: #10b981; }
        .md-ship-code { font-size: 16px; font-weight: 800; color: #0f172a; margin: 0; }
        .md-product-sub { font-size: 12px; color: #94a3b8; margin: 0; }

        .md-route { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .md-badge-city { background: #f1f5f9; padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 800; color: #475569; }
        .md-badge-city.active { background: #ecfdf5; color: #059669; }
        .md-cargo-details { font-size: 12px; color: #64748b; display: flex; align-items: center; gap: 6px; font-weight: 600; }

        .md-flight-row, .md-date-row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #475569; font-weight: 600; margin-bottom: 4px; }
        .md-status-pill { display: block; text-align: center; padding: 8px 12px; border-radius: 12px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
        
        .md-loading, .md-empty { text-align: center; padding: 60px; color: #94a3b8; background: white; border-radius: 20px; border: 1px dashed #e2e8f0; }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </ClientLayout>
  );
}