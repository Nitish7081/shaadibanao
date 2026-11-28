import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../navigation/types';
import { ds } from '../design';
import { getSessionToken, sendFreeHello, sendFriendRequest } from '../services';
import { stepStorySlide } from '../utils/storyHelpers';
import { getInitials } from '../components/home/matchPhoto';

type Props = NativeStackScreenProps<RootStackParamList, 'StoryViewer'>;

export const StoryViewerScreen: React.FC<Props> = ({ route, navigation }) => {
  const { stories: initialStories, initialIndex = 0 } = route.params;
  const [stories, setStories] = useState(initialStories || []);
  const [storyIndex, setStoryIndex] = useState(
    Math.min(Math.max(0, initialIndex), Math.max(0, (initialStories?.length || 1) - 1))
  );
  const [slideIndex, setSlideIndex] = useState(0);
  const [sendingHello, setSendingHello] = useState(false);
  const [sendingFriend, setSendingFriend] = useState(false);

  const currentStory = stories[storyIndex];
  const currentSlide = currentStory?.slides?.[slideIndex];

  const handleStep = useCallback(
    (direction: 'next' | 'prev') => {
      const next = stepStorySlide(stories, storyIndex, slideIndex, direction);
      if (next.done) {
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate('MainTabs' as any);
        }
        return;
      }
      setStoryIndex(next.storyIndex);
      setSlideIndex(next.slideIndex);
    },
    [stories, storyIndex, slideIndex, navigation]
  );

  const handleClose = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('MainTabs' as any);
    }
  };

  const handleSendHello = async () => {
    if (!currentStory || currentStory.helloSent || sendingHello) return;
    setSendingHello(true);
    try {
      const token = getSessionToken();
      await sendFreeHello(token, currentStory.userId);
      setStories((prev) =>
        prev.map((s, idx) => (idx === storyIndex ? { ...s, helloSent: true } : s))
      );
      Alert.alert('Hello Sent 👋', `Your one free Hello was sent to ${currentStory.displayName}.`);
    } catch (err: any) {
      if (err?.status === 409 || err?.code === 'HELLO_ALREADY_SENT') {
        setStories((prev) =>
          prev.map((s, idx) => (idx === storyIndex ? { ...s, helloSent: true } : s))
        );
        Alert.alert('Already Sent', 'You have already sent your one free Hello to this member.');
      } else {
        Alert.alert('Unable to Say Hello', err?.message || 'Could not send Hello right now.');
      }
    } finally {
      setSendingHello(false);
    }
  };

  const handleSendFriendRequest = async () => {
    if (!currentStory || sendingFriend) return;
    if (currentStory.friendRequestStatus && currentStory.friendRequestStatus !== 'none') {
      return;
    }
    setSendingFriend(true);
    try {
      const token = getSessionToken();
      await sendFriendRequest(token, currentStory.userId);
      setStories((prev) =>
        prev.map((s, idx) =>
          idx === storyIndex ? { ...s, friendRequestStatus: 'pending' } : s
        )
      );
      Alert.alert(
        'Friend Request Sent',
        `Friend request sent to ${currentStory.displayName}. Two-way chat unlocks once accepted.`
      );
    } catch (err: any) {
      Alert.alert('Request Notice', err?.message || 'Could not send friend request.');
    } finally {
      setSendingFriend(false);
    }
  };

  const handleOpenProfile = () => {
    if (!currentStory) return;
    navigation.navigate('ProfileDetail', {
      profileId: currentStory.profileId,
      name: currentStory.displayName,
    });
  };

  if (!currentStory || !currentSlide) {
    return (
      <SafeAreaView style={styles.emptyRoot}>
        <Text style={styles.emptyText}>No story available</Text>
        <TouchableOpacity onPress={handleClose} style={styles.emptyBtn}>
          <Text style={styles.emptyBtnText}>Close</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const frStatus = currentStory.friendRequestStatus || 'none';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Background Story Media */}
      <View style={styles.mediaWrap}>
        <Image
          source={{ uri: currentSlide.mediaUrl }}
          style={styles.mediaImage}
          resizeMode="cover"
          blurRadius={currentSlide.blurred ? (Platform.OS === 'ios' ? 20 : 12) : 0}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,0.75)']}
          style={StyleSheet.absoluteFill}
        />

        {/* Tap Zones (Left = Prev, Right = Next) */}
        <View style={styles.tapZones}>
          <TouchableOpacity
            style={styles.tapHalf}
            activeOpacity={1}
            onPress={() => handleStep('prev')}
            accessibilityLabel="Previous story"
          />
          <TouchableOpacity
            style={styles.tapHalf}
            activeOpacity={1}
            onPress={() => handleStep('next')}
            accessibilityLabel="Next story"
          />
        </View>
      </View>

      {/* Progress Bars & Header */}
      <View style={styles.topOverlay} pointerEvents="box-none">
        <View style={styles.progressRow}>
          {currentStory.slides.map((s, idx) => (
            <View key={s.id} style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width:
                      idx < slideIndex ? '100%' : idx === slideIndex ? '100%' : '0%',
                    opacity: idx <= slideIndex ? 1 : 0.35,
                  },
                ]}
              />
            </View>
          ))}
        </View>

        <View style={styles.headerRow}>
          <View style={styles.authorRow}>
            {currentStory.avatarUrl ? (
              <Image
                source={{ uri: currentStory.avatarUrl }}
                style={styles.avatar}
                blurRadius={currentStory.avatarBlurred ? 8 : 0}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitials}>{getInitials(currentStory.displayName)}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <View style={styles.nameLine}>
                <Text style={styles.authorName} numberOfLines={1}>
                  {currentStory.displayName}
                  {currentStory.age ? `, ${currentStory.age}` : ''}
                </Text>
                {currentStory.isVerified && (
                  <Ionicons name="checkmark-circle" size={16} color="#4ADE80" style={{ marginLeft: 5 }} />
                )}
              </View>
              {currentStory.city ? (
                <Text style={styles.authorMeta} numberOfLines={1}>
                  {currentStory.city}
                </Text>
              ) : null}
            </View>
          </View>

          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close story"
          >
            <Ionicons name="close" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Caption & Actions */}
      <View style={styles.bottomOverlay}>
        {currentSlide.caption ? (
          <Text style={styles.caption} numberOfLines={3}>
            {currentSlide.caption}
          </Text>
        ) : null}

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              styles.helloBtn,
              currentStory.helloSent && styles.actionBtnDone,
            ]}
            onPress={handleSendHello}
            disabled={Boolean(currentStory.helloSent) || sendingHello}
          >
            {sendingHello ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons
                  name={currentStory.helloSent ? 'checkmark-done' : 'hand-left-outline'}
                  size={17}
                  color="#FFF"
                />
                <Text style={styles.actionText}>
                  {currentStory.helloSent ? 'Hello Sent' : 'Free Hello'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionBtn,
              styles.friendBtn,
              frStatus !== 'none' && styles.actionBtnDone,
            ]}
            onPress={handleSendFriendRequest}
            disabled={frStatus !== 'none' || sendingFriend}
          >
            {sendingFriend ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons
                  name={frStatus === 'accepted' ? 'people' : 'person-add-outline'}
                  size={17}
                  color="#FFF"
                />
                <Text style={styles.actionText}>
                  {frStatus === 'accepted'
                    ? 'Friends'
                    : frStatus === 'pending'
                    ? 'Requested'
                    : frStatus === 'rejected'
                    ? 'Declined'
                    : 'Add Friend'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.profileChip} onPress={handleOpenProfile}>
            <Text style={styles.profileChipText}>Profile</Text>
            <Ionicons name="chevron-forward" size={14} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#12080B' },
  emptyRoot: {
    flex: 1,
    backgroundColor: '#12080B',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: { color: '#FFF', fontSize: 16, marginBottom: 16 },
  emptyBtn: {
    backgroundColor: ds.color.maroon,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
  },
  emptyBtnText: { color: '#FFF', fontWeight: '600' },
  mediaWrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  mediaImage: { width: '100%', height: '100%' },
  tapZones: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, flexDirection: 'row' },
  tapHalf: { flex: 1 },
  topOverlay: {
    position: 'absolute',
    top: 48,
    left: 14,
    right: 14,
  },
  progressRow: { flexDirection: 'row', gap: 5, marginBottom: 12 },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#FFF', borderRadius: 2 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: ds.color.gold,
  },
  avatarFallback: {
    backgroundColor: ds.color.maroon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  nameLine: { flexDirection: 'row', alignItems: 'center' },
  authorName: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  authorMeta: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 1 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 28,
    left: 16,
    right: 16,
  },
  caption: {
    color: '#FFF',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 999,
  },
  helloBtn: { backgroundColor: ds.color.maroon },
  friendBtn: { backgroundColor: 'rgba(201, 162, 75, 0.92)' },
  actionBtnDone: { opacity: 0.65 },
  actionText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
    gap: 2,
  },
  profileChipText: { color: '#FFF', fontWeight: '600', fontSize: 12 },
});
