import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { supabase } from "@/lib/supabaseClient";
import "./styles/globals.css";
import { LanguageProvider } from "@/lib/uiLanguage";

const ProtectedRoute = ({ children, requiredRole }: { children: JSX.Element, requiredRole?: 'admin' | 'client' }) => {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // AJUSTE: Usamos location.pathname del Router, es más fiable que window.location
    const isResetFlow = location.pathname.includes('reset-password');
    if (isResetFlow) return; 

    let isMounted = true;
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (isMounted) { setAuthorized(false); setLoading(false); }
          return;
        }
        const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', session.user.id).maybeSingle();

        if (isMounted) {
          if (!profile) {
            setAuthorized(false);
          } else {
            const userRole = profile.role?.toLowerCase();
            if (requiredRole === 'client') {
              setAuthorized(userRole === 'client' || userRole === 'admin' || userRole === 'superadmin');
            } else if (requiredRole === 'admin') {
              setAuthorized(userRole === 'admin' || userRole === 'superadmin');
            } else {
              setAuthorized(true);
            }
          }
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) { setAuthorized(false); setLoading(false); }
      }
    };
    checkAuth();
    return () => { isMounted = false; };
  }, [location.pathname, requiredRole]);

  // AJUSTE: Si es reset, retornamos directamente sin evaluar authorized
  if (location.pathname.includes('reset-password')) return children;

  if (loading) return <div className="ff-loader-full"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-emerald-500"></div></div>;
  
  if (!authorized) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return children;
};

const PageLoader = () => <div className="ff-loader-full"><div className="animate-pulse text-emerald-500 font-bold">CARGANDO...</div></div>;

const ResetPasswordPage = lazy(() => import('./pages/auth/reset'));
const ClientDashboard = lazy(() => import('./pages/clients/Dashboard'));
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'));
const AdminLogin = lazy(() => import('@/pages/admin/login'));
const ClientLogin = lazy(() => import('@/pages/login'));
const ClientQuotesIndex = lazy(() => import('./pages/clients/quotes/index'));
const ClientQuoteDetail = lazy(() => import('./pages/clients/quotes/[id]'));
const ClientShipmentsIndex = lazy(() => import('./pages/clients/shipments/index'));
const ClientShipmentDetail = lazy(() => import('./pages/clients/shipments/[id]'));
const AdminShipmentsIndex = lazy(() => import('@/pages/admin/shipments/index'));
const AdminShipmentDetail = lazy(() => import('@/pages/admin/shipments/[id]'));
const AdminQuotesIndex = lazy(() => import('@/pages/admin/quotes/index'));
const AdminQuoteDetailPage = lazy(() => import('@/pages/admin/quotes/[id]'));
const AdminUsers = lazy(() => import('@/pages/admin/users/index'));
const AdminUserDetail = lazy(() => import('@/pages/admin/users/UserDetail'));
const StaffDetail = lazy(() => import('@/pages/admin/staff/StaffDetail'));

export default function App() {
  return (
    <LanguageProvider>
      <Router>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/login" element={<ClientLogin />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/auth/reset" element={<ResetPasswordPage />} />

            <Route path="/clients/dashboard" element={<ProtectedRoute requiredRole="client"><ClientDashboard /></ProtectedRoute>} />
            <Route path="/clients/quotes" element={<ProtectedRoute requiredRole="client"><ClientQuotesIndex /></ProtectedRoute>} />
            <Route path="/clients/quotes/:id" element={<ProtectedRoute requiredRole="client"><ClientQuoteDetail /></ProtectedRoute>} />
            <Route path="/clients/shipments" element={<ProtectedRoute requiredRole="client"><ClientShipmentsIndex /></ProtectedRoute>} />
            <Route path="/clients/shipments/:id" element={<ProtectedRoute requiredRole="client"><ClientShipmentDetail /></ProtectedRoute>} />

            <Route path="/admin/dashboard" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/shipments" element={<ProtectedRoute requiredRole="admin"><AdminShipmentsIndex /></ProtectedRoute>} />
            <Route path="/admin/shipments/:id" element={<ProtectedRoute requiredRole="admin"><AdminShipmentDetail /></ProtectedRoute>} />
            <Route path="/admin/quotes" element={<ProtectedRoute requiredRole="admin"><AdminQuotesIndex /></ProtectedRoute>} />
            <Route path="/admin/quotes/:id" element={<ProtectedRoute requiredRole="admin"><AdminQuoteDetailPage /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute requiredRole="admin"><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/users/:id" element={<ProtectedRoute requiredRole="admin"><AdminUserDetail /></ProtectedRoute>} />
            <Route path="/admin/staff/:id" element={<ProtectedRoute requiredRole="admin"><StaffDetail /></ProtectedRoute>} />

            <Route path="/" element={<HomeRedirect />} />
            <Route path="*" element={<div className="p-20 text-center"><h1>404</h1><p>Página no encontrada</p></div>} />
          </Routes>
        </Suspense>
      </Router>
    </LanguageProvider>
  );
}

const HomeRedirect = () => {
  const [destination, setDestination] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    // 1. EXTRAER EL TOKEN DE LA URL (SEARCH O HASH)
    const params = new URLSearchParams(window.location.search);
    const hasRecoveryToken = params.get('token_hash') || 
                             window.location.hash.includes('access_token') ||
                             params.get('type') === 'recovery';

    // 2. SI HAY TOKEN: No busques sesión, manda directo al componente de Reset
    if (hasRecoveryToken) {
      setDestination("/reset-password");
      return;
    }

    // 3. FLUJO NORMAL: Solo si no hay tokens de recuperación
    const getHome = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return setDestination("/login");

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle();

      setDestination(profile?.role === 'admin' || profile?.role === 'superadmin' 
        ? "/admin/dashboard" 
        : "/clients/dashboard");
    };
    getHome();
  }, [location.pathname]);

  if (!destination) return <PageLoader />;

  // Si vamos a reset, mantenemos los parámetros (el token_hash) en la URL
  const searchParams = window.location.search;
  const hashParams = window.location.hash;
  
  return <Navigate to={`${destination}${searchParams}${hashParams}`} replace />;
};