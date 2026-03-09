/**
 * login.tsx
 *
 * Google OAuth 로그인 화면
 *
 * 패키지 설치 필요:
 *   npx expo install expo-auth-session expo-web-browser
 *
 * Google Cloud Console 설정:
 *   1. https://console.cloud.google.com → API 및 서비스 → 사용자 인증 정보
 *   2. OAuth 2.0 클라이언트 ID 생성 (웹, iOS, Android 각각)
 *   3. constants/googleAuth.ts 에 Client ID 입력
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/DisplayPreferencesContext';
import { GOOGLE_CLIENT_IDS } from '../../constants/googleAuth';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { signIn, continueAsGuest } = useAuth();
  const router     = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { themeColors } = useTheme();

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId:     GOOGLE_CLIENT_IDS.web,
    iosClientId:     GOOGLE_CLIENT_IDS.ios,
    androidClientId: GOOGLE_CLIENT_IDS.android,
  });

  useEffect(() => {
    if (response?.type !== 'success') return;
    const accessToken = response.authentication?.accessToken;
    if (!accessToken) return;

    setIsLoading(true);
    signIn(accessToken)
      .then(() => router.replace('/(tabs)'))
      .catch((err) => {
        Alert.alert('로그인 실패', err.message ?? '다시 시도해 주세요.');
      })
      .finally(() => setIsLoading(false));
  }, [response]);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* 로고 & 타이틀 */}
      <View style={styles.header}>
        <View style={[styles.logoBox, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
          <Text style={styles.logoEmoji}>📊</Text>
        </View>
        <Text style={[styles.title, { color: themeColors.text }]}>KongDad Portfolio</Text>
        <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>내 자산을 한눈에</Text>
      </View>

      {/* 로그인 버튼 영역 */}
      <View style={styles.buttonArea}>
        {isLoading ? (
          <ActivityIndicator size="large" color={themeColors.primary} />
        ) : (
          <TouchableOpacity
            style={[styles.googleBtn, !request && styles.disabledBtn]}
            onPress={() => promptAsync()}
            disabled={!request}
            activeOpacity={0.8}
          >
            <Text style={styles.googleIcon}>G</Text>
            <Text style={styles.googleBtnText}>Google로 계속하기</Text>
          </TouchableOpacity>
        )}

        {/* 구분선 */}
        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: themeColors.border }]} />
          <Text style={[styles.dividerText, { color: themeColors.textSecondary }]}>또는</Text>
          <View style={[styles.dividerLine, { backgroundColor: themeColors.border }]} />
        </View>

        {/* 게스트 버튼 */}
        <TouchableOpacity
          style={[styles.guestBtn, { borderColor: themeColors.border, backgroundColor: themeColors.cardBackground }]}
          onPress={async () => {
            await continueAsGuest();
            router.replace('/(tabs)');
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="bar-chart-outline" size={18} color={themeColors.primary} />
          <Text style={[styles.guestBtnText, { color: themeColors.text }]}>로그인 없이 포트폴리오 관리하기</Text>
        </TouchableOpacity>

        <Text style={[styles.guestNotice, { color: themeColors.textSecondary }]}>
          기기에만 저장됩니다. 나중에 로그인하면 데이터가 자동으로 연동됩니다.
        </Text>

        <Text style={[styles.terms, { color: themeColors.textSecondary }]}>
          로그인 시{' '}
          <Text style={[styles.link, { color: themeColors.primary }]}>서비스 이용약관</Text>
          {' '}및{' '}
          <Text style={[styles.link, { color: themeColors.primary }]}>개인정보처리방침</Text>
          에 동의합니다
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  header: {
    alignItems: 'center',
    gap: 12,
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 8,
  },
  logoEmoji: {
    fontSize: 36,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 15,
  },
  buttonArea: {
    gap: 20,
    alignItems: 'center',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: '900',
    color: '#4285F4',
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
  },
  guestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
  },
  guestBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  guestNotice: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  terms: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 18,
  },
  link: {
    textDecorationLine: 'underline',
  },
});
