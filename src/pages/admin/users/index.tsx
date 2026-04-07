import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { AdminLayout, notify } from '@/components/AdminLayout';
import { 
  Plus, Calculator, KeyRound, Mail, Loader2, 
  Search, Users, SortAsc, Building2, 
  UserCheck, Trash2, UserPlus, X, ChevronLeft, ChevronRight, Filter,
  Bot, Zap, User, Phone, Edit2, Briefcase
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

const LeadSourceBadge = ({ source }: { source: string }) => {
  if (source === 'ai-cron') return <span className="source-badge source-cron" title="Minado automáticamente"><Zap size={9} fill="currentColor" /> AUTO-LEAD</span>;
  if (source === 'ai-manual') return <span className="source-badge source-ai" title="Minado con IA"><Bot size={9} /> IA MANUAL</span>;
  return <span className="source-badge source-manual" title="Insertado por vendedor"><User size={9} /> TRADICIONAL</span>;
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
  
  // EQUIPO OPERATIVO (CORE TEAM & EXTERNAL)
  const [coreTeam, setCoreTeam] = useState<any[]>([]);
  
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

  // MODAL DE ALIADOS EXTERNOS
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [partnerForm, setPartnerForm] = useState({ id: '', full_name: '', position: '', phone: '', company: '' });

  const fetchGlobalCounts = async () => {
    try {
      const [{ count: cCount }, { count: sCount }, { count: extCount }] = await Promise.all([
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('user_id', { count: 'exact', head: true }).in('role', ['admin', 'superadmin']),
        supabase.from('external_partners').select('id', { count: 'exact', head: true })
      ]);
      setGlobalCounts({ clients: cCount || 0, staff: (sCount || 0) + (extCount || 0) });
    } catch (error) {
      console.error("Error fetching counts", error);
    }
  };

  const fetchCoreTeam = async () => {
    try {
      const [ { data: internal }, { data: external } ] = await Promise.all([
        supabase.from('profiles').select('*').in('position', ['Gerente General', 'Ventas']),
        supabase.from('external_partners').select('*')
      ]);
      
      const combined = [
        ...(internal || []).map(i => ({ ...i, is_external: false, company: 'Fresh Food Panamá' })),
        ...(external || []).map(e => ({ ...e, is_external: true }))
      ];
      setCoreTeam(combined);
    } catch (e) {
      console.error("Error fetching core team", e);
    }
  };

  useEffect(() => { 
    fetchGlobalCounts(); 
    fetchCoreTeam();
  }, []);

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

        const { data, count, error } = await query.order('name', { ascending: dir === 'asc' }).range(from, to);
        if (error) throw error;
        setDataList(data || []);
        setTotalItems(count || 0);

      } else {
        // Tabla inferior solo muestra personal que NO es Gerente ni Ventas
        let query = supabase.from('profiles').select('user_id, email, role, full_name, position', { count: 'exact' })
          .in('role', ['admin', 'superadmin'])
          .or('position.is.null,and(position.neq.Gerente General,position.neq.Ventas)');

        if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
        if (accessFilter) query = query.eq('role', accessFilter);

        const { data, count, error } = await query.order('email', { ascending: dir === 'asc' }).range(from, to);
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

  // --- ACCIONES DE ALIADOS EXTERNOS ---
  const handleSavePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (partnerForm.id) {
        await supabase.from('external_partners').update({
          full_name: partnerForm.full_name, position: partnerForm.position, phone: partnerForm.phone, company: partnerForm.company
        }).eq('id', partnerForm.id);
      } else {
        const { id, ...data } = partnerForm;
        await supabase.from('external_partners').insert([data]);
      }
      notify("Aliado guardado exitosamente", "success");
      setIsPartnerModalOpen(false);
      fetchCoreTeam();
      fetchGlobalCounts();
    } catch (err) {
      notify("Error al guardar aliado", "error");
    }
  };

  const handleDeletePartner = async (id: string, name: string) => {
    if(!window.confirm(`¿Eliminar permanentemente a ${name} de tus aliados operativos?`)) return;
    try {
      await supabase.from('external_partners').delete().eq('id', id);
      notify("Aliado eliminado", "success");
      fetchCoreTeam();
      fetchGlobalCounts();
    } catch(err) {
      notify("Error al eliminar", "error");
    }
  };

  // --- ACCIONES GENERALES ---
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
    if (!window.confirm(`¿ESTÁS SEGURO?\n\nSe eliminará permanentemente a "${nameToDisplay}".`)) return;

    try {
      // AQUÍ ESTABA EL ERROR: Faltaba el ": 'id'"
      const { error } = await supabase
        .from(isStaff ? 'profiles' : 'clients')
        .delete()
        .eq(isStaff ? 'user_id' : 'id', idToDelete);

      if (error) {
        if (error.code === '23503') return window.alert(`❌ No se puede eliminar a "${nameToDisplay}" porque ya tiene cotizaciones o embarques en su historial.`);
        throw error;
      }
      notify("Registro eliminado exitosamente", "success");
      fetchData(); fetchGlobalCounts();
    } catch (err: any) { 
      notify("Error al eliminar. Consulta al administrador.", "error"); 
    }
  };

  return (
    <AdminLayout title="Directorio Maestro" subtitle="Control de cuentas, prospectos y equipo operativo">
      <div className="ff-page-wrapper">
        
        {/* ENCABEZADO Y TABS */}
        <div className="ff-header-section">
          <div className="ff-tabs-pro">
            <button className={activeTab === 'clients' ? 'active' : ''} onClick={() => { setActiveTab('clients'); setPage(1); setQ(''); }}>
              <Building2 size={16} /> Clientes ({globalCounts.clients})
            </button>
            <button className={activeTab === 'staff' ? 'active' : ''} onClick={() => { setActiveTab('staff'); setPage(1); setQ(''); }}>
              <UserCheck size={16} /> Staff & Aliados ({globalCounts.staff})
            </button>
          </div>
          
          {activeTab === 'clients' ? (
            <button className="ff-btn-primary" onClick={(e) => { e.stopPropagation(); setIsNewClientModalOpen(true); }}>
              <Plus size={18} strokeWidth={2.5} /> Nuevo Cliente
            </button>
          ) : (
            <button className="ff-btn-primary" onClick={(e) => { e.stopPropagation(); setPartnerForm({ id: '', full_name: '', position: '', phone: '', company: '' }); setIsPartnerModalOpen(true); }}>
              <Plus size={18} strokeWidth={2.5} /> Nuevo Aliado Operativo
            </button>
          )}
        </div>

        {/* --- NUEVA VISTA JERÁRQUICA PARA EL STAFF --- */}
        {activeTab === 'staff' && page === 1 && !q && (
          <div className="core-team-container">
            <h3 className="section-title"><Zap size={16} /> Equipo Operativo Fresh Food</h3>
            <p className="section-subtitle">Personal central y freelancers conectados al sistema ChatOps.</p>
            
            <div className="core-team-grid">
              {coreTeam.map(member => (
                <div className={`team-card ${member.is_external ? 'external' : 'internal'}`} key={member.id || member.user_id}>
                  
                 <div className="tc-header">
                    <div className="tc-avatar">{member.full_name ? member.full_name.charAt(0).toUpperCase() : 'U'}</div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {!member.is_external && <span className="internal-badge">Acceso Total</span>}
                      
                      <div className="tc-actions">
                        {member.is_external ? (
                          <>
                            <button onClick={() => { setPartnerForm(member); setIsPartnerModalOpen(true); }} title="Editar Aliado"><Edit2 size={12} /></button>
                            <button onClick={() => handleDeletePartner(member.id, member.full_name)} className="del-btn" title="Eliminar"><Trash2 size={12} /></button>
                          </>
                        ) : (
                          <button onClick={() => navigate(`/admin/staff/${member.user_id}`)} title="Editar Perfil Interno"><Edit2 size={12} /></button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="tc-body">
                    <h4>{member.full_name || 'Sin Nombre'}</h4>
                    <span className="tc-role">{member.position || 'Staff'}</span>
                    <div className="tc-company-row">
                      <Briefcase size={12} /> {member.company || 'Fresh Food Panamá'}
                    </div>
                  </div>
                  
                  <div className="tc-footer">
                    {member.phone ? (
                      <a href={`https://wa.me/${member.phone.replace(/\+/g, '')}`} target="_blank" rel="noreferrer" className="tc-wa-btn">
                        <Phone size={14} /> {member.phone}
                      </a>
                    ) : (
                      <span className="tc-no-phone">Sin WhatsApp</span>
                    )}
                  </div>

                </div>
              ))}
            </div>
            <div className="section-divider"></div>
            <h3 className="section-title"><Users size={16} /> Directorio de Soporte Técnico y Admin</h3>
          </div>
        )}

        {/* BARRA DE HERRAMIENTAS */}
        <div className="ff-toolbar">
          <div className="ff-search-group">
            <div className="ff-input-wrapper flex-grow">
              <Search size={16} />
              <input placeholder={activeTab === 'clients' ? "Buscar cliente..." : "Buscar administrador..."} value={q} onChange={e => { setQ(e.target.value); setPage(1); }} />
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
                <p>No se encontraron registros en esta sección.</p>
              </div>
            ) : (
              dataList.map((item) => {
                const isStaff = activeTab === 'staff';
                const email = isStaff ? item?.email : item?.contact_email;
                const name = isStaff ? (item?.full_name || 'ADMINISTRADOR') : (item?.name || 'S/N');
                const sub = isStaff ? (item?.position || 'STAFF TÉCNICO') : (item?.tax_id || 'SIN TAX ID');
                const rowId = isStaff ? item?.user_id : item?.id;

                return (
                  <div key={rowId || Math.random()} className="ff-list-row" onClick={() => navigate(isStaff ? `/admin/staff/${rowId}` : `/admin/users/${rowId}`)}>
                    
                    <div className="col-ident">
                      <div className="client-profile-box">
                        <div className="avatar-mini">
                          {(!isStaff && item?.logo_url) ? (
                            <img src={`https://oqgkbduqztrpfhfclker.supabase.co/storage/v1/object/public/client-logos/${item.logo_url}`} alt="logo" />
                          ) : (
                            <div className={`avatar-initials-mini ${isStaff ? 'staff-bg' : 'client-bg'}`}>{name.charAt(0).toUpperCase()}</div>
                          )}
                        </div>
                        <div className="name-stack">
                          <span className="client-name-text">{name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                            <span className="tax-id-sub" style={{ marginTop: 0 }}>{sub}</span>
                            {!isStaff && <LeadSourceBadge source={item.lead_source} />}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="col-contact">
                      {email ? <div className="contact-info-pill"><Mail size={12} /><span>{email}</span></div> : <span className="empty-label">Sin correo</span>}
                    </div>

                    <div className="col-route">
                      {!isStaff ? (
                        <div className="location-badge"><span className="country-flag">{getFlag(item?.country)}</span><span className="country-name">{item?.country || 'Panamá'}</span></div>
                      ) : (
                        <span className={`role-badge-pill ${item?.role || 'admin'}`}>{item?.role || 'admin'}</span>
                      )}
                    </div>

                    <div className="col-status">
                      {!isStaff ? (
                        <span className={`status-pill-client ${item.has_platform_access ? 'active' : 'pending'}`}>{item.has_platform_access ? 'Acceso Portal' : 'Solo Directorio'}</span>
                      ) : (
                        <span className="status-pill-client active">Activo</span>
                      )}
                    </div>

                    <div className="col-actions">
                      <div className="actions-inline">
                        {!isStaff && !item.has_platform_access && (
                          <button className="ff-action-btn invite" onClick={(e) => handleInviteClient(e, item)} title="Invitar al portal">
                            {invitingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                          </button>
                        )}
                        {!isStaff && (
                          <button className="ff-action-btn quote" title="Cotizar" onClick={(e) => { e.stopPropagation(); setSelectedClientId(item.id); setIsQuoteModalOpen(true); }}><Calculator size={14} /></button>
                        )}

                        {(isStaff || item.has_platform_access) && (
                          <button className="ff-action-btn key" title="Restablecer pass" onClick={(e) => { e.stopPropagation(); handleResetPassword(email); }}><KeyRound size={14} /></button>
                        )}
                        <button className="ff-action-btn trash" title="Eliminar" onClick={(e) => handleDelete(e, item)}><Trash2 size={14} /></button>
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

      {/* MODAL ALIADO EXTERNO */}
      {isPartnerModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>{partnerForm.id ? 'Editar Aliado Operativo' : 'Nuevo Aliado Operativo'}</h3>
              <button onClick={() => setIsPartnerModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSavePartner} className="modal-body">
              <div className="ff-form-group">
                <label>Nombre Completo</label>
                <input required type="text" value={partnerForm.full_name} onChange={e => setPartnerForm({...partnerForm, full_name: e.target.value})} placeholder="Ej: Candida Ojo" />
              </div>
              <div className="ff-form-group">
                <label>Cargo Operativo</label>
                <input required type="text" value={partnerForm.position} onChange={e => setPartnerForm({...partnerForm, position: e.target.value})} placeholder="Ej: Gestión Documental" />
              </div>
              <div className="ff-form-group">
                <label>WhatsApp (Con código de país)</label>
                <input required type="text" value={partnerForm.phone} onChange={e => setPartnerForm({...partnerForm, phone: e.target.value})} placeholder="+507..." />
              </div>
              <div className="ff-form-group">
                <label>Empresa</label>
                <input required type="text" value={partnerForm.company} onChange={e => setPartnerForm({...partnerForm, company: e.target.value})} placeholder="Ej: Freelance / Rexcargo" />
              </div>
              <button type="submit" className="ff-btn-primary" style={{ width: '100%', marginTop: '10px', justifyContent: 'center' }}>
                Guardar Aliado
              </button>
            </form>
          </div>
        </div>
      )}

      <QuickQuoteModal isOpen={isQuoteModalOpen} onClose={() => setIsQuoteModalOpen(false)} initialClientId={selectedClientId} />
      {isNewClientModalOpen && <NewClientModal isOpen={isNewClientModalOpen} onClose={() => setIsNewClientModalOpen(false)} onSuccess={() => { setIsNewClientModalOpen(false); fetchData(); fetchGlobalCounts(); }} />}

      <style>{`
        .ff-page-wrapper { display: flex; flex-direction: column; gap: 24px; font-family: 'Poppins', sans-serif !important; padding-bottom: 40px; }
        
        /* HEADER & TABS */
        .ff-header-section { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 10px; }
        .ff-tabs-pro { display: flex; gap: 6px; background: white; padding: 6px; border-radius: 16px; border: 1px solid rgba(34, 76, 34, 0.1); box-shadow: 0 2px 10px rgba(0,0,0,0.02); }
        .ff-tabs-pro button { display: flex; align-items: center; gap: 8px; padding: 10px 24px; border: none; background: transparent; border-radius: 12px; font-size: 13px; font-weight: 700; color: var(--ff-green-dark); opacity: 0.6; cursor: pointer; transition: 0.3s; }
        .ff-tabs-pro button.active { background: var(--ff-green-dark); color: white; opacity: 1; box-shadow: 0 4px 12px rgba(34, 76, 34, 0.15); }
        
        .ff-btn-primary { background: var(--ff-orange); color: white; border: none; padding: 0 20px; height: 44px; border-radius: 12px; font-weight: 800; font-size: 13px; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 4px 10px rgba(209, 119, 17, 0.2); }
        .ff-btn-primary:hover { background: #b4660e; transform: translateY(-2px); box-shadow: 0 6px 15px rgba(209, 119, 17, 0.3); }

        /* CORE TEAM CARDS */
        .core-team-container { margin-bottom: 10px; }
        .section-title { font-size: 14px; font-weight: 800; color: var(--ff-green-dark); margin: 0 0 4px 0; display: flex; align-items: center; gap: 8px; }
        .section-subtitle { font-size: 12px; color: var(--ff-green-dark); opacity: 0.6; margin: 0 0 20px 0; }
        .section-divider { height: 1px; background: rgba(34,76,34,0.1); margin: 30px 0 20px 0; }
        
        .core-team-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
        .team-card { background: white; border: 1.5px solid rgba(34,76,34,0.1); border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 12px; transition: 0.3s; box-shadow: 0 4px 12px rgba(0,0,0,0.02); }
        .team-card:hover { border-color: var(--ff-green); transform: translateY(-4px); box-shadow: 0 8px 24px rgba(34,76,34,0.06); }
        .team-card.external { background: #fdfefe; border-style: dashed; }

        .tc-header { display: flex; justify-content: space-between; align-items: flex-start; }
        .tc-avatar { width: 44px; height: 44px; border-radius: 12px; background: #e6efe2; color: var(--ff-green-dark); font-weight: 800; font-size: 18px; display: flex; align-items: center; justify-content: center; }
        .team-card.external .tc-avatar { background: #f3f4f6; color: #4b5563; }
        
        .tc-actions { display: flex; gap: 4px; }
        .tc-actions button { background: transparent; border: none; cursor: pointer; color: #9ca3af; padding: 4px; border-radius: 6px; transition: 0.2s; }
        .tc-actions button:hover { background: #f3f4f6; color: var(--ff-green-dark); }
        .tc-actions button.del-btn:hover { background: #fef2f2; color: #ef4444; }
        .internal-badge { font-size: 9px; font-weight: 800; background: var(--ff-green-dark); color: white; padding: 2px 8px; border-radius: 6px; text-transform: uppercase; }

        .tc-body h4 { margin: 0; font-size: 14px; font-weight: 700; color: var(--ff-green-dark); }
        .tc-role { display: inline-block; font-size: 11px; font-weight: 600; color: var(--ff-orange); margin-top: 2px; }
        .tc-company-row { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--ff-green-dark); opacity: 0.6; margin-top: 8px; font-weight: 500; }

        .tc-footer { margin-top: auto; padding-top: 12px; border-top: 1px solid rgba(34,76,34,0.06); }
        .tc-wa-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; background: #25D366; color: white; padding: 8px 0; border-radius: 8px; font-size: 12px; font-weight: 700; text-decoration: none; transition: 0.2s; }
        .tc-wa-btn:hover { background: #1ebc59; }
        .tc-no-phone { display: block; text-align: center; font-size: 11px; color: #9ca3af; font-style: italic; padding: 8px 0; }

        /* FORMULARIOS Y MODALES */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
        .modal-content { background: white; width: 100%; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.2); }
        .modal-header { padding: 20px 24px; border-bottom: 1px solid rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: center; }
        .modal-header h3 { margin: 0; font-size: 18px; color: var(--ff-green-dark); }
        .modal-header button { background: none; border: none; cursor: pointer; color: #666; }
        .modal-body { padding: 24px; display: flex; flex-direction: column; gap: 16px; }
        
        .ff-form-group { display: flex; flex-direction: column; gap: 6px; }
        .ff-form-group label { font-size: 12px; font-weight: 700; color: var(--ff-green-dark); }
        .ff-form-group input { padding: 12px 14px; border: 1.5px solid rgba(34,76,34,0.15); border-radius: 10px; font-size: 13px; font-family: inherit; outline: none; transition: 0.2s; }
        .ff-form-group input:focus { border-color: var(--ff-green); box-shadow: 0 0 0 3px rgba(34,116,50,0.05); }

        /* TOOLBAR */
        .ff-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 20px; }
        .ff-search-group { display: flex; gap: 16px; flex-grow: 1; align-items: center; }
        .ff-input-wrapper { position: relative; background: white; border: 1.5px solid rgba(34, 76, 34, 0.15); border-radius: 12px; height: 44px; display: flex; align-items: center; padding: 0 14px; color: var(--ff-green-dark); transition: 0.2s; max-width: 400px; }
        .ff-input-wrapper:focus-within { border-color: var(--ff-green); box-shadow: 0 0 0 3px rgba(34, 116, 50, 0.05); }
        .ff-input-wrapper input, .ff-input-wrapper select { border: none; background: transparent; width: 100%; height: 100%; outline: none; font-size: 13px; font-weight: 600; color: var(--ff-green-dark); padding-left: 10px; }
        .clear-icon { cursor: pointer; opacity: 0.4; transition: 0.2s; }
        .clear-icon:hover { opacity: 1; color: #ef4444; }

        /* LISTADO DE DATOS (CSS GRID PERFECTO) */
        .ff-list-container { background: white; border-radius: 20px; border: 1px solid rgba(34,76,34,0.08); box-shadow: 0 2px 10px rgba(0,0,0,0.02); overflow: hidden; }
        .ff-list-header { display: grid; grid-template-columns: 2fr 1.5fr 1fr 1fr 180px; gap: 15px; align-items: center; padding: 16px 24px; border-bottom: 1px solid rgba(34,76,34,0.08); background: #f9fbf9; font-size: 10px; font-weight: 800; color: var(--ff-green-dark); opacity: 0.6; text-transform: uppercase; letter-spacing: 0.5px; }
        .ff-list-body { display: flex; flex-direction: column; }
        .ff-list-row { display: grid; grid-template-columns: 2fr 1.5fr 1fr 1fr 180px; gap: 15px; align-items: center; padding: 14px 24px; border-bottom: 1px solid rgba(34,76,34,0.04); cursor: pointer; transition: all 0.2s ease; background: white; }
        .ff-list-row:last-child { border-bottom: none; }
        .ff-list-row:hover { background: #fcfdfc; transform: translateY(-1px); box-shadow: 0 4px 10px rgba(34,76,34,0.03); border-color: var(--ff-green); }

        .col-actions { display: flex; justify-content: flex-end; }
        .client-profile-box { display: flex; align-items: center; gap: 14px; }
        .avatar-mini { width: 40px; height: 40px; border-radius: 10px; border: 1px solid rgba(34,76,34,0.1); overflow: hidden; background: #e6efe2; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .avatar-mini img { width: 100%; height: 100%; object-fit: contain; padding: 4px; background: white; }
        .avatar-initials-mini { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; }
        .client-bg { background: #e6efe2; color: var(--ff-green-dark); }
        .staff-bg { background: var(--ff-green-dark); color: white; }
        
        .name-stack { display: flex; flex-direction: column; overflow: hidden; }
        .client-name-text { font-size: 13px; font-weight: 700; color: var(--ff-green-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tax-id-sub { font-size: 10px; color: var(--ff-green-dark); opacity: 0.5; font-weight: 700; font-family: 'JetBrains Mono', monospace; margin-top: 2px; }

        .source-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; border-radius: 6px; font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; }
        .source-cron { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }
        .source-ai { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
        .source-manual { background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0; opacity: 0.6; }

        .contact-info-pill { display: inline-flex; align-items: center; gap: 8px; background: rgba(34,76,34,0.05); padding: 4px 10px; border-radius: 8px; font-size: 11px; color: var(--ff-green-dark); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
        .empty-label { font-size: 11px; font-weight: 600; color: var(--ff-green-dark); opacity: 0.4; font-style: italic; }

        .location-badge { display: flex; align-items: center; gap: 6px; color: var(--ff-green-dark); opacity: 0.7; }
        .country-flag { font-size: 14px; }
        .country-name { font-size: 12px; font-weight: 700; }

        .role-badge-pill { font-size: 9px; font-weight: 800; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; background: rgba(34,76,34,0.1); color: var(--ff-green-dark); }
        .status-pill-client { padding: 4px 10px; border-radius: 8px; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; width: max-content; }
        .status-pill-client.active { background: #d1fae5; color: #047857; }
        .status-pill-client.pending { background: rgba(34,76,34,0.05); color: var(--ff-green-dark); opacity: 0.6; }

        .actions-inline { display: flex; gap: 6px; justify-content: flex-end; }
        .ff-action-btn { width: 32px; height: 32px; border-radius: 8px; border: 1.5px solid rgba(34,76,34,0.1); display: flex; align-items: center; justify-content: center; background: white; color: var(--ff-green-dark); opacity: 0.7; transition: 0.2s; cursor: pointer; }
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