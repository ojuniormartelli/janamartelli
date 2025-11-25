
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Profile } from '../types';

// Mock types since we are bypassing real auth
interface Session { user: any }
interface User { id: string; email: string }

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
    // MODO DEMO: Auto-login imediato
    const demoUser = {
        id: '00000000-0000-0000-0000-000000000000',
        email: 'demo@pijama.app'
    };
    
    const demoProfile: Profile = {
        id: demoUser.id,
        username: 'Admin Demo',
        role: 'admin'
    };

    setUser(demoUser);
    setProfile(demoProfile);
    setSession({ user: demoUser });
    setLoading(false);
  }, []);

  const signIn = async (username: string, password: string) => {
    // Fake success
    return { error: null };
  };

  const signOut = async () => {
    window.location.reload();
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
