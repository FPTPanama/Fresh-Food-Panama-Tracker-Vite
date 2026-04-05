import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { getApiBase } from "../lib/apiBase";
import { useUILang } from "../lib/uiLanguage";
import {
  LayoutGrid, Package, Users, Globe, ChevronDown, LogOut, Search, Loader2,
  UserCircle2, FileText, CheckCircle2, AlertCircle, ArrowRight, Ship, Target, BrainCircuit,
  BarChart3,
} from "lucide-react";

const LOGO_WHITE = "/brand/freshconnect_blanco.svg";

export let notify: (msg: string, type?: 'success' | 'error') => void = () => {};

type SearchResult = { 
  id: string; 
  type: 'shipment' | 'quote' | 'user'; 
  label: string; 
  sub: string;
  status?: string; 
};

export function AdminLayout({ title, subtitle, children }: { title?: string; subtitle?: string; children: React.ReactNode; }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { lang, toggle } = useUILang();
  
  const [me, setMe] = useState<{ email: string | null; role: string | null }>({ email: null, role: null });
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
  
  const [globalQuery, setGlobalQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  notify = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

 const nav = useMemo(() => [
    { href: "/admin/dashboard", label: lang === "es" ? "Dashboard" : "Dashboard", icon: LayoutGrid },
    { href: "/admin/shipments", label: lang === "es" ? "Embarques" : "Shipments", icon: Package },
    { href: "/admin/quotes", label: lang === "es" ? "Cotizaciones" : "Quotes", icon: FileText },
    { href: "/admin/users", label: lang === "es" ? "Clientes" : "Clients", icon: Users },
    
    // --- MÓDULO CRM & IA ---
    { href: "/admin/crm/leads", label: lang === "es" ? "Lead Center" : "Lead Center", icon: BrainCircuit }, 
    { href: "/admin/crm/campaigns", label: lang === "es" ? "Campañas" : "Campaigns", icon: BarChart3 }, 
  ], [lang]);

  const handleGlobalSearch = async (val: string) => {
    setGlobalQuery(val);
    if (val.length < 2) { setSearchResults([]); return; }
    setIsSearching(true);
    setSelectedIndex(-1);

    try {
      const [shipRes, quoteRes, clientRes] = await Promise.all([
        supabase.from('shipments').select('id, code, destination, status')
          .or(`code.ilike.%${val}%,destination.ilike.%${val}%,awb.ilike.%${val}%`).limit(3),
        supabase.from('quotes').select('id, quote_number, destination, status')
          .or(`quote_number.ilike.%${val}%,destination.ilike.%${val}%`).limit(3),
        supabase.from('v_clients_overview').select('id, name, legal_name, contact_email, city')
          .or(`name.ilike.%${val}%,legal_name.ilike.%${val}%,contact_email.ilike.%${val}%,city.ilike.%${val}%`).limit(5)
      ]);

      const formatted: SearchResult[] = [
        ...(shipRes.data || []).map(s => ({ id: s.id, type: 'shipment' as const, label: s.code || 'Embarque', sub: s.destination || 'Sin destino', status: s.status })),
        ...(quoteRes.data || []).map(q => ({ id: q.id, type: 'quote' as const, label: q.quote_number || 'Cotización', sub: q.destination || 'Sin destino', status: q.status })),
        ...(clientRes.data || []).map(c => ({ id: c.id, type: 'user' as const, label: c.name || c.legal_name, sub: `${c.city || ''} • ${c.contact_email || ''}`.replace(/^ • /, ''), status: null }))
      ];
      setSearchResults(formatted);
    } catch (e) { console.error(e); } finally { setIsSearching(false); }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") { e.preventDefault(); inputRef.current?.focus(); }
      if (e.key === "Escape") { setGlobalQuery(""); inputRef.current?.blur(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
      {toast && (
        <div className={`ff-toast ${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle2 size={18}/> : <AlertCircle size={18}/>}
          <span>{toast.msg}</span>
        </div>
      )}

      <aside className="ff-side">
        <div className="ff-side__logo-container">
          <img 
            src={LOGO_WHITE} 
            alt="FreshConnect" 
            className="ff-side__logo" 
            onClick={() => navigate('/admin/dashboard')} 
          />
        </div>
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '0 32px 20px' }} />

        <nav className="ff-side__nav">
          {nav.map((n) => {
            const Icon = n.icon;
            const active = location.pathname.startsWith(n.href);
            return (
              <Link key={n.href} to={n.href} className={`ff-side__item ${active ? "is-active" : ""}`}>
                <span className="ff-side__ico"><Icon size={18} /></span>
                <span className="ff-side__lbl">{n.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <header className="ff-top">
        <div className="ff-top__inner">
          
          {/* LADO IZQUIERDO: TÍTULOS DE LA PÁGINA */}
          <div className="ff-top__left">
            <div className="ff-top__titleWrap">
              {title && <h1 className="ff-top__title">{title}</h1>}
              {subtitle && <div className="ff-top__sub">{subtitle}</div>}
            </div>
          </div>

          {/* LADO DERECHO: BUSCADOR Y PERFIL */}
          <div className="ff-top__right">
            
            {/* BUSCADOR 360 */}
            <div className="ff-global-search" ref={searchRef}>
              <div className={`ff-search-pill ${globalQuery ? 'has-val' : ''}`}>
                <Search size={16} className="ico-search-main" />
                <input 
                  ref={inputRef}
                  placeholder={lang === 'es' ? "Buscar... (/)" : "Search... (/)"}
                  value={globalQuery}
                  onChange={(e) => handleGlobalSearch(e.target.value)}
                />
                {isSearching && <Loader2 size={14} className="ff-spin" />}
              </div>
              
              {/* RESULTADOS DEL BUSCADOR */}
              {globalQuery.length >= 2 && (
                <div className="ff-search-results animate-fade-in">
                  {searchResults.length > 0 ? searchResults.map((res, idx) => (
                    <button 
                      key={res.id} 
                      className={`res-item ${selectedIndex === idx ? 'is-selected' : ''}`}
                      onClick={() => {
                        const path = res.type === 'shipment' ? 'shipments' : res.type === 'quote' ? 'quotes' : 'users';
                        navigate(`/admin/${path}/${res.id}`);
                        setGlobalQuery("");
                      }}
                    >
                      <div className={`res-tag ${res.type}`}>
                        {res.type === 'shipment' ? <Ship size={12}/> : res.type === 'quote' ? <FileText size={12}/> : <UserCircle2 size={12}/>}
                      </div>
                      <div className="res-txt">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="res-title">{res.label}</span>
                          {res.status && <span className={`res-status-badge ${res.status.toLowerCase()}`}>{res.status}</span>}
                        </div>
                        <span className="res-sub">{res.sub}</span>
                      </div>
                      <ArrowRight size={14} className="res-arr" />
                    </button>
                  )) : !isSearching && <div className="res-empty">Sin resultados</div>}
                </div>
              )}
            </div>

            {/* BOTÓN IDIOMA */}
            <button type="button" className="ff-chip" onClick={toggle}>
              <Globe size={16} /> <span>{lang.toUpperCase()}</span>
            </button>

            {/* MENÚ DE USUARIO */}
            <div className="ff-user" ref={menuRef}>
              <button type="button" className="ff-user__btn" onClick={() => setMenuOpen(!menuOpen)}>
                <UserCircle2 size={18} />
                <span className="ff-user__email">administracion</span>
                <ChevronDown size={14} className={menuOpen ? 'rotate' : ''} />
              </button>
              
              {menuOpen && (
                <div className="ff-user__menu animate-fade-in">
                  <div className="ff-user__meta">
                    <div className="ff-user__metaEmail">{me.email ?? "-"}</div>
                    <div className="ff-user__metaRole">{lang === "es" ? "Rol" : "Role"}: <b>{me.role}</b></div>
                  </div>
                  <div className="ff-user__sep" />
                  <button type="button" className="ff-user__item" onClick={() => {navigate("/admin/profile"); setMenuOpen(false);}}>
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

      <div className="ff-main"><main className="ff-content">{children}</main></div>

      <style>{`
        * { font-family: 'Poppins', sans-serif !important; }
        
        .ff-app { 
          display: grid; 
          grid-template-columns: 240px 1fr; 
          grid-template-rows: 80px 1fr; 
          grid-template-areas: "side top" "side main"; 
          min-height: 100vh; 
        }

        /* HEADER SUPERIOR */
        .ff-top { 
          grid-area: top; 
          background: transparent !important; 
          border: none !important; 
          box-shadow: none !important; 
          display: flex; 
          align-items: center; 
          padding: 0 32px; 
          z-index: 100; 
        }
        
        .ff-top__inner { 
          width: 100%; 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
        }

        .ff-top__left { display: flex; flex-direction: column; }
        .ff-top__titleWrap { display: flex; flex-direction: column; }
        .ff-top__title { font-size: 24px; font-weight: 800; color: var(--ff-green-dark); margin: 0; }
        .ff-top__sub { font-size: 13px; color: #64748b; font-weight: 500; }

        .ff-top__right { display: flex; align-items: center; gap: 16px; position: relative; }

        /* SIDEBAR */
        .ff-side { grid-area: side; background-color: var(--ff-green-dark); display: flex; flex-direction: column; z-index: 110; }
        .ff-side__logo-container { height: 80px; display: flex; align-items: center; padding: 0 32px; margin-bottom: 20px; }
        .ff-side__logo { height: 32px; width: auto; max-width: 100%; object-fit: contain; cursor: pointer; }
        .ff-side__nav { padding: 0 16px; display: flex; flex-direction: column; gap: 8px; }
        .ff-side__item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 12px; color: rgba(255, 255, 255, 0.65) !important; font-weight: 500; text-decoration: none; transition: 0.2s; }
        .ff-side__item:hover { background: rgba(255, 255, 255, 0.05); color: #fff !important; }
        .ff-side__item.is-active { background: rgba(255, 255, 255, 0.1); color: #fff !important; font-weight: 700; }

        /* BUSCADOR 360 */
        .ff-global-search { position: relative; }
        .ff-search-pill { 
          background: white !important; 
          border: 1.5px solid rgba(34,76,34,0.2) !important; 
          border-radius: 9999px !important; 
          padding: 0 16px !important; 
          height: 40px !important; 
          display: flex; 
          align-items: center; 
          gap: 10px; 
          width: 260px;
          transition: 0.3s ease;
        }
        .ff-search-pill:focus-within { width: 340px; border-color: var(--ff-green-dark) !important; box-shadow: 0 0 0 3px rgba(34,76,34,0.1); }
        .ff-search-pill input { border: none; background: transparent; outline: none; width: 100%; font-size: 13px; color: var(--ff-green-dark); font-weight: 600; }
        .ff-search-pill input::placeholder { color: #94a3b8; font-weight: 500; }
        .ico-search-main { color: var(--ff-green-dark) !important; opacity: 0.6; }

        .ff-search-results { 
          position: absolute; top: calc(100% + 8px); right: 0; width: 100%; min-width: 340px;
          background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); 
          z-index: 200; overflow: hidden; display: flex; flex-direction: column;
        }
        
        .res-item { 
          width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px 16px; 
          background: none; border: none; border-bottom: 1px solid #f1f5f9; cursor: pointer; text-align: left; transition: 0.2s;
        }
        .res-item:last-child { border-bottom: none; }
        .res-item:hover, .res-item.is-selected { background: #f8fafc; }
        
        .res-tag { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .res-tag.shipment { background: #e0e7ff; color: #3730a3; }
        .res-tag.quote { background: #fff7ed; color: #ea580c; }
        .res-tag.user { background: #dcfce7; color: #166534; }
        
        .res-txt { display: flex; flex-direction: column; flex-grow: 1; overflow: hidden; }
        .res-title { font-size: 13px; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .res-sub { font-size: 11px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .res-arr { color: #cbd5e1; transition: 0.2s; }
        .res-item:hover .res-arr { color: var(--ff-green-dark); transform: translateX(3px); }
        .res-empty { padding: 20px; text-align: center; color: #94a3b8; font-size: 12px; font-weight: 500; }

        .res-status-badge { font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; background: #f1f5f9; color: #475569; }

        /* BOTONES DERECHA */
        .ff-chip { background: var(--ff-green-dark) !important; color: #fff !important; border: none !important; border-radius: 9999px !important; padding: 8px 16px !important; font-weight: 700 !important; height: 40px !important; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; transition: 0.2s; }
        .ff-chip:hover { background: #16361a !important; }
        
        .ff-user { position: relative; }
        .ff-user__btn { background: white !important; border: 1.5px solid rgba(34,76,34,0.2) !important; color: var(--ff-green-dark) !important; border-radius: 9999px !important; padding: 0 16px !important; height: 40px !important; font-weight: 700 !important; display: inline-flex; align-items: center; gap: 10px; cursor: pointer; transition: 0.2s; }
        .ff-user__btn:hover { border-color: var(--ff-green-dark) !important; background: #f8fafc !important; }
        .ff-user__email { font-size: 13px; }
        
        .ff-user__menu { position: absolute; top: calc(100% + 8px); right: 0; width: 240px; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); overflow: hidden; z-index: 200; }
        .ff-user__meta { padding: 16px; background: #f8fafc; border-bottom: 1px solid #f1f5f9; }
        .ff-user__metaEmail { font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ff-user__metaRole { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
        
        .ff-user__item { width: 100%; display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: none; border: none; font-size: 13px; font-weight: 600; color: #475569; cursor: pointer; transition: 0.2s; text-align: left; }
        .ff-user__item:hover { background: #f1f5f9; color: #0f172a; }
        .ff-user__item.danger { color: #ef4444; border-top: 1px solid #f1f5f9; }
        .ff-user__item.danger:hover { background: #fef2f2; color: #dc2626; }

        /* MAIN Y ALERTAS */
        .ff-main { grid-area: main; padding: 0 32px; overflow-y: auto; }
        .ff-content { max-width: 1600px; margin: 0 auto; width: 100%; }

        .ff-toast { position: fixed; bottom: 24px; right: 24px; display: flex; align-items: center; gap: 10px; padding: 14px 24px; border-radius: 12px; font-size: 13px; font-weight: 600; color: white; z-index: 9999; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.2); animation: slideUp 0.3s ease forwards; }
        .ff-toast.success { background: #10b981; }
        .ff-toast.error { background: #ef4444; }

        .rotate { transform: rotate(180deg); }
        .ff-spin { animation: spin 1s linear infinite; }
        .animate-fade-in { animation: fadeIn 0.2s ease forwards; }
        
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}