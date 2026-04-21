// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { getApiBase } from "@/lib/apiBase";
import { ClientLayout } from "@/components/ClientLayout";
import { useUILang } from "@/lib/uiLanguage";
import { labelStatus } from "@/lib/shipmentFlow";
import { Timeline as ModernTimeline } from "@/components/Timeline";

import {
  FileText, Image as ImageIcon, Download, 
  ArrowLeft, Package, CheckCircle, 
  Loader2, Globe, AlertTriangle, Clock, MapPin, Check,
  Scale, Plane, Ship
} from "lucide-react";

// --- TIPOS ---
type ShipmentMilestone = { id?: string; type: string; at: string; note?: string | null; actor_email?: string | null; };
type ShipmentFile = { id: string; kind: "doc" | "photo"; doc_type?: string | null; filename: string; created_at: string; url?: string | null; };
type ShipmentDetail = {
  id: string; code: string; origin?: string | null; destination: string; status: string; created_at: string;
  client_name?: string | null; product_name?: string | null; product_variety?: string | null;
  boxes?: number | null; pallets?: number | null; weight_kg?: number | null;
  flight_number?: string | null; awb?: string | null; caliber?: string | null; color?: string | null; brix_grade?: string | null;
  product_mode?: string | null; mode?: string | null;
  milestones: ShipmentMilestone[]; documents: ShipmentFile[]; photos: ShipmentFile[];
};

const DOC_TYPES = [
  { v: "invoice", l: "Factura Comercial", en: "Commercial Invoice" },
  { v: "packing_list", l: "Packing List", en: "Packing List" },
  { v: "awb", l: "AWB / BL", en: "AWB / BL" },
  { v: "phytosanitary", l: "Certificado Fitosanitario", en: "Phytosanitary Cert" },
  { v: "eur1", l: "Certificado EUR1", en: "EUR1 Certificate" },
  { v: "export_declaration", l: "Decl. de Exportación", en: "Export Declaration" },
  { v: "quality_report", l: "Informe de Calidad", en: "Quality Report" },
];

type MilestoneType = "PACKED" | "DOCS_READY" | "AT_ORIGIN" | "IN_TRANSIT" | "AT_DESTINATION";
const CHAIN: MilestoneType[] = ["PACKED", "DOCS_READY", "AT_ORIGIN", "IN_TRANSIT", "AT_DESTINATION"];

