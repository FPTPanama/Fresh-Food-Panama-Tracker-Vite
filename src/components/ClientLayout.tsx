import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { getApiBase } from "../lib/apiBase";
import { useUILang } from "../lib/uiLanguage";
import {
  Package, Globe, ChevronDown, LogOut, Search, Loader2,
  UserCircle2, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, ArrowRight, Ship
} from "lucide-react";

const LOGO_SRC = "/brand/freshfood-logo.svg";
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

  // --- NUEVA LÓGICA: CERRAR AL HACER CLIC FUERA ---
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

  const nav = useMemo(() => [
    { 
      href: "/shipments", 
      label: lang === "es" ? "Mis Embarques" : "My Shipments", 
      icon: Package 
    },
  ], [lang]);

  useEffect(() => {
    try { if (localStorage.getItem(LS_KEY) === "1") setSideCollapsed(true); } catch {}
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
    <div className={`ff-app ${sideCollapsed ? "is-collapsed" : ""}`}>
      <header className="ff-top">
        <div className="ff-top__inner">
          <div className="ff-top__left">
            <img src={LOGO_SRC} alt="FF" width={40} height={40} className="ff-top__logo" onClick={() => navigate('/shipments')} style={{cursor:'pointer'}} />
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
            
            {/* CONTENEDOR DE USUARIO ACTUALIZADO */}
            <div className="ff-user" ref={menuRef}>
              <button type="button" className="ff-user__btn" onClick={() => setMenuOpen(!menuOpen)}>
                <UserCircle2 size={18} />
                <span className="ff-user__email">{me.email?.split('@')[0] ?? "Cliente"}</span>
                <ChevronDown size={14} style={{ transform: menuOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
              </button>

              {/* --- EL MENÚ QUE FALTABA --- */}
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
        <button type="button" className="ff-side__toggle" onClick={() => setSideCollapsed(!sideCollapsed)}>
          {sideCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
        <nav className="ff-side__nav">
          {nav.map((n) => {
            const Icon = n.icon;
            const active = location.pathname.startsWith(n.href);
            return (
              <Link key={n.href} to={n.href} className={`ff-side__item ${active ? "is-active" : ""}`}>
                <span className="ff-side__ico"><Icon size={16} /></span>
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
        .ff-app { display: grid; grid-template-areas: "top top" "side main"; grid-template-columns: 240px 1fr; grid-template-rows: 64px 1fr; height: 100vh; }
        .ff-app.is-collapsed { grid-template-columns: 80px 1fr; }
        .ff-top { grid-area: top; background: white; border-bottom: 1px solid #eef2f6; position: sticky; top: 0; z-index: 100; }
        .ff-top__inner { display: flex; align-items: center; justify-content: space-between; height: 64px; padding: 0 24px; }
        
        /* USER MENU STYLES */
        .ff-user { position: relative; }
        .ff-user__btn { 
          display: flex; align-items: center; gap: 8px; background: #f8fafc; 
          border: 1px solid #e2e8f0; padding: 6px 12px; border-radius: 50px; 
          cursor: pointer; color: #1e293b; font-weight: 600; font-size: 13px;
          transition: 0.2s;
        }
        .ff-user__btn:hover { background: #f1f5f9; }
        
        .ff-user__menu { 
          position: absolute; top: calc(100% + 8px); right: 0; width: 220px; 
          background: white; border: 1px solid #e2e8f0; border-radius: 12px; 
          box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); padding: 8px; z-index: 1000;
        }
        .ff-user__info { padding: 8px 12px; }
        .ff-user__label { font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 800; margin: 0; }
        .ff-user__val { font-size: 12px; color: #1e293b; margin: 2px 0 0 0; font-weight: 500; overflow: hidden; text-overflow: ellipsis; }
        .ff-user__sep { height: 1px; background: #f1f5f9; margin: 8px 0; }
        
        .ff-user__logout { 
          width: 100%; display: flex; align-items: center; gap: 8px; padding: 8px 12px;
          border: none; background: transparent; color: #ef4444; font-size: 13px;
          font-weight: 600; cursor: pointer; border-radius: 8px; transition: 0.2s;
        }
        .ff-user__logout:hover { background: #fef2f2; }

        /* SIDEBAR & MAIN STYLES (TU CÓDIGO) */
        .ff-side { grid-area: side; background: white; border-right: 1px solid #eef2f6; padding: 20px 12px; position: relative; }
        .ff-side__item { display: flex; align-items: center; gap: 12px; padding: 12px; color: #64748b; text-decoration: none; border-radius: 10px; margin-bottom: 4px; transition: 0.2s; position: relative; }
        .ff-side__item:hover { background: #f0fdf4; color: #10b981; }
        .ff-side__item.is-active { background: #ecfdf5; color: #059669; font-weight: 700; }
        .ff-active-indicator { position: absolute; left: 0; top: 10px; bottom: 10px; width: 3px; background: #10b981; border-radius: 0 4px 4px 0; }
        .ff-main { grid-area: main; overflow-y: auto; background: #f8fafc; }
        .ff-content { padding: 32px; max-width: 1200px; margin: 0 auto; width: 100%; }
        .ff-content-wide { padding: 32px; max-width: 100%; margin: 0; width: 100%; }
        .ff-top__title { font-size: 16px; font-weight: 800; color: #0f172a; margin: 0; }
        .ff-top__sub { font-size: 11px; color: #64748b; }
        .ff-chip { display: flex; align-items: center; gap: 6px; background: #f1f5f9; border: none; padding: 6px 12px; border-radius: 50px; font-size: 11px; font-weight: 700; color: #475569; cursor: pointer; margin-right: 8px; }
      `}</style>
    </div>
  );
}