import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { getApiBase } from "../lib/apiBase";
import { useUILang } from "../lib/uiLanguage";
import {
  Package, Globe, ChevronDown, LogOut,
  UserCircle2, ChevronLeft, ChevronRight, FileText, LayoutDashboard
} from "lucide-react";

const LOGO_SRC = "/brand/freshconnect_verde.svg";
const LS_KEY = "ff_client_sidebar_collapsed";

interface ClientLayoutProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  wide?: boolean; 
}

export function ClientLayout({ title, subtitle, children, wide = false }: ClientLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { lang, toggle } = useUILang();
  
  const [me, setMe] = useState<{ email: string | null; role: string | null }>({ email: null, role: null });
  const [menuOpen, setMenuOpen] = useState(false);
  const [sideCollapsed, setSideCollapsed] = useState(false);
  
  const menuRef = useRef<HTMLDivElement | null>(null);

  // --- NAVEGACIÓN RESTAURADA + DASHBOARD ---
  const nav = useMemo(() => [
    { 
      href: "/clients/dashboard", 
      label: lang === "es" ? "Panel de Control" : "Dashboard", 
      icon: LayoutDashboard 
    },
    { 
      href: "/clients/shipments", 
      label: lang === "es" ? "Mis Embarques" : "My Shipments", 
      icon: Package 
    },
    { 
      href: "/clients/quotes", 
      label: lang === "es" ? "Mis Cotizaciones" : "My Quotes", 
      icon: FileText 
    },
  ], [lang]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  useEffect(() => {
    try { if (localStorage.getItem(LS_KEY) === "1") setSideCollapsed(true); } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }
      
      const res = await fetch(`${getApiBase()}/.netlify/functions/getMyProfile`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setMe({ email: json.email ?? null, role: json.role ?? null });
      }
    })();
  }, [navigate]);

  return (
    <div className={`ff-app ${sideCollapsed ? "is-collapsed" : ""}`}>
      <header className="ff-top">
        <div className="ff-top__inner">
          <div className="ff-top__left">
         <img 
  src={LOGO_SRC} 
  alt="Fresh Food Panamá" 
  className="ff-top__logo" 
  onClick={() => navigate('/clients/dashboard')} 
  // Eliminamos el style inline para que todo sea controlado desde globals.css
/>
            <div className="ff-v-sep" style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 16px' }} />
            <div className="ff-top__titleWrap">
              {title && <h1 className="ff-top__title">{title}</h1>}
              {subtitle && <div className="ff-top__sub">{subtitle}</div>}
            </div>
          </div>

          <div className="ff-top__right">
            <button type="button" className="ff-chip" onClick={toggle}>
              <Globe size={14} /> <span>{lang.toUpperCase()}</span>
            </button>
            
            <div className="ff-user" ref={menuRef}>
              <button type="button" className="ff-user__btn" onClick={() => setMenuOpen(!menuOpen)}>
                <UserCircle2 size={18} />
                <span className="ff-user__email">{me.email?.split('@')[0] ?? "Cliente"}</span>
                <ChevronDown size={14} style={{ transform: menuOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
              </button>

              {menuOpen && (
                <div className="ff-user__menu">
                  <div className="ff-user__info">
                    <p className="ff-user__label">{lang === 'es' ? 'Sesión iniciada como' : 'Signed in as'}</p>
                    <p className="ff-user__val">{me.email}</p>
                  </div>
                  <div className="ff-user__sep" />
                  <button className="ff-user__logout" onClick={handleLogout}>
                    <LogOut size={14} />
                    <span>{lang === 'es' ? 'Cerrar Sesión' : 'Sign Out'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <aside className="ff-side">
        <div className="ff-side__brand" style={{ height: '40px', display: 'flex', alignItems: 'center', padding: '0 16px', marginBottom: '12px' }}>
             {!sideCollapsed && <span style={{ color: '#ffffff', fontWeight: 900, fontSize: '12px', letterSpacing: '1px', opacity: 0.6 }}>PORTAL CLIENTE</span>}
        </div>

        <button type="button" className="ff-side__toggle" onClick={() => {
            const newState = !sideCollapsed;
            setSideCollapsed(newState);
            localStorage.setItem(LS_KEY, newState ? "1" : "0");
        }}>
          {sideCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        <nav className="ff-side__nav">
          {nav.map((n) => {
            const Icon = n.icon;
            const active = location.pathname.startsWith(n.href);
            return (
              <Link key={n.href} to={n.href} className={`ff-side__item ${active ? "is-active" : ""}`}>
                <span className="ff-side__ico"><Icon size={20} /></span>
                <span className="ff-side__lbl">{n.label}</span>
                {active && <div className="ff-active-indicator" />}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="ff-main">
        <main className={wide ? "ff-content-wide" : "ff-content"}>
          {children}
        </main>
      </div>

      <style>{`
        /* --- ESTILOS ORIGINALES RESTAURADOS --- */
        .ff-app { display: grid; grid-template-areas: "top top" "side main"; grid-template-columns: 240px 1fr; grid-template-rows: 64px 1fr; height: 100vh; }
        .ff-app.is-collapsed { grid-template-columns: 80px 1fr; }
        .ff-top { grid-area: top; background: white; border-bottom: 1px solid #eef2f6; position: sticky; top: 0; z-index: 100; }
        .ff-top__inner { display: flex; align-items: center; justify-content: space-between; height: 64px; padding: 0 24px; }
        
        /* EL COLOR VERDE BOSQUE ORIGINAL */
        .ff-side { grid-area: side; background: #284b2c; border-right: 1px solid #1f3a22; padding: 24px 12px; position: relative; display: flex; flex-direction: column; gap: 4px; z-index: 90; }
        .ff-side__item { display: flex; align-items: center; gap: 16px; padding: 12px 16px; color: #ffffff; text-decoration: none; border-radius: 12px; font-size: 14px; font-weight: 500; transition: all 0.2s ease; position: relative; }
        .ff-side__item:hover { background: rgba(255,255,255,0.1); color: #f59e0b; }
        
        /* EL COLOR VERDE ACTIVO ORIGINAL */
        .ff-side__item.is-active { background: #3a5a3e; color: #ffffff; font-weight: 700; box-shadow: inset 0 0 10px rgba(0,0,0,0.1); }
        .ff-active-indicator { position: absolute; left: 0; top: 12px; bottom: 12px; width: 4px; background: #f59e0b; border-radius: 0 4px 4px 0; }
        
        .ff-side__toggle { position: absolute; right: -12px; top: 74px; width: 24px; height: 24px; background: #f59e0b; border: none; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1); z-index: 100; }
        
        .ff-main { grid-area: main; overflow-y: auto; background: #f8fafc; }
        .ff-content { padding: 32px; max-width: 1400px; margin: 0 auto; width: 100%; }
        .ff-top__title { font-size: 16px; font-weight: 800; color: #0f172a; margin: 0; }
        .ff-top__sub { font-size: 11px; color: #64748b; }
        .ff-chip { display: flex; align-items: center; gap: 6px; background: #f1f5f9; border: none; padding: 6px 12px; border-radius: 50px; font-size: 11px; font-weight: 700; color: #475569; cursor: pointer; }
        
        /* USER MENU */
        .ff-user__btn { display: flex; align-items: center; gap: 10px; background: none; border: none; cursor: pointer; }
        .ff-user__email { font-size: 13px; font-weight: 600; color: #1e293b; }
        .ff-user__menu { position: absolute; right: 0; top: 110%; width: 200px; background: white; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); padding: 8px; z-index: 200; }
        .ff-user__info { padding: 8px 12px; }
        .ff-user__label { font-size: 10px; color: #94a3b8; text-transform: uppercase; margin: 0; }
        .ff-user__val { font-size: 12px; font-weight: 700; color: #1e293b; margin: 2px 0 0; }
        .ff-user__sep { height: 1px; background: #f1f5f9; margin: 8px 0; }
        .ff-user__logout { width: 100%; display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #fff1f2; color: #e11d48; border: none; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; }

        .is-collapsed .ff-side__lbl, .is-collapsed .ff-side__brand { display: none; }
        .is-collapsed .ff-side__item { justify-content: center; padding: 12px; }
      `}</style>
    </div>
  );
}