import { useEffect, useState, useMemo } from "react";
import { getApiBase } from "@/lib/apiBase";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { AdminLayout } from "@/components/AdminLayout";
import { requireAdminOrRedirect } from "@/lib/requireAdmin";
import { 
  Search, FileText, Loader2, DollarSign, AlertCircle, 
  CheckCircle2, Clock, ArrowUpRight, Filter, Building2, Plus, RefreshCw, Trash2, Ban
} from "lucide-react";

type Invoice = {
  id: string;
  invoice_number: string;
  client_id: string;
  status: string;
  issue_date: string;
  due_date: string;
  total: number;
  amount_paid: number;
  clients?: { name: string };
};

export default function AdminInvoiceList() {
  const navigate = useNavigate();
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (r.ok) {
        setAuthReady(true);
        fetchInvoices();
      }
    })();
  }, []);

  async function fetchInvoices() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select(`*, clients(name)`)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setInvoices(data || []);
    } catch (err) {
      console.error("Error cargando facturas:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleCreateManualInvoice = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sesión inválida");

      const res = await fetch(`${getApiBase()}/.netlify/functions/createInvoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${session.access_token}`
        }
      });

      if (!res.ok) throw new Error("Error del servidor backend.");
      
      const newInv = await res.json();
      navigate(`/admin/invoices/${newInv.id}`);
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- NUEVAS ACCIONES DE GESTIÓN ---
  const handleDelete = async (id: string, invoiceNumber: string) => {
    if (!window.confirm(`⚠️ PELIGRO: ¿Estás seguro de ELIMINAR permanentemente la factura ${invoiceNumber}? Esto romperá la secuencia de tu facturación y no se puede deshacer.`)) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) throw error;
      fetchInvoices();
    } catch (err: any) {
      alert("Error al eliminar: " + err.message);
      setLoading(false);
    }
  };

  const handleArchiveVoid = async (id: string, invoiceNumber: string) => {
    if (!window.confirm(`¿Quieres ANULAR / ARCHIVAR la factura ${invoiceNumber}? Su saldo pasará a cero y no afectará tus métricas.`)) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.from('invoices').update({ status: 'VOID', amount_paid: 0 }).eq('id', id);
      if (error) throw error;
      fetchInvoices();
    } catch (err: any) {
      alert("Error al anular: " + err.message);
      setLoading(false);
    }
  };

  const kpis = useMemo(() => {
    let totalBilled = 0;
    let totalCollected = 0;
    let totalPending = 0;
    let totalOverdue = 0;
    const now = new Date().getTime();

    invoices.forEach(inv => {
      if (inv.status === 'VOID') return;
      const balance = Number(inv.total) - Number(inv.amount_paid);
      const isOverdue = inv.status !== 'PAID' && new Date(inv.due_date).getTime() < now;

      totalBilled += Number(inv.total);
      totalCollected += Number(inv.amount_paid);
      totalPending += balance;
      if (isOverdue) totalOverdue += balance;
    });
    return { totalBilled, totalCollected, totalPending, totalOverdue };
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (filterStatus !== "ALL") {
        if (filterStatus === "OVERDUE") {
          const isOverdue = inv.status !== 'PAID' && inv.status !== 'VOID' && new Date(inv.due_date).getTime() < new Date().getTime();
          if (!isOverdue) return false;
        } else if (inv.status !== filterStatus) {
          return false;
        }
      }
      const term = searchTerm.toLowerCase();
      if (term) {
        const clientName = (inv.clients?.name || "").toLowerCase();
        const invNum = (inv.invoice_number || "").toLowerCase();
        if (!clientName.includes(term) && !invNum.includes(term)) return false;
      }
      return true;
    });
  }, [invoices, searchTerm, filterStatus]);

  const getStatusBadge = (status: string, dueDate: string) => {
    const isOverdue = status !== 'PAID' && status !== 'VOID' && new Date(dueDate).getTime() < new Date().getTime();
    if (isOverdue) return <span className="ff-badge red"><AlertCircle size={10}/> VENCIDA</span>;
    if (status === 'PAID') return <span className="ff-badge green"><CheckCircle2 size={10}/> PAGADA</span>;
    if (status === 'PARTIAL') return <span className="ff-badge blue"><Clock size={10}/> PARCIAL</span>;
    if (status === 'VOID') return <span className="ff-badge gray">ANULADA</span>;
    return <span className="ff-badge orange"><Clock size={10}/> PENDIENTE</span>;
  };

  if (!authReady) {
    return <div className="flex items-center justify-center min-h-screen bg-slate-50"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;
  }

  return (
    <AdminLayout title="Cuentas por Cobrar (AR)">
      <div className="ar-container">
        
        <div className="ar-header">
          <div>
            <h1 className="ar-title">Facturación y Cuentas por Cobrar</h1>
            <p className="ar-subtitle">Gestión de ingresos y control de liquidez</p>
          </div>
          <div className="header-actions">
            <button className="btn-outline" onClick={handleCreateManualInvoice} disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin"/> : <Plus size={16}/>} Nueva Factura
            </button>
            <button className="btn-primary" onClick={() => fetchInvoices()}>
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>
          </div>
        </div>

        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-icon blue"><DollarSign size={20}/></div>
            <div className="kpi-data"><span className="kpi-label">Facturado (Total)</span><span className="kpi-value">${kpis.totalBilled.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon green"><CheckCircle2 size={20}/></div>
            <div className="kpi-data"><span className="kpi-label">Recaudado (Cobrado)</span><span className="kpi-value">${kpis.totalCollected.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
          </div>
          <div className="kpi-card highlight">
            <div className="kpi-icon orange"><Clock size={20}/></div>
            <div className="kpi-data"><span className="kpi-label">Cuentas por Cobrar</span><span className="kpi-value">${kpis.totalPending.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
          </div>
          <div className={`kpi-card ${kpis.totalOverdue > 0 ? 'danger' : ''}`}>
            <div className="kpi-icon red"><AlertCircle size={20}/></div>
            <div className="kpi-data"><span className="kpi-label">Cartera Vencida</span><span className="kpi-value">${kpis.totalOverdue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
          </div>
        </div>

        <div className="ar-toolbar">
          <div className="search-box">
            <Search size={16} className="search-icon" />
            <input type="text" placeholder="Buscar por Nº Factura o Cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
          </div>
          <div className="filter-box">
            <Filter size={16} className="filter-icon"/>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="ALL">Todos los Estados</option>
              <option value="UNPAID">Pendientes</option>
              <option value="PARTIAL">Pagos Parciales</option>
              <option value="PAID">Pagadas</option>
              <option value="OVERDUE">Vencidas</option>
              <option value="VOID">Anuladas / Archivadas</option>
            </select>
          </div>
        </div>

        <div className="ar-table-wrapper">
          {loading ? (
            <div className="empty-state"><Loader2 size={32} className="animate-spin text-blue-500" /><p>Sincronizando finanzas...</p></div>
          ) : filteredInvoices.length === 0 ? (
            <div className="empty-state"><FileText size={48} color="#cbd5e1" /><p>No hay facturas con estos filtros.</p></div>
          ) : (
            <table className="ar-table">
              <thead>
                <tr>
                  <th>Nº Factura</th>
                  <th>Cliente</th>
                  <th>Emisión</th>
                  <th>Vencimiento</th>
                  <th className="txt-right">Total (USD)</th>
                  <th className="txt-right">Pendiente</th>
                  <th className="txt-center">Estado</th>
                  <th className="txt-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => {
                  const balance = Number(inv.total) - Number(inv.amount_paid);
                  return (
                    <tr key={inv.id} onClick={() => navigate(`/admin/invoices/${inv.id}`)} className="clickable-row">
                      <td className="font-mono font-bold text-slate-700">{inv.invoice_number}</td>
                      <td className="font-bold flex items-center gap-2"><Building2 size={14} className="text-slate-400"/> {inv.clients?.name || "Sin Asignar"}</td>
                      <td>{new Date(inv.issue_date).toLocaleDateString('es-PA')}</td>
                      <td className="font-mono text-slate-500">{new Date(inv.due_date).toLocaleDateString('es-PA')}</td>
                      <td className="txt-right font-bold">${Number(inv.total).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td className="txt-right font-bold text-blue-600">${balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td className="txt-center">{getStatusBadge(inv.status, inv.due_date)}</td>
                      <td className="txt-right">
                        <div className="action-btns">
                          <button className="btn-icon" title="Ver / Cobrar" onClick={(e) => { e.stopPropagation(); navigate(`/admin/invoices/${inv.id}`); }}><ArrowUpRight size={14}/></button>
                          {inv.status !== 'VOID' && (
                            <button className="btn-icon warn" title="Anular / Archivar" onClick={(e) => { e.stopPropagation(); handleArchiveVoid(inv.id, inv.invoice_number); }}><Ban size={14}/></button>
                          )}
                          <button className="btn-icon danger" title="Eliminar Permanente" onClick={(e) => { e.stopPropagation(); handleDelete(inv.id, inv.invoice_number); }}><Trash2 size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <style>{`
        .ar-container { max-width: 1200px; margin: 0 auto; padding: 20px; font-family: 'Inter', sans-serif; color: #0f172a; }
        .ar-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px; }
        .ar-title { font-size: 24px; font-weight: 900; color: #1e293b; margin: 0 0 4px 0; letter-spacing: -0.5px; }
        .ar-subtitle { font-size: 13px; color: #64748b; margin: 0; }
        
        .header-actions { display: flex; gap: 12px; align-items: center; }
        .btn-primary { background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; gap: 8px; align-items: center; transition: 0.2s; box-shadow: 0 2px 4px rgba(37,99,235,0.1); }
        .btn-primary:hover:not(:disabled) { background: #1d4ed8; }
        .btn-outline { background: white; color: #1e293b; border: 1px solid #cbd5e1; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; gap: 8px; align-items: center; transition: 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .btn-outline:hover:not(:disabled) { background: #f8fafc; border-color: #94a3b8; }
        .btn-outline:disabled { opacity: 0.6; cursor: not-allowed; }

        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
        .kpi-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; align-items: center; gap: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.02); transition: 0.2s; }
        .kpi-card:hover { border-color: #cbd5e1; box-shadow: 0 4px 6px rgba(0,0,0,0.04); }
        .kpi-card.highlight { border: 2px solid #3b82f6; background: #f8fafc; }
        .kpi-card.danger { border: 2px solid #ef4444; background: #fef2f2; }
        .kpi-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
        .kpi-icon.blue { background: #eff6ff; color: #3b82f6; }
        .kpi-icon.green { background: #f0fdf4; color: #10b981; }
        .kpi-icon.orange { background: #fff7ed; color: #f59e0b; }
        .kpi-icon.red { background: #fee2e2; color: #ef4444; }
        .kpi-data { display: flex; flex-direction: column; }
        .kpi-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
        .kpi-value { font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; line-height: 1; }
        .kpi-card.highlight .kpi-value { color: #1d4ed8; }
        .kpi-card.danger .kpi-value { color: #b91c1c; }

        .ar-toolbar { display: flex; gap: 16px; margin-bottom: 20px; background: white; padding: 12px; border-radius: 12px; border: 1px solid #e2e8f0; }
        .search-box, .filter-box { position: relative; flex: 1; display: flex; align-items: center; }
        .filter-box { flex: 0 0 250px; }
        .search-icon, .filter-icon { position: absolute; left: 12px; color: #94a3b8; }
        .ar-toolbar input, .ar-toolbar select { width: 100%; padding: 10px 12px 10px 36px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; font-weight: 500; color: #1e293b; outline: none; background: #f8fafc; transition: 0.2s; }
        .ar-toolbar input:focus, .ar-toolbar select:focus { border-color: #3b82f6; background: white; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }

        .ar-table-wrapper { background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
        .ar-table { width: 100%; border-collapse: collapse; text-align: left; }
        .ar-table th { background: #f8fafc; padding: 14px 16px; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; }
        .ar-table td { padding: 14px 16px; font-size: 13px; color: #1e293b; border-bottom: 1px solid #f1f5f9; }
        .clickable-row { cursor: pointer; transition: 0.15s; }
        .clickable-row:hover { background: #f8fafc; }
        .txt-right { text-align: right; }
        .txt-center { text-align: center; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        
        .ff-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 20px; font-size: 10px; font-weight: 800; letter-spacing: 0.5px; }
        .ff-badge.green { background: #dcfce7; color: #166534; }
        .ff-badge.orange { background: #fef3c7; color: #b45309; }
        .ff-badge.red { background: #fee2e2; color: #b91c1c; }
        .ff-badge.blue { background: #dbeafe; color: #1d4ed8; }
        .ff-badge.gray { background: #f1f5f9; color: #475569; }

        .action-btns { display: flex; gap: 6px; justify-content: flex-end; }
        .btn-icon { width: 28px; height: 28px; border-radius: 6px; background: white; border: 1px solid #cbd5e1; color: #64748b; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
        .btn-icon:hover { background: #f1f5f9; color: #0f172a; border-color: #94a3b8; }
        .btn-icon.danger:hover { background: #fee2e2; color: #ef4444; border-color: #fca5a5; }
        .btn-icon.warn:hover { background: #fff7ed; color: #ea580c; border-color: #fdba74; }
        .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 20px; color: #94a3b8; gap: 16px; }
      `}</style>
    </AdminLayout>
  );
}