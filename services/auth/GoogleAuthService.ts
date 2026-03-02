/**
 * GoogleAuthService.ts
 *
 * 역할:
 *   1. Google Access Token → 백엔드 JWT 교환
 *   2. 세션 AsyncStorage 저장/조회/삭제
 *
 * Google OAuth 프롬프트 자체는 expo-auth-session 훅을 사용하므로
 * 컴포넌트(login.tsx)에서 처리하고, 그 결과(accessToken)만 이 서비스로 전달합니다.
 *
 * Supabase 연결 시:
 *   exchangeGoogleToken 내부의 fetch 대신
 *   supabase.auth.signInWithIdToken 호출로 교체하면 됩니다.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '../../config';
import { AuthSession } from './IAuthService';

const SESSION_KEY = '@auth/session';

class GoogleAuthService {
  /** Google Access Token을 백엔드에 보내 자체 JWT 수령 */
  async exchangeGoogleToken(googleAccessToken: string): Promise<AuthSession> {
    const res = await fetch(`${config.backendUrl}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: googleAccessToken }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? 'Authentication failed');
    }
    return res.json() as Promise<AuthSession>;
  }

  /** 저장된 세션 반환 (만료 시 null) */
  async getSession(): Promise<AuthSession | null> {
    try {
      const raw = await AsyncStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session: AuthSession = JSON.parse(raw);
      if (session.expiresAt < Date.now()) {
        await this.clearSession();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  async saveSession(session: AuthSession): Promise<void> {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  async clearSession(): Promise<void> {
    await AsyncStorage.removeItem(SESSION_KEY);
  }
}

export const authService = new GoogleAuthService();
