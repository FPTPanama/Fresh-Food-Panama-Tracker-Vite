import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { supabase } from '@/lib/supabaseClient';
import { Zap, ArrowRight, BellRing, PackageCheck, CheckCircle2, Bot, Power, PowerOff, Plus, ChevronDown, ChevronUp, Save, Trash2, Mail, MessageCircle } from 'lucide-react';

interface Action {
  role: string;
  action: string;
  channels: { whatsapp: boolean; email: boolean; };
}

interface AutomationRule {
  id: string;
  title: string;
  description: string;
  trigger: string;
  icon: JSX.Element;
  actions: Action[];
  isActive: boolean;
  // Guardamos datos crudos para facilitar actualizaciones si fuera necesario
  dbData?: any; 
}

const TRIGGER_EVENTS: Record<string, { label: string; table: string; column: string; options: string[] }> = {
  quotes_status: { label: "Cotizaciones (Estado General)", table: "quotes", column: "status", options: ["approved", "archived", "draft", "lost", "rejected", "sent", "won"] },
  shipments_status: { label: "Embarques (Estado de Carga)", table: "shipments", column: "status", options: ["AT_DESTINATION", "CREATED", "PACKED"] },
  shipments_flight: { label: "Vuelos (Estado de Aerolínea)", table: "shipments", column: "flight_status", options: ["landed"] }
};

