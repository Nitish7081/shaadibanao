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
import { ChatDetailScreen } from '../screens/ChatDetailScreen';
import { MembershipScreen } from '../screens/MembershipScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { PrivacySettingsScreen } from '../screens/PrivacySettingsScreen';
import { ReportBlockScreen } from '../screens/ReportBlockScreen';
import { ApprovalPendingScreen } from '../screens/ApprovalPendingScreen';
import { PanditServicesScreen } from '../screens/PanditServicesScreen';
import { PanditDetailScreen } from '../screens/PanditDetailScreen';
import { BookingFlowScreen } from '../screens/BookingFlowScreen';
import { PanditBookingRequestScreen } from '../screens/PanditBookingRequestScreen';
import { MyBookingsScreen } from '../screens/MyBookingsScreen';
import { VideoConsultationScreen } from '../screens/VideoConsultationScreen';
import { KundliFormScreen } from '../screens/KundliFormScreen';
import { IdentityVerificationScreen } from '../screens/IdentityVerificationScreen';
import { CreatePostScreen } from '../screens/CreatePostScreen';
import { SearchScreen } from '../screens/SearchScreen';

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
      <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
      <Stack.Screen name="Membership" component={MembershipScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="PrivacySettings" component={PrivacySettingsScreen} />
      <Stack.Screen name="ReportBlock" component={ReportBlockScreen} />
      <Stack.Screen name="ApprovalPending" component={ApprovalPendingScreen} />
      <Stack.Screen name="PanditServices" component={PanditServicesScreen} />
      <Stack.Screen name="PanditDetail" component={PanditDetailScreen} />
      <Stack.Screen name="BookingFlow" component={BookingFlowScreen} />
      <Stack.Screen name="PanditBookingRequest" component={PanditBookingRequestScreen} />
      <Stack.Screen name="MyBookings" component={MyBookingsScreen} />
      <Stack.Screen name="VideoConsultation" component={VideoConsultationScreen} />
      <Stack.Screen name="KundliForm" component={KundliFormScreen} />
      <Stack.Screen name="IdentityVerification" component={IdentityVerificationScreen} />
      <Stack.Screen name="CreatePost" component={CreatePostScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
    </Stack.Navigator>
  );
};
