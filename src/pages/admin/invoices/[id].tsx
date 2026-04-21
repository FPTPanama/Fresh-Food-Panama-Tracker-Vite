// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { getApiBase } from "@/lib/apiBase";
import { requireAdminOrRedirect } from "@/lib/requireAdmin";
import { AdminLayout } from "@/components/AdminLayout";
import { 
  ArrowLeft, Loader2, Save, Download, DollarSign, Clock, CheckCircle2, 
  AlertCircle, Building2, Calendar, CreditCard, Receipt, Plus, Ban, X, Trash2, RefreshCw
} from "lucide-react";

type PaymentRecord = { id: string; date: string; amount: number; method: string; reference: string; recorded_by: string; };
type InvoiceItem = { id: string; name: string; qty: number; unit: number; totalRow: number; };

const PAY_METHODS = [
  { id: "WIRE", label: "Transferencia Internacional (Wire)" },
  { id: "ACH", label: "Transferencia Local (ACH)" },
  { id: "CREDIT_CARD", label: "Tarjeta de Crédito" },
  { id: "CHECK", label: "Cheque" },
  { id: "CASH", label: "Efectivo / Caja" },
  { id: "CREDIT_NOTE", label: "Nota de Crédito" }
];

export default function AdminInvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  
  const [invoice, setInvoice] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  
  const [clientId, setClientId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [applyTax, setApplyTax] = useState(false);

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("WIRE");
  const [payRef, setPayRef] = useState("");

  const [toast, setToast] = useState<{msg: string, type: 'success'|'error'} | null>(null);
  const showToast = (msg: string, type: 'success'|'error' = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [invRes, cliRes] = await Promise.all([
        supabase.from("invoices").select("*, clients(*), quotes(quote_number)").eq("id", id).single(),
        supabase.from("clients").select("id, name, tax_id").order("name")
      ]);
      if (invRes.error) throw invRes.error;
      
      const inv = invRes.data;
      setInvoice(inv);
      setClients(cliRes.data || []);
      setClientId(inv.client_id || "");
      setDueDate(inv.due_date || "");
      setNotes(inv.notes || "");
      setApplyTax(Number(inv.tax_amount) > 0);
      
      if (inv.items && Array.isArray(inv.items)) {
        setItems(inv.items.map(i => ({ id: i.id || `item_${Math.random()}`, name: i.name || i.label || "", qty: Number(i.qty) || 1, unit: Number(i.unit) || 0, totalRow: (Number(i.qty) || 1) * (Number(i.unit) || 0) })));
      } else { setItems([]); }
    } catch (err: any) { showToast(err.message, "error"); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { requireAdminOrRedirect().then(r => { if (r.ok) { setAuthReady(true); loadData(); } }); }, [loadData]);

  const finCalc = useMemo(() => {
    const sub = items.reduce((acc, item) => acc + (item.qty * item.unit), 0);
    const tax = applyTax ? sub * 0.07 : 0;
    const total = sub + tax;
    const amountPaid = invoice ? Number(invoice.amount_paid) : 0;
    const balance = Math.max(0, total - amountPaid);
    const isLocked = invoice?.status === 'PAID' || invoice?.status === 'VOID';
    const isOverdue = invoice?.status !== 'PAID' && invoice?.status !== 'VOID' && new Date(dueDate || invoice?.due_date).getTime() < new Date().getTime();
    return { subtotal: sub, taxAmount: tax, total, balance, progress: total > 0 ? (amountPaid / total) * 100 : 0, amountPaid, isLocked, isOverdue };
  }, [items, applyTax, invoice, dueDate]);

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    const item = { ...newItems[index], [field]: value };
    if (field === 'qty' || field === 'unit') item.totalRow = Number(item.qty) * Number(item.unit);
    newItems[index] = item;
    setItems(newItems);
  };

  const addItemRow = () => setItems([...items, { id: `item_${Date.now()}`, name: "", qty: 1, unit: 0, totalRow: 0 }]);
  const removeItemRow = (index: number) => setItems(items.filter((_, i) => i !== index));

  // 🚀 EXTRACTOR MANUAL ALINEADO CON LA ESTRUCTURA REAL (totals.items)
  const handleSyncFromQuote = async () => {
    if (!invoice?.quote_id) return showToast("Esta factura no está vinculada a una cotización.", "error");
    setBusy(true);
    try {
      const { data: quote, error } = await supabase.from("quotes").select("*").eq("id", invoice.quote_id).single();
      if (error || !quote) throw new Error("No se pudo cargar la cotización.");

      let newItems: InvoiceItem[] = [];
      const subtotal = Number(quote.totals?.total || 0);
      
      // Apuntamos al arreglo correcto que vimos en la consola
      const quoteLines = quote.totals?.items;

      if (quoteLines && Array.isArray(quoteLines) && quoteLines.length > 0) {
        newItems = quoteLines.map((c: any, index: number) => {
          const q = Number(c.qty || 1);
          const u = Number(c.unit || 0);
          let itemName = c.name || "Concepto";
          
          if (itemName.includes("Fruta")) {
             const variety = quote.product_details?.variety || "";
             const calibre = quote.product_details?.caliber || quote.product_details?.calibre || "";
             itemName = `Exportación: ${variety} ${calibre ? `(Calibre ${calibre})` : ''}`.trim();
          }

          return { 
            id: `item_sync_${Date.now()}_${index}`, 
            name: itemName, 
            qty: q, 
            unit: u, 
            totalRow: Number(c.totalRow || (q * u)) 
          };
        });
      } else {
         newItems.push({ id: `item_fallback_${Date.now()}`, name: `Exportación General`, qty: 1, unit: subtotal, totalRow: subtotal });
      }

      newItems.push({ id: `item_extra_${Date.now()}`, name: "Recargos / Servicios Adicionales", qty: 1, unit: 0, totalRow: 0 });

      setItems(newItems);
      showToast("Datos extraídos exitosamente. Dale a Guardar Cambios.");
    } catch (err: any) { showToast(err.message, "error"); } finally { setBusy(false); }
  };

  const handleSaveInvoice = async () => {
    if (!invoice) return;
    if (!clientId) return showToast("Debes seleccionar un cliente", "error");
    setBusy(true);
    try {
      const payload = { client_id: clientId, due_date: dueDate, notes: notes, items: items, subtotal: finCalc.subtotal, tax_amount: finCalc.taxAmount, total: finCalc.total };
      const { error } = await supabase.from("invoices").update(payload).eq("id", invoice.id);
      if (error) throw error;
      showToast("Factura guardada exitosamente");
      loadData(); 
    } catch (err: any) { showToast("Error al guardar: " + err.message, "error"); } finally { setBusy(false); }
  };

  const handleRegisterPayment = async () => {
    if (!invoice) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) return showToast("Monto inválido", "error");
    if (amount > finCalc.balance) return showToast("El monto supera el saldo pendiente", "error");
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const newPayment: PaymentRecord = { id: `pay_${Date.now()}`, date: new Date().toISOString(), amount: amount, method: payMethod, reference: payRef.trim() || "S/R", recorded_by: session?.user?.email || "Admin" };
      const newHistory = [...(invoice.payment_history || []), newPayment];
      const newPaid = finCalc.amountPaid + amount;
      let newStatus = invoice.status;
      if (newPaid >= finCalc.total) newStatus = 'PAID'; else if (newPaid > 0) newStatus = 'PARTIAL';
      const { error } = await supabase.from("invoices").update({ amount_paid: newPaid, payment_history: newHistory, status: newStatus }).eq("id", invoice.id);
      if (error) throw error;
      showToast("Pago registrado con éxito");
      setPayAmount(""); setPayRef(""); setShowPaymentForm(false);
      loadData();
    } catch (err: any) { showToast("Error registrando el pago", "error"); } finally { setBusy(false); }
  };

  const handlePrintPdf = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const pdfUrl = `${getApiBase()}/.netlify/functions/renderInvoicePdf?id=${id}&token=${session?.access_token}&t=${Date.now()}`;
      window.open(pdfUrl, '_blank');
    } catch (e) { showToast("Error al generar PDF", "error"); }
  };

  if (!authReady || loading) return <AdminLayout title="Cargando..."><div className="loader-center"><Loader2 className="animate-spin text-blue-600" size={40}/></div></AdminLayout>;
  if (!invoice) return <AdminLayout title="Error"><div className="loader-center">Factura no encontrada</div></AdminLayout>;

  return (
    <AdminLayout title={`Edición: ${invoice.invoice_number}`}>
      {toast && <div className={`toast-alert ${toast.type}`}>{toast.msg}</div>}
      <div className="inv-container">
        <div className="hero-box">
          <div className="hero-left">
            <button onClick={() => navigate('/admin/invoices')} className="btn-back"><ArrowLeft size={18}/></button>
            <div><div className="hero-label">Editor de Factura</div><h1 className="hero-title">{invoice.invoice_number}</h1></div>
          </div>
          <div className="hero-right">
            <div className="status-container">
              {invoice.status === 'PAID' && <div className="badge-pro green"><CheckCircle2 size={14}/> PAGADA TOTALMENTE</div>}
              {invoice.status === 'PARTIAL' && <div className="badge-pro blue"><Clock size={14}/> PAGO PARCIAL</div>}
              {invoice.status === 'UNPAID' && <div className="badge-pro orange"><AlertCircle size={14}/> PENDIENTE DE PAGO</div>}
              {invoice.status === 'VOID' && <div className="badge-pro gray"><Ban size={14}/> ANULADA</div>}
              {finCalc.isOverdue && <div className="badge-pro red"><AlertCircle size={14}/> VENCIDA</div>}
            </div>
            <div className="hero-actions">
              <button onClick={handlePrintPdf} className="btn-secondary"><Download size={16}/> Ver PDF</button>
              <button onClick={handleSaveInvoice} disabled={busy || finCalc.isLocked} className="btn-primary">
                {busy ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Guardar Cambios
              </button>
            </div>
          </div>
        </div>

        <div className="split-layout">
          <div className="col-main">
            <div className="ff-card">
              <div className="card-header"><Building2 size={16}/> <span>Datos Comerciales</span></div>
              <div className="grid-info">
                <div className="info-block" style={{ gridColumn: 'span 2' }}>
                  <label>Cliente a Facturar *</label>
                  <select className="saas-input" value={clientId} onChange={e => setClientId(e.target.value)} disabled={finCalc.isLocked}>
                    <option value="">-- Seleccionar Cliente --</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name} (RUC: {c.tax_id || 'N/A'})</option>)}
                  </select>
                </div>
                <div className="info-block"><label><Calendar size={14}/> Emisión</label><input type="text" className="saas-input disabled-input" value={new Date(invoice.issue_date).toLocaleDateString('es-PA')} disabled /></div>
                <div className="info-block"><label><Clock size={14}/> Vencimiento</label><input type="date" className="saas-input" value={dueDate} onChange={e => setDueDate(e.target.value)} disabled={finCalc.isLocked} /></div>
              </div>
            </div>

            <div className="ff-card no-pad">
              <div className="card-header pad-int"><Receipt size={16}/> <span>Detalle de Cobro</span></div>
              <div className="items-wrapper">
                <table className="items-table">
                  <thead>
                    <tr><th style={{width: '50%'}}>Descripción</th><th className="txt-center" style={{width: '15%'}}>Cant.</th><th className="txt-right" style={{width: '20%'}}>Precio Unit.</th><th className="txt-right" style={{width: '15%'}}>Total</th>{!finCalc.isLocked && <th></th>}</tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={item.id} className={finCalc.isLocked ? "locked-row" : "editable-row"}>
                        <td><input type="text" placeholder="Concepto..." className="inline-input desc-input" value={item.name} onChange={e => handleItemChange(idx, 'name', e.target.value)} disabled={finCalc.isLocked} /></td>
                        <td className="txt-center"><input type="number" min="1" className="inline-input num-input txt-center" value={item.qty} onChange={e => handleItemChange(idx, 'qty', e.target.value)} disabled={finCalc.isLocked} /></td>
                        <td className="txt-right flex-cell"><span className="currency-symbol">$</span><input type="number" step="any" className="inline-input num-input txt-right" value={item.unit} onChange={e => handleItemChange(idx, 'unit', e.target.value)} disabled={finCalc.isLocked} /></td>
                        <td className="txt-right font-bold font-mono">${item.totalRow.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                        {!finCalc.isLocked && (<td className="txt-center"><button className="btn-del-item" onClick={() => removeItemRow(idx)}><Trash2 size={16}/></button></td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {!finCalc.isLocked && (
                <div className="add-item-bar">
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={addItemRow} className="btn-add-line"><Plus size={14}/> Agregar Línea</button>
                    {invoice?.quote_id && <button onClick={handleSyncFromQuote} className="btn-sync-quote"><RefreshCw size={14}/> Extraer desde Cotización</button>}
                  </div>
                  <label className="tax-toggle"><input type="checkbox" checked={applyTax} onChange={e => setApplyTax(e.target.checked)} /> Aplicar 7% ITBMS</label>
                </div>
              )}

              <div className="items-footer">
                <div className="tot-row"><span>Subtotal:</span> <span className="font-mono">${finCalc.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                {applyTax && <div className="tot-row"><span>ITBMS (7%):</span> <span className="font-mono">${finCalc.taxAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>}
                <div className="tot-row grand"><span>Total Factura:</span> <span className="font-mono">${finCalc.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
              </div>
            </div>

            <div className="ff-card"><div className="card-header"><span>Instrucciones y Notas</span></div><textarea className="saas-input notes-editor" value={notes} onChange={e => setNotes(e.target.value)} disabled={finCalc.isLocked} placeholder="Términos comerciales..." /></div>
          </div>

          <div className="col-side">
            <div className="ff-card bg-slate-900 text-white border-0">
              <div className="card-header border-slate-700 text-slate-300"><DollarSign size={16}/> <span>Liquidación</span></div>
              <div className="fin-summary">
                <div className="fs-row"><span className="fs-lab">Monto Total</span><span className="fs-val">${finCalc.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                <div className="fs-row text-emerald-400"><span className="fs-lab">Pagado</span><span className="fs-val">-${finCalc.amountPaid.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                <div className="fs-divider"></div>
                <div className="fs-row fs-grand"><span className="fs-lab">A Cobrar</span><span className="fs-val text-white">${finCalc.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
              </div>
              <div className="progress-container"><div className="progress-bar"><div className="progress-fill bg-emerald-500" style={{ width: `${finCalc.progress}%` }}></div></div><div className="progress-text">{finCalc.progress.toFixed(1)}% Completado</div></div>
            </div>

            <div className="ff-card">
              <div className="card-header flex justify-between items-center"><div className="flex gap-2 items-center"><CreditCard size={16}/> <span>Pagos y Abonos</span></div>{!finCalc.isLocked && invoice.status !== 'VOID' && finCalc.balance > 0 && (<button onClick={() => setShowPaymentForm(!showPaymentForm)} className="btn-add-pay">{showPaymentForm ? <X size={14}/> : <Plus size={14}/>} {showPaymentForm ? 'Cerrar' : 'Abonar'}</button>)}</div>
              {showPaymentForm && (
                <div className="payment-form">
                  <div className="pf-grid">
                    <div className="pf-field"><label>Monto a Registrar</label><input type="number" step="any" max={finCalc.balance} value={payAmount} onChange={e => setPayAmount(e.target.value)} /></div>
                    <div className="pf-field"><label>Método</label><select value={payMethod} onChange={e => setPayMethod(e.target.value)}>{PAY_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></div>
                    <div className="pf-field"><label>Referencia</label><input type="text" value={payRef} onChange={e => setPayRef(e.target.value)} /></div>
                  </div>
                  <button onClick={handleRegisterPayment} disabled={busy || !payAmount} className="btn-submit-pay">Confirmar Abono</button>
                </div>
              )}
              <div className="ledger-list">
                {(!invoice.payment_history || invoice.payment_history.length === 0) ? <div className="ledger-empty">No hay transacciones registradas.</div> : invoice.payment_history.map((pay: any) => (<div key={pay.id} className="ledger-item"><div className="li-icon"><CheckCircle2 size={14}/></div><div className="li-data"><div className="li-top"><span className="li-amount">${Number(pay.amount).toLocaleString(undefined, {minimumFractionDigits:2})}</span><span className="li-date">{new Date(pay.date).toLocaleDateString('es-PA')}</span></div><div className="li-bot"><span>{PAY_METHODS.find(m => m.id === pay.method)?.label || pay.method}</span> • {pay.reference}</div></div></div>))}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        .inv-container { max-width: 1200px; margin: 0 auto; padding: 20px; font-family: 'Inter', sans-serif; color: #0f172a; }
        .loader-center { height: 100vh; display: flex; align-items: center; justify-content: center; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .txt-right { text-align: right; }
        .txt-center { text-align: center; }
        .font-bold { font-weight: 700; }
        .hero-box { display: flex; justify-content: space-between; align-items: center; background: white; padding: 20px 24px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 24px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
        .hero-left { display: flex; gap: 16px; align-items: center; }
        .btn-back { width: 36px; height: 36px; border-radius: 10px; background: #f1f5f9; border: none; display: flex; align-items: center; justify-content: center; color: #64748b; cursor: pointer; transition: 0.2s; }
        .btn-back:hover { background: #e2e8f0; color: #0f172a; }
        .hero-label { font-size: 10px; font-weight: 800; color: #3b82f6; text-transform: uppercase; margin-bottom: 2px; }
        .hero-title { font-size: 24px; font-weight: 900; margin: 0; color: #1e293b; letter-spacing: -0.5px; }
        .hero-right { display: flex; flex-direction: column; align-items: flex-end; gap: 12px; }
        .status-container { display: flex; justify-content: flex-end; }
        .badge-pro { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; border: 1px solid transparent; }
        .badge-pro.green { background: #ecfdf5; color: #166534; border-color: #a7f3d0; }
        .badge-pro.blue { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
        .badge-pro.orange { background: #fff7ed; color: #c2410c; border-color: #ffedd5; }
        .badge-pro.red { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
        .badge-pro.gray { background: #f1f5f9; color: #475569; border-color: #cbd5e1; }
        .hero-actions { display: flex; gap: 10px; }
        .btn-secondary { background: #f8fafc; border: 1px solid #cbd5e1; color: #475569; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: 0.2s; }
        .btn-secondary:hover { background: #f1f5f9; color: #1e293b; }
        .btn-primary { background: #2563eb; color: white; border: none; padding: 8px 20px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: 0.2s; }
        .btn-primary:hover:not(:disabled) { background: #1d4ed8; }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .split-layout { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; align-items: start; }
        .ff-card { background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 20px; margin-bottom: 24px; }
        .ff-card.no-pad { padding: 0; overflow: hidden; }
        .card-header { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 800; color: #1e293b; text-transform: uppercase; margin-bottom: 16px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; }
        .card-header.pad-int { padding: 20px 20px 12px 20px; margin-bottom: 0; }
        .grid-info { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .info-block label { display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 6px; }
        .saas-input { width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; color: #1e293b; background: white; outline: none; transition: all 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
        .saas-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
        .saas-input:disabled, .disabled-input { background: #f8fafc; color: #94a3b8; border-color: #e2e8f0; cursor: not-allowed; }
        .notes-editor { min-height: 80px; resize: vertical; }
        .items-wrapper { overflow-x: auto; }
        .items-table { width: 100%; border-collapse: collapse; }
        .items-table th { background: #f8fafc; padding: 12px 16px; font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; text-align: left; }
        .items-table td { padding: 8px 16px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
        .editable-row:hover td { background: #f8fafc; }
        .locked-row td { color: #64748b; }
        .inline-input { width: 100%; padding: 8px; border: 1px solid transparent; border-radius: 6px; font-size: 13px; background: transparent; outline: none; transition: 0.2s; }
        .editable-row .inline-input:hover { border-color: #e2e8f0; background: white; }
        .editable-row .inline-input:focus { border-color: #3b82f6; background: white; box-shadow: 0 0 0 2px rgba(59,130,246,0.1); }
        .inline-input:disabled { color: inherit; }
        .flex-cell { display: flex; align-items: center; justify-content: flex-end; gap: 4px; }
        .currency-symbol { font-size: 13px; color: #94a3b8; }
        .num-input { font-family: 'JetBrains Mono', monospace; width: 80px; }
        .desc-input { font-weight: 600; color: #1e293b; min-width: 200px; }
        .btn-del-item { background: transparent; color: #cbd5e1; border: none; cursor: pointer; padding: 6px; border-radius: 6px; transition: 0.2s; }
        .btn-del-item:hover { background: #fee2e2; color: #ef4444; }
        .add-item-bar { display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-bottom: 1px solid #e2e8f0; background: white; }
        .btn-add-line { display: flex; align-items: center; gap: 6px; background: white; border: 1px dashed #cbd5e1; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; color: #3b82f6; cursor: pointer; transition: 0.2s; }
        .btn-add-line:hover { background: #eff6ff; border-color: #93c5fd; }
        .btn-sync-quote { display: flex; align-items: center; gap: 6px; background: #fff7ed; border: 1px dashed #fdba74; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; color: #ea580c; cursor: pointer; transition: 0.2s; }
        .btn-sync-quote:hover { background: #ffedd5; border-color: #f97316; }
        .tax-toggle { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: #475569; cursor: pointer; }
        .tax-toggle input { cursor: pointer; width: 16px; height: 16px; accent-color: #2563eb; }
        .items-footer { padding: 20px; background: #f8fafc; display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
        .tot-row { display: flex; justify-content: space-between; width: 250px; font-size: 13px; color: #64748b; }
        .tot-row.grand { border-top: 2px solid #e2e8f0; padding-top: 10px; margin-top: 4px; font-size: 16px; font-weight: 900; color: #0f172a; }
        .fin-summary { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
        .fs-row { display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; }
        .fs-lab { color: #94a3b8; }
        .fs-val { font-family: 'JetBrains Mono', monospace; }
        .fs-divider { height: 1px; background: #334155; margin: 4px 0; }
        .fs-grand { font-size: 18px; font-weight: 900; }
        .progress-container { margin-top: 10px; }
        .progress-bar { width: 100%; height: 8px; background: #334155; border-radius: 4px; overflow: hidden; }
        .progress-fill { height: 100%; transition: width 0.5s ease; }
        .progress-text { font-size: 10px; font-weight: 700; color: #94a3b8; text-align: right; margin-top: 6px; }
        .btn-add-pay { background: #eff6ff; color: #2563eb; border: none; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: 0.2s; }
        .btn-add-pay:hover { background: #dbeafe; }
        .payment-form { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
        .pf-grid { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
        .pf-field label { display: block; font-size: 10px; font-weight: 700; color: #64748b; margin-bottom: 4px; }
        .pf-field input, .pf-field select { width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; background: white; outline: none; }
        .btn-submit-pay { width: 100%; background: #10b981; color: white; border: none; padding: 10px; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer; transition: 0.2s; }
        .btn-submit-pay:hover:not(:disabled) { background: #059669; }
        .btn-submit-pay:disabled { opacity: 0.5; cursor: not-allowed; }
        .ledger-list { display: flex; flex-direction: column; gap: 10px; }
        .ledger-empty { text-align: center; padding: 16px; font-size: 11px; color: #94a3b8; background: #f8fafc; border-radius: 8px; border: 1px dashed #e2e8f0; }
        .ledger-item { display: flex; gap: 10px; padding: 12px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; }
        .li-icon { width: 24px; height: 24px; border-radius: 50%; background: #dcfce7; color: #10b981; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .li-data { flex: 1; }
        .li-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }
        .li-amount { font-size: 13px; font-weight: 800; color: #0f172a; }
        .li-date { font-size: 10px; font-weight: 600; color: #64748b; }
        .li-bot { font-size: 10px; color: #475569; }
        .toast-alert { position: fixed; bottom: 20px; right: 20px; padding: 12px 20px; border-radius: 8px; background: #1e293b; color: white; font-weight: 600; font-size: 13px; z-index: 1000; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .toast-alert.error { background: #ef4444; }
      `}</style>
    </AdminLayout>
  );
}