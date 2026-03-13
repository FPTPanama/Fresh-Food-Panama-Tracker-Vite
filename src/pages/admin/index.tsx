import React, { useState, useEffect, useMemo } from 'react';
// Rutas corregidas a dos niveles de profundidad
import { supabase } from "../../lib/supabaseClient";
import { getApiBase } from "../../lib/apiBase";
import { AdminLayout } from "../../components/AdminLayout";
import { LocationSelector } from "../../components/LocationSelector";
import { 
  FilePlus, Zap, User, Globe, X, Search, Box, 
  MapPin, Check, Loader2, Tag, Plane, Ship, ChevronRight 
} from "lucide-react";

// --- Tipado de Cliente ---
interface ClientItem {
  id: string;
  name: string;
  contact_email: string;
  tax_id?: string;
}

export default function AdminDashboard() {
  const [mounted, setMounted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Estados de Datos
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // UI States
  const [clientQuery, setClientQuery] = useState("");
  const [showClients, setShowClients] = useState(false);
  const [selectedProductName, setSelectedProductName] = useState("");

  const [formData, setFormData] = useState({
    client_id: '',
    product_id: '',
    variety: '',
    mode: 'AIR' as 'AIR' | 'SEA',
    terms: 'CIP',
    destination: '',
    boxes: 200
  });

  useEffect(() => {
    setMounted(true);
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      // 1. Obtener Clientes (Netlify Function)
      const resClients = await fetch(`${getApiBase()}/.netlify/functions/listClients`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const clientsJson = await resClients.json();
      const clientList = Array.isArray(clientsJson) ? clientsJson : (clientsJson.items || []);
      
      // 2. Obtener Productos (Supabase Directo)
      const { data: products } = await supabase.from('products').select('id, name, variety');

      setClients(clientList);
      setDbProducts(products || []);
    } catch (e) {
      console.error("Error al cargar datos maestros:", e);
    } finally {
      setLoading(false);
    }
  }

  // --- Lógica de Filtrado y Memoize ---
  const filteredClients = useMemo(() => {
    const q = clientQuery.toLowerCase();
    return clients.filter(c => 
      (c.name?.toLowerCase().includes(q)) || 
      (c.contact_email?.toLowerCase().includes(q))
    );
  }, [clients, clientQuery]);

  const uniqueProductNames = useMemo(() => {
    return Array.from(new Set(dbProducts.map(p => p.name)));
  }, [dbProducts]);

  const availableVarieties = useMemo(() => {
    return dbProducts
      .filter(p => p.name === selectedProductName)
      .map(p => ({ id: p.id, variety: p.variety }));
  }, [selectedProductName, dbProducts]);

  const handleCreate = async () => {
    if (!formData.client_id || !formData.destination) return alert("Faltan campos por completar");
    
    setSaving(true);
    try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const client = clients.find(c => c.id === formData.client_id);

        const res = await fetch(`${getApiBase()}/.netlify/functions/createQuote`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              ...formData,
              boxes: Number(formData.boxes),
              margin_markup: 15,
              client_snapshot: { 
                name: client?.name, 
                contact_email: client?.contact_email, 
                tax_id: client?.tax_id 
              },
              status: "draft",
              costs: { c_fruit: 0, c_freight: 0, c_origin: 0, c_aduana: 0, c_insp: 0, c_doc: 0, c_tax: 0, c_other: 0 },
              totals: { total: 0, meta: { pallets: 0, incoterm: formData.terms, place: formData.destination } }
            }),
        });
        
        const result = await res.json();
        if (res.ok) {
            window.location.href = `/admin/quotes/${result.id}`;
        } else {
            throw new Error(result.error);
        }
    } catch (e: any) {
        alert("Error al crear: " + e.message);
    } finally {
        setSaving(false);
    }
  };

  if (!mounted) return null;

  return (
    <AdminLayout title="Panel Administrativo">
      <div className="p-10">
        <button className="btn-trigger" onClick={() => setIsModalOpen(true)}>
          <FilePlus size={18} /> NUEVA COTIZACIÓN <Zap size={14} fill="#bef264" />
        </button>

        {isModalOpen && (
          <div className="glass-overlay">
            <div className="elite-modal">
              <div className="modal-header">
                <div>
                  <h3>Nueva Cotización</h3>
                  <p>Inicia un borrador con datos reales</p>
                </div>
                <button className="btn-close" onClick={() => setIsModalOpen(false)}><X size={20}/></button>
              </div>

              <div className="modal-body">
                {/* BUSCADOR DE CLIENTE */}
                <div className="input-group">
                  <label><User size={12}/> CLIENTE</label>
                  <div className={`custom-search ${formData.client_id ? 'selected' : ''}`}>
                    <Search size={18} className="icon" />
                    <input 
                      placeholder="Buscar por nombre o email..." 
                      value={clientQuery}
                      onChange={(e) => { setClientQuery(e.target.value); setShowClients(true); }}
                      onFocus={() => setShowClients(true)}
                    />
                    {formData.client_id && <Check size={18} className="check-icon" />}

                    {showClients && clientQuery.length > 0 && (
                      <div className="results-dropdown">
                        {filteredClients.length > 0 ? filteredClients.map(c => (
                          <div key={c.id} className="result-item" onMouseDown={() => {
                            setFormData({...formData, client_id: c.id});
                            setClientQuery(c.name);
                            setShowClients(false);
                          }}>
                            <div className="info">
                              <strong>{c.name}</strong>
                              <span>{c.contact_email}</span>
                            </div>
                            <ChevronRight size={14} />
                          </div>
                        )) : <div className="result-item muted">No se encontraron clientes</div>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid-2">
                  <div className="input-group">
                    <label><Box size={12}/> PRODUCTO</label>
                    <div className="select-wrapper">
                      <select 
                        value={selectedProductName}
                        onChange={(e) => { 
                          setSelectedProductName(e.target.value); 
                          setFormData({...formData, product_id: ''}); 
                        }}
                      >
                        <option value="">Seleccione...</option>
                        {uniqueProductNames.map(name => <option key={name} value={name}>{name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="input-group">
                    <label><Tag size={12}/> VARIEDAD</label>
                    <div className="select-wrapper">
                      <select 
                        disabled={!selectedProductName}
                        value={formData.product_id}
                        onChange={(e) => setFormData({...formData, product_id: e.target.value})}
                      >
                        <option value="">Seleccione variedad...</option>
                        {availableVarieties.map(v => <option key={v.id} value={v.id}>{v.variety}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="input-group">
                  <label>MODALIDAD DE ENVÍO</label>
                  <div className="mode-toggle">
                    <button className={formData.mode === 'AIR' ? 'active' : ''} onClick={() => setFormData({...formData, mode: 'AIR'})}>
                      <Plane size={14}/> AÉREO
                    </button>
                    <button className={formData.mode === 'SEA' ? 'active' : ''} onClick={() => setFormData({...formData, mode: 'SEA'})}>
                      <Ship size={14}/> MARÍTIMO
                    </button>
                  </div>
                </div>

                <div className="input-group">
                  <label><MapPin size={12}/> DESTINO</label>
                  <LocationSelector 
                    value={formData.destination} 
                    onChange={(val) => setFormData({...formData, destination: val})} 
                    mode={formData.mode} 
                  />
                </div>

                <div className="modal-footer">
                  <div className="box-counter">
                    <label>CAJAS</label>
                    <input 
                      type="number" 
                      value={formData.boxes} 
                      onChange={e => setFormData({...formData, boxes: parseInt(e.target.value) || 0})} 
                    />
                  </div>
                  <button 
                    className="btn-finalize" 
                    onClick={handleCreate} 
                    disabled={saving || !formData.client_id || !formData.destination}
                  >
                    {saving ? <Loader2 className="animate-spin" size={20}/> : <>CREAR BORRADOR <Zap size={16} fill="white" /></>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .btn-trigger { background: #1e293b; color: white; padding: 14px 28px; border: none; border-radius: 18px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 12px; }
        .glass-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(10px); z-index: 9999; display: flex; align-items: center; justify-content: center; }
        .elite-modal { background: white; width: 500px; border-radius: 32px; padding: 35px; box-shadow: 0 50px 100px -20px rgba(0,0,0,0.25); }
        .modal-header { display: flex; justify-content: space-between; margin-bottom: 25px; }
        .modal-header h3 { font-size: 1.5rem; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -1px; }
        .modal-header p { font-size: 0.85rem; color: #64748b; margin-top: 4px; font-weight: 600; }
        .btn-close { background: #f1f5f9; border: none; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; color: #94a3b8; }
        .input-group { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; position: relative; }
        .input-group label { font-size: 10px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
        .custom-search { display: flex; align-items: center; background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 16px; padding: 0 16px; transition: 0.3s; }
        .custom-search.selected { border-color: #16a34a; background: #f0fdf4; }
        .custom-search input { border: none; background: transparent; padding: 14px 10px; width: 100%; outline: none; font-weight: 700; color: #1e293b; font-size: 14px; }
        .icon { color: #cbd5e1; }
        .check-icon { color: #16a34a; }
        .results-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: white; border-radius: 18px; margin-top: 8px; z-index: 100; padding: 8px; box-shadow: 0 20px 40px rgba(0,0,0,0.15); border: 1px solid #f1f5f9; max-height: 200px; overflow-y: auto; }
        .result-item { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-radius: 12px; cursor: pointer; }
        .result-item:hover { background: #f1f5f9; }
        .result-item .info { display: flex; flex-direction: column; }
        .result-item strong { font-size: 13px; color: #1e293b; }
        .result-item span { font-size: 11px; color: #94a3b8; }
        .grid-2 { display: grid; grid-template-cols: 1fr 1fr; gap: 16px; }
        .select-wrapper { display: flex; align-items: center; background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 16px; padding: 0 12px; }
        .select-wrapper select { border: none; background: transparent; padding: 14px 5px; width: 100%; outline: none; font-weight: 700; color: #1e293b; appearance: none; cursor: pointer; }
        .mode-toggle { display: flex; background: #f1f5f9; padding: 5px; border-radius: 14px; gap: 5px; }
        .mode-toggle button { flex: 1; border: none; padding: 10px; border-radius: 10px; cursor: pointer; font-weight: 800; font-size: 12px; color: #64748b; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .mode-toggle button.active { background: white; color: #0f172a; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
        .modal-footer { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 20px; border-top: 1px solid #f1f5f9; margin-top: 10px; }
        .box-counter input { width: 90px; background: #f0fdf4; border: 2px solid #dcfce7; border-radius: 16px; padding: 12px; text-align: center; font-weight: 900; font-size: 1.4rem; color: #16a34a; outline: none; }
        .btn-finalize { background: #16a34a; color: white; border: none; padding: 18px 30px; border-radius: 20px; font-weight: 900; cursor: pointer; display: flex; align-items: center; gap: 10px; }
        .btn-finalize:disabled { background: #cbd5e1; cursor: not-allowed; }
      `}</style>
    </AdminLayout>
  );
}