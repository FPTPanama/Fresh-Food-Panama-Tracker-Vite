import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { supabase } from "@/lib/supabaseClient";
import "./styles/globals.css";
import { LanguageProvider } from "@/lib/uiLanguage";
const StaffDetail = lazy(() => import('@/pages/admin/staff/StaffDetail'));

// --- COMPONENTE DE PROTECCIÓN DE RUTAS ---
const ProtectedRoute = ({ children, requiredRole }: { children: JSX.Element, requiredRole?: 'admin' | 'client' }) => {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          if (isMounted) { setAuthorized(false); setLoading(false); }
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (isMounted) {
          if (!profile) {
            setAuthorized(false);
          } else {
            // ARREGLO 1: El Admin siempre está autorizado para ver rutas de cliente
            // Si la ruta pide 'client', un 'admin' también puede entrar.
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

  if (loading) return (
    <div className="ff-loader-full">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-emerald-500"></div>
    </div>
  );

  if (!authorized) return <Navigate to="/login" state={{ from: location }} replace />;

  return children;
};

const PageLoader = () => <div className="ff-loader-full"><div className="animate-pulse text-emerald-500 font-bold">CARGANDO...</div></div>;

// --- CARGA DINÁMICA ---
const ClientShipments = lazy(() => import('./pages/shipments/ShipmentsPage'));
// ARREGLO 2: Debes crear/importar el detalle para el cliente o se irá al 404
const ClientShipmentDetail = lazy(() => import('./pages/shipments/[id]')); 

const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'));
const AdminLogin = lazy(() => import('@/pages/admin/login'));
const ClientLogin = lazy(() => import('@/pages/login'));
const AdminShipmentsIndex = lazy(() => import('@/pages/admin/shipments/index'));
const AdminShipmentDetail = lazy(() => import('@/pages/admin/shipments/[id]'));
const AdminQuotesIndex = lazy(() => import('@/pages/admin/quotes/index'));
const AdminQuoteDetailPage = lazy(() => import('@/pages/admin/quotes/[id]'));
const AdminUsers = lazy(() => import('@/pages/admin/users/index'));
const AdminUserDetail = lazy(() => import('@/pages/admin/users/UserDetail'));

export default function App() {
  return (
    <LanguageProvider>
      <Router>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<ClientLogin />} />
            <Route path="/admin/login" element={<AdminLogin />} />

            {/* --- PANEL DE CLIENTES --- */}
            <Route path="/shipments" element={<ProtectedRoute requiredRole="client"><ClientShipments /></ProtectedRoute>} />
            {/* ARREGLO 3: Ruta de detalle para cliente añadida para evitar el 404 */}
            <Route path="/shipments/:id" element={<ProtectedRoute requiredRole="client"><ClientShipmentDetail /></ProtectedRoute>} />

            {/* --- RUTAS ADMINISTRATIVAS --- */}
            <Route path="/admin/dashboard" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/shipments" element={<ProtectedRoute requiredRole="admin"><AdminShipmentsIndex /></ProtectedRoute>} />
            <Route path="/admin/shipments/:id" element={<ProtectedRoute requiredRole="admin"><AdminShipmentDetail /></ProtectedRoute>} />
            <Route path="/admin/quotes" element={<ProtectedRoute requiredRole="admin"><AdminQuotesIndex /></ProtectedRoute>} />
            <Route path="/admin/quotes/:id" element={<ProtectedRoute requiredRole="admin"><AdminQuoteDetailPage /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute requiredRole="admin"><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/users/:id" element={<ProtectedRoute requiredRole="admin"><AdminUserDetail /></ProtectedRoute>} />
            <Route path="/admin/staff/:id" element={<ProtectedRoute requiredRole="admin"><StaffDetail /></ProtectedRoute>} />

            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="*" element={<div className="p-20 text-center"><h1>404</h1><p>No encontrado</p></div>} />
          </Routes>
        </Suspense>
      </Router>
    </LanguageProvider>
  );
}