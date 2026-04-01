import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { getApiBase } from "../lib/apiBase";
import { 
  LogIn as LogInIcon, 
  ShieldCheck as ShieldIcon, 
  CheckCircle2 as CheckIcon, 
  Eye as EyeIcon, 
  EyeOff as EyeOffIcon,
  ArrowLeft,
  Send,
  Mail
} from "lucide-react";
import { notify } from "@/components/AdminLayout"; // Asegúrate de que esta ruta sea correcta

import "./login.css";

type Role = "client" | "admin" | "superadmin" | null;
type ViewMode = "login" | "forgot";

export default function LoginPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  async function routeByRole(): Promise<boolean> {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return false;

      const res = await fetch(`${getApiBase()}/.netlify/functions/whoami`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        await supabase.auth.signOut();
        return false;
      }

      const me: { email: string; role: Role; client_id: string | null } = await res.json();
      const role = String(me.role || "").toLowerCase();

      if (role === "admin" || role === "superadmin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/clients/dashboard");
      }
      return true;
    } catch {
      return false;
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const redirected = await routeByRole();
        if (!redirected) setChecking(false);
      } catch {
        setChecking(false);
      }
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    const redirected = await routeByRole();
    setLoading(false);

    if (!redirected) {
      setError(
        "Sesión creada, pero no se pudo obtener tu rol. En local: añade en .env VITE_API_BASE_URL=https://tu-sitio.netlify.app (sin barra final) o ejecuta Netlify en el puerto 8888."
      );
    }
  }

  // Nueva función para recuperar clave
  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return setError("Por favor ingresa tu correo electrónico.");
    
    setLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setEmailSent(true);
    } catch (err: any) {
      setError(err.message || "Error al enviar el correo");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="ff-login-viewport">
        <div className="text-center">
          <div className="ff-spinner"></div>
          <p>Sincronizando con Fresh Connect...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ff-login-viewport">
      <div className="ff-login-container">
        
        <div className="ff-login-visual">
          <div className="ff-visual-overlay"></div>
          <div className="ff-visual-content">
            <h2>Logística de exportación que conecta a Panamá con el mundo.</h2>
            <div className="ff-features">
              <div className="ff-f-item"><CheckIcon size={16} /> <span>Trazabilidad Fresh Connect</span></div>
              <div className="ff-f-item"><CheckIcon size={16} /> <span>Gestión de Documentos</span></div>
            </div>
          </div>
        </div>

        <div className="ff-login-form-side">
          <div className="ff-form-header">
            <img src="/brand/freshfood_logo.png" alt="FreshFood Panama" className="ff-form-logo" />
            
            {view === "login" ? (
              <>
                <h1>Portal de Clientes</h1>
                <p>Ingresa tus credenciales para continuar.</p>
              </>
            ) : (
              <>
                <h1>Recuperar Clave</h1>
                <p>Te enviaremos un correo con las instrucciones.</p>
              </>
            )}
          </div>

          {view === "login" ? (
            /* FORMULARIO DE LOGIN */
            <form onSubmit={onSubmit} className="ff-login-form">
              <div className="ff-input-group">
                <label>Correo Electrónico</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="ejemplo@freshfoodpanama.com"
                  required
                />
              </div>

              <div className="ff-input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>Contraseña</label>
                  <button 
                    type="button" 
                    className="ff-forgot-link" 
                    onClick={() => { setView("forgot"); setError(null); }}
                  >
                    ¿Olvidaste tu clave?
                  </button>
                </div>
                <div className="ff-password-wrap">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    required
                  />
                  <button type="button" className="ff-password-toggle" onClick={() => setShowPassword((v) => !v)}>
                    {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                  </button>
                </div>
              </div>

              {error && <div className="ff-error-msg">{error}</div>}

              <button disabled={loading} className="ff-submit-btn">
                {loading ? "Ingresando..." : "Acceder al Panel"}
                {!loading && <LogInIcon size={18} />}
              </button>
            </form>
          ) : (
            /* FORMULARIO DE RECUPERACIÓN */
            <div className="ff-forgot-container">
              {!emailSent ? (
                <form onSubmit={handleResetPassword} className="ff-login-form">
                  <div className="ff-input-group">
                    <label>Correo Electrónico</label>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                      placeholder="Tu correo registrado"
                      required
                    />
                  </div>
                  
                  {error && <div className="ff-error-msg">{error}</div>}

                  <button disabled={loading} className="ff-submit-btn">
                    {loading ? "Enviando..." : "Enviar Instrucciones"}
                    {!loading && <Send size={18} />}
                  </button>
                  
                  <button 
                    type="button" 
                    className="ff-back-btn" 
                    onClick={() => { setView("login"); setError(null); }}
                  >
                    <ArrowLeft size={16} /> Volver al inicio
                  </button>
                </form>
              ) : (
                <div className="ff-success-announcement">
                  <div className="ff-icon-circle">
                    <CheckIcon size={32} />
                  </div>
                  <h3>¡Correo enviado con éxito!</h3>
                  <p>Hemos enviado instrucciones a <strong>{email}</strong> para restablecer tu contraseña. Revisa tu bandeja de entrada o spam.</p>
                  <button className="ff-submit-btn" onClick={() => { setView("login"); setEmailSent(false); }}>
                    Entendido, volver
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="ff-form-footer">
            <ShieldIcon size={14} />
            <span>Acceso Encriptado SSL</span>
          </div>
        </div>
      </div>

      <style>{`
        .ff-forgot-link {
          background: none; border: none; color: #10b981; font-size: 12px; font-weight: 700; cursor: pointer; padding: 0; margin-bottom: 4px;
        }
        .ff-forgot-link:hover { text-decoration: underline; }
        
        .ff-back-btn {
          margin-top: 15px; background: none; border: none; color: #94a3b8; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 14px; font-weight: 600; cursor: pointer;
        }
        .ff-back-btn:hover { color: #0f172a; }

        .ff-success-announcement {
          background: #f0fdf4; border: 1.5px solid #dcfce7; border-radius: 24px; padding: 30px; text-align: center; animation: modalSpring 0.4s ease;
        }
        .ff-icon-circle {
          width: 60px; height: 60px; background: #10b981; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;
        }
        .ff-success-announcement h3 { font-weight: 900; color: #065f46; margin: 0 0 10px; }
        .ff-success-announcement p { font-size: 14px; color: #065f46; line-height: 1.5; margin-bottom: 20px; }
        
        @keyframes modalSpring {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}