import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { supabase } from './supabase';
import { User } from '../types';
import { log, logError, logWarn } from '../utils/logger';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  updateRequired: boolean;
  updateTitle?: string;
  updateMessage?: string;
  updateIosUrl?: string;
  updateAndroidUrl?: string;
  /** Re-lit la session stockée et réaligne `user` (utile après un geste natif / état transitoire). */
  recoverSession: () => Promise<void>;
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
  const [updateRequired, setUpdateRequired] = useState(false);
  const [updateTitle, setUpdateTitle] = useState<string | undefined>(undefined);
  const [updateMessage, setUpdateMessage] = useState<string | undefined>(undefined);
  const [updateIosUrl, setUpdateIosUrl] = useState<string | undefined>(undefined);
  const [updateAndroidUrl, setUpdateAndroidUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    // Vérifier l'état d'authentification au démarrage
    const checkAuth = async () => {
      try {
        // 1) Check MAJ obligatoire (avant login / session restore)
        try {
          const build =
            Platform.OS === 'ios'
              ? Number(Application.nativeBuildVersion ?? NaN)
              : Number(Application.nativeBuildVersion ?? NaN);

          const { data: cfg, error: cfgErr } = await supabase
            .from('app_min_versions')
            .select('min_ios_build, min_android_build, force_update, title, message, ios_store_url, android_store_url')
            .eq('id', 1)
            .maybeSingle();

          if (!cfgErr && cfg?.force_update) {
            const minBuild = Platform.OS === 'ios' ? Number(cfg.min_ios_build ?? NaN) : Number(cfg.min_android_build ?? NaN);
            if (Number.isFinite(minBuild) && Number.isFinite(build) && build < minBuild) {
              setUpdateRequired(true);
              setUpdateTitle(cfg.title ?? 'Mise à jour requise');
              setUpdateMessage(cfg.message ?? 'Veuillez mettre à jour l’application pour continuer.');
              setUpdateIosUrl(cfg.ios_store_url ?? undefined);
              setUpdateAndroidUrl(cfg.android_store_url ?? undefined);
              setUser(null);
              return;
            }
          }
        } catch (e) {
          // En cas d’erreur réseau/config, ne pas bloquer (on garde le comportement actuel)
          logWarn('[Auth] Update check failed:', e);
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            user_metadata: session.user.user_metadata,
          });
        }
      } catch (error) {
        logError('Erreur lors de la vérification de l\'authentification:', error);
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
          // Ne pas vider user sur tout événement avec session null (ex. transitions internes),
          // sinon l’onglet Profil affiche « Redirection… » puis reste bloqué si la navigation échoue.
          const shouldClearUser =
            event === 'SIGNED_OUT' ||
            event === 'USER_DELETED' ||
            (event === 'INITIAL_SESSION' && !session);
          if (shouldClearUser) {
            setUser(null);
          }
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
      log('🔄 Tentative d\'envoi d\'email de bienvenue...');
      log('📧 Email destinataire:', email);
      log('👤 Prénom:', userData.first_name || 'Utilisateur');
      
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
        
        log('✅ Email de bienvenue envoyé avec succès');
        log('📧 ID email:', emailResult.data?.id);
        log('📧 Réponse complète:', emailResult);
      } catch (emailError: any) {
        logError('❌ Erreur envoi email de bienvenue:');
        logError('❌ Type:', typeof emailError);
        logError('❌ Message:', emailError.message);
        logError('❌ Détails:', emailError);
        // Ne pas faire échouer l'inscription si l'email échoue
      }
    } else {
      logWarn('⚠️ Aucun utilisateur créé, email de bienvenue non envoyé');
    }
  };

  const recoverSession = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        logError('recoverSession getSession:', error);
        return;
      }
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || '',
          user_metadata: session.user.user_metadata,
        });
      }
    } catch (e) {
      logError('recoverSession:', e);
    }
  }, []);

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      // Si la session est déjà manquante, considérer la déconnexion comme réussie
      if (error && error.message !== 'Auth session missing!' && error.message !== 'Auth session missing') {
        throw error;
      }
      // Mettre à jour le state local même si la session était déjà absente
      setUser(null);
    } catch (error: any) {
      // Si c'est une erreur de session manquante, on considère que la déconnexion est réussie
      if (error?.message?.includes('Auth session missing')) {
        setUser(null);
        return;
      }
      throw error;
    }
  };

  const value = {
    user,
    loading,
    updateRequired,
    updateTitle,
    updateMessage,
    updateIosUrl,
    updateAndroidUrl,
    recoverSession,
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