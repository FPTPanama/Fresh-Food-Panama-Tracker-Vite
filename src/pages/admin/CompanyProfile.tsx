import React, { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from '@/lib/supabaseClient';
import { 
  Building, Landmark, FileText, Save, Loader2, CheckCircle2 
} from "lucide-react";

export default function CompanyProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  // Estado del formulario
  const [formData, setFormData] = useState({
    id: "",
    trade_name: "",
    legal_name: "",
    tax_id: "",
    address: "",
    contact_email: "",
    contact_phone: "",
    website: "",
    terms_and_conditions: "",
  });

  // Estado independiente para el JSON de bancos
  const [bankData, setBankData] = useState({
    beneficiary: "",
    beneficiary_address: "",
    bank_name: "",
    bank_address: "",
    account_number: "",
    account_type: "",
    swift_bic: "",
    routing_aba: "",
    intermediary_bank_name: "",
    intermediary_bank_address: "",
    intermediary_swift: "",
    intermediary_aba: ""
  });

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Cargar datos
  useEffect(() => {
    async function loadProfile() {
      try {
        const { data, error } = await supabase
          .from("company_profile")
          .select("*")
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        
        if (data) {
          setFormData({
            id: data.id,
            trade_name: data.trade_name || "",
            legal_name: data.legal_name || "",
            tax_id: data.tax_id || "",
            address: data.address || "",
            contact_email: data.contact_email || "",
            contact_phone: data.contact_phone || "",
            website: data.website || "",
            terms_and_conditions: data.terms_and_conditions || "",
          });
          
          if (data.bank_details) {
            setBankData({ ...bankData, ...data.bank_details });
          }
        }
      } catch (error) {
        console.error("Error cargando perfil:", error);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  // Manejo de cambios
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleBankChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBankData({ ...bankData, [e.target.name]: e.target.value });
  };

  // Guardar datos
  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...formData,
        bank_details: bankData
      };

      let error;
      if (formData.id) {
        // Actualizar
        const res = await supabase.from("company_profile").update(payload).eq("id", formData.id);
        error = res.error;
      } else {
        // Insertar por primera vez
        const res = await supabase.from("company_profile").insert([payload]);
        error = res.error;
      }

      if (error) throw error;
      showToast("Perfil de empresa actualizado con éxito");
    } catch (error: any) {
      console.error("Error guardando:", error);
      showToast("Error al guardar los cambios", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Perfil de la Empresa">
        <div className="flex-center" style={{ height: '60vh' }}>
          <Loader2 className="animate-spin text-brand" size={40} />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Configuración de la Empresa" subtitle="Gestiona la identidad y datos bancarios que aparecerán en los PDFs">
      
      {toast && (
        <div className={`toast-alert ${toast.type}`}>
          <CheckCircle2 size={18} /> {toast.msg}
        </div>
      )}

      <div className="cp-container">
        
        {/* BARRA DE ACCIÓN FLOTANTE */}
        <div className="cp-action-bar">
          <div>
            <h2 className="cp-title">Perfil Oficial de la Empresa</h2>
            <p className="cp-desc">Estos datos se sincronizan en tiempo real con Cotizaciones y Órdenes de Compra.</p>
          </div>
          <button className="cp-btn-save" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            {saving ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>

        <div className="cp-grid">
          
          {/* COLUMNA IZQUIERDA: Datos Generales y Términos */}
          <div className="cp-col">
            
            <div className="cp-card">
              <div className="cp-card-header">
                <Building size={18} className="cp-icon" />
                <h3>Información Corporativa</h3>
              </div>
              <div className="cp-card-body">
                <div className="cp-field">
                  <label>Nombre Comercial</label>
                  <input name="trade_name" value={formData.trade_name} onChange={handleChange} placeholder="Ej: Fresh Food Panamá" />
                </div>
                <div className="cp-field-row">
                  <div className="cp-field">
                    <label>Razón Social (Legal)</label>
                    <input name="legal_name" value={formData.legal_name} onChange={handleChange} placeholder="Ej: FRESH FOOD PANAMA, C.A." />
                  </div>
                  <div className="cp-field">
                    <label>RUC / Tax ID</label>
                    <input name="tax_id" value={formData.tax_id} onChange={handleChange} />
                  </div>
                </div>
                <div className="cp-field">
                  <label>Dirección Fiscal</label>
                  <input name="address" value={formData.address} onChange={handleChange} />
                </div>
                <div className="cp-field-row">
                  <div className="cp-field">
                    <label>Correo Electrónico (Ventas/Admin)</label>
                    <input name="contact_email" value={formData.contact_email} onChange={handleChange} />
                  </div>
                  <div className="cp-field">
                    <label>Teléfono</label>
                    <input name="contact_phone" value={formData.contact_phone} onChange={handleChange} />
                  </div>
                </div>
                <div className="cp-field">
                  <label>Sitio Web</label>
                  <input name="website" value={formData.website} onChange={handleChange} placeholder="https://..." />
                </div>
              </div>
            </div>

            <div className="cp-card">
              <div className="cp-card-header">
                <FileText size={18} className="cp-icon" />
                <h3>Términos y Condiciones (Por Defecto)</h3>
              </div>
              <div className="cp-card-body">
                <div className="cp-field">
                  <label>Cláusulas legales para PDFs</label>
                  <textarea 
                    name="terms_and_conditions" 
                    value={formData.terms_and_conditions} 
                    onChange={handleChange} 
                    rows={4}
                    placeholder="Sujeto a disponibilidad de espacio..."
                  />
                </div>
              </div>
            </div>

          </div>

          {/* COLUMNA DERECHA: Datos Bancarios */}
          <div className="cp-col">
            
            <div className="cp-card bank-card">
              <div className="cp-card-header">
                <Landmark size={18} className="cp-icon" />
                <h3>Ruta Bancaria para Wire Transfers</h3>
              </div>
              <div className="cp-card-body">
                
                <h4 className="cp-sub-heading">Banco Principal (Beneficiario)</h4>
                <div className="cp-field">
                  <label>Nombre del Beneficiario</label>
                  <input name="beneficiary" value={bankData.beneficiary} onChange={handleBankChange} />
                </div>
                <div className="cp-field">
                  <label>Dirección del Beneficiario</label>
                  <input name="beneficiary_address" value={bankData.beneficiary_address} onChange={handleBankChange} />
                </div>
                <div className="cp-field-row">
                  <div className="cp-field">
                    <label>Nombre del Banco</label>
                    <input name="bank_name" value={bankData.bank_name} onChange={handleBankChange} />
                  </div>
                  <div className="cp-field">
                    <label>SWIFT / BIC</label>
                    <input name="swift_bic" value={bankData.swift_bic} onChange={handleBankChange} className="font-mono text-brand" />
                  </div>
                </div>
                <div className="cp-field-row">
                  <div className="cp-field">
                    <label>Número de Cuenta</label>
                    <input name="account_number" value={bankData.account_number} onChange={handleBankChange} className="font-mono text-brand" />
                  </div>
                  <div className="cp-field">
                    <label>Tipo de Cuenta</label>
                    <input name="account_type" value={bankData.account_type} onChange={handleBankChange} placeholder="Ej: Checking / USD" />
                  </div>
                </div>
                <div className="cp-field">
                  <label>Dirección del Banco</label>
                  <input name="bank_address" value={bankData.bank_address} onChange={handleBankChange} />
                </div>

                <div className="cp-divider"></div>

                <h4 className="cp-sub-heading">Banco Intermediario / Corresponsal</h4>
                <p className="cp-helper">Déjalo en blanco si no utilizas un banco intermediario para recibir fondos del exterior.</p>
                
                <div className="cp-field">
                  <label>Nombre del Banco Intermediario</label>
                  <input name="intermediary_bank_name" value={bankData.intermediary_bank_name} onChange={handleBankChange} />
                </div>
                <div className="cp-field-row">
                  <div className="cp-field">
                    <label>SWIFT Intermediario</label>
                    <input name="intermediary_swift" value={bankData.intermediary_swift} onChange={handleBankChange} className="font-mono" />
                  </div>
                  <div className="cp-field">
                    <label>ABA / Routing Number</label>
                    <input name="intermediary_aba" value={bankData.intermediary_aba} onChange={handleBankChange} className="font-mono" />
                  </div>
                </div>
                <div className="cp-field">
                  <label>Dirección del Banco Intermediario</label>
                  <input name="intermediary_bank_address" value={bankData.intermediary_bank_address} onChange={handleBankChange} />
                </div>

              </div>
            </div>

          </div>

        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .cp-container { max-width: 1200px; margin: 0 auto; padding-bottom: 40px; font-family: 'Poppins', sans-serif; color: #0f172a; }
        .text-brand { color: var(--ff-green-dark); }
        .font-mono { font-family: 'JetBrains Mono', monospace; font-weight: 600; letter-spacing: -0.2px; }
        .flex-center { display: flex; justify-content: center; align-items: center; }
        
        /* BARRA DE ACCIÓN */
        .cp-action-bar { display: flex; justify-content: space-between; align-items: center; background: white; padding: 20px 24px; border-radius: 16px; border: 1px solid rgba(34,76,34,0.1); margin-bottom: 24px; box-shadow: 0 4px 15px rgba(0,0,0,0.02); }
        .cp-title { margin: 0 0 4px 0; font-size: 18px; font-weight: 800; color: var(--ff-green-dark); }
        .cp-desc { margin: 0; font-size: 13px; color: #64748b; }
        
        .cp-btn-save { display: flex; align-items: center; gap: 8px; background: var(--ff-green-dark); color: white; border: none; padding: 10px 20px; border-radius: 10px; font-weight: 600; font-size: 14px; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 10px rgba(34,76,34,0.2); }
        .cp-btn-save:hover:not(:disabled) { background: var(--ff-green); transform: translateY(-2px); }
        .cp-btn-save:disabled { opacity: 0.7; cursor: not-allowed; }

        /* GRID Y TARJETAS */
        .cp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
        .cp-col { display: flex; flex-direction: column; gap: 24px; }
        
        .cp-card { background: white; border-radius: 16px; border: 1px solid rgba(34,76,34,0.1); overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.02); }
        .cp-card-header { display: flex; align-items: center; gap: 10px; padding: 16px 24px; background: #f9fbf9; border-bottom: 1px solid rgba(34,76,34,0.05); }
        .cp-icon { color: var(--ff-green-dark); opacity: 0.8; }
        .cp-card-header h3 { margin: 0; font-size: 14px; font-weight: 800; color: var(--ff-green-dark); text-transform: uppercase; letter-spacing: 0.5px; }
        
        .cp-card-body { padding: 24px; display: flex; flex-direction: column; gap: 16px; }
        
        .cp-sub-heading { margin: 0; font-size: 13px; font-weight: 800; color: var(--ff-green-dark); text-transform: uppercase; }
        .cp-helper { margin: -10px 0 10px 0; font-size: 11px; color: #94a3b8; }
        .cp-divider { height: 1px; border-bottom: 1px dashed rgba(34,76,34,0.15); margin: 10px 0; }

        /* FORMULARIOS */
        .cp-field { display: flex; flex-direction: column; gap: 6px; flex: 1; }
        .cp-field label { font-size: 11px; font-weight: 700; color: var(--ff-green-dark); opacity: 0.7; text-transform: uppercase; }
        .cp-field input, .cp-field textarea { width: 100%; padding: 10px 14px; border: 1px solid rgba(34,76,34,0.15); border-radius: 10px; font-size: 13px; color: var(--ff-green-dark); transition: 0.2s; outline: none; background: #fcfdfc; box-sizing: border-box; }
        .cp-field input:focus, .cp-field textarea:focus { border-color: var(--ff-green); background: white; box-shadow: 0 0 0 3px rgba(34,76,34,0.05); }
        .cp-field textarea { resize: vertical; min-height: 80px; }
        
        .cp-field-row { display: flex; gap: 16px; width: 100%; }

        /* TOAST */
        .toast-alert { position: fixed; bottom: 24px; right: 24px; background: var(--ff-green-dark); color: white; padding: 12px 20px; border-radius: 10px; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 10px; z-index: 1000; box-shadow: 0 10px 25px rgba(0,0,0,0.2); animation: slideUp 0.3s ease forwards; }
        .toast-alert.error { background: #ef4444; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

        /* RESPONSIVE */
        @media (max-width: 900px) {
          .cp-grid { grid-template-columns: 1fr; }
          .cp-action-bar { flex-direction: column; align-items: flex-start; gap: 16px; }
          .cp-btn-save { width: 100%; justify-content: center; }
          .cp-field-row { flex-direction: column; gap: 16px; }
        }
      ` }} />
    </AdminLayout>
  );
}