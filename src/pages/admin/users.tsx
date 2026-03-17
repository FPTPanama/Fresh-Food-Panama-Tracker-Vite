import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom"; 
import { 
  Plus, X, Mail, Phone, Loader2, Search, 
  Building2, ShieldCheck, Upload, MapPin, Info,
  Pencil, ArrowRight, UserShield, Users as UsersIcon
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { getApiBase } from "../../lib/apiBase";
import { AdminLayout, notify } from "../../components/AdminLayout";

const getInitials = (name: string) => name?.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || "??";

export default function AdminUsersPage() {
  const navigate = useNavigate(); 
  const [activeTab, setActiveTab] = useState<'clients' | 'staff'>('clients');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataList, setDataList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const initialForm = {
    id: null, 
    name: "", 
    legal_name: "", 
    tax_id: "", 
    contact_email: "", 
    phone: "", 
    country: "Panamá",
    mode: "invite" as "invite" | "manual",
    password: "",
    billing_info: { address: "", email: "", phone: "" },
    consignee_info: { address: "", email: "", phone: "" },
    notify_info: { address: "", email: "", phone: "" }
  };
  
  const [f, setF] = useState(initialForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const base = getApiBase();
      const endpoint = activeTab === 'clients' 
        ? `${base}/.netlify/functions/listClients` 
        : `${base}/.netlify/functions/listUsers`;

      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      });
      
      if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
      const data = await res.json();
      setDataList(data?.items || []);
    } catch (err: any) {
      notify(err.message || "Error al cargar datos", "error");
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredData = useMemo(() => {
    return dataList.filter(item => {
      const s = searchQuery.toLowerCase();
      const name = (item.name || item.full_name || item.email || "").toLowerCase();
      const email = (item.contact_email || item.email || "").toLowerCase();
      return name.includes(s) || email.includes(s);
    });
  }, [dataList, searchQuery]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${getApiBase()}/.netlify/functions/createClient`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(f)
      });
      if (res.ok) {
        notify("Registro creado exitosamente", "success");
        setIsDrawerOpen(false);
        loadData();
      } else {
        throw new Error("No se pudo crear el registro");
      }
    } catch (err: any) {
      notify(err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout title="Directorio Maestro" subtitle="Control de identidades y accesos">
      <div className="ff-directory-container">
        
        <div className="directory-header">
          <div className="tabs-pro">
            <button className={activeTab === 'clients' ? 'active' : ''} onClick={() => setActiveTab('clients')}>
              <Building2 size={16} /> Clientes
            </button>
            <button className={activeTab === 'staff' ? 'active' : ''} onClick={() => setActiveTab('staff')}>
              <ShieldCheck size={16} /> Staff Interno
            </button>
          </div>
          
          <div className="actions-bar">
            <div className="search-pill">
              <Search size={16} />
              <input 
                placeholder={activeTab === 'clients' ? "Buscar cliente..." : "Buscar staff..."} 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
              />
            </div>
            <button className="ff-btn-primary-top" onClick={() => { setF(initialForm); setIsDrawerOpen(true); }}>
              <Plus size={18} /> Nuevo
            </button>
          </div>
        </div>

        <div className="ff-table-wrapper card-style">
          <table className="ff-table-top">
            <thead>
              <tr>
                <th>IDENTIDAD / INFO</th>
                <th>CONTACTO</th>
                <th>{activeTab === 'clients' ? 'UBICACIÓN' : 'ROL SISTEMA'}</th>
                <th>ESTADO</th>
                <th style={{ textAlign: 'right' }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '100px' }}>
                    <Loader2 className="animate-spin inline text-emerald-500" size={32} />
                    <p style={{ marginTop: '10px', color: '#94a3b8', fontWeight: 600 }}>Sincronizando directorio...</p>
                  </td>
                </tr>
              ) : filteredData.length > 0 ? filteredData.map(item => (
                <tr 
                  key={item.id || item.user_id} 
                  className="row-hover-effect"
                  onClick={() => navigate(`/admin/users/${item.id || item.user_id}`)}
                >
                  <td>
                    <div className="identity-cell">
                      <div className="avatar-box">
                        {getInitials(item.name || item.full_name || item.email)}
                      </div>
                      <div className="meta">
                        <div className="main-name">{item.name || item.full_name || item.email?.split('@')[0]}</div>
                        <div className="sub-id">{item.tax_id || (item.role ? `ID: ${item.user_id?.substring(0,8)}` : 'ID PERSONAL')}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="contact-info">
                      <div className="email-line"><Mail size={12} /> {item.contact_email || item.email}</div>
                      {item.phone && <div className="phone-line"><Phone size={12} /> {item.phone}</div>}
                    </div>
                  </td>
                  <td>
                    <span className={`type-tag ${activeTab === 'staff' ? item.role : ''}`}>
                      {activeTab === 'clients' ? (item.country || 'Panamá') : (item.role?.toUpperCase() || 'STAFF')}
                    </span>
                  </td>
                  <td>
                    <span className={`status-pill-pro ${item.has_platform_access || item.confirmed_at ? 'active' : 'pending'}`}>
                      {item.has_platform_access || item.confirmed_at ? 'ACTIVO' : 'PROSPECTO'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="action-btn-circle">
                      <ArrowRight size={16} />
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
                    No se encontraron registros que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isDrawerOpen && (
        <>
          <div className="ff-overlay animate-fade-in" onClick={() => setIsDrawerOpen(false)} />
          <div className="ff-drawer-pro animate-slide-left">
            <div className="drawer-header">
              <h3 style={{ fontWeight: 900 }}>Nuevo Registro</h3>
              <button className="close-btn" onClick={() => setIsDrawerOpen(false)}><X /></button>
            </div>
            <form onSubmit={handleSave} className="drawer-body">
              <div className="input-group">
                <label>Nombre Comercial / Nombre Completo</label>
                <input required placeholder="Ej: Fresh Food Corp" value={f.name} onChange={e=>setF({...f, name:e.target.value})} />
              </div>
              <div className="input-group">
                <label>Correo Electrónico</label>
                <input required type="email" placeholder="email@dominio.com" value={f.contact_email} onChange={e=>setF({...f, contact_email:e.target.value})} />
              </div>
              <button type="submit" disabled={isSaving} className="btn-submit-god">
                {isSaving ? <Loader2 className="animate-spin" /> : "Crear Identidad"}
              </button>
            </form>
          </div>
        </>
      )}

      <style>{`
        .ff-directory-container { display: flex; flex-direction: column; gap: 24px; }
        .directory-header { display: flex; justify-content: space-between; align-items: center; background: white; padding: 10px; border-radius: 20px; border: 1px solid #f1f5f9; }
        .tabs-pro { display: flex; gap: 8px; background: #f8fafc; padding: 6px; border-radius: 15px; }
        .tabs-pro button { display: flex; align-items: center; gap: 8px; padding: 10px 20px; border: none; background: none; border-radius: 12px; font-size: 13px; font-weight: 700; color: #64748b; cursor: pointer; transition: 0.3s; }
        .tabs-pro button.active { background: white; color: #0f172a; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .actions-bar { display: flex; gap: 12px; }
        .search-pill { display: flex; align-items: center; gap: 10px; background: #f1f5f9; padding: 0 15px; border-radius: 15px; border: 1px solid #e2e8f0; width: 280px; }
        .search-pill input { border: none; background: none; outline: none; width: 100%; font-size: 13px; font-weight: 600; height: 40px; }
        .ff-table-wrapper.card-style { background: white; border-radius: 25px; border: 1px solid #f1f5f9; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.02); }
        .ff-table-top { width: 100%; border-collapse: collapse; }
        .ff-table-top th { text-align: left; padding: 20px; font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; border-bottom: 1px solid #f1f5f9; }
        .ff-table-top td { padding: 18px 20px; border-bottom: 1px solid #f8fafc; vertical-align: middle; }
        .row-hover-effect { transition: 0.2s; cursor: pointer; }
        .row-hover-effect:hover { background: #f0fdf4; }
        .identity-cell { display: flex; align-items: center; gap: 14px; }
        .avatar-box { width: 44px; height: 44px; background: #f1f5f9; border-radius: 12px; display: grid; placeItems: center; font-weight: 800; color: #475569; border: 1px solid #e2e8f0; }
        .main-name { font-weight: 600; color: #0f172a; font-size: 14px; }
        .sub-id { font-size: 11px; color: #94a3b8; font-family: 'JetBrains Mono', monospace; }
        .contact-info { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: #475569; }
        .email-line, .phone-line { display: flex; align-items: center; gap: 6px; }
        .type-tag { font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 8px; background: #f1f5f9; color: #64748b; }
        .type-tag.admin { background: #0f172a; color: white; }
        .type-tag.superadmin { background: #ef4444; color: white; }
        .status-pill-pro { font-size: 9px; font-weight: 800; padding: 4px 10px; border-radius: 8px; }
        .status-pill-pro.active { background: rgba(16, 185, 129, 0.1); color: #059669; }
        .status-pill-pro.pending { background: rgba(245, 158, 11, 0.1); color: #d97706; }
        .action-btn-circle { width: 32px; height: 32px; border-radius: 50%; display: grid; placeItems: center; color: #cbd5e1; transition: 0.3s; }
        .row-hover-effect:hover .action-btn-circle { background: #0f172a; color: white; transform: translateX(3px); }
        .ff-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(4px); z-index: 999; }
        .ff-drawer-pro { position: fixed; top: 0; right: 0; bottom: 0; width: 460px; background: white; z-index: 1000; box-shadow: -20px 0 50px rgba(0,0,0,0.1); display: flex; flex-direction: column; }
        .drawer-header { padding: 30px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        .drawer-body { padding: 30px; display: flex; flex-direction: column; gap: 20px; flex: 1; }
        .input-group label { display: block; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px; }
        .input-group input { width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 12px; outline: none; transition: 0.2s; font-weight: 600; }
        .btn-submit-god { background: #0f172a; color: white; border: none; padding: 18px; border-radius: 15px; font-weight: 800; cursor: pointer; margin-top: auto; transition: 0.3s; }
        .animate-slide-left { animation: slideLeft 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes slideLeft { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-fade-in { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </AdminLayout>
  );
}