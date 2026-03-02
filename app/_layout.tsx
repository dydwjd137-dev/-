import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { PortfolioProvider } from '../contexts/PortfolioContext';
import { DisplayPreferencesProvider } from '../contexts/DisplayPreferencesContext';
import { ThemeOverlay } from '../components/ThemeOverlay';

/** 인증 상태에 따라 라우트 자동 보호 */
function RouteGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router   = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, isLoading, segments]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <DisplayPreferencesProvider>
      <AuthProvider>
        <PortfolioProvider>
          <View style={styles.root}>
            <RouteGuard>
              <Stack>
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              </Stack>
            </RouteGuard>
            <ThemeOverlay />
          </View>
        </PortfolioProvider>
      </AuthProvider>
    </DisplayPreferencesProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
