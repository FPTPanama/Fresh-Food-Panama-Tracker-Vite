import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { AdminLayout, notify } from '@/components/AdminLayout';
import { 
  Plus, Calculator, KeyRound, Mail, Loader2, 
  ChevronRight, Search, X, Users, Globe, 
  SortAsc, ShieldCheck, Building2, UserCheck, Trash2
} from 'lucide-react';

// MODALES
import { QuickQuoteModal } from '@/components/quotes/QuickQuoteModal';
import { NewClientModal } from '@/components/clients/NewClientModal';

const getFlag = (country: string) => {
  const flags: Record<string, string> = {
    'Panamá': '🇵🇦', 'España': '🇪🇸', 'Colombia': '🇨🇴', 'USA': '🇺🇸', 
    'Ecuador': '🇪🇨', 'Costa Rica': '🇨🇷', 'Chile': '🇨🇱', 'México': '🇲🇽'
  };
  return flags[country] || '🌐';
};

const ClientSkeleton = () => (
  <div className="quote-row-item skeleton-row">
    <div className="col-ident"><div className="client-profile-box"><div className="skel-avatar"></div><div className="name-stack" style={{ flex: 1 }}><div className="skel-line w70"></div><div className="skel-line w40"></div></div></div></div>
    <div className="col-client"><div className="skel-pill w80" style={{ height: '28px' }}></div></div>
    <div className="col-route"><div className="skel-line w60"></div></div>
    <div className="col-amount"><div className="skel-pill w50"></div></div>
    <div className="col-status"><div className="skel-line w40" style={{ marginRight: '20px' }}></div><div className="skel-line w10" style={{ height: '20px' }}></div></div>
  </div>
);

