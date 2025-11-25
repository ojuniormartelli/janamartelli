
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Lock, User, Eye, EyeOff, Database, X, Copy, Check } from 'lucide-react';
import { dbSetupScript } from '../utils/database.sql';
import { useNavigate } from 'react-router-dom';

export const Login: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // SQL Modal State
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await signIn(username, password);
    if (error) {
      setError('Falha ao entrar. Verifique credenciais ou rode o script SQL.');
      setLoading(false);
    } else {
      // Login com sucesso, redirecionar para Home (PDV)
      navigate('/');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(dbSetupScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-4">
      {/* Modal de SQL para Primeiro Acesso */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <h3 className="font-bold text-lg dark:text-white flex items-center">
                        <Database className="mr-2" size={20} /> Script de Instalação (SQL)
                    </h3>
                    <button onClick={() => setShowSqlModal(false)} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white">
                        <X size={24} />
                    </button>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-900 overflow-auto flex-1">
                    <p className="text-sm text-slate-500 mb-2">
                        Copie este script e rode no Editor SQL do Supabase para criar as tabelas.
                    </p>
                    <pre className="text-xs text-slate-600 dark:text-green-400 font-mono whitespace-pre-wrap select-all">
                        {dbSetupScript}
                    </pre>
                </div>
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                    <button 
                        onClick={copyToClipboard}
                        className="flex items-center px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors font-medium"
                    >
                        {copied ? <Check size={18} className="mr-2" /> : <Copy size={18} className="mr-2" />}
                        {copied ? 'Copiado!' : 'Copiar SQL'}
                    </button>
                </div>
            </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">PijamaManager Pro</h1>
          <p className="text-slate-500 dark:text-slate-400">Entre com seu usuário de sistema</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nome de Usuário
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-slate-700 dark:text-white"
                placeholder="ex: admin"
                required
              />
            </div>
            <p className="text-xs text-slate-400 mt-1 ml-1">Usuário será convertido para email interno.</p>
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
                placeholder="••••••••"
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
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 flex justify-center items-center"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700 text-center">
            <button 
                onClick={() => setShowSqlModal(true)}
                className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 flex items-center justify-center w-full group"
            >
                <Database size={16} className="mr-2 group-hover:scale-110 transition-transform" />
                Configurar Banco de Dados (SQL)
            </button>
        </div>
      </div>
    </div>
  );
};
