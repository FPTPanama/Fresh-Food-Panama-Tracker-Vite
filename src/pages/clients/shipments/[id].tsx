import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { getApiBase } from "@/lib/apiBase";
import { ClientLayout } from "@/components/ClientLayout";
import { useUILang } from "@/lib/uiLanguage";
import { Timeline as ModernTimeline } from "@/components/Timeline";

import {
  FileText, Image as ImageIcon, Download, ArrowLeft, Package, CheckCircle, 
  Loader2, Globe, MapPin, Check, Scale, Plane, Clock, Ship,
  MessageSquare
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
  product_mode?: string | null;
  boxes?: number | null;
  pallets?: number | null;
  weight_kg?: number | null;
  flight_number?: string | null;
  // 👇 Agrega estas dos líneas para que TS deje de quejarse
  flight_departure_time?: string | null;
  flight_arrival_time?: string | null;
  // 👆 
  awb?: string | null;
  calibre?: string | null;
  color?: string | null;
  brix_grade?: string | null;
  milestones: ShipmentMilestone[];
  documents: ShipmentFile[];
  photos: ShipmentFile[];
};

export default function ClientShipmentDetail() {
  const { id } = useParams(); 
  const navigate = useNavigate();
  const { lang } = useUILang();

  const [data, setData] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'overview' | 'docs' | 'photos' | 'timeline'>('overview');

  const DOC_TYPES = useMemo(() => [
    { v: "invoice", l: lang === 'es' ? "Factura Comercial" : "Commercial Invoice" },
    { v: "packing_list", l: lang === 'es' ? "Packing list" : "Packing List" },
    { v: "awb", l: lang === 'es' ? "AWB / BL" : "AWB / BL" },
    { v: "phytosanitary", l: lang === 'es' ? "Cert. Fitosanitario" : "Phytosanitary Cert." },
    { v: "eur1", l: lang === 'es' ? "Certificado EUR1" : "EUR1 Certificate" },
    { v: "export_declaration", l: lang === 'es' ? "Decl. Exportación" : "Export Declaration" },
    { v: "quality_report", l: lang === 'es' ? "Informe de Calidad" : "Quality Report" },
  ], [lang]);

  const STEPS = useMemo(() => [
    { type: "CREATED", label: lang === 'es' ? "Origen" : "Origin" },
    { type: "PACKED", label: lang === 'es' ? "Empaque" : "Packed" },
    { type: "DOCS_READY", label: lang === 'es' ? "Docs" : "Docs" },
    { type: "AT_ORIGIN", label: lang === 'es' ? "Terminal" : "Terminal" },
    { type: "IN_TRANSIT", label: lang === 'es' ? "Tránsito" : "In Transit" },
    { type: "AT_DESTINATION", label: lang === 'es' ? "Destino" : "Destination" },
  ], [lang]);
  
  const CHAIN = ["CREATED", "PACKED", "DOCS_READY", "AT_ORIGIN", "IN_TRANSIT", "AT_DESTINATION"];

  const labelStatus = (status: string) => {
    const s = status?.toLowerCase() || '';
    switch(s) {
      case 'created': return lang === 'es' ? 'CREADO' : 'CREATED';
      case 'packed': return lang === 'es' ? 'EMPACADO' : 'PACKED';
      case 'docs_ready': return lang === 'es' ? 'DOCUMENTACIÓN LISTA' : 'DOCS READY';
      case 'at_origin': return lang === 'es' ? 'EN TERMINAL DE ORIGEN' : 'AT ORIGIN TERMINAL';
      case 'in_transit': return lang === 'es' ? 'EN TRÁNSITO' : 'IN TRANSIT';
      case 'at_destination': return lang === 'es' ? 'EN DESTINO' : 'ARRIVED AT DESTINATION';
      case 'delivered': return lang === 'es' ? 'ENTREGADO' : 'DELIVERED';
      default: return s.toUpperCase();
    }
  };

  const load = useCallback(async (shipmentId: string) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/login'); return; }
      
      const res = await fetch(`${getApiBase()}/.netlify/functions/getShipment?id=${shipmentId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (!res.ok) throw new Error("Fetch error");
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error("Error loading shipment details:", e);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { if (id) load(id); }, [id, load]);

  const timelineItems = useMemo(() => {
    if (!data?.milestones) return [];
    return data.milestones.map((m) => ({
      id: m.id,
      type: m.type,
      created_at: m.at,
      note: m.note,
      author_name: "Fresh Food Panamá" 
    }));
  }, [data?.milestones]);

  async function download(fileId: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${getApiBase()}/.netlify/functions/getDownloadUrl?fileId=${fileId}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      const { url } = await res.json();
      window.open(url, "_blank");
    } catch (error) {
      console.error("Error downloading file:", error);
      alert(lang === 'es' ? "Error al descargar el archivo." : "Error downloading file.");
    }
  }

  // Calcular índice actual para la barra de progreso
  const currentStepIndex = CHAIN.indexOf(data?.status || 'CREATED');
  const progressPct = Math.max(0, (currentStepIndex / (STEPS.length - 1)) * 100);

  if (loading) return (
    <ClientLayout title={lang === 'es' ? "Detalle del Embarque" : "Shipment Details"}>
      <div className="loader-full">
        <Loader2 className="animate-spin text-brand" size={40}/>
        <p className="ff-sync-text">{lang === 'es' ? 'Cargando expediente...' : 'Loading dossier...'}</p>
      </div>
    </ClientLayout>
  );

  return (
    <ClientLayout title={lang === 'es' ? "Expediente de Carga" : "Cargo Dossier"} subtitle={data?.code}>
      <div className="clean-container">
        
        {/* HEADER COMPACTO CORPORATIVO */}
        <div className="clean-header">
          <div className="ch-left">
            <button onClick={() => navigate(-1)} className="btn-back-icon" title={lang === 'es' ? 'Volver' : 'Back'}><ArrowLeft size={18}/></button>
            <div className="ch-titles">
              <div className="title-row">
                <h1 className="ch-title">{data?.code}</h1>
                <span className="status-pill-main">{labelStatus(data!.status)}</span>
              </div>
              <p className="ch-sub">
                <strong>{data?.product_name}</strong> {data?.product_variety ? `(${data.product_variety})` : ''}
              </p>
            </div>
          </div>
          <div className="ch-right">
            <div className="ch-stats">
              <div className="stat-block"><span className="s-val">{data?.boxes || 0}</span><span className="s-lab">{lang === 'es' ? 'Cajas' : 'Boxes'}</span></div>
              <div className="stat-block"><span className="s-val">{data?.pallets || 0}</span><span className="s-lab">Pallets</span></div>
              <div className="stat-block"><span className="s-val">{(data?.weight_kg || 0).toLocaleString()} <small>Kg</small></span><span className="s-lab">{lang === 'es' ? 'Peso Bruto' : 'Gross WGT'}</span></div>
            </div>
          </div>
        </div>

        {/* LAYOUT VERTICAL TABS */}
        <div className="clean-layout">
          
          <aside className="clean-sidebar">
            <nav className="side-nav">
              <button className={`nav-item ${activeSection === 'overview' ? 'active' : ''}`} onClick={() => setActiveSection('overview')}>
                <MapPin size={16}/> {lang === 'es' ? 'Resumen Operativo' : 'Operations Overview'}
              </button>
              <button className={`nav-item ${activeSection === 'docs' ? 'active' : ''}`} onClick={() => setActiveSection('docs')}>
                <FileText size={16}/> {lang === 'es' ? 'Documentación' : 'Documentation'}
              </button>
              <button className={`nav-item ${activeSection === 'photos' ? 'active' : ''}`} onClick={() => setActiveSection('photos')}>
                <ImageIcon size={16}/> {lang === 'es' ? 'Evidencia Visual' : 'Visual Evidence'}
              </button>
              <button className={`nav-item ${activeSection === 'timeline' ? 'active' : ''}`} onClick={() => setActiveSection('timeline')}>
                <Clock size={16}/> {lang === 'es' ? 'Línea de Tiempo' : 'Timeline'}
              </button>
            </nav>
          </aside>

          <main className="clean-content">
            
            {/* --- SECCIÓN 1: RESUMEN OPERATIVO --- */}
            {activeSection === 'overview' && (
              <div className="section-panel no-padding">
                <div className="panel-header pad-24"><h2>{lang === 'es' ? 'Estado Logístico' : 'Logistics Status'}</h2></div>
                
                {/* SAAS PROGRESS STEPPER (Rediseñado) */}
                <div className="saas-stepper-wrapper">
                  <div className="saas-stepper-track-bg"></div>
                  <div className="saas-stepper-track-fill" style={{ width: `${progressPct}%` }}></div>
                  
                 <div className="saas-stepper-nodes">
                    {STEPS.map((stepObj, idx) => {
                      const stepId = CHAIN[idx];
                      const isPassed = currentStepIndex >= idx;
                      const isCurrent = currentStepIndex === idx;
                      const isFirst = idx === 0;
                      const isLast = idx === STEPS.length - 1;

                      const milestoneData = data?.milestones?.find(m => m.type === stepId);

                      // --- 📡 MAGIA DEL RADAR: Lógica dinámica de Hovers ---
                      let ttTime = milestoneData ? new Date(milestoneData.at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
                      let ttNote = milestoneData?.note || '';

                      // Interceptamos el despegue (In Transit)
                      if (stepId === 'IN_TRANSIT' && data?.flight_departure_time) {
                        ttTime = new Date(data.flight_departure_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                        ttNote = `Vuelo ${data?.flight_number || ''} en el aire. Despegue confirmado.`;
                      }
                      
                      // Interceptamos el aterrizaje (At Destination)
                      if (stepId === 'AT_DESTINATION' && data?.flight_arrival_time) {
                        ttTime = new Date(data.flight_arrival_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                        ttNote = `Vuelo ${data?.flight_number || ''} aterrizado. Llegada confirmada.`;
                      }

                      // Mostrar tooltip si ya pasamos/estamos en el paso Y hay info
                      const showTooltip = isPassed && (ttTime || ttNote);

                      return (
                        <div className={`saas-node ${isPassed ? 'passed' : ''} ${isCurrent ? 'current' : ''}`} key={stepId}>
                          
                          <div className="ff-tooltip-wrapper tooltip-trigger">
                            <div className="node-circle">
                              {isPassed ? <Check size={14} strokeWidth={3}/> : <div className="node-dot"></div>}
                            </div>
                            
                            {/* HOVER TOOLTIP CORPORATIVO */}
                            {showTooltip && (
                              <div className="ff-tooltip-content loc-tooltip step-tooltip">
                                <div className="tt-header">
                                  <strong>{stepObj.label}</strong>
                                  <span className="tt-time">{ttTime}</span>
                                </div>
                                {ttNote && (
                                  <div className="tt-note">
                                    <MessageSquare size={12} className="tt-icon-note"/> 
                                    <span>"{ttNote}"</span>
                                  </div>
                                )}
                                <div className="tt-author">Verified by FreshConnect</div>
                              </div>
                            )}
                          </div>

                          <div className="node-labels">
                            <span className="n-title">{stepObj.label}</span>
                            {/* Píldoras integradas al texto, sin position absolute */}
                            {isFirst && <span className="n-pill origin"><MapPin size={10}/> {data?.origin || 'PTY'}</span>}
                            {isLast && <span className="n-pill dest"><Globe size={10}/> {data?.destination || 'TBD'}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* RESUMEN DE DATOS COMPACTO */}
                <div className="compact-data-grid">
                  
                  {/* Bloque 1: Producto y Calidad */}
                  <div className="data-block">
                    <div className="db-header"><Package size={14}/> <span>{lang === 'es' ? 'Calidad' : 'Quality'}</span></div>
                    <div className="db-content">
                      <div className="field-group">
                        <span className="f-lbl">{lang === 'es' ? 'Producto' : 'Product'}</span>
                        <span className="f-val">{data?.product_name || '—'} {data?.product_variety ? `(${data.product_variety})` : ''}</span>
                      </div>
                      <div className="field-row">
                        <div className="field-group">
                          <span className="f-lbl">{lang === 'es' ? 'Calibre' : 'Caliber'}</span>
                          <span className="f-val">{data?.calibre || '—'}</span>
                        </div>
                        <div className="field-group">
                          <span className="f-lbl">Color / Brix</span>
                          <span className="f-val">{data?.color ? `${data.color} / ${data?.brix_grade || '-'}` : (data?.brix_grade || '—')}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bloque 2: Volumen */}
                  <div className="data-block">
                    <div className="db-header"><Scale size={14}/> <span>{lang === 'es' ? 'Volumen' : 'Volume'}</span></div>
                    <div className="db-content">
                      <div className="field-row">
                        <div className="field-group">
                          <span className="f-lbl">{lang === 'es' ? 'Cajas' : 'Boxes'}</span>
                          <span className="f-val">{data?.boxes || 0}</span>
                        </div>
                        <div className="field-group">
                          <span className="f-lbl">Pallets</span>
                          <span className="f-val">{data?.pallets || 0}</span>
                        </div>
                      </div>
                      <div className="field-group">
                        <span className="f-lbl">{lang === 'es' ? 'Peso Bruto' : 'Gross Wgt'}</span>
                        <span className="f-val">{(data?.weight_kg || 0).toLocaleString()} Kg</span>
                      </div>
                    </div>
                  </div>

                  {/* Bloque 3: Transporte */}
                  <div className="data-block no-border">
                    <div className="db-header">
                       {data?.product_mode?.toUpperCase() === 'AIR' ? <Plane size={14}/> : <Ship size={14}/>} 
                       <span>{lang === 'es' ? 'Transporte' : 'Transport'}</span>
                    </div>
                    <div className="db-content">
                      <div className="field-group">
                        <span className="f-lbl">{lang === 'es' ? 'Vuelo / Viaje' : 'Flight / Voyage'}</span>
                        <span className="f-val font-mono text-brand">{data?.flight_number || (lang === 'es' ? 'Pendiente' : 'Pending')}</span>
                      </div>
                      <div className="field-group">
                        <span className="f-lbl">AWB / BL / Tracking</span>
                        <span className="f-val font-mono">{data?.awb || (lang === 'es' ? 'Pendiente' : 'Pending')}</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* RESTO DE SECCIONES (Docs, Photos, Timeline) SE MANTIENEN IGUAL */}
            {activeSection === 'docs' && (
              <div className="section-panel no-padding">
                <div className="panel-header pad-24">
                   <h2>{lang === 'es' ? 'Documentos Comerciales y Legales' : 'Commercial & Legal Documents'}</h2>
                </div>
                <table className="clean-table">
                  <thead>
                    <tr>
                      <th style={{width: '50%'}}>{lang === 'es' ? 'Tipo de Documento' : 'Document Type'}</th>
                      <th style={{width: '30%'}}>{lang === 'es' ? 'Estado' : 'Status'}</th>
                      <th style={{width: '20%'}} className="txt-right">{lang === 'es' ? 'Acciones' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DOC_TYPES.map(t => {
                      const doc = data?.documents?.find(d => d.doc_type === t.v);
                      return (
                        <tr key={t.v}>
                          <td className="doc-type-label"><FileText size={14} className="text-slate-400"/> {t.l}</td>
                          <td>
                            {doc ? (
                               <span className="doc-name-pill">{doc.filename}</span> 
                            ) : (
                               <span className="empty-italic">{lang === 'es' ? 'Pendiente de emisión' : 'Pending emission'}</span>
                            )}
                          </td>
                          <td className="txt-right">
                            {doc ? (
                              <button className="btn-icon" onClick={() => download(doc.id)} title={lang === 'es' ? 'Descargar' : 'Download'}><Download size={14}/></button>
                            ) : (
                              <span className="empty-italic">—</span>
                            )}
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
                <div className="panel-header">
                  <h2>{lang === 'es' ? 'Reporte Fotográfico' : 'Photographic Report'}</h2>
                </div>
                
                <div className="pad-32">
                  {data?.photos && data.photos.length > 0 ? (
                    <div className="photos-grid">
                      {data.photos.map(p => (
                        <div key={p.id} className="photo-card">
                          <img src={p.url || ""} alt="Evidencia" className="photo-img" />
                          <div className="photo-overlay">
                            <button onClick={() => download(p.id)} title={lang === 'es' ? 'Descargar original' : 'Download original'}>
                               <Download size={18}/>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-box">
                      <ImageIcon size={32} color="#cbd5e1" />
                      <p>{lang === 'es' ? 'Las fotografías de la carga estarán disponibles pronto.' : 'Cargo photographs will be available soon.'}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeSection === 'timeline' && (
              <div className="section-panel">
                <div className="panel-header"><h2>{lang === 'es' ? 'Registro Histórico (Trazabilidad)' : 'Historical Log (Traceability)'}</h2></div>
                <div className="pad-32">
                  {timelineItems.length > 0 ? (
                     <ModernTimeline milestones={timelineItems as any} />
                  ) : (
                     <div className="empty-box">
                        <Clock size={32} color="#cbd5e1" />
                        <p>{lang === 'es' ? 'El registro de actividad iniciará una vez la carga sea procesada.' : 'Activity log will begin once the cargo is processed.'}</p>
                     </div>
                  )}
                </div>
              </div>
            )}

          </main>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        /* VARIABLES Y RESET */
        .clean-container { max-width: 1100px; margin: 0 auto; font-family: 'Poppins', sans-serif; color: #0f172a; }
        .text-brand { color: var(--ff-green-dark); }
        
        /* HEADER COMPACTO */
        .clean-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid rgba(34, 76, 34, 0.1); }
        .ch-left { display: flex; align-items: center; gap: 16px; }
        .btn-back-icon { background: white; border: 1px solid rgba(34, 76, 34, 0.15); width: 36px; height: 36px; border-radius: 10px; color: var(--ff-green-dark); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; flex-shrink: 0; box-shadow: 0 2px 5px rgba(0,0,0,0.02);}
        .btn-back-icon:hover { border-color: var(--ff-green); background: #f9fbf9; transform: translateY(-1px);}
        
        .ch-titles { display: flex; flex-direction: column; gap: 4px; }
        .title-row { display: flex; align-items: center; gap: 12px; }
        .ch-title { font-family: 'JetBrains Mono', monospace; font-size: 24px; font-weight: 900; margin: 0; color: var(--ff-green-dark); letter-spacing: -0.5px; }
        .status-pill-main { background: var(--ff-green-dark); color: white; padding: 4px 12px; border-radius: 20px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
        .ch-sub { font-size: 13px; color: var(--ff-green-dark); opacity: 0.7; margin: 0; }
        .ch-sub strong { color: var(--ff-green-dark); font-weight: 700; opacity: 1; }
        
        .ch-right { display: flex; align-items: center; gap: 24px; }
        .ch-stats { display: flex; gap: 24px; }
        .stat-block { display: flex; flex-direction: column; align-items: flex-end; }
        .s-val { font-size: 18px; font-weight: 800; color: var(--ff-green-dark); line-height: 1.1; font-variant-numeric: tabular-nums; }
        .s-val small { font-size: 11px; opacity: 0.6; }
        .s-lab { font-size: 10px; color: var(--ff-green-dark); opacity: 0.6; font-weight: 700; text-transform: uppercase; margin-top: 4px; }

        /* LAYOUT SPLIT */
        .clean-layout { display: grid; grid-template-columns: 220px 1fr; gap: 32px; align-items: start; }
        
        /* SIDEBAR */
        .side-nav { display: flex; flex-direction: column; gap: 6px; position: sticky; top: 20px; }
        .nav-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 12px; border: none; background: transparent; font-size: 13px; font-weight: 600; color: var(--ff-green-dark); opacity: 0.7; cursor: pointer; text-align: left; transition: 0.2s; }
        .nav-item:hover { background: rgba(34, 76, 34, 0.05); opacity: 1; }
        .nav-item.active { background: white; border: 1px solid rgba(34, 76, 34, 0.1); opacity: 1; box-shadow: 0 4px 10px rgba(0,0,0,0.02); }

        /* PANEL BLANCO DE CONTENIDO - Se eliminó overflow: hidden para arreglar el Tooltip */
        .clean-content { background: white; border-radius: 20px; border: 1px solid rgba(34, 76, 34, 0.08); box-shadow: 0 4px 20px rgba(34, 76, 34, 0.03); min-height: 400px; }
        .section-panel { display: flex; flex-direction: column; }
        .section-panel.no-padding { padding: 0; }
        .panel-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid rgba(34, 76, 34, 0.05); background: #f9fbf9; border-radius: 20px 20px 0 0;}
        .pad-24 { padding: 20px 24px; }
        .pad-32 { padding: 24px 32px; }
        .panel-header h2 { font-size: 14px; font-weight: 800; color: var(--ff-green-dark); margin: 0; text-transform: uppercase; letter-spacing: 0.3px; }

        /* ================= SAAS PROGRESS STEPPER (NUEVO DISEÑO) ================= */
        .saas-stepper-wrapper { position: relative; padding: 50px 40px 30px 40px; background: white; border-bottom: 1px dashed rgba(34, 76, 34, 0.15); }
        .saas-stepper-track-bg { position: absolute; top: 68px; left: 60px; right: 60px; height: 4px; background: rgba(34, 76, 34, 0.08); border-radius: 2px; z-index: 1; }
        .saas-stepper-track-fill { position: absolute; top: 68px; left: 60px; height: 4px; background: var(--ff-green); border-radius: 2px; z-index: 2; transition: width 1s cubic-bezier(0.4, 0, 0.2, 1); }
        
        .saas-stepper-nodes { display: flex; justify-content: space-between; position: relative; z-index: 10; }
        .saas-node { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100px; }
        
        .node-circle { width: 36px; height: 36px; border-radius: 50%; background: white; border: 3px solid #e2e8f0; display: flex; align-items: center; justify-content: center; transition: all 0.4s ease; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        .node-dot { width: 10px; height: 10px; background: #e2e8f0; border-radius: 50%; transition: all 0.4s ease; }
        
        /* Estados del Nodo */
        .saas-node.passed .node-circle { background: var(--ff-green); border-color: var(--ff-green); color: white; }
        .saas-node.current .node-circle { border-color: var(--ff-green); animation: pulse-ring 2s infinite; }
        .saas-node.current .node-dot { background: var(--ff-green); }
        
        @keyframes pulse-ring { 
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.3); } 
          70% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); } 
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } 
        }

        /* Textos del Nodo */
        .node-labels { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }
        .n-title { font-size: 11px; font-weight: 800; color: var(--ff-green-dark); opacity: 0.5; text-transform: uppercase; transition: 0.3s; }
        .saas-node.passed .n-title { opacity: 0.9; }
        .saas-node.current .n-title { opacity: 1; font-weight: 900; color: var(--ff-green); }

        .n-pill { font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 6px; display: flex; align-items: center; gap: 4px; font-family: 'JetBrains Mono', monospace; }
        .n-pill.origin { background: rgba(34, 76, 34, 0.06); color: var(--ff-green-dark); }
        .n-pill.dest { background: #ecfdf5; color: #10b981; border: 1px solid #a7f3d0; }

        /* TOOLTIP CORPORATIVO */
        .ff-tooltip-wrapper { position: relative; cursor: pointer; display: flex; justify-content: center; }
        .ff-tooltip-content {
          position: absolute; bottom: 140%; left: 50%; transform: translateX(-50%) translateY(10px);
          background: var(--ff-green-dark); color: white; padding: 16px; border-radius: 12px;
          z-index: 9999; opacity: 0; visibility: hidden; pointer-events: none; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 10px 30px -5px rgba(0,0,0,0.3); min-width: 220px; display: flex; flex-direction: column; gap: 8px;
        }
        .ff-tooltip-content::after {
          content: ''; position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
          border-width: 6px; border-style: solid; border-color: var(--ff-green-dark) transparent transparent transparent;
        }
        .ff-tooltip-wrapper:hover .ff-tooltip-content { opacity: 1; visibility: visible; transform: translateX(-50%) translateY(0); }
        
        .tt-header { display: flex; justify-content: space-between; align-items: center; font-size: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;}
        .tt-header strong { font-weight: 800; text-transform: uppercase; color: var(--ff-green);}
        .tt-time { font-family: 'JetBrains Mono', monospace; color: #cbd5e1;}
        .tt-note { font-size: 12px; font-weight: 500; color: white; opacity: 0.9; display: flex; gap: 8px; align-items: flex-start; line-height: 1.4;}
        .tt-icon-note { flex-shrink: 0; margin-top: 2px; color: var(--ff-green); }
        .tt-author { font-size: 10px; text-align: right; color: #94a3b8; margin-top: 4px; font-weight: 600;}

        /* DATA GRID COMPACTO */
        .compact-data-grid { display: grid; grid-template-columns: repeat(3, 1fr); padding: 24px; }
        .data-block { display: flex; flex-direction: column; gap: 16px; padding: 0 24px; border-right: 1px solid rgba(34, 76, 34, 0.08); }
        .data-block.no-border { border-right: none; }
        .db-header { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 800; color: var(--ff-green-dark); text-transform: uppercase; letter-spacing: 0.5px;}
        
        .db-content { display: flex; flex-direction: column; gap: 16px; }
        .field-group { display: flex; flex-direction: column; gap: 2px; }
        .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        
        .f-lbl { font-size: 10px; font-weight: 700; color: var(--ff-green-dark); opacity: 0.5; text-transform: uppercase; }
        .f-val { font-size: 13px; font-weight: 700; color: var(--ff-green-dark); }
        .font-mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; letter-spacing: -0.2px;}

        /* TABLA DOCUMENTOS */
        .clean-table { width: 100%; border-collapse: collapse; }
        .clean-table th { text-align: left; padding: 16px 32px; font-size: 10px; font-weight: 800; color: var(--ff-green-dark); opacity: 0.6; text-transform: uppercase; border-bottom: 1px solid rgba(34, 76, 34, 0.08); background: #f9fbf9; }
        .clean-table td { padding: 16px 32px; border-bottom: 1px solid rgba(34, 76, 34, 0.04); font-size: 13px; color: var(--ff-green-dark); font-weight: 600;}
        .doc-type-label { display: flex; align-items: center; gap: 10px; }
        .doc-name-pill { background: rgba(34, 76, 34, 0.05); padding: 6px 12px; border-radius: 8px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ff-green-dark); border: 1px solid rgba(34, 76, 34, 0.08); }
        .empty-italic { color: var(--ff-green-dark); opacity: 0.4; font-size: 12px; font-style: italic; }
        .txt-right { text-align: right !important; }
        
        .btn-icon { background: white; border: 1px solid rgba(34, 76, 34, 0.15); width: 32px; height: 32px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; color: var(--ff-green-dark); transition: 0.2s; box-shadow: 0 2px 5px rgba(0,0,0,0.02);}
        .btn-icon:hover { border-color: var(--ff-green); background: #f9fbf9; transform: translateY(-1px); }

        /* FOTOS */
        .photos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 24px; }
        .photo-card { position: relative; aspect-ratio: 1; border-radius: 16px; overflow: hidden; background: #f1f5f9; border: 1px solid rgba(34, 76, 34, 0.1); box-shadow: 0 4px 12px rgba(0,0,0,0.05); cursor: pointer; }
        .photo-img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease; }
        .photo-card:hover .photo-img { transform: scale(1.05); }
        .photo-overlay { position: absolute; inset: 0; background: rgba(15,23,42,0.4); display: flex; gap: 8px; align-items: center; justify-content: center; opacity: 0; transition: 0.3s; backdrop-filter: blur(2px); }
        .photo-card:hover .photo-overlay { opacity: 1; }
        .photo-overlay button { background: white; border: none; width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--ff-green-dark); transition: 0.2s; }
        .photo-overlay button:hover { transform: scale(1.1); color: var(--ff-green); }
        
        .empty-box { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 20px; color: var(--ff-green-dark); opacity: 0.6; text-align: center; gap: 16px; background: #f9fbf9; border-radius: 16px; border: 1px dashed rgba(34, 76, 34, 0.15); }
        .empty-box p { margin: 0; font-size: 13px; font-weight: 600; }

        /* LOADER Y TEXTOS SYNC */
        .loader-full { height: calc(100vh - 80px); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; }
        .ff-sync-text { font-size: 11px; font-weight: 800; color: var(--ff-green-dark); opacity: 0.6; text-transform: uppercase; letter-spacing: 2px; margin: 0;}
      ` }} />
    </ClientLayout>
  );
}