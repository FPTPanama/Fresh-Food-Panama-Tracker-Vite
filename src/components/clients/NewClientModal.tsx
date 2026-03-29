import React, { useState, useEffect, useRef } from 'react';
import { 
  X, User, Hash, Mail, Phone, Globe, MapPin, 
  Loader2, Camera, Building2, CheckCircle2, Upload
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { notify } from '@/components/AdminLayout';

interface NewClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function NewClientModal({ isOpen, onClose, onSuccess }: NewClientModalProps) {
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [form, setForm] = useState({
    name: '',
    tax_id: '',
    contact_name: '',
    contact_email: '',
    phone: '',
    address: '',
    country: '',
    logo_url: ''
  });

  useEffect(() => {
    if (!isOpen) {
      setForm({
        name: '', tax_id: '', contact_name: '',
        contact_email: '', phone: '',
        address: '', country: '', logo_url: ''
      });
    }
  }, [isOpen]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('client-logos')
        .upload(fileName, file);
      if (uploadError) throw uploadError;
      setForm(prev => ({ ...prev, logo_url: fileName }));
    } catch (error: any) {
      notify('Error al subir el logo: ' + error.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return notify("El nombre es obligatorio", "error");
    if (!form.contact_email.trim()) return notify("El email es necesario para futuras cotizaciones", "error");

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        tax_id: form.tax_id.trim() || null,
        contact_name: form.contact_name.trim() || null,
        contact_email: form.contact_email.trim().toLowerCase(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        country: form.country.trim() || null,
        logo_url: form.logo_url || null,
        has_platform_access: false,
        status: 'active'
      };

      const { error } = await supabase
        .from('clients')
        .insert([payload]);

      if (error) throw error;

      notify("Cliente registrado en el directorio", "success");
      if (onSuccess) onSuccess();
      onClose();
    } catch (e: any) {
      console.error("Error de registro:", e);
      notify(e.message || "Error al guardar el cliente", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="new-client-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="quote-modal-card animate-in">
        <div className="modal-header">
          <div className="header-content">
            <span className="fresh-tag">Directorio de Partners</span>
            <h1>Nuevo Cliente</h1>
          </div>
          <button onClick={onClose} className="close-btn"><X size={20}/></button>
        </div>

        <div className="modal-body">
          <div className="client-split-layout">
            <div className="logo-upload-container">
              <div 
                className={`logo-preview-box ${form.logo_url ? 'has-image' : ''}`} 
                onClick={() => !uploading && fileInputRef.current?.click()}
              >
                {form.logo_url ? (
                  <img src={`https://oqgkbduqztrpfhfclker.supabase.co/storage/v1/object/public/client-logos/${form.logo_url}`} alt="Preview" />
                ) : (
                  <div className="upload-placeholder">
                    {uploading ? <Loader2 className="animate-spin" size={24} /> : <Camera size={28} />}
                    <span>{uploading ? 'Subiendo...' : 'Logo'}</span>
                  </div>
                )}
                {form.logo_url && <div className="change-overlay"><Upload size={16} /></div>}
              </div>
              <input type="file" ref={fileInputRef} onChange={handleLogoUpload} accept="image/*" hidden />
            </div>

            <div className="fields-stack">
              <div className="row-wrapper">
                <label className="row-subtitle">1. DATOS FISCALES</label>
                <div className="fields-row">
                  <div className="input-field flex-3">
                    <Building2 size={16} className="field-icon" />
                    <input 
                      placeholder="Nombre de la Empresa *" 
                      value={form.name} 
                      onChange={e => setForm({...form, name: e.target.value})} 
                    />
                  </div>
                  <div className="input-field flex-2">
                    <Hash size={16} className="field-icon" />
                    <input 
                      placeholder="Tax ID / RUC" 
                      value={form.tax_id} 
                      onChange={e => setForm({...form, tax_id: e.target.value})} 
                    />
                  </div>
                </div>
              </div>

              <div className="row-wrapper">
                <label className="row-subtitle">2. CONTACTO PRINCIPAL</label>
                <div className="fields-row">
                  <div className="input-field flex-3">
                    <User size={16} className="field-icon" />
                    <input 
                      placeholder="Nombre de contacto" 
                      value={form.contact_name} 
                      onChange={e => setForm({...form, contact_name: e.target.value})} 
                    />
                  </div>
                  <div className="input-field flex-3">
                    <Mail size={16} className="field-icon" />
                    <input 
                      type="email" 
                      placeholder="Email corporativo *" 
                      value={form.contact_email} 
                      onChange={e => setForm({...form, contact_email: e.target.value})} 
                    />
                  </div>
                </div>
              </div>

              <div className="row-wrapper">
                <label className="row-subtitle">3. UBICACIÓN Y TELÉFONO</label>
                <div className="fields-row">
                  <div className="input-field flex-3">
                    <MapPin size={16} className="field-icon" />
                    <input 
                      placeholder="Dirección comercial" 
                      value={form.address} 
                      onChange={e => setForm({...form, address: e.target.value})} 
                    />
                  </div>
                  <div className="input-field flex-2">
                    <Phone size={16} className="field-icon" />
                    <input 
                      placeholder="Teléfono" 
                      value={form.phone} 
                      onChange={e => setForm({...form, phone: e.target.value})} 
                    />
                  </div>
                </div>
                <div className="fields-row" style={{ marginTop: '12px' }}>
                    <div className="input-field flex-1">
                        <Globe size={16} className="field-icon" />
                        <input 
                          placeholder="País" 
                          value={form.country} 
                          onChange={e => setForm({...form, country: e.target.value})} 
                        />
                    </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button 
            className="btn-primary-save" 
            onClick={handleCreate} 
            disabled={saving || uploading || !form.name || !form.contact_email}
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <>Guardar en Directorio <CheckCircle2 size={18}/></>}
          </button>
        </div>
      </div>
      
      <style>{`
        .new-client-modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(15, 23, 42, 0.75);
          backdrop-filter: blur(4px);
          display: grid;
          place-items: center;
          z-index: 10000;
          padding: 20px;
        }
        .quote-modal-card {
          background: white;
          width: 100%;
          max-width: 850px;
          border-radius: 24px;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
          overflow: hidden;
        }
        .animate-in { animation: modalIn 0.3s ease-out; }
        @keyframes modalIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        
        .modal-header { padding: 24px 32px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; }
        .fresh-tag { font-size: 10px; font-weight: 800; color: #10b981; text-transform: uppercase; letter-spacing: 0.05em; }
        .modal-header h1 { font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 4px; }
        .close-btn { background: white; border: 1px solid #e2e8f0; padding: 8px; border-radius: 12px; cursor: pointer; color: #64748b; }

        .modal-body { padding: 32px; max-height: 70vh; overflow-y: auto; }
        .client-split-layout { display: flex; gap: 32px; }
        
        .logo-upload-container { flex-shrink: 0; }
        .logo-preview-box { width: 140px; height: 140px; border-radius: 20px; border: 2px dashed #e2e8f0; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; position: relative; overflow: hidden; }
        .logo-preview-box:hover { border-color: #10b981; background: #f0fdf4; }
        .logo-preview-box img { width: 100%; height: 100%; object-fit: contain; padding: 10px; }
        .upload-placeholder { display: flex; flex-direction: column; align-items: center; gap: 8px; color: #94a3b8; font-size: 12px; font-weight: 700; }
        .change-overlay { position: absolute; bottom: 8px; right: 8px; background: white; padding: 6px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); color: #10b981; }

        .fields-stack { flex: 1; display: grid; gap: 24px; }
        .row-subtitle { font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 12px; display: block; }
        .fields-row { display: flex; gap: 16px; }
        .flex-1 { flex: 1; } .flex-2 { flex: 2; } .flex-3 { flex: 3; }
        .input-field { position: relative; display: flex; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 0 14px; transition: 0.2s; }
        .input-field:focus-within { border-color: #10b981; background: white; box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1); }
        .field-icon { color: #94a3b8; }
        .input-field input { width: 100%; padding: 12px 10px; border: none; background: transparent; outline: none; font-size: 14px; font-weight: 600; color: #1e293b; }

        .modal-footer { padding: 24px 32px; background: #f8fafc; border-top: 1px solid #f1f5f9; display: flex; justify-content: flex-end; gap: 12px; }
        .btn-secondary { padding: 12px 24px; border-radius: 12px; border: 1px solid #e2e8f0; background: white; font-weight: 700; color: #64748b; cursor: pointer; }
        .btn-primary-save { padding: 12px 28px; border-radius: 12px; border: none; background: #0f172a; color: white; font-weight: 700; display: flex; align-items: center; gap: 10px; cursor: pointer; transition: 0.2s; }
        .btn-primary-save:hover { background: #1e293b; transform: translateY(-2px); }
        .btn-primary-save:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}