import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';

export type Perfil = 'admin' | 'gestor' | 'lider' | 'visualizador';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  status: string;
}

interface AuthContextType {
  session: Session | null;
  usuario: Usuario | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  const clearAuthState = () => {
    setUsuario(null);
    setSession(null);
  };

  const fetchUsuario = async (userId: string): Promise<Usuario | null> => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', userId)
      .single();
    if (error || !data) return null;
    return data as Usuario;
  };

  const resolveUsuario = async (currentSession: Session | null) => {
    setSession(currentSession);

    if (!currentSession?.user) {
      setUsuario(null);
      setLoading(false);
      return;
    }

    const u = await fetchUsuario(currentSession.user.id);

    if (!u || u.status === 'inativo') {
      await supabase.auth.signOut();
      clearAuthState();
      setLoading(false);
      return;
    }

    setUsuario(u);
    setLoading(false);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, currentSession) => {
        setLoading(true);
        setTimeout(() => {
          resolveUsuario(currentSession);
        }, 0);
      }
    );

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      resolveUsuario(currentSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<string | null> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return 'Email ou senha incorretos';

    if (data.user) {
      const u = await fetchUsuario(data.user.id);
      if (!u || u.status === 'inativo') {
        await supabase.auth.signOut();
        clearAuthState();
        return 'Email ou senha incorretos';
      }
      setSession(data.session);
      setUsuario(u);
    }
    return null;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    clearAuthState();
  };

  return (
    <AuthContext.Provider value={{ session, usuario, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
