import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { SplashScreen } from '../screens/SplashScreen';
import { LanguageSelectionScreen } from '../screens/LanguageSelectionScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { LoginOtpScreen } from '../screens/LoginOtpScreen';
import { ProfileCreationScreen } from '../screens/ProfileCreationScreen';
import { MainTabNavigator } from './MainTabNavigator';
import { ProfileDetailScreen } from '../screens/ProfileDetailScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { MembershipScreen } from '../screens/MembershipScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { PrivacySettingsScreen } from '../screens/PrivacySettingsScreen';
import { ReportBlockScreen } from '../screens/ReportBlockScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="LanguageSelection" component={LanguageSelectionScreen} />
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="LoginOtp" component={LoginOtpScreen} />
      <Stack.Screen name="ProfileCreation" component={ProfileCreationScreen} />
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen name="ProfileDetail" component={ProfileDetailScreen} />
      <Stack.Screen name="ChatDetail" component={ChatScreen} />
      <Stack.Screen name="Membership" component={MembershipScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="PrivacySettings" component={PrivacySettingsScreen} />
      <Stack.Screen name="ReportBlock" component={ReportBlockScreen} />
    </Stack.Navigator>
  );
};
