import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { MainTabParamList, RootStackParamList } from '../navigation/types';
import { ds, PressableScale, GradientRingAvatar, Skeleton } from '../design';
import { UserProfile } from '@bandhansetu/shared';
import { getMyProfile } from '../services/profileService';
import { photoSrc } from '../services/cloudinaryUrl';
import { getMyMembership } from '../services/membershipService';
import { getSessionToken, performLogout, getSessionUser } from '../services/authSession';
import { getInitials } from '../components/home/matchPhoto';

type MeNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Me'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface Props {
  navigation: MeNavProp;
}

export const MeScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [membershipTier, setMembershipTier] = useState<string>('');
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchUserData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const token = getSessionToken();
    if (!token) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const [profileRes, memberRes] = await Promise.allSettled([
        getMyProfile(token),
        getMyMembership(token),
      ]);

      if (profileRes.status === 'fulfilled' && profileRes.value.data) {
        setProfile(profileRes.value.data);
      } else if (profileRes.status === 'fulfilled') {
        setProfile(null);
      }
      if (memberRes.status === 'fulfilled' && memberRes.value.data) {
        setMembershipTier(memberRes.value.data.planName || '');
      }
    } catch {
      // Non-blocking fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchUserData();
    });
    return unsubscribe;
  }, [navigation, fetchUserData]);

  const sessionUser = getSessionUser();
  const displayName = profile
    ? `${profile.firstName} ${profile.lastName || ''}`.trim()
    : ((sessionUser as any)?.name || t('me.memberFallback'));
  const userAge = profile?.age ? `, ${profile.age}` : '';
  const memberId = profile?.id
    ? `SB-${profile.id.slice(-6).toUpperCase()}`
    : 'SB-MEMBER';
  const locationSub = profile?.city ? ` • ${profile.city}` : '';

  const avatarUrl =
    profile?.photos && profile.photos.length > 0 && profile.photos[0].url
      ? photoSrc(profile.photos[0], 'avatar')
      : undefined;

  const menuSections = [
    {
      title: 'Profile & Verification',
      items: [
        {
          title: t('me.menu.editProfile'),
          subtitle: t('me.menu.editProfileSub'),
          icon: 'create-outline' as const,
          onPress: () => navigation.navigate('ProfileCreation'),
        },
        {
          title: t('me.menu.idVerify'),
          subtitle: t('me.menu.idVerifySub'),
          icon: 'shield-checkmark-outline' as const,
          onPress: () => {
            const parentNav = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
            if (parentNav) parentNav.navigate('IdentityVerification');
            else (navigation as any).navigate('IdentityVerification');
          },
        },
        {
          title: t('me.menu.privacy'),
          subtitle: t('me.menu.privacySub'),
          icon: 'lock-closed-outline' as const,
          onPress: () => navigation.navigate('PrivacySettings'),
        },
      ],
    },
    {
      title: 'Sacred Services & Membership',
      items: [
        {
          title: t('me.menu.bookings'),
          subtitle: t('me.menu.bookingsSub'),
          icon: 'calendar-outline' as const,
          onPress: () => {
            const parentNav = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
            if (parentNav) {
              parentNav.navigate('MyBookings');
            } else {
              (navigation as any).navigate('MyBookings');
            }
          },
        },
        {
          title: t('me.menu.kundli'),
          subtitle: t('me.menu.kundliSub'),
          icon: 'planet-outline' as const,
          onPress: () => {
            const parentNav = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
            if (parentNav) parentNav.navigate('KundliForm');
            else (navigation as any).navigate('KundliForm');
          },
        },
        {
          title: t('me.menu.membership'),
          subtitle: t('me.menu.membershipSub'),
          icon: 'ribbon-outline' as const,
          onPress: () => navigation.navigate('Membership'),
        },
      ],
    },
    {
      title: 'App Settings & Support',
      items: [
        {
          title: t('me.menu.notifications'),
          subtitle: t('me.menu.notificationsSub'),
          icon: 'notifications-outline' as const,
          onPress: () => navigation.navigate('Notifications'),
        },
        {
          title: t('me.menu.language'),
          subtitle: t('me.menu.languageSub'),
          icon: 'language-outline' as const,
          onPress: () => {
            const parentNav = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
            if (parentNav) parentNav.navigate('LanguageSelection', { fromSettings: true });
            else (navigation as any).navigate('LanguageSelection', { fromSettings: true });
          },
        },
        {
          title: t('me.menu.help'),
          subtitle: t('me.menu.helpSub'),
          icon: 'help-buoy-outline' as const,
          onPress: () => Alert.alert(t('me.supportTitle'), t('me.supportBody')),
        },
      ],
    },
  ];

  const handleSignOut = () => {
    Alert.alert(t('me.signOut'), t('me.signOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('me.signOut'),
        style: 'destructive',
        onPress: async () => {
          await performLogout();
          const parentNav = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
          if (parentNav) {
            parentNav.reset({
              index: 0,
              routes: [{ name: 'Welcome' }],
            });
          } else {
            (navigation as any).navigate('Welcome');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screenBg}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 90, 110) },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchUserData(true)}
            tintColor={ds.color.maroon}
            colors={[ds.color.maroon]}
          />
        }
      >
        {/* Profile Card Header */}
        <View style={styles.profileHeaderCard}>
          <View style={styles.avatarRow}>
            <GradientRingAvatar
              size={76}
              uri={avatarUrl}
              initials={getInitials(displayName)}
              active={true}
            />

            <View style={styles.profileMetaCol}>
              <Text
                maxFontSizeMultiplier={1.2}
                numberOfLines={1}
                style={styles.profileName}
              >
                {displayName}{userAge}
              </Text>

              <Text
                maxFontSizeMultiplier={1.2}
                numberOfLines={1}
                style={styles.profileIdText}
              >
                {memberId}{locationSub}
              </Text>

              {/* Badges Row */}
              <View style={styles.badgesWrapper}>
                {profile?.isVerified ? (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="shield-checkmark" size={12} color="#166534" />
                    <Text maxFontSizeMultiplier={1.2} style={styles.verifiedBadgeText}>
                      {t('me.badgeIdVerified')}
                    </Text>
                  </View>
                ) : (
                  <PressableScale
                    style={styles.unverifiedBadge}
                    onPress={() => {
                      const parentNav = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
                      if (parentNav) parentNav.navigate('IdentityVerification');
                      else (navigation as any).navigate('IdentityVerification');
                    }}
                  >
                    <Ionicons name="alert-circle-outline" size={12} color="#92400E" />
                    <Text maxFontSizeMultiplier={1.2} style={styles.unverifiedBadgeText}>
                      Verify ID
                    </Text>
                  </PressableScale>
                )}

                <View style={styles.tierBadge}>
                  <Ionicons name="sparkles" size={11} color="#854D0E" />
                  <Text maxFontSizeMultiplier={1.2} style={styles.tierBadgeText}>
                    {membershipTier || t('me.freeTier')}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Quick Edit Profile Action */}
          <PressableScale
            style={styles.editProfilePill}
            onPress={() => navigation.navigate('ProfileCreation')}
          >
            <Ionicons name="create-outline" size={15} color={ds.color.maroon} />
            <Text maxFontSizeMultiplier={1.2} style={styles.editProfilePillText}>
              {t('me.menu.editProfile')}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={ds.color.maroon} />
          </PressableScale>
        </View>

        {/* Menu Groups */}
        {menuSections.map((section, sIdx) => (
          <View key={`sec-${sIdx}`} style={styles.sectionWrap}>
            <Text maxFontSizeMultiplier={1.2} style={styles.sectionHeading}>
              {section.title}
            </Text>

            <View style={styles.menuCard}>
              {section.items.map((item, idx) => (
                <PressableScale
                  key={`item-${idx}`}
                  style={[
                    styles.menuRow,
                    idx < section.items.length - 1 && styles.menuRowBorder,
                  ]}
                  onPress={item.onPress}
                >
                  <View style={styles.iconCircle}>
                    <Ionicons name={item.icon} size={20} color={ds.color.maroon} />
                  </View>
                  <View style={styles.menuTextCol}>
                    <Text maxFontSizeMultiplier={1.2} style={styles.menuTitle}>
                      {item.title}
                    </Text>
                    <Text maxFontSizeMultiplier={1.2} style={styles.menuSub}>
                      {item.subtitle}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={ds.color.textMuted} />
                </PressableScale>
              ))}
            </View>
          </View>
        ))}

        {/* Logout Button */}
        <PressableScale style={styles.logoutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={18} color="#DC2626" />
          <Text maxFontSizeMultiplier={1.2} style={styles.logoutBtnText}>
            {t('me.signOutButton')}
          </Text>
        </PressableScale>

        <Text maxFontSizeMultiplier={1.2} style={styles.footerVersion}>
          BandhanSetu • Sanatan Matrimony v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screenBg: {
    flex: 1,
    backgroundColor: ds.color.bg,
  },
  scrollContent: {
    paddingHorizontal: ds.space.md,
    paddingTop: ds.space.sm,
  },
  profileHeaderCard: {
    backgroundColor: ds.color.surface,
    borderRadius: 22,
    padding: ds.space.lg,
    borderWidth: 1,
    borderColor: ds.color.border,
    marginBottom: ds.space.md,
    ...ds.shadow.soft,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ds.space.md,
  },
  profileMetaCol: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: ds.color.text,
    letterSpacing: -0.2,
  },
  profileIdText: {
    fontSize: 12,
    color: ds.color.textMuted,
    marginTop: 2,
  },
  badgesWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    gap: 4,
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  unverifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    gap: 4,
  },
  unverifiedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF9C3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    gap: 4,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#854D0E',
  },
  editProfilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ds.color.surfaceWarm,
    borderWidth: 1,
    borderColor: ds.color.border,
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginTop: ds.space.md,
    gap: 6,
  },
  editProfilePillText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: ds.color.maroon,
  },
  sectionWrap: {
    marginBottom: ds.space.md,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: ds.color.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginLeft: 4,
  },
  menuCard: {
    backgroundColor: ds.color.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: ds.color.border,
    overflow: 'hidden',
    ...ds.shadow.soft,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: ds.space.md,
  },
  menuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: ds.color.border,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: ds.color.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: ds.space.md,
  },
  menuTextCol: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: ds.color.text,
  },
  menuSub: {
    fontSize: 12,
    color: ds.color.textMuted,
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 16,
    paddingVertical: 13,
    gap: 8,
    marginTop: ds.space.xs,
    marginBottom: ds.space.md,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
  footerVersion: {
    textAlign: 'center',
    fontSize: 11,
    color: ds.color.textMuted,
    marginBottom: ds.space.md,
  },
});
