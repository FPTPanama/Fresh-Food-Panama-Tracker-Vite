import React, { useState, useEffect } from 'react';
import { 
  X, Plane, Ship, Package, MapPin, 
  Loader2, ArrowRight, Info, ChevronDown, Search, User, Hash
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { getApiBase } from '../../lib/apiBase';
import { LocationSelector } from '@/components/LocationSelector';

interface NewShipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialClientId?: string | null;
}

export function NewShipmentModal({ isOpen, onClose, onSuccess, initialClientId }: NewShipmentModalProps) {
  const [saving, setSaving] = useState(false);
  
  // Estados de Búsqueda Clientes (Restaurados)
  const [clientSearch, setClientSearch] = useState("");
  const [foundClients, setFoundClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientData, setClientData] = useState<any>(null);

  const [products, setProducts] = useState<any[]>([]);
  const [varieties, setVarieties] = useState<any[]>([]);

  const [form, setForm] = useState({
    mode: "AIR" as "AIR" | "SEA",
    productId: "",
    varietyId: "",
    destination: "",
    boxes: "",
    pallets: "",
    incoterm: "FOB" // Mantengo FOB como inicial según tu estado
  });

  useEffect(() => {
    if (!isOpen) {
      setForm({ mode: "AIR", productId: "", varietyId: "", destination: "", boxes: "", pallets: "", incoterm: "FOB" });
      setClientData(null);
      setSelectedClientId(null);
      setClientSearch("");
    } else {
      loadBaseData();
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

  // Lógica Buscador Clientes original
  useEffect(() => {
    if (clientSearch.length < 2) { setFoundClients([]); return; }
    const searchClients = async () => {
      const { data } = await supabase.from('clients').select('id, name, tax_id, logo_url').ilike('name', `%${clientSearch}%`).limit(5);
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
    if (!form.destination || !form.productId || !form.varietyId || !selectedClientId) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sesión expirada");
      const selectedVar = varieties.find(v => v.id === form.varietyId);
      const selectedProd = products.find(p => p.id === form.productId);

      const payload = {
        clientId: selectedClientId,
        destination: form.destination,
        incoterm: form.incoterm,
        boxes: parseInt(form.boxes) || 0,
        pallets: parseInt(form.pallets) || 0,
        product_name: selectedProd?.name,
        product_variety: selectedVar?.name,
        product_mode: form.mode === 'SEA' ? 'Marítima' : 'Aérea'
      };

      const res = await fetch(`${getApiBase()}/.netlify/functions/createShipment`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Error al crear el embarque');
      onSuccess?.();
      onClose();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="quote-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="quote-modal-card animate-in">
        <div className="modal-header">
          <div className="header-content">
            <span className="fresh-tag">Logística & Operaciones</span>
            <h1>Nuevo Embarque</h1>
          </div>
          <button onClick={onClose} className="close-btn"><X size={20}/></button>
        </div>

        <div className="modal-body">
          {/* 1. CLIENTE (RESTAURADO) */}
          <div className="row-wrapper" style={{ zIndex: 100 }}>
            <label className="row-subtitle">1. CLIENTE DEL EMBARQUE</label>
            {!selectedClientId ? (
              <div className="search-client-container">
                <div className="input-field full-row">
                  <Search size={16} className="field-icon" />
                  <input 
                    placeholder="Escribe el nombre del cliente para buscar..." 
                    value={clientSearch} 
                    onChange={(e) => setClientSearch(e.target.value)} 
                  />
                </div>
                {foundClients.length > 0 && (
                  <div className="search-results-overlay">
                    {foundClients.map(c => (
                      <div key={c.id} className="search-item" onClick={() => { setSelectedClientId(c.id); setClientData(c); setFoundClients([]); }}>
                        <User size={14} />
                        <div className="search-item-text">
                            <span className="name">{c.name}</span>
                            <span className="tax">{c.tax_id}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="client-card">
                <div className="client-avatar">
                  {clientData?.logo_url ? (
                    <img src={`https://oqgkbduqztrpfhfclker.supabase.co/storage/v1/object/public/client-logos/${clientData.logo_url}`} alt="logo" />
                  ) : <div className="avatar-fallback">{clientData?.name?.charAt(0)}</div>}
                </div>
                <div className="client-info">
                    <h3>{clientData?.name}</h3>
                    <p>Tax ID: <span>{clientData?.tax_id}</span></p>
                </div>
                <button className="change-client-btn" onClick={() => {setSelectedClientId(null); setClientData(null); setClientSearch("");}}>Cambiar</button>
              </div>
            )}
          </div>

          {/* 2. CARGA */}
          <div className="row-wrapper">
            <label className="row-subtitle">2. ESPECIFICACIONES DE CARGA</label>
            <div className="product-row">
              <div className="input-field flex-3">
                <Package size={16} className="field-icon" />
                <select value={form.productId} onChange={e => setForm({...form, productId: e.target.value, varietyId: ""})}>
                  <option value="">Producto</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <ChevronDown size={14} className="field-arrow" />
              </div>
              <div className={`input-field flex-3 ${!form.productId ? 'disabled' : ''}`}>
                <Info size={16} className="field-icon" />
                <select value={form.varietyId} onChange={e => setForm({...form, varietyId: e.target.value})} disabled={!form.productId}>
                  <option value="">Variedad</option>
                  {varieties.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                <ChevronDown size={14} className="field-arrow" />
              </div>
              <div className="input-field flex-1 has-label"><span className="field-label">CAJAS</span><input type="number" value={form.boxes} onChange={e => setForm({...form, boxes: e.target.value})} /></div>
              <div className="input-field flex-1 has-label"><span className="field-label">PALLETS</span><input type="number" value={form.pallets} onChange={e => setForm({...form, pallets: e.target.value})} /></div>
            </div>
          </div>

          {/* 3. LOGÍSTICA & DESTINO */}
          <div className="row-wrapper" style={{ zIndex: 90 }}>
            <label className="row-subtitle">3. LOGÍSTICA & DESTINO</label>
            <div className="logistics-row">
              <div className="mode-toggle-compact">
                <button className={form.mode === 'AIR' ? 'active air' : ''} onClick={() => setForm({...form, mode: 'AIR', destination: ""})}>
                  <Plane size={14} />
                </button>
                <button className={form.mode === 'SEA' ? 'active sea' : ''} onClick={() => setForm({...form, mode: 'SEA', destination: ""})}>
                  <Ship size={14} />
                </button>
              </div>

              {/* REEMPLAZO: PESO POR INCOTERM */}
              <div className="input-field width-140 has-label">
                <span className="field-label">INCOTERM</span>
                <select value={form.incoterm} onChange={e => setForm({...form, incoterm: e.target.value})}>
                  <option>CIP</option>
                  <option>FOB</option>
                  <option>CFR</option>
                  <option>DDP</option>
                </select>
                <ChevronDown size={14} className="field-arrow" />
              </div>

              <div className="input-field flex-grow">
                <MapPin size={16} className="field-icon z-elevated" />
                <div className="location-container">
                  <LocationSelector 
                    value={form.destination} 
                    onChange={(val) => setForm({...form, destination: val})} 
                    mode={form.mode} 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleCreate} disabled={saving || !form.productId || !form.varietyId || !form.destination || !selectedClientId}>
            {saving ? <Loader2 className="animate-spin" /> : <>Confirmar Embarque <ArrowRight size={18}/></>}
          </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .quote-modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px; }
        .quote-modal-card { background: white; width: 100%; max-width: 900px; border-radius: 32px; box-shadow: 0 40px 80px -15px rgba(0,0,0,0.3); position: relative; }
        .modal-header { padding: 40px 45px 15px; display: flex; justify-content: space-between; align-items: flex-start; }
        .fresh-tag { color: #10b981; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px; display: block; }
        .modal-header h1 { font-size: 30px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -1.2px; }
        .close-btn { background: #f8fafc; border: none; width: 44px; height: 44px; border-radius: 50%; cursor: pointer; color: #64748b; display: flex; align-items: center; justify-content: center; }
        
        .modal-body { padding: 15px 45px 45px; display: flex; flex-direction: column; gap: 32px; }
        .row-wrapper { display: flex; flex-direction: column; gap: 14px; position: relative; }
        .row-subtitle { font-size: 11px; font-weight: 800; color: #94a3b8; letter-spacing: 0.8px; text-transform: uppercase; }

        .search-client-container { position: relative; width: 100%; }
        .search-results-overlay { 
          position: absolute; top: 100%; left: 0; right: 0; background: white; 
          border-radius: 16px; border: 1.5px solid #e2e8f0; margin-top: 8px; z-index: 999; 
          box-shadow: 0 20px 40px rgba(0,0,0,0.1); overflow: hidden; max-height: 250px; overflow-y: auto;
        }
        .search-item { padding: 12px 20px; display: flex; align-items: center; gap: 15px; cursor: pointer; border-bottom: 1px solid #f1f5f9; transition: 0.2s; }
        .search-item:hover { background: #f8fafc; color: #10b981; }
        .search-item-text { display: flex; flex-direction: column; }
        .search-item-text .name { font-weight: 700; font-size: 14px; color: #1e293b; }
        .search-item-text .tax { font-size: 11px; color: #94a3b8; }

        .client-card { display: flex; align-items: center; gap: 20px; padding: 18px 25px; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 24px; }
        .client-avatar { width: 52px; height: 52px; border-radius: 16px; background: white; border: 1px solid #e2e8f0; overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .client-avatar img { width: 100%; height: 100%; object-fit: contain; padding: 4px; }
        .avatar-fallback { background: #10b981; color: white; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; }
        .client-info h3 { margin: 0; font-size: 19px; font-weight: 800; color: #1e293b; }
        .client-info p { margin: 2px 0 0; font-size: 13px; color: #64748b; font-weight: 600; }
        .client-info span { color: #10b981; font-family: monospace; }
        .change-client-btn { margin-left: auto; padding: 8px 16px; background: white; border: 1.5px solid #e2e8f0; border-radius: 10px; font-weight: 700; font-size: 12px; color: #64748b; cursor: pointer; }

        .product-row, .logistics-row { display: flex; gap: 12px; height: 58px; }
        .input-field { position: relative; display: flex; align-items: center; background: white; border: 1.5px solid #e2e8f0; border-radius: 16px; transition: 0.2s; }
        .input-field.full-row { width: 100%; height: 58px; }
        .input-field select, .input-field input { width: 100%; height: 100%; padding: 0 15px 0 45px; border: none; background: transparent !important; font-size: 14px; font-weight: 700; color: #1e293b; outline: none; appearance: none; }
        
        .location-container { flex-grow: 1; height: 100%; display: flex; align-items: center; width: 100%; position: relative; }
        .location-container input { padding-left: 45px !important; background: transparent !important; border: none !important; }
        .z-elevated { z-index: 10; }

        .field-icon { position: absolute; left: 16px; color: #94a3b8; pointer-events: none; }
        .field-arrow { position: absolute; right: 16px; color: #94a3b8; pointer-events: none; }

        .mode-toggle-compact { background: #f1f5f9; padding: 4px; border-radius: 14px; display: flex; gap: 4px; border: 1.5px solid #e2e8f0; }
        .mode-toggle-compact button { border: none; width: 46px; height: 100%; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #94a3b8; background: transparent; transition: 0.2s; }
        .mode-toggle-compact button.active.air { background: #10b981; color: white; }
        .mode-toggle-compact button.active.sea { background: #3b82f6; color: white; }

        .flex-3 { flex: 3; } .flex-grow { flex-grow: 1; } .width-140 { width: 140px; } .flex-1 { flex: 1.2; }
        .input-field.has-label { padding-top: 14px; }
        /* AJUSTE PARA EL SELECT DEL INCOTERM SIN ICONO IZQUIERDO */
        .input-field.has-label select, .input-field.has-label input { padding-left: 15px; }
        .field-label { position: absolute; top: 8px; left: 15px; font-size: 9px; font-weight: 900; color: #94a3b8; text-transform: uppercase; pointer-events: none; }
        .disabled { background: #f8fafc; opacity: 0.6; pointer-events: none; }

        .modal-footer { padding: 30px 45px 40px; border-top: 1px solid #f1f5f9; display: flex; justify-content: flex-end; gap: 16px; }
        .btn-secondary { padding: 14px 28px; border-radius: 16px; border: 1.5px solid #e2e8f0; background: white; font-weight: 700; color: #64748b; cursor: pointer; }
        .btn-primary { background: linear-gradient(135deg, #f97316, #ea580c); color: white; border: none; padding: 14px 38px; border-radius: 16px; font-weight: 800; font-size: 15px; display: flex; align-items: center; gap: 12px; cursor: pointer; box-shadow: 0 10px 25px -5px rgba(249, 115, 22, 0.4); }
        .btn-primary:disabled { background: #e2e8f0; color: #94a3b8; box-shadow: none; cursor: not-allowed; }

        .animate-in { animation: modalSpring 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes modalSpring { from { opacity: 0; transform: translateY(30px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      ` }} />
    </div>
  );
}