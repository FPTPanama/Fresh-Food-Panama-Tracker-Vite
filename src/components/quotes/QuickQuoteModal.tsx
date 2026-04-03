import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Plane, Ship, Package, MapPin, 
  Loader2, ArrowRight, Info, ChevronDown, Search, User,
  ArrowRight as ArrowRightIcon
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { LocationSelector } from '@/components/LocationSelector';
import { notify } from '@/components/AdminLayout';

interface QuickQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialClientId?: string | null;
}

export function QuickQuoteModal({ isOpen, onClose, initialClientId }: QuickQuoteModalProps) {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [foundClients, setFoundClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientData, setClientData] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [varieties, setVarieties] = useState<any[]>([]);

  // FIX: Agregamos 'origin' al estado inicial del formulario
  const [form, setForm] = useState({
    mode: "AIR" as "AIR" | "SEA",
    productId: "",
    varietyId: "",
    incoterm: "CIP",
    origin: "PTY", // Valor por defecto
    destination: "",
    boxes: 200,
    pallets: 1,
    caliber: "",
    color: "" 
  });

  // --- CIERRE GARANTIZADO POR TECLADO ---
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setForm({ mode: "AIR", productId: "", varietyId: "", incoterm: "CIP", origin: "PTY", destination: "", boxes: 200, pallets: 1, caliber: "", color: "" });
      setClientData(null);
      setSelectedClientId(null);
      setClientSearch("");
      document.body.style.overflow = 'unset';
    } else {
      loadBaseData();
      document.body.style.overflow = 'hidden';
      if (initialClientId) {
        setSelectedClientId(initialClientId);
        fetchSingleClient(initialClientId);
      }
    }
  }, [isOpen, initialClientId]);

  async function loadBaseData() {
    const { data: prodData } = await supabase.from('products').select('id, name').order('name');
    if (prodData) setProducts(prodData);
  }

  useEffect(() => {
    if (clientSearch.length < 2) { setFoundClients([]); return; }
    const searchClients = async () => {
      const { data } = await supabase.from('clients').select('id, name, tax_id, logo_url, contact_email').ilike('name', `%${clientSearch}%`).limit(5);
      setFoundClients(data || []);
    };
    const timeout = setTimeout(searchClients, 300);
    return () => clearTimeout(timeout);
  }, [clientSearch]);

  async function fetchSingleClient(id: string) {
    const { data } = await supabase.from('clients').select('*').eq('id', id).maybeSingle();
    if (data) setClientData(data);
  }

  useEffect(() => {
    async function fetchVarieties() {
      if (!form.productId) { setVarieties([]); return; }
      const { data } = await supabase.from('product_varieties').select('id, name').eq('product_id', form.productId);
      setVarieties(data || []);
    }
    fetchVarieties();
  }, [form.productId]);

  const handleCreate = async () => {
    if (!form.origin || !form.destination || !form.productId || !form.varietyId || !selectedClientId) {
      return notify("Completa los campos obligatorios", "error");
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesión expirada");
      
      // FIX: Aseguramos enviar form.origin en el insert
      const { data: quote, error } = await supabase.from('quotes').insert([{
        created_by: user.id,
        client_id: selectedClientId,
        product_id: form.productId,
        mode: form.mode,
        origin: form.origin, // Dato guardado en BD
        destination: form.destination,
        boxes: Number(form.boxes),
        currency: 'USD',
        status: 'draft',
        margin_markup: 15,
        costs: { c_fruit: 13.30, s_fruit: 0, c_freight: 0, s_freight: 0, c_origin: 0, s_origin: 0, c_aduana: 0, s_aduana: 0, c_insp: 0, s_insp: 0, c_itbms: 0, s_itbms: 0, c_handling: 0, s_handling: 0, c_other: 0, s_other: 0 }, 
        client_snapshot: { name: clientData?.name, tax_id: clientData?.tax_id, email: clientData?.contact_email },
        product_details: { 
            product_name: products.find(p=>p.id===form.productId)?.name, 
            variety_name: varieties.find(v=>v.id===form.varietyId)?.name, 
            variety_id: form.varietyId, caliber: form.caliber, color: form.color 
        },
        totals: { total: 0, meta: { incoterm: form.incoterm, variety_id: form.varietyId, pallets: Number(form.pallets) } }
      }]).select().single();

      if (error) throw error;
      notify("Cotización creada", "success");
      onClose();
      navigate(`/admin/quotes/${quote.id}`);
    } catch (e: any) { notify(e.message || "Error", "error"); } 
    finally { setSaving(false); }
  };

  if (!isOpen) return null;

  return createPortal(
    // 1. CIERRE BLINDADO
    <div className="ff-portal-wrapper" onClick={onClose}>
      
      {/* 2. PREVENCIÓN DE CIERRE */}
      <div className="ff-card-modal animate-in" onClick={(e) => e.stopPropagation()}>
        
        <div className="ff-header">
          <div>
            <span className="ff-tag">OPERACIONES GLOBALES</span>
            <h1>Nueva Cotización</h1>
          </div>
          <button type="button" onClick={onClose} className="ff-close">
            <X size={22} />
          </button>
        </div>

        <div className="ff-scroll-content">
          {/* SECCIÓN 1: CLIENTE */}
          <div className="ff-group">
            <label>1. CLIENTE DESTINO</label>
            {!selectedClientId ? (
              <div className="ff-search-rel">
                <div className="ff-input-main">
                  <Search size={18} />
                  <input placeholder="Escribe el nombre del cliente..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} autoFocus />
                </div>
                {foundClients.length > 0 && (
                  <div className="ff-drop-results">
                    {foundClients.map(c => (
                      <div key={c.id} className="ff-item" onClick={() => { setSelectedClientId(c.id); setClientData(c); setFoundClients([]); }}>
                        <User size={14} />
                        <div><p className="m">{c.name}</p><p className="s">{c.tax_id}</p></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="ff-selected-box">
                <div className="ff-badge">{clientData?.name?.charAt(0) || <User size={20}/>}</div>
                <div className="ff-meta">
                  <strong>{clientData?.name}</strong>
                  <span>Tax ID: {clientData?.tax_id}</span>
                </div>
                <button type="button" className="ff-btn-change" onClick={() => {setSelectedClientId(null); setClientData(null);}}>Cambiar</button>
              </div>
            )}
          </div>

          {/* SECCIÓN 2: PRODUCTO */}
          <div className="ff-group">
            <label>2. DETALLES DE PRODUCTO</label>
            <div className="ff-flex-row">
              <div className="ff-input-main flex-1">
                <Package size={18} />
                <select value={form.productId} onChange={e => setForm({...form, productId: e.target.value})}>
                  <option value="">Producto</option>
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

          {/* SECCIÓN 3: LOGÍSTICA & RUTAS (Modificado para Origen Dinámico) */}
          <div className="ff-group">
            <label>3. LOGÍSTICA & RUTAS</label>
            <div className="ff-log-row">
              <div className="ff-toggle">
                <button type="button" className={form.mode === 'AIR' ? 'on a' : ''} onClick={() => setForm({...form, mode: 'AIR'})}><Plane size={16} /></button>
                <button type="button" className={form.mode === 'SEA' ? 'on s' : ''} onClick={() => setForm({...form, mode: 'SEA'})}><Ship size={16} /></button>
              </div>
              <div className="ff-input-main width-110">
                <select value={form.incoterm} onChange={e => setForm({...form, incoterm: e.target.value})}><option>CIP</option><option>FOB</option><option>CFR</option><option>DDP</option></select>
                <ChevronDown size={12} className="ff-arr" />
              </div>
            </div>
            
            {/* FIX: Doble selector de locación (Origen -> Destino) */}
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
        </div>

        <div className="ff-footer">
          <button type="button" className="ff-btn-white" onClick={onClose}>Cancelar</button>
          <button type="button" className="ff-btn-orange" onClick={handleCreate} disabled={saving || !form.productId || !form.varietyId || !form.destination || !form.origin || !selectedClientId}>
            {saving ? <Loader2 className="animate-spin" /> : <>Crear Borrador <ArrowRight size={18}/></>}
          </button>
        </div>
      </div>

      <style>{`
        /* --- WRAPPER Y CIERRE --- */
        .ff-portal-wrapper { 
            position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; 
            z-index: 999999; padding: 20px; font-family: 'Poppins', sans-serif !important; 
            background: rgba(18, 30, 18, 0.45); backdrop-filter: blur(10px); 
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

        .ff-scroll-content { padding: 0 45px 35px; display: flex; flex-direction: column; gap: 26px; overflow: visible; }
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
        }
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
            box-shadow: 0 10px 25px rgba(34, 76, 34, 0.1);
        }
        .ff-badge { 
            width: 48px; height: 48px; background: #227432; color: white; 
            border-radius: 12px; display: flex; align-items: center; justify-content: center; 
            font-weight: 800; font-size: 20px; text-transform: uppercase;
        }
        .ff-meta { flex-grow: 1; display: flex; flex-direction: column; }
        .ff-meta strong { font-size: 16px; color: #224C22; font-weight: 800; }
        .ff-meta span { font-size: 12px; color: #227432; font-weight: 600; opacity: 0.8; }
        .ff-btn-change { 
            background: #e6efe2; border: 1px solid #224C22; color: #224C22; 
            padding: 8px 16px; border-radius: 12px; font-weight: 700; font-size: 12px; 
            cursor: pointer; transition: 0.2s; 
        }
        .ff-btn-change:hover { background: #224C22; color: white; }

        /* --- MENÚS DESPLEGABLES --- */
        .ff-search-rel { position: relative; }
        
        .ff-drop-results, 
        .ff-dest-wrap [style*="absolute"], 
        .ff-dest-wrap [class*="menu"], 
        .ff-dest-wrap ul { 
            position: absolute !important; top: 110% !important; left: 0 !important; right: 0 !important; 
            background: white !important; border-radius: 18px !important; 
            border: 2px solid #224C22 !important; 
            box-shadow: 0 40px 100px -20px rgba(0,0,0,0.4) !important; 
            z-index: 9999 !important; overflow: hidden !important; margin-top: 8px !important;
        }
        
        .ff-item { padding: 14px 20px; display: flex; align-items: center; gap: 15px; cursor: pointer; border-bottom: 1px solid #f0f4ef; }
        .ff-item:hover { background: #f0f4ef; }
        .ff-item .m { font-weight: 700; font-size: 14px; margin: 0; color: #224C22; }
        .ff-item .s { font-size: 11px; opacity: 0.5; margin: 0; }

        .ff-log-row { display: flex; gap: 12px; align-items: center; margin-bottom: 6px; }
        .ff-toggle { background: white; padding: 5px; border-radius: 15px; border: 2px solid rgba(34, 76, 34, 0.15); display: flex; gap: 5px; }
        .ff-toggle button { width: 48px; height: 42px; border: none; border-radius: 10px; cursor: pointer; background: transparent; color: #224C22; opacity: 0.4; }
        .ff-toggle button.on.a { background: #227432; color: white; opacity: 1; }
        .ff-toggle button.on.s { background: #224C22; color: white; opacity: 1; }
        
        /* NUEVO: ESTRUCTURA DE RUTA (ORIGEN -> DESTINO) */
        .ff-routing-grid {
            display: flex; align-items: center; gap: 12px; width: 100%;
        }
        
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

        .ff-footer { padding: 25px 45px 40px; border-top: 1px solid rgba(34, 76, 34, 0.05); display: flex; justify-content: flex-end; gap: 15px; }
        .ff-btn-white { background: transparent; border: 2px solid #224C22; color: #224C22; padding: 0 30px; height: 50px; border-radius: 15px; font-weight: 700; cursor: pointer; transition: 0.2s; }
        .ff-btn-white:hover { background: rgba(34, 76, 34, 0.05); }
        .ff-btn-orange { background: #D17711; color: white; border: none; padding: 0 45px; height: 50px; border-radius: 15px; font-weight: 800; font-size: 16px; display: flex; align-items: center; gap: 12px; cursor: pointer; box-shadow: 0 8px 20px rgba(209, 119, 17, 0.3); transition: 0.3s; }
        .ff-btn-orange:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 25px rgba(209, 119, 17, 0.4); }
        .ff-btn-orange:disabled { background: #b0b0b0; cursor: not-allowed; box-shadow: none; }

        .animate-in { animation: ffIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes ffIn { from { opacity: 0; transform: translateY(30px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .flex-1 { flex: 1; } .off { opacity: 0.5; pointer-events: none; } .width-110 { width: 110px; }
      `}</style>
    </div>,
    document.body
  );
}