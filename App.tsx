import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Inventory } from './pages/Inventory';
import { POS } from './pages/POS';
import { Dashboard } from './pages/Dashboard';
import { Financial } from './pages/Financial';
import { Settings } from './pages/Settings';
import { Clients } from './pages/Clients';
import { Sales } from './pages/Sales';
import { Login } from './pages/Login';

// Componente Wrapper para rotas protegidas
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loading, user } = useAuth();
  
  if (loading) {
      return (
          <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
          </div>
      );
  }

  if (!user) {
      return <Navigate to="/login" replace />;
  }

  // Se estiver em modo Bootstrap (Instalação), força a ida para Settings
  if (user.isBootstrap && window.location.hash !== '#/settings') {
      return <Navigate to="/settings" replace />;
  }
  
  return <Layout>{children}</Layout>;
};

// Componente Wrapper para a rota de Login (Redireciona se já logado)
const LoginRoute = () => {
    const { user, loading } = useAuth();
    
    if (loading) return null;
    
    if (user) {
        return <Navigate to="/" replace />;
    }
    
    return <Login />;
};

const AppRoutes = () => {
    return (
        <Routes>
            <Route path="/login" element={<LoginRoute />} />
            
            <Route path="/" element={<ProtectedRoute><POS /></ProtectedRoute>} />
            <Route path="/financial" element={<ProtectedRoute><Financial /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
};

export default App;