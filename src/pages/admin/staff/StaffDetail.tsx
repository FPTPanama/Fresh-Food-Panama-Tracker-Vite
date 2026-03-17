import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { AdminLayout, notify } from '@/components/AdminLayout';
import { 
  User, Mail, Phone, Pencil, Loader2, Save, 
  Shield, UserCheck, Briefcase, Calendar, 
  ArrowLeft, Trash2, Clock, Lock
} from 'lucide-react';

export default function StaffDetailPage() {
  const { id } = useParams(); // Este es el user_id (UUID)
  const navigate = useNavigate();

  const [profile, setProfile] = useState<any>(null);
  const [myRole, setMyRole] = useState<string>(''); 
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const fetchData = useCallback(async (profileId: string) => {
    try {
      setLoading(true);
      // 1. Obtener mi propio rol para seguridad en la interfaz
      const { data: { session } } = await supabase.auth.getSession();
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', session?.user.id)
        .maybeSingle();
      
      setMyRole(myProfile?.role || 'admin');

      // 2. Obtener datos del colaborador usando user_id
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', profileId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setProfile(data);
        setEditData(data);
      }
    } catch (e: any) {
      notify("Error cargando perfil de staff", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (id) fetchData(id);
  }, [id, fetchData]);

  const saveStaffData = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editData.full_name || null,
          phone: editData.phone || null,
          position: editData.position || null,
        })
        .eq('user_id', id); // Usamos user_id para asegurar el match

      if (error) throw error;
      setProfile({...editData});
      setIsEditing(false);
      notify("Información actualizada", "success");
    } catch (err: any) { 
      notify("Error al guardar cambios", "error"); 
    }
  };

  const handleUpdateRole = async (newRole: string) => {
    // REGLA DE NEGOCIO: Solo Superadmin cambia roles
    if (myRole !== 'superadmin') {
      notify("Acceso denegado: Se requiere nivel Superadmin", "error");
      return;
    }

    setIsUpdatingRole(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('user_id', id);

      if (error) throw error;
      setProfile({ ...profile, role: newRole });
      setEditData({ ...editData, role: newRole });
      notify(`Rol actualizado a ${newRole.toUpperCase()}`, "success");
    } catch (e: any) {
      notify("Error al actualizar permisos", "error");
    } finally {
      setIsUpdatingRole(false);
    }
  };

  if (loading || !profile) return <div className="loader-full"><Loader2 className="animate-spin" size={40}/></div>;

  const isSuperAdmin = myRole === 'superadmin';

  return (
    <AdminLayout title="Ficha de Equipo">
      <div className="view-container">
        
        <button onClick={() => navigate(-1)} className="ff-btn-back">
          <ArrowLeft size={16} /> Volver al Directorio
        </button>

        <header className="staff-header-card pro-card">
          <div className="staff-profile-main">
            <div className="ff-avatar-big">
              {profile.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="staff-title-meta">
              <div className="name-row">
                <h1>{profile.full_name || profile.email?.split('@')[0].toUpperCase()}</h1>
                <span className={`staff-role-badge ${profile.role}`}>{profile.role}</span>
              </div>
              <p className="staff-email-sub">{profile.email}</p>
            </div>
          </div>
          <div className="staff-header-actions">
            <button className="ff-btn-danger-light" onClick={() => notify("Función de baja no disponible", "error")}>
              <Trash2 size={14} /> Desactivar Cuenta
            </button>
          </div>
        </header>

        <div className="main-grid">
          <div className="main-col">
            <section className="pro-card">
              <div className="card-header-v2">
                <div className="header-title-group">
                  <div className="ff-icon-circle blue"><User size={18} /></div>
                  <div className="ff-header-text-group">
                    <h3>Información del Colaborador</h3>
                    <p>Detalles personales y posición interna.</p>
                  </div>
                </div>
                {!isEditing ? (
                  <button className="ff-btn-edit-main" onClick={() => setIsEditing(true)}>
                    <Pencil size={14} /> <span>Editar Info</span>
                  </button>
                ) : (
                  <div className="ff-edit-group">
                    <button className="ff-btn-save" onClick={saveStaffData}><Save size={14}/> <span>Guardar</span></button>
                    <button className="ff-btn-cancel" onClick={() => setIsEditing(false)}>Cancelar</button>
                  </div>
                )}
              </div>

              <div className="ff-master-grid">
                <div className="ff-master-item">
                  <span className="ff-item-label">Nombre Completo</span>
                  {isEditing ? (
                    <input className="ff-master-input" value={editData.full_name || ''} onChange={e => setEditData({...editData, full_name: e.target.value})} />
                  ) : (
                    <div className="ff-item-value">{profile.full_name || '—'}</div>
                  )}
                </div>

                <div className="ff-master-item">
                  <span className="ff-item-label">Correo Corporativo</span>
                  <div className="ff-item-value">{profile.email}</div>
                </div>

                <div className="ff-master-item">
                  <span className="ff-item-label">Teléfono</span>
                  {isEditing ? (
                    <input className="ff-master-input" value={editData.phone || ''} onChange={e => setEditData({...editData, phone: e.target.value})} />
                  ) : (
                    <div className="ff-item-value">{profile.phone || '—'}</div>
                  )}
                </div>

                <div className="ff-master-item">
                  <span className="ff-item-label">Posición</span>
                  {isEditing ? (
                    <input className="ff-master-input" value={editData.position || ''} onChange={e => setEditData({...editData, position: e.target.value})} />
                  ) : (
                    <div className="ff-item-value">{profile.position || 'Staff FreshFood'}</div>
                  )}
                </div>

                <div className="ff-master-item">
                  <span className="ff-item-label">Fecha de Alta</span>
                  <div className="ff-item-value">{new Date(profile.created_at).toLocaleDateString()}</div>
                </div>
              </div>
            </section>

            {/* SECCIÓN DE ROLES - BLOQUEADA SI NO ES SUPERADMIN */}
            <section className="pro-card">
              <div className="card-header-v2">
                <div className="header-title-group">
                  <div className="ff-icon-circle green"><Shield size={18} /></div>
                  <div className="ff-header-text-group">
                    <h3>Nivel de Autoridad</h3>
                    <p>{isSuperAdmin ? 'Gestiona el acceso del usuario.' : 'Nivel de acceso (Solo lectura).'}</p>
                  </div>
                </div>
                {!isSuperAdmin && <Lock size={16} style={{ color: '#94a3b8' }} />}
              </div>
              <div className="role-management-area">
                <div className="role-cards-container">
                  {[
                    { key: 'admin', title: 'Administrador', desc: 'Acceso operativo total.' },
                    { key: 'superadmin', title: 'Super Admin', desc: 'Control total de seguridad.' }
                  ].map((r) => (
                    <div 
                      key={r.key} 
                      className={`role-choice-card ${profile.role === r.key ? 'active' : ''} ${!isSuperAdmin ? 'readonly' : ''}`}
                      onClick={() => isSuperAdmin && !isUpdatingRole && handleUpdateRole(r.key)}
                    >
                      <div className="role-check">
                        {profile.role === r.key ? <UserCheck size={20} /> : <div className="circle-check" />}
                      </div>
                      <div className="role-info">
                        <h4>{r.title}</h4>
                        <p>{r.desc}</p>
                      </div>
                      {isUpdatingRole && profile.role !== r.key && <Loader2 className="animate-spin" size={16} />}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <aside className="side-col">
            <div className="pro-card mini-padding">
              <h4 className="side-label">Resumen de Cuenta</h4>
              <div className="stat-item">
                <Clock size={14} />
                <div>
                  <span>Última actividad</span>
                  <p>{profile.last_seen ? new Date(profile.last_seen).toLocaleDateString() : 'Hoy'}</p>
                </div>
              </div>
              <div className="stat-item">
                <Briefcase size={14} />
                <div>
                  <span>Estado de acceso</span>
                  <p className="status-active">Habilitado</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <style>{`
        .view-container { padding: 20px 40px; max-width: 1400px; margin: 0 auto; background: #f8fafc; min-height: 100vh; }
        .ff-btn-back { display: flex; align-items: center; gap: 8px; background: none; border: none; color: #64748b; font-weight: 700; cursor: pointer; margin-bottom: 20px; transition: 0.2s; }
        .ff-btn-back:hover { color: #0f172a; transform: translateX(-4px); }
        .pro-card { background: white; border-radius: 20px; border: 1px solid #e2e8f0; margin-bottom: 24px; overflow: hidden; }
        .staff-header-card { padding: 30px; display: flex; justify-content: space-between; align-items: center; }
        .staff-profile-main { display: flex; align-items: center; gap: 24px; }
        .ff-avatar-big { width: 64px; height: 64px; background: #0f172a; color: white; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; }
        .name-row { display: flex; align-items: center; gap: 12px; }
        .name-row h1 { font-size: 24px; font-weight: 900; margin: 0; color: #0f172a; }
        .staff-role-badge { padding: 4px 12px; border-radius: 8px; font-size: 11px; font-weight: 800; text-transform: uppercase; }
        .staff-role-badge.superadmin { background: #fef2f2; color: #ef4444; }
        .staff-role-badge.admin { background: #eff6ff; color: #3b82f6; }
        .staff-email-sub { color: #64748b; font-weight: 500; margin: 4px 0 0 0; }
        .main-grid { display: grid; grid-template-columns: 1fr 340px; gap: 24px; }
        .card-header-v2 { padding: 20px 24px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        .ff-icon-circle { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
        .ff-icon-circle.blue { background: #eff6ff; color: #3b82f6; }
        .ff-icon-circle.green { background: #f0fdf4; color: #10b981; }
        .ff-master-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; padding: 24px; }
        .ff-item-label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px; display: block; }
        .ff-item-value { font-size: 15px; font-weight: 600; color: #1e293b; }
        .ff-master-input { width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-weight: 600; }
        .role-cards-container { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; padding: 24px; }
        .role-choice-card { padding: 20px; border-radius: 16px; border: 2px solid #f1f5f9; cursor: pointer; transition: 0.3s; display: flex; gap: 16px; align-items: flex-start; }
        .role-choice-card.active { border-color: #0f172a; background: #f8fafc; }
        .role-choice-card.readonly { cursor: default; opacity: 0.8; }
        .circle-check { width: 20px; height: 20px; border-radius: 50%; border: 2px solid #cbd5e1; }
        .role-info h4 { margin: 0; font-size: 15px; font-weight: 800; }
        .role-info p { margin: 4px 0 0 0; font-size: 12px; color: #64748b; line-height: 1.4; }
        .stat-item { display: flex; gap: 12px; margin-bottom: 20px; }
        .stat-item span { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; }
        .stat-item p { margin: 0; font-size: 13px; font-weight: 700; }
        .status-active { color: #10b981; }
        .mini-padding { padding: 24px; }
        .side-label { font-size: 11px; font-weight: 900; color: #94a3b8; text-transform: uppercase; margin-bottom: 20px; display: block; }
        .ff-btn-danger-light { background: #fef2f2; color: #ef4444; border: 1px solid #fee2e2; padding: 10px 16px; border-radius: 10px; font-weight: 700; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; }
        .ff-btn-edit-main { background: #f1f5f9; border: none; padding: 8px 14px; border-radius: 8px; font-weight: 700; font-size: 12px; color: #475569; cursor: pointer; }
        .ff-btn-save { background: #10b981; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 700; cursor: pointer; }
        .ff-btn-cancel { background: none; border: 1px solid #e2e8f0; padding: 8px 16px; border-radius: 8px; font-weight: 700; cursor: pointer; margin-left: 8px; }
      `}</style>
    </AdminLayout>
  );
}