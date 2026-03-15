import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom"; // Cambio a React Router
import { supabase } from "../../lib/supabaseClient";
import { getApiBase } from "../../lib/apiBase";
import { ClientLayout } from "../../components/ClientLayout";
import { ProgressStepper } from "../../components/ProgressStepper";
import { labelStatus, statusBadgeClass } from "../../lib/shipmentFlow";

import { 
  FileText, 
  Image as ImageIcon, 
  Download, 
  ArrowLeft, 
  Package, 
  MapPin, 
  Calendar,
  Layers,
  Plane
} from "lucide-react";

/* =======================
   Types & Config
======================= */
type Milestone = { type: string; at: string; note?: string | null };

type FileItem = {
  id: string;
  filename: string;
  created_at: string;
  doc_type?: string | null;
  url?: string | null;
};

type ShipmentDetail = {
  id: string;
  code: string;
  destination: string;
  incoterm?: string | null;
  status: string;
  created_at: string;
  client_name?: string | null;
  clients?: { name?: string | null } | null;
  client?: { name?: string | null } | null;
  product_name?: string | null;
  product_variety?: string | null;
  product_mode?: string | null;
  caliber?: string | null;
  color?: string | null;
  boxes?: number | null;
  pallets?: number | null;
  weight_kg?: number | null;
  flight_number?: string | null;
  awb?: string | null;
  milestones: Milestone[];
  documents: FileItem[];
  photos: FileItem[];
  flight_departure_time?: string | null;
  flight_arrival_time?: string | null;
  flight_status?: string | null;
  last_api_sync?: string | null;
};

const DOC_LABELS: Record<string, string> = {
  invoice: "Factura",
  packing_list: "Packing list",
  awb: "AWB (guía aérea)",
  phytosanitary: "Certificado fitosanitario",
  eur1: "EUR1",
  export_declaration: "Declaración de exportación",
  non_recyclable_plastics: "Declaración de plásticos",
  sanitary_general_info: "Info. General Sanitaria",
  additives_declaration: "Declaración de aditivos",
  quality_report: "Informe de calidad"
};

/* =======================
   Utils
======================= */
function clientNameLine(d: ShipmentDetail) {
  return String(d.client_name || d.clients?.name || d.client?.name || "").trim() || "—";
}

function productLine(d: ShipmentDetail) {
  const name = String(d.product_name || "").trim();
  const variety = String(d.product_variety || "").trim();
  const modeRaw = String(d.product_mode || "").trim();

  const mode = (() => {
    const s = modeRaw.toLowerCase();
    if (!s) return "";
    if (s.includes("aere") || s === "air") return "Aérea";
    if (s.includes("marit") || s === "sea") return "Marítima";
    return modeRaw;
  })();

  const left = [name, variety].filter(Boolean).join(" ");
  return [left, mode].filter(Boolean).join(" · ") || "—";
}

