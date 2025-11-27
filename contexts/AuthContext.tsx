
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
    // 1. MODO BOOTSTRAP (Sem Banco de Dados Configurado)
    if (!isDbConfigured) {
        if (username === 'admin' && password === '123456') {
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
            return { error: 'Credenciais inválidas para configuração inicial.' };
        }
    }

    // 2. MODO PRODUÇÃO (Banco Configurado)
    try {
        // Real database check
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('username', username)
            // Note: In production, passwords should be hashed (e.g. bcrypt). 
            // We are comparing plain text as requested for this custom implementation.
            .eq('password', password) 
            .single();

        if (error || !data) {
            return { error: 'Usuário ou senha incorretos' };
        }

        const profile: Profile = data;
        setUser(profile);
        localStorage.setItem('pijama_user', JSON.stringify(profile));
        return { error: null };

    } catch (e) {
        return { error: e };
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
