
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Lock, User, Eye, EyeOff, AlertTriangle, Database, X, Check, Copy, Wifi, WifiOff, Info, Wand2, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fullInstallScript, patchSizesScript } from '../utils/database.sql';
import { isDbConfigured, supabase } from '../supabaseClient';

export const Login: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [envDebugInfo, setEnvDebugInfo] = useState<string>('');

  const [showInstallModal, setShowInstallModal] = useState(false);
  const [masterPass, setMasterPass] = useState('');
  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
      checkConnection();
  }, []);

  const checkConnection = async () => {
      if (!isDbConfigured) {
          setConnectionStatus('error');
          setEnvDebugInfo(`Variáveis de ambiente não encontradas.`);
          return;
      }
      try {
          const { error } = await supabase.from('store_settings').select('id').limit(1);
          if (!error || error.code === 'PGRST301' || error.code === '42P01') { 
             setConnectionStatus('connected');
          } else {
             setConnectionStatus('error');
          }
      } catch (e: any) {
          setConnectionStatus('error');
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await signIn(username, password);
    if (error) {
      setError(typeof error === 'string' ? error : 'Falha ao entrar.');
      setLoading(false);
    } else {
      navigate('/');
    }
  };

  const handleVerifyMasterPass = () => {
      if (masterPass === 'Gs020185*') {
          setShowSql(true);
      } else {
          alert('Senha Mestra Incorreta');
      }
  };

  const handleCopySql = (sql: string, id: string) => {
      navigator.clipboard.writeText(sql);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-md relative border dark:border-slate-700">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-100 dark:bg-primary-900/30 text-primary-600 mb-4 shadow-sm">
              <User size={32} />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2 tracking-tight">PijamaManager Pro</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Acesse seu painel de controle</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl text-sm flex items-center shadow-sm animate-in shake duration-300">
            <AlertTriangle size={18} className="mr-3 shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Usuário</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text" 
                autoComplete="username"
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                className="w-full pl-12 pr-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-primary-500 transition-all outline-none font-medium" 
                placeholder="Ex: admin" 
                required 
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Senha</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type={showPassword ? "text" : "password"} 
                autoComplete="current-password"
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="w-full pl-12 pr-12 py-3 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-primary-500 transition-all outline-none font-medium tracking-widest" 
                placeholder="••••••••" 
                required 
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-4 rounded-xl transition-all flex justify-center items-center shadow-lg shadow-primary-500/30 disabled:opacity-50 active:scale-95">
            {loading ? <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" /> : 'Entrar no Sistema'}
          </button>
        </form>

        <div className="mt-10 pt-6 border-t dark:border-slate-700 flex justify-between items-center">
            <div className="flex items-center text-xs text-slate-400">
                {connectionStatus === 'connected' ? (
                    <span className="flex items-center text-green-500 font-bold bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full"><Wifi size={12} className="mr-1"/> Conectado</span>
                ) : (
                    <span className="flex items-center text-red-400 font-bold bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-full"><WifiOff size={12} className="mr-1"/> Offline</span>
                )}
            </div>
            <button onClick={() => setShowInstallModal(true)} className="text-xs text-slate-400 hover:text-primary-500 flex items-center gap-1 transition-colors font-medium">
                <Database size={12} /> Instalação
            </button>
        </div>
      </div>

      {showInstallModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                  <div className="p-5 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                      <h3 className="font-bold dark:text-white flex items-center gap-2"><Database className="text-primary-500" size={20}/> Scripts SQL</h3>
                      <button onClick={() => setShowInstallModal(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"><X size={20} className="text-slate-400"/></button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto">
                      {!showSql ? (
                          <div className="space-y-6 max-w-xs mx-auto py-10 text-center">
                              <p className="text-slate-600 dark:text-slate-300 text-sm">Insira a <b>Senha Mestra</b> para visualizar os scripts.</p>
                              <input type="password" className="w-full p-3 border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white text-center text-xl tracking-widest font-bold" value={masterPass} onChange={e => setMasterPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleVerifyMasterPass()}/>
                              <button onClick={handleVerifyMasterPass} className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 shadow-md">Acessar Scripts</button>
                          </div>
                      ) : (
                          <div className="space-y-8">
                              <div className="space-y-3">
                                  <div className="flex justify-between items-center">
                                      <h4 className="font-bold text-sm text-blue-600 flex items-center">Script de Correção (Patch)</h4>
                                      <button onClick={() => handleCopySql(patchSizesScript, 'patch')} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold shadow-sm active:scale-95 transition-all">
                                          {copied === 'patch' ? 'Copiado!' : 'Copiar Patch'}
                                      </button>
                                  </div>
                                  <pre className="bg-slate-900 text-blue-300 p-4 rounded-xl text-[10px] font-mono overflow-auto max-h-40 border border-slate-700 shadow-inner">{patchSizesScript}</pre>
                              </div>
                              <div className="space-y-3">
                                  <div className="flex justify-between items-center">
                                      <h4 className="font-bold text-sm text-slate-800 dark:text-white flex items-center">Instalação Completa</h4>
                                      <button onClick={() => handleCopySql(fullInstallScript, 'full')} className="px-4 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold active:scale-95 transition-all">
                                          {copied === 'full' ? 'Copiado!' : 'Copiar Full'}
                                      </button>
                                  </div>
                                  <pre className="bg-slate-900 text-green-400 p-4 rounded-xl text-[10px] font-mono overflow-auto max-h-40 border border-slate-700 shadow-inner">{fullInstallScript}</pre>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
