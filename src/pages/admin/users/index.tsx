import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { AdminLayout, notify } from '@/components/AdminLayout';
import { 
  Plus, Calculator, KeyRound, Mail, Loader2, 
  Search, Users, Building2, UserCheck, Trash2, UserPlus, 
  X, ChevronLeft, ChevronRight, Filter, Bot, Zap, User, 
  Phone, Edit2, Briefcase, CheckSquare, Square, Play, Send, Megaphone, Sparkles
} from 'lucide-react';

// MODALES
import { QuickQuoteModal } from '@/components/quotes/QuickQuoteModal';
import { NewClientModal } from '@/components/clients/NewClientModal';

// --- FIX TYPESCRIPT ---
const getFlag = (country?: string | null) => {
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

const LeadSourceBadge = ({ source }: { source?: string | null }) => {
  if (source === 'ai-cron') return <span className="source-badge source-cron" title="Minado automáticamente"><Zap size={9} fill="currentColor" /> AUTO-LEAD</span>;
  if (source === 'ai-manual') return <span className="source-badge source-ai" title="Minado con IA"><Bot size={9} /> IA MANUAL</span>;
  return <span className="source-badge source-manual" title="Insertado por vendedor"><User size={9} /> TRADICIONAL</span>;
};

export default function ClientsIndex() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'clients' | 'staff'>('clients');
  const [dataList, setDataList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  
  // EQUIPO OPERATIVO
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
  const [selectedClientId, setSelectedQuoteClientId] = useState<string | null>(null);
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [partnerForm, setPartnerForm] = useState({ id: '', full_name: '', position: '', phone: '', company: '' });

  // ESTADOS DE BROADCAST Y OUTREACH INDIVIDUAL (CON PREVIEW)
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [broadcastModal, setBroadcastModal] = useState<{isOpen: boolean, context: string, loading: boolean, previewData?: any}>({ isOpen: false, context: '', loading: false });
  const [outreachModal, setOutreachModal] = useState<{isOpen: boolean, client: any, context: string, loading: boolean, previewData?: any}>({ isOpen: false, client: null, context: '', loading: false });

  // Limpiar selecciones al cambiar de vista
  useEffect(() => { setSelectedClients([]); }, [activeTab, page, q, accessFilter]);

  const fetchGlobalCounts = async () => {
    try {
      const [{ count: cCount }, { count: sCount }, { count: extCount }] = await Promise.all([
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('user_id', { count: 'exact', head: true }).in('role', ['admin', 'superadmin']),
        supabase.from('external_partners').select('id', { count: 'exact', head: true })
      ]);
      setGlobalCounts({ clients: cCount || 0, staff: (sCount || 0) + (extCount || 0) });
    } catch (error) { console.error("Error fetching counts", error); }
  };

  const fetchCoreTeam = async () => {
    try {
      const [ { data: internal }, { data: external } ] = await Promise.all([
        supabase.from('profiles').select('*').in('position', ['Gerente General', 'Ventas', 'Administrativo', 'Marketing y Diseño']),
        supabase.from('external_partners').select('*')
      ]);
      const combined = [
        ...(internal || []).map(i => ({ ...i, is_external: false, company: 'Fresh Food Panamá' })),
        ...(external || []).map(e => ({ ...e, is_external: true }))
      ];
      setCoreTeam(combined);
    } catch (e) { console.error("Error fetching core team", e); }
  };

  useEffect(() => { fetchGlobalCounts(); fetchCoreTeam(); }, []);

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
        let query = supabase.from('profiles').select('user_id, email, role, full_name, position', { count: 'exact' })
          .in('role', ['admin', 'superadmin'])
          .or('position.is.null,and(position.neq.Gerente General,position.neq.Ventas,position.neq.Administrativo,position.neq.Marketing y Diseño)');

        if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
        if (accessFilter) query = query.eq('role', accessFilter);

        const { data, count, error } = await query.order('email', { ascending: dir === 'asc' }).range(from, to);
        if (error) throw error;
        setDataList(data || []);
        setTotalItems(count || 0);
      }
    } catch (e) { notify("Error al sincronizar directorio", "error"); } 
    finally { setLoading(false); }
  }, [activeTab, dir, page, q, accessFilter]);

  useEffect(() => { 
    const delay = setTimeout(() => { fetchData(); }, 300);
    return () => clearTimeout(delay);
  }, [fetchData]);

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const handlePrevPage = () => setPage(p => Math.max(1, p - 1));
  const handleNextPage = () => setPage(p => Math.min(totalPages, p + 1));

  const toggleSelection = (id: string) => setSelectedClients(prev => prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]);
  const toggleSelectAll = () => setSelectedClients(selectedClients.length === dataList.length ? [] : dataList.map(c => c.id));

  // --- LÓGICA DE ENVÍO CON VISTA PREVIA ---
 const handleLaunchBroadcast = async (isFinalSend = false) => {
    if (!broadcastModal.context.trim()) return notify("Ingresa el contexto de la promoción", "error");
    setBroadcastModal(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch('/.netlify/functions/generate-campaign', {
        method: 'POST',
        body: JSON.stringify({ 
          leadIds: selectedClients, 
          campaignContext: broadcastModal.context, 
          isClientBroadcast: true, 
          previewOnly: !isFinalSend,
          approvedData: isFinalSend ? broadcastModal.previewData : null // 🚨 Mandamos lo aprobado
        })
      });
      const data = await res.json();
      if (res.ok) {
        if (!isFinalSend) {
          setBroadcastModal(prev => ({ ...prev, previewData: data.previewData, loading: false }));
        } else {
          notify(`Campaña enviada a ${selectedClients.length} clientes.`, "success");
          setSelectedClients([]);
          setBroadcastModal({ isOpen: false, context: '', loading: false, previewData: undefined });
        }
      } else throw new Error(data.error || "Error en el servidor");
    } catch (err) { notify("Error de conexión", "error"); setBroadcastModal(prev => ({ ...prev, loading: false })); }
  };

  const handleLaunchSingleOutreach = async (isFinalSend = false) => {
    if (!outreachModal.context.trim()) return notify("Ingresa el contexto", "error");
    setOutreachModal(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch('/.netlify/functions/generate-campaign', {
        method: 'POST',
        body: JSON.stringify({ 
          leadIds: [outreachModal.client.id], 
          campaignContext: outreachModal.context, 
          isClientBroadcast: true, 
          previewOnly: !isFinalSend,
          approvedData: isFinalSend ? outreachModal.previewData : null // 🚨 Mandamos lo aprobado
        })
      });
      const data = await res.json();
      if (res.ok) {
        if (!isFinalSend) {
          setOutreachModal(prev => ({ ...prev, previewData: data.previewData, loading: false }));
        } else {
          notify(`Correo enviado a ${outreachModal.client.name}.`, "success");
          setOutreachModal({ isOpen: false, client: null, context: '', loading: false, previewData: undefined });
        }
      } else throw new Error(data.error || "Error en el servidor");
    } catch (err) { notify("Error de conexión", "error"); setOutreachModal(prev => ({ ...prev, loading: false })); }
  };
  // --- ACCIONES GENERALES ---
  const handleSavePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (partnerForm.id) await supabase.from('external_partners').update({ full_name: partnerForm.full_name, position: partnerForm.position, phone: partnerForm.phone, company: partnerForm.company }).eq('id', partnerForm.id);
      else { const { id, ...data } = partnerForm; await supabase.from('external_partners').insert([data]); }
      notify("Aliado guardado exitosamente", "success");
      setIsPartnerModalOpen(false); fetchCoreTeam(); fetchGlobalCounts();
    } catch (err) { notify("Error al guardar aliado", "error"); }
  };

  const handleDeletePartner = async (id?: string | null, name?: string | null) => {
    if (!id) return;
    const displayName = name || 'este aliado';
    if(!window.confirm(`¿Eliminar permanentemente a ${displayName}?`)) return;
    try {
      await supabase.from('external_partners').delete().eq('id', id);
      notify("Aliado eliminado", "success"); fetchCoreTeam(); fetchGlobalCounts();
    } catch(err) { notify("Error al eliminar", "error"); }
  };

  const handleInviteClient = async (e: React.MouseEvent, item: any) => {
    e.stopPropagation();
    if (!item.contact_email) return notify("El cliente no tiene un email válido", "error");
    if (!window.confirm(`¿Enviar invitación oficial para ${item.name}?`)) return;
    setInvitingId(item.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Tu sesión ha expirado.");
      const response = await fetch('/.netlify/functions/inviteUser', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ email: item.contact_email, full_name: item.contact_name || item.name, role: 'client', client_id: item.id })
      });
      if (!response.ok) throw new Error("Error al procesar invitación");
      notify("Invitación enviada", "success"); fetchData(); 
    } catch (err: any) { notify(err.message, "error"); } 
    finally { setInvitingId(null); }
  };

  const handleResetPassword = async (e: React.MouseEvent, email?: string | null) => {
    e.stopPropagation();
    if (!email) return notify("No hay email registrado", "error");
    if (!window.confirm(`¿Enviar restablecimiento oficial a ${email}?`)) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      notify("Correo enviado", "success");
    } catch (e: any) { notify(e.message, "error"); }
  };

  const handleDelete = async (e: React.MouseEvent, item: any) => {
    e.stopPropagation();
    const isStaff = activeTab === 'staff';
    const idToDelete = isStaff ? item.user_id : item.id;
    const nameToDisplay = isStaff ? (item.full_name || item.email) : item.name;
    if (!idToDelete) return;
    if (!window.confirm(`¿ESTÁS SEGURO?\nSe eliminará a "${nameToDisplay}".`)) return;
    try {
      const { error } = await supabase.from(isStaff ? 'profiles' : 'clients').delete().eq(isStaff ? 'user_id' : 'id', idToDelete);
      if (error) {
        if (error.code === '23503') return window.alert(`❌ No se puede eliminar a "${nameToDisplay}" porque tiene historial operativo.`);
        throw error;
      }
      notify("Eliminado exitosamente", "success");
      fetchData(); fetchGlobalCounts();
    } catch (err: any) { notify("Error al eliminar.", "error"); }
  };

  // --- COMPONENTE TARJETA ---
  const DataCard = ({ item }: { item: any }) => {
    const isStaff = activeTab === 'staff';
    const rowId = isStaff ? item.user_id : item.id;
    const name = isStaff ? (item.full_name || 'ADMINISTRADOR') : (item.name || 'S/N');
    const sub = isStaff ? (item.position || 'STAFF TÉCNICO') : (item.tax_id || 'SIN TAX ID');
    const email = isStaff ? item.email : item.contact_email;
    const isSelected = selectedClients.includes(rowId);

    return (
      <div className={`data-card ${isSelected ? 'selected' : ''}`} onClick={() => navigate(isStaff ? `/admin/staff/${rowId}` : `/admin/users/${rowId}`)}>
        <div className="card-header">
          <div className="company-info">
            {!isStaff && (
              <div className="checkbox-wrap" onClick={(e) => { e.stopPropagation(); toggleSelection(rowId); }}>
                {isSelected ? <CheckSquare size={16} className="text-brand"/> : <Square size={16} className="text-gray hover-show"/>}
              </div>
            )}
            <div className="avatar-mini">
              {(!isStaff && item.logo_url) ? (
                <img src={`https://oqgkbduqztrpfhfclker.supabase.co/storage/v1/object/public/client-logos/${item.logo_url}`} alt="logo" />
              ) : (
                <div className={`avatar-initials-mini ${isStaff ? 'staff-bg' : 'client-bg'}`}>{name.charAt(0).toUpperCase()}</div>
              )}
            </div>
            <div className="name-stack">
              <span className="company-name" title={name}>{name}</span>
              <div className="location-line">
                {!isStaff ? (
                  <>
                    {getFlag(item.country)} {item.country || 'Panamá'}
                    <span className="lang-badge-mini">{item.preferred_language === 'en' ? 'EN' : 'ES'}</span>
                  </>
                ) : <span className={`role-badge-pill ${item.role || 'admin'}`}>{item.role || 'admin'}</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="card-meta">
          <span className="tax-id-sub">{sub}</span>
          {!isStaff && <LeadSourceBadge source={item.lead_source} />}
        </div>

        <div className="card-contact-mini">
          {email ? (
            <a href={`mailto:${email}`} className="contact-item" title={email} onClick={e => e.stopPropagation()}><Mail size={11} /> {email}</a>
          ) : <span className="empty-label">Sin correo</span>}
        </div>

        <div className="card-footer">
          <div className="col-status">
            {!isStaff ? (
              <span className={`status-pill-client ${item.has_platform_access ? 'active' : 'pending'}`}>{item.has_platform_access ? 'Portal Activo' : 'Directorio'}</span>
            ) : <span className="status-pill-client active">Activo</span>}
          </div>

          <div className="card-actions">
            {!isStaff && email && (
              <button className="card-btn action-outreach" title="Mensaje Directo IA" onClick={(e) => { e.stopPropagation(); setOutreachModal({ isOpen: true, client: item, context: '', loading: false }); }}>
                <Sparkles size={12} />
              </button>
            )}
            {!isStaff && !item.has_platform_access && (
              <button className="card-btn invite" onClick={(e) => handleInviteClient(e, item)} title="Invitar">
                {invitingId === item.id ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
              </button>
            )}
            {!isStaff && (
              <button className="card-btn quote" title="Cotizar Rápido" onClick={(e) => { e.stopPropagation(); setSelectedQuoteClientId(item.id); setIsQuoteModalOpen(true); }}>
                <Calculator size={12} />
              </button>
            )}
            {(isStaff || item.has_platform_access) && (
              <button className="card-btn key" title="Restablecer pass" onClick={(e) => handleResetPassword(e, email)}>
                <KeyRound size={12} />
              </button>
            )}
            <button className="card-btn trash" title="Eliminar Permanente" onClick={(e) => handleDelete(e, item)}>
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AdminLayout title="Directorio Maestro" subtitle="Control de cuentas, prospectos y equipo operativo">
      <div className="ff-page-wrapper">
        
        {/* HEADER Y BÚSQUEDA */}
        <div className="ff-header-section">
          <div className="ff-tabs-pro">
            <button className={activeTab === 'clients' ? 'active' : ''} onClick={() => { setActiveTab('clients'); setPage(1); setQ(''); }}><Building2 size={16} /> Clientes ({globalCounts.clients})</button>
            <button className={activeTab === 'staff' ? 'active' : ''} onClick={() => { setActiveTab('staff'); setPage(1); setQ(''); }}><UserCheck size={16} /> Staff & Aliados ({globalCounts.staff})</button>
          </div>
          {activeTab === 'clients' ? (
            <button className="ff-btn-primary" onClick={(e) => { e.stopPropagation(); setIsNewClientModalOpen(true); }}><Plus size={18} strokeWidth={2.5} /> Nuevo Cliente</button>
          ) : (
            <button className="ff-btn-primary" onClick={(e) => { e.stopPropagation(); setPartnerForm({ id: '', full_name: '', position: '', phone: '', company: '' }); setIsPartnerModalOpen(true); }}><Plus size={18} strokeWidth={2.5} /> Nuevo Aliado Operativo</button>
          )}
        </div>

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
                        ) : <button onClick={() => navigate(`/admin/staff/${member.user_id}`)} title="Editar Perfil Interno"><Edit2 size={12} /></button>}
                      </div>
                    </div>
                  </div>
                  <div className="tc-body">
                    <h4>{member.full_name || 'Sin Nombre'}</h4>
                    <span className="tc-role">{member.position || 'Staff'}</span>
                    <div className="tc-company-row"><Briefcase size={12} /> {member.company || 'Fresh Food Panamá'}</div>
                  </div>
                  <div className="tc-footer">
                    {member.phone ? <a href={`https://wa.me/${member.phone.replace(/\+/g, '')}`} target="_blank" rel="noreferrer" className="tc-wa-btn"><Phone size={14} /> {member.phone}</a> : <span className="tc-no-phone">Sin WhatsApp</span>}
                  </div>
                </div>
              ))}
            </div>
            <div className="section-divider"></div>
            <h3 className="section-title"><Users size={16} /> Directorio de Soporte Técnico y Admin</h3>
          </div>
        )}

        <div className="ff-toolbar">
          <div className="ff-search-group">
            {activeTab === 'clients' && (
              <button className="select-all-btn" onClick={toggleSelectAll} title="Seleccionar Todos">
                {selectedClients.length > 0 && selectedClients.length === dataList.length ? <CheckSquare size={16} className="text-brand"/> : <Square size={16} className="text-gray"/>}
              </button>
            )}
            <div className="ff-input-wrapper flex-grow">
              <Search size={16} />
              <input placeholder={activeTab === 'clients' ? "Buscar cliente..." : "Buscar administrador..."} value={q} onChange={e => { setQ(e.target.value); setPage(1); }} />
              {q && <X size={14} className="clear-icon" onClick={() => { setQ(""); setPage(1); }} />}
            </div>
            <div className="ff-input-wrapper width-180">
              <Filter size={16} />
              <select value={accessFilter} onChange={(e) => { setAccessFilter(e.target.value); setPage(1); }}>
                {activeTab === 'clients' ? (
                  <><option value="">Todos los clientes</option><option value="access">Con Acceso al Portal</option><option value="no_access">Solo Directorio</option></>
                ) : (
                  <><option value="">Todos los roles</option><option value="admin">Administradores</option><option value="superadmin">Super Admins</option></>
                )}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
            <div className="ff-loading-state"><Loader2 className="animate-spin" size={32} /> <p>Cargando directorio...</p></div>
        ) : dataList.length === 0 ? (
            <div className="ff-empty-state"><Users size={32} /><p>No se encontraron registros en esta sección.</p></div>
        ) : (
            <div className="cards-grid">
              {dataList.map(item => <DataCard key={item.id || item.user_id} item={item} />)}
            </div>
        )}

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

        {selectedClients.length > 0 && (
          <div className="ff-bulk-bar">
            <div className="bulk-count"><span className="badge">{selectedClients.length}</span> seleccionados</div>
            <div className="bulk-actions">
              <button className="bulk-btn primary" onClick={() => setBroadcastModal(prev => ({...prev, isOpen: true}))}><Megaphone size={14} /> Lanzar Promoción IA</button>
              <button className="bulk-btn" onClick={() => setSelectedClients([])}><X size={14} /> Cancelar</button>
            </div>
          </div>
        )}
      </div>

      {/* --- MODAL BROADCAST MASIVO --- */}
      {broadcastModal.isOpen && (
        <div className="modal-overlay" onClick={() => !broadcastModal.loading && setBroadcastModal(prev => ({...prev, isOpen: false, previewData: undefined}))}>
          <div className="modal-content animate-slide-up" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Megaphone size={18} className="text-orange" style={{marginRight: '8px'}}/> Campaña de Difusión B2B</h3>
              <button onClick={() => setBroadcastModal(prev => ({...prev, isOpen: false, previewData: undefined}))} disabled={broadcastModal.loading}><X size={20} /></button>
            </div>
            <div className="modal-body">
              {broadcastModal.loading ? (
                <div className="modal-loading-state"><Loader2 className="animate-spin" size={32} color="#D17711"/><p>Gemini AI trabajando...</p></div>
              ) : broadcastModal.previewData ? (
                <div className="preview-container">
                  <div style={{marginBottom: '10px'}}>
                    <span style={{fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase'}}>Asunto Generado:</span>
                    <div style={{fontSize: '14px', fontWeight: 700, color: '#0f172a', background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0'}}>{broadcastModal.previewData.subject}</div>
                  </div>
                  <span style={{fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase'}}>Cuerpo del Correo:</span>
<div className="email-preview-box" dangerouslySetInnerHTML={{ __html: broadcastModal.previewData.html.replace(/\{\{COMPANY_NAME\}\}/g, 'Clientes') }} style={{background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', maxHeight: '250px', overflowY: 'auto', padding: '10px', fontSize: '13px'}} />                  <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '16px'}}>
                    <button className="ff-btn-secondary" onClick={() => setBroadcastModal(prev => ({...prev, previewData: undefined}))}>Atrás (Editar)</button>
                    <button className="ff-btn-primary" onClick={() => handleLaunchBroadcast(true)}><Send size={14}/> Enviar a {selectedClients.length} clientes</button>
                  </div>
                </div>
              ) : (
                <>
                  <p style={{fontSize: '13px', color: '#64748b', marginTop: 0}}>Describe la oferta o promoción.</p>
                  <textarea className="draft-textarea" placeholder="Ej: Tengo 5 pallets de Piña MD2 disponibles..." value={broadcastModal.context} onChange={e => setBroadcastModal(prev => ({...prev, context: e.target.value}))} rows={6} />
                  <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '10px'}}>
                    <button className="ff-btn-primary" onClick={() => handleLaunchBroadcast(false)} style={{width: 'auto'}}><Search size={14}/> Generar Vista Previa</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL OUTREACH INDIVIDUAL --- */}
      {outreachModal.isOpen && outreachModal.client && (
        <div className="modal-overlay" onClick={() => !outreachModal.loading && setOutreachModal({ isOpen: false, client: null, context: '', loading: false, previewData: undefined })}>
          <div className="modal-content animate-slide-up" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Sparkles size={18} className="text-purple" style={{marginRight: '8px'}}/> Mensaje Directo a {outreachModal.client.name}</h3>
              <button onClick={() => setOutreachModal({ isOpen: false, client: null, context: '', loading: false, previewData: undefined })} disabled={outreachModal.loading}><X size={20} /></button>
            </div>
            <div className="modal-body">
              {outreachModal.loading ? (
                <div className="modal-loading-state"><Loader2 className="animate-spin" size={32} color="#8b5cf6"/><p>Gemini AI trabajando...</p></div>
              ) : outreachModal.previewData ? (
                <div className="preview-container">
                  <div style={{marginBottom: '10px'}}>
                    <span style={{fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase'}}>Asunto Generado:</span>
                    <div style={{fontSize: '14px', fontWeight: 700, color: '#0f172a', background: '#f5f3ff', padding: '10px', borderRadius: '8px', border: '1px solid #ddd6fe'}}>{outreachModal.previewData.subject}</div>
                  </div>
                  <span style={{fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase'}}>Cuerpo del Correo:</span>
<div className="email-preview-box" dangerouslySetInnerHTML={{ __html: outreachModal.previewData.html.replace(/\{\{COMPANY_NAME\}\}/g, outreachModal.client.name) }} style={{background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', maxHeight: '250px', overflowY: 'auto', padding: '10px', fontSize: '13px'}} />                   <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '16px'}}>
                    <button className="ff-btn-secondary" onClick={() => setOutreachModal(prev => ({...prev, previewData: undefined}))}>Atrás (Editar)</button>
                    <button className="ff-btn-primary bg-purple" onClick={() => handleLaunchSingleOutreach(true)}><Send size={14}/> Enviar Correo</button>
                  </div>
                </div>
              ) : (
                <>
                  <p style={{fontSize: '13px', color: '#64748b', marginTop: 0}}>Contexto para el mensaje individual (ej. "Avisa que el vuelo se retrasó por clima").</p>
                  <textarea className="draft-textarea focus-purple" placeholder="Escribe el contexto breve..." value={outreachModal.context} onChange={e => setOutreachModal(prev => ({...prev, context: e.target.value}))} rows={6} />
                  <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '10px'}}>
                    <button className="ff-btn-primary bg-purple" onClick={() => handleLaunchSingleOutreach(false)} style={{width: 'auto'}}><Search size={14}/> Generar Vista Previa</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* OTROS MODALES */}
      <QuickQuoteModal isOpen={isQuoteModalOpen} onClose={() => setIsQuoteModalOpen(false)} initialClientId={selectedClientId} />
      {isNewClientModalOpen && <NewClientModal isOpen={isNewClientModalOpen} onClose={() => setIsNewClientModalOpen(false)} onSuccess={() => { setIsNewClientModalOpen(false); fetchData(); fetchGlobalCounts(); }} />}
      
      {isPartnerModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header"><h3>{partnerForm.id ? 'Editar Aliado Operativo' : 'Nuevo Aliado Operativo'}</h3><button onClick={() => setIsPartnerModalOpen(false)}><X size={20} /></button></div>
            <form onSubmit={handleSavePartner} className="modal-body">
              <div className="ff-form-group"><label>Nombre Completo</label><input required type="text" value={partnerForm.full_name} onChange={e => setPartnerForm({...partnerForm, full_name: e.target.value})} placeholder="Ej: Candida Ojo" /></div>
              <div className="ff-form-group"><label>Cargo Operativo</label><input required type="text" value={partnerForm.position} onChange={e => setPartnerForm({...partnerForm, position: e.target.value})} placeholder="Ej: Gestión Documental" /></div>
              <div className="ff-form-group"><label>WhatsApp (Con código de país)</label><input required type="text" value={partnerForm.phone} onChange={e => setPartnerForm({...partnerForm, phone: e.target.value})} placeholder="+507..." /></div>
              <div className="ff-form-group"><label>Empresa</label><input required type="text" value={partnerForm.company} onChange={e => setPartnerForm({...partnerForm, company: e.target.value})} placeholder="Ej: Freelance / Rexcargo" /></div>
              <button type="submit" className="ff-btn-primary" style={{ width: '100%', marginTop: '10px', justifyContent: 'center' }}>Guardar Aliado</button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .ff-page-wrapper { display: flex; flex-direction: column; gap: 24px; font-family: 'Poppins', sans-serif !important; padding-bottom: 80px; }
        
        .ff-header-section { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 10px; }
        .ff-tabs-pro { display: flex; gap: 6px; background: white; padding: 6px; border-radius: 16px; border: 1px solid rgba(34, 76, 34, 0.1); box-shadow: 0 2px 10px rgba(0,0,0,0.02); }
        .ff-tabs-pro button { display: flex; align-items: center; gap: 8px; padding: 10px 24px; border: none; background: transparent; border-radius: 12px; font-size: 13px; font-weight: 700; color: var(--ff-green-dark); opacity: 0.6; cursor: pointer; transition: 0.3s; }
        .ff-tabs-pro button.active { background: var(--ff-green-dark); color: white; opacity: 1; box-shadow: 0 4px 12px rgba(34, 76, 34, 0.15); }
        
        .ff-btn-primary { background: var(--ff-orange); color: white; border: none; padding: 0 20px; height: 44px; border-radius: 12px; font-weight: 800; font-size: 13px; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 4px 10px rgba(209, 119, 17, 0.2); }
        .ff-btn-primary:hover { background: #b4660e; transform: translateY(-2px); box-shadow: 0 6px 15px rgba(209, 119, 17, 0.3); }
        .ff-btn-secondary { background: white; color: #475569; border: 1px solid #cbd5e1; padding: 0 20px; height: 44px; border-radius: 12px; font-weight: 700; font-size: 13px; cursor: pointer; transition: 0.2s; }
        .ff-btn-secondary:hover { background: #f8fafc; color: #0f172a; border-color: #94a3b8; }

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

        .ff-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 20px; }
        .ff-search-group { display: flex; gap: 12px; flex-grow: 1; align-items: center; }
        .select-all-btn { background: white; border: 1.5px solid rgba(34, 76, 34, 0.15); border-radius: 12px; height: 44px; width: 44px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s;}
        .select-all-btn:hover { border-color: var(--ff-green); }
        .ff-input-wrapper { position: relative; background: white; border: 1.5px solid rgba(34, 76, 34, 0.15); border-radius: 12px; height: 44px; display: flex; align-items: center; padding: 0 14px; color: var(--ff-green-dark); transition: 0.2s; max-width: 400px; }
        .ff-input-wrapper:focus-within { border-color: var(--ff-green); box-shadow: 0 0 0 3px rgba(34, 116, 50, 0.05); }
        .ff-input-wrapper input, .ff-input-wrapper select { border: none; background: transparent; width: 100%; height: 100%; outline: none; font-size: 13px; font-weight: 600; color: var(--ff-green-dark); padding-left: 10px; }
        .clear-icon { cursor: pointer; opacity: 0.4; transition: 0.2s; }
        .clear-icon:hover { opacity: 1; color: #ef4444; }

        .cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; align-items: start; }
        
        .data-card { background: white; border-radius: 12px; padding: 16px; border: 1.5px solid rgba(34,76,34,0.1); box-shadow: 0 2px 8px rgba(0,0,0,0.02); transition: 0.2s; position: relative; cursor: pointer; display: flex; flex-direction: column; gap: 12px;}
        .data-card:hover { border-color: var(--ff-green); box-shadow: 0 6px 16px -2px rgba(34,76,34,0.08); transform: translateY(-2px); }
        .data-card.selected { background: #f0fdf4; border-color: #22c55e; }
        
        .card-header { display: flex; justify-content: space-between; align-items: flex-start; }
        .company-info { display: flex; align-items: center; gap: 12px; width: 100%;}
        
        .checkbox-wrap { display: flex; align-items: center; justify-content: center; z-index: 10;}
        .text-brand { color: #22c55e; }
        .text-gray { color: #cbd5e1; transition: 0.2s; }
        .data-card:hover .hover-show { color: #94a3b8; }

        .avatar-mini { width: 42px; height: 42px; border-radius: 10px; border: 1px solid rgba(34,76,34,0.1); overflow: hidden; background: #e6efe2; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .avatar-mini img { width: 100%; height: 100%; object-fit: contain; padding: 4px; background: white; }
        .avatar-initials-mini { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; }
        .client-bg { background: #e6efe2; color: var(--ff-green-dark); }
        .staff-bg { background: var(--ff-green-dark); color: white; }
        
        .name-stack { display: flex; flex-direction: column; overflow: hidden; flex-grow: 1;}
        .company-name { font-size: 14px; font-weight: 800; color: var(--ff-green-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .location-line { font-size: 11px; font-weight: 600; color: #64748b; margin-top: 2px; display: flex; align-items: center; gap: 4px; }
        
        /* NUEVO: ETIQUETA IDIOMA */
        .lang-badge-mini { font-size: 8px; font-weight: 800; padding: 1px 4px; border-radius: 4px; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0;}
        .role-badge-pill { font-size: 9px; font-weight: 800; padding: 2px 8px; border-radius: 6px; text-transform: uppercase; background: rgba(34,76,34,0.1); color: var(--ff-green-dark); }

        .card-meta { display: flex; align-items: center; justify-content: space-between; }
        .tax-id-sub { font-size: 11px; color: var(--ff-green-dark); opacity: 0.6; font-weight: 700; font-family: 'JetBrains Mono', monospace; }

        .source-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; border-radius: 6px; font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; }
        .source-cron { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }
        .source-ai { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
        .source-manual { background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0; opacity: 0.6; }

        .card-contact-mini { background: rgba(34,76,34,0.03); padding: 6px 10px; border-radius: 8px; }
        .contact-item { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: var(--ff-green-dark); text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .contact-item:hover { color: var(--ff-orange); }
        .empty-label { font-size: 11px; font-weight: 600; color: #94a3b8; font-style: italic; }

        .card-footer { display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(34,76,34,0.06); padding-top: 12px; margin-top: auto;}
        
        .status-pill-client { padding: 4px 10px; border-radius: 8px; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; width: max-content; }
        .status-pill-client.active { background: #d1fae5; color: #047857; }
        .status-pill-client.pending { background: rgba(34,76,34,0.05); color: var(--ff-green-dark); opacity: 0.6; }

        .card-actions { display: flex; gap: 4px; justify-content: flex-end; }
        .card-btn { width: 28px; height: 28px; border-radius: 6px; border: 1.5px solid rgba(34,76,34,0.1); display: flex; align-items: center; justify-content: center; background: white; color: var(--ff-green-dark); opacity: 0.7; transition: 0.2s; cursor: pointer; }
        .card-btn:hover { opacity: 1; transform: translateY(-2px); box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
        .card-btn.invite:hover { border-color: var(--ff-green); color: var(--ff-green-dark); background: #e6efe2; }
        .card-btn.quote:hover { border-color: var(--ff-orange); color: var(--ff-orange); background: #fff7ed; }
        .card-btn.trash:hover { border-color: #ef4444; color: #ef4444; background: #fef2f2; }
        
        .card-btn.action-outreach { width: auto; padding: 0 8px; gap: 4px; color: #8b5cf6;}
        .card-btn.action-outreach:hover { border-color: #8b5cf6; color: #8b5cf6; background: #f5f3ff; }

        .ff-pagination { display: flex; justify-content: space-between; align-items: center; padding: 0 10px; margin-top: 10px; }
        .page-info { font-size: 12px; font-weight: 500; color: var(--ff-green-dark); opacity: 0.6; }
        .page-controls { display: flex; align-items: center; gap: 15px; }
        .page-controls button { background: white; border: 1px solid rgba(34,76,34,0.15); border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--ff-green-dark); transition: 0.2s; }
        .page-controls button:disabled { opacity: 0.3; cursor: not-allowed; }
        .page-controls button:hover:not(:disabled) { border-color: var(--ff-green); background: #f9fbf9; }
        .page-number { font-size: 12px; font-weight: 700; color: var(--ff-green-dark); }

        .ff-loading-state, .ff-empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; color: var(--ff-green-dark); opacity: 0.5; gap: 12px; }
        .ff-loading-state p, .ff-empty-state p { margin: 0; font-size: 13px; font-weight: 600; }
        .width-180 { width: 180px; }

        .ff-bulk-bar { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: #0f172a; color: white; padding: 12px 24px; border-radius: 50px; display: flex; gap: 24px; align-items: center; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.3); z-index: 100; animation: slideUpBulk 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes slideUpBulk { from { transform: translate(-50%, 40px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        
        .bulk-count { font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px; border-right: 1px solid rgba(255,255,255,0.1); padding-right: 24px; }
        .bulk-count .badge { background: #d17711; color: white; padding: 2px 8px; border-radius: 12px; font-weight: 800; }
        
        .bulk-actions { display: flex; gap: 12px; }
        .bulk-btn { background: transparent; border: none; color: #cbd5e1; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 20px; transition: 0.2s; }
        .bulk-btn:hover { background: rgba(255,255,255,0.1); color: white; }
        .bulk-btn.primary { color: white; background: #d17711; }
        .bulk-btn.primary:hover { background: #b4660e; transform: translateY(-1px);}

        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); padding: 20px;}
        .modal-content { background: white; width: 100%; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.2); }
        .animate-slide-up { animation: slideUpModal 0.2s ease-out; }
        @keyframes slideUpModal { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        .modal-header { padding: 20px 24px; border-bottom: 1px solid rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: center; background: #f8fafc; }
        .modal-header h3 { margin: 0; font-size: 16px; font-weight: 800; color: var(--ff-green-dark); display: flex; align-items: center;}
        .text-orange { color: #d17711; }
        .text-purple { color: #8b5cf6; }
        .modal-header button { background: none; border: none; cursor: pointer; color: #64748b; transition: 0.2s;}
        .modal-header button:hover { color: #ef4444; }
        
        .modal-body { padding: 24px; display: flex; flex-direction: column; gap: 16px; }
        .ff-form-group { display: flex; flex-direction: column; gap: 6px; }
        .ff-form-group label { font-size: 12px; font-weight: 700; color: var(--ff-green-dark); }
        .ff-form-group input { padding: 12px 14px; border: 1.5px solid rgba(34,76,34,0.15); border-radius: 10px; font-size: 13px; font-family: inherit; outline: none; transition: 0.2s; }
        .ff-form-group input:focus { border-color: var(--ff-green); box-shadow: 0 0 0 3px rgba(34,116,50,0.05); }

        .modal-loading-state { text-align: center; padding: 40px; color: #64748b; display: flex; flex-direction: column; align-items: center; gap: 12px; font-size: 14px; font-weight: 600;}
        .draft-textarea { width: 100%; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 16px; font-family: 'Poppins', sans-serif; font-size: 13px; line-height: 1.6; color: #1e293b; outline: none; resize: vertical; background: #f8fafc; font-weight: 500;}
        .draft-textarea:focus { background: white; border-color: #d17711; box-shadow: 0 0 0 3px rgba(209, 119, 17, 0.1); }
        .draft-textarea.focus-purple:focus { border-color: #8b5cf6; box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1); }
        .bg-purple { background: #8b5cf6 !important; }
        .bg-purple:hover { background: #7c3aed !important; }
      `}</style>
    </AdminLayout>
  );
}