import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Calendar, Package, MapPin, RefreshCcw, Plane, ArrowRight, Plus, Layers, Loader2 } from "lucide-react";
// CORRECCIÓN: Subimos 3 niveles para llegar a la raíz de src desde pages/clients/shipments/
import { supabase } from "../../../lib/supabaseClient";
import { getApiBase } from "../../../lib/apiBase";
import { ClientLayout } from "../../../components/ClientLayout";
import { labelStatus, statusBadgeClass } from "../../../lib/shipmentFlow";

export default function ShipmentsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [destFilter, setDestFilter] = useState("");

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        navigate("/login");
        return;
      }

      const params = new URLSearchParams({ page: "1", pageSize: "40", q: search, destination: destFilter });
      const res = await fetch(`${getApiBase()}/.netlify/functions/listShipments?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setItems(json.items || []);
    } catch (e) { 
      console.error("Error cargando embarques:", e); 
    } finally { 
      setLoading(false); 
    }
  }, [search, destFilter, navigate]);

  useEffect(() => { fetchShipments(); }, [fetchShipments]);

  return (
    <ClientLayout title="Panel de Logística" subtitle="Seguimiento de carga en tiempo real">
      <div className="ff-shipments-page">
        
        {/* INFO DEL CLIENTE RE-DISEÑADA */}
        <div className="ff-client-card">
          <div className="ff-client-brand">
            <div className="ff-client-logo">
              {items[0]?.clients?.logo_url ? (
                <img src={`https://oqgkbduqztrpfhfclker.supabase.co/storage/v1/object/public/client-logos/${items[0].clients.logo_url}`} alt="Logo" />
              ) : <span>{items[0]?.clients?.name?.charAt(0) || 'C'}</span>}
            </div>
            <div className="ff-client-text">
              <h2>{items[0]?.clients?.legal_name || items[0]?.clients?.name || 'Cargando Perfil...'}</h2>
              <p>TAX ID: {items[0]?.clients?.tax_id || '—'} | {items[0]?.clients?.billing_address || '—'}</p>
            </div>
          </div>
          <button className="ff-quote-btn" onClick={() => window.open('https://wa.me/50762256452', '_blank')}>
            <Plus size={16} /> SOLICITAR CARGA
          </button>
        </div>

        {/* FILTROS */}
        <div className="ff-toolbar">
          <div className="ff-search">
            <Search size={18} />
            <input placeholder="Buscar número de guía o contenedor..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="ff-filter-group">
            <select value={destFilter} onChange={(e) => setDestFilter(e.target.value)}>
              <option value="">Todos los Destinos</option>
              <option value="MAD">Madrid (MAD)</option>
              <option value="AMS">Amsterdam (AMS)</option>
              <option value="PTY">Panamá (PTY)</option>
            </select>
            <button className="ff-refresh" onClick={fetchShipments}><RefreshCcw size={18} /></button>
          </div>
        </div>

        {/* LISTADO */}
        <div className="ff-list">
          {loading ? (
            <div className="ff-loading-state">
                <Loader2 className="animate-spin" size={24} />
                <span>Sincronizando con la aerolínea...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="ff-empty-state">No se encontraron embarques activos en su historial.</div>
          ) : items.map((s) => (
            <Link key={s.id} to={`/clients/shipments/${s.id}`} className="ff-item">
              <div className="ff-col-prod">
                <div className="ff-icon-box"><Package size={20} /></div>
                <div>
                  <div className="ff-code">{s.code}</div>
                  <div className="ff-sub">{s.product_name} • {s.product_variety}</div>
                </div>
              </div>

              <div className="ff-col-route">
                <div className="ff-route-line">
                  <span className="ff-tag">PTY</span>
                  <ArrowRight size={14} className="ff-text-slate" />
                  <span className="ff-tag active">{s.destination || 'TBD'}</span>
                </div>
                <div className="ff-cargo"><Layers size={12} /> {s.pallets} Pallets • {s.boxes} Cajas</div>
              </div>

              <div className="ff-col-meta">
                <div className="ff-meta-row"><Plane size={14} /> {s.flight_number || '—'}</div>
                <div className="ff-meta-row"><Calendar size={14} /> {new Date(s.created_at).toLocaleDateString()}</div>
              </div>

              <div className="ff-col-status">
                <span className={`ff-status ${statusBadgeClass(s.status)}`}>
                  {labelStatus(s.status)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .ff-shipments-page { display: flex; flex-direction: column; gap: 24px; color: #1e293b; padding: 20px; }
        
        .ff-client-card { 
          background: white; padding: 24px; border-radius: 16px; border: 1px solid #e2e8f0;
          display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .ff-client-brand { display: flex; align-items: center; gap: 16px; }
        .ff-client-logo { width: 64px; height: 64px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .ff-client-logo img { width: 100%; height: 100%; object-fit: contain; }
        .ff-client-logo span { font-size: 24px; font-weight: 800; color: #94a3b8; }
        .ff-client-text h2 { margin: 0; font-size: 20px; font-weight: 800; color: #0f172a; }
        .ff-client-text p { margin: 4px 0 0; font-size: 13px; color: #64748b; }
        .ff-quote-btn { background: #0f172a; color: white; border: none; padding: 10px 20px; border-radius: 10px; font-weight: 700; font-size: 13px; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: 0.2s; }
        .ff-quote-btn:hover { background: #1e293b; }

        .ff-toolbar { display: flex; justify-content: space-between; gap: 16px; }
        .ff-search { flex: 1; background: white; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; align-items: center; padding: 0 16px; height: 48px; gap: 12px; color: #94a3b8; }
        .ff-search input { border: none; outline: none; width: 100%; font-size: 14px; color: #1e293b; }
        .ff-filter-group { display: flex; gap: 12px; }
        .ff-filter-group select { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 0 16px; font-weight: 600; color: #475569; outline: none; }
        .ff-refresh { background: white; border: 1px solid #e2e8f0; border-radius: 12px; width: 48px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #64748b; }

        .ff-list { display: flex; flex-direction: column; gap: 12px; }
        .ff-item { 
          background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px 24px;
          display: grid; grid-template-columns: 2fr 1.5fr 1fr 150px; align-items: center;
          text-decoration: none; color: inherit; transition: all 0.2s;
        }
        .ff-item:hover { border-color: #10b981; transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); }

        .ff-col-prod { display: flex; align-items: center; gap: 16px; }
        .ff-icon-box { width: 44px; height: 44px; background: #f1f5f9; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #64748b; }
        .ff-code { font-weight: 800; font-size: 16px; color: #0f172a; font-family: monospace; }
        .ff-sub { font-size: 12px; color: #64748b; }

        .ff-route-line { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .ff-tag { background: #f1f5f9; padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 800; color: #64748b; }
        .ff-tag.active { background: #ecfdf5; color: #10b981; }
        .ff-cargo { font-size: 12px; color: #94a3b8; display: flex; align-items: center; gap: 6px; font-weight: 600; }

        .ff-meta-row { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 4px; }
        
        .ff-status { display: block; text-align: center; padding: 8px; border-radius: 12px; font-size: 10px; font-weight: 800; text-transform: uppercase; }
        .status-confirmed { background: #eff6ff; color: #2563eb; }
        .status-in_transit { background: #fff7ed; color: #ea580c; }
        .status-delivered { background: #ecfdf5; color: #059669; }

        .ff-loading-state { text-align: center; padding: 40px; color: #64748b; display: flex; flex-direction: column; align-items: center; gap: 12px; }
        .ff-empty-state { text-align: center; padding: 40px; color: #94a3b8; border: 2px dashed #e2e8f0; border-radius: 16px; }
      ` }} />
    </ClientLayout>
  );
}