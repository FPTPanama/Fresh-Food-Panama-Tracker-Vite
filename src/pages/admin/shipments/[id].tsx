// @ts-nocheck
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
  Loader2, X, Globe, AlertCircle, ArrowRight, MapPin, Check,
  Scale, Plane, AlertTriangle, Clock, RefreshCw
} from "lucide-react";

// --- TIPOS ---
type ShipmentMilestone = { id?: string; type: string; at: string; note?: string | null; actor_email?: string | null; author?: { name: string } | null; };
type ShipmentFile = { id: string; kind: "doc" | "photo"; doc_type?: string | null; filename: string; created_at: string; url?: string | null; };
type ShipmentDetail = {
  id: string; code: string; origin?: string | null; destination: string; status: string; created_at: string;
  client_name?: string | null; product_name?: string | null; product_variety?: string | null;
  boxes?: number | null; pallets?: number | null; weight_kg?: number | null;
  flight_number?: string | null; awb?: string | null; caliber?: string | null; color?: string | null; brix_grade?: string | null;
  milestones: ShipmentMilestone[]; documents: ShipmentFile[]; photos: ShipmentFile[];
};

// --- LISTA COMPLETA DE DOCUMENTOS ---
const DOC_TYPES = [
  { v: "invoice", l: "Factura Comercial" },
  { v: "packing_list", l: "Packing List" },
  { v: "quality_report", l: "Certificado de Calidad" },
  { v: "additives_declaration", l: "Carta de Aditivos" },
  { v: "non_recyclable_plastics", l: "Declaración de Plásticos" },
  { v: "sanitary_general_info", l: "Declaración Sanitaria" },
  { v: "awb", l: "AWB / BL" },
  { v: "phytosanitary", l: "Certificado Fitosanitario" },
  { v: "eur1", l: "Certificado EUR1" },
  { v: "export_declaration", l: "Decl. Exportación" },
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

  const [activeSection, setActiveSection] = useState<'overview' | 'milestones' | 'docs' | 'photos' | 'timeline'>('overview');

  const [note, setNote] = useState("");
  const [flight, setFlight] = useState("");
  const [awb, setAwb] = useState("");
  const [caliber, setCaliber] = useState("");
  const [color, setColor] = useState("");
  const [brix, setBrix] = useState("");

  // --- ESTADOS DEL MEGA-MODAL ---
  const [docModal, setDocModal] = useState<string | null>(null);
  const [docPayload, setDocPayload] = useState<any>({});
  const [generatingDoc, setGeneratingDoc] = useState(false);

  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(async (shipmentId: string) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${getApiBase()}/.netlify/functions/getShipment?id=${shipmentId}&mode=admin`, { headers: { Authorization: `Bearer ${session?.access_token}` } });
      if (!res.ok) throw new Error("Fetch error");
      const json = await res.json();
      
      setData(json);
      setFlight(json.flight_number || "");
      setAwb(json.awb || "");
      setCaliber(json.caliber || "");
      setColor(json.color || "");
      setBrix(json.brix_grade || "");
    } catch (e) { showToast("Error al cargar embarque", "error"); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (r.ok) { setAuthReady(true); if (id) load(id); }
    })();
  }, [id, load]);

  // --- LOGICA DEL MEGA-MODAL (PRE-CARGA) ---
  const openDocModal = (docType: string) => {
    if (!data) return;
    
    let initialPayload: any = { date: new Date().toISOString().split('T')[0] };
    
    switch(docType) {
      case 'packing_list':
        initialPayload = {
          ...initialPayload,
          numPallets: data.pallets || 1,
          dimensions: "120 x 100 x 160 cm",
          boxTare: 0.8,
          palletTare: 25,
        };
        break;
      case 'quality_report':
        initialPayload = {
          ...initialPayload,
          caliber: data.caliber || "",
          color: data.color || "",
          brix: data.brix_grade || "",
          checks: {
            external_color: true, brix_level: true, size: true, translucency: true,
            peduncular_mold: true, internal_health: true, aroma: true,
            insects: true, packaging: true, paletization: true
          },
          verdict: 'Aprobado',
          observations: "Fruta en óptimas condiciones para exportación."
        };
        break;
      case 'additives_declaration':
        initialPayload = {
          ...initialPayload,
          recipient: "A QUIEN CORRESPONDA",
          additive: "Cera natural a base de plantas / Nature Seal",
          dosage: "Aplicación estándar Post-Cosecha"
        };
        break;
      case 'non_recyclable_plastics':
        initialPayload = {
          ...initialPayload,
          plasticType: "PET / Zunchos PP",
          gramsPerBox: 45,
          recycledContent: 0
        };
        break;
      case 'sanitary_general_info':
        initialPayload = {
          ...initialPayload,
          location: "La Chorrera, Panamá"
        };
        break;
    }

    setDocPayload(initialPayload);
    setDocModal(docType);
  };

  const handleConfirmGenerate = async () => {
    if (!data || !docModal) return;
    setGeneratingDoc(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch(`${getApiBase()}/.netlify/functions/generateShipmentDoc`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${session?.access_token}` 
        },
        body: JSON.stringify({
          shipmentId: data.id,
          docType: docModal,
          payload: docPayload 
        }),
      });

      const result = await res.json();

      if (!res.ok) throw new Error(result.error || "Error en el servidor al generar PDF");
      
      showToast(`¡Documento guardado!: ${result.fileName}`);
      setDocModal(null);
      
      load(data.id); 
    } catch (error: any) {
      console.error("Error de Generación:", error);
      showToast(error.message || "Error crítico al generar el documento", "error");
    } finally {
      setGeneratingDoc(false);
    }
  };

  const handleSyncInvoice = async () => {
    setBusy(true);
    showToast("Función de sincronización en desarrollo...");
    setTimeout(() => setBusy(false), 1000);
  };

  const timelineItems = useMemo(() => {
    if (!data?.milestones) return [];
    return data.milestones.map((m) => ({ id: m.id, type: m.type, created_at: m.at, note: m.note, author_name: m.actor_email || "Admin" }));
  }, [data?.milestones]);

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
          shipmentId: data?.id, type, note: note.trim(), flight_number: flight.trim(), awb: awb.trim(),
          caliber: caliber.trim(), color: color.trim(), brix_grade: brix.trim()
        }),
      });
      if (res.ok) { showToast("Hito registrado"); setNote(""); if (id) load(id); }
    } catch (e) { showToast("Error al actualizar", "error"); } finally { setBusy(false); }
  };

  async function upload(kind: "doc" | "photo", file: File, doc_type?: string) {
    if (!data) return;
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const bucket = kind === "doc" ? "shipment-docs" : "shipment-photos";
      const resUrl = await fetch(`${getApiBase()}/.netlify/functions/getUploadUrl`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ bucket, shipmentCode: data.code, filename: file.name }),
      });
      const { uploadUrl, path } = await resUrl.json();
      await fetch(uploadUrl, { method: "PUT", body: file });
      await fetch(`${getApiBase()}/.netlify/functions/registerFile`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ shipmentId: data.id, kind, doc_type, filename: file.name, storage_path: path, bucket }),
      });
      showToast(kind === 'doc' ? "Documento subido" : "Foto subida");
      load(data.id);
    } catch (e) { showToast("Error de subida", "error"); } finally { setBusy(false); }
  }

  async function deleteFile(fileId: string) {
    if (!confirm("¿Borrar archivo?")) return;
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${getApiBase()}/.netlify/functions/deleteFile`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ fileId, shipmentId: data?.id }),
      });
      showToast("Archivo eliminado");
      if (id) load(id);
    } finally { setBusy(false); }
  }

  async function download(fileId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${getApiBase()}/.netlify/functions/getDownloadUrl?fileId=${fileId}`, { headers: { Authorization: `Bearer ${session?.access_token}` } });
    const { url } = await res.json();
    window.open(url, "_blank");
  }

  if (!authReady || loading) return <div className="loader-full"><Loader2 className="animate-spin" size={40}/></div>;

  return (
    <AdminLayout title={`Expediente: ${data?.code}`}>
      {toast && <div className={`toast-alert ${toast.type}`}>{toast.msg}</div>}

      <div className="clean-container">
        
        <div className="clean-header">
          <div className="ch-left">
            <button onClick={() => navigate(-1)} className="btn-back-icon"><ArrowLeft size={18}/></button>
            <div className="ch-titles">
              <div className="title-row"><h1 className="ch-title">{data?.code}</h1><span className="status-pill-main">{labelStatus(data!.status)}</span></div>
              <p className="ch-sub"><strong>{data?.product_name}</strong> {data?.product_variety ? `(${data.product_variety})` : ''} • Cliente: {data?.client_name}</p>
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
            
            {activeSection === 'overview' && (
              <div className="section-panel no-padding">
                <div className="panel-header pad-24"><h2>Resumen del Embarque</h2></div>
                <div className="stepper-wrapper">
                  <div className="ff-stepper">
                    {CHAIN.map((step, idx) => {
                      const isPassed = CHAIN.indexOf(data?.status as any) >= idx;
                      const isCurrent = data?.status === step;
                      return (
                        <div className={`stepper-node ${isPassed ? 'passed' : ''} ${isCurrent ? 'current' : ''}`} key={step}>
                          <div className="step-icon">{isPassed ? <Check size={14} strokeWidth={3}/> : <div className="dot"></div>}</div>
                          <div className="step-label">{labelStatus(step)}</div>
                          {idx === 0 && <div className="step-sub-label origin"><MapPin size={10}/> {data?.origin || 'PTY'}</div>}
                          {idx === CHAIN.length - 1 && <div className="step-sub-label dest"><Globe size={10}/> {data?.destination || 'TBD'}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="data-rows-container">
                  <div className="data-row">
                    <div className="dr-header"><Package size={14}/> <span>Características del Producto</span></div>
                    <div className="dr-grid cols-4">
                      <div className="field"><label>Fruta</label><div className="read-val">{data?.product_name || '—'}</div></div>
                      <div className="field"><label>Variedad</label><div className="read-val">{data?.product_variety || '—'}</div></div>
                      <div className="field"><label>Color / Brix</label><div className="read-val">{data?.color ? `${data.color} / ${data?.brix_grade || '-'}` : (data?.brix_grade || '—')}</div></div>
                      <div className="field"><label>Calibre</label><div className="read-val">{data?.caliber || '—'}</div></div>
                    </div>
                  </div>

                  <div className="data-row">
                    <div className="dr-header"><Scale size={14}/> <span>Volumen de Carga</span></div>
                    <div className="dr-grid cols-3">
                      <div className="field"><label>Cajas</label><div className="read-val">{data?.boxes || 0}</div></div>
                      <div className="field"><label>Pallets</label><div className="read-val">{data?.pallets || 0}</div></div>
                      <div className="field"><label>Peso Bruto Total</label><div className="read-val">{(data?.weight_kg || 0).toLocaleString()} Kg</div></div>
                    </div>
                  </div>

                  <div className="data-row no-border">
                    <div className="dr-header"><Plane size={14}/> <span>Logística y Documentación</span></div>
                    <div className="dr-grid cols-3">
                      <div className="field"><label>Vuelo Asignado</label><div className="read-val font-mono text-blue">{data?.flight_number || 'Por asignar'}</div></div>
                      <div className="field"><label>AWB (Guía Aérea)</label><div className="read-val font-mono">{data?.awb || 'Por asignar'}</div></div>
                      <div className="field">
                        <label>Estado Documental</label>
                        <div className="doc-verifier">
                          {isDocsOk ? <span className="doc-badge ok"><CheckCircle size={14}/> Completa (OK)</span> : <span className="doc-badge warn"><AlertTriangle size={14}/> Faltan {missingDocsList.length} Docs</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'milestones' && (
              <div className="section-panel">
                <div className="panel-header"><h2>Actualizar Estado del Embarque</h2></div>
                <div className="pad-32">
                  <div className="milestone-form">
                    <div className="form-grid" style={{ padding: '0 0 20px 0' }}>
                      <div className="field"><label>Vuelo Confirmado</label><input value={flight} onChange={e => setFlight(e.target.value)} /></div>
                      <div className="field"><label>Número de AWB</label><input value={awb} onChange={e => setAwb(e.target.value)} /></div>
                      <div className="field"><label>Calibre Inspeccionado</label><input value={caliber} onChange={e => setCaliber(e.target.value)} /></div>
                      <div className="field">
                        <label>Color / Brix</label>
                        <div style={{display:'flex', gap:'8px', width: '100%'}}>
                          <input value={color} onChange={e => setColor(e.target.value)} placeholder="Color" style={{flex:1}}/>
                          <input value={brix} onChange={e => setBrix(e.target.value)} placeholder="Brix" style={{flex:1}}/>
                        </div>
                      </div>
                      <div className="field full-width">
                        <label>Notas del Hito (Opcional)</label>
                        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Observaciones durante esta etapa..." />
                      </div>
                    </div>

                    <div className="steps-container">
                      {CHAIN.map((s, index) => {
                        const isActive = data?.status === s;
                        const isPassed = CHAIN.indexOf(data?.status as MilestoneType) > index;
                        return (
                          <button key={s} className={`step-action-btn ${isActive ? 'current' : ''} ${isPassed ? 'passed' : ''}`} onClick={() => handleMark(s)} disabled={busy}>
                            {isPassed ? <Check size={18}/> : <span style={{fontSize: '16px'}}>{index + 1}</span>}
                            <span>{labelStatus(s)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'docs' && (
              <div className="section-panel no-padding">
                <div className="panel-header pad-24">
                  <h2>Documentos Operativos</h2>
                  <button className="btn-sync-invoice" onClick={handleSyncInvoice} disabled={busy}>
                    <RefreshCw size={14} className={busy ? 'animate-spin' : ''}/> Sincronizar Factura
                  </button>
                </div>
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
                      const isAutomated = ['packing_list', 'quality_report', 'non_recyclable_plastics', 'sanitary_general_info', 'additives_declaration'].includes(t.v);

                      return (
                        <tr key={t.v}>
                          <td className="doc-type-label"><FileText size={14}/> {t.l}</td>
                          <td>{doc ? <span className="doc-name-pill">{doc.filename}</span> : <span className="empty-italic">Pendiente</span>}</td>
                          <td className="txt-right">
                            <div className="doc-actions-group">
                              {doc ? (
                                <>
                                  <button className="btn-icon" onClick={() => download(doc.id)}><Download size={14}/></button>
                                  <button className="btn-icon danger" onClick={() => deleteFile(doc.id)}><X size={14}/></button>
                                </>
                              ) : (
                                <div className="action-buttons-flex">
                                  {isAutomated && (
                                    <button className="btn-auto-gen" onClick={() => openDocModal(t.v)} disabled={busy}>
                                      <PlusCircle size={14}/> Generar
                                    </button>
                                  )}
                                  <label className="btn-upload-minimal" title="Subir archivo manualmente">
                                    <Download size={14} style={{transform: 'rotate(180deg)'}}/>
                                    <input type="file" hidden onChange={e => e.target.files?.[0] && upload("doc", e.target.files[0], t.v)} />
                                  </label>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {activeSection === 'photos' && (
              <div className="section-panel">
                <div className="panel-header"><h2>Evidencia Visual</h2><label className="btn-primary-sm"><PlusCircle size={14}/> Subir Foto<input type="file" hidden accept="image/*" onChange={e => e.target.files?.[0] && upload("photo", e.target.files[0])} /></label></div>
                <div className="pad-32">
                  {data?.photos && data.photos.length > 0 ? (
                    <div className="photos-grid">
                      {data.photos.map(p => (
                        <div key={p.id} className="photo-card"><img src={p.url || ""} alt="Evidencia" className="photo-img" /><div className="photo-overlay"><button onClick={() => download(p.id)}><Download size={16}/></button><button onClick={() => deleteFile(p.id)} className="danger"><X size={16}/></button></div></div>
                      ))}
                    </div>
                  ) : <div className="empty-box"><ImageIcon size={32} color="#cbd5e1" /><p>No se han subido fotos.</p></div>}
                </div>
              </div>
            )}

            {activeSection === 'timeline' && (
              <div className="section-panel"><div className="panel-header"><h2>Línea de Tiempo Operativa</h2></div><div className="pad-32"><ModernTimeline milestones={timelineItems as any} /></div></div>
            )}
          </main>
        </div>
      </div>

      {/* ================= MEGA MODAL DE AUTO-GENERACIÓN ================= */}
      {docModal && (
        <div className="ff-modal-overlay">
          <div className="ff-modal-content">
            <div className="modal-header">
              <h3>
                {docModal === 'packing_list' && 'Configurar Packing List'}
                {docModal === 'quality_report' && 'Certificado de Control de Calidad'}
                {docModal === 'additives_declaration' && 'Carta de Aditivos (Ceras)'}
                {docModal === 'non_recyclable_plastics' && 'Declaración de Plásticos'}
                {docModal === 'sanitary_general_info' && 'Declaración Sanitaria'}
              </h3>
              <button onClick={() => setDocModal(null)} className="btn-close"><X size={20}/></button>
            </div>
            
            <div className="modal-body">
              <p className="modal-desc">Revisa y ajusta los valores antes de sellar el documento PDF. Los datos maestros (AWB, Factura, Cliente) se inyectarán automáticamente al generar el archivo.</p>
              
              {/* FORMULARIOS DEL MODAL ... */}
              {docModal === 'packing_list' && (
                <div className="form-grid">
                  <div className="field">
                    <label>Fecha de Emisión</label>
                    <input type="date" value={docPayload.date} onChange={e => setDocPayload({...docPayload, date: e.target.value})} />
                  </div>
                  <div className="field">
                    <label>Dimensiones por Pallet</label>
                    <input type="text" value={docPayload.dimensions} onChange={e => setDocPayload({...docPayload, dimensions: e.target.value})} />
                  </div>
                  <div className="field">
                    <label>Tara Cartón (Kg/Caja)</label>
                    <input type="number" step="any" value={docPayload.boxTare} onChange={e => setDocPayload({...docPayload, boxTare: parseFloat(e.target.value)})} />
                  </div>
                  <div className="field">
                    <label>Tara Pallet (Madera Kg)</label>
                    <input type="number" step="any" value={docPayload.palletTare} onChange={e => setDocPayload({...docPayload, palletTare: parseFloat(e.target.value)})} />
                  </div>
                </div>
              )}

              {/* FORM: QUALITY REPORT */}
              {docModal === 'quality_report' && (
                <div className="qc-form">
                  <div className="form-grid" style={{marginBottom: '16px'}}>
                    <div className="field"><label>Fecha Inspección</label><input type="date" value={docPayload.date} onChange={e => setDocPayload({...docPayload, date: e.target.value})} /></div>
                    <div className="field"><label>Calibre Mezclado</label><input type="text" value={docPayload.caliber} onChange={e => setDocPayload({...docPayload, caliber: e.target.value})} /></div>
                    <div className="field"><label>Color Predominante</label><input type="text" value={docPayload.color} onChange={e => setDocPayload({...docPayload, color: e.target.value})} /></div>
                    <div className="field"><label>Grados Brix</label><input type="text" value={docPayload.brix} onChange={e => setDocPayload({...docPayload, brix: e.target.value})} /></div>
                  </div>
                  
                  <label className="check-title">Parámetros de Calidad (Desmarcar si hay defectos mayores):</label>
                  <div className="checks-grid">
                    {Object.keys(docPayload.checks || {}).map((key) => (
                      <label key={key} className="check-item">
                        <input type="checkbox" checked={docPayload.checks[key]} onChange={e => setDocPayload({...docPayload, checks: {...docPayload.checks, [key]: e.target.checked}})} />
                        <span style={{fontSize: '11px'}}>{key.replace('_', ' ').toUpperCase()}</span>
                      </label>
                    ))}
                  </div>

                  <div className="form-grid" style={{marginTop: '16px'}}>
                    <div className="field full-width">
                      <label>Veredicto / Observaciones</label>
                      <input type="text" value={docPayload.observations} onChange={e => setDocPayload({...docPayload, observations: e.target.value})} />
                    </div>
                  </div>
                </div>
              )}

              {/* FORM: ADDITIVE LETTER */}
              {docModal === 'additives_declaration' && (
                <div className="form-grid">
                  <div className="field">
                    <label>Fecha Emisión</label>
                    <input type="date" value={docPayload.date} onChange={e => setDocPayload({...docPayload, date: e.target.value})} />
                  </div>
                  <div className="field">
                    <label>Dirigido A:</label>
                    <input type="text" value={docPayload.recipient} onChange={e => setDocPayload({...docPayload, recipient: e.target.value})} />
                  </div>
                  <div className="field full-width">
                    <label>Nombre del Aditivo / Cera</label>
                    <input type="text" value={docPayload.additive} onChange={e => setDocPayload({...docPayload, additive: e.target.value})} />
                  </div>
                  <div className="field full-width">
                    <label>Propósito / Dosis</label>
                    <input type="text" value={docPayload.dosage} onChange={e => setDocPayload({...docPayload, dosage: e.target.value})} />
                  </div>
                </div>
              )}

              {/* FORM: PLASTICS DECLARATION */}
              {docModal === 'non_recyclable_plastics' && (
                <div className="form-grid">
                  <div className="field">
                    <label>Fecha Emisión</label>
                    <input type="date" value={docPayload.date} onChange={e => setDocPayload({...docPayload, date: e.target.value})} />
                  </div>
                  <div className="field">
                    <label>Tipo de Plástico (Empaque)</label>
                    <input type="text" value={docPayload.plasticType} onChange={e => setDocPayload({...docPayload, plasticType: e.target.value})} />
                  </div>
                  <div className="field">
                    <label>Gramos por Caja</label>
                    <input type="number" value={docPayload.gramsPerBox} onChange={e => setDocPayload({...docPayload, gramsPerBox: parseFloat(e.target.value)})} />
                  </div>
                  <div className="field">
                    <label>% Contenido Reciclado</label>
                    <input type="number" value={docPayload.recycledContent} onChange={e => setDocPayload({...docPayload, recycledContent: parseFloat(e.target.value)})} />
                  </div>
                </div>
              )}

              {/* FORM: SANITARY DECLARATION */}
              {docModal === 'sanitary_general_info' && (
                <div className="form-grid">
                  <div className="field">
                    <label>Fecha Emisión</label>
                    <input type="date" value={docPayload.date} onChange={e => setDocPayload({...docPayload, date: e.target.value})} />
                  </div>
                  <div className="field full-width">
                    <label>Lugar de Expedición</label>
                    <input type="text" value={docPayload.location} onChange={e => setDocPayload({...docPayload, location: e.target.value})} />
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button onClick={() => setDocModal(null)} className="btn-cancel">Cancelar</button>
              <button onClick={handleConfirmGenerate} className="btn-confirm" disabled={generatingDoc}>
                {generatingDoc ? <Loader2 className="animate-spin" size={16}/> : <FileText size={16}/>}
                Generar Documento Final
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Estilos Completos y Corregidos */}
      <style>{`
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
        
        /* Modificado Form-Grid global para evitar Overflow */
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; width: 100%; }
        .dr-grid { display: grid; gap: 20px; }
        .dr-grid.cols-4 { grid-template-columns: repeat(4, 1fr); }
        .dr-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
        .field { display: flex; flex-direction: column; gap: 6px; width: 100%;}
        .field.full-width { grid-column: 1 / -1; }
        .field label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
        
        /* Regla estricta de Inputs */
        .field input, .field textarea { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; outline: none; transition: 0.2s; color: #0f172a; font-family: inherit;}
        .field input:focus, .field textarea:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
        .field textarea { min-height: 80px; resize: vertical; }

        /* Estilo Exclusivo de la Tarjeta de Hitos */
        .milestone-form { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.01);}
        
        /* Botones de Acción Nativos Corregidos */
        .steps-container { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 10px; padding-top: 24px; border-top: 1px solid #e2e8f0; }
        .step-action-btn { flex: 1; min-width: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 14px 10px; background: white; border: 1px dashed #cbd5e1; border-radius: 10px; cursor: pointer; transition: all 0.2s; color: #64748b; font-weight: 700; font-size: 11px; text-transform: uppercase; }
        .step-action-btn:hover:not(:disabled) { background: #f1f5f9; border-color: #94a3b8; color: #0f172a; }
        .step-action-btn.current { background: #eff6ff; border-color: #3b82f6; border-style: solid; color: #2563eb; box-shadow: 0 4px 12px rgba(37,99,235,0.1); }
        .step-action-btn.passed { background: #f0fdf4; border-color: #10b981; border-style: solid; color: #15803d; }
        .step-action-btn:disabled { opacity: 0.6; cursor: not-allowed; }

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
        .doc-actions-group { display: flex; gap: 8px; justify-content: flex-end; }
        .action-buttons-flex { display: flex; gap: 8px; justify-content: flex-end; align-items: center; }
        .btn-icon { background: white; border: 1px solid #cbd5e1; width: 28px; height: 28px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; color: #64748b; transition: 0.2s; }
        .btn-icon:hover { background: #f1f5f9; color: #0f172a; }
        .btn-icon.danger:hover { background: #fef2f2; border-color: #fecaca; color: #ef4444; }
        
        .btn-auto-gen { background: #fff7ed; color: #ea580c; border: 1px solid #fdba74; padding: 5px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; display: flex; align-items: center; gap: 5px; cursor: pointer; transition: 0.2s; }
        .btn-auto-gen:hover { background: #ffedd5; border-color: #f97316; }
        .btn-sync-invoice { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; }
        .btn-upload-minimal { color: #64748b; cursor: pointer; padding: 5px; display: flex; align-items: center; justify-content: center; background: #f1f5f9; border-radius: 6px; border: 1px solid #e2e8f0; width: 28px; height: 28px; transition: 0.2s;}
        .btn-upload-minimal:hover { background: #e2e8f0; color: #0f172a; }

        .btn-primary-sm { background: #2563eb; color: white; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: 0.2s; }
        .btn-primary-sm:hover { background: #1d4ed8; }
        .photos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 16px; }
        .photo-card { position: relative; aspect-ratio: 1; border-radius: 12px; overflow: hidden; background: #f1f5f9; border: 1px solid #e2e8f0; cursor: pointer; }
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

        /* Estilos del Modal */
        .ff-modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.7); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(4px); padding: 20px; overflow-y: auto;}
        .ff-modal-content { background: white; width: 100%; max-width: 550px; border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); animation: slideUp 0.3s ease; display: flex; flex-direction: column; max-height: 90vh;}
        .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; flex-shrink: 0;}
        .modal-header h3 { margin: 0; font-size: 16px; font-weight: 800; color: #0f172a; }
        .btn-close { background: transparent; border: none; color: #64748b; cursor: pointer; display: flex; align-items: center; transition: 0.2s; padding: 4px; border-radius: 4px;}
        .btn-close:hover { color: #ef4444; background: #fef2f2;}
        .modal-body { padding: 24px; overflow-y: auto; flex-grow: 1; }
        .modal-desc { margin: 0 0 20px 0; font-size: 13px; color: #64748b; line-height: 1.5;}
        .modal-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 20px 24px; border-top: 1px solid #e2e8f0; background: #f8fafc; flex-shrink: 0;}
        .btn-cancel { background: white; border: 1px solid #cbd5e1; padding: 10px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; color: #475569; transition: 0.2s; }
        .btn-cancel:hover { background: #f1f5f9; }
        .btn-confirm { background: #2563eb; color: white; border: none; padding: 10px 16px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s; }
        .btn-confirm:hover:not(:disabled) { background: #1d4ed8; }
        .btn-confirm:disabled { opacity: 0.6; cursor: not-allowed; }
        
        .check-title { display: block; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 10px; }
        .checks-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0;}
        .check-item { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #0f172a; cursor: pointer; }
        .check-item input[type="checkbox"] { width: 16px; height: 16px; accent-color: #2563eb; cursor: pointer;}
        
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </AdminLayout>
  );
}