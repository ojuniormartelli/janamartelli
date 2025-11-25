
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Profile } from '../types';
import { supabase } from '../supabaseClient';

interface AuthContextType {
  user: Profile | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
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
    // Optional: reload to clear states
    window.location.reload();
  };

  return (
    <AuthContext.Provider value={{ user, profile: user, loading, signIn, signOut }}>
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
