import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Escala from "@/pages/Escala";
import Colaboradores from "@/pages/Colaboradores";
import Produtividade from "@/pages/Produtividade";
import FeriasProgramadas from "@/pages/FeriasProgramadas";
import Compensacoes from "@/pages/Compensacoes";
import AvisosPrevios from "@/pages/AvisosPrevios";
import Afastamentos from "@/pages/Afastamentos";
import CalendarioRH from "@/pages/CalendarioRH";
import GerenciarUsuarios from "@/pages/GerenciarUsuarios";
import RegistroPonto from "@/pages/RegistroPonto";
import CheckoutPage from "@/pages/Checkout";
import Manutencoes from "@/pages/Manutencoes";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import type { Perfil } from "@/contexts/AuthContext";

const queryClient = new QueryClient();

function ProtectedRoute({ children, allowedRoles }: { children: ReactNode; allowedRoles?: Perfil[] }) {
  const { session, usuario, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!usuario) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(usuario.perfil)) {
    const fallback = usuario.perfil === 'lider' ? '/escala' : '/';
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/" element={<ProtectedRoute allowedRoles={['admin', 'gestor', 'visualizador']}><Dashboard /></ProtectedRoute>} />
        <Route path="/escala" element={<ProtectedRoute><Escala /></ProtectedRoute>} />
        <Route path="/calendario-rh" element={<ProtectedRoute allowedRoles={['admin', 'gestor']}><CalendarioRH /></ProtectedRoute>} />
        <Route path="/colaboradores" element={<ProtectedRoute allowedRoles={['admin', 'gestor']}><Colaboradores /></ProtectedRoute>} />
        <Route path="/produtividade" element={<ProtectedRoute allowedRoles={['admin', 'gestor']}><Produtividade /></ProtectedRoute>} />
        <Route path="/ferias" element={<ProtectedRoute allowedRoles={['admin', 'gestor']}><FeriasProgramadas /></ProtectedRoute>} />
        <Route path="/compensacoes" element={<ProtectedRoute allowedRoles={['admin', 'gestor']}><Compensacoes /></ProtectedRoute>} />
        <Route path="/avisos-previos" element={<ProtectedRoute allowedRoles={['admin', 'gestor']}><AvisosPrevios /></ProtectedRoute>} />
        <Route path="/afastamentos" element={<ProtectedRoute allowedRoles={['admin', 'gestor']}><Afastamentos /></ProtectedRoute>} />
        <Route path="/usuarios" element={<ProtectedRoute allowedRoles={['admin']}><GerenciarUsuarios /></ProtectedRoute>} />
        <Route path="/registro-ponto" element={<ProtectedRoute allowedRoles={['admin', 'gestor']}><RegistroPonto /></ProtectedRoute>} />
        <Route path="/checkout" element={<ProtectedRoute allowedRoles={['admin', 'gestor', 'lider']}><CheckoutPage /></ProtectedRoute>} />
        <Route path="/manutencoes" element={<ProtectedRoute allowedRoles={['admin', 'gestor', 'lider']}><Manutencoes /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
