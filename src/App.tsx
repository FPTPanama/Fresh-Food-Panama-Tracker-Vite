import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { supabase } from "@/lib/supabaseClient";
import "./styles/globals.css";
import { LanguageProvider } from "@/lib/uiLanguage";
import CompanyProfile from "./pages/admin/CompanyProfile";
import MessageCenter from './pages/admin/MessageCenter';



// --- COMPONENTE DE CARGA ---
const PageLoader = () => (
  <div className="ff-loader-full">
    <div className="animate-pulse text-emerald-500 font-bold tracking-widest">
      FRESH CONNECT...
    </div>
  </div>
);

// --- PROTECTOR DE RUTAS OPTIMIZADO ---
const ProtectedRoute = ({ children, requiredRole }: { children: JSX.Element, requiredRole?: 'admin' | 'client' }) => {
  const [authState, setAuthState] = useState({ loading: true, authorized: false });
  const location = useLocation();

  useEffect(() => {
    // Si es flujo de reset, no validamos aquí
    if (location.pathname.includes('reset-password')) return; 

    let isMounted = true;

    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          if (isMounted) setAuthState({ loading: false, authorized: false });
          return;
        }

        // Traemos el rol del perfil
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (isMounted) {
          if (!profile) {
            setAuthState({ loading: false, authorized: false });
          } else {
            const userRole = profile.role?.toLowerCase();
            
            // Lógica de autorización por rol
            let isAuthorized = false;
            if (requiredRole === 'client') {
              isAuthorized = ['client', 'admin', 'superadmin'].includes(userRole);
            } else if (requiredRole === 'admin') {
              isAuthorized = ['admin', 'superadmin'].includes(userRole);
            } else {
              isAuthorized = true;
            }

            setAuthState({ loading: false, authorized: isAuthorized });
          }
        }
      } catch (err) {
        if (isMounted) setAuthState({ loading: false, authorized: false });
      }
    };

    checkAuth();
    return () => { isMounted = false; };
  }, [location.pathname, requiredRole]);

  // Bypass para reset de password
  if (location.pathname.includes('reset-password')) return children;

  if (authState.loading) return <PageLoader />;
  
  if (!authState.authorized) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return children;
};

// --- CARGA PEREZOSA DE PÁGINAS (Code Splitting) ---
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
const AdminLeads = lazy(() => import('./pages/admin/crm/LeadsIndex')); // <--- NUEVO
const CampaignsIndex = lazy(() => import('./pages/admin/crm/CampaignsIndex'));

// --- COMPONENTE DE REDIRECCIÓN INTELIGENTE ---
const HomeRedirect = () => {
  const [destination, setDestination] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasRecoveryToken = params.get('token_hash') || 
                             window.location.hash.includes('access_token') ||
                             params.get('type') === 'recovery';

    if (hasRecoveryToken) {
      setDestination("/reset-password");
      return;
    }

    const getHome = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setDestination("/login");
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle();

      const userRole = profile?.role?.toLowerCase();
      setDestination(userRole === 'admin' || userRole === 'superadmin' 
        ? "/admin/dashboard" 
        : "/clients/dashboard");
    };

    getHome();
  }, [location.pathname]);

  if (!destination) return <PageLoader />;
  
  return <Navigate to={`${destination}${window.location.search}${window.location.hash}`} replace />;
};

// --- APP COMPONENT ---
export default function App() {
  return (
    <LanguageProvider>
      <Router>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Rutas Públicas / Auth */}
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/login" element={<ClientLogin />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/auth/reset" element={<ResetPasswordPage />} />

            {/* Rutas Cliente */}
            <Route path="/clients/dashboard" element={<ProtectedRoute requiredRole="client"><ClientDashboard /></ProtectedRoute>} />
            <Route path="/clients/quotes" element={<ProtectedRoute requiredRole="client"><ClientQuotesIndex /></ProtectedRoute>} />
            <Route path="/clients/quotes/:id" element={<ProtectedRoute requiredRole="client"><ClientQuoteDetail /></ProtectedRoute>} />
            <Route path="/clients/shipments" element={<ProtectedRoute requiredRole="client"><ClientShipmentsIndex /></ProtectedRoute>} />
            <Route path="/clients/shipments/:id" element={<ProtectedRoute requiredRole="client"><ClientShipmentDetail /></ProtectedRoute>} />

            {/* Rutas Admin */}
            <Route path="/admin/dashboard" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/shipments" element={<ProtectedRoute requiredRole="admin"><AdminShipmentsIndex /></ProtectedRoute>} />
            <Route path="/admin/shipments/:id" element={<ProtectedRoute requiredRole="admin"><AdminShipmentDetail /></ProtectedRoute>} />
            <Route path="/admin/quotes" element={<ProtectedRoute requiredRole="admin"><AdminQuotesIndex /></ProtectedRoute>} />
            <Route path="/admin/quotes/:id" element={<ProtectedRoute requiredRole="admin"><AdminQuoteDetailPage /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute requiredRole="admin"><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/users/:id" element={<ProtectedRoute requiredRole="admin"><AdminUserDetail /></ProtectedRoute>} />
            <Route path="/admin/staff/:id" element={<ProtectedRoute requiredRole="admin"><StaffDetail /></ProtectedRoute>} />
            <Route path="/admin/company" element={<ProtectedRoute requiredRole="admin"><CompanyProfile /></ProtectedRoute>} />
            <Route path="/admin/messages" element={<ProtectedRoute requiredRole="admin"><MessageCenter /></ProtectedRoute>} />
            
            {/* MODULO CRM & IA */}
<Route path="/admin/crm/leads" element={<ProtectedRoute requiredRole="admin"><AdminLeads /></ProtectedRoute>} /> 
<Route path="/admin/crm/campaigns" element={<ProtectedRoute requiredRole="admin"><CampaignsIndex /></ProtectedRoute>} />

            {/* Redirecciones Finales */}
            <Route path="/" element={<HomeRedirect />} />
            <Route path="*" element={<div className="p-20 text-center"><h1>404</h1><p>Página no encontrada</p></div>} />
          </Routes>
        </Suspense>
      </Router>
    </LanguageProvider>
  );
}