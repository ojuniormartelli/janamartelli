
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
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
  X,
  Wallet,
  ShieldAlert
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { signOut, profile, user, refreshUser } = useAuth();
  const location = useLocation();
  const [darkMode, setDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [storeSettings, setStoreSettings] = useState({
      store_name: 'PijamaManager',
      theme_color: '#0ea5e9',
      logo_url: ''
  });

  // Security Force Update State
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [newAdminUser, setNewAdminUser] = useState('');
  const [newAdminPass, setNewAdminPass] = useState('');

  useEffect(() => {
    if (localStorage.getItem('theme') === 'dark') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
    
    if (!user?.isBootstrap) {
        fetchStoreSettings();
        checkSecurityStatus();
    }
  }, [user]);

  const checkSecurityStatus = async () => {
      // Se não é bootstrap (tem banco) e o usuário logado ainda é o 'admin'
      if (user && user.username === 'admin') {
          // Check if password is still the default from SQL (Gs020185*)
          const { data } = await supabase.from('profiles').select('password').eq('username', 'admin').single();
          if (data && data.password === 'Gs020185*') {
              setShowSecurityModal(true);
          }
      }
  };

  const handleCreateNewAdmin = async () => {
      if (!newAdminUser || !newAdminPass) return alert("Preencha todos os campos");
      if (newAdminPass.length < 6) return alert("Senha muito curta");

      // 1. Create NEW admin user
      const { error } = await supabase.from('profiles').insert({
          username: newAdminUser,
          password: newAdminPass,
          role: 'admin'
      });

      if (error) {
          alert("Erro ao criar novo usuário: " + error.message);
      } else {
          alert("Novo usuário administrador criado com sucesso! Por favor, faça login com ele.");
          await signOut();
      }
  };

  const fetchStoreSettings = async () => {
      const { data } = await supabase.from('store_settings').select('*').single();
      if (data) {
          setStoreSettings(data);
          document.title = data.store_name;
          if (data.logo_url) {
              const link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']") || document.createElement('link');
              link.type = 'image/png';
              link.rel = 'icon';
              link.href = data.logo_url;
              link.id = 'dynamic-favicon';
              document.getElementsByTagName('head')[0].appendChild(link);
          }
          if (data.theme_color) {
              document.documentElement.style.setProperty('--color-primary', data.theme_color);
          }
      }
  };

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
    { path: '/', icon: ShoppingCart, label: 'PDV / Caixa' },
    { path: '/financial', icon: Wallet, label: 'Financeiro' },
    { path: '/dashboard', icon: LayoutDashboard, label: 'Visão Geral' },
    { path: '/inventory', icon: Shirt, label: 'Estoque' },
    { path: '/sales', icon: History, label: 'Vendas' },
    { path: '/clients', icon: Users, label: 'Clientes' },
    { path: '/settings', icon: Settings, label: 'Configurações' },
  ];

  // Se for Bootstrap, esconde o menu lateral completo
  if (user?.isBootstrap) {
      return (
          <div className="flex h-screen bg-slate-50 dark:bg-slate-900 justify-center">
              <main className="flex-1 max-w-5xl p-8 overflow-auto">
                  {children}
              </main>
          </div>
      );
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      
      {/* SECURITY MODAL */}
      {showSecurityModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md p-8 border-2 border-red-500">
                  <div className="text-center mb-6">
                      <ShieldAlert size={48} className="mx-auto text-red-500 mb-2"/>
                      <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Ação Necessária</h2>
                      <p className="text-slate-600 dark:text-slate-300 mt-2">
                          Você está usando a conta de instalação padrão. Por segurança, crie agora o seu usuário administrador pessoal.
                      </p>
                  </div>
                  
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Seu Nome de Usuário</label>
                          <input 
                              className="w-full p-3 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                              placeholder="Ex: seu.nome"
                              value={newAdminUser} onChange={e => setNewAdminUser(e.target.value)}
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Sua Senha</label>
                          <input 
                              type="text"
                              className="w-full p-3 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                              placeholder="Mínimo 6 caracteres"
                              value={newAdminPass} onChange={e => setNewAdminPass(e.target.value)}
                          />
                      </div>
                      <button 
                          onClick={handleCreateNewAdmin}
                          className="w-full py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow-lg mt-4"
                      >
                          Criar Usuário e Acessar
                      </button>
                  </div>
              </div>
          </div>
      )}

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-800 shadow-xl transform transition-transform duration-300
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
            {storeSettings.logo_url && (
                <img src={storeSettings.logo_url} alt="Logo" className="w-10 h-10 object-contain rounded" />
            )}
            <div>
              <h1 className="text-xl font-bold text-primary-600 dark:text-primary-400 leading-tight">
                  {storeSettings.store_name}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Olá, {profile?.username}</p>
            </div>
            <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden text-slate-500 ml-auto">
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

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="lg:hidden bg-white dark:bg-slate-800 p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
             {storeSettings.logo_url && <img src={storeSettings.logo_url} className="w-8 h-8 object-contain"/>}
             <h1 className="font-bold text-slate-800 dark:text-white">{storeSettings.store_name}</h1>
          </div>
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