export default function ClientShipmentDetail() {
  const { id } = useParams(); 
  const navigate = useNavigate();
  const { lang } = useUILang();

  const [data, setData] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'overview' | 'docs' | 'photos' | 'timeline'>('overview');

  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(async (shipmentId: string) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/login'); return; }

      // 🚀 Llamamos a la API en modo NORMAL (no admin)
      const res = await fetch(`${getApiBase()}/.netlify/functions/getShipment?id=${shipmentId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      
      if (!res.ok) throw new Error("Error al cargar embarque o acceso denegado");
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      showToast(e.message, "error");
      setTimeout(() => navigate('/clients/shipments'), 2000); // Redirigir de forma segura si falla
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { if (id) load(id); }, [id, load]);

  const timelineItems = useMemo(() => {
    if (!data?.milestones) return [];
    return data.milestones.map((m) => ({ id: m.id, type: m.type, created_at: m.at, note: m.note, author_name: "FreshConnect Operations" }));
  }, [data?.milestones]);

  const missingDocsList = useMemo(() => {
    if (!data?.documents) return DOC_TYPES.map(d => lang === 'es' ? d.l : d.en);
    return DOC_TYPES.filter(t => !data.documents.some(d => d.doc_type === t.v)).map(t => lang === 'es' ? t.l : t.en);
  }, [data?.documents, lang]);
  
  const isDocsOk = missingDocsList.length === 0;
  const isAir = (data?.product_mode || data?.mode)?.toUpperCase() !== 'SEA';

  async function download(fileId: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${getApiBase()}/.netlify/functions/getDownloadUrl?fileId=${fileId}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      const { url } = await res.json();
      window.open(url, "_blank");
    } catch (e) {
      showToast(lang === 'es' ? "Error al descargar" : "Download error", "error");
    }
  }

  if (loading) return <div className="loader-full"><Loader2 className="animate-spin" size={40}/></div>;
  if (!data) return <div className="loader-full">Error 404 - Not Found</div>;

  return (
    <ClientLayout title={lang === 'es' ? `Expediente: ${data.code}` : `Shipment: ${data.code}`}>
      {toast && <div className={`toast-alert ${toast.type}`}>{toast.msg}</div>}

      <div className="clean-container">
        
        {/* HEADER COMPACTO */}
        <div className="clean-header">
          <div className="ch-left">
            <button onClick={() => navigate(-1)} className="btn-back-icon" title="Volver"><ArrowLeft size={18}/></button>
            <div className="ch-titles">
              <div className="title-row">
                <h1 className="ch-title">{data.code}</h1>
                <span className="status-pill-main">{labelStatus(data.status)}</span>
              </div>
              <p className="ch-sub">
                <strong>{data.product_name || 'Producto'}</strong> {data.product_variety ? `(${data.product_variety})` : ''} 
              </p>
            </div>
          </div>
          <div className="ch-right">
            <div className="ch-stats">
              <div className="stat-block"><span className="s-val">{data.boxes || 0}</span><span className="s-lab">{lang === 'es' ? 'Cajas' : 'Boxes'}</span></div>
              <div className="stat-block"><span className="s-val">{data.pallets || 0}</span><span className="s-lab">Pallets</span></div>
              <div className="stat-block"><span className="s-val">{(data.weight_kg || 0).toLocaleString()} <small>Kg</small></span><span className="s-lab">{lang === 'es' ? 'Peso Bruto' : 'Gross Wt.'}</span></div>
            </div>
          </div>
        </div>

        {/* LAYOUT VERTICAL TABS */}
        <div className="clean-layout">
          
          <aside className="clean-sidebar">
            <nav className="side-nav">
              <button className={`nav-item ${activeSection === 'overview' ? 'active' : ''}`} onClick={() => setActiveSection('overview')}><MapPin size={16}/> {lang === 'es' ? 'Resumen Operativo' : 'Overview'}</button>
              <button className={`nav-item ${activeSection === 'docs' ? 'active' : ''}`} onClick={() => setActiveSection('docs')}><FileText size={16}/> {lang === 'es' ? 'Docs. Operativos' : 'Documents'}</button>
              <button className={`nav-item ${activeSection === 'photos' ? 'active' : ''}`} onClick={() => setActiveSection('photos')}><ImageIcon size={16}/> {lang === 'es' ? 'Evidencia Visual' : 'Visual Evidence'}</button>
              <button className={`nav-item ${activeSection === 'timeline' ? 'active' : ''}`} onClick={() => setActiveSection('timeline')}><Clock size={16}/> {lang === 'es' ? 'Línea de Tiempo' : 'Timeline'}</button>
            </nav>
          </aside>

          <main className="clean-content">
            
            {/* --- SECCIÓN 1: RESUMEN OPERATIVO --- */}
            {activeSection === 'overview' && (
              <div className="section-panel no-padding">
                <div className="panel-header pad-24"><h2>{lang === 'es' ? 'Estado del Embarque' : 'Shipment Status'}</h2></div>
                
                {/* STEPPER DE PROGRESO */}
                <div className="stepper-wrapper">
                  <div className="ff-stepper">
                    {CHAIN.map((step, idx) => {
                      const isPassed = CHAIN.indexOf(data.status as any) >= idx;
                      const isCurrent = data.status === step;
                      const isFirst = idx === 0;
                      const isLast = idx === CHAIN.length - 1;

                      return (
                        <div className={`stepper-node ${isPassed ? 'passed' : ''} ${isCurrent ? 'current' : ''}`} key={step}>
                          <div className="step-icon">{isPassed ? <Check size={14} strokeWidth={3}/> : <div className="dot"></div>}</div>
                          <div className="step-label">{labelStatus(step)}</div>
                          {isFirst && <div className="step-sub-label origin"><MapPin size={10}/> {data.origin || 'PTY'}</div>}
                          {isLast && <div className="step-sub-label dest"><Globe size={10}/> {data.destination || 'TBD'}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="data-rows-container">
                  <div className="data-row">
                    <div className="dr-header"><Package size={14}/> <span>{lang === 'es' ? 'Características de Carga' : 'Cargo Specs'}</span></div>
                    <div className="dr-grid cols-4">
                      <div className="field"><label>{lang === 'es' ? 'Variedad' : 'Variety'}</label><div className="read-val">{data.product_variety || '—'}</div></div>
                      <div className="field"><label>Color / Brix</label><div className="read-val">{data.color ? `${data.color} / ${data.brix_grade || '-'}` : (data.brix_grade || '—')}</div></div>
                      <div className="field"><label>{lang === 'es' ? 'Calibre' : 'Caliber'}</label><div className="read-val">{data.caliber || '—'}</div></div>
                    </div>
                  </div>

                  <div className="data-row no-border">
                    <div className="dr-header">{isAir ? <Plane size={14}/> : <Ship size={14}/>} <span>{lang === 'es' ? 'Logística' : 'Logistics'}</span></div>
                    <div className="dr-grid cols-3">
                      <div className="field"><label>{lang === 'es' ? 'Vuelo / Viaje' : 'Flight / Voyage'}</label><div className="read-val font-mono text-blue">{data.flight_number || 'TBD'}</div></div>
                      <div className="field"><label>AWB / BL</label><div className="read-val font-mono">{data.awb || 'TBD'}</div></div>
                      
                      <div className="field">
                        <label>{lang === 'es' ? 'Estado Documental' : 'Docs Status'}</label>
                        <div className="doc-verifier">
                          {isDocsOk ? (
                            <span className="doc-badge ok"><CheckCircle size={14}/> {lang === 'es' ? 'Completa' : 'Complete'} (OK)</span>
                          ) : (
                            <span className="doc-badge warn"><AlertTriangle size={14}/> {lang === 'es' ? 'En Proceso' : 'In Progress'}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- SECCIÓN 2: DOCUMENTOS --- */}
            {activeSection === 'docs' && (
              <div className="section-panel no-padding">
                <div className="panel-header pad-24"><h2>{lang === 'es' ? 'Documentos Operativos' : 'Operational Documents'}</h2></div>
                <table className="clean-table">
                  <thead>
                    <tr>
                      <th style={{width: '50%'}}>{lang === 'es' ? 'Documento' : 'Document'}</th>
                      <th style={{width: '30%'}}>{lang === 'es' ? 'Estado' : 'Status'}</th>
                      <th style={{width: '20%'}} className="txt-right">{lang === 'es' ? 'Descargar' : 'Download'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DOC_TYPES.map(t => {
                      const doc = data.documents?.find(d => d.doc_type === t.v);
                      return (
                        <tr key={t.v}>
                          <td className="doc-type-label"><FileText size={14}/> {lang === 'es' ? t.l : t.en}</td>
                          <td>{doc ? <span className="doc-name-pill">{doc.filename}</span> : <span className="empty-italic">{lang === 'es' ? 'Pendiente' : 'Pending'}</span>}</td>
                          <td className="txt-right">
                            {doc && <button className="btn-icon" onClick={() => download(doc.id)} title="Download"><Download size={14}/></button>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* --- SECCIÓN 3: FOTOS --- */}
            {activeSection === 'photos' && (
              <div className="section-panel">
                <div className="panel-header"><h2>{lang === 'es' ? 'Inspección Visual' : 'Visual Inspection'}</h2></div>
                <div className="pad-32">
                  {data.photos && data.photos.length > 0 ? (
                    <div className="photos-grid">
                      {data.photos.map(p => (
                        <div key={p.id} className="photo-card" onClick={() => download(p.id)}>
                          <img src={p.url || ""} alt="Evidencia" className="photo-img" />
                          <div className="photo-overlay"><Download size={24} color="white"/></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-box">
                      <ImageIcon size={32} color="#cbd5e1" />
                      <p>{lang === 'es' ? 'Aún no hay fotos disponibles para esta carga.' : 'No photos available for this cargo yet.'}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- SECCIÓN 4: TIMELINE --- */}
            {activeSection === 'timeline' && (
              <div className="section-panel">
                <div className="panel-header"><h2>{lang === 'es' ? 'Línea de Tiempo Operativa' : 'Operational Timeline'}</h2></div>
                <div className="pad-32">
                  <ModernTimeline milestones={timelineItems as any} />
                </div>
              </div>
            )}

          </main>
        </div>
      </div>

      <style>{`
        /* LOS MISMOS ESTILOS QUE EL ADMIN, PERO SIN LOS BOTONES ROJOS DE BORRAR */
        .clean-container { max-width: 1100px; margin: 0 auto; padding: 20px; font-family: 'Inter', sans-serif; color: #0f172a; }
        .clean-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
        .ch-left { display: flex; align-items: center; gap: 16px; }
        .btn-back-icon { background: #f1f5f9; border: none; width: 36px; height: 36px; border-radius: 10px; color: #64748b; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; flex-shrink: 0; }
        .btn-back-icon:hover { background: #e2e8f0; color: #0f172a; }
        .ch-titles { display: flex; flex-direction: column; gap: 4px; }
        .title-row { display: flex; align-items: center; gap: 12px; }
        .ch-title { font-family: 'JetBrains Mono', monospace; font-size: 24px; font-weight: 900; margin: 0; color: #1e293b; letter-spacing: -0.5px; }
        .status-pill-main { background: #1e293b; color: white; padding: 4px 12px; border-radius: 20px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
        .ch-sub { font-size: 13px; color: #64748b; margin: 0; }
        .ch-sub strong { color: #0f172a; font-weight: 700; }
        .ch-right { display: flex; align-items: center; gap: 24px; }
        .ch-stats { display: flex; gap: 24px; }
        .stat-block { display: flex; flex-direction: column; align-items: flex-end; }
        .s-val { font-size: 18px; font-weight: 800; color: #0f172a; line-height: 1.1; }
        .s-val small { font-size: 11px; color: #64748b; }
        .s-lab { font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase; margin-top: 4px; }
        .clean-layout { display: grid; grid-template-columns: 220px 1fr; gap: 32px; align-items: start; }
        .side-nav { display: flex; flex-direction: column; gap: 4px; position: sticky; top: 20px; }
        .nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 8px; border: none; background: transparent; font-size: 13px; font-weight: 600; color: #64748b; cursor: pointer; text-align: left; transition: 0.2s; }
        .nav-item:hover { background: #f1f5f9; color: #0f172a; }
        .nav-item.active { background: #eff6ff; color: #2563eb; font-weight: 700; }
        .clean-content { background: white; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 2px 10px rgba(0,0,0,0.02); min-height: 400px; }
        .section-panel { display: flex; flex-direction: column; }
        .section-panel.no-padding { padding: 0; }
        .panel-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid #f1f5f9; }
        .pad-24 { padding: 20px 24px; }
        .pad-32 { padding: 24px 32px; }
        .panel-header h2 { font-size: 15px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: 0.3px; }
        .stepper-wrapper { padding: 30px 40px; border-bottom: 1px dashed #e2e8f0; background: #f8fafc; border-radius: 12px 12px 0 0; }
        .ff-stepper { display: flex; justify-content: space-between; align-items: center; position: relative; }
        .ff-stepper::before { content: ''; position: absolute; top: 12px; left: 20px; right: 20px; height: 3px; background: #e2e8f0; z-index: 1; }
        .stepper-node { position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; gap: 8px; width: 60px; }
        .step-icon { width: 28px; height: 28px; border-radius: 50%; background: white; border: 3px solid #e2e8f0; display: flex; align-items: center; justify-content: center; color: #94a3b8; transition: 0.3s; }
        .dot { width: 8px; height: 8px; background: #cbd5e1; border-radius: 50%; }
        .step-label { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; text-align: center; line-height: 1.2; width: 80px; }
        .stepper-node.passed .step-icon { border-color: #10b981; background: #10b981; color: white; }
        .stepper-node.passed .step-label { color: #10b981; }
        .stepper-node.current .step-icon { border-color: #2563eb; background: white; }
        .stepper-node.current .dot { background: #2563eb; }
        .stepper-node.current .step-label { color: #2563eb; }
        .step-sub-label { position: absolute; top: 55px; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px; display: flex; align-items: center; gap: 4px; white-space: nowrap; }
        .step-sub-label.origin { background: #eff6ff; color: #1d4ed8; }
        .step-sub-label.dest { background: #f0fdf4; color: #15803d; }
        .data-rows-container { display: flex; flex-direction: column; }
        .data-row { padding: 24px 32px; border-bottom: 1px solid #f1f5f9; }
        .data-row.no-border { border-bottom: none; }
        .dr-header { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 800; color: #1e293b; text-transform: uppercase; margin-bottom: 16px; }
        .dr-grid { display: grid; gap: 20px; }
        .dr-grid.cols-4 { grid-template-columns: repeat(4, 1fr); }
        .dr-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
        .field { display: flex; flex-direction: column; gap: 4px; }
        .field label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
        .read-val { font-size: 14px; font-weight: 600; color: #0f172a; padding: 4px 0; }
        .font-mono { font-family: 'JetBrains Mono', monospace; font-size: 13px; }
        .text-blue { color: #2563eb; }
        .doc-verifier { padding: 4px 0; }
        .doc-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; }
        .doc-badge.ok { background: #dcfce7; color: #166534; }
        .doc-badge.warn { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; }
        .clean-table { width: 100%; border-collapse: collapse; }
        .clean-table th { text-align: left; padding: 16px 24px; font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
        .clean-table td { padding: 14px 24px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #0f172a; }
        .doc-type-label { display: flex; align-items: center; gap: 8px; font-weight: 600; color: #475569; }
        .doc-name-pill { background: #f1f5f9; padding: 4px 10px; border-radius: 6px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #2563eb; }
        .empty-italic { color: #94a3b8; font-style: italic; font-size: 12px; }
        .txt-right { text-align: right !important; }
        .btn-icon { background: white; border: 1px solid #cbd5e1; width: 28px; height: 28px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; color: #64748b; transition: 0.2s; }
        .btn-icon:hover { background: #f1f5f9; color: #0f172a; }
        .photos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 16px; }
        .photo-card { position: relative; aspect-ratio: 1; border-radius: 12px; overflow: hidden; background: #f1f5f9; border: 1px solid #e2e8f0; cursor: pointer; }
        .photo-img { width: 100%; height: 100%; object-fit: cover; }
        .photo-overlay { position: absolute; inset: 0; background: rgba(37,99,235,0.8); display: flex; align-items: center; justify-content: center; opacity: 0; transition: 0.2s; }
        .photo-card:hover .photo-overlay { opacity: 1; }
        .empty-box { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; color: #94a3b8; text-align: center; gap: 12px; background: #f8fafc; border-radius: 12px; border: 1px dashed #cbd5e1; }
        .empty-box p { margin: 0; font-size: 13px; font-weight: 500; }
        .loader-full { height: 100vh; display: flex; align-items: center; justify-content: center; color: #2563eb; }
        .toast-alert { position: fixed; bottom: 20px; right: 20px; padding: 12px 20px; border-radius: 8px; background: #1e293b; color: white; font-weight: 600; font-size: 13px; z-index: 1000; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
      `}</style>
    </ClientLayout>
  );
}