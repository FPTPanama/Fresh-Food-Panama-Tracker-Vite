import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { AdminLayout, notify } from '@/components/AdminLayout';
import { 
  Plus, Calculator, KeyRound, Mail, Loader2, 
  Search, Users, SortAsc, Building2, 
  UserCheck, Trash2, UserPlus, MapPin, ChevronLeft, ChevronRight, Filter, X,
  Bot, Zap, User // <-- NUEVOS ÍCONOS AÑADIDOS
} from 'lucide-react';

// MODALES
import { QuickQuoteModal } from '@/components/quotes/QuickQuoteModal';
import { NewClientModal } from '@/components/clients/NewClientModal';

const getFlag = (country: string) => {
  if (!country) return '🌐';
  const flags: Record<string, string> = {
    'Panamá': '🇵🇦', 'España': '🇪🇸', 'Colombia': '🇨🇴', 'Ecuador': '🇪🇨', 
    'Costa Rica': '🇨🇷', 'Chile': '🇨🇱', 'México': '🇲🇽', 'USA': '🇺🇸',
    'Estados Unidos': '🇺🇸', 'United States': '🇺🇸', 'Alemania': '🇩🇪',
    'Francia': '🇫🇷', 'Reino Unido': '🇬🇧', 'Italia': '🇮🇹', 'Países Bajos': '🇳🇱',
    'Holanda': '🇳🇱', 'Bélgica': '🇧🇪', 'Suiza': '🇨🇭', 'Polonia': '🇵🇱'
  };
  return flags[country] || '🌐';
};

// --- NUEVO COMPONENTE DE BADGE ---
const LeadSourceBadge = ({ source }: { source: string }) => {
  switch (source) {
    case 'ai-cron':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <Zap size={10} className="text-emerald-600" fill="currentColor" />
          Auto-Lead
        </span>
      );
    case 'ai-manual':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
          <Bot size={10} className="text-blue-600" />
          IA Manual
        </span>
      );
    case 'manual':
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
          <User size={10} className="text-gray-500" />
          Vendedor
        </span>
      );
  }
};

const ClientSkeleton = () => (
  <div className="ff-list-row skeleton-row">
    <div className="col-ident"><div className="client-profile-box"><div className="skel-avatar"></div><div className="name-stack" style={{ flex: 1 }}><div className="skel-line w70"></div><div className="skel-line w40"></div></div></div></div>
    <div className="col-contact"><div className="skel-pill w80" style={{ height: '24px' }}></div></div>
    <div className="col-route"><div className="skel-line w60"></div></div>
    <div className="col-status"><div className="skel-pill w50"></div></div>
    <div className="col-actions"><div className="skel-line w40" style={{ marginLeft: 'auto' }}></div></div>
  </div>
);

