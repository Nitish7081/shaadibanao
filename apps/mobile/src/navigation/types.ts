import { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  Splash: undefined;
  LanguageSelection: { fromSettings?: boolean } | undefined;
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
  ApprovalPending: undefined;
  PanditServices: { ceremonyType?: string } | undefined;
  PanditDetail: { panditId: string; panditName: string };
  BookingFlow: { panditId: string; serviceId: string; serviceName: string; priceInr: number };
  PanditBookingRequest: { ceremonyType?: string; serviceId?: string } | undefined;
  MyBookings: undefined;
  VideoConsultation: { bookingId: string; ceremonyName: string; panditName: string };
  KundliForm: undefined;
  IdentityVerification: undefined;
  CreatePost: undefined;
  Search: undefined;
  Chat: undefined;
  MuhuratFinder: { ceremonyType?: string } | undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Matches: undefined;
  Community: undefined;
  Astrology: { initialTab?: 'kundli' | 'matching' } | undefined;
  Profile: undefined;
  // Compatibility routes for existing screens:
  Search?: undefined;
  Interests?: undefined;
  Chat?: undefined;
  Me?: undefined;
};