export default function ClientsIndex() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'clients' | 'staff'>('clients');
  const [dataList, setDataList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [dir, setDir] = useState<"asc" | "desc">("asc");

  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'clients') {
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .order('name', { ascending: dir === 'asc' });
        if (error) throw error;
        setDataList(data || []);
      } else {
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, email, role, full_name, position')
          .in('role', ['admin', 'superadmin'])
          .order('email', { ascending: dir === 'asc' });
        if (error) throw error;
        setDataList(data || []);
      }
    } catch (e) {
      notify("Error al sincronizar directorio", "error");
    } finally {
      setLoading(false);
    }
  }, [activeTab, dir]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredData = useMemo(() => {
    return dataList.filter(item => {
      const search = q.toLowerCase();
      const textToSearch = (
        item?.name || 
        item?.full_name || 
        item?.email || 
        ""
      ).toLowerCase();
      return textToSearch.includes(search);
    });
  }, [dataList, q]);

  const handleResetPassword = async (email: string) => {
    if (!email) return notify("No hay email registrado", "error");
    if (!window.confirm(`¿Enviar restablecimiento oficial a ${email}?`)) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      notify("Correo de seguridad enviado", "success");
    } catch (e: any) {
      notify(e.message, "error");
    }
  };

  // FUNCIÓN DE ELIMINACIÓN UNIFICADA
  const handleDelete = async (e: React.MouseEvent, item: any) => {
    e.stopPropagation();
    const isStaff = activeTab === 'staff';
    const idToDelete = isStaff ? item.user_id : item.id;
    const nameToDisplay = isStaff ? (item.full_name || item.email) : item.name;
    const table = isStaff ? 'profiles' : 'clients';
    const column = isStaff ? 'user_id' : 'id';

    if (!idToDelete) return;

    if (!window.confirm(`¿ESTÁS SEGURO? Se eliminará permanentemente a "${nameToDisplay}" de la base de datos. Esta acción no se puede deshacer.`)) return;

    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq(column, idToDelete);

      if (error) throw error;

      notify("Registro eliminado con éxito", "success");
      setDataList(prev => prev.filter(i => (isStaff ? i.user_id : i.id) !== idToDelete));
    } catch (err: any) {
      notify("Error al eliminar: Verifica permisos de Superadmin", "error");
    }
  };

  return (
    <AdminLayout title="Directorio Maestro" subtitle="Control de cuentas y equipo administrativo">
      <div className="quotes-page-wrapper">
        
        <div className="header-section">
          <div className="tabs-navigation-pro">
            <button className={activeTab === 'clients' ? 'active' : ''} onClick={() => setActiveTab('clients')}>
              <Building2 size={16} /> Clientes
            </button>
            <button className={activeTab === 'staff' ? 'active' : ''} onClick={() => setActiveTab('staff')}>
              <UserCheck size={16} /> Staff Admin
            </button>
          </div>
          {activeTab === 'clients' && (
            <button className="btn-main-action" onClick={() => setIsNewClientModalOpen(true)}>
              <Plus size={20} strokeWidth={2} /> Nuevo Cliente
            </button>
          )}
        </div>

        <div className="stats-dashboard">
          <div className="metric-card">
            <div className="metric-content">
              <span className="metric-label">{activeTab === 'clients' ? 'Cuentas' : 'Staff Activo'}</span>
              <span className="value">{dataList.length}</span>
            </div>
            <div className={`metric-icon ${activeTab === 'clients' ? 'green' : 'blue'}`}>
                {activeTab === 'clients' ? <Users size={24} /> : <ShieldCheck size={24} />}
            </div>
          </div>
        </div>

        <div className="filters-bar">
          <div className="search-container">
            <Search size={18} className="search-icon" />
            <input placeholder="Buscar en el directorio..." value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <button className="sort-toggle" onClick={() => setDir(dir === 'asc' ? 'desc' : 'asc')}>
            <SortAsc size={16} /> {dir === 'asc' ? 'A-Z' : 'Z-A'}
          </button>
        </div>

        <div className="quotes-list-container">
          {loading ? (
            <><ClientSkeleton /><ClientSkeleton /><ClientSkeleton /><ClientSkeleton /><ClientSkeleton /></>
          ) : (
            filteredData.map((item) => {
              const isStaff = activeTab === 'staff';
              const email = isStaff ? item?.email : item?.contact_email;
              const name = isStaff 
                ? (item?.full_name || item?.email?.split('@')[0].toUpperCase() || 'ADMIN') 
                : (item?.name || 'S/N');
              
              const sub = isStaff 
                ? (item?.position || `ACCESO: ${item?.role?.toUpperCase() || 'ADMIN'}`) 
                : (item?.tax_id || 'SIN TAX ID');
                
              const rowId = isStaff ? item?.user_id : item?.id;

              return (
                <div 
                  key={rowId || `item-${Math.random()}`} 
                  className="quote-row-item row-interactive" 
                  onClick={() => {
                    if (isStaff) {
                      navigate(`/admin/staff/${rowId}`);
                    } else {
                      navigate(`/admin/users/${rowId}`);
                    }
                  }}
                >
                  <div className="col-ident">
                    <div className="client-profile-box">
                      <div className="avatar-mini">
                        {(!isStaff && item?.logo_url) ? (
                          <img src={`https://oqgkbduqztrpfhfclker.supabase.co/storage/v1/object/public/client-logos/${item.logo_url}`} alt="logo" />
                        ) : (
                          <div className={`avatar-initials-mini ${isStaff ? 'staff-bg' : ''}`}>
                            {(name || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="name-stack">
                        <span className="client-name-text">{name}</span>
                        <span className="tax-id-sub">{sub}</span>
                      </div>
                    </div>
                  </div>

                  <div className="col-client">
                    {email ? (
                      <div className="contact-info-pill"><Mail size={12} /><span>{email}</span></div>
                    ) : <span className="empty-label">Sin email</span>}
                  </div>

                  <div className="col-route">
                    {!isStaff ? (
                      <div className="location-badge">
                        <span className="flag-circle">{getFlag(item?.country)}</span>
                        <span className="country-name">{item?.country || 'Panamá'}</span>
                      </div>
                    ) : (
                      <span className={`role-badge-pill ${item?.role || 'admin'}`}>{item?.role || 'admin'}</span>
                    )}
                  </div>

                  <div className="col-amount">
                    <span className="status-pill-client active">Activo</span>
                  </div>

                  <div className="col-status">
                    <div className="actions-inline">
                      {!isStaff && (
                        <button className="btn-circle orange" onClick={(e) => { e.stopPropagation(); setSelectedClientId(item.id); setIsQuoteModalOpen(true); }}><Calculator size={14} /></button>
                      )}
                      <button className="btn-circle green" onClick={(e) => { e.stopPropagation(); handleResetPassword(email); }}><KeyRound size={14} /></button>
                      
                      {/* BOTÓN ELIMINAR (CLIENTE O STAFF) */}
                      <button 
                        className="btn-circle red-delete" 
                        onClick={(e) => handleDelete(e, item)}
                        title="Eliminar registro"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <QuickQuoteModal isOpen={isQuoteModalOpen} onClose={() => setIsQuoteModalOpen(false)} initialClientId={selectedClientId} />
      <NewClientModal isOpen={isNewClientModalOpen} onClose={() => setIsNewClientModalOpen(false)} onSuccess={fetchData} />

      <style>{`
        .quotes-page-wrapper { padding: 10px 0; max-width: 1400px; margin: 0 auto; }
        .header-section { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 35px; }
        .tabs-navigation-pro { display: flex; gap: 8px; background: #f1f5f9; padding: 6px; border-radius: 16px; width: fit-content; }
        .tabs-navigation-pro button { display: flex; align-items: center; gap: 8px; padding: 10px 20px; border: none; background: none; border-radius: 12px; font-size: 13px; font-weight: 700; color: #64748b; cursor: pointer; transition: 0.3s; }
        .tabs-navigation-pro button.active { background: white; color: #0f172a; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .btn-main-action { background: #0f172a; color: white; border: none; padding: 12px 24px; border-radius: 14px; font-weight: 700; display: flex; align-items: center; gap: 10px; cursor: pointer; transition: 0.3s; box-shadow: 0 10px 15px -3px rgba(15, 23, 42, 0.2); }
        .btn-main-action:hover { transform: translateY(-2px); background: #1e293b; }
        .stats-dashboard { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: white; padding: 20px; border-radius: 20px; border: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        .metric-label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
        .metric-card .value { font-size: 28px; font-weight: 800; color: #0f172a; }
        .metric-icon { width: 48px; height: 48px; border-radius: 14px; display: grid; place-items: center; }
        .metric-icon.blue { background: #eff6ff; color: #3b82f6; }
        .metric-icon.green { background: #f0fdf4; color: #10b981; }
        .filters-bar { display: flex; align-items: center; gap: 16px; margin-bottom: 25px; }
        .search-container { position: relative; flex: 1; }
        .search-icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
        .search-container input { width: 100%; padding: 12px 16px 12px 48px; border-radius: 16px; border: 1px solid #e2e8f0; background: white; font-size: 14px; outline: none; font-weight: 600; }
        .quotes-list-container { display: flex; flex-direction: column; gap: 12px; }
        .quote-row-item { background: white; padding: 16px 24px; border-radius: 20px; border: 1px solid #f1f5f9; display: grid; grid-template-columns: 1.5fr 1.5fr 1fr 0.8fr 1fr; align-items: center; cursor: pointer; transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .quote-row-item:hover { border-color: #cbd5e1; transform: translateX(8px); box-shadow: 0 10px 25px rgba(0,0,0,0.04); }
        .client-profile-box { display: flex; align-items: center; gap: 14px; }
        .avatar-mini { width: 44px; height: 44px; border-radius: 12px; border: 1px solid #f1f5f9; overflow: hidden; background: #f8fafc; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
        .avatar-mini img { width: 100%; height: 100%; object-fit: contain; padding: 4px; }
        .avatar-initials-mini { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #0f172a; color: white; font-size: 16px; font-weight: 800; }
        .avatar-initials-mini.staff-bg { background: #3b82f6; }
        .client-name-text { display: block; font-size: 14px; font-weight: 700; color: #1e293b; }
        .tax-id-sub { font-size: 11px; color: #94a3b8; font-weight: 600; font-family: 'JetBrains Mono', monospace; }
        .contact-info-pill { display: inline-flex; align-items: center; gap: 8px; background: #f1f5f9; padding: 6px 12px; border-radius: 10px; font-size: 12px; color: #475569; font-weight: 600; }
        .location-badge { display: flex; align-items: center; gap: 8px; }
        .country-name { font-size: 12px; font-weight: 700; color: #475569; }
        .role-badge-pill { font-size: 10px; font-weight: 800; padding: 4px 12px; border-radius: 8px; text-transform: uppercase; }
        .role-badge-pill.superadmin { background: #fef2f2; color: #ef4444; }
        .role-badge-pill.admin { background: #eff6ff; color: #3b82f6; }
        .status-pill-client { padding: 5px 12px; border-radius: 10px; font-size: 9px; font-weight: 900; text-transform: uppercase; background: rgba(16, 185, 129, 0.1); color: #059669; }
        .actions-inline { display: flex; gap: 10px; margin-right: 15px; }
        .btn-circle { width: 36px; height: 36px; border-radius: 12px; border: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: center; background: white; color: #94a3b8; transition: 0.2s; }
        .btn-circle:hover { transform: scale(1.1); color: #0f172a; }
        .btn-circle.red-delete:hover { background: #fef2f2; color: #ef4444; border-color: #fee2e2; }
        .col-status { display: flex; align-items: center; justify-content: flex-end; }
        .skeleton-row { pointer-events: none; border-color: #f1f5f9 !important; }
        .skel-avatar { width: 44px; height: 44px; background: #f1f5f9; border-radius: 12px; position: relative; overflow: hidden; }
        .skel-line { height: 12px; background: #f1f5f9; border-radius: 4px; margin-bottom: 8px; position: relative; overflow: hidden; }
        .skel-pill { height: 24px; background: #f1f5f9; border-radius: 50px; position: relative; overflow: hidden; }
        .skel-avatar::after, .skel-line::after, .skel-pill::after { content: ""; position: absolute; inset: 0; transform: translateX(-100%); background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent); animation: shimmer 1.5s infinite; }
        @keyframes shimmer { 100% { transform: translateX(100%); } }
        .w10 { width: 10%; } .w40 { width: 40%; } .w50 { width: 50%; } .w60 { width: 60%; } .w70 { width: 70%; } .w80 { width: 80%; }
        .empty-label { color: #cbd5e1; font-size: 12px; font-style: italic; }
      `}</style>
    </AdminLayout>
  );
}