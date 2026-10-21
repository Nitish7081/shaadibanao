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
import { StatusNotice } from '../components/common/StatusNotice';
import {
  getReceivedInterests,
  getSentInterests,
  updateInterestStatus,
  withdrawInterest,
  getSessionToken,
} from '../services';
import { InterestItem } from '@bandhansetu/shared';

type InterestsNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Interests'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface Props {
  navigation: InterestsNavProp;
}

export const InterestsScreen: React.FC<Props> = ({ navigation }) => {
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

      if (recRes.data) {
        setReceivedList(recRes.data);
      }
      if (sentRes.data) {
        setSentList(sentRes.data);
      }
    } catch (err: any) {
      setError(err.message || 'Unable to load interests. Please try again.');
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
        `You accepted ${interest.profile.displayName}'s interest! A mutual match has been established.`
      );
      await fetchInterests();
    } catch (err: any) {
      Alert.alert('Action Failed', err.message || 'Could not accept interest.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDecline = async (interest: InterestItem) => {
    setActionLoadingId(interest.id);
    try {
      const token = getSessionToken();
      await updateInterestStatus(token, interest.id, 'declined');
      Alert.alert('Declined', `Interest from ${interest.profile.displayName} has been declined.`);
      await fetchInterests();
    } catch (err: any) {
      Alert.alert('Action Failed', err.message || 'Could not decline interest.');
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
      Alert.alert('Action Failed', err.message || 'Could not withdraw interest.');
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

  const formatHeight = (cm?: number) => {
    if (!cm) return '';
    const totalInches = Math.round(cm / 2.54);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return `${feet}'${inches}"`;
  };

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

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <Header
        title="Interests & Matches"
        subtitle="Manage your sacred connections"
        showStatusBadge={true}
        variant="royal"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchInterests(true)}
            tintColor={colors.royalMaroon}
            colors={[colors.royalMaroon]}
          />
        }
      >
        <StatusNotice
          milestoneText="Milestone 5 Interest Workflow Active"
          subtext="Recipient-only acceptance and withdrawal rules strictly enforced by the backend."
        />

        {/* Tab Switcher */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'received' && styles.tabBtnActive]}
            onPress={() => setActiveTab('received')}
          >
            <Text style={[styles.tabText, activeTab === 'received' && styles.tabTextActive]}>
              Received ({pendingReceived.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'sent' && styles.tabBtnActive]}
            onPress={() => setActiveTab('sent')}
          >
            <Text style={[styles.tabText, activeTab === 'sent' && styles.tabTextActive]}>
              Sent ({activeSent.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'accepted' && styles.tabBtnActive]}
            onPress={() => setActiveTab('accepted')}
          >
            <Text style={[styles.tabText, activeTab === 'accepted' && styles.tabTextActive]}>
              Accepted ({acceptedList.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Loading Indicator */}
        {loading && !refreshing && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.royalMaroon} />
            <Text style={styles.loadingText}>Fetching connection updates...</Text>
          </View>
        )}

        {/* Error State */}
        {error && (
          <Card style={styles.errorCard}>
            <Text style={styles.errorTitle}>Error Loading Interests</Text>
            <Text style={styles.errorSub}>{error}</Text>
            <Button
              title="Try Again"
              onPress={() => fetchInterests()}
              variant="secondary"
              style={{ marginTop: spacing.md }}
            />
          </Card>
        )}

        {/* Tab: Received */}
        {!loading && activeTab === 'received' && (
          <>
            {pendingReceived.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Ionicons name="flower-outline" size={40} color={colors.royalMaroon} style={styles.emptyIcon} />
                <Text style={styles.emptyTitle}>No pending interests</Text>
                <Text style={styles.emptySub}>
                  When members express interest in your profile, their requests will appear here for your review.
                </Text>
                <Button
                  title="Discover Profiles"
                  onPress={() => navigation.navigate('Search')}
                  variant="secondary"
                  style={{ marginTop: spacing.md }}
                />
              </Card>
            ) : (
              pendingReceived.map((item) => {
                const isActing = actionLoadingId === item.id;
                return (
                  <Card key={item.id} style={styles.itemCard}>
                    <TouchableOpacity
                      onPress={() =>
                        navigation.navigate('ProfileDetail', {
                          profileId: item.profile.id,
                          name: item.profile.displayName,
                        })
                      }
                      style={styles.cardTop}
                    >
                      <View style={styles.avatarBox}>
                        <Ionicons name="person" size={22} color={colors.royalMaroon} />
                      </View>

                      <View style={styles.infoBox}>
                        <Text style={styles.personName}>
                          {item.profile.displayName}, {item.profile.age}
                        </Text>
                        <Text style={styles.metaLine}>
                          {formatHeight(item.profile.heightCm)} • {item.profile.city}
                        </Text>
                        <Text style={styles.jobLine}>
                          {item.profile.education} • {item.profile.occupation}
                        </Text>
                        <Text style={styles.timeLine}>Received {formatDate(item.createdAt)}</Text>
                      </View>
                      {item.profile.isVerified && <Badge label="Verified" variant="verified" />}
                    </TouchableOpacity>

                    <View style={styles.buttonGroup}>
                      <Button
                        title="Accept"
                        onPress={() => handleAccept(item)}
                        variant="primary"
                        loading={isActing}
                        disabled={isActing}
                        style={styles.halfBtn}
                      />
                      <Button
                        title="Decline"
                        onPress={() => handleDecline(item)}
                        variant="secondary"
                        disabled={isActing}
                        style={styles.halfBtn}
                      />
                    </View>
                  </Card>
                );
              })
            )}
          </>
        )}

        {/* Tab: Sent */}
        {!loading && activeTab === 'sent' && (
          <>
            {activeSent.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Ionicons name="flower-outline" size={40} color={colors.royalMaroon} style={styles.emptyIcon} />
                <Text style={styles.emptyTitle}>No pending sent interests</Text>
                <Text style={styles.emptySub}>
                  You have no outgoing interests awaiting response. Explore profiles and connect!
                </Text>
                <Button
                  title="Search Matches"
                  onPress={() => navigation.navigate('Search')}
                  variant="primary"
                  style={{ marginTop: spacing.md }}
                />
              </Card>
            ) : (
              activeSent.map((item) => {
                const isActing = actionLoadingId === item.id;
                return (
                  <Card key={item.id} style={styles.itemCard}>
                    <TouchableOpacity
                      onPress={() =>
                        navigation.navigate('ProfileDetail', {
                          profileId: item.profile.id,
                          name: item.profile.displayName,
                        })
                      }
                      style={styles.cardTop}
                    >
                      <View style={styles.avatarBox}>
                        <Ionicons name="person" size={22} color={colors.royalMaroon} />
                      </View>

                      <View style={styles.infoBox}>
                        <Text style={styles.personName}>
                          {item.profile.displayName}, {item.profile.age}
                        </Text>
                        <Text style={styles.metaLine}>
                          {formatHeight(item.profile.heightCm)} • {item.profile.city}
                        </Text>
                        <Text style={styles.jobLine}>
                          {item.profile.education} • {item.profile.occupation}
                        </Text>
                        <Text style={styles.timeLine}>Sent {formatDate(item.createdAt)}</Text>
                      </View>
                      <Badge label="Pending" variant="match" />
                    </TouchableOpacity>

                    <View style={styles.buttonGroup}>
                      <Button
                        title="Withdraw Request"
                        onPress={() => handleWithdraw(item)}
                        variant="secondary"
                        loading={isActing}
                        disabled={isActing}
                        style={styles.fullBtn}
                      />
                    </View>
                  </Card>
                );
              })
            )}
          </>
        )}

        {/* Tab: Accepted (Mutual Matches) */}
        {!loading && activeTab === 'accepted' && (
          <>
            {acceptedList.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Ionicons name="flower-outline" size={40} color={colors.royalMaroon} style={styles.emptyIcon} />
                <Text style={styles.emptyTitle}>No mutual matches yet</Text>
                <Text style={styles.emptySub}>
                  When an interest is mutually accepted, your connection will appear here to start communicating.
                </Text>
                <Button
                  title="Search Matches"
                  onPress={() => navigation.navigate('Search')}
                  variant="secondary"
                  style={{ marginTop: spacing.md }}
                />
              </Card>
            ) : (
              acceptedList.map((item) => (
                <Card key={item.id} style={styles.itemCard}>
                  <View style={styles.mutualMatchBanner}>
                    <Ionicons name="sparkles" size={22} color={colors.royalGold} />
                    <View style={styles.bannerTextContainer}>
                      <Text style={styles.bannerTitle}>
                        Mutual Match with {item.profile.displayName}
                      </Text>
                      <Text style={styles.bannerSub}>
                        Both sides have accepted interest! You can now start communicating.
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() =>
                      navigation.navigate('ProfileDetail', {
                        profileId: item.profile.id,
                        name: item.profile.displayName,
                      })
                    }
                    style={styles.cardTop}
                  >
                    <View style={styles.avatarBox}>
                      <Ionicons name="person" size={22} color={colors.royalMaroon} />
                    </View>
                    <View style={styles.infoBox}>
                      <Text style={styles.personName}>
                        {item.profile.displayName}, {item.profile.age}
                      </Text>
                      <Text style={styles.metaLine}>
                        {formatHeight(item.profile.heightCm)} • {item.profile.city} • {item.profile.occupation}
                      </Text>
                      <Text style={styles.timeLine}>Connected {formatDate(item.updatedAt)}</Text>
                    </View>
                  </TouchableOpacity>

                  <Button
                    title="Open Conversation"
                    onPress={() =>
                      navigation.navigate('ChatDetail', {
                        conversationId: `conv-${item.id}`,
                        partnerName: item.profile.displayName,
                      })
                    }
                    variant="primary"
                    style={{ marginTop: spacing.md }}
                  />
                </Card>
              ))
            )}
          </>
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
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceCard,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    padding: 3,
    marginBottom: spacing.base,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  tabBtnActive: {
    backgroundColor: colors.royalMaroon,
  },
  tabText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: '600',
    color: colors.charcoal,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  mutualMatchBanner: {
    backgroundColor: '#E8F5E9',
    borderColor: colors.verifiedGreen,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerEmoji: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: typography.fontSizes.xs,
    fontWeight: '700',
    color: '#1B5E20',
  },
  bannerSub: {
    fontSize: typography.fontSizes.xs - 2,
    color: colors.charcoal,
    marginTop: 1,
  },
  itemCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBox: {
    width: 60,
    height: 70,
    backgroundColor: colors.surfaceCard,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIcon: {
    fontSize: 26,
  },
  infoBox: {
    flex: 1,
    marginLeft: spacing.md,
  },
  personName: {
    fontSize: typography.fontSizes.base,
    fontWeight: '700',
    color: colors.charcoal,
  },
  metaLine: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  jobLine: {
    fontSize: typography.fontSizes.xs,
    color: colors.charcoal,
    fontWeight: '500',
    marginTop: 1,
  },
  timeLine: {
    fontSize: typography.fontSizes.xs - 2,
    color: colors.textMuted,
    marginTop: 2,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  halfBtn: {
    flex: 1,
    minHeight: 40,
  },
  fullBtn: {
    width: '100%',
    minHeight: 40,
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
  loadingContainer: {
    padding: spacing['2xl'],
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
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
});
