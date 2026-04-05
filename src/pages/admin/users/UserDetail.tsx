import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { AdminLayout, notify } from '@/components/AdminLayout';
import { 
  Building2, Mail, Phone, Pencil, Loader2, Plus, 
  User, Save, Globe, Bell, ShoppingBag, Lock,
  CreditCard, Shield, Copy, Check, MapPin, Briefcase, FileText, Package, AlertTriangle, KeyRound
} from 'lucide-react';

// IMPORTACIÓN DEL MODAL
import { QuickQuoteModal } from '../../../components/quotes/QuickQuoteModal';

// --- CATÁLOGOS ESTANDARIZADOS ---
const COUNTRIES = [
  'Panamá', 'Estados Unidos', 'Colombia', 'Costa Rica', 'México', 'Chile', 'Perú', 
  'Ecuador', 'España', 'Países Bajos', 'Alemania', 'Francia', 'Reino Unido', 'Italia', 'Canadá'
].sort();

const INCOTERMS = ['EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];

const getFlag = (country: string) => {
  if (!country) return '🌐';
  const flags: Record<string, string> = {
    'Panamá': '🇵🇦', 'España': '🇪🇸', 'Colombia': '🇨🇴', 'Ecuador': '🇪🇨', 
    'Costa Rica': '🇨🇷', 'Chile': '🇨🇱', 'México': '🇲🇽', 'USA': '🇺🇸',
    'Estados Unidos': '🇺🇸', 'Alemania': '🇩🇪', 'Francia': '🇫🇷', 
    'Reino Unido': '🇬🇧', 'Italia': '🇮🇹', 'Países Bajos': '🇳🇱', 'Canadá': '🇨🇦', 'Perú': '🇵🇪'
  };
  return flags[country] || '🌐';
};

// FIX: Helper unificado para no crashear con los estados mezclados
const getTxStatus = (tx: any) => {
  const s = (tx.status || '').toUpperCase();
  if (tx.type === 'Cotización') {
    switch(s) {
      case 'SOLICITUD': return { label: 'Solicitud', class: 'q-req' };
      case 'DRAFT': return { label: 'Borrador', class: 'q-draft' };
      case 'SENT': return { label: 'Enviada', class: 'q-sent' };
      case 'APPROVED': return { label: 'Aprobada', class: 'q-appr' };
      case 'REJECTED': return { label: 'Rechazada', class: 'q-rej' };
      default: return { label: s || 'NUEVA', class: 'q-draft' };
    }
  } else {
    switch(s) {
      case 'CREATED': return { label: 'Creado', class: 'created' };
      case 'PACKED': return { label: 'Empacado', class: 'packed' };
      case 'IN_TRANSIT': return { label: 'En Tránsito', class: 'transit' };
      case 'DELIVERED': return { label: 'Entregado', class: 'delivered' };
      default: return { label: s || 'PROCESANDO', class: 'created' };
    }
  }
};

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // ESTADOS DE DATOS
  const [client, setClient] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalShipments: 0, totalVolume: 0 });
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // NAVEGACIÓN VERTICAL
  const [activeSection, setActiveSection] = useState<'profile' | 'logistics' | 'commercial' | 'contacts' | 'security' | 'history'>('profile');

  // ESTADOS DE EDICIÓN Y UI
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isProcessingSec, setIsProcessingSec] = useState(false);

  // --- CARGA DE DATOS (Múltiples tablas para el historial) ---
  const fetchData = useCallback(async (clientId: string) => {
    try {
      const { data: clientData, error: cErr } = await supabase.from('clients').select('*').eq('id', clientId).maybeSingle();
      if (cErr) throw cErr;

      const { data: profileData } = await supabase.from('profiles').select('*').eq('client_id', clientId).maybeSingle();
      if (profileData) setUserProfile(profileData);

      // Traer Embarques y Cotizaciones
      const [shipsRes, quotesRes] = await Promise.all([
        supabase.from('shipments').select('id, code, product_name, destination_port, created_at, status').eq('client_id', clientId),
        supabase.from('quotes').select('id, quote_number, destination, created_at, status').eq('client_id', clientId)
      ]);

      const ships = shipsRes.data || [];
      const quotes = quotesRes.data || [];

      // Consolidar historial
      const combinedHist = [
        ...ships.map(s => ({ type: 'Embarque', id: s.id, ref: s.code, product: s.product_name || 'Mixto', dest: s.destination_port, date: s.created_at, status: s.status })),
        ...quotes.map(q => ({ type: 'Cotización', id: q.id, ref: q.quote_number, product: '—', dest: q.destination, date: q.created_at, status: q.status }))
      ].sort((a, b) => {
        // FIX: Ordenamiento a prueba de fallos (Invalid Dates)
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });

      setTransactions(combinedHist);

      const totalVol = shipsRes.data?.reduce((acc, curr: any) => acc + (Number(curr.weight_kg) || 0), 0) || 0;
      setStats({ totalShipments: ships.length, totalVolume: totalVol });

      const safeClient = { 
        ...clientData, 
        billing_info: clientData.billing_info || { address: '' },
        consignee_info: clientData.consignee_info || { address: '' },
        notify_info: clientData.notify_info || { address: '' },
        stakeholders: {
          purchasing: clientData.stakeholders?.purchasing || { name: '', email: '', phone: '' },
          accounting: clientData.stakeholders?.accounting || { name: '', email: '', phone: '' },
          logistics: clientData.stakeholders?.logistics || { name: '', email: '', phone: '' }
        }
      };

      setClient(safeClient);
      setEditData(safeClient);
    } catch (e: any) {
      notify("Error cargando expediente", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (id) fetchData(id); }, [id, fetchData]);

  // --- ACCIONES COMUNES ---
  const copyToClipboard = (text: string, cid: string) => {
    if (!text || text.trim() === '') return;
    navigator.clipboard.writeText(text);
    setCopiedId(cid);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleSave = async (section: string) => {
    try {
      let payload = {};
      if (section === 'profile') payload = { name: editData.name, legal_name: editData.legal_name, tax_id: editData.tax_id, website: editData.website, phone: editData.phone, city: editData.city, country: editData.country };
      else if (section === 'logistics') payload = { billing_info: editData.billing_info, consignee_info: editData.consignee_info, notify_info: editData.notify_info };
      else if (section === 'commercial') payload = { default_incoterm: editData.default_incoterm, credit_days: Number(editData.credit_days), sales_rep: editData.sales_rep };
      else if (section === 'contacts') payload = { stakeholders: editData.stakeholders };

      const { error } = await supabase.from('clients').update(payload).eq('id', id);
      if (error) throw error;
      
      setClient({ ...client, ...payload });
      setIsEditing(false);
      notify("Información guardada", "success");
    } catch (err) { notify("Error al guardar", "error"); }
  };

  // --- ACCIONES DE SEGURIDAD ---
  const handleToggleAccess = async () => {
    if (!window.confirm(`¿${client.has_platform_access ? 'Bloquear' : 'Habilitar'} acceso al portal para este cliente?`)) return;
    setIsProcessingSec(true);
    try {
      const newStatus = !client.has_platform_access;
      const { error } = await supabase.from('clients').update({ has_platform_access: newStatus }).eq('id', id);
      if (error) throw error;
      setClient({...client, has_platform_access: newStatus});
      notify(newStatus ? "Acceso Habilitado" : "Usuario Bloqueado", "success");
    } catch (e) { notify("Error actualizando acceso", "error"); }
    finally { setIsProcessingSec(false); }
  };

  const handleResetPassword = async () => {
    if (!userProfile?.email) return notify("No hay correo asociado", "error");
    if (!window.confirm(`¿Enviar enlace de recuperación a ${userProfile.email}?`)) return;
    setIsProcessingSec(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(userProfile.email);
      if (error) throw error;
      notify("Enlace enviado al cliente", "success");
    } catch (e) { notify("Error enviando enlace", "error"); }
    finally { setIsProcessingSec(false); }
  };

  const uploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      const fileName = `${id}-${Math.random()}.${file.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage.from('client-logos').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { error: updateError } = await supabase.from('clients').update({ logo_url: fileName }).eq('id', id);
      if (updateError) throw updateError;
      setClient({ ...client, logo_url: fileName });
      notify("Avatar actualizado", "success");
    } catch (error: any) { notify("Error al subir imagen", "error"); }
  };

  if (loading || !client) return <div className="loader-full"><Loader2 className="animate-spin" size={30}/></div>;

  // Mini-componente de copiar
  const CopyBtn = ({ text, id }: { text: string, id: string }) => (
    <button className="copy-btn-inline" onClick={() => copyToClipboard(text, id)} title="Copiar">
      {copiedId === id ? <Check size={12} color="#10b981"/> : <Copy size={12}/>}
    </button>
  );

  const handleUpdateNotificationPrefs = async (field: string, value: any) => {
  setIsProcessingSec(true);
  try {
    const { error } = await supabase
      .from('clients')
      .update({ [field]: value })
      .eq('id', id);

    if (error) throw error;
    
    setClient({ ...client, [field]: value });
    notify("Preferencia de notificación actualizada", "success");
  } catch (e) {
    notify("Error al actualizar preferencias", "error");
  } finally {
    setIsProcessingSec(false);
  }
};

  return (
    <AdminLayout title="Expediente Cliente">
      <div className="clean-container">
        
        {/* HEADER COMPACTO CON AVATAR */}
        <div className="clean-header">
          <div className="ch-left">
            <div className="header-avatar-box">
              {client.logo_url ? <img src={`https://oqgkbduqztrpfhfclker.supabase.co/storage/v1/object/public/client-logos/${client.logo_url}`} alt="Avatar" /> : <div className="fallback-ava">{client.name?.charAt(0)}</div>}
              <label className="ava-overlay"><input type="file" accept="image/*" onChange={uploadLogo} style={{display:'none'}}/><Plus size={16}/></label>
            </div>
            <div className="ch-titles">
              <h1 className="ch-title">{client.name}</h1>
              <div className="ch-meta">
                <span className={`access-pill ${client.has_platform_access ? 'active' : 'blocked'}`}>
                  {client.has_platform_access ? 'Acceso Portal' : 'Bloqueado'}
                </span>
                <span className="meta-text">{client.tax_id || 'Sin Tax ID'}</span>
              </div>
            </div>
          </div>

          <div className="ch-right">
            <div className="ch-stats">
              <div className="stat-block"><span className="s-val">{stats.totalShipments}</span><span className="s-lab">Embarques</span></div>
              <div className="stat-block"><span className="s-val">{stats.totalVolume.toLocaleString()} <small>Kg</small></span><span className="s-lab">Volumen</span></div>
            </div>
            <div className="ch-actions">
              <button className="btn-primary" onClick={() => setIsQuoteModalOpen(true)}>Cotizar Nuevo</button>
            </div>
          </div>
        </div>

        {/* LAYOUT VERTICAL TABS */}
        <div className="clean-layout">
          
          <aside className="clean-sidebar">
            <nav className="side-nav">
              <button className={`nav-item ${activeSection === 'profile' ? 'active' : ''}`} onClick={() => {setActiveSection('profile'); setIsEditing(false);}}><Building2 size={14}/> Perfil Legal</button>
              <button className={`nav-item ${activeSection === 'logistics' ? 'active' : ''}`} onClick={() => {setActiveSection('logistics'); setIsEditing(false);}}><MapPin size={14}/> Entidades (BL/AWB)</button>
              <button className={`nav-item ${activeSection === 'commercial' ? 'active' : ''}`} onClick={() => {setActiveSection('commercial'); setIsEditing(false);}}><Briefcase size={14}/> Cond. Comerciales</button>
              <button className={`nav-item ${activeSection === 'contacts' ? 'active' : ''}`} onClick={() => {setActiveSection('contacts'); setIsEditing(false);}}><User size={14}/> Contactos Clave</button>
              <button className={`nav-item ${activeSection === 'security' ? 'active' : ''}`} onClick={() => {setActiveSection('security'); setIsEditing(false);}}><Shield size={14}/> Seguridad y Acceso</button>
              <button className={`nav-item ${activeSection === 'history' ? 'active' : ''}`} onClick={() => {setActiveSection('history'); setIsEditing(false);}}><FileText size={14}/> Transacciones</button>
            </nav>
          </aside>

          <main className="clean-content">
            
            {/* --- SECCIÓN: PERFIL LEGAL --- */}
            {activeSection === 'profile' && (
              <div className="section-panel">
                <div className="panel-header">
                  <h2>Perfil de la Empresa</h2>
                  {!isEditing && <button className="btn-edit-text" onClick={() => setIsEditing(true)}><Pencil size={12}/> Editar</button>}
                </div>

                <div className="form-grid">
                  <div className="field">
                    <label>Nombre Comercial</label>
                    {isEditing ? <input value={editData.name || ''} onChange={e=>setEditData({...editData, name: e.target.value})} /> : <div className="read-val">{client.name || '—'}</div>}
                  </div>
                  <div className="field">
                    <label>Razón Social</label>
                    {isEditing ? <input value={editData.legal_name || ''} onChange={e=>setEditData({...editData, legal_name: e.target.value})} /> : <div className="read-val">{client.legal_name || '—'}</div>}
                  </div>
                  <div className="field">
                    <label>Tax ID (RUC / VAT)</label>
                    {isEditing ? <input value={editData.tax_id || ''} onChange={e=>setEditData({...editData, tax_id: e.target.value})} /> : 
                      <div className="read-val flex-copy">
                        <span className="font-mono">{client.tax_id || '—'}</span> 
                        {client.tax_id && <CopyBtn text={client.tax_id} id="taxid"/>}
                      </div>
                    }
                  </div>
                  <div className="field">
                    <label>Teléfono Corporativo</label>
                    {isEditing ? <input value={editData.phone || ''} onChange={e=>setEditData({...editData, phone: e.target.value})} /> : 
                      <div className="read-val flex-copy">
                        <span>{client.phone || '—'}</span>
                        {client.phone && <CopyBtn text={client.phone} id="phone"/>}
                      </div>
                    }
                  </div>
                  <div className="field">
                    <label>País</label>
                    {isEditing ? (
                      <select value={editData.country || ''} onChange={e=>setEditData({...editData, country: e.target.value})}>
                        <option value="">Seleccionar...</option>
                        {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : <div className="read-val"><span className="flag">{getFlag(client.country)}</span> {client.country || '—'}</div>}
                  </div>
                  <div className="field">
                    <label>Ciudad / Estado</label>
                    {isEditing ? <input value={editData.city || ''} onChange={e=>setEditData({...editData, city: e.target.value})} /> : <div className="read-val">{client.city || '—'}</div>}
                  </div>
                  <div className="field full-width">
                    <label>Sitio Web</label>
                    {isEditing ? <input value={editData.website || ''} onChange={e=>setEditData({...editData, website: e.target.value})} /> : 
                      <div className="read-val flex-copy text-blue">
                        <span>{client.website || '—'}</span>
                        {client.website && <CopyBtn text={client.website} id="web"/>}
                      </div>
                    }
                  </div>
                </div>

                {isEditing && (
                  <div className="panel-footer">
                    <button className="btn-cancel" onClick={() => {setIsEditing(false); setEditData(client)}}>Cancelar</button>
                    <button className="btn-save" onClick={() => handleSave('profile')}>Guardar</button>
                  </div>
                )}
              </div>
            )}

            {/* --- SECCIÓN: LOGÍSTICA --- */}
            {activeSection === 'logistics' && (
              <div className="section-panel">
                <div className="panel-header">
                  <h2>Entidades Logísticas (Documentos)</h2>
                  {!isEditing && <button className="btn-edit-text" onClick={() => setIsEditing(true)}><Pencil size={12}/> Editar</button>}
                </div>
                
                <div className="address-blocks">
                  {[
                    { id: 'billing_info', label: 'Billing Party' },
                    { id: 'consignee_info', label: 'Consignee' },
                    { id: 'notify_info', label: 'Notify Party' }
                  ].map(addr => (
                    <div className="address-box" key={addr.id}>
                      <div className="ab-header">
                        <span className="ab-title">{addr.label}</span>
                        {!isEditing && client[addr.id]?.address && (
                          <button className="btn-copy-full" onClick={() => copyToClipboard(client[addr.id]?.address, addr.id)}>
                            {copiedId === addr.id ? <Check size={12} color="#10b981"/> : <Copy size={12}/>} Copiar Bloque
                          </button>
                        )}
                      </div>
                      {isEditing ? (
                        <textarea className="ab-textarea" value={editData[addr.id]?.address || ''} onChange={e => setEditData({ ...editData, [addr.id]: { ...editData[addr.id], address: e.target.value } })} />
                      ) : (
                        <div className="ab-read">{client[addr.id]?.address || <span className="empty-italic">No definido</span>}</div>
                      )}
                    </div>
                  ))}
                </div>

                {isEditing && (
                  <div className="panel-footer">
                    <button className="btn-cancel" onClick={() => {setIsEditing(false); setEditData(client)}}>Cancelar</button>
                    <button className="btn-save" onClick={() => handleSave('logistics')}>Guardar Direcciones</button>
                  </div>
                )}
              </div>
            )}

            {/* --- SECCIÓN: COMERCIAL --- */}
            {activeSection === 'commercial' && (
              <div className="section-panel">
                <div className="panel-header">
                  <h2>Condiciones Comerciales</h2>
                  {!isEditing && <button className="btn-edit-text" onClick={() => setIsEditing(true)}><Pencil size={12}/> Editar</button>}
                </div>
                
                <div className="form-grid">
                  <div className="field">
                    <label>Incoterm por Defecto</label>
                    {isEditing ? (
                      <select value={editData.default_incoterm || ''} onChange={e=>setEditData({...editData, default_incoterm: e.target.value})}>
                        <option value="">Ninguno</option>
                        {INCOTERMS.map(i => <option key={i} value={i}>{i}</option>)}
                      </select>
                    ) : <div className="read-val">{client.default_incoterm || '—'}</div>}
                  </div>
                  <div className="field">
                    <label>Días de Crédito Autorizados</label>
                    {isEditing ? <input type="number" value={editData.credit_days || 0} onChange={e=>setEditData({...editData, credit_days: e.target.value})} /> : <div className="read-val">{client.credit_days || 0} Días</div>}
                  </div>
                  <div className="field full-width">
                    <label>KAM / Vendedor</label>
                    {isEditing ? <input value={editData.sales_rep || ''} onChange={e=>setEditData({...editData, sales_rep: e.target.value})} /> : <div className="read-val">{client.sales_rep || 'Sin asignar'}</div>}
                  </div>
                </div>

                {isEditing && (
                  <div className="panel-footer">
                    <button className="btn-cancel" onClick={() => {setIsEditing(false); setEditData(client)}}>Cancelar</button>
                    <button className="btn-save" onClick={() => handleSave('commercial')}>Guardar</button>
                  </div>
                )}
              </div>
            )}

            {/* --- SECCIÓN: CONTACTOS --- */}
            {activeSection === 'contacts' && (
              <div className="section-panel">
                <div className="panel-header">
                  <h2>Directorio de Contactos</h2>
                  {!isEditing && <button className="btn-edit-text" onClick={() => setIsEditing(true)}><Pencil size={12}/> Editar</button>}
                </div>

                <div className="contacts-list">
                  {[
                    { id: 'purchasing', label: 'Compras' },
                    { id: 'logistics', label: 'Logística' },
                    { id: 'accounting', label: 'Contabilidad' }
                  ].map(dept => (
                    <div className="contact-row" key={dept.id}>
                      <div className="cr-dept">{dept.label}</div>
                      {isEditing ? (
                        <div className="cr-edit-grid">
                          <input placeholder="Nombre" value={editData.stakeholders?.[dept.id]?.name || ''} onChange={e => setEditData({ ...editData, stakeholders: { ...editData.stakeholders, [dept.id]: { ...editData.stakeholders[dept.id], name: e.target.value } } })} />
                          <input placeholder="Email" value={editData.stakeholders?.[dept.id]?.email || ''} onChange={e => setEditData({ ...editData, stakeholders: { ...editData.stakeholders, [dept.id]: { ...editData.stakeholders[dept.id], email: e.target.value } } })} />
                          <input placeholder="Teléfono" value={editData.stakeholders?.[dept.id]?.phone || ''} onChange={e => setEditData({ ...editData, stakeholders: { ...editData.stakeholders, [dept.id]: { ...editData.stakeholders[dept.id], phone: e.target.value } } })} />
                        </div>
                      ) : (
                        <div className="cr-read-grid">
                          <div className="cr-cell name">{client.stakeholders?.[dept.id]?.name || <span className="empty-italic">Vacío</span>}</div>
                          <div className="cr-cell flex-copy">
                            {client.stakeholders?.[dept.id]?.email ? <><a href={`mailto:${client.stakeholders[dept.id].email}`}>{client.stakeholders[dept.id].email}</a> <CopyBtn text={client.stakeholders[dept.id].email} id={`e-${dept.id}`}/></> : '—'}
                          </div>
                          <div className="cr-cell flex-copy">
                            {client.stakeholders?.[dept.id]?.phone ? <><span>{client.stakeholders[dept.id].phone}</span> <CopyBtn text={client.stakeholders[dept.id].phone} id={`p-${dept.id}`}/></> : '—'}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {isEditing && (
                  <div className="panel-footer">
                    <button className="btn-cancel" onClick={() => {setIsEditing(false); setEditData(client)}}>Cancelar</button>
                    <button className="btn-save" onClick={() => handleSave('contacts')}>Guardar Contactos</button>
                  </div>
                )}
              </div>
            )}

            {/* --- SECCIÓN: SEGURIDAD Y NOTIFICACIONES --- */}
{activeSection === 'security' && (
  <div className="section-panel">
    <div className="panel-header"><h2>Seguridad y Control de Acceso</h2></div>
    <div className="pad-32">
      
      {/* CONTROL DE ACCESO AL PORTAL */}
      <div className="sec-alert">
        <Lock size={20} className="sec-icon"/>
        <div className="sec-txt">
          <h4>Cuenta de Usuario Portal</h4>
          <p>{userProfile ? `Vinculado al correo: ${userProfile.email}` : 'El cliente no tiene un usuario para iniciar sesión.'}</p>
        </div>
      </div>
      
      <div className="sec-actions-grid">
        <div className="sec-action-box">
          <h5>Estado de Acceso</h5>
          <p>Determina si el usuario puede iniciar sesión en la plataforma.</p>
          <button 
            className={`btn-sec-act ${client.has_platform_access ? 'danger' : 'success'}`} 
            onClick={handleToggleAccess} disabled={isProcessingSec}
          >
            {client.has_platform_access ? <><AlertTriangle size={14}/> Bloquear Acceso</> : <><Check size={14}/> Habilitar Acceso</>}
          </button>
        </div>
        
        <div className="sec-action-box">
          <h5>Credenciales</h5>
          <p>Enviar enlace oficial de recuperación de clave vía email.</p>
          <button className="btn-sec-act neutral" onClick={handleResetPassword} disabled={isProcessingSec || !userProfile}>
            <KeyRound size={14}/> Reenviar Clave
          </button>
        </div>
      </div>

      <div className="sec-divider" style={{ margin: '32px 0', borderBottom: '1px solid #e2e8f0' }} />

      {/* NUEVA SECCIÓN: NOTIFICACIONES WHATSAPP */}
      <div className="sec-alert" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
        <Bell size={20} style={{ color: '#16a34a' }}/>
        <div className="sec-txt">
          <h4 style={{ color: '#166534' }}>Notificaciones Transaccionales</h4>
          <p style={{ color: '#15803d' }}>Gestione cómo el sistema notifica hitos críticos (Carga lista / Arribo) vía WhatsApp.</p>
        </div>
      </div>

      <div className="sec-actions-grid">
        <div className="sec-action-box">
          <h5>Canal WhatsApp Business</h5>
          <p>Habilitar el envío de mensajes PUSH automáticos.</p>
          <div className="flex-between">
            <span style={{ fontSize: '12px', fontWeight: 600, color: client.whatsapp_opt_in ? '#16a34a' : '#64748b' }}>
              {client.whatsapp_opt_in ? 'Suscrito' : 'Desactivado'}
            </span>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={client.whatsapp_opt_in || false} 
                onChange={(e) => handleUpdateNotificationPrefs('whatsapp_opt_in', e.target.checked)}
                disabled={isProcessingSec}
              />
              <span className="slider round"></span>
            </label>
          </div>
        </div>

        <div className="sec-action-box">
          <h5>Número Vinculado</h5>
          <p>Número para alertas (Formato E.164: +507...)</p>
          <div className="flex-copy-input">
            <input 
              type="text" 
              className="sec-input-mono"
              placeholder="+50700000000"
              defaultValue={client.whatsapp_number || ''}
              onBlur={(e) => handleUpdateNotificationPrefs('whatsapp_number', e.target.value)}
              disabled={isProcessingSec}
            />
          </div>
        </div>
      </div>

    </div>
  </div>
)}

            {/* --- SECCIÓN: TRANSACCIONES UNIFICADAS --- */}
            {activeSection === 'history' && (
              <div className="section-panel no-padding">
                <div className="panel-header pad-24">
                  <h2>Historial de Transacciones</h2>
                </div>
                
                <div className="table-responsive">
                  <table className="clean-table">
                    <thead>
                      <tr>
                        <th style={{width:'15%'}}>Tipo</th>
                        <th style={{width:'20%'}}>Referencia</th>
                        <th style={{width:'25%'}}>Destino</th>
                        <th style={{width:'20%'}}>Fecha</th>
                        <th style={{width:'20%'}} className="txt-right">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.length === 0 ? (
                        <tr><td colSpan={5} className="empty-table">No hay transacciones registradas.</td></tr>
                      ) : (
                        transactions.map(t => {
                          const statusConf = getTxStatus(t);
                          return (
                            <tr key={`${t.type}-${t.id}`} onClick={() => navigate(t.type === 'Embarque' ? `/admin/shipments/${t.id}` : `/admin/quotes/${t.id}`)}>
                              <td>
                                <span className={`type-tag ${t.type === 'Embarque' ? 'ship' : 'quote'}`}>
                                  {t.type === 'Embarque' ? <Package size={12}/> : <FileText size={12}/>} {t.type}
                                </span>
                              </td>
                              <td><span className="t-ref">{t.ref || 'S/N'}</span></td>
                              <td className="t-muted"><Globe size={12}/> {t.dest || '—'}</td>
                              {/* FIX: Formateo de fecha 100% seguro */}
                              <td className="t-muted">{t.date ? new Date(t.date).toLocaleDateString('es-PA') : '—'}</td>
                              <td className="txt-right">
                                <span className={`status-tag ${statusConf.class}`}>{statusConf.label}</span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </main>
        </div>
      </div>

      <QuickQuoteModal isOpen={isQuoteModalOpen} onClose={() => setIsQuoteModalOpen(false)} initialClientId={id} />

      <style>{`
        /* VARIABLES Y RESET (Compactación Global) */
        .clean-container { max-width: 1100px; margin: 0 auto; padding: 20px; font-family: 'Inter', sans-serif; color: #0f172a; }
        
        /* HEADER COMPACTO CON AVATAR */
        .clean-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
        .ch-left { display: flex; align-items: center; gap: 16px; }
        .header-avatar-box { width: 56px; height: 56px; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; }
        .header-avatar-box img { width: 100%; height: 100%; object-fit: contain; padding: 4px; background: white; }
        .fallback-ava { font-size: 20px; font-weight: 800; color: #94a3b8; }
        .ava-overlay { position: absolute; inset: 0; background: rgba(15,23,42,0.6); display: flex; align-items: center; justify-content: center; color: white; opacity: 0; transition: 0.2s; cursor: pointer; }
        .header-avatar-box:hover .ava-overlay { opacity: 1; }
        
        .ch-title { font-size: 22px; font-weight: 800; margin: 0 0 2px 0; letter-spacing: -0.3px; }
        .ch-meta { display: flex; align-items: center; gap: 10px; }
        .access-pill { padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 800; text-transform: uppercase; }
        .access-pill.active { background: #dcfce7; color: #166534; }
        .access-pill.blocked { background: #fee2e2; color: #b91c1c; }
        .meta-text { font-size: 12px; color: #64748b; font-family: 'JetBrains Mono', monospace; }
        
        .ch-right { display: flex; align-items: center; gap: 24px; }
        .ch-stats { display: flex; gap: 16px; border-right: 1px solid #e2e8f0; padding-right: 24px; }
        .stat-block { display: flex; flex-direction: column; align-items: flex-end; }
        .s-val { font-size: 16px; font-weight: 800; color: #0f172a; line-height: 1.1; }
        .s-val small { font-size: 11px; color: #64748b; }
        .s-lab { font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase; margin-top: 2px; }
        
        .ch-actions { display: flex; }
        .btn-primary { background: #10b981; color: white; border: none; height: 34px; padding: 0 16px; border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer; transition: 0.2s; }
        .btn-primary:hover { background: #059669; }

        /* LAYOUT SPLIT */
        .clean-layout { display: grid; grid-template-columns: 220px 1fr; gap: 32px; align-items: start; }
        
        /* SIDEBAR */
        .side-nav { display: flex; flex-direction: column; gap: 4px; position: sticky; top: 20px; }
        .nav-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 6px; border: none; background: transparent; font-size: 12px; font-weight: 600; color: #64748b; cursor: pointer; text-align: left; transition: 0.2s; }
        .nav-item:hover { background: #f1f5f9; color: #0f172a; }
        .nav-item.active { background: #eff6ff; color: #2563eb; font-weight: 700; }

        /* PANEL BLANCO DE CONTENIDO */
        .clean-content { background: white; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 2px 10px rgba(0,0,0,0.02); min-height: 400px; }
        .section-panel { display: flex; flex-direction: column; }
        .section-panel.no-padding { padding: 0; }
        .panel-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-bottom: 1px solid #f1f5f9; }
        .pad-24 { padding: 16px 24px; }
        .pad-32 { padding: 24px; }
        .panel-header h2 { font-size: 14px; font-weight: 800; color: #0f172a; margin: 0; }
        
        .btn-edit-text { background: none; border: none; color: #2563eb; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 4px; transition: 0.2s; }
        .btn-edit-text:hover { background: #eff6ff; }

        /* FORMULARIOS Y READ-ONLY */
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 24px; }
        .field { display: flex; flex-direction: column; gap: 4px; }
        .field.full-width { grid-column: 1 / -1; }
        .field label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; }
        
        .field input, .field select { padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 13px; color: #0f172a; outline: none; transition: 0.2s; background: white; }
        .field input:focus, .field select:focus { border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,0.1); }
        
        .read-val { font-size: 13px; font-weight: 500; color: #0f172a; padding: 8px 0; }
        .font-mono { font-family: 'JetBrains Mono', monospace; font-weight: 600; }
        .text-blue { color: #2563eb; }
        
        /* BOTONES COPIAR */
        .flex-copy { display: flex; align-items: center; gap: 8px; }
        .copy-btn-inline { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #94a3b8; transition: 0.2s; }
        .copy-btn-inline:hover { background: #e2e8f0; color: #0f172a; }

        /* DIRECCIONES */
        .address-blocks { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; padding: 24px; }
        .address-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
        .ab-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .ab-title { font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; }
        .btn-copy-full { background: white; border: 1px solid #e2e8f0; color: #64748b; font-size: 10px; font-weight: 700; padding: 4px 8px; border-radius: 4px; display: flex; align-items: center; gap: 4px; cursor: pointer; transition: 0.2s; }
        .btn-copy-full:hover { border-color: #10b981; color: #10b981; }
        .ab-read { font-family: 'JetBrains Mono', monospace; font-size: 12px; line-height: 1.5; color: #1e293b; white-space: pre-wrap; }
        .ab-textarea { width: 100%; min-height: 80px; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1; font-family: 'JetBrains Mono', monospace; font-size: 12px; resize: none; outline: none; }
        .empty-italic { color: #94a3b8; font-style: italic; font-family: 'Inter', sans-serif; }

        /* DIRECTORIO DE CONTACTOS */
        .contacts-list { display: flex; flex-direction: column; padding: 0 24px 24px; }
        .contact-row { padding: 16px 0; border-bottom: 1px solid #f1f5f9; }
        .contact-row:last-child { border-bottom: none; }
        .cr-dept { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 8px; }
        .cr-read-grid { display: grid; grid-template-columns: 1.5fr 1.5fr 1fr; gap: 16px; align-items: center; font-size: 13px; font-weight: 500; }
        .cr-cell.name { font-weight: 700; color: #0f172a; }
        .cr-cell a { color: #2563eb; text-decoration: none; }
        .cr-cell a:hover { text-decoration: underline; }
        .cr-edit-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
        .cr-edit-grid input { padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 12px; width: 100%; }

        /* SEGURIDAD Y ACCESO */
        .sec-alert { display: flex; gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
        .sec-txt h4 { margin: 0 0 4px 0; font-size: 13px; font-weight: 700; color: #0f172a; }
        .sec-txt p { margin: 0; font-size: 12px; color: #64748b; }
        .sec-actions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .sec-action-box { border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; }
        .sec-action-box h5 { margin: 0 0 4px 0; font-size: 12px; font-weight: 700; }
        .sec-action-box p { margin: 0 0 16px 0; font-size: 11px; color: #64748b; }
        .btn-sec-act { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 8px; border-radius: 6px; font-size: 12px; font-weight: 700; border: none; cursor: pointer; transition: 0.2s; }
        .btn-sec-act.danger { background: #fee2e2; color: #b91c1c; }
        .btn-sec-act.danger:hover { background: #fecaca; }
        .btn-sec-act.success { background: #dcfce7; color: #166534; }
        .btn-sec-act.success:hover { background: #bbf7d0; }
        .btn-sec-act.neutral { background: #f1f5f9; color: #475569; }
        .btn-sec-act.neutral:hover { background: #e2e8f0; color: #0f172a; }

        /* TABLA DE TRANSACCIONES (CSS STRICTO) */
        .table-responsive { width: 100%; overflow-x: auto; }
        .clean-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .clean-table th { text-align: left; padding: 12px 16px; font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
        .clean-table td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 12px; font-weight: 500; color: #0f172a; cursor: pointer; transition: 0.2s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .clean-table tr:hover td { background: #f8fafc; }
        .clean-table tr:last-child td { border-bottom: none; }
        .txt-right { text-align: right !important; }
        
        .type-tag { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; }
        .type-tag.ship { background: #e0e7ff; color: #3730a3; }
        .type-tag.quote { background: #fff7ed; color: #ea580c; }
        
        .t-ref { font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 700; color: #2563eb; }
        .t-muted { color: #64748b; font-size: 12px; display: flex; align-items: center; gap: 6px; }
        .empty-table { text-align: center; color: #94a3b8; padding: 40px !important; }
        
        /* ESTILOS DE ESTADOS (Embarques y Cotizaciones) */
        .status-tag { font-size: 9px; font-weight: 800; padding: 4px 8px; border-radius: 4px; text-transform: uppercase; display: inline-block; }
        .created { background: #fef3c7; color: #92400e; }
        .packed { background: #e0e7ff; color: #3730a3; }
        .transit { background: #dbeafe; color: #1e40af; }
        .delivered { background: #dcfce7; color: #166534; }
        .q-req { background: #ffedd5; color: #c2410c; }
        .q-draft { background: #f1f5f9; color: #475569; }
        .q-sent { background: #e0f2fe; color: #0369a1; }
        .q-appr { background: #dcfce7; color: #166534; }
        .q-rej { background: #fee2e2; color: #b91c1c; }

        /* FOOTER DE EDICIÓN */
        .panel-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 24px; border-top: 1px solid #e2e8f0; background: #f8fafc; border-radius: 0 0 12px 12px; }
        .btn-cancel { background: white; border: 1px solid #cbd5e1; color: #475569; padding: 6px 14px; border-radius: 6px; font-weight: 600; font-size: 12px; cursor: pointer; }
        .btn-save { background: #10b981; border: none; color: white; padding: 6px 20px; border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer; }

        .loader-full { height: 100vh; display: flex; align-items: center; justify-content: center; color: #2563eb; }

        /* SWITCH TOGGLE */
.switch { position: relative; display: inline-block; width: 34px; height: 20px; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; inset: 0; background-color: #cbd5e1; transition: .3s; border-radius: 20px; }
.slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; }
input:checked + .slider { background-color: #10b981; }
input:checked + .slider:before { transform: translateX(14px); }

.flex-between { display: flex; justify-content: space-between; align-items: center; }
.flex-copy-input { display: flex; gap: 8px; margin-top: 4px; }
.sec-input-mono { 
  flex: 1; 
  padding: 6px 10px; 
  border: 1px solid #e2e8f0; 
  border-radius: 6px; 
  font-family: 'JetBrains Mono', monospace; 
  font-size: 12px; 
  background: #f8fafc;
}
.sec-input-mono:focus { border-color: #10b981; outline: none; background: white; }
      `}</style>
    </AdminLayout>
  );
}