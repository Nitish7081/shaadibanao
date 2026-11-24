import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { RootNavigator } from './src/navigation/RootNavigator';
import { navigationRef, navigateToLogin } from './src/navigation/navigationRef';
import { onAuthExpired } from './src/services/authSession';
import { ReconsentModal } from './src/components/common/ReconsentModal';
import { ShaadiBanaoLogo } from './src/components/royal/ShaadiBanaoLogo';
import { colors } from './src/constants/theme';
import { initI18n } from './src/i18n';

export default function App() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [i18nReady, setI18nReady] = React.useState(false);

  React.useEffect(() => {
    initI18n().finally(() => setI18nReady(true));
    // Non-blocking background health ping to eliminate Render cold-start latency
    fetch('https://shaadibanao.onrender.com/api/v1/health').catch(() => {});
  }, []);

  React.useEffect(() => {
    // Listen for complete session expiration to navigate safely to Login/OTP screen
    const unsubscribe = onAuthExpired(() => {
      navigateToLogin();
    });
    return unsubscribe;
  }, []);

  if (!fontsLoaded || !i18nReady) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="light" />
        <ShaadiBanaoLogo size="large" />
        <Text style={styles.loadingTitle}>ShaadiBanao</Text>
        <Text style={styles.loadingSubtitle}>Rishton ki nayi shuruaat</Text>
        <ActivityIndicator size="small" color="#D4AF37" style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef}>
        <StatusBar style="auto" />
        <RootNavigator />
        <ReconsentModal />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.royalMaroon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
    marginTop: 16,
  },
  loadingSubtitle: {
    fontSize: 13,
    color: colors.lightGold,
    marginTop: 4,
    fontStyle: 'italic',
  },
});
