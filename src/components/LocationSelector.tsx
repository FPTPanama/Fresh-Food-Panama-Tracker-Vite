import { useState, useEffect, useRef } from "react";
import { Plus, Plane, Ship, Loader2, MapPin } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

interface Location {
  id?: string;
  code: string;
  name: string;
  city: string;
  country: string;
  type: "AIR" | "SEA";
}

export function LocationSelector({ 
  value, 
  onChange, 
  mode 
}: { 
  value: string, 
  onChange: (val: string) => void, 
  mode: "AIR" | "SEA" 
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Location[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sincronización inicial: Si recibimos un código, buscamos su nombre para mostrarlo
  useEffect(() => {
    if (value && query === "") {
      const fetchCurrent = async () => {
        const { data } = await supabase
          .from('master_locations')
          .select('name, code')
          .eq('code', value)
          .maybeSingle();
        if (data) setQuery(`${data.code} - ${data.name}`);
      };
      fetchCurrent();
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchLocations = async (q: string) => {
    setQuery(q);
    if (q.length < 2) { 
      setResults([]); 
      setIsOpen(false);
      return; 
    }
    
    setLoading(true);
    setIsOpen(true);
    
    const { data } = await supabase
      .from('master_locations')
      .select('*')
      .eq('type', mode)
      .or(`name.ilike.%${q}%,code.ilike.%${q}%,city.ilike.%${q}%,country.ilike.%${q}%`)
      .limit(6);

    setResults((data as Location[]) || []);
    setLoading(false);
  };

  const handleSelect = (loc: Location) => {
    setQuery(`${loc.code} - ${loc.name}`);
    onChange(loc.code); 
    setIsOpen(false);
  };

  const createNewLocation = async () => {
    if (!query) return;
    setLoading(true);
    const tempCode = "MAN-" + query.substring(0, 3).toUpperCase(); 
    
    const { data, error } = await supabase
      .from('master_locations')
      .insert([{
        code: tempCode,
        name: query,
        city: 'Manual',
        country: 'Destino Nuevo',
        type: mode
      }])
      .select();

    setLoading(false);
    if (!error && data) handleSelect(data[0]);
  };

  return (
    <div className="ff-location-wrapper" ref={wrapperRef}>
      <div className="ff-location-input-group">
        <div className="ff-location-icon-prefix">
          {mode === 'AIR' ? <Plane size={16} /> : <Ship size={16} />}
        </div>
        <input 
          type="text" 
          value={query} 
          onChange={(e) => searchLocations(e.target.value)}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          placeholder={mode === 'AIR' ? "Buscar Aeropuerto..." : "Buscar Puerto..."}
        />
        {loading && <Loader2 size={14} className="ff-spin" />}
      </div>

      {isOpen && (
        <div className="ff-location-dropdown">
          {results.map((loc) => (
            <div key={loc.code} className="ff-location-option" onClick={() => handleSelect(loc)}>
              <div className="ff-location-loc-icon">
                <MapPin size={14} />
              </div>
              <div className="ff-location-details">
                <div className="ff-location-main-info">
                  <span className="ff-location-code-tag">{loc.code}</span>
                  <span className="ff-location-name">{loc.name}</span>
                </div>
                <span className="ff-location-sub">{loc.city}, {loc.country}</span>
              </div>
            </div>
          ))}

          {results.length === 0 && !loading && query.length >= 3 && (
            <div className="ff-location-option ff-location-create-new" onClick={createNewLocation}>
              <Plus size={14} />
              <span>Añadir <b>"{query}"</b> personalizado</span>
            </div>
          )}
        </div>
      )}

      {/* Reemplazamos style jsx por un tag de estilo estándar compatible con Vite/React */}
      <style>{`
        .ff-location-wrapper { position: relative; width: 100%; }
        .ff-location-input-group { 
          display: flex; align-items: center; background: #f8fafc;
          border: 2px solid #e2e8f0; border-radius: 12px; padding: 0 12px;
          transition: all 0.2s ease;
        }
        .ff-location-input-group:focus-within { border-color: #22c55e; background: white; }
        .ff-location-icon-prefix { color: #94a3b8; }
        .ff-location-input-group input { 
          flex: 1; border: none !important; padding: 14px 12px !important; outline: none !important; 
          font-size: 14px; color: #1e293b; font-weight: 700; background: transparent !important;
        }
        .ff-location-dropdown { 
          position: absolute; top: calc(100% + 8px); left: 0; right: 0; z-index: 9999;
          background: white; border: 1px solid #e2e8f0; border-radius: 16px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.12); overflow: hidden;
        }
        .ff-location-option { 
          display: flex; align-items: center; gap: 14px; padding: 12px 16px;
          cursor: pointer; border-bottom: 1px solid #f1f5f9;
        }
        .ff-location-option:hover { background: #f0fdf4; }
        .ff-location-loc-icon { color: #22c55e; }
        .ff-location-details { display: flex; flex-direction: column; }
        .ff-location-code-tag { background: #0f172a; color: white; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-right: 8px; font-weight: 800; }
        .ff-location-name { font-size: 13px; font-weight: 700; color: #1e293b; }
        .ff-location-sub { font-size: 11px; color: #64748b; text-transform: uppercase; }
        .ff-location-create-new { color: #15803d; background: #f0fdf4; }
        .ff-spin { animation: ff-rotate 1s linear infinite; color: #22c55e; }
        @keyframes ff-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}