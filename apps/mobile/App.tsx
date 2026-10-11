import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { SplashScreen } from './src/screens/SplashScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { colors } from './src/constants/theme';

type AppFlowState = 'splash' | 'welcome' | 'login' | 'dashboard';

export default function App() {
  const [currentState, setCurrentState] = useState<AppFlowState>('splash');
  const [authenticatedMobile, setAuthenticatedMobile] = useState<string>('');

  const renderCurrentScreen = () => {
    switch (currentState) {
      case 'splash':
        return <SplashScreen onFinish={() => setCurrentState('welcome')} />;
      case 'welcome':
        return (
          <WelcomeScreen
            onGetStarted={() => setCurrentState('login')}
            onSkip={() => setCurrentState('login')}
          />
        );
      case 'login':
        return (
          <LoginScreen
            onLoginSuccess={(mobile) => {
              setAuthenticatedMobile(mobile);
              setCurrentState('dashboard');
            }}
            onBackToWelcome={() => setCurrentState('welcome')}
          />
        );
      case 'dashboard':
        return (
          <DashboardScreen
            mobile={authenticatedMobile}
            onLogout={() => {
              setAuthenticatedMobile('');
              setCurrentState('welcome');
            }}
          />
        );
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style={currentState === 'splash' ? 'light' : 'dark'} />
      {renderCurrentScreen()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
