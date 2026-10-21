import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, typography, spacing } from '../constants/theme';
import { Header } from '../components/common/Header';
import { Card } from '../components/common/Card';
import { LoadingState, EmptyState, ErrorState, OfflineBanner } from '../components/royal';
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

/**
 * Notifications are derived from real backend activity
 * (interests received/accepted and conversations). No demo content.
 */
export const NotificationsScreen: React.FC<Props> = ({ navigation }) => {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
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

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <Header
        title="Notifications"
        subtitle="Recent activity on your account"
        onBack={() => navigation.goBack()}
        showStatusBadge={true}
        variant="royal"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.royalMaroon}
            colors={[colors.royalMaroon, colors.royalGold]}
          />
        }
      >
        {offline && <OfflineBanner onRetry={() => load(true)} />}

        {loading ? (
          <LoadingState label="Loading notifications..." />
        ) : error && items.length === 0 ? (
          <ErrorState
            title="Could not load notifications"
            message={error}
            actionLabel="Try Again"
            onAction={() => load(true)}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon="notifications-outline"
            title="You're all caught up"
            message="New interests, matches and messages will appear here."
          />
        ) : (
          items.map((item) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.8}
              onPress={() => handlePress(item)}
              accessibilityRole="button"
              accessibilityLabel={item.title}
            >
              <Card
                style={[
                  styles.notifCard,
                  item.unread ? styles.unreadCard : styles.readCard,
                ]}
              >
                <View style={styles.notifRow}>
                  <View style={[styles.iconWrap, item.unread && styles.iconWrapUnread]}>
                    <Ionicons
                      name={KIND_ICON[item.kind]}
                      size={16}
                      color={item.unread ? colors.royalMaroon : colors.goldMuted}
                    />
                  </View>
                  <View style={styles.notifContent}>
                    <Text style={styles.notifTitle}>{item.title}</Text>
                    <Text style={styles.notifBody} numberOfLines={2}>
                      {item.body}
                    </Text>
                    <Text style={styles.notifTime}>{formatRelativeTime(item.timestamp)}</Text>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.ivory,
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: 60,
  },
  notifCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  unreadCard: {
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 4,
    borderLeftColor: colors.royalMaroon,
  },
  readCard: {
    backgroundColor: colors.ivoryLight,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FAF5ED',
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  iconWrapUnread: {
    backgroundColor: '#FDF0F2',
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: '700',
    color: colors.charcoal,
  },
  notifBody: {
    fontSize: typography.fontSizes.xs,
    color: colors.bodyText,
    lineHeight: 18,
    marginTop: 2,
  },
  notifTime: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
  },
});
