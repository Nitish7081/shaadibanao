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
import { ds, PressableScale, Skeleton, GradientRingAvatar } from '../design';
import { getConversations, getSessionToken } from '../services';
import { ConversationItem } from '@bandhansetu/shared';
import { getInitials } from '../components/home/matchPhoto';

interface Props {
  navigation: any;
}

export const ChatScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

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
      setError(err?.message || 'Could not load conversations.');
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

  const renderHeader = () => (
    <View style={styles.headerBlock}>
      <View style={styles.headerTitleRow}>
        <View style={{ flex: 1 }}>
          <Text
            maxFontSizeMultiplier={1.2}
            style={styles.screenHeading}
          >
            {t('chatScreen.messagesTitle')}
          </Text>
          <Text
            maxFontSizeMultiplier={1.2}
            style={styles.screenSubheading}
          >
            {t('chatScreen.messagesSubtitle', { count: conversations.length })}
          </Text>
        </View>

        <PressableScale
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={20} color={ds.color.maroon} />
        </PressableScale>
      </View>
    </View>
  );

  const renderConversationItem = ({ item }: { item: ConversationItem }) => {
    const hasUnread = item.unreadCount > 0;
    const partnerName = item.participant?.displayName || 'Connection';
    const initials = getInitials(partnerName);
    const contactShared = item.contactExchange?.status === 'accepted';
    const lastMsgTime = item.lastMessage?.createdAt || item.updatedAt;
    const lastMsgText = item.lastMessage?.text || 'Say Namaste to begin your auspicious conversation...';

    return (
      <PressableScale
        style={[styles.convCard, hasUnread && styles.convCardUnread]}
        onPress={() =>
          navigation.navigate('ChatDetail', {
            conversationId: item.id,
            partnerName,
          })
        }
      >
        {/* Avatar */}
        <LinearGradient
          colors={hasUnread ? ['#7A1528', '#A22842'] : ['#E8DEC8', '#D4AF37']}
          style={styles.avatarCircle}
        >
          <Text maxFontSizeMultiplier={1.2} style={styles.avatarInitials}>
            {initials || 'BS'}
          </Text>
        </LinearGradient>

        {/* Conversation details */}
        <View style={styles.convDetailsCol}>
          <View style={styles.partnerNameRow}>
            <Text
              maxFontSizeMultiplier={1.2}
              numberOfLines={1}
              style={[styles.partnerNameText, hasUnread && styles.partnerNameUnread]}
            >
              {partnerName}
            </Text>
            {lastMsgTime && (
              <Text maxFontSizeMultiplier={1.2} style={styles.timeText}>
                {formatTime(lastMsgTime)}
              </Text>
            )}
          </View>

          <View style={styles.lastMessageRow}>
            <Text
              maxFontSizeMultiplier={1.2}
              numberOfLines={1}
              style={[styles.lastMsgText, hasUnread && styles.lastMsgUnread]}
            >
              {lastMsgText}
            </Text>

            {hasUnread && (
              <View style={styles.unreadBadge}>
                <Text maxFontSizeMultiplier={1.2} style={styles.unreadBadgeText}>
                  {item.unreadCount}
                </Text>
              </View>
            )}
          </View>

          {contactShared && (
            <View style={styles.contactSharedPill}>
              <Ionicons name="call" size={11} color="#166534" />
              <Text maxFontSizeMultiplier={1.2} style={styles.contactSharedText}>
                {t('chatScreen.contactUnlocked')}
              </Text>
            </View>
          )}
        </View>
      </PressableScale>
    );
  };

  const renderEmptyOrLoading = () => {
    if (loading && !refreshing) {
      return (
        <View style={styles.skeletonContainer}>
          {[1, 2, 3].map((k) => (
            <View key={k} style={styles.skeletonCard}>
              <Skeleton width={52} height={52} radius={26} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Skeleton width="50%" height={16} radius={4} style={{ marginBottom: 8 }} />
                <Skeleton width="80%" height={14} radius={4} />
              </View>
            </View>
          ))}
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.stateContainer}>
          <Ionicons name="alert-circle-outline" size={40} color="#DC2626" />
          <Text maxFontSizeMultiplier={1.2} style={styles.stateTitle}>
            Could Not Load Chats
          </Text>
          <Text maxFontSizeMultiplier={1.2} style={styles.stateSub}>
            {error}
          </Text>
          <PressableScale style={styles.retryBtn} onPress={() => fetchConversations()}>
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
          <Ionicons name="chatbubbles-outline" size={36} color={ds.color.maroon} />
        </LinearGradient>
        <Text maxFontSizeMultiplier={1.2} style={styles.stateTitle}>
          {t('chatScreen.noConversationsTitle')}
        </Text>
        <Text maxFontSizeMultiplier={1.2} style={styles.stateSub}>
          {t('chatScreen.noConversationsSub')}
        </Text>
        <PressableScale
          style={styles.exploreBtn}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Matches' })}
        >
          <Text maxFontSizeMultiplier={1.2} style={styles.exploreBtnText}>
            {t('chatScreen.exploreMatches')}
          </Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </PressableScale>
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screenBg}>
      <FlatList
        data={loading && !refreshing ? [] : conversations}
        keyExtractor={(item) => item.id}
        renderItem={renderConversationItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyOrLoading}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom + 90, 110) },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchConversations(true)}
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenHeading: {
    fontSize: 22,
    fontWeight: '800',
    color: ds.color.maroon,
    letterSpacing: -0.3,
  },
  screenSubheading: {
    fontSize: 13,
    color: ds.color.textMuted,
    marginTop: 2,
    lineHeight: 18,
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
    ...ds.shadow.soft,
  },
  convCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ds.color.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: ds.color.border,
    padding: ds.space.md,
    marginBottom: ds.space.sm,
    ...ds.shadow.soft,
  },
  convCardUnread: {
    borderColor: '#EBDCB9',
    backgroundColor: '#FFFEFA',
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  convDetailsCol: {
    flex: 1,
    marginLeft: 12,
  },
  partnerNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  partnerNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: ds.color.text,
    letterSpacing: -0.2,
    flex: 1,
    marginRight: 8,
  },
  partnerNameUnread: {
    fontWeight: '800',
    color: ds.color.maroon,
  },
  timeText: {
    fontSize: 11,
    color: ds.color.textMuted,
  },
  lastMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  lastMsgText: {
    fontSize: 13,
    color: ds.color.textMuted,
    flex: 1,
    marginRight: 6,
  },
  lastMsgUnread: {
    color: ds.color.text,
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: ds.color.maroon,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  contactSharedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginTop: 6,
    gap: 4,
  },
  contactSharedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
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
    borderRadius: 22,
    borderWidth: 1,
    borderColor: ds.color.border,
    padding: ds.space.xl,
    alignItems: 'center',
    marginTop: ds.space.lg,
    ...ds.shadow.soft,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
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
    paddingVertical: 12,
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
    marginTop: ds.space.sm,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
