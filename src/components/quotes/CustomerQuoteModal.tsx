import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Plane, Ship, Package, 
  Loader2, Info, ChevronDown, User,
  Send, Calendar, AlignLeft,
  ArrowRight as ArrowRightIcon
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
    allowedIncoterms: ["CIP", "FCA",]
  },
  SEA: {
    defaultIncoterm: "FOB",
    allowedIncoterms: ["FOB", "CIF", ]
  }
};

export function CustomerQuoteModal({ isOpen, onClose }: QuickQuoteModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingClient, setLoadingClient] = useState(true);
  const [clientData, setClientData] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [varieties, setVarieties] = useState<any[]>([]);

  const [form, setForm] = useState({
    mode: "AIR" as "AIR" | "SEA",
    productId: "",
    varietyId: "",
    incoterm: "CIP",
    origin: "PTY",
    destination: "",
    boxes: 200,
    pallets: 1,
    caliber: "",
    color: "",
    shipmentDate: "",
    notes: ""
  });

  // --- CIERRE GARANTIZADO POR TECLADO ---
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // --- CONTROL DE ESTADO DEL MODAL ---
  useEffect(() => {
    if (!isOpen) {
      setForm({ mode: "AIR", productId: "", varietyId: "", incoterm: "CIP", origin: "PTY", destination: "", boxes: 200, pallets: 1, caliber: "", color: "", shipmentDate: "", notes: "" });
      setClientData(null);
      document.body.style.overflow = 'unset';
    } else {
      loadBaseData();
      detectClient();
      document.body.style.overflow = 'hidden';
    }
  }, [isOpen]);

  // Sincronizar Incoterm cuando cambia el modo de transporte
  useEffect(() => {
    const matrix = LOGISTICS_MATRIX[form.mode];
    setForm(prev => ({ ...prev, incoterm: matrix.defaultIncoterm }));
  }, [form.mode]);

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
      alert("Error: No se identificó tu cuenta de cliente.");
      return false;
    }
    if (!form.origin || !form.destination || !form.productId || !form.varietyId) {
      alert("Por favor completa los campos obligatorios.");
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
          product_id: form.productId,
          status: 'Solicitud',
          mode: form.mode,
          origin: form.origin,
          currency: 'USD',
          destination: form.destination,
          boxes: Number(form.boxes),
          margin_markup: 0,
          total: 0,
          client_snapshot: { name: clientData.name, tax_id: clientData.tax_id || "" },
          product_details: { 
            variety_id: form.varietyId,
            caliber: form.caliber,
            color: form.color,
            notes: form.notes,
            incoterm: form.incoterm,
            requested_shipment_date: form.shipmentDate
          }
        }]);
      if (error) throw error;
      
      // Feedback de éxito para el cliente
      alert("¡Solicitud enviada con éxito! Nuestro equipo la revisará en breve.");
      return true;
    } catch (e: any) {
      alert(`Error: ${e.message}`);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="ff-portal-wrapper" onClick={onClose}>
      
      <div className="ff-card-modal animate-in" onClick={(e) => e.stopPropagation()}>
        
        <div className="ff-header">
          <div>
            <span className="ff-tag">FRESH FOOD PANAMA</span>
            <h1>Solicitar Cotización</h1>
          </div>
          <button type="button" onClick={onClose} className="ff-close">
            <X size={22} />
          </button>
        </div>

        <div className="ff-scroll-content">
          
          {/* SECCIÓN 1: CLIENTE (Auto-detectado) */}
          <div className="ff-group">
            <label>1. INFORMACIÓN DE CUENTA</label>
            {loadingClient ? (
              <div className="ff-selected-box loading-box">
                <Loader2 className="animate-spin" size={24} color="#224C22" />
                <span>Identificando cuenta...</span>
              </div>
            ) : (
              <div className="ff-selected-box">
                <div className="ff-badge">
                  {clientData?.logo_url ? (
                    <img src={`https://oqgkbduqztrpfhfclker.supabase.co/storage/v1/object/public/client-logos/${clientData.logo_url}`} alt="logo" style={{width: '100%', height: '100%', objectFit: 'contain', borderRadius: '12px', padding: '2px'}} />
                  ) : (
                    clientData?.name?.charAt(0) || <User size={20}/>
                  )}
                </div>
                <div className="ff-meta">
                  <strong>{clientData?.name}</strong>
                  <span>Tax ID: {clientData?.tax_id || 'N/A'}</span>
                </div>
              </div>
            )}
          </div>

          {/* SECCIÓN 2: PRODUCTO (Con calibre y color) */}
          <div className="ff-group">
            <label>2. DETALLES DE PRODUCTO</label>
            <div className="ff-flex-row">
              <div className="ff-input-main flex-1">
                <Package size={18} />
                <select value={form.productId} onChange={e => setForm({...form, productId: e.target.value})}>
                  <option value="">¿Qué enviamos?</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <ChevronDown size={14} className="ff-arr" />
              </div>
              <div className={`ff-input-main flex-1 ${!form.productId ? 'off' : ''}`}>
                <Info size={18} />
                <select value={form.varietyId} onChange={e => setForm({...form, varietyId: e.target.value})} disabled={!form.productId}>
                  <option value="">Variedad</option>
                  {varieties.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                <ChevronDown size={14} className="ff-arr" />
              </div>
            </div>
            
            <div className="ff-grid-4">
              <div className="ff-boxed"><span>CAJAS</span><input type="number" value={form.boxes} onChange={e => setForm({...form, boxes: parseInt(e.target.value)||0})} /></div>
              <div className="ff-boxed"><span>PALLETS</span><input type="number" value={form.pallets} onChange={e => setForm({...form, pallets: parseInt(e.target.value)||0})} /></div>
              <div className="ff-boxed"><span>CALIBRE</span><input type="text" placeholder="Ej: 6, 8" value={form.caliber} onChange={e => setForm({...form, caliber: e.target.value})} /></div>
              <div className="ff-boxed"><span>COLOR</span><input type="text" placeholder="Ej: 2.5" value={form.color} onChange={e => setForm({...form, color: e.target.value})} /></div>
            </div>
          </div>

          {/* SECCIÓN 3: LOGÍSTICA & RUTAS */}
          <div className="ff-group">
            <label>3. LOGÍSTICA & RUTAS</label>
            <div className="ff-log-row">
              <div className="ff-toggle">
                <button type="button" className={form.mode === 'AIR' ? 'on a' : ''} onClick={() => setForm({...form, mode: 'AIR'})}><Plane size={16} /></button>
                <button type="button" className={form.mode === 'SEA' ? 'on s' : ''} onClick={() => setForm({...form, mode: 'SEA'})}><Ship size={16} /></button>
              </div>
              <div className="ff-input-main width-110">
                <select value={form.incoterm} onChange={e => setForm({...form, incoterm: e.target.value})}>
                  {LOGISTICS_MATRIX[form.mode].allowedIncoterms.map(inc => (
                    <option key={inc} value={inc}>{inc}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="ff-arr" />
              </div>
            </div>
            
            <div className="ff-routing-grid" key={form.mode}>
              <div className="ff-dest-wrap">
                 <div className="ff-badge-small origin-badge">ORIGEN</div>
                 <LocationSelector 
                    value={form.origin} 
                    onChange={(val) => setForm({...form, origin: val})} 
                    mode={form.mode} 
                  />
              </div>
              
              <div className="ff-route-connector">
                <ArrowRightIcon size={20} className="route-arrow" />
              </div>

              <div className="ff-dest-wrap">
                 <div className="ff-badge-small dest-badge">DESTINO</div>
                 <LocationSelector 
                    value={form.destination} 
                    onChange={(val) => setForm({...form, destination: val})} 
                    mode={form.mode} 
                 />
              </div>
            </div>
          </div>

          {/* SECCIÓN 4: FECHA Y NOTAS */}
          <div className="ff-group">
            <label>4. FECHA ESTIMADA DE EMBARQUE</label>
            <div className="ff-flex-row">
              <div className="ff-input-main flex-1">
                <Calendar size={18} />
                <input type="date" value={form.shipmentDate} onChange={e => setForm({...form, shipmentDate: e.target.value})} />
              </div>
              <div className="ff-input-main flex-2" style={{ paddingLeft: '18px' }}>
                <AlignLeft size={18} />
                <input type="text" placeholder="Instrucciones especiales, empaque, etc..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
              </div>
            </div>
          </div>

        </div>

        <div className="ff-footer">
          <button type="button" className="ff-btn-white" onClick={onClose}>
             Cancelar
          </button>
          
          <button type="button" className="ff-btn-primary" onClick={async () => { if(await saveToSystem()) onClose(); }} disabled={isSubmitting || !form.productId || !form.varietyId || !form.destination || !form.origin}>
            {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <><Send size={18}/> Enviar Solicitud</>}
          </button>
        </div>
      </div>

      <style>{`
        /* --- WRAPPER Y CIERRE --- */
        .ff-portal-wrapper { 
            position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; 
            z-index: 999999; padding: 20px; font-family: 'Poppins', sans-serif !important; 
            background: rgba(18, 30, 18, 0.6); backdrop-filter: blur(10px); 
            cursor: pointer; 
        }
        
        .ff-card-modal { 
            position: relative; background: #e6efe2; width: 100%; max-width: 850px; 
            border-radius: 30px; border: 2px solid #224C22; 
            box-shadow: 0 50px 100px -20px rgba(0,0,0,0.4); 
            display: flex; flex-direction: column; overflow: visible;
            cursor: default; 
        }

        .ff-header { padding: 35px 45px 20px; display: flex; justify-content: space-between; align-items: flex-start; }
        .ff-tag { color: #227432; font-size: 11px; font-weight: 800; letter-spacing: 2px; }
        .ff-card-modal h1 { font-size: 34px; font-weight: 800; color: #224C22; margin: 4px 0 0; letter-spacing: -1.5px; }
        
        .ff-close { 
            background: white; border: 2px solid #224C22; width: 44px; height: 44px; border-radius: 14px; 
            display: flex; align-items: center; justify-content: center; cursor: pointer; color: #224C22; transition: 0.2s; 
        }
        .ff-close:hover { background: #ef4444; color: white; border-color: #ef4444; transform: rotate(90deg); }

        .ff-scroll-content { padding: 0 45px 35px; display: flex; flex-direction: column; gap: 26px; overflow: visible; max-height: 70vh; overflow-y: auto; }
        
        /* Ocultar barra de scroll para estética limpia */
        .ff-scroll-content::-webkit-scrollbar { width: 6px; }
        .ff-scroll-content::-webkit-scrollbar-track { background: transparent; }
        .ff-scroll-content::-webkit-scrollbar-thumb { background: rgba(34, 76, 34, 0.2); border-radius: 10px; }

        .ff-group { display: flex; flex-direction: column; gap: 10px; position: relative; }
        .ff-group label { font-size: 11px; font-weight: 800; color: #224C22; opacity: 0.6; text-transform: uppercase; }

        .ff-flex-row { display: flex; gap: 12px; }
        
        .ff-input-main { 
            position: relative; background: white; border: 2px solid rgba(34, 76, 34, 0.15); 
            border-radius: 15px; height: 52px; display: flex; align-items: center; padding: 0 18px; color: #227432; transition: 0.2s;
        }
        .ff-input-main:focus-within { border-color: #227432; box-shadow: 0 0 0 4px rgba(34, 116, 50, 0.08); }
        .ff-input-main input, .ff-input-main select { 
            border: none !important; background: transparent !important; width: 100%; height: 100%; 
            outline: none !important; font-size: 15px; font-weight: 600; color: #224C22; padding-left: 12px;
            cursor: pointer;
        }
        .ff-input-main input[type="text"], .ff-input-main input[type="date"] { cursor: text; }
        .ff-arr { position: absolute; right: 18px; pointer-events: none; opacity: 0.5; }

        .ff-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .ff-boxed { background: white; border-radius: 15px; padding: 10px 18px; border: 2px solid rgba(34, 76, 34, 0.1); display: flex; flex-direction: column; transition: 0.2s; }
        .ff-boxed:focus-within { border-color: #227432; box-shadow: 0 0 0 4px rgba(34, 116, 50, 0.08); }
        .ff-boxed span { font-size: 9px; font-weight: 800; color: #227432; margin-bottom: 2px; }
        .ff-boxed input { border: none; outline: none; font-weight: 700; color: #224C22; font-size: 16px; width: 100%; background: transparent; }

        /* --- CLIENTE SELECCIONADO --- */
        .ff-selected-box { 
            display: flex; align-items: center; gap: 15px; padding: 14px 20px; 
            background: white; border: 2px solid #224C22; border-radius: 18px; 
            box-shadow: 0 10px 25px rgba(34, 76, 34, 0.05);
        }
        .loading-box { justify-content: center; background: rgba(255,255,255,0.5); border-style: dashed; color: #224C22; font-weight: 600; }
        .ff-badge { 
            width: 48px; height: 48px; background: #227432; color: white; 
            border-radius: 12px; display: flex; align-items: center; justify-content: center; 
            font-weight: 800; font-size: 20px; text-transform: uppercase; overflow: hidden;
        }
        .ff-meta { flex-grow: 1; display: flex; flex-direction: column; }
        .ff-meta strong { font-size: 16px; color: #224C22; font-weight: 800; }
        .ff-meta span { font-size: 12px; color: #227432; font-weight: 600; opacity: 0.8; }

        /* --- MENÚS DESPLEGABLES --- */
        .ff-dest-wrap [style*="absolute"], 
        .ff-dest-wrap [class*="menu"], 
        .ff-dest-wrap ul { 
            position: absolute !important; top: 110% !important; left: 0 !important; right: 0 !important; 
            background: white !important; border-radius: 18px !important; 
            border: 2px solid #224C22 !important; 
            box-shadow: 0 40px 100px -20px rgba(0,0,0,0.4) !important; 
            z-index: 9999 !important; overflow: hidden !important; margin-top: 8px !important;
        }

        .ff-log-row { display: flex; gap: 12px; align-items: center; margin-bottom: 6px; }
        .ff-toggle { background: white; padding: 5px; border-radius: 15px; border: 2px solid rgba(34, 76, 34, 0.15); display: flex; gap: 5px; }
        .ff-toggle button { width: 48px; height: 42px; border: none; border-radius: 10px; cursor: pointer; background: transparent; color: #224C22; opacity: 0.4; transition: 0.2s;}
        .ff-toggle button.on.a { background: #227432; color: white; opacity: 1; }
        .ff-toggle button.on.s { background: #224C22; color: white; opacity: 1; }
        
        .ff-routing-grid { display: flex; align-items: center; gap: 12px; width: 100%; }
        .ff-route-connector { color: #224C22; opacity: 0.4; display: flex; align-items: center; justify-content: center; }
        
        .ff-dest-wrap { 
            flex-grow: 1; background: white; border: 2px solid rgba(34, 76, 34, 0.15); 
            border-radius: 15px; height: 56px; display: flex; align-items: center; padding: 0 16px 0 12px; position: relative; transition: 0.2s;
        }
        .ff-dest-wrap:focus-within { border-color: #227432; box-shadow: 0 0 0 4px rgba(34, 116, 50, 0.08); }
        
        .ff-badge-small { 
            font-size: 9px; font-weight: 800; padding: 4px 8px; border-radius: 6px; margin-right: 12px; letter-spacing: 0.5px;
        }
        .origin-badge { background: rgba(34, 76, 34, 0.08); color: #224C22; }
        .dest-badge { background: #e6efe2; color: #227432; border: 1px solid rgba(34, 76, 34, 0.1); }
        
        .ff-dest-wrap input { 
            font-family: 'Poppins', sans-serif !important; border: none !important; outline: none !important; 
            font-weight: 700 !important; font-size: 15px !important; color: #224C22 !important; 
            width: 100% !important; background: transparent !important; padding: 0 !important; margin: 0 !important;
            box-shadow: none !important;
        }

        /* BOTONES DEL FOOTER RE-ESTRUCTURADOS */
        .ff-footer { padding: 25px 45px 40px; border-top: 1px solid rgba(34, 76, 34, 0.05); display: flex; justify-content: flex-end; gap: 15px; }
        
        .ff-btn-white { 
            flex: 1; background: transparent; border: 2px solid #224C22; color: #224C22; 
            height: 52px; border-radius: 15px; font-weight: 800; font-size: 15px; 
            cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; 
        }
        .ff-btn-white:hover:not(:disabled) { background: rgba(34, 76, 34, 0.05); transform: translateY(-2px);}
        .ff-btn-white:disabled { opacity: 0.5; cursor: not-allowed; }

        .ff-btn-primary { 
            flex: 1.5; background: #227432; color: white; border: none; 
            height: 52px; border-radius: 15px; font-weight: 800; font-size: 15px; 
            display: flex; align-items: center; justify-content: center; gap: 10px; 
            cursor: pointer; box-shadow: 0 8px 20px rgba(34, 116, 50, 0.3); transition: 0.3s; 
        }
        .ff-btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 25px rgba(34, 116, 50, 0.4); background: #1e662c;}
        .ff-btn-primary:disabled { background: #b0b0b0; cursor: not-allowed; box-shadow: none; }

        .animate-in { animation: ffIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes ffIn { from { opacity: 0; transform: translateY(30px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .flex-1 { flex: 1; } .flex-2 { flex: 2; } .off { opacity: 0.5; pointer-events: none; } .width-110 { width: 110px; }
      `}</style>
    </div>,
    document.body
  );
}