import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainTabParamList, RootStackParamList } from '../navigation/types';
import { colors, typography, spacing, borderRadius, fonts } from '../constants/theme';
import { UserProfile } from '@bandhansetu/shared';
import { Header } from '../components/common/Header';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { getMyProfile } from '../services/profileService';
import { photoSrc } from '../services/cloudinaryUrl';
import { getMyMembership } from '../services/membershipService';
import { getSessionToken, performLogout, getSessionUser } from '../services/authSession';

type MeNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Me'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface Props {
  navigation: MeNavProp;
}

export const MeScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
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
        // Server answered but this account has no profile: never keep an old one.
        setProfile(null);
      }
      if (memberRes.status === 'fulfilled' && memberRes.value.data) {
        setMembershipTier(memberRes.value.data.planName || '');
      }
    } catch {
      // Non-blocking fallback to cached profile or session user
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // Re-fetch whenever screen comes into focus
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
    : 'SB-NEW';
  const locationSub = profile?.city ? ` • ${profile.city}` : '';

  const menuItems = [
    {
      title: t('me.menu.editProfile'),
      subtitle: t('me.menu.editProfileSub'),
      icon: 'create-outline',
      onPress: () => navigation.navigate('ProfileCreation'),
    },
    {
      title: t('me.menu.idVerify'),
      subtitle: t('me.menu.idVerifySub'),
      icon: 'shield-checkmark-outline',
      onPress: () => {
        const parentNav = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
        if (parentNav) parentNav.navigate('IdentityVerification');
      },
    },
    {
      title: t('me.menu.bookings'),
      subtitle: t('me.menu.bookingsSub'),
      icon: 'calendar-outline',
      onPress: () => {
        const parentNav = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
        if (parentNav) parentNav.navigate('MyBookings');
      },
    },
    {
      title: t('me.menu.kundli'),
      subtitle: t('me.menu.kundliSub'),
      icon: 'planet-outline',
      onPress: () => {
        const parentNav = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
        if (parentNav) parentNav.navigate('KundliForm');
      },
    },
    {
      title: t('me.menu.privacy'),
      subtitle: t('me.menu.privacySub'),
      icon: 'lock-closed-outline',
      onPress: () => navigation.navigate('PrivacySettings'),
    },
    {
      title: t('me.menu.membership'),
      subtitle: t('me.menu.membershipSub'),
      icon: 'ribbon-outline',
      onPress: () => navigation.navigate('Membership'),
    },
    {
      title: t('me.menu.notifications'),
      subtitle: t('me.menu.notificationsSub'),
      icon: 'notifications-outline',
      onPress: () => navigation.navigate('Notifications'),
    },
    {
      title: t('me.menu.language'),
      subtitle: t('me.menu.languageSub'),
      icon: 'language-outline',
      onPress: () => {
        const parentNav = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
        if (parentNav) parentNav.navigate('LanguageSelection', { fromSettings: true });
      },
    },
    {
      title: t('me.menu.help'),
      subtitle: t('me.menu.helpSub'),
      icon: 'help-buoy-outline',
      onPress: () =>
        Alert.alert(t('me.supportTitle'), t('me.supportBody')),
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
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <Header title={t('me.headerTitle')} subtitle={displayName} showStatusBadge={true} variant="royal" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchUserData(true)}
            tintColor={colors.royalMaroon}
            colors={[colors.royalMaroon]}
          />
        }
      >
        {/* User Quick Card */}
        <Card style={styles.userCard}>
          <View style={styles.userHeader}>
            <View style={styles.avatar}>
              {profile?.photos && profile.photos.length > 0 && profile.photos[0].url ? (
                <Image
                  source={{ uri: photoSrc(profile.photos[0], 'avatar') }}
                  style={{ width: 60, height: 60, borderRadius: 30 }}
                  resizeMode="cover"
                />
              ) : (
                <Ionicons name="person" size={28} color={colors.royalMaroon} />
              )}
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>
                {displayName}{userAge}
              </Text>
              <Text style={styles.userSub}>
                Member ID: {memberId}{locationSub}
              </Text>
              <View style={styles.badgeRow}>
                {(sessionUser as any)?.approvalStatus === 'approved' && <Badge label={t('me.badgeApproved')} variant="verified" />}
                {profile?.isVerified && <Badge label={t('me.badgeIdVerified')} variant="verified" />}
                {profile?.photoChecked && <Badge label={t('me.badgePhotoChecked')} variant="verified" />}
                {((sessionUser as any)?.photoApprovalStatus === 'pending' || (profile as any)?.photoApprovalStatus === 'pending') && (
                  <Badge label={t('me.badgePhotoReview')} variant="warning" />
                )}
                <Badge label={membershipTier || t('me.freeTier')} variant="gold" />
              </View>
            </View>
          </View>
        </Card>

        {/* Menu Items List */}
        <Card style={styles.menuCard}>
          {menuItems.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={[
                styles.menuRow,
                idx < menuItems.length - 1 && styles.menuRowBorder,
              ]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={styles.iconCircle}>
                <Ionicons name={item.icon as any} size={20} color={colors.royalMaroon} />
              </View>
              <View style={styles.menuTextCol}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSub}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </Card>

        {/* Logout Button */}
        <Button
          title={t('me.signOutButton')}
          onPress={handleSignOut}
          variant="secondary"
          style={styles.logoutBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: 110, // Ensure Sign Out button remains fully visible above bottom tab bar
  },
  userCard: {
    padding: spacing.base,
    marginBottom: spacing.base,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FAF5EE',
    borderWidth: 1.5,
    borderColor: colors.softGold,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 28,
  },
  userInfo: {
    flex: 1,
    marginLeft: spacing.base,
    justifyContent: 'center',
  },
  userName: {
    fontSize: typography.fontSizes.base,
    fontFamily: fonts.headingBold,
    fontWeight: '700',
    color: colors.charcoal,
    lineHeight: 22,
  },
  userSub: {
    fontSize: typography.fontSizes.xs,
    fontFamily: fonts.bodyRegular,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    alignItems: 'center',
  },
  menuCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: spacing.base,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    minHeight: 64,
  },
  menuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    flexShrink: 0,
  },
  menuIcon: {
    fontSize: 18,
  },
  menuTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  menuTitle: {
    fontSize: typography.fontSizes.sm,
    fontFamily: fonts.headingSemiBold,
    fontWeight: '600',
    color: colors.charcoal,
    lineHeight: 18,
  },
  menuSub: {
    fontSize: typography.fontSizes.xs,
    fontFamily: fonts.bodyRegular,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  menuArrow: {
    fontSize: 22,
    color: colors.textMuted,
    fontWeight: '300',
    marginLeft: spacing.xs,
  },
  logoutBtn: {
    marginTop: spacing.sm,
    minHeight: 50,
  },
});
