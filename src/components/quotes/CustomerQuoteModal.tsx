import React, { useState, useEffect } from 'react';
import { 
  X, Plane, Ship, Package, MapPin, 
  Info, MessageCircle, Mail, AlignLeft, User
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { LocationSelector } from '../LocationSelector';

interface QuickQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CustomerQuoteModal({ isOpen, onClose }: QuickQuoteModalProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [varieties, setVarieties] = useState<any[]>([]);
  
  const [form, setForm] = useState({
    customerName: "", // Nuevo campo
    mode: "AIR" as "AIR" | "SEA",
    productId: "",
    varietyId: "",
    incoterm: "CIP",
    destination: "",
    boxes: 200,
    pallets: 1,
    notes: ""
  });

  useEffect(() => {
    if (isOpen) {
      loadBaseData();
    } else {
      setForm({ customerName: "", mode: "AIR", productId: "", varietyId: "", incoterm: "CIP", destination: "", boxes: 200, pallets: 1, notes: "" });
    }
  }, [isOpen]);

  async function loadBaseData() {
    const { data } = await supabase.from('products').select('id, name').order('name');
    if (data) setProducts(data);
  }

  useEffect(() => {
    async function fetchVarieties() {
      if (!form.productId) { setVarieties([]); return; }
      const { data } = await supabase.from('product_varieties').select('id, name').eq('product_id', form.productId);
      setVarieties(data || []);
    }
    fetchVarieties();
  }, [form.productId]);

  const getMessageDetails = () => {
    const prod = products.find(p => p.id === form.productId)?.name || "Producto";
    const varName = varieties.find(v => v.id === form.varietyId)?.name || "";
    const modeIcon = form.mode === 'AIR' ? '✈️' : '🚢';
    const notesStr = form.notes.trim() ? `\n📝 *Notas:* ${form.notes}` : "";
    const clientName = form.customerName.trim() ? `👤 *Cliente:* ${form.customerName}\n` : "";
    
    return `Hola Fresh Food, solicito cotización:\n\n` +
           clientName +
           `📦 *Producto:* ${prod} (${varName})\n` +
           `${modeIcon} *Modo:* ${form.mode === 'AIR' ? 'Aéreo' : 'Marítimo'}\n` +
           `📍 *Destino:* ${form.destination}\n` +
           `📑 *Incoterm:* ${form.incoterm}\n` +
           `🔢 *Cantidad:* ${form.boxes} cajas / ${form.pallets} pallets.` +
           notesStr;
  };

  const sendWhatsApp = () => {
    const text = encodeURIComponent(getMessageDetails());
    window.open(`https://wa.me/34932620121?text=${text}`, '_blank');
    onClose();
  };

  const sendEmail = () => {
    const subject = encodeURIComponent(`Solicitud Tarifa [${form.customerName}]: ${form.destination}`);
    const body = encodeURIComponent(getMessageDetails());
    window.location.href = `mailto:comercial@freshfoodpanama.com?subject=${subject}&body=${body}`;
    onClose();
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
          {/* IDENTIFICACIÓN */}
          <div className="ff-form-group">
            <label>IDENTIFICACIÓN</label>
            <div className="ff-field">
              <User size={18} className="icon" />
              <input 
                type="text" 
                placeholder="Tu nombre o empresa" 
                value={form.customerName} 
                onChange={e => setForm({...form, customerName: e.target.value})} 
              />
            </div>
          </div>

          {/* PRODUCTO Y VARIEDAD */}
          <div className="ff-form-group">
            <label>DETALLES DE CARGA</label>
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
          </div>

          {/* LOGÍSTICA E INCOTERM */}
          <div className="ff-form-group">
            <label>LOGÍSTICA Y DESTINO</label>
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

              <div className="ff-field flex-2">
                <MapPin size={18} className="icon" />
                <div className="ff-location-wrapper">
                  <LocationSelector 
                    value={form.destination} 
                    onChange={(val) => setForm({...form, destination: val})} 
                    mode={form.mode} 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* OBSERVACIONES */}
          <div className="ff-form-group">
            <label>OBSERVACIONES ADICIONALES</label>
            <div className="ff-field-area">
              <AlignLeft size={18} className="icon-area" />
              <textarea 
                placeholder="Ej: Requiere transporte refrigerado, entrega urgente, etc..."
                value={form.notes}
                onChange={e => setForm({...form, notes: e.target.value})}
                rows={2}
              />
            </div>
          </div>
        </div>

        <div className="ff-modal-footer">
          <button className="ff-btn-mail" onClick={sendEmail} disabled={!form.varietyId || !form.destination || !form.customerName}>
            <Mail size={18} /> Email
          </button>
          <button className="ff-btn-wa" onClick={sendWhatsApp} disabled={!form.varietyId || !form.destination || !form.customerName}>
            <MessageCircle size={20} /> Solicitar por WhatsApp
          </button>
        </div>
      </div>

      <style>{`
        .ff-modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px; }
        .ff-modal-card { background: white; width: 100%; max-width: 720px; border-radius: 28px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
        .ff-modal-header { padding: 30px 40px 10px; display: flex; justify-content: space-between; align-items: center; }
        .ff-tag { color: #22c55e; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; }
        .ff-modal-header h2 { margin: 4px 0 0; font-size: 26px; color: #1e293b; font-weight: 800; }
        .ff-close-x { background: #f1f5f9; border: none; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; color: #64748b; display: flex; align-items: center; justify-content: center; }

        .ff-modal-body { padding: 10px 40px 30px; display: flex; flex-direction: column; gap: 16px; }
        .ff-form-group { display: flex; flex-direction: column; gap: 6px; }
        .ff-form-group label { font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
        
        .ff-input-row { display: flex; gap: 10px; }
        
        .ff-field { 
          position: relative; 
          background: #f8fafc; 
          border: 1.5px solid #e2e8f0; 
          border-radius: 14px; 
          height: 52px; 
          display: flex; 
          align-items: center;
          flex: 1;
        }

        /* FIX: Centrado absoluto de iconos */
        .ff-field .icon { 
          position: absolute; 
          left: 14px; 
          top: 50% !important;
          transform: translateY(-50%) !important;
          color: #94a3b8; 
          z-index: 20; 
          pointer-events: none;
        }

        .ff-field select, .ff-field input { 
          background: transparent !important; 
          border: none !important; 
          width: 100%; 
          height: 100%; 
          padding: 0 12px 0 44px !important; 
          font-size: 14px; 
          font-weight: 600; 
          outline: none; 
          color: #1e293b;
          appearance: none;
        }

        .ff-field.has-label .label { position: absolute; top: 8px; left: 14px; font-size: 7px; font-weight: 900; color: #94a3b8; }
        .ff-field.has-label input, .ff-field.has-label select { padding: 16px 12px 0 14px !important; }

        .ff-location-wrapper { flex: 1; width: 100%; position: relative; }
        .ff-location-wrapper svg:not(.lucide-map-pin) { display: none !important; } 
        
        .ff-location-wrapper input { 
            padding-left: 44px !important; 
            height: 52px !important;
        }

        .ff-field-area { position: relative; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 12px; }
        .ff-field-area textarea { width: 100%; border: none; background: transparent; outline: none; font-size: 14px; font-weight: 600; padding-left: 32px; resize: none; color: #1e293b; }
        .icon-area { position: absolute; left: 14px; top: 14px; color: #94a3b8; }

        .ff-mode-selector { display: flex; background: #f1f5f9; padding: 4px; border-radius: 14px; gap: 4px; }
        .ff-mode-selector button { border: none; width: 44px; height: 44px; border-radius: 10px; cursor: pointer; color: #64748b; background: transparent; display: flex; align-items: center; justify-content: center; }
        .ff-mode-selector button.active.air { background: #22c55e; color: white; }
        .ff-mode-selector button.active.sea { background: #0284c7; color: white; }

        .ff-modal-footer { padding: 0 40px 40px; display: flex; gap: 12px; }
        .ff-btn-mail { flex: 1; height: 54px; border-radius: 16px; border: 1.5px solid #e2e8f0; background: white; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .ff-btn-wa { flex: 2; height: 54px; border-radius: 16px; border: none; background: #25d366; color: white; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; }
        
        .flex-2 { flex: 2; } .flex-1 { flex: 1; }
        .disabled { opacity: 0.5; pointer-events: none; }
        .animate-pop { animation: pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
        @keyframes pop { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}