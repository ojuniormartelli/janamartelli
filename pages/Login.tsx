
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Lock, User, Eye, EyeOff, AlertTriangle, Database, X, Check, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { dbSetupScript } from '../utils/database.sql';

export const Login: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  
  // Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Install Modal State
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [masterPass, setMasterPass] = useState('');
  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await signIn(username, password);
    if (error) {
      setError(typeof error === 'string' ? error : 'Falha ao entrar. Usuário ou senha incorretos.');
      setLoading(false);
    } else {
      navigate('/');
    }
  };

  const handleOpenInstall = () => {
      setMasterPass('');
      setShowSql(false);
      setShowInstallModal(true);
  };

  const handleVerifyMasterPass = () => {
      if (masterPass === 'Gs020185*') {
          setShowSql(true);
      } else {
          alert('Senha Mestra Incorreta');
      }
  };

  const handleCopySql = () => {
      navigator.clipboard.writeText(dbSetupScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 text-primary-600 mb-4">
              <User size={24} />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Bem-vindo</h1>
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
                placeholder="Usuário"
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
                placeholder="Senha"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
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

        <div className="mt-8 text-center">
            <button 
                onClick={handleOpenInstall}
                className="text-xs text-slate-400 hover:text-primary-500 flex items-center justify-center mx-auto gap-1 transition-colors"
            >
                <Database size={12} /> Instalação / SQL
            </button>
        </div>
      </div>

      {/* MODAL DE INSTALAÇÃO / SQL */}
      {showInstallModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                  <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                      <h3 className="font-bold dark:text-white flex items-center">
                          <Database className="mr-2 text-primary-500" size={20}/> 
                          Configuração de Banco de Dados
                      </h3>
                      <button onClick={() => setShowInstallModal(false)}><X size={20} className="text-slate-400"/></button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto">
                      {!showSql ? (
                          <div className="space-y-4">
                              <p className="text-slate-600 dark:text-slate-300 text-sm">
                                  Para visualizar o Script SQL de instalação, insira a <b>Senha Mestra</b> do sistema.
                              </p>
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Senha Mestra</label>
                                  <input 
                                      type="password"
                                      className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                      value={masterPass}
                                      onChange={e => setMasterPass(e.target.value)}
                                      onKeyDown={e => e.key === 'Enter' && handleVerifyMasterPass()}
                                  />
                              </div>
                              <button 
                                  onClick={handleVerifyMasterPass}
                                  className="w-full py-2 bg-slate-800 text-white rounded font-bold hover:bg-slate-700"
                              >
                                  Acessar SQL
                              </button>
                          </div>
                      ) : (
                          <div className="space-y-4">
                              <div className="bg-green-50 text-green-800 p-3 rounded border border-green-200 text-sm">
                                  <p className="font-bold">Acesso Liberado.</p>
                                  <p>Copie o código abaixo e execute no SQL Editor do seu projeto Supabase/Neon.</p>
                              </div>
                              <div className="relative">
                                  <pre className="bg-slate-900 text-green-400 p-4 rounded-lg text-xs font-mono overflow-auto max-h-96 select-all">
                                      {dbSetupScript}
                                  </pre>
                                  <button 
                                      onClick={handleCopySql}
                                      className="absolute top-2 right-2 px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-xs flex items-center backdrop-blur-sm"
                                  >
                                      {copied ? <Check size={14} className="mr-1"/> : <Copy size={14} className="mr-1"/>}
                                      {copied ? 'Copiado' : 'Copiar'}
                                  </button>
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
