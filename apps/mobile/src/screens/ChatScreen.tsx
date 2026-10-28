import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { Header } from '../components/common/Header';
import { Badge } from '../components/common/Badge';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { getConversations, getSessionToken } from '../services';
import { ConversationItem } from '@bandhansetu/shared';

interface Props {
  navigation: any;
}

export const ChatScreen: React.FC<Props> = ({ navigation }) => {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const token = getSessionToken();
      const res = await getConversations(token);
      if (res.data) {
        setConversations(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Could not load conversations.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchConversations();
    });
    fetchConversations();
    return unsubscribe;
  }, [navigation, fetchConversations]);

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      if (isToday) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <Header
        title="Messages"
        onBack={() => navigation.goBack()}
        subtitle={loading ? 'Updating chats...' : `${conversations.length} Active Conversations`}
        showStatusBadge={true}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchConversations(true)}
            tintColor={colors.royalMaroon}
            colors={[colors.royalMaroon]}
          />
        }
      >

        {/* Loading State */}
        {loading && !refreshing && (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={colors.royalMaroon} />
            <Text style={styles.loadingText}>Fetching conversations...</Text>
          </View>
        )}

        {/* Error State */}
        {error && (
          <Card style={styles.errorCard}>
            <Text style={styles.errorTitle}>Error Loading Chats</Text>
            <Text style={styles.errorSub}>{error}</Text>
            <Button
              title="Try Again"
              onPress={() => fetchConversations()}
              variant="secondary"
              style={{ marginTop: spacing.md }}
            />
          </Card>
        )}

        {/* Empty State */}
        {!loading && !error && conversations.length === 0 && (
          <Card style={styles.emptyCard}>
            <Ionicons name="chatbubbles-outline" size={40} color={colors.royalMaroon} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>No active conversations yet</Text>
            <Text style={styles.emptySub}>
              Messaging unlocks as soon as an interest is mutually accepted! Explore matches or review pending interests.
            </Text>
            <Button
              title="View Matches & Interests"
              onPress={() => navigation.navigate('MainTabs', { screen: 'Matches' })}
              variant="primary"
              style={{ marginTop: spacing.md }}
            />
          </Card>
        )}

        {/* Conversation List */}
        {!loading &&
          conversations.map((conv) => {
            const hasUnread = conv.unreadCount > 0;
            const contactShared = conv.contactExchange?.status === 'accepted';

            return (
              <Card key={conv.id} style={styles.convCard}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.convItem}
                  onPress={() =>
                    navigation.navigate('ChatDetail', {
                      conversationId: conv.id,
                      partnerName: conv.participant.displayName,
                    })
                  }
                >
                  <View style={styles.avatarBox}>
                    <Ionicons name="person" size={22} color={colors.royalMaroon} />
                    {conv.participant.isVerified && (
                      <View style={styles.verifiedDot}>
                        <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                      </View>
                    )}
                  </View>

                  <View style={styles.convInfo}>
                    <View style={styles.topRow}>
                      <Text style={styles.partnerName} numberOfLines={1}>
                        {conv.participant.displayName}, {conv.participant.age}
                      </Text>
                      <Text style={styles.timeText}>
                        {formatTime(conv.lastMessage?.createdAt || conv.updatedAt)}
                      </Text>
                    </View>

                    <Text style={styles.metaSnippet} numberOfLines={1}>
                      {conv.participant.city} • {conv.participant.occupation}
                    </Text>

                    <View style={styles.bottomRow}>
                      <Text
                        style={[styles.lastMsgText, hasUnread && styles.lastMsgUnread]}
                        numberOfLines={1}
                      >
                        {conv.lastMessage
                          ? conv.lastMessage.text
                          : 'Mutual match established. Start your conversation!'}
                      </Text>

                      {hasUnread && (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadText}>{conv.unreadCount}</Text>
                        </View>
                      )}
                    </View>

                    {/* Contact status badge */}
                    <View style={styles.badgeRow}>
                      {contactShared ? (
                        <Badge label="📱 Contact Disclosed" variant="verified" />
                      ) : (
                        <Badge label="🔒 Contact Masked" variant="neutral" />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              </Card>
            );
          })}
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
  centerBox: {
    padding: spacing['2xl'],
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSizes.xs,
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
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xl,
    marginTop: spacing.md,
  },
  emptyIcon: {
    fontSize: 40,
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
  convCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBox: {
    width: 56,
    height: 64,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarIcon: {
    fontSize: 28,
  },
  verifiedDot: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    backgroundColor: colors.verifiedGreen,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  verifiedCheck: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
  },
  convInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  partnerName: {
    fontSize: typography.fontSizes.sm,
    fontWeight: '700',
    color: colors.charcoal,
    flex: 1,
  },
  timeText: {
    fontSize: typography.fontSizes.xs - 2,
    color: colors.textMuted,
    marginLeft: spacing.xs,
  },
  metaSnippet: {
    fontSize: typography.fontSizes.xs - 1,
    color: colors.textSecondary,
    marginTop: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  lastMsgText: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    flex: 1,
    marginRight: spacing.sm,
  },
  lastMsgUnread: {
    color: colors.charcoal,
    fontWeight: '700',
  },
  unreadBadge: {
    backgroundColor: colors.royalMaroon,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
});
