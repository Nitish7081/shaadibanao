import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { ds, PressableScale, Skeleton } from '../design';
import { OfflineBanner } from '../components/royal';
import { getSessionToken } from '../services/authSession';
import {
  ActivityItem,
  ActivityKind,
  loadActivitySummary,
  formatRelativeTime,
} from '../services/activityService';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

const KIND_ICON: Record<ActivityKind, keyof typeof Ionicons.glyphMap> = {
  interest_received: 'heart',
  interest_accepted: 'sparkles',
  message: 'chatbubble-ellipses',
};

export const NotificationsScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const token = getSessionToken();
    if (!token) {
      setLoading(false);
      setRefreshing(false);
      setError('Please sign in again to view notifications.');
      return;
    }

    try {
      const summary = await loadActivitySummary(token);
      setItems(summary.feed);
      setOffline(summary.allFailed);
      setError(
        summary.allFailed
          ? 'Unable to reach the server.'
          : summary.failedCount > 0
          ? 'Some notifications could not be loaded.'
          : null
      );
    } catch (err: any) {
      setError(err?.message || 'Unable to load notifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handlePress = (item: ActivityItem) => {
    if (item.kind === 'message' && item.conversationId) {
      navigation.navigate('ChatDetail', {
        conversationId: item.conversationId,
        partnerName: item.partnerName || 'Member',
      });
    } else {
      navigation.navigate('MainTabs', { screen: 'Matches' });
    }
  };

  const renderHeader = () => (
    <View style={styles.headerBlock}>
      <View style={styles.headerTopRow}>
        <PressableScale
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={20} color={ds.color.maroon} />
        </PressableScale>

        <View style={styles.headerTitlesCol}>
          <Text
            maxFontSizeMultiplier={1.2}
            style={styles.screenHeading}
          >
            {t('notificationsScreen.headerTitle')}
          </Text>
          <Text
            maxFontSizeMultiplier={1.2}
            style={styles.screenSubheading}
          >
            {t('notificationsScreen.headerSubtitle')}
          </Text>
        </View>
      </View>

      {offline && <OfflineBanner onRetry={() => load(true)} />}
    </View>
  );

  const renderNotificationCard = ({ item }: { item: ActivityItem }) => (
    <PressableScale
      style={[
        styles.notifCard,
        item.unread && styles.notifCardUnread,
      ]}
      onPress={() => handlePress(item)}
      accessibilityLabel={item.title}
    >
      <View style={styles.notifRow}>
        <View
          style={[
            styles.iconWrap,
            item.unread ? styles.iconWrapUnread : styles.iconWrapRead,
          ]}
        >
          <Ionicons
            name={KIND_ICON[item.kind] || 'notifications'}
            size={18}
            color={item.unread ? '#FFFFFF' : ds.color.maroon}
          />
        </View>

        <View style={styles.notifContent}>
          <View style={styles.titleRow}>
            <Text
              maxFontSizeMultiplier={1.2}
              style={[styles.notifTitle, item.unread && styles.notifTitleUnread]}
            >
              {item.title}
            </Text>
            {item.unread && <View style={styles.unreadDot} />}
          </View>

          <Text
            maxFontSizeMultiplier={1.2}
            numberOfLines={2}
            style={styles.notifBody}
          >
            {item.body}
          </Text>

          <Text maxFontSizeMultiplier={1.2} style={styles.notifTime}>
            {formatRelativeTime(item.timestamp)}
          </Text>
        </View>
      </View>
    </PressableScale>
  );

  const renderEmptyOrLoading = () => {
    if (loading && !refreshing) {
      return (
        <View style={styles.skeletonContainer}>
          {[1, 2, 3].map((k) => (
            <View key={k} style={styles.skeletonCard}>
              <Skeleton width={44} height={44} radius={22} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Skeleton width="60%" height={16} radius={4} style={{ marginBottom: 6 }} />
                <Skeleton width="90%" height={14} radius={4} style={{ marginBottom: 6 }} />
                <Skeleton width="30%" height={11} radius={4} />
              </View>
            </View>
          ))}
        </View>
      );
    }

    if (error && items.length === 0) {
      return (
        <View style={styles.stateContainer}>
          <Ionicons name="alert-circle-outline" size={40} color="#DC2626" />
          <Text maxFontSizeMultiplier={1.2} style={styles.stateTitle}>
            {t('notificationsScreen.couldNotLoad')}
          </Text>
          <Text maxFontSizeMultiplier={1.2} style={styles.stateSub}>
            {error}
          </Text>
          <PressableScale style={styles.retryBtn} onPress={() => load(true)}>
            <Ionicons name="refresh" size={16} color="#FFFFFF" />
            <Text maxFontSizeMultiplier={1.2} style={styles.retryBtnText}>
              Try Again
            </Text>
          </PressableScale>
        </View>
      );
    }

    return (
      <View style={styles.stateContainer}>
        <LinearGradient
          colors={['#FFF6E8', '#FFEECF']}
          style={styles.emptyIconCircle}
        >
          <Ionicons name="notifications-outline" size={36} color={ds.color.maroon} />
        </LinearGradient>
        <Text maxFontSizeMultiplier={1.2} style={styles.stateTitle}>
          {t('notificationsScreen.allCaughtUpTitle')}
        </Text>
        <Text maxFontSizeMultiplier={1.2} style={styles.stateSub}>
          {t('notificationsScreen.allCaughtUpSub')}
        </Text>
        <PressableScale
          style={styles.exploreBtn}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Matches' })}
        >
          <Text maxFontSizeMultiplier={1.2} style={styles.exploreBtnText}>
            {t('notificationsScreen.exploreMatches')}
          </Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </PressableScale>
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screenBg}>
      <FlatList
        data={loading && !refreshing ? [] : items}
        keyExtractor={(item) => item.id}
        renderItem={renderNotificationCard}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyOrLoading}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom + 40, 60) },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
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
  headerBlock: {
    paddingTop: ds.space.sm,
    paddingBottom: ds.space.md,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: ds.space.xs,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: ds.color.surface,
    borderWidth: 1,
    borderColor: ds.color.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    ...ds.shadow.soft,
  },
  headerTitlesCol: {
    flex: 1,
  },
  screenHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: ds.color.maroon,
    letterSpacing: -0.3,
  },
  screenSubheading: {
    fontSize: 12,
    color: ds.color.textMuted,
    marginTop: 2,
  },
  notifCard: {
    backgroundColor: ds.color.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: ds.color.border,
    padding: ds.space.md,
    marginBottom: ds.space.sm,
    ...ds.shadow.soft,
  },
  notifCardUnread: {
    backgroundColor: '#FFFEFA',
    borderLeftWidth: 4,
    borderLeftColor: ds.color.maroon,
    borderColor: '#EBDCB9',
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconWrapUnread: {
    backgroundColor: ds.color.maroon,
  },
  iconWrapRead: {
    backgroundColor: ds.color.surfaceWarm,
    borderWidth: 1,
    borderColor: ds.color.border,
  },
  notifContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: ds.color.text,
    flex: 1,
  },
  notifTitleUnread: {
    fontWeight: '800',
    color: ds.color.maroon,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ds.color.maroon,
    marginLeft: 6,
  },
  notifBody: {
    fontSize: 13,
    color: ds.color.textBody,
    lineHeight: 18,
    marginTop: 2,
  },
  notifTime: {
    fontSize: 11,
    color: ds.color.textMuted,
    marginTop: 4,
  },
  skeletonContainer: {
    paddingTop: ds.space.sm,
  },
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ds.color.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: ds.color.border,
    padding: ds.space.md,
    marginBottom: ds.space.sm,
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
    marginBottom: 6,
  },
  stateSub: {
    fontSize: 13,
    color: ds.color.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: ds.space.lg,
    paddingHorizontal: ds.space.md,
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ds.color.maroon,
    paddingVertical: 11,
    paddingHorizontal: ds.space.lg,
    borderRadius: 14,
    gap: 8,
  },
  exploreBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
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
