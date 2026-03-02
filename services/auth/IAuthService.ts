// Auth 서비스 인터페이스 — 구현체와 상위 레이어를 분리

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface AuthSession {
  user: AuthUser;
  token: string;      // 백엔드가 발급한 JWT
  expiresAt: number;  // Unix ms
}
