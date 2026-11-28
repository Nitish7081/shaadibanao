import { ProfileStoryItem, SearchResultProfile, StorySlide } from '@bandhansetu/shared';
import { getSafeMatchPhoto } from '../components/home/matchPhoto';

export function hasStoryEnabled(
  match: SearchResultProfile,
  serverStoriesByUser?: Map<string, ProfileStoryItem>
): boolean {
  const fromServer = serverStoriesByUser?.get(match.id);
  if (fromServer && fromServer.hasStory && fromServer.slides.length > 0) {
    return true;
  }
  const safe = getSafeMatchPhoto(match, 'avatar');
  return Boolean(safe?.uri);
}

export function buildStoriesFromMatches(
  matches: SearchResultProfile[],
  serverStories: ProfileStoryItem[] = []
): ProfileStoryItem[] {
  const byId = new Map<string, ProfileStoryItem>();
  for (const s of serverStories) {
    byId.set(s.profileId, s);
    byId.set(s.userId, s);
  }

  const result: ProfileStoryItem[] = [];
  const seenProfileIds = new Set<string>();

  for (const s of serverStories) {
    if (s.hasStory && s.slides.length > 0) {
      result.push(s);
      seenProfileIds.add(s.profileId);
      seenProfileIds.add(s.userId);
    }
  }

  for (const m of matches) {
    if (seenProfileIds.has(m.id)) continue;
    const avatar = getSafeMatchPhoto(m, 'avatar');
    const hero = getSafeMatchPhoto(m, 'card') || avatar;
    if (!hero?.uri) continue;

    const slides: StorySlide[] = (m.photos || [])
      .map((p, idx) => {
        const uri = p.variants?.hero || p.variants?.card || p.url;
        if (!uri) return null;
        return {
          id: `match_${m.id}_${idx}`,
          mediaUrl: uri,
          caption: m.aboutMe ? m.aboutMe.slice(0, 120) : `${m.city}, ${m.occupation}`,
          blurred: Boolean(p.isBlurred || p.isLocked),
          isLocked: Boolean(p.isLocked),
        } as StorySlide;
      })
      .filter((x): x is StorySlide => Boolean(x));

    if (slides.length === 0) {
      slides.push({
        id: `match_${m.id}_0`,
        mediaUrl: hero.uri,
        caption: m.aboutMe ? m.aboutMe.slice(0, 120) : `${m.city}, ${m.occupation}`,
        blurred: hero.blurred,
        isLocked: hero.blurred,
      });
    }

    result.push({
      userId: m.id,
      profileId: m.id,
      displayName: m.displayName || 'Member',
      age: m.age,
      city: m.city,
      isVerified: m.isVerified,
      avatarUrl: avatar?.uri,
      avatarBlurred: avatar?.blurred,
      hasStory: true,
      slides,
      helloSent: false,
      friendRequestStatus: 'none',
    });
  }

  return result;
}

export function getStoryTapNavigation(
  match: SearchResultProfile,
  stories: ProfileStoryItem[]
): { screen: 'StoryViewer'; params: { stories: ProfileStoryItem[]; initialIndex: number } } | { screen: 'ProfileDetail'; params: { profileId: string; name: string } } {
  const idx = stories.findIndex(
    (s) => s.profileId === match.id || s.userId === match.id
  );
  if (idx >= 0 && stories[idx]?.hasStory && stories[idx].slides.length > 0) {
    return {
      screen: 'StoryViewer',
      params: { stories, initialIndex: idx },
    };
  }
  const built = buildStoriesFromMatches([match], []);
  if (built.length > 0) {
    return {
      screen: 'StoryViewer',
      params: { stories: built, initialIndex: 0 },
    };
  }
  return {
    screen: 'ProfileDetail',
    params: { profileId: match.id, name: match.displayName || 'Member' },
  };
}

export function stepStorySlide(
  stories: ProfileStoryItem[],
  storyIndex: number,
  slideIndex: number,
  direction: 'next' | 'prev'
): { storyIndex: number; slideIndex: number; done: boolean } {
  const currentStory = stories[storyIndex];
  if (!currentStory) return { storyIndex: 0, slideIndex: 0, done: true };

  if (direction === 'next') {
    if (slideIndex + 1 < currentStory.slides.length) {
      return { storyIndex, slideIndex: slideIndex + 1, done: false };
    }
    if (storyIndex + 1 < stories.length) {
      return { storyIndex: storyIndex + 1, slideIndex: 0, done: false };
    }
    return { storyIndex, slideIndex, done: true };
  }

  if (slideIndex > 0) {
    return { storyIndex, slideIndex: slideIndex - 1, done: false };
  }
  if (storyIndex > 0) {
    const prevStory = stories[storyIndex - 1];
    return {
      storyIndex: storyIndex - 1,
      slideIndex: Math.max(0, (prevStory?.slides.length || 1) - 1),
      done: false,
    };
  }
  return { storyIndex: 0, slideIndex: 0, done: false };
}
