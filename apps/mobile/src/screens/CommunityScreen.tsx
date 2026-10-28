import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, fonts } from '../constants/theme';
import { CommunityPostItem } from '@bandhansetu/shared';
import { API_BASE } from '../services/authSession';
import { cloudinaryUrl } from '../services/cloudinaryUrl';
import { getAuthHeader } from '../services/authSession';

export const CommunityScreen: React.FC<any> = ({ navigation }) => {
  const [posts, setPosts] = useState<CommunityPostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { key: 'all', label: 'All Stories' },
    { key: 'wedding_story', label: 'Weddings' },
    { key: 'festivals', label: 'Festivals' },
    { key: 'culture', label: 'Traditions' },
    { key: 'advice', label: 'Ritual Advice' },
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
      'Report Post',
      'Do you want to report this post to the moderation team for review?',
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

  const renderPostItem = ({ item }: { item: CommunityPostItem }) => {
    const formattedDate = item.createdAt
      ? new Date(item.createdAt).toLocaleDateString('en-IN', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : '';

    return (
      <View style={styles.postCard}>
        {/* Post Author Header */}
        <View style={styles.authorRow}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarInitial}>{(item.authorName || 'M')[0]}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.authorName}>{item.authorName || 'Community Member'}</Text>
            <Text style={styles.postDate}>{formattedDate}</Text>
          </View>
          <TouchableOpacity onPress={() => handleReportPost(item.id)} style={{ padding: 6 }}>
            <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Media Photo */}
        {item.mediaUrl ? (
          <Image
            source={{ uri: cloudinaryUrl(item.mediaUrl, 'post') }}
            style={styles.postImage}
            resizeMode="cover"
          />
        ) : null}

        {/* Action Bar */}
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleToggleLike(item.id)}
          >
            <Ionicons
              name={item.isLikedByMe ? 'heart' : 'heart-outline'}
              size={22}
              color={item.isLikedByMe ? colors.alertRed : colors.charcoal}
            />
            <Text style={[styles.actionCount, item.isLikedByMe && { color: colors.alertRed }]}>
              {item.likesCount || 0}
            </Text>
          </TouchableOpacity>

          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>
              {(item.category || 'story').replace('_', ' ')}
            </Text>
          </View>
        </View>

        {/* Caption */}
        <View style={styles.captionWrap}>
          <Text style={styles.captionText}>{item.caption}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>ShaadiBanao Community</Text>
            <Text style={styles.headerSubtitle}>Wedding memories, cultural stories & blessings</Text>
          </View>
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => navigation.navigate('CreatePost')}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.createBtnText}>Share Story</Text>
          </TouchableOpacity>
        </View>

        {/* Categories Bar */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories}
          keyExtractor={(c) => c.key}
          contentContainerStyle={styles.categoriesContainer}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.categoryChip,
                selectedCategory === item.key && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(item.key)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory === item.key && styles.categoryChipTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Feed List */}
      {loading && !refreshing ? (
        <ActivityIndicator size="large" color={colors.royalMaroon} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={posts}
          keyExtractor={(p) => p.id}
          renderItem={renderPostItem}
          contentContainerStyle={styles.feedContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchFeed();
              }}
              colors={[colors.royalMaroon]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="images-outline" size={54} color={colors.softGold} />
              <Text style={styles.emptyTitle}>No Stories Yet</Text>
              <Text style={styles.emptySub}>Be the first to share an auspicious wedding photo or celebration memory!</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ivory,
  },
  header: {
    backgroundColor: colors.royalMaroon,
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.royalGold,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: fonts.headingBold,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    color: colors.softGold,
    marginTop: 2,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.softGold,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontFamily: fonts.headingBold,
    fontWeight: '700',
    fontSize: 12,
    marginLeft: 4,
  },
  categoriesContainer: {
    paddingVertical: 4,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#FFFFFF',
  },
  categoryChipText: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: colors.royalMaroon,
    fontFamily: fonts.bodySemiBold,
    fontWeight: '700',
  },
  feedContent: {
    padding: 14,
    paddingBottom: 110,
  },
  postCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8E2D8',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  avatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.royalMaroon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: fonts.headingBold,
    fontWeight: '700',
  },
  authorName: {
    fontSize: 14,
    fontFamily: fonts.headingSemiBold,
    fontWeight: '700',
    color: colors.charcoal,
  },
  postDate: {
    fontSize: 11,
    fontFamily: fonts.bodyRegular,
    color: colors.textMuted,
    marginTop: 1,
  },
  postImage: {
    width: '100%',
    height: 240,
    backgroundColor: '#F0ECE4',
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionCount: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
    fontWeight: '600',
    color: colors.charcoal,
    marginLeft: 6,
  },
  categoryBadge: {
    backgroundColor: '#FAF5ED',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8DFD0',
  },
  categoryText: {
    fontSize: 11,
    fontFamily: fonts.bodyMedium,
    color: colors.royalMaroon,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  captionWrap: {
    paddingHorizontal: 12,
    paddingBottom: 14,
    paddingTop: 4,
  },
  captionText: {
    fontSize: 13,
    fontFamily: fonts.bodyRegular,
    color: colors.charcoal,
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: fonts.headingBold,
    fontWeight: '700',
    color: colors.charcoal,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    fontFamily: fonts.bodyRegular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});
