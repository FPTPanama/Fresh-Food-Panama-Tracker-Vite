import React, { useState, useEffect } from 'react';
import { 
  X, Plane, Ship, Package, MapPin, 
  Info, MessageCircle, AlignLeft, User, Send, Calendar, Loader2
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { LocationSelector } from '../LocationSelector';

interface QuickQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCustomerName?: string;
}

export function CustomerQuoteModal({ isOpen, onClose, initialCustomerName }: QuickQuoteModalProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [varieties, setVarieties] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingClient, setLoadingClient] = useState(true);
  
  // Estado exclusivo para el cliente logueado
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
    setLoadingClient(true);
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
      alert("Error: No se identificó el cliente. Por favor inicia sesión nuevamente.");
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
          client_snapshot: { 
            name: clientData.name, 
            tax_id: clientData.tax_id || "" 
          },
          product_details: { 
            variety_id: form.varietyId,
            notes: form.notes,
            pallets: form.pallets,
            customer_label: clientData.name,
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

  const handleOnlySystem = async () => {
    const ok = await saveToSystem();
    if (ok) {
      alert("Solicitud registrada correctamente.");
      onClose();
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
        `✈️ *Modo:* ${form.mode}\n` +
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
          
          {/* SECCIÓN 1: IDENTIFICACIÓN FIJA DEL CLIENTE */}
          <div className="ff-section-wrapper">
            <label className="ff-label-mini">INFORMACIÓN DE CUENTA</label>
            
            {loadingClient ? (
              <div className="ff-loading-skeleton">
                <Loader2 className="animate-spin" size={20} /> Identificando cliente...
              </div>
            ) : clientData ? (
              <div className="ff-client-card">
                <div className="ff-avatar">
                  {clientData.logo_url ? (
                    <img src={`https://oqgkbduqztrpfhfclker.supabase.co/storage/v1/object/public/client-logos/${clientData.logo_url}`} alt="logo" />
                  ) : <div className="ff-avatar-fallback">{clientData.name.charAt(0)}</div>}
                </div>
                <div className="ff-client-info">
                  <h3>{clientData.name}</h3>
                  <p>Tax ID: <span>{clientData.tax_id || 'N/A'}</span></p>
                </div>
              </div>
            ) : (
              <div className="ff-error-card">
                No se pudo cargar la información de tu cuenta. Reintenta o contacta a soporte.
              </div>
            )}
          </div>

          {/* SECCIÓN 2: LOGÍSTICA Y FECHA */}
          <div className="ff-input-row">
            <div className="ff-form-group flex-2">
              <label className="ff-label-mini">LOGÍSTICA</label>
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
                  <span className="label">INCOTERM</span>
                  <select value={form.incoterm} onChange={e => setForm({...form, incoterm: e.target.value})}>
                    <option>CIP</option><option>FOB</option><option>CFR</option><option>DDP</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="ff-form-group flex-1">
              <label className="ff-label-mini">FECHA ESTIMADA</label>
              <div className="ff-field has-label">
                <Calendar size={18} className="icon" />
                <input type="date" value={form.shipmentDate} onChange={e => setForm({...form, shipmentDate: e.target.value})} />
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: PRODUCTO Y DESTINO */}
          <div className="ff-form-group">
            <label className="ff-label-mini">DETALLES DE LA CARGA Y DESTINO</label>
            <div className="ff-input-row">
              <div className="ff-field flex-2">
                <Package size={18} className="icon" />
                <select value={form.productId} onChange={e => setForm({...form, productId: e.target.value})}>
                  <option value="">¿Qué enviamos?</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className={`ff-field flex-2 ${!form.productId ? 'disabled' : ''}`}>
                <Info size={18} className="icon" />
                <select value={form.varietyId} onChange={e => setForm({...form, varietyId: e.target.value})} disabled={!form.productId}>
                  <option value="">Variedad</option>
                  {varieties.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="ff-field flex-1 has-label">
                <span className="label">CAJAS</span>
                <input type="number" value={form.boxes} onChange={e => setForm({...form, boxes: parseInt(e.target.value) || 0})} />
              </div>
            </div>
            
            <div className="ff-field mt-2">
              <MapPin size={18} className="icon" />
              <div className="ff-location-wrapper">
                <LocationSelector value={form.destination} onChange={(val) => setForm({...form, destination: val})} mode={form.mode} />
              </div>
            </div>
          </div>

          {/* OBSERVACIONES */}
          <div className="ff-form-group">
            <label className="ff-label-mini">OBSERVACIONES ADICIONALES</label>
            <div className="ff-field-area">
              <AlignLeft size={18} className="icon-area" />
              <textarea 
                placeholder="Instrucciones especiales de empaque, puertos específicos, etc..."
                value={form.notes}
                onChange={e => setForm({...form, notes: e.target.value})}
                rows={2}
              />
            </div>
          </div>
        </div>

        <div className="ff-modal-footer">
          <button 
            className="ff-btn-system" 
            onClick={handleOnlySystem} 
            disabled={isSubmitting || !form.varietyId || !form.destination || !clientData}
          >
            <Send size={18} /> {isSubmitting ? '...' : 'Enviar al Sistema'}
          </button>
          <button 
            className="ff-btn-wa" 
            onClick={handleWhatsApp} 
            disabled={isSubmitting || !form.varietyId || !form.destination || !clientData}
          >
            <MessageCircle size={20} /> Solicitar vía WhatsApp
          </button>
        </div>
      </div>

      <style>{`
        .ff-modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px; }
        .ff-modal-card { background: white; width: 100%; max-width: 800px; border-radius: 32px; overflow: hidden; box-shadow: 0 40px 100px -20px rgba(0, 0, 0, 0.4); }
        .ff-modal-header { padding: 40px 45px 10px; display: flex; justify-content: space-between; align-items: center; }
        .ff-tag { color: #22c55e; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; }
        .ff-modal-header h2 { margin: 4px 0 0; font-size: 28px; color: #0f172a; font-weight: 900; letter-spacing: -1px; }
        .ff-close-x { background: #f1f5f9; border: none; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; color: #64748b; display: flex; align-items: center; justify-content: center; }
        
        .ff-modal-body { padding: 10px 45px 35px; display: flex; flex-direction: column; gap: 20px; }
        .ff-section-wrapper { display: flex; flex-direction: column; gap: 8px; }
        .ff-label-mini { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
        
        /* CLIENT CARD (SIN BOTÓN CAMBIAR) */
        .ff-client-card { display: flex; align-items: center; gap: 20px; padding: 15px 20px; background: #f0fdf4; border: 2px solid #dcfce7; border-radius: 20px; }
        .ff-avatar { width: 50px; height: 50px; border-radius: 14px; background: white; border: 1px solid #e2e8f0; overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .ff-avatar img { width: 100%; height: 100%; object-fit: contain; padding: 4px; }
        .ff-avatar-fallback { background: #22c55e; color: white; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; }
        .ff-client-info h3 { margin: 0; font-size: 18px; font-weight: 800; color: #1e293b; }
        .ff-client-info p { margin: 2px 0 0; font-size: 12px; color: #64748b; font-weight: 600; }
        .ff-client-info span { font-family: 'JetBrains Mono', monospace; color: #22c55e; font-weight: 700; }

        .ff-loading-skeleton { padding: 20px; background: #f8fafc; border-radius: 20px; display: flex; gap: 10px; align-items: center; color: #94a3b8; font-size: 13px; font-weight: 600; }
        .ff-error-card { padding: 15px 20px; background: #fef2f2; border: 1.5px solid #fee2e2; border-radius: 16px; color: #ef4444; font-size: 13px; font-weight: 600; }

        .ff-input-row { display: flex; gap: 12px; align-items: flex-end; }
        .ff-field { position: relative; background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 16px; height: 56px; display: flex; align-items: center; flex: 1; transition: 0.2s; }
        .ff-field:focus-within { border-color: #22c55e; background: white; box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.1); }
        .ff-field .icon { position: absolute; left: 16px; color: #94a3b8; z-index: 5; }
        
        .ff-field select, .ff-field input { background: transparent !important; border: none !important; width: 100%; height: 100%; padding: 0 15px 0 48px !important; font-size: 15px; font-weight: 700; outline: none; color: #1e293b; appearance: none; }
        .ff-field.has-label .label { position: absolute; top: 10px; left: 16px; font-size: 8px; font-weight: 900; color: #94a3b8; text-transform: uppercase; pointer-events: none; }
        .ff-field.has-label input, .ff-field.has-label select { padding: 18px 15px 0 48px !important; }
        
        .ff-location-wrapper { flex: 1; width: 100%; height: 100%; }
        .ff-location-wrapper input { padding-left: 48px !important; height: 56px !important; border: none !important; }
        
        .ff-field-area { position: relative; background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 18px; padding: 14px; }
        .ff-field-area textarea { width: 100%; border: none; background: transparent; outline: none; font-size: 14px; font-weight: 600; padding-left: 34px; resize: none; color: #1e293b; }
        .icon-area { position: absolute; left: 16px; top: 16px; color: #94a3b8; }
        
        .ff-mode-selector { display: flex; background: #f1f5f9; padding: 5px; border-radius: 16px; gap: 5px; height: 56px; align-items: center; border: 1.5px solid #e2e8f0; }
        .ff-mode-selector button { border: none; width: 46px; height: 46px; border-radius: 12px; cursor: pointer; color: #94a3b8; background: transparent; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
        .ff-mode-selector button.active.air { background: #22c55e; color: white; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3); }
        .ff-mode-selector button.active.sea { background: #0284c7; color: white; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3); }
        
        .ff-modal-footer { padding: 5px 45px 45px; display: flex; gap: 15px; }
        .ff-btn-system { flex: 1; height: 58px; border-radius: 20px; border: 2px solid #0f172a; background: white; color: #0f172a; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: 0.2s; }
        .ff-btn-wa { flex: 1.6; height: 58px; border-radius: 20px; border: none; background: #25d366; color: white; font-weight: 900; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 12px; box-shadow: 0 10px 20px rgba(37, 211, 102, 0.2); transition: 0.2s; }
        .ff-btn-wa:hover { transform: translateY(-2px); box-shadow: 0 15px 30px rgba(37, 211, 102, 0.3); }
        
        .flex-2 { flex: 2; } .flex-1 { flex: 1; }
        .mt-2 { margin-top: 10px; }
        .disabled { opacity: 0.5; pointer-events: none; background: #f1f5f9; }
        .animate-pop { animation: pop 0.4s cubic-bezier(0.17, 0.89, 0.32, 1.2); }
        @keyframes pop { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}