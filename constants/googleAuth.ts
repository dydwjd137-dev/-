/**
 * Google OAuth Client IDs
 *
 * Google Cloud Console 에서 발급:
 * https://console.cloud.google.com → API 및 서비스 → 사용자 인증 정보
 *
 * ── 주의 ────────────────────────────────────────────────────────
 * Client ID는 공개 정보이므로 .env 에 숨길 필요는 없습니다.
 * Client Secret은 절대 앱에 포함시키지 마세요 (백엔드에서만 사용).
 * ───────────────────────────────────────────────────────────────
 */
const WEB_CLIENT_ID = '382030537764-mvbavfqlm5cqdnlofurl5cope9rtmiat.apps.googleusercontent.com';

export const GOOGLE_CLIENT_IDS = {
  /** 웹 브라우저 & Expo Go 용 */
  web: WEB_CLIENT_ID,

  /** iOS 앱 빌드용 */
  ios: WEB_CLIENT_ID,

  /** Android 앱 빌드용 (Expo Go 개발 시 web client ID 사용, 프로덕션 빌드 시 별도 Android client 필요) */
  android: WEB_CLIENT_ID,
};
