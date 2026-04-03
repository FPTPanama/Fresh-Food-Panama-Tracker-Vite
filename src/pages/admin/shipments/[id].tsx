import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { getApiBase } from "@/lib/apiBase";
import { requireAdminOrRedirect } from "@/lib/requireAdmin";
import { AdminLayout } from "@/components/AdminLayout";
import { labelStatus } from "@/lib/shipmentFlow";
import { Timeline as ModernTimeline } from "@/components/Timeline";

import {
  FileText, Image as ImageIcon, Download, ClipboardCheck, 
  ArrowLeft, Package, PlusCircle, CheckCircle, 
  Loader2, X, Hash, Globe, AlertCircle, ArrowRight, Truck, MapPin, Check,
  Scale, Plane, AlertTriangle, Clock
} from "lucide-react";

// --- TIPOS ---
type ShipmentMilestone = { 
  id?: string;
  type: string; 
  at: string; 
  note?: string | null; 
  actor_email?: string | null;
  author?: { name: string } | null; 
};

type ShipmentFile = { 
  id: string; 
  kind: "doc" | "photo";
  doc_type?: string | null; 
  filename: string; 
  created_at: string; 
  url?: string | null;
};

type ShipmentDetail = {
  id: string; 
  code: string; 
  origin?: string | null;
  destination: string; 
  status: string; 
  created_at: string;
  client_name?: string | null;
  product_name?: string | null;
  product_variety?: string | null;
  boxes?: number | null;
  pallets?: number | null;
  weight_kg?: number | null;
  flight_number?: string | null;
  awb?: string | null;
  calibre?: string | null;
  color?: string | null;
  brix_grade?: string | null; // Added brix
  milestones: ShipmentMilestone[];
  documents: ShipmentFile[];
  photos: ShipmentFile[];
};

const DOC_TYPES = [
  { v: "invoice", l: "Factura" },
  { v: "packing_list", l: "Packing list" },
  { v: "awb", l: "AWB (Guía Aérea)" },
  { v: "phytosanitary", l: "Certificado Fitosanitario" },
  { v: "eur1", l: "Certificado EUR1" },
  { v: "export_declaration", l: "Decl. Exportación" },
  { v: "quality_report", l: "Informe de Calidad" },
] as const;

type MilestoneType = "PACKED" | "DOCS_READY" | "AT_ORIGIN" | "IN_TRANSIT" | "AT_DESTINATION";
const CHAIN: MilestoneType[] = ["PACKED", "DOCS_READY", "AT_ORIGIN", "IN_TRANSIT", "AT_DESTINATION"];

