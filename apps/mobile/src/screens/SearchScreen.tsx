import React, { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainTabParamList, RootStackParamList } from '../navigation/types';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { Header } from '../components/common/Header';
import { Badge } from '../components/common/Badge';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import {
  searchProfiles,
  addShortlist,
  sendInterest,
  getSessionToken,
} from '../services';
import { SearchResultProfile, SearchFilterInput } from '@bandhansetu/shared';

type SearchNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Search'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface Props {
  navigation: SearchNavProp;
}

export const SearchScreen: React.FC<Props> = ({ navigation }) => {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [results, setResults] = useState<SearchResultProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const filterChips = [
    { id: 'all', label: 'All Matches' },
    { id: 'verified', label: '✓ Verified Only' },
    { id: 'delhi', label: 'Delhi NCR' },
    { id: 'age24_28', label: 'Age 24-28' },
    { id: 'engineer', label: 'Tech & Engineers' },
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
            setResults((prev) => [...prev, ...items]);
          }
          setTotalPages(res.data.pagination.totalPages);
          setTotalItems(res.data.pagination.totalCount);
          setPage(pageNum);
        }
      } catch (err: any) {
        setError(err.message || 'Unable to fetch profiles. Please try again.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [buildFilterParams]
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
    if (page < totalPages && !loading) {
      fetchProfiles(selectedFilter, page + 1);
    }
  };

  const handleSendInterest = async (item: SearchResultProfile) => {
    setActionLoadingId(item.id);
    try {
      const token = getSessionToken();
      const res = await sendInterest(token, item.id);
      Alert.alert(
        'Interest Sent',
        res.message || `Interest expressed to ${item.displayName}. You will be notified when accepted.`
      );
    } catch (err: any) {
      Alert.alert('Action Failed', err.message || 'Could not send interest. Please try again.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleShortlist = async (item: SearchResultProfile) => {
    setActionLoadingId(item.id);
    try {
      const token = getSessionToken();
      const res = await addShortlist(token, item.id);
      Alert.alert('Shortlisted', res.message || `${item.displayName} added to your shortlist.`);
    } catch (err: any) {
      Alert.alert('Shortlist Failed', err.message || 'Could not shortlist profile.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const formatHeight = (cm?: number) => {
    if (!cm) return '';
    const totalInches = Math.round(cm / 2.54);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return `${feet}'${inches}"`;
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <Header
        title="Search & Discover"
        onBack={() => navigation.goBack()}
        subtitle={loading ? 'Searching profiles...' : `${totalItems} Profiles Found`}
        showStatusBadge={true}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.royalMaroon}
            colors={[colors.royalMaroon]}
          />
        }
      >

        {/* Filter Chips Horizontal Scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          {filterChips.map((chip) => {
            const isSelected = selectedFilter === chip.id;
            return (
              <TouchableOpacity
                key={chip.id}
                onPress={() => handleFilterSelect(chip.id)}
                style={[styles.filterChip, isSelected && styles.filterChipSelected]}
              >
                <Text
                  style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}
                >
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Sort & Count Header */}
        <View style={styles.resultsMeta}>
          <Text style={styles.countText}>
            Showing {results.length} of {totalItems} profiles
          </Text>
          <Text style={styles.sortText}>Sort: Best Match ▾</Text>
        </View>

        {/* Error State */}
        {error && (
          <Card style={styles.errorCard}>
            <Text style={styles.errorTitle}>Unable to load matches</Text>
            <Text style={styles.errorSub}>{error}</Text>
            <Button
              title="Try Again"
              onPress={() => fetchProfiles(selectedFilter, 1)}
              variant="secondary"
              style={{ marginTop: spacing.md }}
            />
          </Card>
        )}

        {/* Loading Indicator */}
        {loading && results.length === 0 && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.royalMaroon} />
            <Text style={styles.loadingText}>Finding compatible matches...</Text>
          </View>
        )}

        {/* Empty State */}
        {!loading && !error && results.length === 0 && (
          <Card style={styles.emptyCard}>
            <Ionicons name="flower-outline" size={40} color={colors.royalMaroon} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>No matching profiles found</Text>
            <Text style={styles.emptySub}>
              Try broadening your filter criteria or checking back soon as new members register daily.
            </Text>
            <Button
              title="Reset Filters"
              onPress={() => setSelectedFilter('all')}
              variant="secondary"
              style={{ marginTop: spacing.md }}
            />
          </Card>
        )}

        {/* Results List */}
        {results.map((item) => {
          const isActing = actionLoadingId === item.id;
          const matchLabel = item.matchAlignment
            ? item.matchAlignment.scoreText
            : 'Evaluating preferences...';

          return (
            <Card key={item.id} style={styles.resultCard}>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('ProfileDetail', {
                    profileId: item.id,
                    name: item.displayName,
                  })
                }
                activeOpacity={0.85}
                style={styles.cardHeader}
              >
                <View style={styles.photoContainer}>
                  <Ionicons name="person" size={30} color={colors.royalMaroon} />
                  {item.isVerified && (
                    <View style={styles.verifiedDot}>
                      <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                    </View>
                  )}
                </View>

                <View style={styles.profileTextInfo}>
                  <Text style={styles.profileName}>
                    {item.displayName}, {item.age}
                  </Text>
                  <Text style={styles.profileMeta}>
                    {formatHeight(item.heightCm)} • {item.city}
                  </Text>
                  <Text style={styles.profileEducation}>
                    {item.education} • {item.occupation}
                  </Text>

                  <View style={styles.badgeRow}>
                    {item.isVerified && <Badge label="ID Verified" variant="verified" />}
                    {item.photoChecked && <Badge label="Photo Checked" variant="photoChecked" />}
                  </View>
                </View>
              </TouchableOpacity>

              {/* Factual Match Explanation */}
              <View style={styles.matchReasonContainer}>
                <Badge label={matchLabel} variant="match" icon="🎯" />
              </View>

              {/* Action Buttons */}
              <View style={styles.actionsRow}>
                <Button
                  title={isActing ? 'Processing...' : 'Send Interest'}
                  onPress={() => handleSendInterest(item)}
                  variant="primary"
                  loading={isActing}
                  style={styles.actionBtn}
                />
                <Button
                  title="Shortlist"
                  onPress={() => handleShortlist(item)}
                  variant="secondary"
                  disabled={isActing}
                  style={styles.actionBtn}
                />
              </View>
            </Card>
          );
        })}

        {/* Pagination: Load More */}
        {!loading && page < totalPages && (
          <Button
            title="Load More Matches"
            onPress={handleLoadMore}
            variant="secondary"
            style={styles.loadMoreBtn}
          />
        )}
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
    paddingBottom: 110,
  },
  chipsScroll: {
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.surface,
    marginRight: spacing.xs,
  },
  filterChipSelected: {
    backgroundColor: colors.royalMaroon,
    borderColor: colors.royalMaroon,
  },
  filterChipText: {
    fontSize: typography.fontSizes.xs,
    color: colors.charcoal,
    fontWeight: '500',
  },
  filterChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  resultsMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  countText: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  sortText: {
    fontSize: typography.fontSizes.xs,
    color: colors.royalMaroon,
    fontWeight: '600',
  },
  resultCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
  },
  photoContainer: {
    width: 80,
    height: 100,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  photoPlaceholder: {
    fontSize: 34,
  },
  verifiedDot: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: colors.verifiedGreen,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  verifiedCheck: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  profileTextInfo: {
    flex: 1,
    marginLeft: spacing.md,
    justifyContent: 'center',
  },
  profileName: {
    fontSize: typography.fontSizes.base,
    fontWeight: '700',
    color: colors.charcoal,
  },
  profileMeta: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  profileEducation: {
    fontSize: typography.fontSizes.xs,
    color: colors.charcoal,
    fontWeight: '500',
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  matchReasonContainer: {
    marginVertical: spacing.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionBtn: {
    flex: 1,
    minHeight: 40,
    paddingVertical: spacing.sm,
  },
  loadingContainer: {
    padding: spacing['2xl'],
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xl,
    marginTop: spacing.md,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: typography.fontSizes.base,
    fontWeight: '700',
    color: colors.charcoal,
  },
  emptySub: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  errorCard: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.errorBg,
    borderColor: colors.errorBorder,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  errorTitle: {
    fontSize: typography.fontSizes.base,
    fontWeight: '700',
    color: colors.alertRed,
  },
  errorSub: {
    fontSize: typography.fontSizes.xs,
    color: colors.charcoal,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  loadMoreBtn: {
    marginVertical: spacing.md,
  },
});
