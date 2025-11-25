import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, 
  Shirt, 
  ShoppingCart, 
  History, 
  Users, 
  Settings, 
  LogOut, 
  Moon, 
  Sun,
  Menu,
  X
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { signOut, profile } = useAuth();
  const location = useLocation();
  const [darkMode, setDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('theme') === 'dark') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const menuItems = [
    { path: '/', icon: LayoutDashboard, label: 'Financeiro' },
    { path: '/inventory', icon: Shirt, label: 'Estoque' },
    { path: '/pos', icon: ShoppingCart, label: 'PDV / Caixa' },
    { path: '/sales', icon: History, label: 'Vendas' },
    { path: '/clients', icon: Users, label: 'Clientes' },
    { path: '/settings', icon: Settings, label: 'Configurações' },
  ];

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-800 shadow-xl transform transition-transform duration-300
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-primary-600 dark:text-primary-400">PijamaPro</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Olá, {profile?.username}</p>
            </div>
            <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden text-slate-500">
              <X size={24} />
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`
                    flex items-center px-4 py-3 rounded-lg transition-colors
                    ${isActive 
                      ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400' 
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'}
                  `}
                >
                  <Icon size={20} className="mr-3" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-slate-500 dark:text-slate-400">Tema Escuro</span>
              <button 
                onClick={toggleTheme}
                className="p-2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
              >
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
            <button
              onClick={() => signOut()}
              className="w-full flex items-center justify-center px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 transition-colors"
            >
              <LogOut size={18} className="mr-2" />
              Sair
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="lg:hidden bg-white dark:bg-slate-800 p-4 shadow-sm flex items-center justify-between">
          <h1 className="font-bold text-slate-800 dark:text-white">PijamaManager</h1>
          <button onClick={() => setMobileMenuOpen(true)} className="text-slate-600 dark:text-slate-300">
            <Menu size={24} />
          </button>
        </header>
        <div className="flex-1 overflow-auto p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};
