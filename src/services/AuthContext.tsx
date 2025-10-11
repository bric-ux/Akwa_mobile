import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, userData: any) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Vérifier l'état d'authentification au démarrage
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            user_metadata: session.user.user_metadata,
          });
        }
      } catch (error) {
        console.error('Erreur lors de la vérification de l\'authentification:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Écouter les changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            user_metadata: session.user.user_metadata,
          });
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, userData: any) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData,
      },
    });
    if (error) throw error;

    // Envoyer email de bienvenue si l'inscription réussit
    if (data.user) {
      console.log('🔄 Tentative d\'envoi d\'email de bienvenue...');
      console.log('📧 Email destinataire:', email);
      console.log('👤 Prénom:', userData.first_name || 'Utilisateur');
      
      try {
        const emailResult = await supabase.functions.invoke('send-email', {
          body: {
            type: 'welcome',
            to: email,
            data: {
              firstName: userData.first_name || 'Utilisateur'
            }
          }
        });
        
        console.log('✅ Email de bienvenue envoyé avec succès');
        console.log('📧 ID email:', emailResult.data?.id);
        console.log('📧 Réponse complète:', emailResult);
      } catch (emailError) {
        console.error('❌ Erreur envoi email de bienvenue:');
        console.error('❌ Type:', typeof emailError);
        console.error('❌ Message:', emailError.message);
        console.error('❌ Détails:', emailError);
        // Ne pas faire échouer l'inscription si l'email échoue
      }
    } else {
      console.warn('⚠️ Aucun utilisateur créé, email de bienvenue non envoyé');
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};