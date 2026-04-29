import React, { useState, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import { BackupReminder } from './components/BackupReminder';
import { supabase } from './supabaseClient';

// Componente Wrapper para rotas protegidas
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loading, user, signOut } = useAuth();
  const [autoLogoutTime, setAutoLogoutTime] = useState<number>(0);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    fetchSecurityConfig();
  }, [user]);

  const fetchSecurityConfig = async () => {
    if (!user || user.isBootstrap) return;
    const { data } = await supabase.from('store_settings').select('auto_logout_minutes').maybeSingle();
    if (data?.auto_logout_minutes) {
        setAutoLogoutTime(data.auto_logout_minutes);
        resetTimer();
    }
  };

  const resetTimer = () => {
    if (autoLogoutTime <= 0) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
        signOut();
        alert("Sua sessão expirou por inatividade por segurança.");
    }, autoLogoutTime * 60 * 1000);
  };

  useEffect(() => {
    if (autoLogoutTime > 0) {
        window.addEventListener('mousemove', resetTimer);
        window.addEventListener('keydown', resetTimer);
        window.addEventListener('mousedown', resetTimer);
        window.addEventListener('touchstart', resetTimer);
    }
    return () => {
        window.removeEventListener('mousemove', resetTimer);
        window.removeEventListener('keydown', resetTimer);
        window.removeEventListener('mousedown', resetTimer);
        window.removeEventListener('touchstart', resetTimer);
        if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [autoLogoutTime]);
  
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
  
  return (
    <Layout>
        <BackupReminder />
        {children}
    </Layout>
  );
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