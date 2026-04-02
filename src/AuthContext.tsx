import React, { createContext, useContext, useEffect, useState } from 'react';
import { EduService } from './EduService';
import { AuthUser, RegisterPayload } from './types';

type WindowWithProgressFlush = Window & {
  __edumasterFlushProgress?: () => Promise<void>;
};

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  refreshSession: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = async () => {
    const sessionUser = await EduService.restoreSession();
    setUser(sessionUser);
  };

  useEffect(() => {
    refreshSession().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleAuthExpired = () => {
      setUser(null);
    };

    window.addEventListener('edumaster:auth-expired', handleAuthExpired);
    return () => {
      window.removeEventListener('edumaster:auth-expired', handleAuthExpired);
    };
  }, []);

  const login = async (email: string, password: string) => {
    const response = await EduService.login(email, password);
    setUser(response.user);
  };

  const register = async (payload: RegisterPayload) => {
    const response = await EduService.register(payload);
    setUser(response.user);
  };

  const logout = async () => {
    if (typeof window !== 'undefined') {
      try {
        await (window as WindowWithProgressFlush).__edumasterFlushProgress?.();
      } catch (error) {
        console.error('Failed to flush lesson progress before logout:', error);
      }
    }

    await EduService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin: user?.role === 'admin',
        login,
        register,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
