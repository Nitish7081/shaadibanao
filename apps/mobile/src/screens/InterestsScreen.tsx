import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Alert,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { MainTabParamList, RootStackParamList } from '../navigation/types';
import { ds, PressableScale, Skeleton, Chip } from '../design';
import {
  getReceivedInterests,
  getSentInterests,
  updateInterestStatus,
  withdrawInterest,
  getSessionToken,
} from '../services';
import { InterestItem } from '@bandhansetu/shared';
import { getSafeMatchPhoto, getInitials, formatHeight } from '../components/home/matchPhoto';

type InterestsNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Interests'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface Props {
  navigation: InterestsNavProp;
}

export const InterestsScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [activeTab, setActiveTab] = useState<'received' | 'sent' | 'accepted'>('received');
  const [receivedList, setReceivedList] = useState<InterestItem[]>([]);
  const [sentList, setSentList] = useState<InterestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchInterests = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const token = getSessionToken();
      const [recRes, sentRes] = await Promise.all([
        getReceivedInterests(token),
        getSentInterests(token),
      ]);

      if (recRes?.data) {
        setReceivedList(recRes.data);
      }
      if (sentRes?.data) {
        setSentList(sentRes.data);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load interests. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInterests();
  }, [fetchInterests]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchInterests();
    });
    return unsubscribe;
  }, [navigation, fetchInterests]);

  const handleAccept = async (interest: InterestItem) => {
    setActionLoadingId(interest.id);
    try {
      const token = getSessionToken();
      await updateInterestStatus(token, interest.id, 'accepted');
      Alert.alert(
        'Interest Accepted 🎉',
        `You accepted ${interest.profile?.displayName || 'member'}'s interest! A mutual match has been established.`
      );
      await fetchInterests();
    } catch (err: any) {
      Alert.alert('Action Failed', err?.message || 'Could not accept interest.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDecline = async (interest: InterestItem) => {
    setActionLoadingId(interest.id);
    try {
      const token = getSessionToken();
      await updateInterestStatus(token, interest.id, 'declined');
      Alert.alert('Declined', `Interest from ${interest.profile?.displayName || 'member'} has been declined.`);
      await fetchInterests();
    } catch (err: any) {
      Alert.alert('Action Failed', err?.message || 'Could not decline interest.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleWithdraw = async (interest: InterestItem) => {
    setActionLoadingId(interest.id);
    try {
      const token = getSessionToken();
      await withdrawInterest(token, interest.id);
      Alert.alert('Withdrawn', 'Interest has been withdrawn.');
      await fetchInterests();
    } catch (err: any) {
      Alert.alert('Action Failed', err?.message || 'Could not withdraw interest.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const pendingReceived = receivedList.filter((i) => i.status === 'pending');
  const acceptedList = [
    ...receivedList.filter((i) => i.status === 'accepted'),
    ...sentList.filter((i) => i.status === 'accepted'),
  ];
  const activeSent = sentList.filter((i) => i.status === 'pending');

  const currentData =
    activeTab === 'received'
      ? pendingReceived
      : activeTab === 'sent'
      ? activeSent
      : acceptedList;

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Recently';
    }
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.titleRow}>
        <View style={styles.titleTextCol}>
          <Text
            maxFontSizeMultiplier={1.2}
            style={styles.screenTitle}
          >
            {t('matchesScreen.interestsTitle')}
          </Text>
          <Text
            maxFontSizeMultiplier={1.2}
            style={styles.screenSubtitle}
          >
            {t('matchesScreen.interestsSubtitle')}
          </Text>
        </View>
        <PressableScale
          style={styles.searchShortcutBtn}
          onPress={() => navigation.navigate('Search')}
          accessibilityLabel="Find Matches"
        >
          <Ionicons name="search" size={20} color={ds.color.maroon} />
        </PressableScale>
      </View>

      {/* Segment Tabs */}
      <View style={styles.segmentedContainer}>
        <PressableScale
          style={[styles.segmentTab, activeTab === 'received' && styles.segmentTabActive]}
          onPress={() => setActiveTab('received')}
        >
          <Text
            maxFontSizeMultiplier={1.2}
            style={[styles.segmentLabel, activeTab === 'received' && styles.segmentLabelActive]}
          >
            {t('matchesScreen.tabReceived')}
          </Text>
          <View
            style={[
              styles.badgePill,
              activeTab === 'received' ? styles.badgePillActive : styles.badgePillInactive,
            ]}
          >
            <Text
              maxFontSizeMultiplier={1.2}
              style={[
                styles.badgeText,
                activeTab === 'received' ? styles.badgeTextActive : styles.badgeTextInactive,
              ]}
            >
              {pendingReceived.length}
            </Text>
          </View>
        </PressableScale>

        <PressableScale
          style={[styles.segmentTab, activeTab === 'sent' && styles.segmentTabActive]}
          onPress={() => setActiveTab('sent')}
        >
          <Text
            maxFontSizeMultiplier={1.2}
            style={[styles.segmentLabel, activeTab === 'sent' && styles.segmentLabelActive]}
          >
            {t('matchesScreen.tabSent')}
          </Text>
          <View
            style={[
              styles.badgePill,
              activeTab === 'sent' ? styles.badgePillActive : styles.badgePillInactive,
            ]}
          >
            <Text
              maxFontSizeMultiplier={1.2}
              style={[
                styles.badgeText,
                activeTab === 'sent' ? styles.badgeTextActive : styles.badgeTextInactive,
              ]}
            >
              {activeSent.length}
            </Text>
          </View>
        </PressableScale>

        <PressableScale
          style={[styles.segmentTab, activeTab === 'accepted' && styles.segmentTabActive]}
          onPress={() => setActiveTab('accepted')}
        >
          <Text
            maxFontSizeMultiplier={1.2}
            style={[styles.segmentLabel, activeTab === 'accepted' && styles.segmentLabelActive]}
          >
            {t('matchesScreen.tabMutual')}
          </Text>
          <View
            style={[
              styles.badgePill,
              activeTab === 'accepted' ? styles.badgePillActive : styles.badgePillInactive,
            ]}
          >
            <Text
              maxFontSizeMultiplier={1.2}
              style={[
                styles.badgeText,
                activeTab === 'accepted' ? styles.badgeTextActive : styles.badgeTextInactive,
              ]}
            >
              {acceptedList.length}
            </Text>
          </View>
        </PressableScale>
      </View>
    </View>
  );

  const renderCard = ({ item }: { item: InterestItem }) => {
    const profile = item.profile;
    const isActing = actionLoadingId === item.id;
    const safePhoto = profile ? getSafeMatchPhoto(profile as any, 'avatar') : null;
    const initials = getInitials(profile?.displayName);
    const heightStr = formatHeight(profile?.heightCm);

    return (
      <View style={styles.cardContainer}>
        {/* If mutual accepted, show celebratory banner */}
        {activeTab === 'accepted' && (
          <LinearGradient
            colors={['#FFF6E5', '#FFF0D4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.mutualHeaderBanner}
          >
            <Ionicons name="sparkles" size={16} color={ds.color.gold} />
            <Text maxFontSizeMultiplier={1.2} style={styles.mutualBannerText}>
              Mutual Connection Established
            </Text>
          </LinearGradient>
        )}

        <PressableScale
          style={styles.cardBody}
          onPress={() =>
            profile &&
            navigation.navigate('ProfileDetail', {
              profileId: profile.id,
              name: profile.displayName,
            })
          }
        >
          {/* Avatar / Photo */}
          <View style={styles.avatarWrapper}>
            {safePhoto ? (
              <Image
                source={{ uri: safePhoto.uri }}
                style={styles.avatarImage}
                blurRadius={safePhoto.blurred ? 12 : 0}
              />
            ) : (
              <LinearGradient
                colors={['#7A1528', '#A22842']}
                style={styles.avatarFallback}
              >
                <Text maxFontSizeMultiplier={1.2} style={styles.avatarFallbackText}>
                  {initials || 'BS'}
                </Text>
              </LinearGradient>
            )}

            {safePhoto?.blurred && (
              <View style={styles.photoPrivacyPill}>
                <Ionicons name="lock-closed" size={9} color="#FFFFFF" />
              </View>
            )}
          </View>

          {/* Profile Details */}
          <View style={styles.detailsCol}>
            <View style={styles.nameRow}>
              <Text
                maxFontSizeMultiplier={1.2}
                numberOfLines={1}
                style={styles.nameText}
              >
                {profile?.displayName || 'Member'}, {profile?.age || '--'}
              </Text>
              {profile?.isVerified && (
                <View style={styles.verifiedIconWrap}>
                  <Ionicons name="shield-checkmark" size={14} color="#166534" />
                </View>
              )}
            </View>

            <Text
              maxFontSizeMultiplier={1.2}
              numberOfLines={1}
              style={styles.locationMeta}
            >
              {heightStr ? `${heightStr} • ` : ''}{profile?.city || 'India'}
              {profile?.state ? `, ${profile.state}` : ''}
            </Text>

            {(profile?.education || profile?.occupation) && (
              <Text
                maxFontSizeMultiplier={1.2}
                numberOfLines={1}
                style={styles.careerMeta}
              >
                {profile.occupation || profile.education}
              </Text>
            )}

            <View style={styles.dateBadgeRow}>
              <Ionicons name="time-outline" size={12} color={ds.color.textMuted} />
              <Text maxFontSizeMultiplier={1.2} style={styles.dateBadgeText}>
                {activeTab === 'received'
                  ? `Received ${formatDate(item.createdAt)}`
                  : activeTab === 'sent'
                  ? `Sent ${formatDate(item.createdAt)}`
                  : `Matched ${formatDate(item.updatedAt || item.createdAt)}`}
              </Text>
            </View>
          </View>
        </PressableScale>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          {activeTab === 'received' && (
            <>
              <PressableScale
                style={[styles.actionBtn, styles.declineBtn]}
                onPress={() => handleDecline(item)}
                disabled={isActing}
                accessibilityLabel="Decline Interest"
              >
                <Ionicons name="close-circle-outline" size={16} color={ds.color.textMuted} />
                <Text maxFontSizeMultiplier={1.2} style={styles.declineBtnText}>
                  {t('matchesScreen.decline')}
                </Text>
              </PressableScale>

              <PressableScale
                style={[styles.actionBtn, styles.acceptBtn]}
                onPress={() => handleAccept(item)}
                disabled={isActing}
                accessibilityLabel="Accept Interest"
              >
                <Ionicons name="heart" size={16} color="#FFFFFF" />
                <Text maxFontSizeMultiplier={1.2} style={styles.acceptBtnText}>
                  {t('matchesScreen.accept')}
                </Text>
              </PressableScale>
            </>
          )}

          {activeTab === 'sent' && (
            <>
              <View style={styles.pendingBadge}>
                <Ionicons name="hourglass-outline" size={13} color="#92400E" />
                <Text maxFontSizeMultiplier={1.2} style={styles.pendingBadgeText}>
                  Awaiting Response
                </Text>
              </View>

              <PressableScale
                style={[styles.actionBtn, styles.withdrawBtn]}
                onPress={() => handleWithdraw(item)}
                disabled={isActing}
                accessibilityLabel="Withdraw Interest"
              >
                <Ionicons name="arrow-undo-outline" size={14} color={ds.color.maroon} />
                <Text maxFontSizeMultiplier={1.2} style={styles.withdrawBtnText}>
                  {t('matchesScreen.withdraw')}
                </Text>
              </PressableScale>
            </>
          )}

          {activeTab === 'accepted' && (
            <>
              <PressableScale
                style={[styles.actionBtn, styles.biodataBtn]}
                onPress={() =>
                  profile &&
                  navigation.navigate('ProfileDetail', {
                    profileId: profile.id,
                    name: profile.displayName,
                  })
                }
              >
                <Ionicons name="document-text-outline" size={15} color={ds.color.maroon} />
                <Text maxFontSizeMultiplier={1.2} style={styles.biodataBtnText}>
                  {t('matchesScreen.viewBiodata')}
                </Text>
              </PressableScale>

              <PressableScale
                style={[styles.actionBtn, styles.chatBtn]}
                onPress={() =>
                  profile &&
                  navigation.navigate('ChatDetail', {
                    conversationId: `conv-${item.id}`,
                    partnerName: profile.displayName,
                  })
                }
              >
                <Ionicons name="chatbubble-ellipses" size={15} color="#FFFFFF" />
                <Text maxFontSizeMultiplier={1.2} style={styles.chatBtnText}>
                  {t('matchesScreen.chatNow')}
                </Text>
              </PressableScale>
            </>
          )}
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    if (loading && !refreshing) {
      return (
        <View style={styles.skeletonContainer}>
          {[1, 2, 3].map((k) => (
            <View key={k} style={styles.skeletonCard}>
              <View style={styles.skeletonTop}>
                <Skeleton width={68} height={68} radius={14} />
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Skeleton width="60%" height={16} radius={4} style={{ marginBottom: 8 }} />
                  <Skeleton width="80%" height={14} radius={4} style={{ marginBottom: 8 }} />
                  <Skeleton width="40%" height={12} radius={4} />
                </View>
              </View>
              <View style={styles.skeletonBottom}>
                <Skeleton width="48%" height={38} radius={10} />
                <Skeleton width="48%" height={38} radius={10} />
              </View>
            </View>
          ))}
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.stateContainer}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="alert-circle-outline" size={36} color="#DC2626" />
          </View>
          <Text maxFontSizeMultiplier={1.2} style={styles.stateTitle}>
            Could Not Load Connections
          </Text>
          <Text maxFontSizeMultiplier={1.2} style={styles.stateSubtitle}>
            {error}
          </Text>
          <PressableScale style={styles.retryBtn} onPress={() => fetchInterests()}>
            <Ionicons name="refresh" size={16} color="#FFFFFF" />
            <Text maxFontSizeMultiplier={1.2} style={styles.retryBtnText}>
              Try Again
            </Text>
          </PressableScale>
        </View>
      );
    }

    const emptyTitle =
      activeTab === 'received'
        ? t('matchesScreen.emptyReceivedTitle')
        : activeTab === 'sent'
        ? t('matchesScreen.emptySentTitle')
        : t('matchesScreen.emptyMutualTitle');

    const emptySub =
      activeTab === 'received'
        ? t('matchesScreen.emptyReceivedSub')
        : activeTab === 'sent'
        ? t('matchesScreen.emptySentSub')
        : t('matchesScreen.emptyMutualSub');

    return (
      <View style={styles.stateContainer}>
        <LinearGradient
          colors={['#FFF6E8', '#FFEECF']}
          style={styles.emptyIconCircle}
        >
          <Ionicons
            name={
              activeTab === 'received'
                ? 'mail-unread-outline'
                : activeTab === 'sent'
                ? 'paper-plane-outline'
                : 'sparkles-outline'
            }
            size={34}
            color={ds.color.maroon}
          />
        </LinearGradient>
        <Text maxFontSizeMultiplier={1.2} style={styles.stateTitle}>
          {emptyTitle}
        </Text>
        <Text maxFontSizeMultiplier={1.2} style={styles.stateSubtitle}>
          {emptySub}
        </Text>
        <PressableScale
          style={styles.exploreBtn}
          onPress={() => navigation.navigate('Search')}
        >
          <Text maxFontSizeMultiplier={1.2} style={styles.exploreBtnText}>
            {t('matchesScreen.exploreProfiles')}
          </Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </PressableScale>
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screenBg}>
      <FlatList
        data={loading && !refreshing ? [] : currentData}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom + 90, 110) },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchInterests(true)}
            tintColor={ds.color.maroon}
            colors={[ds.color.maroon]}
          />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screenBg: {
    flex: 1,
    backgroundColor: ds.color.bg,
  },
  listContent: {
    paddingHorizontal: ds.space.md,
  },
  headerContainer: {
    paddingTop: ds.space.sm,
    paddingBottom: ds.space.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: ds.space.md,
  },
  titleTextCol: {
    flex: 1,
    paddingRight: ds.space.sm,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: ds.color.maroon,
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    fontSize: 13,
    color: ds.color.textMuted,
    marginTop: 2,
    lineHeight: 18,
  },
  searchShortcutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ds.color.surface,
    borderWidth: 1,
    borderColor: ds.color.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...ds.shadow.soft,
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: ds.color.surfaceWarm,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: ds.color.border,
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 10,
    gap: 5,
  },
  segmentTabActive: {
    backgroundColor: ds.color.surface,
    ...ds.shadow.soft,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: ds.color.textMuted,
  },
  segmentLabelActive: {
    color: ds.color.maroon,
    fontWeight: '700',
  },
  badgePill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
  },
  badgePillActive: {
    backgroundColor: ds.color.maroon,
  },
  badgePillInactive: {
    backgroundColor: ds.color.border,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTextActive: {
    color: '#FFFFFF',
  },
  badgeTextInactive: {
    color: ds.color.textMuted,
  },
  cardContainer: {
    backgroundColor: ds.color.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: ds.color.border,
    marginBottom: ds.space.md,
    overflow: 'hidden',
    ...ds.shadow.soft,
  },
  mutualHeaderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ds.space.md,
    paddingVertical: 6,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3E5CB',
  },
  mutualBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8A5D00',
  },
  cardBody: {
    flexDirection: 'row',
    padding: ds.space.md,
    alignItems: 'center',
  },
  avatarWrapper: {
    width: 68,
    height: 68,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: ds.color.surfaceWarm,
    borderWidth: 1,
    borderColor: ds.color.border,
    position: 'relative',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  photoPrivacyPill: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 999,
    padding: 3,
  },
  detailsCol: {
    flex: 1,
    marginLeft: ds.space.md,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nameText: {
    fontSize: 16,
    fontWeight: '700',
    color: ds.color.text,
    letterSpacing: -0.2,
  },
  verifiedIconWrap: {
    backgroundColor: '#DCFCE7',
    borderRadius: 999,
    padding: 2,
  },
  locationMeta: {
    fontSize: 13,
    color: ds.color.textMuted,
    marginTop: 2,
  },
  careerMeta: {
    fontSize: 13,
    color: ds.color.maroon,
    fontWeight: '500',
    marginTop: 2,
  },
  dateBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  dateBadgeText: {
    fontSize: 11,
    color: ds.color.textMuted,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ds.space.md,
    paddingVertical: ds.space.sm,
    borderTopWidth: 1,
    borderTopColor: ds.color.border,
    backgroundColor: '#FDFAF5',
    gap: ds.space.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  declineBtn: {
    backgroundColor: ds.color.surface,
    borderWidth: 1,
    borderColor: ds.color.border,
  },
  declineBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: ds.color.textMuted,
  },
  acceptBtn: {
    backgroundColor: ds.color.maroon,
  },
  acceptBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 4,
  },
  pendingBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  withdrawBtn: {
    backgroundColor: ds.color.surface,
    borderWidth: 1,
    borderColor: ds.color.border,
  },
  withdrawBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: ds.color.maroon,
  },
  biodataBtn: {
    backgroundColor: ds.color.surface,
    borderWidth: 1,
    borderColor: ds.color.border,
  },
  biodataBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: ds.color.maroon,
  },
  chatBtn: {
    backgroundColor: ds.color.maroon,
  },
  chatBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  skeletonContainer: {
    paddingTop: ds.space.sm,
  },
  skeletonCard: {
    backgroundColor: ds.color.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: ds.color.border,
    padding: ds.space.md,
    marginBottom: ds.space.md,
  },
  skeletonTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skeletonBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: ds.space.md,
    paddingTop: ds.space.sm,
    borderTopWidth: 1,
    borderTopColor: ds.color.border,
  },
  stateContainer: {
    backgroundColor: ds.color.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: ds.color.border,
    padding: ds.space.xl,
    alignItems: 'center',
    marginTop: ds.space.lg,
    ...ds.shadow.soft,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: ds.space.md,
  },
  stateTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: ds.color.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  stateSubtitle: {
    fontSize: 13,
    color: ds.color.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: ds.space.lg,
    paddingHorizontal: ds.space.sm,
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ds.color.maroon,
    paddingVertical: 12,
    paddingHorizontal: ds.space.lg,
    borderRadius: 14,
    gap: 8,
    ...ds.shadow.soft,
  },
  exploreBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  errorIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: ds.space.md,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ds.color.maroon,
    paddingVertical: 10,
    paddingHorizontal: ds.space.lg,
    borderRadius: 12,
    gap: 6,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
