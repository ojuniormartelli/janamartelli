
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Lock, User, Eye, EyeOff, Database, X, Copy, Check, Server, Key, AlertTriangle, ArrowRight } from 'lucide-react';
import { dbSetupScript } from '../utils/database.sql';
import { useNavigate } from 'react-router-dom';
import { configureDatabase, isDbConfigured } from '../supabaseClient';

export const Login: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  
  // Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Setup/Config State
  const [needsSetup, setNeedsSetup] = useState(!isDbConfigured);
  const [configUrl, setConfigUrl] = useState('');
  const [configKey, setConfigKey] = useState('');

  // SQL Modal State
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
      // Se não estiver configurado, mostra tela de setup
      if (!isDbConfigured) {
          setNeedsSetup(true);
      } else {
          // Se acabou de configurar (reload), mostra o modal de SQL
          const shouldShowSql = localStorage.getItem('show_sql_on_load');
          if (shouldShowSql === 'true') {
              setShowSqlModal(true);
              localStorage.removeItem('show_sql_on_load');
          }
      }
  }, []);

  const handleConfigSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!configUrl || !configKey) {
          setError('URL e Chave são obrigatórios.');
          return;
      }
      // Salva e recarrega
      configureDatabase(configUrl, configKey);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await signIn(username, password);
    if (error) {
      setError('Falha ao entrar. Usuário ou senha incorretos.');
      setLoading(false);
    } else {
      navigate('/');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(dbSetupScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- TELA DE CONFIGURAÇÃO INICIAL (SE NÃO HOUVER BANCO) ---
  if (needsSetup) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-700">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-900/30 text-blue-400 mb-4">
                        <Database size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Conectar ao Banco de Dados</h1>
                    <p className="text-slate-400 text-sm">
                        Insira as credenciais do seu projeto Neon ou Supabase para conectar o aplicativo.
                    </p>
                </div>

                <form onSubmit={handleConfigSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-300 mb-1">
                            Project URL
                        </label>
                        <div className="relative">
                            <Server className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input
                                type="text"
                                value={configUrl}
                                onChange={(e) => setConfigUrl(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-600 font-mono text-sm"
                                placeholder="https://seu-projeto.supabase.co"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-300 mb-1">
                            Anon / Public API Key
                        </label>
                        <div className="relative">
                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input
                                type="text"
                                value={configKey}
                                onChange={(e) => setConfigKey(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-600 font-mono text-sm"
                                placeholder="eyJhbGciOiJIUzI1NiIsIn..."
                                required
                            />
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            * O aplicativo React se conecta via HTTPS. Não use a Connection String do Postgres aqui.
                        </p>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-900/30 border border-red-800 text-red-400 rounded-lg text-sm flex items-center">
                            <AlertTriangle size={16} className="mr-2" /> {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-lg shadow-blue-900/20 flex justify-center items-center"
                    >
                        Conectar <ArrowRight size={18} className="ml-2" />
                    </button>
                </form>
            </div>
        </div>
      );
  }

  // --- TELA DE LOGIN PADRÃO ---
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-4">
      {/* Modal de SQL */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] border border-slate-700">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                    <div>
                        <h3 className="font-bold text-xl dark:text-white flex items-center">
                            <Database className="mr-2 text-green-500" size={24} /> Configuração do Banco
                        </h3>
                        <p className="text-slate-500 text-sm mt-1">Conexão realizada! Agora crie as tabelas.</p>
                    </div>
                    <button onClick={() => setShowSqlModal(false)} className="text-slate-500 hover:text-white">
                        <X size={28} />
                    </button>
                </div>
                
                <div className="p-6 bg-slate-900 overflow-auto flex-1 border-y border-slate-700">
                    <div className="flex items-center gap-2 mb-4 text-blue-400 text-sm font-medium">
                        <ArrowRight size={16} />
                        <span>Copie o código abaixo e execute no SQL Editor do Neon/Supabase:</span>
                    </div>
                    <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap select-all p-4 bg-black rounded border border-slate-700">
                        {dbSetupScript}
                    </pre>
                </div>

                <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                    <p className="text-sm text-slate-500">
                        Após rodar o script, use o login padrão: <strong>admin</strong> / <strong>123456</strong>
                    </p>
                    <div className="flex gap-3">
                        <button 
                            onClick={copyToClipboard}
                            className="flex items-center px-4 py-2 bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-white rounded hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors font-medium"
                        >
                            {copied ? <Check size={18} className="mr-2" /> : <Copy size={18} className="mr-2" />}
                            {copied ? 'Copiado!' : 'Copiar SQL'}
                        </button>
                        <button 
                            onClick={() => setShowSqlModal(false)}
                            className="px-6 py-2 bg-primary-600 text-white rounded font-bold hover:bg-primary-700"
                        >
                            Ir para Login
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 text-primary-600 mb-4">
              <User size={24} />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Login</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">PijamaManager Pro</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-200 text-red-700 rounded-lg text-sm flex items-center">
            <AlertTriangle size={16} className="mr-2" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Usuário
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-slate-700 dark:text-white"
                placeholder="admin"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-slate-700 dark:text-white"
                placeholder="••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title={showPassword ? "Ocultar senha" : "Ver senha"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 flex justify-center items-center shadow-lg shadow-primary-900/20"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700 space-y-3 text-center">
            <button 
                onClick={() => setShowSqlModal(true)}
                className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 hover:underline"
            >
                Ver código SQL de instalação
            </button>
            
            <div className="text-xs text-slate-400">
                <button 
                    onClick={() => {
                         if(confirm('Isso irá desconectar o banco atual e pedir as credenciais novamente. Continuar?')) {
                             localStorage.removeItem('custom_supabase_url');
                             localStorage.removeItem('custom_supabase_key');
                             window.location.reload();
                         }
                    }}
                    className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                    Alterar Banco de Dados
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
