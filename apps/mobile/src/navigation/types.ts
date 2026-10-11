import { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  Splash: undefined;
  LanguageSelection: undefined;
  Welcome: undefined;
  LoginOtp: undefined;
  ProfileCreation: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  ProfileDetail: { profileId: string; name: string };
  ChatDetail: { conversationId: string; partnerName: string };
  Membership: undefined;
  Notifications: undefined;
  PrivacySettings: undefined;
  ReportBlock: { profileId: string; name: string };
};

export type MainTabParamList = {
  Home: undefined;
  Search: undefined;
  Interests: undefined;
  Chat: undefined;
  Me: undefined;
};