export default function ShipmentDetailPage() {
  const { id } = useParams(); // Hook de Vite/React-Router
  const navigate = useNavigate();

  const [data, setData] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // Navegación por teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!data?.photos || data.photos.length <= 1) return;
      if (e.key === "ArrowRight") {
        setActivePhotoIdx((prev) => (prev + 1) % data.photos.length);
      } else if (e.key === "ArrowLeft") {
        setActivePhotoIdx((prev) => (prev - 1 + data.photos.length) % data.photos.length);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [data?.photos]);

  async function load(shipmentId: string) {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { 
        navigate("/login"); 
        return; 
      }

      const res = await fetch(`${getApiBase()}/.netlify/functions/getShipment?id=${encodeURIComponent(shipmentId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Error cargando embarque");
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error("Error en load:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) load(id);
  }, [id]);

  async function download(fileId: string) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch(`${getApiBase()}/.netlify/functions/getDownloadUrl?fileId=${encodeURIComponent(fileId)}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const { url } = await res.json();
    window.open(url, "_blank");
  }

  const docCount = useMemo(() => {
    if (!data?.documents) return 0;
    const uniqueUploadedTypes = new Set(
      data.documents
        .filter(d => d.doc_type && Object.keys(DOC_LABELS).includes(d.doc_type))
        .map(d => d.doc_type)
    );
    return uniqueUploadedTypes.size;
  }, [data?.documents]);

  if (loading) return <ClientLayout title="Cargando..."><div className="ff-sub">Sincronizando datos...</div></ClientLayout>;

  return (
    <ClientLayout title="Expediente de Embarque" subtitle="Estado de tránsito y documentación legal" wide>
      <div className="ff-spread" style={{ marginBottom: 16 }}>
        <Link to="/shipments" className="ff-btn ff-btn-ghost"><ArrowLeft size={16} /> Volver al listado</Link>
      </div>

      {data && (
        <div className="page">
          <div className="ff-header-premium">
            <div className="ff-header-main-info">
              <div className="ff-id-badge">
                <Package size={16} className="ff-icon-green" />
                <span>{data.code}</span>
              </div>
              <h1 className="ff-product-name">{productLine(data)}</h1>
              <div className="ff-client-tag">Consignatario: <strong>{clientNameLine(data)}</strong></div>
            </div>

            <div className="ff-header-specs-bar">
              <div className="ff-spec-item">
                <span className="ff-spec-label">DESTINO</span>
                <div className="ff-spec-value-group">
                  <MapPin size={12} className="ff-text-slate" />
                  <span className="ff-spec-value">{data.destination}</span>
                </div>
              </div>
              <div className="ff-spec-divider"></div>
              <div className="ff-spec-item">
                <span className="ff-spec-label">INCOTERM</span>
                <span className="ff-spec-value ff-text-blue">{data.incoterm || 'FOB'}</span>
              </div>
              <div className="ff-spec-divider-heavy"></div>
              <div className="ff-spec-item">
                <span className="ff-spec-label">PESO NETO</span>
                <span className="ff-spec-value">{data.weight_kg ? `${data.weight_kg} kg` : '—'}</span>
              </div>
              <div className="ff-spec-divider"></div>
              <div className="ff-spec-item">
                <span className="ff-spec-label">CAJAS / PLTS</span>
                <span className="ff-spec-value">{data.boxes || '0'} / {data.pallets || '0'}</span>
              </div>
            </div>
          </div>

          <div className="block">
            <ProgressStepper 
              milestones={data.milestones ?? []} 
              flightNumber={data.flight_number ?? null} 
              awb={data.awb ?? null}
              flightStatus={data.flight_status}
              departureTime={data.flight_departure_time}
              arrivalTime={data.flight_arrival_time}
            />
          </div>

          <div className="ff-balanced-grid">
            <div className="ff-col-photos">
              <div className="modern-section-header">
                <div className="header-icon orange"><ImageIcon size={18} /></div>
                <h3>Inspección</h3>
              </div>
              
              <div className="ff-amazon-gallery">
                {data?.photos && data.photos.length > 0 ? (
                  <>
                    <div className="ff-main-photo-wrapper">
                       <div className="ff-main-photo" onClick={() => data.photos[activePhotoIdx]?.id && download(data.photos[activePhotoIdx].id)}>
                          <img src={data.photos[activePhotoIdx]?.url || ''} alt="Inspección" />
                          <div className="ff-photo-counter">
                            {activePhotoIdx + 1} / {data.photos.length}
                          </div>
                       </div>
                    </div>
                    <div className="ff-thumbs-strip">
                      {data.photos.map((p, idx) => (
                        <div 
                          key={p.id || idx} 
                          className={`ff-thumb ${idx === activePhotoIdx ? 'active' : ''}`} 
                          onClick={() => setActivePhotoIdx(idx)}
                        >
                          <img src={p.url || ''} alt="thumb" />
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="ff-no-photos-placeholder">
                    <div className="placeholder-icon">📸</div>
                    <p>Esperando reporte fotográfico...</p>
                  </div>
                )}
              </div>
            </div>

            <div className="ff-col-docs">
              <div className="modern-section-header spread">
                <div className="ff-header-group">
                  <div className="header-icon dark"><FileText size={18} /></div>
                  <h3>Documentación Digital</h3>
                </div>
                <div className="doc-counter-premium">{docCount} / 10</div>
              </div>

              <div className="ff-docs-list-refined">
                {Object.entries(DOC_LABELS).map(([key, label]) => {
                  const doc = data.documents?.find(d => d.doc_type === key);
                  const isUploaded = !!doc;
                  return (
                    <div key={key} className={`ff-doc-flat-row ${isUploaded ? 'is-up' : 'is-off'}`}>
                      <div className="ff-doc-left">
                        <div className="ff-status-indicator"></div>
                        <span className="ff-doc-label">{label}</span>
                      </div>
                      {isUploaded && (
                        <button className="ff-download-minimal" onClick={() => download(doc.id)}>
                          <Download size={14} /> <span>Descargar</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .page { display: flex; flex-direction: column; gap: 24px; padding-bottom: 60px; }
        .modern-section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .modern-section-header.spread { justify-content: space-between; }
        .modern-section-header h3 { font-size: 16px; font-weight: 800; color: #0f172a; margin: 0; }
        .ff-header-premium {
          background: linear-gradient(135deg, #ffffff 0%, rgba(209, 119, 17, 0.03) 100%);
          padding: 28px 36px; border-radius: 24px; border: 1px solid rgba(209, 119, 17, 0.1);
          display: flex; align-items: center; justify-content: space-between; gap: 30px;
          box-shadow: 0 10px 30px rgba(209, 119, 17, 0.05); position: relative; overflow: hidden;
        }
        .ff-id-badge { display: inline-flex; align-items: center; gap: 8px; background: #f0fdf4; color: #166534; padding: 4px 10px; border-radius: 8px; font-family: monospace; font-weight: 700; margin-bottom: 8px; }
        .ff-product-name { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; }
        .ff-header-specs-bar { display: flex; align-items: center; gap: 20px; background: #f8fafc; padding: 14px 28px; border-radius: 20px; border: 1px solid #f1f5f9; }
        .ff-spec-item { display: flex; flex-direction: column; }
        .ff-spec-label { font-size: 9px; font-weight: 800; color: #94a3b8; margin-bottom: 4px; }
        .ff-spec-value { font-size: 14px; font-weight: 700; color: #1e293b; }
        .ff-balanced-grid { display: grid; grid-template-columns: 420px 1fr; gap: 24px; }
        .ff-col-photos, .ff-col-docs { background: white; padding: 24px; border-radius: 24px; border: 1px solid #f1f5f9; }
        .ff-main-photo-wrapper { width: 100%; aspect-ratio: 1/1; background: #f8fafc; border-radius: 16px; overflow: hidden; margin-bottom: 16px; position: relative; }
        .ff-main-photo img { width: 100%; height: 100%; object-fit: contain; }
        .ff-photo-counter { position: absolute; bottom: 12px; right: 12px; background: rgba(0,0,0,0.7); color: white; padding: 4px 12px; border-radius: 20px; font-size: 11px; }
        .ff-thumbs-strip { display: flex; gap: 10px; overflow-x: auto; }
        .ff-thumb { width: 65px; height: 65px; border-radius: 10px; cursor: pointer; border: 2px solid transparent; flex-shrink: 0; }
        .ff-thumb.active { border-color: #ea580c; }
        .ff-thumb img { width: 100%; height: 100%; object-fit: cover; border-radius: 8px; }
        .ff-docs-list-refined { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .ff-doc-flat-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-radius: 12px; border: 1px solid #f1f5f9; }
        .ff-doc-flat-row.is-up { background: #fff; border-color: #f0fdf4; }
        .ff-doc-flat-row.is-off { opacity: 0.4; filter: grayscale(1); }
        .ff-status-indicator { width: 6px; height: 6px; border-radius: 50%; background: #cbd5e1; }
        .is-up .ff-status-indicator { background: #16a34a; }
        .ff-download-minimal { display: flex; align-items: center; gap: 6px; background: #f1f5f9; border: none; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer; }
        .doc-counter-premium { background: #1e293b; color: white; padding: 4px 12px; border-radius: 10px; font-size: 12px; font-weight: 800; }
        @media (max-width: 1200px) { .ff-balanced-grid { grid-template-columns: 1fr; } .ff-docs-list-refined { grid-template-columns: 1fr; } }
      ` }} />
    </ClientLayout>
  );
}