import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom"; 
import { 
  FileText, Loader2, Plane, Ship, 
  MapPin, Shield, ArrowRight, CheckCircle, 
  Download, ExternalLink, Info, AlertCircle, MessageSquare
} from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { getApiBase } from "../../../lib/apiBase";
import { ClientLayout } from "../../../components/ClientLayout";
// ✅ Importación corregida según el árbol de archivos (id -> quotes -> clients -> pages -> components)
import { QuoteChatter } from "../../../components/QuoteChatter";

export default function ClientQuoteDetailPage() {
  const { id } = useParams(); 
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      // Obtenemos sesión para el Chatter
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setUser(session.user);

      const { data: quote, error } = await supabase
        .from("quotes")
        .select(`
          *,
          clients!client_id (
            name,
            legal_name,
            logo_url
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      if (!quote) throw new Error("No encontrado");
      
      setData(quote);
    } catch (err) { 
      console.error("Error en loadData:", err); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { loadData(); }, [id]);

  const handleApprove = async () => {
    const confirm = window.confirm("¿Confirma que desea aprobar esta cotización? Se generará una Orden de Compra (PO) formal.");
    if (!confirm) return;

    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${getApiBase()}/.netlify/functions/approveQuote`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ quoteId: id })
      });

      if (!res.ok) throw new Error("Falla en la aprobación");
      await loadData();
      alert("¡Éxito! Su Orden de Compra ha sido confirmada.");
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = (type: 'quote' | 'po') => {
    const fn = type === 'quote' ? 'renderQuotePdf' : 'renderPurchaseOrderPdf';
    window.open(`${getApiBase()}/.netlify/functions/${fn}?id=${id}`, '_blank');
  };

  const scrollToChat = () => {
    const hub = document.getElementById('communication-hub');
    if (hub) {
      hub.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => {
        hub.querySelector('textarea')?.focus();
      }, 600);
    }
  };

  if (loading) return <ClientLayout title="Cargando..."><div className="p-20 text-center"><Loader2 className="spin mx-auto text-emerald-600" size={40} /></div></ClientLayout>;
  if (!data) return <ClientLayout title="Error"> <div className="p-20 text-center"><AlertCircle className="mx-auto text-red-500" size={40}/> <p>No se pudo cargar la información.</p></div></ClientLayout>;

  const isApproved = data.status === 'approved';
  const isSent = data.status === 'sent';
  const displayId = data.quote_number || data.quote_no || "RFQ-PENDIENTE";
  
  // Lógica de total consistente con el Admin
  const finalTotal = data.totals?.total || data.total || 0;

  return (
    <ClientLayout title={`Expediente: ${displayId}`}>
      <div className="ff-container">
        
        {/* BANNER DE ACCIÓN */}
        <div className={`action-banner ${isApproved ? 'approved' : 'pending'}`}>
          <div className="banner-info">
            {isApproved ? <CheckCircle size={24} /> : <Info size={24} />}
            <div>
              <p className="banner-title">{isApproved ? "Orden de Compra Confirmada" : "Esperando su revisión"}</p>
              <p className="banner-sub">{isApproved ? `Referencia vinculada: ${data.po_number || 'Generando...'}` : "Revise los términos y apruebe para iniciar la logística."}</p>
            </div>
          </div>
          <div className="banner-btns">
            {!isApproved && (
              <button onClick={scrollToChat} className="btn-ghost">
                <MessageSquare size={16} /> Solicitar Cambio
              </button>
            )}
            <button onClick={() => handleDownload('quote')} className="btn-ghost">
              <ExternalLink size={16} /> Ver Cotización
            </button>
            {isSent && (
              <button onClick={handleApprove} disabled={busy} className="btn-cta">
                {busy ? <Loader2 size={16} className="spin" /> : <CheckCircle size={16} />}
                Confirmar Pedido
              </button>
            )}
            {isApproved && (
              <button onClick={() => handleDownload('po')} className="btn-po">
                <Download size={16} /> Bajar Orden de Compra
              </button>
            )}
          </div>
        </div>

        {/* HERO CLIENTE */}
        <div className="hero">
          <div className="heroLeft">
            <div className="codeRow">
              <div className="codeIcon"><FileText size={20} color="#166534" /></div>
              <div style={{ marginLeft: '12px' }}>
                <div className="heroLabel">Referencia Oficial</div>
                <div className="code">{displayId}</div>
              </div>
            </div>
          </div>
          <div className="heroRight">
            <div className="kpi-box">
              <span className="kpi-val">USD {finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              <span className="kpi-lab">MONTO TOTAL DE OPERACIÓN</span>
            </div>
            <div className="pills-row">
                <span className="pill green"><MapPin size={14}/> PTY <ArrowRight size={12}/> {data.destination}</span>
                <span className="pill blue"><Shield size={14}/> {data.totals?.meta?.incoterm || 'CIP'}</span>
            </div>
          </div>
        </div>

        {/* DETALLE TÉCNICO */}
        <div className="ff-grid-cols">
          <div className="ff-card strip-compact">
            <div className="strip-label">CALIDAD</div>
            <div className="strip-grid-client">
              <div className="f-item"><label>Producto</label><span>{data.product_details?.product_name || "Piña MD2 Golden"}</span></div>
              <div className="f-item"><label>Variedad</label><span>{data.product_details?.variety || "N/A"}</span></div>
              <div className="f-item"><label>Calibre</label><span>{data.product_details?.caliber || "N/A"}</span></div>
            </div>
          </div>

          <div className="ff-card strip-compact blue-card">
            <div className="strip-label">LOGÍSTICA</div>
            <div className="strip-grid-client">
              <div className="f-item"><label>Modo</label><span>{data.mode === 'AIR' ? <><Plane size={14}/> Aéreo</> : <><Ship size={14}/> Marítimo</>}</span></div>
              <div className="f-item"><label>Cajas</label><span>{data.boxes}</span></div>
              <div className="f-item"><label>Peso (Kg)</label><span>{data.weight_kg || 0}</span></div>
            </div>
          </div>
        </div>

        {/* TÉRMINOS */}
        <div className="ff-card terms-card">
          <div className="table-h"><AlertCircle size={18}/> <span>Términos y Condiciones Contractuales</span></div>
          <div className="terms-viewer">
            {data.terms || "Términos estándar aplicables según contrato marco Fresh Food Panama."}
          </div>
        </div>

        {/* CHATTER DE COMUNICACIÓN */}
        <div id="communication-hub">
           <QuoteChatter 
             quoteId={id!} 
             currentUserRole="client" 
             currentUserId={user?.id} 
           />
        </div>

      </div>

      <style>{`
        .ff-container { padding: 30px; max-width: 1200px; margin: 0 auto; font-family: 'Inter', sans-serif; padding-bottom: 100px; }
        .ff-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 20px; }
        
        .hero { display: flex; justify-content: space-between; align-items: center; background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px; margin-bottom: 20px; }
        .codeRow { display: flex; align-items: center; }
        .codeIcon { width: 48px; height: 48px; background: #f0fdf4; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .heroLabel { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
        .code { font-size: 24px; font-weight: 900; color: #0f172a; }
        
        .heroRight { display: flex; align-items: center; gap: 20px; }
        .pills-row { display: flex; flex-direction: column; gap: 8px; }
        .kpi-box { text-align: right; border-right: 1px solid #e2e8f0; padding-right: 25px; }
        .kpi-val { display: block; font-size: 24px; font-weight: 900; color: #10b981; }
        .kpi-lab { font-size: 10px; font-weight: 800; color: #94a3b8; }

        .action-banner { display: flex; justify-content: space-between; align-items: center; padding: 20px 30px; border-radius: 16px; margin-bottom: 25px; color: white; }
        .action-banner.pending { background: #0f172a; border: 1px solid #1e293b; }
        .action-banner.approved { background: #064e3b; border: 1px solid #065f46; }
        
        .banner-info { display: flex; gap: 15px; align-items: center; }
        .banner-title { font-size: 16px; font-weight: 800; margin: 0; color: #f59e0b; }
        .banner-sub { font-size: 12px; opacity: 0.8; margin: 0; }
        .banner-btns { display: flex; gap: 12px; }

        .btn-cta { background: #10b981; color: white; border: none; padding: 10px 24px; border-radius: 10px; font-weight: 700; cursor: pointer; display: flex; gap: 8px; align-items: center; transition: 0.2s; }
        .btn-cta:hover { background: #059669; transform: translateY(-1px); }
        .btn-po { background: #f59e0b; color: #0f172a; border: none; padding: 10px 24px; border-radius: 10px; font-weight: 800; cursor: pointer; display: flex; gap: 8px; align-items: center; }
        .btn-ghost { background: rgba(255,255,255,0.05); color: white; border: 1px solid rgba(255,255,255,0.15); padding: 10px 20px; border-radius: 10px; font-weight: 600; cursor: pointer; display: flex; gap: 8px; align-items: center; transition: 0.2s; }
        .btn-ghost:hover { background: rgba(255,255,255,0.1); }

        .ff-grid-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .strip-compact { display: flex; gap: 25px; align-items: center; padding: 20px 25px; }
        .blue-card { border-left: 4px solid #3b82f6; }
        .strip-label { width: 80px; font-size: 10px; font-weight: 900; color: #10b981; border-right: 1px solid #f1f5f9; text-transform: uppercase; }
        .blue-card .strip-label { color: #3b82f6; }
        .strip-grid-client { display: grid; grid-template-columns: repeat(3, 1fr); flex: 1; gap: 20px; }
        .f-item label { display: block; font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px; }
        .f-item span { font-size: 14px; font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 6px; }

        .terms-card { border-top: 4px solid #f59e0b; margin-bottom: 40px; }
        .table-h { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 14px; color: #b45309; margin-bottom: 15px; }
        .terms-viewer { font-size: 14px; color: #475569; line-height: 1.7; white-space: pre-line; background: #fffbeb; padding: 20px; border-radius: 12px; border: 1px solid #fef3c7; }
        
        .pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 800; border: 1px solid transparent; }
        .pill.green { background: #f0fdf4; color: #166534; border-color: #dcfce7; }
        .pill.blue { background: #eff6ff; color: #1e40af; border-color: #dbeafe; }
        
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        #communication-hub {
            border-top: 1px solid #e2e8f0;
            padding-top: 20px;
        }
      `}</style>
    </ClientLayout>
  );
}