export default function AutomationsIndex() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [teamMembers, setTeamMembers] = useState<{name: string, role: string}[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newRule, setNewRule] = useState({ 
    title: '', 
    triggerKey: 'quotes_status', 
    triggerValue: TRIGGER_EVENTS['quotes_status'].options[0], 
    actions: [{ role: '', action: '', channels: { whatsapp: true, email: true } }] 
  });

  // 1. CARGAR DATOS DESDE SUPABASE AL INICIAR
  useEffect(() => {
    const fetchTeamAndRules = async () => {
      // Cargar Equipo
      const [{ data: internal }, { data: external }] = await Promise.all([
        supabase.from('profiles').select('full_name, position').not('position', 'is', null),
        supabase.from('external_partners').select('full_name, position')
      ]);
      const combined = [...(internal || []), ...(external || [])].map(p => ({
        name: p.full_name, role: p.position
      }));
      setTeamMembers(combined);

      // Cargar Reglas de la BD
      const { data: dbRules, error } = await supabase
        .from('automation_rules')
        .select('*')
        .order('created_at', { ascending: false });

      if (dbRules) {
        const formattedRules: AutomationRule[] = dbRules.map(r => ({
          id: r.id,
          title: r.title,
          description: r.description,
          trigger: `${r.trigger_table}.${r.trigger_column} = "${r.trigger_value}"`,
          icon: r.trigger_table === 'quotes' ? <CheckCircle2 size={24} className="text-green-600" /> : <PackageCheck size={24} className="text-blue-600" />,
          actions: r.actions,
          isActive: r.is_active,
          dbData: r
        }));
        setRules(formattedRules);
      }
      setLoading(false);
    };
    fetchTeamAndRules();
  }, []);

  // 2. ACTUALIZAR ESTADO DE LA REGLA EN BD (ON/OFF)
  const toggleRuleState = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const rule = rules.find(r => r.id === id);
    if (!rule) return;

    const newStatus = !rule.isActive;
    setRules(rules.map(r => r.id === id ? { ...r, isActive: newStatus } : r));

    await supabase.from('automation_rules').update({ is_active: newStatus }).eq('id', id);
  };

  // 3. ELIMINAR REGLA DE LA BD
  const deleteRule = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if(!window.confirm("¿Estás seguro de eliminar esta automatización?")) return;
    
    setRules(rules.filter(r => r.id !== id));
    await supabase.from('automation_rules').delete().eq('id', id);
  };

  const toggleAccordion = (id: string) => setExpandedRuleId(expandedRuleId === id ? null : id);
  const handleAddActionStep = () => setNewRule({ ...newRule, actions: [...newRule.actions, { role: '', action: '', channels: { whatsapp: true, email: true } }] });
  
  const handleTriggerKeyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newKey = e.target.value;
    setNewRule({ ...newRule, triggerKey: newKey, triggerValue: TRIGGER_EVENTS[newKey].options[0] });
  };

  // 4. GUARDAR NUEVA REGLA EN LA BD
  const handleSaveNewRule = async () => {
    if (!newRule.title) return alert("Por favor, ponle un nombre a la automatización");
    
    const validActions = newRule.actions.filter(a => a.role !== '');
    if (validActions.length === 0) return alert("Agrega al menos un destinatario");
    
    const hasEmptyChannels = validActions.some(a => !a.channels.whatsapp && !a.channels.email);
    if (hasEmptyChannels) return alert("Cada destinatario debe tener al menos un canal activado (WhatsApp o Email)");

    const eventConfig = TRIGGER_EVENTS[newRule.triggerKey];
    const descriptionText = `Cuando [${eventConfig.table}.${eventConfig.column}] cambie a "${newRule.triggerValue}"`;
    
    const rulePayload = {
      title: newRule.title,
      description: descriptionText,
      trigger_table: eventConfig.table,
      trigger_column: eventConfig.column,
      trigger_value: newRule.triggerValue,
      actions: validActions,
      is_active: true
    };

    // Inserción en Supabase
    const { data, error } = await supabase.from('automation_rules').insert([rulePayload]).select().single();

    if (error) {
      console.error("Error guardando regla:", error);
      alert("Hubo un error guardando en la base de datos.");
      return;
    }

    // Agregar a la interfaz sin recargar
    if (data) {
      const newRuleUI: AutomationRule = {
        id: data.id,
        title: data.title,
        description: data.description,
        trigger: `${data.trigger_table}.${data.trigger_column} = "${data.trigger_value}"`,
        icon: <Zap size={24} className="text-orange-500" />,
        isActive: data.is_active,
        actions: data.actions
      };
      setRules([newRuleUI, ...rules]);
    }

    setIsCreating(false);
    setNewRule({ title: '', triggerKey: 'quotes_status', triggerValue: TRIGGER_EVENTS['quotes_status'].options[0], actions: [{ role: '', action: '', channels: { whatsapp: true, email: true } }] });
  };

  if (loading) return <AdminLayout title="Motor de Automatizaciones"><div className="p-10 text-center">Cargando motor de eventos...</div></AdminLayout>;

  return (
    <AdminLayout title="Motor de Automatizaciones" subtitle="Configura canales de notificación automáticos">
      <div className="ff-page-wrapper">
        
        {/* ENCABEZADO DE ESTADO */}
        <div className="engine-status-banner">
          <div className="esb-icon"><Bot size={32} /></div>
          <div className="esb-text">
            <h3>Cerebro Event-Driven <span>Omnicanal</span></h3>
            <p>Automatiza flujos de trabajo enviando notificaciones por WhatsApp para agilidad y por Correo para trazabilidad.</p>
          </div>
          <button onClick={() => setIsCreating(!isCreating)} className="btn-create-rule">
            {isCreating ? 'Cancelar' : <><Plus size={18} /> Nueva Automatización</>}
          </button>
        </div>

        {/* BUILDER (CREADOR DE REGLAS) */}
        {isCreating && (
          <div className="rule-builder-card">
            <h4>⚡ Crear Nuevo Flujo Automático</h4>
            <div className="builder-grid">
              <div className="input-group">
                <label>Nombre de la Automatización</label>
                <input type="text" placeholder="Ej: Win - Notificación a Finanzas" value={newRule.title} onChange={e => setNewRule({...newRule, title: e.target.value})} />
              </div>
              
              <div className="input-group">
                <label>Condición de disparo (Trigger):</label>
                <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                  <select value={newRule.triggerKey} onChange={handleTriggerKeyChange} style={{flex: 1.2}}>
                    {Object.entries(TRIGGER_EVENTS).map(([key, data]) => <option key={key} value={key}>{data.label}</option>)}
                  </select>
                  <span style={{fontSize: '13px', color: '#64748b', fontWeight: 600}}>cambie a ➡️</span>
                  <select value={newRule.triggerValue} onChange={e => setNewRule({...newRule, triggerValue: e.target.value})} style={{flex: 1, backgroundColor: '#ecfdf5', borderColor: '#10b981', color: '#047857', fontWeight: 700}}>
                    {TRIGGER_EVENTS[newRule.triggerKey].options.map(opt => <option key={opt} value={opt}>{opt.toUpperCase()}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="builder-actions">
              <label>Secuencia de Notificaciones:</label>
              {newRule.actions.map((action, idx) => (
                <div key={idx} className="action-step-container">
                  <div className="action-step-row">
                    <div className="step-number">{idx + 1}</div>
                    <select 
                      value={action.role} 
                      onChange={e => {
                        const newActions = [...newRule.actions];
                        newActions[idx].role = e.target.value;
                        setNewRule({...newRule, actions: newActions});
                      }}
                    >
                      <option value="">👤 Selecciona al destinatario...</option>
                      {teamMembers.map((member, i) => <option key={i} value={`${member.name} (${member.role})`}>{member.name} - {member.role}</option>)}
                    </select>
                    <input 
                      type="text" 
                      placeholder="Instrucción a enviar..." 
                      value={action.action}
                      onChange={e => {
                        const newActions = [...newRule.actions];
                        newActions[idx].action = e.target.value;
                        setNewRule({...newRule, actions: newActions});
                      }}
                    />
                  </div>
                  <div className="channel-toggles">
                    <label className={`channel-toggle ${action.channels.whatsapp ? 'active-wa' : ''}`}>
                      <input type="checkbox" checked={action.channels.whatsapp} onChange={e => { const newActions = [...newRule.actions]; newActions[idx].channels.whatsapp = e.target.checked; setNewRule({...newRule, actions: newActions}); }} />
                      <MessageCircle size={14} /> WhatsApp
                    </label>
                    <label className={`channel-toggle ${action.channels.email ? 'active-email' : ''}`}>
                      <input type="checkbox" checked={action.channels.email} onChange={e => { const newActions = [...newRule.actions]; newActions[idx].channels.email = e.target.checked; setNewRule({...newRule, actions: newActions}); }} />
                      <Mail size={14} /> Email
                    </label>
                  </div>
                </div>
              ))}
              <button onClick={handleAddActionStep} className="btn-add-step">+ Agregar destinatario</button>
            </div>

            <div className="builder-footer">
              <button onClick={handleSaveNewRule} className="btn-save-rule"><Save size={18} /> Guardar Automatización</button>
            </div>
          </div>
        )}

        {/* LISTADO DE REGLAS DE LA BASE DE DATOS */}
        <div className="automation-grid">
          {rules.length === 0 ? (
            <div className="p-10 text-center text-gray-400">No hay reglas automatizadas aún. Crea tu primera regla arriba.</div>
          ) : (
            rules.map((rule) => {
              const isExpanded = expandedRuleId === rule.id;
              return (
                <div key={rule.id} className={`automation-card ${rule.isActive ? 'active-card' : 'inactive-card'}`}>
                  <div className="ac-header cursor-pointer" onClick={() => toggleAccordion(rule.id)}>
                    <div className="ac-title-group">
                      <div className="ac-icon-box">{rule.icon}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4>{rule.title}</h4>
                          {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                        </div>
                        <span className="ac-trigger-badge"><Zap size={10} fill="currentColor" /> EVENTO: {rule.trigger}</span>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      {/* BOTÓN DE ELIMINAR AHORA CONECTADO A BD */}
                      <button className="delete-btn" onClick={(e) => deleteRule(e, rule.id)}><Trash2 size={16} /></button>
                      <button className={`ac-toggle-btn ${rule.isActive ? 'on' : 'off'}`} onClick={(e) => toggleRuleState(e, rule.id)}>
                        {rule.isActive ? <Power size={14} /> : <PowerOff size={14} />}
                        {rule.isActive ? 'ACTIVO' : 'APAGADO'}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="ac-expanded-content">
                      <p className="ac-desc">{rule.description}</p>
                      <div className="ac-workflow">
                        <div className="workflow-title"><BellRing size={14} /> SECUENCIA DE NOTIFICACIÓN:</div>
                        <div className="workflow-steps">
                          {rule.actions.map((action, index) => (
                            <div key={index} className="workflow-step">
                              <div className="step-dot"></div>
                              <div className="step-content">
                                <div className="step-header">
                                  <span className="step-role">{action.role}</span>
                                  <div className="step-badges">
                                    {action.channels.whatsapp && <span className="badge-wa"><MessageCircle size={12} /> WhatsApp</span>}
                                    {action.channels.email && <span className="badge-email"><Mail size={12} /> Email</span>}
                                  </div>
                                </div>
                                <span className="step-action"><ArrowRight size={10} /> {action.action}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <style>{`
        /* LOS ESTILOS EXACTOS QUE YA TENÍAS */
        .ff-page-wrapper { display: flex; flex-direction: column; gap: 24px; font-family: 'Poppins', sans-serif; padding-bottom: 40px; }
        .engine-status-banner { display: flex; align-items: center; justify-content: space-between; gap: 20px; background: linear-gradient(135deg, var(--ff-green-dark) 0%, #1a3a1a 100%); padding: 24px; border-radius: 20px; color: white; }
        .esb-icon { width: 60px; height: 60px; background: rgba(255,255,255,0.1); border-radius: 16px; display: flex; align-items: center; justify-content: center; color: var(--ff-orange); }
        .esb-text { flex: 1; }
        .esb-text h3 { margin: 0 0 6px 0; font-size: 18px; display: flex; align-items: center; gap: 12px; }
        .esb-text h3 span { font-size: 10px; background: #10b981; padding: 3px 10px; border-radius: 20px; text-transform: uppercase; font-weight: 800; }
        .esb-text p { margin: 0; font-size: 13px; opacity: 0.8; max-width: 600px; }
        .btn-create-rule { background: var(--ff-orange); color: white; border: none; padding: 12px 20px; border-radius: 12px; font-weight: 700; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: 0.2s; }
        .btn-create-rule:hover { filter: brightness(1.1); transform: translateY(-2px); }
        .rule-builder-card { background: white; border: 2px dashed #cbd5e1; border-radius: 20px; padding: 24px; animation: slideDown 0.3s ease-out; }
        .rule-builder-card h4 { color: var(--ff-green-dark); margin: 0 0 20px 0; font-size: 18px; }
        .builder-grid { display: grid; grid-template-columns: 1fr 1.5fr; gap: 20px; margin-bottom: 24px; }
        .input-group label { display: block; font-size: 12px; font-weight: 700; color: #64748b; margin-bottom: 8px; }
        .input-group input, .input-group select { width: 100%; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 10px; outline: none; font-family: inherit; }
        .action-step-container { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; margin-bottom: 12px; }
        .action-step-row { display: flex; gap: 12px; align-items: center; margin-bottom: 10px; }
        .step-number { width: 30px; height: 30px; background: white; color: #64748b; border: 1px solid #e2e8f0; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-weight: 700; font-size: 12px; flex-shrink: 0; }
        .action-step-row select { width: 30%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; }
        .action-step-row input { flex: 1; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; }
        .channel-toggles { display: flex; gap: 12px; margin-left: 42px; }
        .channel-toggle { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid #cbd5e1; color: #64748b; transition: 0.2s; background: white; user-select: none; }
        .channel-toggle input { display: none; }
        .channel-toggle.active-wa { background: #dcf8c6; border-color: #25D366; color: #075E54; }
        .channel-toggle.active-email { background: #e0f2fe; border-color: #38bdf8; color: #0284c7; }
        .btn-add-step { background: none; border: none; color: var(--ff-orange); font-weight: 700; font-size: 13px; cursor: pointer; padding: 5px 0; margin-bottom: 20px; margin-left: 42px; }
        .builder-footer { border-top: 1px solid #f1f5f9; padding-top: 20px; display: flex; justify-content: flex-end; }
        .btn-save-rule { background: var(--ff-green-dark); color: white; border: none; padding: 12px 24px; border-radius: 10px; font-weight: 700; display: flex; align-items: center; gap: 8px; cursor: pointer; }
        .automation-grid { display: grid; gap: 16px; }
        .automation-card { background: white; border: 2px solid transparent; border-radius: 16px; padding: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.03); transition: 0.3s; }
        .automation-card.active-card { border-color: rgba(16, 185, 129, 0.3); }
        .automation-card.inactive-card { opacity: 0.6; }
        .cursor-pointer { cursor: pointer; user-select: none; }
        .ac-header { display: flex; justify-content: space-between; align-items: center; }
        .ac-title-group { display: flex; align-items: center; gap: 16px; }
        .ac-icon-box { width: 40px; height: 40px; border-radius: 12px; background: #f8fafc; display: flex; align-items: center; justify-content: center; }
        .automation-card.active-card .ac-icon-box { background: #ecfdf5; }
        .ac-header h4 { margin: 0; font-size: 15px; color: var(--ff-green-dark); }
        .ac-trigger-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 800; background: #f1f5f9; color: #475569; padding: 4px 8px; border-radius: 6px; margin-top: 6px; }
        .delete-btn { background: #fee2e2; color: #ef4444; border: none; padding: 8px; border-radius: 10px; cursor: pointer; transition: 0.2s; }
        .delete-btn:hover { background: #fca5a5; }
        .ac-toggle-btn { display: flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 10px; font-size: 11px; font-weight: 800; cursor: pointer; border: none; }
        .ac-toggle-btn.on { background: #ecfdf5; color: #059669; }
        .ac-toggle-btn.off { background: #f1f5f9; color: #64748b; }
        .ac-expanded-content { margin-top: 20px; border-top: 1px solid #f1f5f9; padding-top: 20px; animation: fadeIn 0.3s ease-out; }
        .ac-desc { font-size: 13px; color: #64748b; margin: 0 0 16px 0; }
        .ac-workflow { background: #f8fafc; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0; }
        .workflow-title { font-size: 11px; font-weight: 800; color: var(--ff-green-dark); margin-bottom: 16px; display: flex; align-items: center; gap: 6px; }
        .workflow-steps { display: flex; flex-direction: column; gap: 12px; position: relative; }
        .workflow-steps::before { content: ''; position: absolute; left: 5px; top: 10px; bottom: 10px; width: 2px; background: rgba(34,76,34,0.1); }
        .workflow-step { display: flex; align-items: flex-start; gap: 16px; position: relative; z-index: 1; }
        .step-dot { width: 12px; height: 12px; border-radius: 50%; background: white; border: 2.5px solid var(--ff-orange); margin-top: 4px; box-shadow: 0 0 0 4px #f8fafc; }
        .step-content { flex: 1; }
        .step-header { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
        .step-role { font-size: 13px; font-weight: 700; color: var(--ff-green-dark); }
        .step-badges { display: flex; gap: 6px; }
        .badge-wa { background: #dcf8c6; color: #075E54; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; }
        .badge-email { background: #e0f2fe; color: #0284c7; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; }
        .step-action { font-size: 12px; color: #64748b; display: flex; align-items: center; gap: 6px; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </AdminLayout>
  );
}