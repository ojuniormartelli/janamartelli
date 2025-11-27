
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Profile } from '../types';
import { supabase, isDbConfigured } from '../supabaseClient';

interface AuthContextType {
  user: Profile | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is stored in local storage to persist session
    const storedUser = localStorage.getItem('pijama_user');
    if (storedUser) {
        try {
            const parsed = JSON.parse(storedUser);
            setUser(parsed);
        } catch (e) {
            localStorage.removeItem('pijama_user');
        }
    }
    setLoading(false);
  }, []);

  const signIn = async (username: string, password: string) => {
    // Trim credentials to avoid space errors
    const safeUser = username.trim();
    const safePass = password.trim();

    // 1. MODO BOOTSTRAP (Sem Banco de Dados Configurado)
    if (!isDbConfigured) {
        // Fallback apenas para uso local/manual antes de configurar o banco
        if (safeUser === 'admin' && safePass === '123456') { 
             const bootstrapUser: Profile = {
                id: 'bootstrap',
                username: 'admin',
                role: 'admin',
                isBootstrap: true
            };
            setUser(bootstrapUser);
            localStorage.setItem('pijama_user', JSON.stringify(bootstrapUser));
            return { error: null };
        } else {
            return { error: 'Credenciais inválidas ou banco não configurado.' };
        }
    }

    // 2. MODO PRODUÇÃO (Banco Configurado)
    try {
        // Real database check
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('username', safeUser)
            .eq('password', safePass) 
            .single();

        if (error || !data) {
            return { error: 'Usuário ou senha incorretos (ou erro de conexão)' };
        }

        const profile: Profile = data;
        setUser(profile);
        localStorage.setItem('pijama_user', JSON.stringify(profile));
        return { error: null };

    } catch (e) {
        return { error: 'Erro de conexão ao tentar logar.' };
    }
  };

  const signOut = async () => {
    setUser(null);
    localStorage.removeItem('pijama_user');
    window.location.reload();
  };

  const refreshUser = async () => {
      if (user && !user.isBootstrap) {
          const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
          if (data) {
              setUser(data);
              localStorage.setItem('pijama_user', JSON.stringify(data));
          }
      }
  };

  return (
    <AuthContext.Provider value={{ user, profile: user, loading, signIn, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
