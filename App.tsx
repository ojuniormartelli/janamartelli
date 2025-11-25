
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Inventory } from './pages/Inventory';
import { POS } from './pages/POS';
import { Dashboard } from './pages/Dashboard';
import { Settings } from './pages/Settings';

// Componente definido fora para evitar recriação a cada render
const Placeholder = ({ title }: { title: string }) => (
    <div className="p-10 text-center">
        <h2 className="text-2xl font-bold dark:text-white">{title}</h2>
        <p className="text-slate-500">Módulo em desenvolvimento</p>
    </div>
);

// Rota protegida simplificada (apenas layout, já que o usuário é sempre 'logado')
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loading } = useAuth();
  
  if (loading) {
      return (
          <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
          </div>
      );
  }
  
  return <Layout>{children}</Layout>;
};

const AppRoutes = () => {
    return (
        <Routes>
            {/* Redirecionar Login antigo para Home */}
            <Route path="/login" element={<Navigate to="/" replace />} />
            
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
            <Route path="/pos" element={<ProtectedRoute><POS /></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute><Placeholder title="Histórico de Vendas" /></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute><Placeholder title="Gestão de Clientes" /></ProtectedRoute>} />
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
