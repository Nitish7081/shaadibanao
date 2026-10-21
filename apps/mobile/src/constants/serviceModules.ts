import { colors } from './theme';

export type ServiceModuleId =
  | 'find_match'
  | 'kundli_milan'
  | 'book_pandit'
  | 'muhurat_finder'
  | 'astrology'
  | 'community'
  | 'messages'
  | 'my_profile';

export interface ServiceModuleConfig {
  id: ServiceModuleId;
  title: string;
  description: string;
  actionText: string;
  iconFamily: 'Ionicons' | 'MaterialCommunityIcons';
  iconName: string;
  // Coordinated Palette Tokens
  primaryColor: string;
  accentColor: string;
  bgColor: string;
  iconBg: string;
  borderColor: string;
  badgeBg: string;
  badgeColor: string;
  defaultBadge?: string;
  accessibilityLabel: string;
}

export const SERVICE_MODULES: Record<ServiceModuleId, ServiceModuleConfig> = {
  // 1. Find Your Match — rose and maroon
  find_match: {
    id: 'find_match',
    title: 'Find Your Match',
    description: 'Discover compatible matrimonial profiles',
    actionText: 'Explore',
    iconFamily: 'Ionicons',
    iconName: 'heart',
    primaryColor: '#7A1528', // Royal Maroon
    accentColor: '#D8315B',  // Vibrant Rose
    bgColor: '#FFF5F7',      // Soft Rose Tint
    iconBg: '#FFE0E7',
    borderColor: '#F8CBD6',
    badgeBg: '#FFE0E7',
    badgeColor: '#8B1538',
    defaultBadge: 'Matches',
    accessibilityLabel: 'Find Your Match, discover compatible matrimonial profiles',
  },

  // 2. Kundli Milan — purple and lavender
  kundli_milan: {
    id: 'kundli_milan',
    title: 'Kundli Milan',
    description: 'Vedic 36 Gunas compatibility matching',
    actionText: 'Match 36 Gunas',
    iconFamily: 'Ionicons',
    iconName: 'planet',
    primaryColor: '#581C87', // Royal Deep Purple
    accentColor: '#9333EA',  // Lavender Accent
    bgColor: '#FAF5FF',      // Soft Lavender Tint
    iconBg: '#F0E0FB',
    borderColor: '#E6CCFA',
    badgeBg: '#F3E8FF',
    badgeColor: '#6B21A8',
    defaultBadge: '36 Gunas',
    accessibilityLabel: 'Kundli Milan, Vedic compatibility matching with 36 Gunas calculation',
  },

  // 3. Book a Pandit — saffron and gold
  book_pandit: {
    id: 'book_pandit',
    title: 'Book a Pandit',
    description: 'Weddings, puja & religious ceremonies',
    actionText: 'Find Pandits',
    iconFamily: 'MaterialCommunityIcons',
    iconName: 'om',
    primaryColor: '#C2410C', // Auspicious Saffron
    accentColor: '#D4AF37',  // Ceremonial Gold
    bgColor: '#FFFBF0',      // Soft Saffron & Gold Tint
    iconBg: '#FEEBC3',
    borderColor: '#F6DBA2',
    badgeBg: '#FEF3C7',
    badgeColor: '#B45309',
    defaultBadge: 'Purohits',
    accessibilityLabel: 'Book a Pandit for weddings, puja and religious ceremonies',
  },

  // 4. Muhurat Finder — teal and emerald
  muhurat_finder: {
    id: 'muhurat_finder',
    title: 'Muhurat Finder',
    description: 'Auspicious dates and timings',
    actionText: 'View Dates',
    iconFamily: 'Ionicons',
    iconName: 'calendar',
    primaryColor: '#0F766E', // Emerald Green
    accentColor: '#14B8A6',  // Pure Teal
    bgColor: '#F0FDF8',      // Soft Teal & Emerald Tint
    iconBg: '#CCFBF1',
    borderColor: '#A7F3D0',
    badgeBg: '#D1FAE5',
    badgeColor: '#047857',
    defaultBadge: 'Shubh Tithi',
    accessibilityLabel: 'Muhurat Finder, auspicious dates and timings for weddings and ceremonies',
  },

  // 5. Astrology — indigo and violet
  astrology: {
    id: 'astrology',
    title: 'Astrology',
    description: 'Birth chart & horoscope services',
    actionText: 'My Kundli',
    iconFamily: 'Ionicons',
    iconName: 'sparkles',
    primaryColor: '#312E81', // Celestial Indigo
    accentColor: '#6366F1',  // Radiant Violet
    bgColor: '#F4F5FF',      // Soft Indigo Tint
    iconBg: '#DFE5FE',
    borderColor: '#C7D2FE',
    badgeBg: '#EDE9FE',
    badgeColor: '#4338CA',
    defaultBadge: 'Kundli',
    accessibilityLabel: 'Astrology, birth chart and Vedic horoscope services',
  },

  // 6. Community — coral and pink
  community: {
    id: 'community',
    title: 'Community',
    description: 'Share approved photos & stories',
    actionText: 'Community Feed',
    iconFamily: 'Ionicons',
    iconName: 'people',
    primaryColor: '#D84315', // Warm Coral
    accentColor: '#E91E63',  // Festive Pink
    bgColor: '#FFF6F4',      // Soft Coral & Pink Tint
    iconBg: '#FFE0D6',
    borderColor: '#FCCBC0',
    badgeBg: '#FFE4E6',
    badgeColor: '#BE123C',
    defaultBadge: 'Feed',
    accessibilityLabel: 'Community, share approved photos and community posts',
  },

  // 7. Messages — sky blue and navy
  messages: {
    id: 'messages',
    title: 'Messages',
    description: 'Conversations & mutual interests',
    actionText: 'Open Chats',
    iconFamily: 'Ionicons',
    iconName: 'chatbubbles',
    primaryColor: '#1E3A8A', // Classic Navy
    accentColor: '#0284C7',  // Sky Blue
    bgColor: '#F0F9FF',      // Soft Sky Tint
    iconBg: '#DAEFFF',
    borderColor: '#B9E2FE',
    badgeBg: '#E0F2FE',
    badgeColor: '#0369A1',
    defaultBadge: 'Chats',
    accessibilityLabel: 'Messages, conversations and mutual interests',
  },

  // 8. My Profile — burgundy and champagne gold
  my_profile: {
    id: 'my_profile',
    title: 'My Profile',
    description: 'Profile completion & verification',
    actionText: 'Manage Profile',
    iconFamily: 'Ionicons',
    iconName: 'person-circle',
    primaryColor: '#540917', // Deep Royal Burgundy
    accentColor: '#C5A059',  // Champagne Gold
    bgColor: '#FCF6F8',      // Soft Burgundy & Champagne Tint
    iconBg: '#F9DEE5',
    borderColor: '#ECC4D0',
    badgeBg: '#FEF3C7',
    badgeColor: '#7A1528',
    defaultBadge: 'Account',
    accessibilityLabel: 'My Profile, profile completion and verification status',
  },
};
