import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Session, User } from '@supabase/supabase-js';
import { Profile } from '../types';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        // Se houver erro (ex: tabela auth não acessível ou url errada), apenas loga e segue
        if (error) {
            console.warn("Sessão não pôde ser recuperada:", error.message);
        }

        if (mounted) {
          setSession(data?.session ?? null);
          setUser(data?.session?.user ?? null);
          
          if (data?.session?.user) {
            await fetchProfile(data.session.user.id);
          } else {
            setLoading(false);
          }
        }
      } catch (err) {
        console.error("Erro crítico na inicialização da Auth:", err);
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      if (data && data.subscription) {
          data.subscription.unsubscribe();
      }
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      // Tenta buscar o perfil. Se a tabela não existir, vai cair no catch ou retornar erro.
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
          // Se o erro for "Row not found" (PGRST116), tenta criar. 
          // Se for erro de tabela inexistente (42P01), ignoramos para não travar a UI
          if (error.code === 'PGRST116') {
            const { data: userData } = await supabase.auth.getUser();
            if(userData.user?.email) {
                const username = userData.user.email.split('@')[0];
                try {
                    const { data: newProfile } = await supabase.from('profiles').insert({
                        id: userId,
                        username: username,
                        role: 'employee'
                    }).select().single();
                    setProfile(newProfile);
                } catch (insertError) {
                    console.error("Erro ao criar perfil automático:", insertError);
                }
            }
          }
      } else if (data) {
        setProfile(data);
      }
    } catch (err) {
      console.error("Erro ao buscar perfil:", err);
    } finally {
      // Sempre finaliza o loading para não travar na tela branca
      setLoading(false);
    }
  };

  const signIn = async (username: string, password: string) => {
    try {
      const email = `${username.toLowerCase().trim()}@app.com`;
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (err) {
      console.error("Erro no login:", err);
      return { error: err };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signIn, signOut }}>
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