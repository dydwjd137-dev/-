import { Stack } from 'expo-router';
import { PortfolioProvider } from '../contexts/PortfolioContext';

export default function RootLayout() {
  return (
    <PortfolioProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </PortfolioProvider>
  );
}
