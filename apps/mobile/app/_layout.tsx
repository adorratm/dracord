import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { colors } from '@dracord/app-theme';
import { AuthProvider, useAuth } from '../lib/auth';
import { ThemeProvider } from '../lib/theme';
import { useThemeRevision } from '../lib/theme-revision';
import { useAppFonts } from '../lib/useAppFonts';

function RootNav() {
  const { ready } = useAuth();
  const [fontsLoaded] = useAppFonts();
  useThemeRevision();

  if (!ready || !fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ThemeProvider>
          <RootNav />
        </ThemeProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
