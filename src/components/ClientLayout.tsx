import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { getApiBase } from "../lib/apiBase";
import { useUILang } from "../lib/uiLanguage";
import {
  Package, Globe, ChevronDown, LogOut, Search, Loader2,
  UserCircle2, FileText, CheckCircle2, AlertCircle, ArrowRight, Ship
} from "lucide-react";

const LOGO_SRC = "/brand/freshfood-logo.svg";

// Sistema de notificaciones similar al Admin
export let notify: (msg: string, type?: 'success' | 'error') => void = () => {};

type SearchResult = { 
  id: string; 
  type: 'shipment' | 'quote' | 'user'; 
  label: string; 
  sub: string;
  status?: string; 
};

export function ClientLayout({ title, subtitle, children, wide = true }: { title?: string; subtitle?: string; children: React.ReactNode; wide?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { lang, toggle } = useUILang();
  
  const [me, setMe] = useState<{ email: string | null; role: string | null }>({ email: null, role: null });
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
  
  const [globalQuery, setGlobalQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);

  notify = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Navegación fija para clientes (sin colapsar)
  const nav = useMemo(() => [
    { 
      href: "/shipments", 
      label: lang === "es" ? "Mis Envíos" : "My Shipments", 
      icon: Ship 
    },
    { 
      href: "/profile", 
      label: lang === "es" ? "Mi Perfil" : "My Profile", 
      icon: UserCircle2 
    },
  ], [lang]);

  // Búsqueda global (filtrada para lo que el cliente puede ver)
  const handleGlobalSearch = async (val: string) => {
    setGlobalQuery(val);
    if (val.length < 2) { setSearchResults([]); return; }
    setIsSearching(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      // Solo buscamos embarques del propio cliente
      const { data: shipRes } = await supabase.from('shipments')
        .select('id, code, destination, status')
        .or(`code.ilike.%${val}%,destination.ilike.%${val}%`)
        .limit(5);

      const formatted: SearchResult[] = (shipRes || []).map(s => ({ 
        id: s.id, 
        type: 'shipment' as const, 
        label: s.code || 'Embarque', 
        sub: s.destination || 'Sin destino',
        status: s.status 
      }));
      
      setSearchResults(formatted);
    } catch (e) { 
      console.error("Error search:", e); 
    } finally { 
      setIsSearching(false); 
    }
  };

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as any)) setMenuOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as any)) setGlobalQuery("");
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { navigate("/login"); return; }
      const res = await fetch(`${getApiBase()}/.netlify/functions/getMyProfile`, {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setMe({ email: json.email ?? null, role: json.role ?? null });
      }
    })();
  }, [navigate]);

  return (
    <div className="ff-app">
      {/* Toast de notificaciones */}
      {toast && (
        <div className={`ff-toast ${toast.type}`} style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, display: 'flex', gap: '10px', padding: '12px 20px', borderRadius: '12px', background: 'white', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', border: '1px solid #eee' }}>
          {toast.type === 'success' ? <CheckCircle2 size={18} color="#234d23"/> : <AlertCircle size={18} color="#ef4444"/>}
          <span style={{ fontWeight: 600, fontSize: '13px' }}>{toast.msg}</span>
        </div>
      )}

      <header className="ff-top">
        <div className="ff-top__inner">
          <div className="ff-top__left">
            <img src={LOGO_SRC} alt="FF" className="ff-top__logo" onClick={() => navigate('/shipments')} style={{cursor:'pointer'}} />
            <div className="ff-top__titleWrap">
              <h1 className="ff-top__title">{title || "Fresh Food Panamá"}</h1>
              {subtitle && <div className="ff-top__sub">{subtitle}</div>}
            </div>
          </div>

          <div className="ff-top__right">
            {/* Buscador integrado estilo Admin pero con visual de Cliente */}
            <div className="ff-global-search" ref={searchRef} style={{ position: 'relative' }}>
              <div className="ff-search-pill" style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: '10px', padding: '0 12px', height: '36px', width: globalQuery ? '260px' : '200px', transition: '0.3s' }}>
                <Search size={14} color="#64748b" />
                <input 
                  style={{ border: 'none', background: 'none', outline: 'none', padding: '0 8px', fontSize: '12px', width: '100%' }}
                  placeholder={lang === 'es' ? "Buscar envío..." : "Search shipment..."}
                  value={globalQuery}
                  onChange={(e) => handleGlobalSearch(e.target.value)}
                />
                {isSearching && <Loader2 size={14} className="ff-spin" />}
              </div>
              
              {globalQuery.length >= 2 && (
                <div className="ff-search-results animate-fade-in" style={{ position: 'absolute', top: '110%', right: 0, width: '300px', background: 'white', borderRadius: '12px', border: '1px solid #eee', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', overflow: 'hidden', zIndex: 100 }}>
                  {searchResults.length > 0 ? searchResults.map((res) => (
                    <button key={res.id} className="res-item" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', border: 'none', background: 'none', cursor: 'pointer', borderBottom: '1px solid #f8fafc' }}
                      onClick={() => { navigate(`/shipments/${res.id}`); setGlobalQuery(""); }}>
                      <div className="res-tag shipment" style={{ background: '#eff6ff', color: '#3b82f6', padding: '6px', borderRadius: '6px' }}><Ship size={14}/></div>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700 }}>{res.label}</div>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>{res.sub}</div>
                      </div>
                    </button>
                  )) : !isSearching && <div style={{ padding: '15px', fontSize: '12px', color: '#94a3b8' }}>No se encontraron envíos</div>}
                </div>
              )}
            </div>

            <button type="button" className="ff-chip" onClick={toggle}>
              <Globe size={14} /> <span>{lang.toUpperCase()}</span>
            </button>

            <div className="ff-user" ref={menuRef}>
              <button type="button" className="ff-user__btn" onClick={() => setMenuOpen(!menuOpen)}>
                <UserCircle2 size={18} color="var(--ff-green)" />
                <span className="ff-user__email">{me.email?.split('@')[0] ?? "Usuario"}</span>
                <ChevronDown size={14} style={{ transform: menuOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
              </button>
              {menuOpen && (
                <div className="ff-user__menu animate-fade-in">
                  <div className="ff-user__meta" style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700 }}>{me.email}</div>
                    <div style={{ fontSize: '10px', color: 'var(--ff-muted)' }}>{me.role?.toUpperCase() || 'CLIENTE'}</div>
                  </div>
                  <button type="button" className="ff-user__item" onClick={() => navigate("/profile")}>
                    <UserCircle2 size={16} /> <span>Perfil</span>
                  </button>
                  <button type="button" className="ff-user__item danger" onClick={async () => { await supabase.auth.signOut(); navigate("/login"); }}>
                    <LogOut size={16} /> <span>Cerrar sesión</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <aside className="ff-side">
        <nav className="ff-side__nav">
          {nav.map((n) => {
            const Icon = n.icon;
            const active = location.pathname.startsWith(n.href);
            return (
              <Link key={n.href} to={n.href} className={`ff-side__item ${active ? "is-active" : ""}`}>
                <Icon size={18} />
                <span className="ff-side__lbl">{n.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="ff-main">
        <div className={`ff-content ${wide ? "ff-content--wide" : ""}`}>
          {children}
        </div>
      </main>

      <style>{`
        .ff-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.2s ease-out; }
        .res-item:hover { background: #f1f5f9 !important; }
      `}</style>
    </div>
  );
}