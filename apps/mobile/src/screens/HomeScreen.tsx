import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainTabParamList, RootStackParamList } from '../navigation/types';
import { UserProfile, SearchResultProfile } from '@bandhansetu/shared';
import { getMyProfile } from '../services/profileService';
import { searchProfiles } from '../services/searchService';
import { loadActivitySummary } from '../services/activityService';
import { getSessionToken, getSessionUser } from '../services/authSession';
import { EmptyMatchesState, ErrorState, OfflineBanner } from '../components/royal';
import {
  HomeHeader,
  StoriesRow,
  HeroBanner,
  CompletionCard,
  StatTiles,
  SearchPill,
  ServiceGrid,
  FeedMatchCard,
  FeedSkeleton,
  VipBanner,
} from '../components/home';
import { SectionHeader, ds } from '../design';

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

  const openMatch = (match: SearchResultProfile) =>
    navigation.navigate('ProfileDetail', {
      profileId: match.id,
      name: match.displayName || 'Member',
    });

  return (
    <View style={styles.screenContainer}>
      <StatusBar barStyle="dark-content" backgroundColor={ds.color.bg} />

      {/* Header: existing ShaadiBanao logo + name, bell with badge, greeting, Live/Approved chips */}
      <HomeHeader
        topInset={Math.max(insets.top, 14)}
        userName={greetingName}
        hasNotifications={hasUnreadActivity}
        accountStatus={(sessionUser as any)?.approvalStatus}
        onNotificationsPress={() => navigation.navigate('Notifications')}
        onAccountPress={() => navigation.navigate('Profile')}
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadAllData(true)}
            tintColor={ds.color.maroon}
            colors={[ds.color.maroon, ds.color.gold]}
          />
        }
      >
        {offline && <OfflineBanner onRetry={() => loadAllData(true)} />}

        {/* Stories: your profile (+) then today's matches with real photos */}
        <StoriesRow
          profile={profile}
          userName={greetingName}
          matches={dailyMatches}
          loading={loadingMatches && dailyMatches.length === 0}
          onYourProfilePress={() => navigation.navigate('ProfileCreation')}
          onMatchPress={openMatch}
        />

        <HeroBanner onExplorePress={() => navigation.navigate('Matches')} />

        <CompletionCard
          percentage={completeness}
          onCompletePress={() => navigation.navigate('ProfileCreation')}
        />

        <StatTiles
          newInterests={stats.newInterests}
          mutualMatches={stats.mutualMatches}
          messages={stats.messages}
          onInterestsPress={() => navigation.navigate('Matches')}
          onMatchesPress={() => navigation.navigate('Matches')}
          onMessagesPress={() => navigation.navigate('Chat')}
        />

        {/* Today's Matches (right after the stats) */}
        <SectionHeader
          title="Today's Matches"
          actionLabel={`See all (${dailyMatches.length}) →`}
          onActionPress={() => navigation.navigate('Search')}
        />
        {loadingMatches && dailyMatches.length === 0 ? (
          <FeedSkeleton />
        ) : matchesError && dailyMatches.length === 0 ? (
          <ErrorState
            title="Could not load matches"
            message={matchesError}
            actionLabel="Try Again"
            onAction={() => loadAllData(true)}
          />
        ) : dailyMatches.length > 0 ? (
          dailyMatches.map((match) => (
            <FeedMatchCard key={match.id} match={match} onPress={() => openMatch(match)} />
          ))
        ) : (
          <EmptyMatchesState onSearchPress={() => navigation.navigate('Search')} />
        )}

        <View style={{ height: ds.space.sm }} />

        <SearchPill
          placeholder="Search by name, profile ID, or city..."
          onPress={() => navigation.navigate('Search')}
        />

        <ServiceGrid
          onFindMatchPress={() => navigation.navigate('Search')}
          onKundliMilanPress={() => navigation.navigate('Astrology', { initialTab: 'matching' })}
          onBookPanditPress={() => navigation.navigate('PanditServices')}
          onMuhuratFinderPress={() =>
            navigation.navigate('PanditServices', { ceremonyType: 'wedding' })
          }
          onAstrologyPress={() => navigation.navigate('Astrology', { initialTab: 'kundli' })}
          onCommunityPress={() => navigation.navigate('Community')}
          onMessagesPress={() => navigation.navigate('Chat')}
          onMyProfilePress={() => navigation.navigate('Profile')}
          newInterestsCount={stats.newInterests}
          unreadMessagesCount={stats.messages}
          profileCompletionPercent={completeness}
          isIdentityVerified={Boolean(
            profile?.isVerified || (sessionUser as any)?.identityVerificationStatus === 'verified'
          )}
        />

        <VipBanner onUpgradePress={() => navigation.navigate('Membership')} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: ds.color.bg,
  },
  scrollContent: {
    paddingHorizontal: ds.space.lg,
    paddingTop: ds.space.sm,
  },
});
