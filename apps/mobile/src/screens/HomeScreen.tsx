import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Linking,
  FlatList,
  useWindowDimensions,
  BackHandler,
  ToastAndroid,
  Platform,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { MainTabParamList, RootStackParamList } from '../navigation/types';
import { UserProfile, SearchResultProfile, HomeBanner, bannerActionFor } from '@bandhansetu/shared';
import { FastAppCache } from '../utils/lruCache';
import { getMyProfile } from '../services/profileService';
import { searchProfiles } from '../services/searchService';
import { loadActivitySummary } from '../services/activityService';
import { getActiveBanners } from '../services/bannerService';
import { getSessionToken, getSessionUser, getCachedUserProfile, setCachedUserProfile, setCachedUserMembership } from '../services/authSession';
import { getMyMembership } from '../services/membershipService';
import { EmptyMatchesState, ErrorState, OfflineBanner } from '../components/royal';
import {
  HomeHeader,
  StoriesRow,
  HeroBanner,
  CompletionCard,
  StatTiles,
  SearchPill,
  ServiceGrid,
  CompactMatchCard,
  FeedSkeleton,
  VipBanner,
} from '../components/home';
import { SectionHeader, ds, AnimatedPage, AnimatedStaggerItem } from '../design';

type HomeScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const matchCardWidth = Math.min(290, Math.max(240, Math.round(screenWidth * 0.68)));

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [dailyMatches, setDailyMatches] = useState<SearchResultProfile[]>([]);
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [loadingMatches, setLoadingMatches] = useState<boolean>(true);
  const [loadingBanners, setLoadingBanners] = useState<boolean>(true);
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

  // Modern Android Back Button: Double tap to exit from Home, single tap stays on Home
  useFocusEffect(
    useCallback(() => {
      let lastBackPress = 0;
      const onBackPress = () => {
        const now = Date.now();
        if (now - lastBackPress < 2000) {
          BackHandler.exitApp();
          return true;
        }
        lastBackPress = now;
        if (Platform.OS === 'android') {
          ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
        }
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [])
  );

  const loadAllData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const token = getSessionToken();

    if (!token) {
      setLoadingMatches(false);
      setLoadingBanners(false);
      setRefreshing(false);
      return;
    }

    let networkDown = false;
    let effectiveProfile = getCachedUserProfile();

    // Instant DSA Memory/Storage Retrieval (0ms cold-start)
    if (!profile && effectiveProfile) {
      setProfile(effectiveProfile);
    }
    const cachedMatches = FastAppCache.getMemory<SearchResultProfile[]>('daily_matches');
    if (cachedMatches && cachedMatches.length > 0 && dailyMatches.length === 0) {
      setDailyMatches(cachedMatches);
      setLoadingMatches(false);
    }
    const cachedBanners = FastAppCache.getMemory<HomeBanner[]>('home_banners');
    if (cachedBanners && cachedBanners.length > 0 && banners.length === 0) {
      setBanners(cachedBanners);
      setLoadingBanners(false);
    }

    if (!cachedMatches || cachedMatches.length === 0) {
      setLoadingMatches(true);
    }
    if (!cachedBanners || cachedBanners.length === 0) {
      setLoadingBanners(true);
    }
    setMatchesError(null);

    const viewerGender = effectiveProfile?.gender?.toLowerCase?.();
    const requiredOpposite =
      viewerGender === 'male' ? 'female' : viewerGender === 'female' ? 'male' : undefined;

    // Run all home screen data requirements in a single parallel batch
    const [freshProfileRes, searchRes, activity, bannersRes] = await Promise.allSettled([
      getMyProfile(token),
      searchProfiles(token, { limit: 8 }),
      loadActivitySummary(token),
      getActiveBanners(isRefresh),
    ]);

    // 1. User profile update
    if (freshProfileRes.status === 'fulfilled' && freshProfileRes.value?.data) {
      effectiveProfile = freshProfileRes.value.data;
      setProfile(freshProfileRes.value.data);
      setCachedUserProfile(freshProfileRes.value.data);
    } else if (freshProfileRes.status === 'rejected' && isNetworkError(freshProfileRes.reason)) {
      networkDown = true;
    }

    // Fetch membership asynchronously to keep paywall cache updated
    getMyMembership(token).then((mRes) => {
      if (mRes?.data) setCachedUserMembership(mRes.data);
    }).catch(() => {});

    // 2. Active admin banners
    if (bannersRes.status === 'fulfilled') {
      const freshBanners = bannersRes.value || [];
      setBanners(freshBanners);
      FastAppCache.set('home_banners', freshBanners, 15 * 60 * 1000);
    }
    setLoadingBanners(false);

    // 3. Today's matches (strictly opposite gender enforced both server-side & client-side)
    const finalViewerGender = effectiveProfile?.gender?.toLowerCase?.();
    const finalOpposite =
      finalViewerGender === 'male' ? 'female' : finalViewerGender === 'female' ? 'male' : undefined;

    if (searchRes.status === 'fulfilled') {
      const items = searchRes.value?.data?.items || [];
      if (finalOpposite) {
        const strictlyFiltered = items.filter(
          (m: any) => String(m.gender || '').toLowerCase() === finalOpposite
        );
        setDailyMatches(strictlyFiltered);
        FastAppCache.set('daily_matches', strictlyFiltered, 5 * 60 * 1000);

        if (requiredOpposite !== finalOpposite) {
          searchProfiles(token, { limit: 8 })
            .then((fresh) => {
              if (fresh?.data?.items) {
                const refreshedFiltered = fresh.data.items.filter(
                  (m: any) => String(m.gender || '').toLowerCase() === finalOpposite
                );
                setDailyMatches(refreshedFiltered);
                FastAppCache.set('daily_matches', refreshedFiltered, 5 * 60 * 1000);
              }
            })
            .catch(() => {});
        }
      } else {
        setDailyMatches([]);
      }
    } else {
      if (isNetworkError(searchRes.reason)) networkDown = true;
      setMatchesError(searchRes.reason?.message || t('home.unableToLoad'));
    }

    // Profile 100% Completion Notification / Dialog Trigger
    if (effectiveProfile && (effectiveProfile.completenessPercent === 100 || (effectiveProfile.firstName && effectiveProfile.photos?.length))) {
      AsyncStorage.getItem('@shaadibanao_celebrated_100').then((val) => {
        if (!val) {
          AsyncStorage.setItem('@shaadibanao_celebrated_100', 'true').catch(() => {});
          Alert.alert(
            '🎉 Profile 100% Complete!',
            'Badhai ho! Aapka matrimonial profile 100% complete ho chuka hai. Rishton ke matches aur proposals ab aapko tezi se milenge.',
            [{ text: 'Dhanyawad' }]
          );
        }
      }).catch(() => {});
    }

    // 4. Real activity counts
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
  }, [t]);

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
    (sessionUser as any)?.email?.split('@')[0] ||
    t('common.member');

  // Real completion value; 0 when the profile has not been created yet
  const completeness = profile?.completenessPercent ?? 0;
  const hasUnreadActivity = stats.newInterests > 0 || stats.messages > 0;

  const openMatch = (match: SearchResultProfile) =>
    navigation.navigate('ProfileDetail', {
      profileId: match.id,
      name: match.displayName || t('common.member'),
    });

  const handleBannerPress = (banner: HomeBanner) => {
    const action = bannerActionFor(banner.linkUrl);
    if (action.kind === 'external') {
      Linking.openURL(action.url).catch(() => {});
    } else if (action.kind === 'screen') {
      const parent = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
      if (parent) {
        parent.navigate(action.screen as any);
      } else {
        (navigation as any).navigate(action.screen);
      }
    } else if (action.kind === 'tab') {
      navigation.navigate(action.screen as any);
    } else {
      navigation.navigate('Matches');
    }
  };

  return (
    <View style={styles.screenContainer}>
      <StatusBar style="dark" />

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
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) + 20 }]}
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
        <AnimatedPage duration={300}>
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

        <HeroBanner
          banners={banners}
          loading={loadingBanners && banners.length === 0}
          onBannerPress={handleBannerPress}
          onExplorePress={() => navigation.navigate('Matches')}
        />

        {completeness < 100 && (
          <CompletionCard
            percentage={completeness}
            onCompletePress={() => navigation.navigate('ProfileCreation')}
          />
        )}

        <StatTiles
          newInterests={stats.newInterests}
          mutualMatches={stats.mutualMatches}
          messages={stats.messages}
          onInterestsPress={() => navigation.navigate('Matches')}
          onMatchesPress={() => navigation.navigate('Matches')}
          onMessagesPress={() => navigation.navigate('Chat')}
        />

        {/* Today's Matches (compact horizontal snap carousel, at most 8) */}
        <SectionHeader
          title={t('home.todaysMatches')}
          actionLabel={t('home.seeAll', { count: dailyMatches.length })}
          onActionPress={() => navigation.navigate('Search')}
        />
        {loadingMatches && dailyMatches.length === 0 ? (
          <FeedSkeleton />
        ) : matchesError && dailyMatches.length === 0 ? (
          <ErrorState
            title={t('home.couldNotLoad')}
            message={matchesError}
            actionLabel={t('common.tryAgain')}
            onAction={() => loadAllData(true)}
          />
        ) : dailyMatches.length > 0 ? (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={dailyMatches.slice(0, 8)}
            keyExtractor={(item) => item.id}
            snapToInterval={matchCardWidth + 12}
            decelerationRate="fast"
            initialNumToRender={4}
            maxToRenderPerBatch={4}
            windowSize={4}
            contentContainerStyle={styles.horizontalMatchesContent}
            renderItem={({ item, index }) => (
              <AnimatedStaggerItem index={index}>
                <CompactMatchCard
                  match={item}
                  width={matchCardWidth}
                  onPress={() => openMatch(item)}
                />
              </AnimatedStaggerItem>
            )}
          />
        ) : (
          <EmptyMatchesState onSearchPress={() => navigation.navigate('Search')} />
        )}

        <View style={{ height: ds.space.sm }} />

        <SearchPill
          placeholder={t('home.searchPlaceholder')}
          onPress={() => navigation.navigate('Search')}
        />

        <ServiceGrid
          onFindMatchPress={() => navigation.navigate('Search')}
          onKundliMilanPress={() => navigation.navigate('Astrology', { initialTab: 'matching' })}
          onBookPanditPress={() => navigation.navigate('PanditServices')}
          onMuhuratFinderPress={() =>
            (navigation as any).navigate('MuhuratFinder', { ceremonyType: 'wedding' })
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
        </AnimatedPage>

        <View style={{ height: ds.space.md }} />

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
  horizontalMatchesContent: {
    paddingVertical: ds.space.xs,
    paddingRight: ds.space.sm,
  },
});
