import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../services/auth/GoogleAuthService';
import { AuthUser, AuthSession } from '../services/auth/IAuthService';

const GUEST_KEY = '@auth/guest';

interface AuthContextType {
  user: AuthUser | null;
  session: AuthSession | null;
  isGuest: boolean;
  isLoading: boolean;
  /** Google Access Token (expo-auth-session 에서 받은 값)을 넘기면 로그인 처리 */
  signIn: (googleAccessToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** 로그인 없이 게스트로 앱 사용. 기존 데이터는 그대로 유지됨 */
  continueAsGuest: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 앱 시작 시 저장된 세션 또는 게스트 상태 복원
  useEffect(() => {
    (async () => {
      const stored = await authService.getSession();
      if (stored) {
        setSession(stored);
        setUser(stored.user);
      } else {
        const guest = await AsyncStorage.getItem(GUEST_KEY);
        if (guest === 'true') setIsGuest(true);
      }
      setIsLoading(false);
    })();
  }, []);

  const signIn = useCallback(async (googleAccessToken: string) => {
    const newSession = await authService.exchangeGoogleToken(googleAccessToken);
    await authService.saveSession(newSession);
    // 게스트 플래그 제거 (로그인으로 전환 — 데이터는 그대로 유지)
    await AsyncStorage.removeItem(GUEST_KEY);
    setIsGuest(false);
    setSession(newSession);
    setUser(newSession.user);
  }, []);

  const signOut = useCallback(async () => {
    await authService.clearSession();
    await AsyncStorage.removeItem(GUEST_KEY);
    setSession(null);
    setUser(null);
    setIsGuest(false);
  }, []);

  const continueAsGuest = useCallback(async () => {
    await AsyncStorage.setItem(GUEST_KEY, 'true');
    setIsGuest(true);
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, isGuest, isLoading, signIn, signOut, continueAsGuest }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
