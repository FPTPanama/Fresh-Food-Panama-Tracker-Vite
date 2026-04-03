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
  Loader2
} from "lucide-react";

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

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (signInError) {
      setLoading(false);
      setError("Credenciales incorrectas. Por favor, intenta de nuevo.");
      return;
    }

    const redirected = await routeByRole();
    setLoading(false);

    if (!redirected) {
      setError("Sesión creada, pero ocurrió un error al verificar tus permisos de acceso.");
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return setError("Por favor ingresa tu correo electrónico.");
    
    setLoading(true);
    setError(null);
    
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      setEmailSent(true);
    } catch (err: any) {
      setError(err.message || "Error al enviar el correo");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="ff-login-viewport checking">
        <Loader2 className="animate-spin text-green-dark" size={40} />
        <p>Sincronizando con FreshConnect...</p>
      </div>
    );
  }

  return (
    <div className="ff-login-viewport">
      <div className="ff-login-container">
        
        {/* LADO VISUAL (BRANDING) */}
        <div className="ff-login-visual">
          <div className="ff-visual-content">
            <h2>Logística de exportación que conecta a Panamá con el mundo.</h2>
            <p>Plataforma exclusiva para administración y rastreo de carga en tiempo real.</p>
            
            <div className="ff-features">
              <div className="ff-f-item">
                <div className="f-icon"><CheckIcon size={14} /></div>
                <span>Trazabilidad Global 24/7</span>
              </div>
              <div className="ff-f-item">
                <div className="f-icon"><CheckIcon size={14} /></div>
                <span>Gestión de Documentos Cero Papel</span>
              </div>
              <div className="ff-f-item">
                <div className="f-icon"><CheckIcon size={14} /></div>
                <span>Aprobación de Cotizaciones Express</span>
              </div>
            </div>
          </div>
          {/* Trama sutil oscura para no aclarar el verde */}
          <div className="ff-visual-pattern"></div>
        </div>

        {/* LADO DEL FORMULARIO */}
        <div className="ff-login-form-side">
          <div className="ff-form-inner">
            <div className="ff-form-header">
              <img src="/brand/freshfood_logo.png" alt="FreshConnect" className="ff-form-logo" />
              
              {view === "login" ? (
                <>
                  <h1>Portal de Acceso</h1>
                  <p>Ingresa tus credenciales operativas para continuar.</p>
                </>
              ) : (
                <>
                  <h1>Recuperar Clave</h1>
                  <p>Te enviaremos un enlace seguro para restablecer tu contraseña.</p>
                </>
              )}
            </div>

            {view === "login" ? (
              <form onSubmit={onSubmit} className="ff-login-form">
                <div className="ff-input-group">
                  <label>Correo Electrónico</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder="ejemplo@empresa.com"
                    required
                  />
                </div>

                <div className="ff-input-group">
                  <div className="ff-label-row">
                    <label>Contraseña</label>
                    <button type="button" className="ff-forgot-link" onClick={() => { setView("forgot"); setError(null); }}>
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
                      {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                    </button>
                  </div>
                </div>

                {error && <div className="ff-error-msg"><AlertIcon size={14} /> {error}</div>}

                <button disabled={loading} className="ff-submit-btn">
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <LogInIcon size={18} />}
                  {loading ? "Verificando..." : "Acceder al Panel"}
                </button>
              </form>
            ) : (
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
                      {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                      {loading ? "Enviando..." : "Enviar Instrucciones"}
                    </button>
                    
                    <button type="button" className="ff-back-btn" onClick={() => { setView("login"); setError(null); }}>
                      <ArrowLeft size={16} /> Volver al inicio
                    </button>
                  </form>
                ) : (
                  <div className="ff-success-announcement">
                    <div className="ff-icon-circle"><CheckIcon size={28} /></div>
                    <h3>¡Correo enviado!</h3>
                    <p>Hemos enviado instrucciones a <strong>{email}</strong>. Por favor, revisa tu bandeja de entrada o spam.</p>
                    <button type="button" className="ff-submit-btn" onClick={() => { setView("login"); setEmailSent(false); setPassword(""); }}>
                      Entendido, volver al Login
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="ff-form-footer">
              <ShieldIcon size={14} />
              <span>Plataforma con encriptación SSL de 256-bits</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        /* Reset básico y variables exactas del sistema FreshConnect */
        :root {
          --ff-green-dark: #224C22; /* El verde profundo del sidebar */
          --ff-green: #227432;
          --ff-orange: #D17711;
          --ff-bg: #e6efe2; /* Fondo corporativo exacto de tu AdminLayout */
        }
        
        .ff-login-viewport {
          min-height: 100vh; width: 100vw; display: flex; align-items: center; justify-content: center;
          background-color: var(--ff-bg); font-family: 'Poppins', sans-serif !important; padding: 20px;
          box-sizing: border-box;
        }

        .ff-login-viewport.checking { flex-direction: column; gap: 20px; color: var(--ff-green-dark); font-weight: 600; font-size: 14px; }
        .text-green-dark { color: var(--ff-green-dark); }

        .ff-login-container {
          display: flex; width: 100%; max-width: 1000px; min-height: 600px;
          background: white; border-radius: 24px; box-shadow: 0 25px 50px -12px rgba(34, 76, 34, 0.2);
          overflow: hidden; border: 1px solid rgba(34, 76, 34, 0.15);
        }

        /* LADO IZQUIERDO: VISUAL (Ahora con el Verde Puro) */
        .ff-login-visual {
          flex: 1; background: var(--ff-green-dark); color: white; position: relative;
          padding: 60px 40px; display: flex; flex-direction: column; justify-content: center; overflow: hidden;
        }
        
        /* Puntos negros al 10% en lugar de blancos para no lavar el verde oscuro */
        .ff-visual-pattern {
          position: absolute; inset: 0; opacity: 0.1; pointer-events: none;
          background-image: radial-gradient(black 1.5px, transparent 1.5px); background-size: 30px 30px;
        }

        .ff-visual-content { position: relative; z-index: 2; max-width: 400px; margin: 0 auto; }
        .ff-visual-content h2 { font-size: 32px; font-weight: 800; line-height: 1.2; margin: 0 0 15px; letter-spacing: -1px; }
        .ff-visual-content p { font-size: 14px; opacity: 0.8; line-height: 1.6; margin: 0 0 40px; }

        .ff-features { display: flex; flex-direction: column; gap: 16px; }
        .ff-f-item { display: flex; align-items: center; gap: 12px; font-size: 13px; font-weight: 600; opacity: 0.9; }
        .f-icon { width: 24px; height: 24px; background: rgba(255,255,255,0.1); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--ff-orange); }

        /* LADO DERECHO: FORMULARIO */
        .ff-login-form-side { flex: 1; display: flex; justify-content: center; align-items: center; padding: 40px; background: white; }
        .ff-form-inner { width: 100%; max-width: 360px; display: flex; flex-direction: column; }

        /* MODIFICACIÓN: Logo a 140px, centrado y con proporciones correctas */
        .ff-form-logo { width: 140px; height: auto; object-fit: contain; display: block; margin: 0 auto 40px auto; }
        
        .ff-form-header { margin-bottom: 30px; }
        .ff-form-header h1 { font-size: 24px; font-weight: 800; color: var(--ff-green-dark); margin: 0 0 6px; letter-spacing: -0.5px; }
        .ff-form-header p { font-size: 13px; color: var(--ff-green-dark); opacity: 0.6; margin: 0; font-weight: 500; }

        .ff-login-form { display: flex; flex-direction: column; gap: 20px; }
        .ff-input-group { display: flex; flex-direction: column; gap: 8px; }
        .ff-input-group label { font-size: 12px; font-weight: 700; color: var(--ff-green-dark); }
        
        .ff-input-group input {
          width: 100%; height: 48px; padding: 0 16px; border-radius: 12px;
          border: 1.5px solid rgba(34, 76, 34, 0.15); background: #fcfdfc;
          font-family: 'Poppins', sans-serif; font-size: 14px; font-weight: 600; color: var(--ff-green-dark);
          transition: all 0.2s ease; box-sizing: border-box;
        }
        .ff-input-group input::placeholder { opacity: 0.4; font-weight: 500; }
        .ff-input-group input:focus { border-color: var(--ff-green); background: white; outline: none; box-shadow: 0 0 0 4px rgba(34, 116, 50, 0.05); }

        .ff-label-row { display: flex; justify-content: space-between; align-items: center; }
        .ff-forgot-link { background: none; border: none; color: var(--ff-orange); font-size: 11px; font-weight: 700; cursor: pointer; padding: 0; transition: 0.2s; }
        .ff-forgot-link:hover { color: #b4660e; text-decoration: underline; }

        .ff-password-wrap { position: relative; display: flex; align-items: center; }
        .ff-password-wrap input { padding-right: 45px; }
        .ff-password-toggle {
          position: absolute; right: 12px; background: none; border: none; padding: 4px;
          color: var(--ff-green-dark); opacity: 0.4; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s;
        }
        .ff-password-toggle:hover { opacity: 1; color: var(--ff-green); }

        .ff-submit-btn {
          margin-top: 10px; height: 50px; border-radius: 12px; background: var(--ff-orange); color: white;
          border: none; font-size: 14px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 10px;
          cursor: pointer; transition: all 0.3s ease; box-shadow: 0 8px 20px rgba(209, 119, 17, 0.25);
          font-family: 'Poppins', sans-serif;
        }
        .ff-submit-btn:hover:not(:disabled) { transform: translateY(-2px); background: #b4660e; box-shadow: 0 12px 25px rgba(209, 119, 17, 0.35); }
        .ff-submit-btn:disabled { opacity: 0.7; cursor: not-allowed; box-shadow: none; }

        .ff-back-btn {
          background: none; border: none; color: var(--ff-green-dark); opacity: 0.6; display: flex; align-items: center; justify-content: center; gap: 8px;
          font-size: 13px; font-weight: 600; cursor: pointer; margin-top: 15px; font-family: 'Poppins', sans-serif; transition: 0.2s;
        }
        .ff-back-btn:hover { opacity: 1; color: var(--ff-green); }

        .ff-error-msg {
          background: #fff5f5; color: #ef4444; border: 1px solid #fecdd3; padding: 12px 14px; border-radius: 10px;
          font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 8px; line-height: 1.4;
        }

        /* PANTALLA DE ÉXITO (RECUPERACIÓN) */
        .ff-success-announcement { text-align: center; animation: modalSpring 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .ff-icon-circle { width: 56px; height: 56px; background: #e6efe2; color: var(--ff-green); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; border: 2px solid rgba(34,76,34,0.1); }
        .ff-success-announcement h3 { font-size: 20px; font-weight: 800; color: var(--ff-green-dark); margin: 0 0 10px; letter-spacing: -0.5px; }
        .ff-success-announcement p { font-size: 13px; color: var(--ff-green-dark); opacity: 0.7; line-height: 1.6; margin-bottom: 25px; }
        .ff-success-announcement strong { color: var(--ff-green-dark); font-weight: 700; opacity: 1; }

        .ff-form-footer { margin-top: 40px; display: flex; justify-content: center; align-items: center; gap: 8px; color: var(--ff-green-dark); opacity: 0.4; font-size: 11px; font-weight: 600; }

        @keyframes modalSpring { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }

        /* RESPONSIVE (MÓVIL) */
        @media (max-width: 850px) {
          .ff-login-container { flex-direction: column; min-height: auto; max-width: 450px; }
          .ff-login-visual { display: none; }
          .ff-login-form-side { padding: 40px 25px; }
          .ff-form-header { text-align: center; }
          .ff-form-header h1 { font-size: 22px; }
          .ff-form-logo { margin-bottom: 30px; }
        }
      `}</style>
    </div>
  );
}

// Icono de alerta simple para mensajes de error
function AlertIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  );
}