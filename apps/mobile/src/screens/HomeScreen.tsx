import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainTabParamList, RootStackParamList } from '../navigation/types';
import { colors, spacing } from '../constants/theme';
import { UserProfile, SearchResultProfile } from '@bandhansetu/shared';
import { getMyProfile } from '../services/profileService';
import { searchProfiles } from '../services/searchService';
import { loadActivitySummary } from '../services/activityService';
import { getSessionToken, getSessionUser } from '../services/authSession';
import { Ionicons } from '@expo/vector-icons';
import {
  BrandedHeader,
  PremiumHeroBanner,
  ProfileCompletionCard,
  QuickStatisticsGrid,
  HomeSearchBar,
  ExploreServicesGrid,
  MatchCard,
  EmptyMatchesState,
  VipUpgradeBanner,
  LoadingState,
  ErrorState,
  OfflineBanner,
} from '../components/royal';

type HomeScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [dailyMatches, setDailyMatches] = useState<SearchResultProfile[]>([]);
  const [loadingMatches, setLoadingMatches] = useState<boolean>(true);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [offline, setOffline] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [stats, setStats] = useState({
    newInterests: 0,
    mutualMatches: 0,
    messages: 0,
  });

  const isNetworkError = (err: any): boolean =>
    err?.code === 'CONNECTION_FAILED' || err?.code === 'TIMEOUT_ERROR';

  const loadAllData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const token = getSessionToken();

    if (!token) {
      setLoadingMatches(false);
      setRefreshing(false);
      return;
    }

    setLoadingMatches(true);
    setMatchesError(null);
    let networkDown = false;

    const [profileRes, searchRes, activity] = await Promise.allSettled([
      getMyProfile(token),
      searchProfiles(token, { limit: 5 }),
      loadActivitySummary(token),
    ]);

    // 1. User profile (a missing profile is a normal state for new users)
    if (profileRes.status === 'fulfilled' && profileRes.value?.data) {
      setProfile(profileRes.value.data);
    } else if (profileRes.status === 'rejected' && isNetworkError(profileRes.reason)) {
      networkDown = true;
    }

    // 2. Today's matches
    if (searchRes.status === 'fulfilled') {
      setDailyMatches(searchRes.value?.data?.items || []);
    } else {
      if (isNetworkError(searchRes.reason)) networkDown = true;
      setMatchesError(searchRes.reason?.message || 'Unable to load matches right now.');
    }

    // 3. Real activity counts
    if (activity.status === 'fulfilled') {
      setStats({
        newInterests: activity.value.pendingInterests,
        mutualMatches: activity.value.mutualMatches,
        messages: activity.value.unreadMessages,
      });
      if (activity.value.allFailed) networkDown = true;
    }

    setOffline(networkDown);
    setLoadingMatches(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadAllData();
    });
    return unsubscribe;
  }, [navigation, loadAllData]);

  const sessionUser = getSessionUser();
  const greetingName =
    profile?.firstName ||
    (sessionUser as any)?.displayName?.split(' ')[0] ||
    (sessionUser as any)?.name?.split(' ')[0] ||
    'Member';

  // Real completion value; 0 when the profile has not been created yet
  const completeness = profile?.completenessPercent ?? 0;
  const hasUnreadActivity = stats.newInterests > 0 || stats.messages > 0;

  return (
    <View style={styles.screenContainer}>
      <StatusBar barStyle="light-content" backgroundColor={colors.royalMaroon} />

      {/* 1. BRANDED HEADER: ShaadiBanao logo, brand name, tagline, notification icon and user/account status */}
      <BrandedHeader
        topInset={Math.max(insets.top, 14)}
        userName={greetingName}
        hasNotifications={hasUnreadActivity}
        accountStatus={(sessionUser as any)?.approvalStatus}
        onNotificationsPress={() => navigation.navigate('Notifications')}
        onAccountPress={() => navigation.navigate('Profile')}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 90 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadAllData(true)}
            tintColor={colors.royalMaroon}
            colors={[colors.royalMaroon, colors.royalGold]}
          />
        }
      >
        {/* 2. PREMIUM HERO BANNER: Headline “Aapke perfect rishte ki shuruaat yahan se” & functional “Explore Matches” */}
        {offline && <OfflineBanner onRetry={() => loadAllData(true)} />}

        <PremiumHeroBanner
          onExplorePress={() => navigation.navigate('Matches')}
        />

        {/* 3. PROFILE COMPLETION: Progress indicator, actual percentage & “Complete Profile” action */}
        <ProfileCompletionCard
          percentage={completeness}
          onCompletePress={() => navigation.navigate('ProfileCreation')}
        />

        {/* 4. QUICK STATISTICS: Attractive cards for interests, mutual matches and messages */}
        <QuickStatisticsGrid
          newInterests={stats.newInterests}
          mutualMatches={stats.mutualMatches}
          messages={stats.messages}
          onInterestsPress={() => navigation.navigate('Matches')}
          onMatchesPress={() => navigation.navigate('Matches')}
          onMessagesPress={() => navigation.navigate('Chat')}
        />

        {/* 5. SEARCH: Modern rounded search bar for name, profile ID or city */}
        <HomeSearchBar
          placeholder="Search by name, profile ID, or city..."
          onPress={() => navigation.navigate('Search')}
        />

        {/* 6. EXPLORE SERVICES: Colorful 2-column grid of 8 modules */}
        <ExploreServicesGrid
          onFindMatchPress={() => navigation.navigate('Search')}
          onKundliMilanPress={() =>
            navigation.navigate('Astrology', { initialTab: 'matching' })
          }
          onBookPanditPress={() => navigation.navigate('PanditServices')}
          onMuhuratFinderPress={() =>
            navigation.navigate('PanditServices', { ceremonyType: 'wedding' })
          }
          onAstrologyPress={() =>
            navigation.navigate('Astrology', { initialTab: 'kundli' })
          }
          onCommunityPress={() => navigation.navigate('Community')}
          onMessagesPress={() => navigation.navigate('Chat')}
          onMyProfilePress={() => navigation.navigate('Profile')}
          newInterestsCount={stats.newInterests}
          unreadMessagesCount={stats.messages}
          profileCompletionPercent={completeness}
          isIdentityVerified={Boolean(profile?.isVerified || (sessionUser as any)?.identityVerificationStatus === 'verified')}
        />

        {/* 7. TODAY'S MATCHES: Modern profile cards with approved photos, age, city, profession and badges */}
        <View style={[styles.sectionHeaderRow, { marginTop: spacing.sm }]}>
          <View style={styles.sectionTitleGroup}>
            <Text style={styles.sectionTitle}>Today's Matches</Text>
          </View>
          <Text
            style={styles.sectionLink}
            onPress={() => navigation.navigate('Search')}
          >
            See all ({dailyMatches.length}) →
          </Text>
        </View>

        {loadingMatches ? (
          <LoadingState label="Loading matches..." />
        ) : matchesError && dailyMatches.length === 0 ? (
          <ErrorState
            title="Could not load matches"
            message={matchesError}
            actionLabel="Try Again"
            onAction={() => loadAllData(true)}
          />
        ) : dailyMatches.length > 0 ? (
          dailyMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              onPress={() =>
                navigation.navigate('ProfileDetail', {
                  profileId: match.id,
                  name: match.displayName || 'Member',
                })
              }
            />
          ))
        ) : (
          <EmptyMatchesState
            onSearchPress={() => navigation.navigate('Search')}
          />
        )}

        {/* VIP Upgrade Banner */}
        <VipUpgradeBanner
          onUpgradePress={() => navigation.navigate('Membership')}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: colors.ivory,
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs + 2,
  },
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionOmSymbol: {
    fontSize: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.charcoal,
    letterSpacing: 0.1,
  },
  sectionLink: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.royalMaroon,
  },
  loadingContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
});
