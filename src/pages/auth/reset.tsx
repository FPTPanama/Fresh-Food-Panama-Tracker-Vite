import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, CheckCircle2, AlertTriangle, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

type ViewState = "checking" | "ready" | "done" | "error";

function isStrongEnough(pw: string) {
  if (!pw) return false;
  const okLen = pw.length >= 8;
  const hasLetter = /[A-Za-z]/.test(pw);
  const hasNumber = /\d/.test(pw);
  return okLen && hasLetter && hasNumber;
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();

  const [view, setView] = useState<ViewState>("checking");
  const [msg, setMsg] = useState<string | null>(null);

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");

  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);

  const [saving, setSaving] = useState(false);

  const canSave = useMemo(() => {
    if (!pw1 || !pw2) return false;
    if (pw1 !== pw2) return false;
    if (!isStrongEnough(pw1)) return false;
    return true;
  }, [pw1, pw2]);

  useEffect(() => {
    let alive = true;
    // Bloqueo para evitar doble ejecución en StrictMode o re-renders
    let isProcessing = false;

    const handleAuth = async () => {
      if (isProcessing) return;

      try {
        // 1. Verificamos si ya existe una sesión (evita re-validar el hash si ya entró)
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (existingSession && alive) {
          setView("ready");
          return;
        }

        // 2. Extraer parámetros de la URL
        const params = new URLSearchParams(window.location.search);
        const tokenHash = params.get('token_hash');
        const type = params.get('type') as any;

        // 3. Si hay un token_hash, lo validamos SOLO UNA VEZ
        if (tokenHash && type) {
          isProcessing = true;
          console.log("Validando token_hash por única vez...");
          
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type,
          });

          if (verifyError) {
            // Si el error es "invalid token" pero realmente ya tenemos sesión, ignoramos el error
            const { data: { session: confirmedSession } } = await supabase.auth.getSession();
            if (confirmedSession) {
              if (alive) setView("ready");
              return;
            }

            console.error("Error verifyOtp:", verifyError.message);
            if (alive) {
              setView("error");
              setMsg("El enlace es inválido o ha expirado. Por favor solicita uno nuevo.");
            }
            return;
          }

          if (alive) setView("ready");
          return;
        }

        // 4. Fallback: Escuchar eventos de Auth
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (alive && (event === "PASSWORD_RECOVERY" || session)) {
            setView("ready");
          }
        });

        // 5. Timeout de seguridad
        const timer = setTimeout(() => {
          if (alive && view === "checking") {
            setView("error");
            setMsg("No detectamos una sesión de recuperación válida.");
          }
        }, 7000);

        return () => {
          subscription.unsubscribe();
          clearTimeout(timer);
        };
      } catch (err) {
        console.error("Error en handleAuth:", err);
        if (alive) setView("error");
      }
    };

    handleAuth();
    return () => { alive = false; };
  }, []); // Dependencias vacías para ejecución única

  async function onSave() {
    if (!canSave || saving) return;
    setSaving(true);
    setMsg(null);

    try {
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      
      if (error) {
        setMsg(error.message || "No se pudo actualizar la contraseña.");
        setSaving(false);
        return;
      }

      setView("done");
      setSaving(false);
      
      await supabase.auth.signOut();

      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err) {
      setMsg("Ocurrió un error inesperado.");
      setSaving(false);
    }
  }

  return (
    <div className="wrap">
      <div className="card">
        <div className="head">
          <div className="brand">
            <img src="/brand/freshfood-logo.svg" alt="Fresh Food Panamá" className="logo" />
          </div>
          <div className="title">Restablecer contraseña</div>
          <div className="sub">Define una nueva clave para tu cuenta.</div>
        </div>

        <div className="ff-divider" style={{ margin: "12px 0", borderBottom: '1px solid #eee' }} />

        {view === "checking" ? (
          <div className="state">
            <div className="spinner" />
            <div>
              <div className="stateTitle">Validando enlace…</div>
              <div className="stateSub">Esto toma un instante.</div>
            </div>
          </div>
        ) : view === "error" ? (
          <div className="msgWarn">
            <div className="msgRow"><AlertTriangle size={16} /><b>Error</b></div>
            <div className="msgBody">{msg ?? "Enlace no válido."}</div>
            <div style={{ height: 10 }} />
            <div className="actions">
              <Link to="/login" className="btnSecondary"><ArrowLeft size={16} /> Volver a login</Link>
            </div>
          </div>
        ) : view === "done" ? (
          <div className="msgOk">
            <div className="msgRow"><CheckCircle2 size={16} /><b>¡Contraseña actualizada!</b></div>
            <div className="msgBody">Ya puedes iniciar sesión con tu nueva clave.</div>
            <div style={{ height: 10 }} />
            <div className="actions">
              <Link to="/login" className="btnPrimary">Ir al login</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="grid">
              <label className="field">
                <span className="lbl">Nueva contraseña</span>
                <div className="inputWrap">
                  <Lock size={16} />
                  <input
                    type={show1 ? "text" : "password"}
                    value={pw1}
                    onChange={(e) => setPw1(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                  />
                  <button type="button" className="eye" onClick={() => setShow1(!show1)}>
                    {show1 ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              <label className="field">
                <span className="lbl">Confirmar contraseña</span>
                <div className="inputWrap">
                  <Lock size={16} />
                  <input
                    type={show2 ? "text" : "password"}
                    value={pw2}
                    onChange={(e) => setPw2(e.target.value)}
                    placeholder="Repite la contraseña"
                  />
                  <button type="button" className="eye" onClick={() => setShow2(!show2)}>
                    {show2 ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
            </div>

            <div className="help">
              <span className={`dot ${isStrongEnough(pw1) ? "ok" : ""}`} />
              <span>8+ caracteres, 1 letra y 1 número.</span>
              {pw1 && pw2 && pw1 !== pw2 && <span className="bad">No coinciden.</span>}
            </div>

            <div className="actions" style={{ marginTop: 20 }}>
              <Link to="/login" className="btnSecondary">Cancelar</Link>
              <button className="btnPrimary" onClick={onSave} disabled={!canSave || saving}>
                {saving ? "Guardando…" : "Guardar contraseña"}
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        .wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px 14px; background: #f6f8fb; font-family: sans-serif; }
        .card { width: 100%; max-width: 450px; background: #fff; border: 1px solid rgba(15, 23, 42, 0.12); border-radius: 16px; padding: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
        .head { text-align: center; margin-bottom: 20px; }
        .logo { height: 40px; margin-bottom: 12px; }
        .title { font-size: 18px; font-weight: 800; color: #0f172a; }
        .sub { font-size: 13px; color: #64748b; margin-top: 4px; }
        .grid { display: grid; gap: 16px; margin-top: 20px; }
        .field { display: grid; gap: 8px; }
        .lbl { font-size: 12px; font-weight: 700; color: #475569; }
        .inputWrap { display: flex; align-items: center; gap: 10px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 12px; }
        .inputWrap input { flex: 1; border: none; outline: none; font-size: 14px; }
        .eye { border: none; background: none; color: #94a3b8; cursor: pointer; display: flex; }
        .help { display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 12px; color: #64748b; }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: #e2e8f0; }
        .dot.ok { background: #10b981; }
        .bad { color: #ef4444; font-weight: 700; margin-left: auto; }
        .actions { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        .btnPrimary { background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 10px; font-weight: 700; cursor: pointer; }
        .btnPrimary:disabled { opacity: 0.5; cursor: not-allowed; }
        .btnSecondary { text-decoration: none; color: #64748b; font-size: 12px; font-weight: 700; }
        .spinner { width: 20px; height: 20px; border: 2px solid #f3f3f3; border-top: 2px solid #10b981; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .state { display: flex; align-items: center; gap: 15px; justify-content: center; padding: 20px 0; }
        .stateTitle { font-weight: 700; color: #0f172a; }
        .stateSub { font-size: 12px; color: #64748b; }
        .msgWarn { background: #fff1f2; border: 1px solid #fecaca; padding: 16px; border-radius: 10px; color: #991b1b; }
        .msgRow { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
        .msgOk { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 10px; color: #166534; }
      `}</style>
    </div>
  );
}