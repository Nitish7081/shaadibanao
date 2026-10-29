import React, { useState, useEffect } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { CommunityPostItem } from '@bandhansetu/shared';
import { ds, PressableScale, Skeleton } from '../design';
import { API_BASE } from '../services/authSession';
import { cloudinaryUrl } from '../services/cloudinaryUrl';
import { getAuthHeader } from '../services/authSession';
import { getInitials } from '../components/home/matchPhoto';

export const CommunityScreen: React.FC<any> = ({ navigation }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [posts, setPosts] = useState<CommunityPostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { key: 'all', label: t('communityScreen.allStories'), icon: 'sparkles' as const },
    { key: 'wedding_story', label: t('communityScreen.weddings'), icon: 'heart' as const },
    { key: 'festivals', label: t('communityScreen.festivals'), icon: 'flame' as const },
    { key: 'culture', label: t('communityScreen.traditions'), icon: 'rose' as const },
    { key: 'advice', label: t('communityScreen.advice'), icon: 'book' as const },
  ];

  useEffect(() => {
    fetchFeed();
  }, [selectedCategory]);

  const fetchFeed = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      const catParam = selectedCategory !== 'all' ? `&category=${selectedCategory}` : '';
      const res = await fetch(`${API_BASE}/community/feed?page=1&limit=25${catParam}`, { headers });
      const json = await res.json();
      if (json.success && json.data) {
        setPosts(json.data.items || []);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleToggleLike = async (postId: string) => {
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_BASE}/community/posts/${postId}/like`, {
        method: 'POST',
        headers,
      });
      const json = await res.json();
      if (json.success && json.data) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, isLikedByMe: json.data.isLiked, likesCount: json.data.likesCount }
              : p
          )
        );
      }
    } catch {
      // ignore
    }
  };

  const handleReportPost = (postId: string) => {
    Alert.alert(
      t('communityScreen.reportPost'),
      t('communityScreen.reportConfirm'),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: async () => {
            try {
              const headers = await getAuthHeader();
              await fetch(`${API_BASE}/community/posts/${postId}/report`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ reason: 'Reported by user' }),
              });
              Alert.alert('Report Received', 'Thank you. Our team will review this story promptly.');
            } catch {
              // ignore
            }
          },
        },
      ]
    );
  };

  const renderHeader = () => (
    <View style={styles.headerBlock}>
      {/* Title & Share Button Row */}
      <View style={styles.headerTopRow}>
        <View style={styles.titleCol}>
          <Text
            maxFontSizeMultiplier={1.2}
            style={styles.screenHeading}
          >
            {t('communityScreen.headerTitle')}
          </Text>
          <Text
            maxFontSizeMultiplier={1.2}
            style={styles.screenSubheading}
          >
            {t('communityScreen.headerSubtitle')}
          </Text>
        </View>

        <PressableScale
          style={styles.shareBtn}
          onPress={() => navigation.navigate('CreatePost')}
          accessibilityLabel="Share Story"
        >
          <LinearGradient
            colors={['#7A1528', '#9B1D36']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.shareBtnGradient}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text maxFontSizeMultiplier={1.2} style={styles.shareBtnText}>
              {t('communityScreen.shareStory')}
            </Text>
          </LinearGradient>
        </PressableScale>
      </View>

      {/* Category Filter Pills */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={categories}
        keyExtractor={(c) => c.key}
        contentContainerStyle={styles.categoryPillsList}
        renderItem={({ item }) => {
          const isSelected = selectedCategory === item.key;
          return (
            <PressableScale
              style={[styles.categoryPill, isSelected && styles.categoryPillActive]}
              onPress={() => setSelectedCategory(item.key)}
            >
              <Ionicons
                name={item.icon}
                size={14}
                color={isSelected ? '#FFFFFF' : ds.color.maroon}
              />
              <Text
                maxFontSizeMultiplier={1.2}
                style={[styles.categoryPillText, isSelected && styles.categoryPillTextActive]}
              >
                {item.label}
              </Text>
            </PressableScale>
          );
        }}
      />
    </View>
  );

  const renderPostItem = ({ item }: { item: CommunityPostItem }) => {
    const formattedDate = item.createdAt
      ? new Date(item.createdAt).toLocaleDateString('en-IN', {
          month: 'short',
          day: 'numeric',
        })
      : 'Recently';

    const authorInitials = getInitials(item.authorName || 'Community Member');

    return (
      <View style={styles.postCard}>
        {/* Author Header */}
        <View style={styles.authorRow}>
          <LinearGradient
            colors={['#7A1528', '#A22842']}
            style={styles.authorAvatar}
          >
            <Text maxFontSizeMultiplier={1.2} style={styles.authorAvatarText}>
              {authorInitials}
            </Text>
          </LinearGradient>

          <View style={styles.authorInfoCol}>
            <Text
              maxFontSizeMultiplier={1.2}
              numberOfLines={1}
              style={styles.authorName}
            >
              {item.authorName || 'Devotee / Member'}
            </Text>
            <Text maxFontSizeMultiplier={1.2} style={styles.postDate}>
              {formattedDate}
            </Text>
          </View>

          <View style={styles.categoryBadgePill}>
            <Text maxFontSizeMultiplier={1.2} style={styles.categoryBadgeText}>
              {(item.category || 'story').replace('_', ' ')}
            </Text>
          </View>

          <PressableScale
            onPress={() => handleReportPost(item.id)}
            style={styles.moreActionBtn}
            accessibilityLabel="Report Post"
          >
            <Ionicons name="ellipsis-vertical" size={16} color={ds.color.textMuted} />
          </PressableScale>
        </View>

        {/* Media Photo */}
        {item.mediaUrl ? (
          <View style={styles.mediaContainer}>
            <Image
              source={{ uri: cloudinaryUrl(item.mediaUrl, 'post') }}
              style={styles.postImage}
              resizeMode="cover"
            />
          </View>
        ) : null}

        {/* Caption & Actions */}
        <View style={styles.cardContentPadding}>
          {item.caption ? (
            <Text maxFontSizeMultiplier={1.2} style={styles.captionText}>
              {item.caption}
            </Text>
          ) : null}

          {/* Action Row */}
          <View style={styles.postActionRow}>
            <PressableScale
              style={[styles.likeBtn, item.isLikedByMe && styles.likeBtnActive]}
              onPress={() => handleToggleLike(item.id)}
              accessibilityLabel="Like Story"
            >
              <Ionicons
                name={item.isLikedByMe ? 'heart' : 'heart-outline'}
                size={18}
                color={item.isLikedByMe ? '#DC2626' : ds.color.textMuted}
              />
              <Text
                maxFontSizeMultiplier={1.2}
                style={[styles.likeCountText, item.isLikedByMe && styles.likeCountActive]}
              >
                {item.likesCount || 0} {item.likesCount === 1 ? 'Blessing' : 'Blessings'}
              </Text>
            </PressableScale>
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyOrLoading = () => {
    if (loading && !refreshing) {
      return (
        <View style={styles.skeletonContainer}>
          {[1, 2].map((k) => (
            <View key={k} style={styles.skeletonCard}>
              <View style={styles.skeletonHeader}>
                <Skeleton width={42} height={42} radius={21} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Skeleton width="45%" height={16} radius={4} style={{ marginBottom: 6 }} />
                  <Skeleton width="25%" height={12} radius={4} />
                </View>
              </View>
              <Skeleton width="100%" height={240} radius={14} style={{ marginTop: 12 }} />
              <Skeleton width="85%" height={14} radius={4} style={{ marginTop: 12 }} />
            </View>
          ))}
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <LinearGradient
          colors={['#FFF6E8', '#FFEECF']}
          style={styles.emptyIconCircle}
        >
          <Ionicons name="images-outline" size={36} color={ds.color.maroon} />
        </LinearGradient>
        <Text maxFontSizeMultiplier={1.2} style={styles.emptyTitle}>
          {t('communityScreen.noStoriesTitle')}
        </Text>
        <Text maxFontSizeMultiplier={1.2} style={styles.emptySubtitle}>
          {t('communityScreen.noStoriesSub')}
        </Text>
        <PressableScale
          style={styles.emptyActionBtn}
          onPress={() => navigation.navigate('CreatePost')}
        >
          <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
          <Text maxFontSizeMultiplier={1.2} style={styles.emptyActionBtnText}>
            {t('communityScreen.shareFirstStory')}
          </Text>
        </PressableScale>
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screenBg}>
      <FlatList
        data={loading && !refreshing ? [] : posts}
        keyExtractor={(p) => p.id}
        renderItem={renderPostItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyOrLoading}
        contentContainerStyle={[
          styles.feedContent,
          { paddingBottom: Math.max(insets.bottom + 90, 110) },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchFeed();
            }}
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
  feedContent: {
    paddingHorizontal: ds.space.md,
  },
  headerBlock: {
    paddingTop: ds.space.sm,
    paddingBottom: ds.space.md,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: ds.space.md,
  },
  titleCol: {
    flex: 1,
    paddingRight: ds.space.sm,
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
  shareBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    ...ds.shadow.soft,
  },
  shareBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 14,
    gap: 5,
  },
  shareBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  categoryPillsList: {
    gap: 8,
    paddingVertical: 2,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ds.color.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ds.color.border,
    gap: 6,
  },
  categoryPillActive: {
    backgroundColor: ds.color.maroon,
    borderColor: ds.color.maroon,
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: ds.color.text,
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  postCard: {
    backgroundColor: ds.color.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: ds.color.border,
    marginBottom: ds.space.md,
    overflow: 'hidden',
    ...ds.shadow.soft,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ds.space.md,
    paddingTop: ds.space.md,
    paddingBottom: ds.space.sm,
  },
  authorAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorAvatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  authorInfoCol: {
    flex: 1,
    marginLeft: 10,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '700',
    color: ds.color.text,
  },
  postDate: {
    fontSize: 11,
    color: ds.color.textMuted,
    marginTop: 1,
  },
  categoryBadgePill: {
    backgroundColor: ds.color.surfaceWarm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ds.color.border,
    marginRight: 6,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: ds.color.maroon,
    textTransform: 'capitalize',
  },
  moreActionBtn: {
    padding: 6,
  },
  mediaContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#F5ECE1',
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  cardContentPadding: {
    padding: ds.space.md,
  },
  captionText: {
    fontSize: 14,
    color: ds.color.textBody,
    lineHeight: 21,
    marginBottom: ds.space.sm,
  },
  postActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: ds.space.xs,
    borderTopWidth: 1,
    borderTopColor: ds.color.border,
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: ds.color.surfaceWarm,
    gap: 6,
  },
  likeBtnActive: {
    backgroundColor: '#FEE2E2',
  },
  likeCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: ds.color.textMuted,
  },
  likeCountActive: {
    color: '#DC2626',
    fontWeight: '700',
  },
  skeletonContainer: {
    paddingTop: ds.space.sm,
  },
  skeletonCard: {
    backgroundColor: ds.color.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: ds.color.border,
    padding: ds.space.md,
    marginBottom: ds.space.md,
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyContainer: {
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
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: ds.color.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: ds.color.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: ds.space.lg,
    paddingHorizontal: ds.space.md,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ds.color.maroon,
    paddingVertical: 11,
    paddingHorizontal: ds.space.lg,
    borderRadius: 14,
    gap: 8,
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
