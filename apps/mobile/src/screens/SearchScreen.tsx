import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { MainTabParamList, RootStackParamList } from '../navigation/types';
import { ds, PressableScale, Chip, Skeleton } from '../design';
import { colors } from '../constants/theme';
import {
  searchProfiles,
  addShortlist,
  sendInterest,
  getSessionToken,
} from '../services';
import { SearchResultProfile, SearchFilterInput } from '@bandhansetu/shared';
import { getSafeMatchPhoto, getInitials, formatHeight } from '../components/home/matchPhoto';

type SearchNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Search'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface Props {
  navigation: SearchNavProp;
}

export const SearchScreen: React.FC<Props> = ({ navigation }) => {
  const { t, i18n } = useTranslation();
  const isHindi = i18n.language === 'hi';
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [selectedFilter, setSelectedFilter] = useState('all');
  const [results, setResults] = useState<SearchResultProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const filterChips = [
    { id: 'all', label: isHindi ? 'सभी मैच' : 'All Matches', icon: 'sparkles' as const },
    { id: 'verified', label: isHindi ? '✓ केवल सत्यापित' : '✓ Verified Only', icon: 'shield-checkmark' as const },
    { id: 'delhi', label: 'Delhi NCR', icon: 'location' as const },
    { id: 'age24_28', label: isHindi ? 'आयु 24-28' : 'Age 24-28', icon: 'calendar' as const },
    { id: 'engineer', label: isHindi ? 'तकनीकी व इंजीनियर' : 'Tech & Engineers', icon: 'briefcase' as const },
  ];

  const buildFilterParams = useCallback((chipId: string, pageNum: number): Partial<SearchFilterInput> => {
    const params: Partial<SearchFilterInput> = {
      page: pageNum,
      limit: 10,
    };

    if (chipId === 'verified') {
      params.verifiedOnly = true;
    } else if (chipId === 'delhi') {
      params.city = 'Delhi';
    } else if (chipId === 'age24_28') {
      params.minAge = 24;
      params.maxAge = 28;
    } else if (chipId === 'engineer') {
      params.occupation = 'Engineer';
    }

    return params;
  }, []);

  const fetchProfiles = useCallback(
    async (chipId: string, pageNum = 1, isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else if (pageNum > 1) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const token = getSessionToken();
        const filters = buildFilterParams(chipId, pageNum);
        const res = await searchProfiles(token, filters);

        if (res.data) {
          const items = res.data.items;
          if (pageNum === 1) {
            setResults(items);
          } else {
            setResults((prev) => {
              const existingIds = new Set(prev.map((p) => p.id));
              const newItems = items.filter((p) => !existingIds.has(p.id));
              return [...prev, ...newItems];
            });
          }
          setTotalPages(res.data.pagination.totalPages);
          setTotalItems(res.data.pagination.totalCount);
          setPage(pageNum);
        }
      } catch (err: any) {
        setError(err.message || (isHindi ? 'मैच लोड नहीं हो सके। कृपया पुनः प्रयास करें।' : 'Unable to fetch profiles. Please try again.'));
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [buildFilterParams, isHindi]
  );

  useEffect(() => {
    fetchProfiles(selectedFilter, 1);
  }, [selectedFilter, fetchProfiles]);

  const handleFilterSelect = (chipId: string) => {
    setSelectedFilter(chipId);
  };

  const handleRefresh = () => {
    fetchProfiles(selectedFilter, 1, true);
  };

  const handleLoadMore = () => {
    if (page < totalPages && !loading && !loadingMore) {
      fetchProfiles(selectedFilter, page + 1);
    }
  };

  const handleSendInterest = async (item: SearchResultProfile) => {
    setActionLoadingId(item.id);
    try {
      const token = getSessionToken();
      const res = await sendInterest(token, item.id);
      Alert.alert(
        isHindi ? 'रुचि भेजी गई! 💌' : 'Interest Sent! 💌',
        res.message || (isHindi ? `${item.displayName} को रुचि भेजी गई। स्वीकार होने पर आपको सूचित किया जाएगा।` : `Interest expressed to ${item.displayName}. You will be notified when accepted.`)
      );
    } catch (err: any) {
      Alert.alert(
        isHindi ? 'प्रक्रिया विफल' : 'Action Failed',
        err.message || (isHindi ? 'रुचि नहीं भेजी जा सकी।' : 'Could not send interest. Please try again.')
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleShortlist = async (item: SearchResultProfile) => {
    setActionLoadingId(item.id);
    try {
      const token = getSessionToken();
      const res = await addShortlist(token, item.id);
      Alert.alert(
        isHindi ? 'शॉर्टलिस्टेड ⭐' : 'Shortlisted ⭐',
        res.message || (isHindi ? `${item.displayName} को आपकी शॉर्टलिस्ट में जोड़ा गया।` : `${item.displayName} added to your shortlist.`)
      );
    } catch (err: any) {
      Alert.alert(
        isHindi ? 'शॉर्टलिस्ट विफल' : 'Shortlist Failed',
        err.message || 'Could not shortlist profile.'
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const renderHeader = () => (
    <View style={styles.headerSection}>
      {/* Title & Subtitle */}
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.screenHeading} maxFontSizeMultiplier={1.2}>
            {isHindi ? 'जीवनसाथी खोजें' : 'Discover Matches'}
          </Text>
          <Text style={styles.screenSub} maxFontSizeMultiplier={1.2}>
            {isHindi ? 'वैदिक अनुकूलता और 100% सत्यापित प्रोफाइल' : 'Vedic compatibility & verified recommendations'}
          </Text>
        </View>
        <PressableScale
          onPress={() => navigation.navigate('Search')}
          style={styles.headerIconBtn}
          accessibilityLabel="Search Filters"
        >
          <Ionicons name="options-outline" size={20} color={ds.color.maroon} />
        </PressableScale>
      </View>

      {/* Filter Chips Horizontal Scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsScroll}
      >
        {filterChips.map((chip) => {
          const isSelected = selectedFilter === chip.id;
          return (
            <PressableScale
              key={chip.id}
              onPress={() => handleFilterSelect(chip.id)}
              style={[styles.filterChip, isSelected && styles.filterChipSelected]}
              accessibilityRole="button"
            >
              <Ionicons
                name={chip.icon}
                size={14}
                color={isSelected ? '#FFFFFF' : ds.color.maroon}
                style={{ marginRight: 5 }}
              />
              <Text
                style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}
                maxFontSizeMultiplier={1.2}
              >
                {chip.label}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>

      {/* Meta Bar */}
      <View style={styles.resultsMeta}>
        <Text style={styles.countText} maxFontSizeMultiplier={1.2}>
          {isHindi ? `${totalItems} प्रोफाइल उपलब्ध` : `Showing ${results.length} of ${totalItems} profiles`}
        </Text>
        <View style={styles.sortPill}>
          <Ionicons name="sparkles-outline" size={13} color={ds.color.goldDeep} />
          <Text style={styles.sortText} maxFontSizeMultiplier={1.2}>
            {isHindi ? 'शुभ मिलान' : 'Best Match'}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: SearchResultProfile }) => {
    const isActing = actionLoadingId === item.id;
    const matchLabel = item.matchAlignment ? item.matchAlignment.scoreText : (isHindi ? 'अनुकूलता का विश्लेषण...' : 'Evaluating compatibility...');
    const photo = getSafeMatchPhoto(item, 'card');
    const heightStr = formatHeight(item.heightCm);

    return (
      <View style={styles.cardContainer}>
        {/* Main Card Tap to Profile Detail */}
        <PressableScale
          onPress={() =>
            navigation.navigate('ProfileDetail', {
              profileId: item.id,
              name: item.displayName,
            })
          }
          style={styles.cardSurface}
        >
          {/* Card Top: Photo Media with gradient scrim */}
          <View style={styles.photoContainer}>
            {photo ? (
              <Image
                source={{ uri: photo.uri }}
                style={styles.photoImage}
                blurRadius={photo.blurred ? 24 : 0}
                resizeMode="cover"
              />
            ) : (
              <LinearGradient
                colors={['#FFF3E0', '#FFE0B2', '#FFCC80']}
                style={styles.photoInitialsGradient}
              >
                <Text style={styles.photoInitials}>{getInitials(item.displayName)}</Text>
              </LinearGradient>
            )}

            {/* Gradient scrim at bottom of photo for text contrast */}
            <LinearGradient
              colors={['transparent', 'rgba(30, 10, 15, 0.75)']}
              style={styles.photoScrim}
            />

            {/* Top Badges: Verified & Locked */}
            <View style={styles.photoTopBadges}>
              {item.isVerified ? (
                <View style={styles.verifiedTag}>
                  <Ionicons name="shield-checkmark" size={12} color="#FFFFFF" />
                  <Text style={styles.verifiedTagText}>
                    {isHindi ? 'सत्यापित' : 'VERIFIED'}
                  </Text>
                </View>
              ) : <View />}

              {photo?.blurred && (
                <View style={styles.privacyTag}>
                  <Ionicons name="lock-closed" size={11} color="#FFFFFF" />
                  <Text style={styles.privacyTagText}>
                    {isHindi ? 'गोपनीय' : 'PRIVATE'}
                  </Text>
                </View>
              )}
            </View>

            {/* Bottom Scrim Content: Name, Age, Location */}
            <View style={styles.photoBottomMeta}>
              <View style={styles.nameRow}>
                <Text style={styles.cardName} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                  {item.displayName}, {item.age}
                </Text>
                {item.isVerified && (
                  <Ionicons name="checkmark-circle" size={18} color={ds.color.gold} style={{ marginLeft: 6 }} />
                )}
              </View>
              <Text style={styles.cardSubText} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                {[heightStr, item.city].filter(Boolean).join(' • ')}
              </Text>
            </View>
          </View>

          {/* Card Body: Details & Match Chip */}
          <View style={styles.cardDetails}>
            {/* Profession & Education */}
            <View style={styles.detailRow}>
              <Ionicons name="briefcase-outline" size={15} color={ds.color.textMuted} />
              <Text style={styles.detailText} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                {[item.occupation, item.education].filter(Boolean).join(' • ') || (isHindi ? 'विवरण उपलब्ध नहीं' : 'Details not specified')}
              </Text>
            </View>

            {/* Religion & Mother Tongue */}
            <View style={styles.detailRow}>
              <Ionicons name="people-outline" size={15} color={ds.color.textMuted} />
              <Text style={styles.detailText} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                {[item.religion, item.motherTongue].filter(Boolean).join(' • ') || (isHindi ? 'हिंदू' : 'Hindu')}
              </Text>
            </View>

            {/* Match Compatibility Chip */}
            <View style={styles.matchPillWrap}>
              <View style={styles.matchBadge}>
                <Ionicons name="sparkles" size={13} color={ds.color.goldDeep} />
                <Text style={styles.matchBadgeText} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                  {matchLabel}
                </Text>
              </View>
            </View>
          </View>

          {/* Action Row: Shortlist & Connect Button */}
          <View style={styles.cardActions}>
            <PressableScale
              onPress={() => handleShortlist(item)}
              style={styles.shortlistBtn}
              accessibilityRole="button"
              accessibilityLabel={isHindi ? 'शॉर्टलिस्ट' : 'Shortlist'}
            >
              <Ionicons name="heart-outline" size={20} color={ds.color.maroon} />
            </PressableScale>

            <PressableScale
              onPress={() => handleSendInterest(item)}
              style={styles.connectBtn}
              accessibilityRole="button"
              accessibilityLabel={isHindi ? 'रुचि भेजें' : 'Connect'}
              disabled={isActing}
            >
              {isActing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={16} color="#FFFFFF" />
                  <Text style={styles.connectBtnText} maxFontSizeMultiplier={1.2}>
                    {isHindi ? 'रुचि भेजें' : 'Connect'}
                  </Text>
                </>
              )}
            </PressableScale>
          </View>
        </PressableScale>
      </View>
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return <View style={{ height: 30 }} />;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={ds.color.maroon} />
        <Text style={styles.footerLoaderText} maxFontSizeMultiplier={1.2}>
          {isHindi ? 'और मैच लोड हो रहे हैं...' : 'Loading more matches...'}
        </Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.skeletonContainer}>
          {[1, 2, 3].map((k) => (
            <View key={k} style={styles.skeletonCard}>
              <Skeleton width="100%" height={220} radius={ds.radius.lg} />
              <View style={{ marginTop: 12, paddingHorizontal: 12 }}>
                <Skeleton width="60%" height={20} radius={6} />
                <View style={{ height: 8 }} />
                <Skeleton width="40%" height={14} radius={4} />
              </View>
            </View>
          ))}
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerState}>
          <View style={styles.errorIconCircle}>
            <Ionicons name="cloud-offline-outline" size={36} color={ds.color.maroon} />
          </View>
          <Text style={styles.emptyTitle} maxFontSizeMultiplier={1.2}>
            {isHindi ? 'लोड करने में समस्या हुई' : 'Unable to Load Matches'}
          </Text>
          <Text style={styles.emptySub} maxFontSizeMultiplier={1.2}>
            {error}
          </Text>
          <PressableScale
            onPress={() => fetchProfiles(selectedFilter, 1)}
            style={styles.primaryActionBtn}
          >
            <Text style={styles.primaryActionBtnText} maxFontSizeMultiplier={1.2}>
              {isHindi ? 'पुनः प्रयास करें' : 'Try Again'}
            </Text>
          </PressableScale>
        </View>
      );
    }

    return (
      <View style={styles.centerState}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="heart-dislike-outline" size={40} color={ds.color.goldDeep} />
        </View>
        <Text style={styles.emptyTitle} maxFontSizeMultiplier={1.2}>
          {isHindi ? 'कोई मैचिंग प्रोफाइल नहीं मिली' : 'No Matching Profiles Found'}
        </Text>
        <Text style={styles.emptySub} maxFontSizeMultiplier={1.2}>
          {isHindi
            ? 'अधिक प्रोफाइल खोजने के लिए फ़िल्टर बदलकर देखें।'
            : 'Try adjusting your search filters to discover more compatible partner profiles.'}
        </Text>
        <PressableScale
          onPress={() => setSelectedFilter('all')}
          style={styles.primaryActionBtn}
        >
          <Text style={styles.primaryActionBtnText} maxFontSizeMultiplier={1.2}>
            {isHindi ? 'सभी मैच देखें' : 'View All Matches'}
          </Text>
        </PressableScale>
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <FlatList
        data={loading ? [] : results}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 90 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={ds.color.maroon}
            colors={[ds.color.maroon]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: ds.color.bg,
  },
  listContent: {
    paddingHorizontal: ds.space.lg,
    paddingTop: ds.space.sm,
  },
  headerSection: {
    marginBottom: ds.space.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: ds.space.sm,
  },
  screenHeading: {
    fontFamily: ds.font.headingBold,
    fontSize: 22,
    lineHeight: 28,
    color: colors.charcoal,
  },
  screenSub: {
    fontFamily: ds.font.bodyRegular,
    fontSize: 13,
    lineHeight: 18,
    color: ds.color.textMuted,
    marginTop: 2,
  },
  headerIconBtn: {
    width: 42,
    height: 42,
    borderRadius: ds.radius.pill,
    backgroundColor: ds.color.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: ds.color.border,
  },
  chipsScroll: {
    paddingVertical: ds.space.sm,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: ds.radius.pill,
    borderWidth: 1,
    borderColor: ds.color.border,
  },
  filterChipSelected: {
    backgroundColor: ds.color.maroon,
    borderColor: ds.color.maroon,
  },
  filterChipText: {
    fontFamily: ds.font.bodySemiBold,
    fontSize: 13,
    color: colors.charcoal,
  },
  filterChipTextSelected: {
    color: '#FFFFFF',
  },
  resultsMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: ds.space.xs,
    paddingHorizontal: 2,
  },
  countText: {
    fontFamily: ds.font.bodyMedium,
    fontSize: 13,
    color: ds.color.textMuted,
  },
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ds.color.surfaceWarm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: ds.radius.pill,
    borderWidth: 1,
    borderColor: ds.color.border,
  },
  sortText: {
    fontFamily: ds.font.bodySemiBold,
    fontSize: 12,
    color: ds.color.goldDeep,
  },
  cardContainer: {
    marginBottom: ds.space.lg,
  },
  cardSurface: {
    backgroundColor: '#FFFFFF',
    borderRadius: ds.radius.lg,
    borderWidth: 1,
    borderColor: ds.color.border,
    overflow: 'hidden',
    ...ds.shadow.soft,
  },
  photoContainer: {
    width: '100%',
    height: 260,
    position: 'relative',
    backgroundColor: '#F5ECE1',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoInitialsGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoInitials: {
    fontSize: 48,
    fontWeight: '700',
    color: ds.color.maroon,
    letterSpacing: 2,
  },
  photoScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 110,
  },
  photoTopBadges: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ds.color.maroon,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  verifiedTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  privacyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  privacyTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  photoBottomMeta: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    right: 14,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardName: {
    fontFamily: ds.font.headingBold,
    fontSize: 20,
    lineHeight: 26,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cardSubText: {
    fontFamily: ds.font.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  cardDetails: {
    padding: 14,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontFamily: ds.font.bodyRegular,
    fontSize: 13,
    color: ds.color.textBody,
    flex: 1,
  },
  matchPillWrap: {
    flexDirection: 'row',
    marginTop: 4,
  },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: ds.color.surfaceWarm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: ds.radius.pill,
    borderWidth: 1,
    borderColor: '#F3E5D0',
  },
  matchBadgeText: {
    fontFamily: ds.font.bodySemiBold,
    fontSize: 12,
    color: ds.color.goldDeep,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
  },
  shortlistBtn: {
    width: 46,
    height: 44,
    borderRadius: 12,
    backgroundColor: ds.color.surfaceWarm,
    borderWidth: 1,
    borderColor: ds.color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: ds.color.maroon,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...ds.shadow.soft,
  },
  connectBtnText: {
    fontFamily: ds.font.bodySemiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  footerLoaderText: {
    fontFamily: ds.font.bodyMedium,
    fontSize: 13,
    color: ds.color.textMuted,
  },
  skeletonContainer: {
    paddingTop: 10,
    gap: 16,
  },
  skeletonCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: ds.radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: ds.color.border,
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: ds.color.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: ds.color.border,
  },
  errorIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: ds.font.headingBold,
    fontSize: 18,
    color: colors.charcoal,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySub: {
    fontFamily: ds.font.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    color: ds.color.textMuted,
    textAlign: 'center',
    marginBottom: 20,
  },
  primaryActionBtn: {
    backgroundColor: ds.color.maroon,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 10,
    ...ds.shadow.soft,
  },
  primaryActionBtnText: {
    fontFamily: ds.font.bodySemiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
