import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { authService } from '../services/auth/GoogleAuthService';
import { AuthUser, AuthSession } from '../services/auth/IAuthService';

interface AuthContextType {
  user: AuthUser | null;
  session: AuthSession | null;
  isLoading: boolean;
  /** Google Access Token (expo-auth-session 에서 받은 값)을 넘기면 로그인 처리 */
  signIn: (googleAccessToken: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 앱 시작 시 저장된 세션 복원
  useEffect(() => {
    authService.getSession().then((stored) => {
      if (stored) {
        setSession(stored);
        setUser(stored.user);
      }
      setIsLoading(false);
    });
  }, []);

  const signIn = useCallback(async (googleAccessToken: string) => {
    const newSession = await authService.exchangeGoogleToken(googleAccessToken);
    await authService.saveSession(newSession);
    setSession(newSession);
    setUser(newSession.user);
  }, []);

  const signOut = useCallback(async () => {
    await authService.clearSession();
    setSession(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
