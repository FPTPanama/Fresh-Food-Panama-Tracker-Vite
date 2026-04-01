import React, { useState, useEffect } from 'react';
import { 
  X, Plane, Ship, Package, MapPin, 
  Info, MessageCircle, AlignLeft, Send, Calendar, Loader2
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { LocationSelector } from '../LocationSelector';

interface QuickQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCustomerName?: string;
}

// MATRIZ DE COMPATIBILIDAD LOGÍSTICA
const LOGISTICS_MATRIX = {
  AIR: {
    defaultIncoterm: "CIP",
    allowedIncoterms: ["CIP", "CPT", "DDP"]
  },
  SEA: {
    defaultIncoterm: "FOB",
    allowedIncoterms: ["FOB", "CFR", "DDP"]
  }
};

export function CustomerQuoteModal({ isOpen, onClose, initialCustomerName }: QuickQuoteModalProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [varieties, setVarieties] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingClient, setLoadingClient] = useState(true);
  const [clientData, setClientData] = useState<any>(null);

  const [form, setForm] = useState({
    customerName: "", 
    mode: "AIR" as "AIR" | "SEA",
    productId: "",
    varietyId: "",
    incoterm: "CIP",
    destination: "",
    boxes: 200,
    pallets: 1,
    shipmentDate: "",
    notes: ""
  });

  useEffect(() => {
    if (isOpen) {
      loadBaseData();
      detectClient();
    } else {
      resetForm();
    }
  }, [isOpen]);

  // Sincronizar Incoterm cuando cambia el modo de transporte
  useEffect(() => {
    const matrix = LOGISTICS_MATRIX[form.mode];
    setForm(prev => ({ ...prev, incoterm: matrix.defaultIncoterm }));
  }, [form.mode]);

  async function resetForm() {
    setForm({ 
      customerName: initialCustomerName || "", 
      mode: "AIR", 
      productId: "", 
      varietyId: "", 
      incoterm: "CIP", 
      destination: "", 
      boxes: 200, 
      pallets: 1, 
      shipmentDate: "",
      notes: "" 
    });
    setClientData(null);
  }

  async function loadBaseData() {
    const { data } = await supabase.from('products').select('id, name').order('name');
    if (data) setProducts(data);
  }

  async function detectClient() {
    try {
      setLoadingClient(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data } = await supabase
          .from('clients')
          .select('*')
          .eq('auth_user_id', session.user.id)
          .maybeSingle();
        
        if (data) {
          setClientData(data);
          setForm(prev => ({ ...prev, customerName: data.name }));
        }
      }
    } finally {
      setLoadingClient(false);
    }
  }

  useEffect(() => {
    async function fetchVarieties() {
      if (!form.productId) { setVarieties([]); return; }
      const { data } = await supabase.from('product_varieties').select('id, name').eq('product_id', form.productId);
      setVarieties(data || []);
    }
    fetchVarieties();
  }, [form.productId]);

  const saveToSystem = async () => {
    if (!clientData) {
      alert("Error: No se identificó el cliente.");
      return false;
    }
    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase
        .from('quotes')
        .insert([{
          created_by: session?.user?.id || null,
          client_id: clientData.id,
          product_id: form.productId || null,
          status: 'Solicitud',
          mode: form.mode,
          currency: 'USD',
          destination: form.destination,
          boxes: form.boxes,
          margin_markup: 0,
          total: 0,
          client_snapshot: { name: clientData.name, tax_id: clientData.tax_id || "" },
          product_details: { 
            variety_id: form.varietyId,
            notes: form.notes,
            incoterm: form.incoterm,
            requested_shipment_date: form.shipmentDate
          }
        }]);
      if (error) throw error;
      return true;
    } catch (e: any) {
      alert(`Error: ${e.message}`);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWhatsApp = async () => {
    const ok = await saveToSystem();
    if (ok) {
      const prod = products.find(p => p.id === form.productId)?.name || "Producto";
      const varName = varieties.find(v => v.id === form.varietyId)?.name || "";
      const text = encodeURIComponent(
        `Hola Fresh Food, solicito cotización:\n\n` +
        `👤 *Cliente:* ${clientData.name}\n` +
        `📦 *Producto:* ${prod} (${varName})\n` +
        `✈️ *Modo:* ${form.mode} (${form.incoterm})\n` +
        `📍 *Destino:* ${form.destination}\n` +
        `📅 *Embarque:* ${form.shipmentDate || 'A convenir'}\n` +
        `🔢 *Cantidad:* ${form.boxes} cajas\n` +
        (form.notes ? `📝 *Notas:* ${form.notes}` : "")
      );
      window.open(`https://wa.me/50762256452?text=${text}`, '_blank');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="ff-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ff-modal-card animate-pop">
        
        <div className="ff-modal-header">
          <div>
            <span className="ff-tag">Fresh Food Panama</span>
            <h2>Nueva Solicitud</h2>
          </div>
          <button onClick={onClose} className="ff-close-x"><X size={22}/></button>
        </div>

        <div className="ff-modal-body">
          
          {/* SECCIÓN 1: CLIENTE */}
          <div className="ff-section-wrapper">
            <label className="ff-label-mini">INFORMACIÓN DE CUENTA</label>
            {loadingClient ? (
              <div className="ff-loading-skeleton"><Loader2 className="animate-spin" size={20} /> Identificando...</div>
            ) : (
              <div className="ff-client-card">
                <div className="ff-avatar">
                  {clientData?.logo_url ? <img src={`https://oqgkbduqztrpfhfclker.supabase.co/storage/v1/object/public/client-logos/${clientData.logo_url}`} alt="logo" /> : <div className="ff-avatar-fallback">{clientData?.name?.charAt(0)}</div>}
                </div>
                <div className="ff-client-info">
                  <h3>{clientData?.name}</h3>
                  <p>Tax ID: <span>{clientData?.tax_id || 'N/A'}</span></p>
                </div>
              </div>
            )}
          </div>

          {/* SECCIÓN 2: PRODUCTO */}
          <div className="ff-form-group">
            <label className="ff-label-mini">DETALLES DEL PRODUCTO</label>
            <div className="ff-input-row">
              <div className="ff-field flex-2">
                <Package size={18} className="ff-icon-fixed" />
                <select value={form.productId} onChange={e => setForm({...form, productId: e.target.value})} className="ff-select-clean">
                  <option value="">¿Qué enviamos?</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className={`ff-field flex-2 ${!form.productId ? 'disabled' : ''}`}>
                <Info size={18} className="ff-icon-fixed" />
                <select value={form.varietyId} onChange={e => setForm({...form, varietyId: e.target.value})} disabled={!form.productId} className="ff-select-clean">
                  <option value="">Variedad</option>
                  {varieties.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="ff-field flex-1 has-label">
                <span className="ff-label-float">CAJAS</span>
                <input type="number" value={form.boxes} onChange={e => setForm({...form, boxes: parseInt(e.target.value) || 0})} />
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: LOGÍSTICA Y RUTA */}
          <div className="ff-form-group">
            <label className="ff-label-mini">LOGÍSTICA Y RUTA (INTELIGENTE)</label>
            <div className="ff-input-row">
              <div className="ff-mode-selector">
                <button className={form.mode === 'AIR' ? 'active air' : ''} onClick={() => setForm({...form, mode: 'AIR'})}>
                  <Plane size={18} />
                </button>
                <button className={form.mode === 'SEA' ? 'active sea' : ''} onClick={() => setForm({...form, mode: 'SEA'})}>
                  <Ship size={18} />
                </button>
              </div>
              <div className="ff-field flex-1 has-label">
                <span className="ff-label-float">INCOTERM</span>
                <select 
                  value={form.incoterm} 
                  onChange={e => setForm({...form, incoterm: e.target.value})} 
                  className="ff-select-clean"
                >
                  {LOGISTICS_MATRIX[form.mode].allowedIncoterms.map(inc => (
                    <option key={inc} value={inc}>{inc}</option>
                  ))}
                </select>
              </div>
              <div className="ff-field flex-3 ff-field-overflow">
                
                <div className="ff-location-wrapper">
                  <LocationSelector value={form.destination} onChange={(val) => setForm({...form, destination: val})} mode={form.mode} />
                </div>
              </div>
            </div>
          </div>

          {/* SECCIÓN 4: FECHA Y NOTAS */}
          <div className="ff-input-row">
            <div className="ff-field flex-1 has-label">
              <span className="ff-label-float">FECHA DE EMBARQUE</span>
              <Calendar size={18} className="ff-icon-fixed" />
              <input type="date" value={form.shipmentDate} onChange={e => setForm({...form, shipmentDate: e.target.value})} />
            </div>
            <div className="ff-field-area flex-2">
              <AlignLeft size={18} className="ff-icon-area-fixed" />
              <textarea 
                placeholder="Instrucciones especiales..."
                value={form.notes}
                onChange={e => setForm({...form, notes: e.target.value})}
                rows={1}
              />
            </div>
          </div>
        </div>

        <div className="ff-modal-footer">
          <button className="ff-btn-system" onClick={async () => { if(await saveToSystem()) onClose(); }} disabled={isSubmitting || !form.varietyId || !form.destination}>
            <Send size={18} /> {isSubmitting ? '...' : 'Enviar al Sistema'}
          </button>
          <button className="ff-btn-wa" onClick={handleWhatsApp} disabled={isSubmitting || !form.varietyId || !form.destination}>
            <MessageCircle size={20} /> Solicitar vía WhatsApp
          </button>
        </div>
      </div>

      <style>{`
        /* --- ESTILOS BASE PRESERVADOS --- */
        .ff-modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px; }
        .ff-modal-card { background: white; width: 100%; max-width: 850px; border-radius: 32px; overflow: hidden; box-shadow: 0 40px 100px -20px rgba(0, 0, 0, 0.4); }
        .ff-modal-header { padding: 35px 45px 10px; display: flex; justify-content: space-between; align-items: center; }
        .ff-tag { color: #22c55e; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; }
        .ff-modal-header h2 { margin: 4px 0 0; font-size: 28px; color: #0f172a; font-weight: 900; letter-spacing: -1px; }
        .ff-close-x { background: #f1f5f9; border: none; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; color: #64748b; display: flex; align-items: center; justify-content: center; }
        .ff-modal-body { padding: 10px 45px 35px; display: flex; flex-direction: column; gap: 20px; }
        .ff-section-wrapper { display: flex; flex-direction: column; gap: 8px; }
        .ff-label-mini { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
        .ff-client-card { display: flex; align-items: center; gap: 20px; padding: 12px 20px; background: #f0fdf4; border: 2px solid #dcfce7; border-radius: 20px; }
        .ff-avatar { width: 45px; height: 45px; border-radius: 12px; background: white; border: 1px solid #e2e8f0; overflow: hidden; display: flex; align-items: center; justify-content: center; }
        .ff-avatar img { width: 100%; height: 100%; object-fit: contain; padding: 4px; }
        .ff-avatar-fallback { background: #22c55e; color: white; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-weight: 800; }
        .ff-client-info h3 { margin: 0; font-size: 17px; font-weight: 800; color: #1e293b; }
        .ff-client-info p { margin: 0; font-size: 11px; color: #64748b; font-weight: 600; }
        .ff-input-row { display: flex; gap: 12px; align-items: stretch; width: 100%; }
        
        /* FIX DE OVERFLOW PARA EL DROPDOWN DE LOCALIZACIONES */
        .ff-field { position: relative; background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 16px; min-height: 56px; display: flex; align-items: center; transition: 0.2s; overflow: hidden; }
        .ff-field-overflow { overflow: visible !important; z-index: 20; }
        .ff-field:focus-within { border-color: #22c55e; background: white; }
        
        .ff-icon-fixed { position: absolute; left: 16px; color: #94a3b8; pointer-events: none; z-index: 10; }
        .ff-icon-area-fixed { position: absolute; left: 16px; top: 18px; color: #94a3b8; pointer-events: none; z-index: 10; }
        .ff-field select, .ff-field input { background: transparent !important; border: none !important; width: 100%; height: 100%; padding: 0 15px 0 52px !important; font-size: 14px; font-weight: 700; color: #1e293b; outline: none; z-index: 5; }
        .ff-select-clean { appearance: none; cursor: pointer; }
        .ff-label-float { position: absolute; top: 10px; left: 52px; font-size: 8px; font-weight: 900; color: #94a3b8; text-transform: uppercase; pointer-events: none; z-index: 10; }
        .ff-field.has-label input, .ff-field.has-label select { padding-top: 18px !important; }
        
        .ff-location-wrapper { flex: 1; width: 100%; z-index: 5; }
        .ff-mode-selector { display: flex; background: #f1f5f9; padding: 4px; border-radius: 16px; gap: 4px; border: 2px solid #e2e8f0; }
        .ff-mode-selector button { border: none; width: 48px; height: 44px; border-radius: 12px; cursor: pointer; color: #94a3b8; background: transparent; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
        .ff-mode-selector button.active.air { background: #22c55e; color: white; }
        .ff-mode-selector button.active.sea { background: #0284c7; color: white; }
        
        .ff-field-area { position: relative; background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 16px; display: flex; align-items: center; min-height: 56px; }
        .ff-field-area textarea { width: 100%; border: none; background: transparent; outline: none; font-size: 14px; font-weight: 600; padding: 18px 15px 12px 52px; resize: none; color: #1e293b; z-index: 5; }
        .ff-modal-footer { padding: 30px 45px 45px; display: flex; gap: 15px; }
        .ff-btn-system { flex: 1; height: 56px; border-radius: 18px; border: 2px solid #0f172a; background: white; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: 0.2s; }
        .ff-btn-wa { flex: 1.5; height: 56px; border-radius: 18px; border: none; background: #25d366; color: white; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 8px 20px rgba(37, 211, 102, 0.2); }
        
        .flex-1 { flex: 1; } .flex-2 { flex: 2; } .flex-3 { flex: 3; }
        .disabled { opacity: 0.5; pointer-events: none; }
        .animate-pop { animation: pop 0.4s cubic-bezier(0.17, 0.89, 0.32, 1.2); }
        @keyframes pop { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}