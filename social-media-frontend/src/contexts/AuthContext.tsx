import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@/types/auth.types';
import { login as apiLogin, logout as apiLogout } from '@/api/auth';
import toast from 'react-hot-toast';
import { getCurrentUser } from '@/api/users';
import { unwrapData } from '@/api/envelope';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string, mfaCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      refreshUser().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const refreshUser = async () => {
    try {
      const response = await getCurrentUser();
      setUser(unwrapData<User>(response.data));
    } catch (error) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
    }
  };

  const login = async (username: string, password: string, mfaCode?: string) => {
    try {
      const response = await apiLogin({ username, password , ...(mfaCode?.trim() ? { mfa_code: mfaCode.trim() } : {}) });
      const loginData = unwrapData<any>(response.data);
      
      if (loginData.mfa_required) {
        throw new Error('MFA_REQUIRED');
      }

      localStorage.setItem('accessToken', loginData.tokens.access_token);
      localStorage.setItem('refreshToken', loginData.tokens.refresh_token);

      await refreshUser();
      toast.success('Login effettuato con successo!');
    } catch (error: any) {
      if (error.message === 'MFA_REQUIRED') {
        throw error;
      }
      toast.error(error.response?.data?.error || 'Errore durante il login');
      throw error;
    }
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
      toast.success('Logout effettuato');
    }
  };

  const updateUser = (updates: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
