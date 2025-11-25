import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Inventory } from './pages/Inventory';
import { POS } from './pages/POS';
import { Dashboard } from './pages/Dashboard';
import { Settings } from './pages/Settings';

// Placeholder for Client/Sales pages which follow similar patterns
const Placeholder = ({ title }: { title: string }) => (
    <div className="p-10 text-center">
        <h2 className="text-2xl font-bold dark:text-white">{title}</h2>
        <p className="text-slate-500">Módulo em desenvolvimento</p>
    </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading } = useAuth();
  
  if (loading) return <div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;
  if (!session) return <Navigate to="/login" />;

  return <Layout>{children}</Layout>;
};

const AppRoutes = () => {
    const { session } = useAuth();
    return (
        <Routes>
            <Route path="/login" element={session ? <Navigate to="/" /> : <Login />} />
            
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
            <Route path="/pos" element={<ProtectedRoute><POS /></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute><Placeholder title="Histórico de Vendas" /></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute><Placeholder title="Gestão de Clientes" /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            
            <Route path="*" element={<Navigate to="/" />} />
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
