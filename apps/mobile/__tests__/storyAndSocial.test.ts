import fs from 'fs';
import path from 'path';

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  NativeModules: {},
}));

import {
  buildStoriesFromMatches,
  getStoryTapNavigation,
  hasStoryEnabled,
  stepStorySlide,
} from '../src/utils/storyHelpers';
import { LRUCache } from '../src/utils/lruCache';
import {
  sendFreeHello,
  sendFriendRequest,
  respondToFriendRequest,
  getStories,
} from '../src/services/socialService';
import { ProfileStoryItem, SearchResultProfile } from '@bandhansetu/shared';

describe('Mobile Frontend: Story Viewer, Free Hello & Friend Request Client Behavior', () => {
  const sampleMatchWithPhoto: SearchResultProfile = {
    id: 'user_female_1',
    displayName: 'Ananya S.',
    gender: 'female',
    age: 26,
    heightCm: 163,
    maritalStatus: 'never_married',
    motherTongue: 'Hindi',
    religion: 'Hindu',
    city: 'Delhi',
    state: 'Delhi',
    education: 'B.Tech',
    occupation: 'Software Engineer',
    photos: [
      {
        url: 'https://res.cloudinary.com/demo/image/upload/v1/ananya.jpg',
        isMain: true,
        isBlurred: false,
      },
    ],
    aboutMe: 'Family-oriented and cheerful.',
    isVerified: true,
    photoChecked: true,
    isContactLocked: true,
    matchAlignment: {
      scoreText: '6 of 7 preferences match',
      matchedCount: 6,
      totalEvaluated: 7,
      matchedCriteria: ['Delhi'],
    },
  };

  const sampleMatchWithoutPhoto: SearchResultProfile = {
    ...sampleMatchWithPhoto,
    id: 'user_female_no_photo',
    displayName: 'Pooja M.',
    photos: [],
  };

  it('detects story-enabled profile photos accurately', () => {
    expect(hasStoryEnabled(sampleMatchWithPhoto)).toBe(true);
    expect(hasStoryEnabled(sampleMatchWithoutPhoto)).toBe(false);
  });

  it('tapping a story-enabled profile photo routes to StoryViewer, NOT ProfileDetail', () => {
    const stories = buildStoriesFromMatches([sampleMatchWithPhoto]);
    const navTarget = getStoryTapNavigation(sampleMatchWithPhoto, stories);

    expect(navTarget.screen).toBe('StoryViewer');
    expect(navTarget.screen).not.toBe('ProfileDetail');
    if (navTarget.screen === 'StoryViewer') {
      expect(navTarget.params.initialIndex).toBe(0);
      expect(navTarget.params.stories[0].slides.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('HomeScreen wires StoriesRow onMatchPress to StoryViewer helper (not ProfileDetail)', () => {
    const homeSource = fs.readFileSync(
      path.join(__dirname, '../src/screens/HomeScreen.tsx'),
      'utf-8'
    );
    expect(homeSource).toContain('onMatchPress={openMatchStory}');
    expect(homeSource).toContain("navigation.navigate('StoryViewer'");
  });

  it('steps through Story Viewer slides and closes at the end', () => {
    const stories: ProfileStoryItem[] = [
      {
        userId: 'u1',
        profileId: 'p1',
        displayName: 'Ananya',
        hasStory: true,
        slides: [
          { id: 's1', mediaUrl: 'https://example.com/1.jpg' },
          { id: 's2', mediaUrl: 'https://example.com/2.jpg' },
        ],
      },
      {
        userId: 'u2',
        profileId: 'p2',
        displayName: 'Meera',
        hasStory: true,
        slides: [{ id: 's3', mediaUrl: 'https://example.com/3.jpg' }],
      },
    ];

    expect(stepStorySlide(stories, 0, 0, 'next')).toEqual({
      storyIndex: 0,
      slideIndex: 1,
      done: false,
    });
    expect(stepStorySlide(stories, 0, 1, 'next')).toEqual({
      storyIndex: 1,
      slideIndex: 0,
      done: false,
    });
    expect(stepStorySlide(stories, 1, 0, 'next')).toEqual({
      storyIndex: 1,
      slideIndex: 0,
      done: true,
    });
    expect(stepStorySlide(stories, 1, 0, 'prev')).toEqual({
      storyIndex: 0,
      slideIndex: 1,
      done: false,
    });
  });

  it('socialService sends authenticated requests for stories, free hello, and friend requests', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true, data: [] }),
      text: async () => JSON.stringify({ success: true, data: [] }),
    });
    (global as any).fetch = mockFetch;

    await getStories('tok_123');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/stories'),
      expect.objectContaining({ method: 'GET' })
    );

    await sendFreeHello('tok_123', 'user_female_1', 'Namaste!');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/hello/user_female_1'),
      expect.objectContaining({ method: 'POST' })
    );

    await sendFriendRequest('tok_123', 'user_female_1');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/friend-requests/user_female_1'),
      expect.objectContaining({ method: 'POST' })
    );

    await respondToFriendRequest('tok_123', 'req_1', 'accept');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/friend-requests/req_1'),
      expect.objectContaining({ method: 'PATCH' })
    );
  });

  it('LRUCache evicts oldest entries cleanly within capacity', () => {
    const cache = new LRUCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a');
    cache.set('c', 3);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
    expect(cache.get('c')).toBe(3);
  });
});