export default function AdminShipmentDetail() {
  const { id } = useParams(); 
  const navigate = useNavigate();

  const [authReady, setAuthReady] = useState(false);
  const [data, setData] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // NAVEGACIÓN VERTICAL
  const [activeSection, setActiveSection] = useState<'overview' | 'milestones' | 'docs' | 'photos' | 'timeline'>('overview');

  // FORMULARIO DE HITOS
  const [note, setNote] = useState("");
  const [flight, setFlight] = useState("");
  const [awb, setAwb] = useState("");
  const [caliber, setCaliber] = useState("");
  const [color, setColor] = useState("");
  const [brix, setBrix] = useState("");

  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async (shipmentId: string) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${getApiBase()}/.netlify/functions/getShipment?id=${shipmentId}&mode=admin`, {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      if (!res.ok) throw new Error("Fetch error");
      const json = await res.json();
      
      setData(json);
      setFlight(json.flight_number || "");
      setAwb(json.awb || "");
      setCaliber(json.calibre || "");
      setColor(json.color || "");
      setBrix(json.brix_grade || "");
    } catch (e) {
      showToast("Error al cargar embarque", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (r.ok) {
        setAuthReady(true);
        if (id) load(id);
      }
    })();
  }, [id, load]);

  const timelineItems = useMemo(() => {
    if (!data?.milestones) return [];
    return data.milestones.map((m) => ({
      id: m.id,
      type: m.type,
      created_at: m.at,
      note: m.note,
      author_name: m.actor_email || "Admin"
    }));
  }, [data?.milestones]);

  // --- LÓGICA DEL VERIFICADOR DOCUMENTAL ---
  const missingDocsList = useMemo(() => {
    if (!data?.documents) return DOC_TYPES.map(d => d.l);
    return DOC_TYPES.filter(t => !data.documents.some(d => d.doc_type === t.v)).map(t => t.l);
  }, [data?.documents]);
  const isDocsOk = missingDocsList.length === 0;

  const handleMark = async (type: MilestoneType) => {
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${getApiBase()}/.netlify/functions/updateMilestone`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          shipmentId: data?.id, 
          type, 
          note: note.trim(),
          flight_number: flight.trim(), 
          awb: awb.trim(),
          calibre: caliber.trim(),
          color: color.trim(),
          brix_grade: brix.trim()
        }),
      });
      if (res.ok) {
        showToast("Hito registrado y embarque actualizado");
        setNote("");
        if (id) load(id);
      }
    } catch (e) {
      showToast("Error al actualizar", "error");
    } finally {
      setBusy(false);
    }
  };

  async function upload(kind: "doc" | "photo", file: File, doc_type?: string) {
    if (!data) return;
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const bucket = kind === "doc" ? "shipment-docs" : "shipment-photos";

      const resUrl = await fetch(`${getApiBase()}/.netlify/functions/getUploadUrl`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bucket, shipmentCode: data.code, filename: file.name }),
      });
      const { uploadUrl, path } = await resUrl.json();

      await fetch(uploadUrl, { method: "PUT", body: file });
      
      await fetch(`${getApiBase()}/.netlify/functions/registerFile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          shipmentId: data.id, kind, doc_type,
          filename: file.name, storage_path: path, bucket,
        }),
      });
      showToast(kind === 'doc' ? "Documento subido" : "Foto subida");
      load(data.id);
    } catch (e) {
      showToast("Error de subida", "error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteFile(fileId: string) {
    if (!confirm("¿Borrar archivo permanentemente?")) return;
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${getApiBase()}/.netlify/functions/deleteFile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ fileId, shipmentId: data?.id }),
      });
      showToast("Archivo eliminado");
      if (id) load(id);
    } finally {
      setBusy(false);
    }
  }

  async function download(fileId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${getApiBase()}/.netlify/functions/getDownloadUrl?fileId=${fileId}`, {
      headers: { Authorization: `Bearer ${session?.access_token}` }
    });
    const { url } = await res.json();
    window.open(url, "_blank");
  }

  if (!authReady || loading) return <div className="loader-full"><Loader2 className="animate-spin" size={40}/></div>;

  return (
    <AdminLayout title={`Expediente: ${data?.code}`}>
      {toast && <div className={`toast-alert ${toast.type}`}>{toast.msg}</div>}

      <div className="clean-container">
        
        {/* HEADER COMPACTO */}
        <div className="clean-header">
          <div className="ch-left">
            <button onClick={() => navigate(-1)} className="btn-back-icon" title="Volver"><ArrowLeft size={18}/></button>
            <div className="ch-titles">
              <div className="title-row">
                <h1 className="ch-title">{data?.code}</h1>
                <span className="status-pill-main">{labelStatus(data!.status)}</span>
              </div>
              <p className="ch-sub">
                <strong>{data?.product_name}</strong> {data?.product_variety ? `(${data.product_variety})` : ''} • Cliente: {data?.client_name}
              </p>
            </div>
          </div>
          <div className="ch-right">
            <div className="ch-stats">
              <div className="stat-block"><span className="s-val">{data?.boxes || 0}</span><span className="s-lab">Cajas</span></div>
              <div className="stat-block"><span className="s-val">{data?.pallets || 0}</span><span className="s-lab">Pallets</span></div>
              <div className="stat-block"><span className="s-val">{(data?.weight_kg || 0).toLocaleString()} <small>Kg</small></span><span className="s-lab">Peso Bruto</span></div>
            </div>
          </div>
        </div>

        {/* LAYOUT VERTICAL TABS */}
        <div className="clean-layout">
          
          <aside className="clean-sidebar">
            <nav className="side-nav">
              <button className={`nav-item ${activeSection === 'overview' ? 'active' : ''}`} onClick={() => setActiveSection('overview')}><MapPin size={16}/> Resumen Operativo</button>
              <button className={`nav-item ${activeSection === 'milestones' ? 'active' : ''}`} onClick={() => setActiveSection('milestones')}><ClipboardCheck size={16}/> Gestión de Hitos</button>
              <button className={`nav-item ${activeSection === 'docs' ? 'active' : ''}`} onClick={() => setActiveSection('docs')}><FileText size={16}/> Docs. Operativos</button>
              <button className={`nav-item ${activeSection === 'photos' ? 'active' : ''}`} onClick={() => setActiveSection('photos')}><ImageIcon size={16}/> Evidencia Visual</button>
              <button className={`nav-item ${activeSection === 'timeline' ? 'active' : ''}`} onClick={() => setActiveSection('timeline')}><Clock size={16}/> Línea de Tiempo</button>
            </nav>
          </aside>

          <main className="clean-content">
            
            {/* --- SECCIÓN 1: RESUMEN OPERATIVO (NUEVO DISEÑO) --- */}
            {activeSection === 'overview' && (
              <div className="section-panel no-padding">
                <div className="panel-header pad-24"><h2>Resumen del Embarque</h2></div>
                
                {/* STEPPER DE PROGRESO */}
                <div className="stepper-wrapper">
                  <div className="ff-stepper">
                    {CHAIN.map((step, idx) => {
                      const isPassed = CHAIN.indexOf(data?.status as any) >= idx;
                      const isCurrent = data?.status === step;
                      const isFirst = idx === 0;
                      const isLast = idx === CHAIN.length - 1;

                      return (
                        <div className={`stepper-node ${isPassed ? 'passed' : ''} ${isCurrent ? 'current' : ''}`} key={step}>
                          <div className="step-icon">{isPassed ? <Check size={14} strokeWidth={3}/> : <div className="dot"></div>}</div>
                          <div className="step-label">{labelStatus(step)}</div>
                          
                          {/* Anclajes de Origen y Destino */}
                          {isFirst && <div className="step-sub-label origin"><MapPin size={10}/> {data?.origin || 'PTY'}</div>}
                          {isLast && <div className="step-sub-label dest"><Globe size={10}/> {data?.destination || 'TBD'}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="data-rows-container">
                  {/* FILA 1: PRODUCTO */}
                  <div className="data-row">
                    <div className="dr-header"><Package size={14}/> <span>Características del Producto</span></div>
                    <div className="dr-grid cols-4">
                      <div className="field"><label>Fruta</label><div className="read-val">{data?.product_name || '—'}</div></div>
                      <div className="field"><label>Variedad</label><div className="read-val">{data?.product_variety || '—'}</div></div>
                      <div className="field"><label>Color / Brix</label><div className="read-val">{data?.color ? `${data.color} / ${data?.brix_grade || '-'}` : (data?.brix_grade || '—')}</div></div>
                      <div className="field"><label>Calibre</label><div className="read-val">{data?.calibre || '—'}</div></div>
                    </div>
                  </div>

                  {/* FILA 2: VOLUMEN */}
                  <div className="data-row">
                    <div className="dr-header"><Scale size={14}/> <span>Volumen de Carga</span></div>
                    <div className="dr-grid cols-3">
                      <div className="field"><label>Cajas</label><div className="read-val">{data?.boxes || 0}</div></div>
                      <div className="field"><label>Pallets</label><div className="read-val">{data?.pallets || 0}</div></div>
                      <div className="field"><label>Peso Bruto Total</label><div className="read-val">{(data?.weight_kg || 0).toLocaleString()} Kg</div></div>
                    </div>
                  </div>

                  {/* FILA 3: LOGÍSTICA Y DOCS */}
                  <div className="data-row no-border">
                    <div className="dr-header"><Plane size={14}/> <span>Logística y Documentación</span></div>
                    <div className="dr-grid cols-3">
                      <div className="field"><label>Vuelo Asignado</label><div className="read-val font-mono text-blue">{data?.flight_number || 'Por asignar'}</div></div>
                      <div className="field"><label>AWB (Guía Aérea)</label><div className="read-val font-mono">{data?.awb || 'Por asignar'}</div></div>
                      
                      {/* VERIFICADOR DOCUMENTAL */}
                      <div className="field">
                        <label>Estado Documental</label>
                        <div className="doc-verifier">
                          {isDocsOk ? (
                            <span className="doc-badge ok"><CheckCircle size={14}/> Completa (OK)</span>
                          ) : (
                            <div className="ff-tooltip-wrapper tooltip-trigger">
                              <span className="doc-badge warn"><AlertTriangle size={14}/> Faltan {missingDocsList.length} Docs</span>
                              <div className="ff-tooltip-content loc-tooltip">
                                <strong>Pendientes de subir:</strong>
                                <ul className="missing-list">
                                  {missingDocsList.map(d => <li key={d}>- {d}</li>)}
                                </ul>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* --- SECCIÓN 2: GESTIÓN DE HITOS --- */}
            {activeSection === 'milestones' && (
              <div className="section-panel">
                <div className="panel-header"><h2>Actualizar Estado del Embarque</h2></div>
                <div className="pad-32">
                  <p className="section-desc">Modifica los datos operativos y registra el avance en la cadena logística.</p>
                  
                  <div className="milestone-form">
                    <div className="form-grid" style={{ padding: '0 0 20px 0' }}>
                      <div className="field"><label>Vuelo Confirmado</label><input value={flight} onChange={e => setFlight(e.target.value)} placeholder="Ej: IB7564" /></div>
                      <div className="field"><label>Número de AWB</label><input value={awb} onChange={e => setAwb(e.target.value)} placeholder="Ej: 074-12345678" /></div>
                      <div className="field"><label>Calibre Inspeccionado</label><input value={caliber} onChange={e => setCaliber(e.target.value)} placeholder="Ej: 5-6" /></div>
                      <div className="field">
                        <label>Color / Brix</label>
                        <div style={{display:'flex', gap:'8px'}}>
                          <input value={color} onChange={e => setColor(e.target.value)} placeholder="Color (2.5)" style={{flex:1}}/>
                          <input value={brix} onChange={e => setBrix(e.target.value)} placeholder="Brix (>13)" style={{flex:1}}/>
                        </div>
                      </div>
                      <div className="field full-width">
                        <label>Notas del Hito (Opcional)</label>
                        <textarea className="text-in" value={note} onChange={e => setNote(e.target.value)} placeholder="Observaciones sobre la carga, retrasos o novedades..."/>
                      </div>
                    </div>

                    <div className="milestone-actions">
                      <label className="ma-label">Registrar Nuevo Estado:</label>
                      <div className="steps-container">
                        {CHAIN.map((s, index) => {
                          const isActive = data?.status === s;
                          const isPassed = CHAIN.indexOf(data?.status as MilestoneType) > index;
                          return (
                            <button key={s} className={`step-action-btn ${isActive ? 'current' : ''} ${isPassed ? 'passed' : ''}`} onClick={() => handleMark(s)} disabled={busy}>
                              {isPassed ? <Check size={14}/> : (index + 1)}
                              <span>{labelStatus(s)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- SECCIÓN 3: DOCUMENTOS --- */}
            {activeSection === 'docs' && (
              <div className="section-panel no-padding">
                <div className="panel-header pad-24"><h2>Documentos Operativos</h2></div>
                <table className="clean-table">
                  <thead>
                    <tr>
                      <th style={{width: '40%'}}>Tipo de Documento</th>
                      <th style={{width: '30%'}}>Archivo</th>
                      <th style={{width: '30%'}} className="txt-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DOC_TYPES.map(t => {
                      const doc = data?.documents?.find(d => d.doc_type === t.v);
                      return (
                        <tr key={t.v}>
                          <td className="doc-type-label"><FileText size={14}/> {t.l}</td>
                          <td>{doc ? <span className="doc-name-pill">{doc.filename}</span> : <span className="empty-italic">Pendiente</span>}</td>
                          <td className="txt-right">
                            {doc ? (
                              <div className="doc-actions">
                                <button className="btn-icon" onClick={() => download(doc.id)} title="Descargar"><Download size={14}/></button>
                                <button className="btn-icon danger" onClick={() => deleteFile(doc.id)} title="Eliminar"><X size={14}/></button>
                              </div>
                            ) : (
                              <label className="btn-upload-inline">
                                <PlusCircle size={14}/> Subir
                                <input type="file" hidden onChange={e => e.target.files?.[0] && upload("doc", e.target.files[0], t.v)} />
                              </label>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* --- SECCIÓN 4: FOTOS --- */}
            {activeSection === 'photos' && (
              <div className="section-panel">
                <div className="panel-header">
                  <h2>Evidencia Visual</h2>
                  <label className="btn-primary-sm">
                    <PlusCircle size={14}/> Subir Foto
                    <input type="file" hidden accept="image/*" onChange={e => e.target.files?.[0] && upload("photo", e.target.files[0])} />
                  </label>
                </div>
                
                <div className="pad-32">
                  {data?.photos && data.photos.length > 0 ? (
                    <div className="photos-grid">
                      {data.photos.map(p => (
                        <div key={p.id} className="photo-card">
                          <img src={p.url || ""} alt="Evidencia" className="photo-img" />
                          <div className="photo-overlay">
                            <button onClick={() => download(p.id)}><Download size={16}/></button>
                            <button onClick={() => deleteFile(p.id)} className="danger"><X size={16}/></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-box">
                      <ImageIcon size={32} color="#cbd5e1" />
                      <p>No se han subido fotos de la carga aún.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- SECCIÓN 5: TIMELINE --- */}
            {activeSection === 'timeline' && (
              <div className="section-panel">
                <div className="panel-header"><h2>Línea de Tiempo Operativa</h2></div>
                <div className="pad-32">
                  <ModernTimeline milestones={timelineItems as any} />
                </div>
              </div>
            )}

          </main>
        </div>
      </div>

      <style>{`
        /* VARIABLES Y RESET */
        .clean-container { max-width: 1100px; margin: 0 auto; padding: 20px; font-family: 'Inter', sans-serif; color: #0f172a; }
        
        /* HEADER COMPACTO */
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

        /* LAYOUT SPLIT */
        .clean-layout { display: grid; grid-template-columns: 220px 1fr; gap: 32px; align-items: start; }
        
        /* SIDEBAR */
        .side-nav { display: flex; flex-direction: column; gap: 4px; position: sticky; top: 20px; }
        .nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 8px; border: none; background: transparent; font-size: 13px; font-weight: 600; color: #64748b; cursor: pointer; text-align: left; transition: 0.2s; }
        .nav-item:hover { background: #f1f5f9; color: #0f172a; }
        .nav-item.active { background: #eff6ff; color: #2563eb; font-weight: 700; }

        /* PANEL BLANCO DE CONTENIDO */
        .clean-content { background: white; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 2px 10px rgba(0,0,0,0.02); min-height: 400px; }
        .section-panel { display: flex; flex-direction: column; }
        .section-panel.no-padding { padding: 0; }
        .panel-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid #f1f5f9; }
        .pad-24 { padding: 20px 24px; }
        .pad-32 { padding: 24px 32px; }
        .panel-header h2 { font-size: 15px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: 0.3px; }
        .section-desc { font-size: 13px; color: #64748b; margin: 0 0 24px 0; }

        /* ================= RESUMEN OPERATIVO (NUEVO) ================= */
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

        /* VERIFICADOR DOCUMENTAL Y TOOLTIP */
        .doc-verifier { padding: 4px 0; }
        .doc-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; }
        .doc-badge.ok { background: #dcfce7; color: #166534; }
        .doc-badge.warn { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; cursor: help; }

        .ff-tooltip-wrapper { position: relative; display: inline-block; }
        .ff-tooltip-content {
          position: absolute; bottom: 130%; left: 50%; transform: translateX(-50%) translateY(10px);
          background: #1e293b; color: white; padding: 12px 16px; border-radius: 10px;
          font-size: 11px; font-weight: 500; white-space: nowrap; z-index: 100;
          opacity: 0; visibility: hidden; pointer-events: none; transition: all 0.2s ease;
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.2); min-width: 180px;
        }
        .ff-tooltip-content::after {
          content: ''; position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
          border-width: 6px; border-style: solid; border-color: #1e293b transparent transparent transparent;
        }
        .ff-tooltip-wrapper:hover .ff-tooltip-content { opacity: 1; visibility: visible; transform: translateX(-50%) translateY(0); }
        .missing-list { list-style: none; padding: 0; margin: 6px 0 0 0; color: #cbd5e1; }
        .missing-list li { margin-bottom: 2px; }

        /* GESTIÓN DE HITOS */
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .field input, .text-in { padding: 10px 12px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 13px; outline: none; transition: 0.2s; width: 100%; box-sizing: border-box; }
        .field input:focus, .text-in:focus { border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,0.1); }
        .text-in { min-height: 80px; resize: vertical; font-family: inherit; }
        .full-width { grid-column: 1 / -1; }
        
        .milestone-actions { border-top: 1px solid #f1f5f9; padding-top: 24px; }
        .ma-label { display: block; font-size: 11px; font-weight: 800; color: #1e293b; text-transform: uppercase; margin-bottom: 12px; }
        .steps-container { display: flex; gap: 10px; }
        .step-action-btn { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 6px; background: white; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 10px; font-weight: 700; color: #64748b; cursor: pointer; transition: 0.2s; text-transform: uppercase; }
        .step-action-btn:hover:not(:disabled) { border-color: #2563eb; color: #2563eb; background: #eff6ff; }
        .step-action-btn.current { background: #10b981; border-color: #10b981; color: white; }
        .step-action-btn.passed { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
        .step-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* TABLA DOCUMENTOS */
        .clean-table { width: 100%; border-collapse: collapse; }
        .clean-table th { text-align: left; padding: 16px 24px; font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
        .clean-table td { padding: 14px 24px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #0f172a; }
        .doc-type-label { display: flex; align-items: center; gap: 8px; font-weight: 600; color: #475569; }
        .doc-name-pill { background: #f1f5f9; padding: 4px 10px; border-radius: 6px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #2563eb; }
        .empty-italic { color: #94a3b8; font-style: italic; font-size: 12px; }
        .txt-right { text-align: right !important; }
        
        .doc-actions { display: flex; gap: 8px; justify-content: flex-end; }
        .btn-icon { background: white; border: 1px solid #cbd5e1; width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #64748b; transition: 0.2s; }
        .btn-icon:hover { background: #f1f5f9; color: #0f172a; }
        .btn-icon.danger:hover { background: #fef2f2; border-color: #fecaca; color: #ef4444; }
        
        .btn-upload-inline { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: #2563eb; background: #eff6ff; padding: 6px 12px; border-radius: 6px; cursor: pointer; transition: 0.2s; }
        .btn-upload-inline:hover { background: #dbeafe; }

        /* FOTOS */
        .btn-primary-sm { background: #2563eb; color: white; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: 0.2s; }
        .btn-primary-sm:hover { background: #1d4ed8; }
        .photos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 16px; }
        .photo-card { position: relative; aspect-ratio: 1; border-radius: 12px; overflow: hidden; background: #f1f5f9; border: 1px solid #e2e8f0; }
        .photo-img { width: 100%; height: 100%; object-fit: cover; }
        .photo-overlay { position: absolute; inset: 0; background: rgba(15,23,42,0.6); display: flex; gap: 8px; align-items: center; justify-content: center; opacity: 0; transition: 0.2s; }
        .photo-card:hover .photo-overlay { opacity: 1; }
        .photo-overlay button { background: white; border: none; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #0f172a; }
        .photo-overlay button.danger { color: #ef4444; }
        
        .empty-box { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; color: #94a3b8; text-align: center; gap: 12px; background: #f8fafc; border-radius: 12px; border: 1px dashed #cbd5e1; }
        .empty-box p { margin: 0; font-size: 13px; font-weight: 500; }

        .loader-full { height: 100vh; display: flex; align-items: center; justify-content: center; color: #2563eb; }
        .toast-alert { position: fixed; bottom: 20px; right: 20px; padding: 12px 20px; border-radius: 8px; background: #1e293b; color: white; font-weight: 600; font-size: 13px; z-index: 1000; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .toast-alert.error { background: #ef4444; }
      `}</style>
    </AdminLayout>
  );
}