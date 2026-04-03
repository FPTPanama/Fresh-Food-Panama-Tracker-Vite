import { useState, useEffect, useRef } from "react";
import { Plus, Plane, Ship, Loader2, MapPin } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

interface Location {
  id?: string;
  code: string;
  name: string;
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
        if (data) setQuery(data.code);
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
    
    // FIX: Eliminada la columna inexistente 'city' para evitar el crash de PostgREST
    const { data } = await supabase
      .from('master_locations')
      .select('*')
      .eq('type', mode)
      .or(`name.ilike.%${q}%,code.ilike.%${q}%,country.ilike.%${q}%`)
      .limit(6);

    setResults((data as Location[]) || []);
    setLoading(false);
  };

  const handleSelect = (loc: Location) => {
    setQuery(loc.code);
    onChange(loc.code); 
    setIsOpen(false);
  };

  const createNewLocation = async () => {
    if (!query) return;
    setLoading(true);
    const tempCode = "MAN-" + query.substring(0, 3).toUpperCase(); 
    
    // FIX: Adaptado a la estructura real de la tabla (sin 'city' ni 'flag')
    const { data, error } = await supabase
      .from('master_locations')
      .insert([{
        code: tempCode,
        name: query,
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
                {/* FIX: Mostrar solo el país ya que no hay ciudad en la BD */}
                <span className="ff-location-sub">{loc.country}</span>
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

      {/* ESTILOS ADAPTADOS A LA MARCA FRESHCONNECT */}
      <style>{`
        .ff-location-wrapper { position: relative; width: 100%; }
        
        /* El input group es transparente para que herede los bordes del modal padre si existe,
           pero tiene su propio borde por si se usa suelto en la app */
        .ff-location-input-group { 
          display: flex; align-items: center; background: transparent;
          width: 100%; transition: all 0.2s ease;
        }
        .ff-location-icon-prefix { color: #227432; margin-right: 8px; display: flex; align-items: center; }
        
        .ff-location-input-group input { 
          flex: 1; border: none !important; padding: 0 !important; outline: none !important; 
          font-size: 15px !important; color: #224C22 !important; font-weight: 700 !important; 
          background: transparent !important; font-family: 'Poppins', sans-serif;
        }
        .ff-location-input-group input::placeholder { opacity: 0.4; font-weight: 500; }
        
        .ff-location-dropdown { 
          position: absolute; top: calc(100% + 15px); left: -15px; right: -15px; z-index: 99999;
          background: white; border: 2px solid #224C22; border-radius: 16px;
          box-shadow: 0 40px 100px -20px rgba(0,0,0,0.4); overflow: hidden;
        }
        
        .ff-location-option { 
          display: flex; align-items: center; gap: 14px; padding: 14px 20px;
          cursor: pointer; border-bottom: 1px solid rgba(34, 76, 34, 0.05); transition: 0.2s;
        }
        .ff-location-option:hover { background: #f0f4ef; }
        
        .ff-location-loc-icon { color: #227432; display: flex; align-items: center; }
        
        .ff-location-details { display: flex; flex-direction: column; gap: 2px; }
        .ff-location-main-info { display: flex; align-items: center; gap: 8px; }
        
        .ff-location-code-tag { 
          background: #224C22; color: white; font-size: 10px; padding: 3px 8px; 
          border-radius: 6px; font-weight: 800; letter-spacing: 0.5px;
        }
        .ff-location-name { font-size: 13px; font-weight: 700; color: #224C22; }
        .ff-location-sub { font-size: 11px; color: #224C22; opacity: 0.6; text-transform: uppercase; font-weight: 600; }
        
        .ff-location-create-new { color: #D17711; background: #fff7ed; }
        .ff-location-create-new:hover { background: #ffedd5; }
        .ff-location-create-new b { font-weight: 800; }
        
        .ff-spin { animation: ff-rotate 1s linear infinite; color: #D17711; }
        @keyframes ff-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}