export default function ClientsIndex() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'clients' | 'staff'>('clients');
  const [dataList, setDataList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  
  // ESTADOS DE FILTRO Y PAGINACIÓN
  const [q, setQ] = useState("");
  const [accessFilter, setAccessFilter] = useState("");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [globalCounts, setGlobalCounts] = useState({ clients: 0, staff: 0 });
  const itemsPerPage = 12;

  // ESTADOS DE MODALES
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const fetchGlobalCounts = async () => {
    try {
      const [{ count: cCount }, { count: sCount }] = await Promise.all([
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('user_id', { count: 'exact', head: true }).in('role', ['admin', 'superadmin'])
      ]);
      setGlobalCounts({ clients: cCount || 0, staff: sCount || 0 });
    } catch (error) {
      console.error("Error fetching counts");
    }
  };

  useEffect(() => { fetchGlobalCounts(); }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      if (activeTab === 'clients') {
        let query = supabase.from('clients').select('*', { count: 'exact' });
        
        if (q) query = query.or(`name.ilike.%${q}%,contact_email.ilike.%${q}%,tax_id.ilike.%${q}%`);
        if (accessFilter === 'access') query = query.eq('has_platform_access', true);
        if (accessFilter === 'no_access') query = query.eq('has_platform_access', false);

        const { data, count, error } = await query
          .order('name', { ascending: dir === 'asc' })
          .range(from, to);

        if (error) throw error;
        setDataList(data || []);
        setTotalItems(count || 0);

      } else {
        let query = supabase.from('profiles').select('user_id, email, role, full_name, position', { count: 'exact' })
          .in('role', ['admin', 'superadmin']);

        if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
        if (accessFilter) query = query.eq('role', accessFilter);

        const { data, count, error } = await query
          .order('email', { ascending: dir === 'asc' })
          .range(from, to);

        if (error) throw error;
        setDataList(data || []);
        setTotalItems(count || 0);
      }
    } catch (e) {
      notify("Error al sincronizar directorio", "error");
    } finally {
      setLoading(false);
    }
  }, [activeTab, dir, page, q, accessFilter]);

  useEffect(() => { 
    const delay = setTimeout(() => { fetchData(); }, 300);
    return () => clearTimeout(delay);
  }, [fetchData]);

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const handlePrevPage = () => setPage(p => Math.max(1, p - 1));
  const handleNextPage = () => setPage(p => Math.min(totalPages, p + 1));

  // --- ACCIONES ---
  const handleInviteClient = async (e: React.MouseEvent, item: any) => {
    e.stopPropagation();
    if (!item.contact_email) return notify("El cliente no tiene un email válido", "error");
    if (!window.confirm(`¿Enviar invitación oficial para ${item.name}?`)) return;

    setInvitingId(item.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Tu sesión ha expirado.");

      const response = await fetch('/.netlify/functions/inviteUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ email: item.contact_email, full_name: item.contact_name || item.name, role: 'client', client_id: item.id })
      });

      if (!response.ok) throw new Error("Error al procesar invitación");
      notify("Invitación enviada exitosamente", "success");
      fetchData(); 
    } catch (err: any) {
      notify(err.message, "error");
    } finally {
      setInvitingId(null);
    }
  };

  const handleResetPassword = async (email: string) => {
    if (!email) return notify("No hay email registrado", "error");
    if (!window.confirm(`¿Enviar restablecimiento oficial a ${email}?`)) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      notify("Correo de seguridad enviado", "success");
    } catch (e: any) { notify(e.message, "error"); }
  };

  const handleDelete = async (e: React.MouseEvent, item: any) => {
    e.stopPropagation();
    const isStaff = activeTab === 'staff';
    const idToDelete = isStaff ? item.user_id : item.id;
    const nameToDisplay = isStaff ? (item.full_name || item.email) : item.name;
    
    if (!idToDelete) return;
    if (!window.confirm(`¿ESTÁS SEGURO?\n\nSe eliminará permanentemente a "${nameToDisplay}". Esta acción no se puede deshacer.`)) return;

    try {
      const { error } = await supabase.from(isStaff ? 'profiles' : 'clients').delete().eq(isStaff ? 'user_id' : 'id', idToDelete);
      
      if (error) {
        if (error.code === '23503') {
          window.alert(`❌ No se puede eliminar a "${nameToDisplay}" porque ya tiene cotizaciones o embarques en su historial.`);
          return;
        }
        throw error;
      }
      
      notify("Registro eliminado exitosamente", "success");
      fetchData();
      fetchGlobalCounts();
    } catch (err: any) { 
      console.error(err);
      notify("Error al eliminar. Consulta al administrador.", "error"); 
    }
  };

  return (
    <AdminLayout title="Directorio Maestro" subtitle="Control de cuentas y equipo administrativo">
      <div className="ff-page-wrapper">
        
        {/* ENCABEZADO Y TABS */}
        <div className="ff-header-section">
          <div className="ff-tabs-pro">
            <button 
              className={activeTab === 'clients' ? 'active' : ''} 
              onClick={() => { setActiveTab('clients'); setPage(1); setQ(''); setAccessFilter(''); }}
            >
              <Building2 size={16} /> Clientes ({globalCounts.clients})
            </button>
            <button 
              className={activeTab === 'staff' ? 'active' : ''} 
              onClick={() => { setActiveTab('staff'); setPage(1); setQ(''); setAccessFilter(''); }}
            >
              <UserCheck size={16} /> Staff Admin ({globalCounts.staff})
            </button>
          </div>
          
          {activeTab === 'clients' && (
            <button className="ff-btn-primary" onClick={(e) => { e.stopPropagation(); setIsNewClientModalOpen(true); }}>
              <Plus size={18} strokeWidth={2.5} /> Nuevo Cliente
            </button>
          )}
        </div>

        {/* BARRA DE HERRAMIENTAS */}
        <div className="ff-toolbar">
          <div className="ff-search-group">
            <div className="ff-input-wrapper flex-grow">
              <Search size={16} />
              <input 
                placeholder={activeTab === 'clients' ? "Buscar cliente, tax ID, email..." : "Buscar administrador..."} 
                value={q} 
                onChange={e => { setQ(e.target.value); setPage(1); }} 
              />
              {q && <X size={14} className="clear-icon" onClick={() => { setQ(""); setPage(1); }} />}
            </div>
            
            <div className="ff-input-wrapper width-180">
              <Filter size={16} />
              <select value={accessFilter} onChange={(e) => { setAccessFilter(e.target.value); setPage(1); }}>
                {activeTab === 'clients' ? (
                  <>
                    <option value="">Todos los clientes</option>
                    <option value="access">Con Acceso al Portal</option>
                    <option value="no_access">Solo Directorio</option>
                  </>
                ) : (
                  <>
                    <option value="">Todos los roles</option>
                    <option value="admin">Administradores</option>
                    <option value="superadmin">Super Admins</option>
                  </>
                )}
              </select>
            </div>
          </div>
          
          <button className="ff-btn-secondary" onClick={() => { setDir(dir === 'asc' ? 'desc' : 'asc'); setPage(1); }}>
            <SortAsc size={14} /> {dir === 'asc' ? 'A-Z' : 'Z-A'}
          </button>
        </div>

        {/* TABLA PRINCIPAL (CSS GRID PERFECTO) */}
        <div className="ff-list-container">
          <div className="ff-list-header">
            <div className="col-ident">{activeTab === 'clients' ? 'CLIENTE' : 'USUARIO'}</div>
            <div className="col-contact">CONTACTO</div>
            <div className="col-route">{activeTab === 'clients' ? 'UBICACIÓN' : 'ROL SISTEMA'}</div>
            <div className="col-status">ESTADO DE ACCESO</div>
            <div className="col-actions">ACCIONES</div>
          </div>

          <div className="ff-list-body">
            {loading ? (
              <><ClientSkeleton /><ClientSkeleton /><ClientSkeleton /></>
            ) : dataList.length === 0 ? (
              <div className="ff-empty-state">
                <Users size={32} />
                <p>No se encontraron registros con esos filtros.</p>
              </div>
            ) : (
              dataList.map((item) => {
                const isStaff = activeTab === 'staff';
                const email = isStaff ? item?.email : item?.contact_email;
                const name = isStaff ? (item?.full_name || 'ADMINISTRADOR') : (item?.name || 'S/N');
                const sub = isStaff ? (item?.position || 'STAFF') : (item?.tax_id || 'SIN TAX ID');
                const rowId = isStaff ? item?.user_id : item?.id;

                return (
                  <div key={rowId || Math.random()} className="ff-list-row" onClick={() => navigate(isStaff ? `/admin/staff/${rowId}` : `/admin/users/${rowId}`)}>
                    
                    <div className="col-ident">
                      <div className="client-profile-box">
                        <div className="avatar-mini">
                          {(!isStaff && item?.logo_url) ? (
                            <img src={`https://oqgkbduqztrpfhfclker.supabase.co/storage/v1/object/public/client-logos/${item.logo_url}`} alt="logo" />
                          ) : (
                            <div className={`avatar-initials-mini ${isStaff ? 'staff-bg' : 'client-bg'}`}>
                              {name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="name-stack">
                          {/* AQUI INTEGRAMOS EL BADGE JUNTO AL NOMBRE */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="client-name-text">{name}</span>
                            {!isStaff && <LeadSourceBadge source={item.lead_source} />}
                          </div>
                          <span className="tax-id-sub">{sub}</span>
                        </div>
                      </div>
                    </div>

                    <div className="col-contact">
                      {email ? (
                        <div className="contact-info-pill"><Mail size={12} /><span>{email}</span></div>
                      ) : (
                        <span className="empty-label">Sin correo</span>
                      )}
                    </div>

                    <div className="col-route">
                      {!isStaff ? (
                        <div className="location-badge">
                          <span className="country-flag">{getFlag(item?.country)}</span>
                          <span className="country-name">{item?.country || 'Panamá'}</span>
                        </div>
                      ) : (
                        <span className={`role-badge-pill ${item?.role || 'admin'}`}>{item?.role || 'admin'}</span>
                      )}
                    </div>

                    <div className="col-status">
                      {!isStaff ? (
                        <span className={`status-pill-client ${item.has_platform_access ? 'active' : 'pending'}`}>
                          {item.has_platform_access ? 'Acceso Portal' : 'Solo Directorio'}
                        </span>
                      ) : (
                        <span className="status-pill-client active">Activo</span>
                      )}
                    </div>

                    <div className="col-actions">
                      <div className="actions-inline">
                        {!isStaff && !item.has_platform_access && (
                          <button className="ff-action-btn invite" onClick={(e) => handleInviteClient(e, item)} title="Invitar al portal" disabled={invitingId === item.id}>
                            {invitingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                          </button>
                        )}
                        {!isStaff && (
                          <button className="ff-action-btn quote" title="Cotizar" onClick={(e) => { e.stopPropagation(); setSelectedClientId(item.id); setIsQuoteModalOpen(true); }}>
                            <Calculator size={14} />
                          </button>
                        )}

                        {(isStaff || item.has_platform_access) && (
                          <button className="ff-action-btn key" title="Restablecer pass" onClick={(e) => { e.stopPropagation(); handleResetPassword(email); }}>
                            <KeyRound size={14} />
                          </button>
                        )}
                        <button className="ff-action-btn trash" title="Eliminar" onClick={(e) => handleDelete(e, item)}>
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

        {/* PAGINACIÓN */}
        {!loading && totalItems > 0 && (
          <div className="ff-pagination">
            <span className="page-info">Mostrando {((page - 1) * itemsPerPage) + 1} - {Math.min(page * itemsPerPage, totalItems)} de {totalItems} registros</span>
            <div className="page-controls">
              <button onClick={handlePrevPage} disabled={page === 1}><ChevronLeft size={16} /></button>
              <span className="page-number">Página {page} de {totalPages}</span>
              <button onClick={handleNextPage} disabled={page === totalPages}><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      <QuickQuoteModal isOpen={isQuoteModalOpen} onClose={() => setIsQuoteModalOpen(false)} initialClientId={selectedClientId} />
      
      {isNewClientModalOpen && (
        <NewClientModal 
          isOpen={isNewClientModalOpen} 
          onClose={() => setIsNewClientModalOpen(false)} 
          onSuccess={() => { setIsNewClientModalOpen(false); fetchData(); fetchGlobalCounts(); }} 
        />
      )}

      <style>{`
        .ff-page-wrapper { display: flex; flex-direction: column; gap: 24px; font-family: 'Poppins', sans-serif !important; padding-bottom: 40px; }
        
        /* HEADER & TABS */
        .ff-header-section { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 10px; }
        
        .ff-tabs-pro { display: flex; gap: 6px; background: white; padding: 6px; border-radius: 16px; border: 1px solid rgba(34, 76, 34, 0.1); box-shadow: 0 2px 10px rgba(0,0,0,0.02); }
        .ff-tabs-pro button { display: flex; align-items: center; gap: 8px; padding: 10px 24px; border: none; background: transparent; border-radius: 12px; font-size: 13px; font-weight: 700; color: var(--ff-green-dark); opacity: 0.6; cursor: pointer; transition: 0.3s; }
        .ff-tabs-pro button.active { background: var(--ff-green-dark); color: white; opacity: 1; box-shadow: 0 4px 12px rgba(34, 76, 34, 0.15); }
        
        .ff-btn-primary { background: var(--ff-orange); color: white; border: none; padding: 0 20px; height: 44px; border-radius: 12px; font-weight: 800; font-size: 13px; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 4px 10px rgba(209, 119, 17, 0.2); }
        .ff-btn-primary:hover { background: #b4660e; transform: translateY(-2px); box-shadow: 0 6px 15px rgba(209, 119, 17, 0.3); }

        /* TOOLBAR */
        .ff-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 20px; }
        .ff-search-group { display: flex; gap: 16px; flex-grow: 1; align-items: center; }
        
        .ff-input-wrapper { position: relative; background: white; border: 1.5px solid rgba(34, 76, 34, 0.15); border-radius: 12px; height: 44px; display: flex; align-items: center; padding: 0 14px; color: var(--ff-green-dark); transition: 0.2s; max-width: 400px; }
        .ff-input-wrapper:focus-within { border-color: var(--ff-green); box-shadow: 0 0 0 3px rgba(34, 116, 50, 0.05); }
        .ff-input-wrapper input { border: none; background: transparent; width: 100%; height: 100%; outline: none; font-size: 13px; font-weight: 600; color: var(--ff-green-dark); padding-left: 10px; }
        .ff-input-wrapper select { border: none; background: transparent; width: 100%; height: 100%; outline: none; font-size: 13px; font-weight: 600; color: var(--ff-green-dark); padding-left: 10px; cursor: pointer; appearance: none; }
        
        .clear-icon { cursor: pointer; opacity: 0.4; transition: 0.2s; }
        .clear-icon:hover { opacity: 1; color: #ef4444; }

        .ff-btn-secondary { background: white; border: 1.5px solid rgba(34, 76, 34, 0.15); padding: 0 16px; height: 44px; border-radius: 12px; font-weight: 700; font-size: 12px; display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--ff-green-dark); transition: 0.2s; }
        .ff-btn-secondary:hover { background: #f9fbf9; border-color: var(--ff-green); }

        /* LISTADO DE DATOS (CSS GRID PERFECTO) */
        .ff-list-container { background: white; border-radius: 20px; border: 1px solid rgba(34,76,34,0.08); box-shadow: 0 2px 10px rgba(0,0,0,0.02); overflow: hidden; }
        
        .ff-list-header { 
          display: grid;
          grid-template-columns: 2fr 1.5fr 1fr 1fr 180px; 
          gap: 15px;
          align-items: center; padding: 16px 24px; border-bottom: 1px solid rgba(34,76,34,0.08); background: #f9fbf9; 
          font-size: 10px; font-weight: 800; color: var(--ff-green-dark); opacity: 0.6; text-transform: uppercase; letter-spacing: 0.5px; 
        }
        
        .ff-list-body { display: flex; flex-direction: column; }
        
        .ff-list-row { 
          display: grid;
          grid-template-columns: 2fr 1.5fr 1fr 1fr 180px;
          gap: 15px;
          align-items: center; padding: 14px 24px; border-bottom: 1px solid rgba(34,76,34,0.04); cursor: pointer; transition: all 0.2s ease; background: white; 
        }
        .ff-list-row:last-child { border-bottom: none; }
        .ff-list-row:hover { background: #fcfdfc; transform: translateY(-1px); box-shadow: 0 4px 10px rgba(34,76,34,0.03); border-color: var(--ff-green); }

        /* ALINEACIONES INTERNAS */
        .col-actions { display: flex; justify-content: flex-end; }

        /* ELEMENTOS INTERNOS */
        .client-profile-box { display: flex; align-items: center; gap: 14px; }
        .avatar-mini { width: 40px; height: 40px; border-radius: 10px; border: 1px solid rgba(34,76,34,0.1); overflow: hidden; background: #e6efe2; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .avatar-mini img { width: 100%; height: 100%; object-fit: contain; padding: 4px; background: white; }
        .avatar-initials-mini { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; }
        .client-bg { background: #e6efe2; color: var(--ff-green-dark); }
        .staff-bg { background: var(--ff-green-dark); color: white; }
        
        .name-stack { display: flex; flex-direction: column; overflow: hidden; }
        .client-name-text { font-size: 13px; font-weight: 700; color: var(--ff-green-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tax-id-sub { font-size: 10px; color: var(--ff-green-dark); opacity: 0.5; font-weight: 700; font-family: 'JetBrains Mono', monospace; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .contact-info-pill { display: inline-flex; align-items: center; gap: 8px; background: rgba(34,76,34,0.05); padding: 4px 10px; border-radius: 8px; font-size: 11px; color: var(--ff-green-dark); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
        .empty-label { font-size: 11px; font-weight: 600; color: var(--ff-green-dark); opacity: 0.4; font-style: italic; }

        .location-badge { display: flex; align-items: center; gap: 6px; color: var(--ff-green-dark); opacity: 0.7; }
        .country-flag { font-size: 14px; }
        .country-name { font-size: 12px; font-weight: 700; }

        .role-badge-pill { font-size: 9px; font-weight: 800; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; background: rgba(34,76,34,0.1); color: var(--ff-green-dark); }
        .role-badge-pill.superadmin { background: #ffedd5; color: #c2410c; border: 1px solid #fed7aa; }

        .status-pill-client { padding: 4px 10px; border-radius: 8px; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; width: max-content; }
        .status-pill-client.active { background: #d1fae5; color: #047857; }
        .status-pill-client.pending { background: rgba(34,76,34,0.05); color: var(--ff-green-dark); opacity: 0.6; }

        /* ACCIONES */
        .actions-inline { display: flex; gap: 6px; justify-content: flex-end; }
        .ff-action-btn { 
          width: 32px; height: 32px; border-radius: 8px; border: 1.5px solid rgba(34,76,34,0.1); 
          display: flex; align-items: center; justify-content: center; background: white; 
          color: var(--ff-green-dark); opacity: 0.7; transition: 0.2s; cursor: pointer; 
        }
        .ff-action-btn:hover { opacity: 1; transform: translateY(-2px); box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
        .ff-action-btn.invite:hover { border-color: var(--ff-green); color: var(--ff-green-dark); background: #e6efe2; }
        .ff-action-btn.quote:hover { border-color: var(--ff-orange); color: var(--ff-orange); background: #fff7ed; }
        .ff-action-btn.trash:hover { border-color: #ef4444; color: #ef4444; background: #fef2f2; }

        /* PAGINACIÓN */
        .ff-pagination { display: flex; justify-content: space-between; align-items: center; padding: 0 10px; margin-top: 10px; }
        .page-info { font-size: 12px; font-weight: 500; color: var(--ff-green-dark); opacity: 0.6; }
        .page-controls { display: flex; align-items: center; gap: 15px; }
        .page-controls button { background: white; border: 1px solid rgba(34,76,34,0.15); border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--ff-green-dark); transition: 0.2s; }
        .page-controls button:disabled { opacity: 0.3; cursor: not-allowed; }
        .page-controls button:hover:not(:disabled) { border-color: var(--ff-green); background: #f9fbf9; }
        .page-number { font-size: 12px; font-weight: 700; color: var(--ff-green-dark); }

        /* SKELETON & EMPTY */
        .skeleton-row { pointer-events: none; opacity: 0.6; display: grid; grid-template-columns: 2fr 1.5fr 1fr 1fr 160px; gap: 15px; align-items: center; padding: 14px 24px; }
        .skel-line { height: 12px; background: rgba(34,76,34,0.05); border-radius: 4px; margin-bottom: 6px; }
        .skel-pill { height: 24px; background: rgba(34,76,34,0.05); border-radius: 8px; }
        .skel-avatar { width: 40px; height: 40px; border-radius: 10px; background: rgba(34,76,34,0.05); flex-shrink: 0; }
        .w40 { width: 40px; } .w50 { width: 50%; } .w60 { width: 60%; } .w70 { width: 70%; } .w80 { width: 80%; } .w100 { width: 100%; }

        .ff-empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; color: var(--ff-green-dark); opacity: 0.5; gap: 12px; }
        .ff-empty-state p { margin: 0; font-size: 13px; font-weight: 600; }
        .width-180 { width: 180px; }
      `}</style>
    </AdminLayout>
  );
}