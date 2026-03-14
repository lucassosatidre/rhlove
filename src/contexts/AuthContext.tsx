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

  const fetchUsuario = async (userId: string): Promise<Usuario | null> => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', userId)
      .single();
    if (error || !data) return null;
    return data as Usuario;
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        if (session?.user) {
          // Use setTimeout to avoid Supabase client deadlock
          setTimeout(async () => {
            const u = await fetchUsuario(session.user.id);
            if (u && u.status === 'inativo') {
              await supabase.auth.signOut();
              setUsuario(null);
              setSession(null);
            } else {
              setUsuario(u);
            }
            setLoading(false);
          }, 0);
        } else {
          setUsuario(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchUsuario(session.user.id).then(u => {
          if (u && u.status === 'inativo') {
            supabase.auth.signOut();
            setUsuario(null);
            setSession(null);
          } else {
            setUsuario(u);
          }
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
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
        return 'Email ou senha incorretos';
      }
      setUsuario(u);
    }
    return null;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUsuario(null);
    setSession(null);
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
