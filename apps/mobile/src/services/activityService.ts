import { ConversationItem, InterestItem } from '@bandhansetu/shared';
import { getReceivedInterests, getSentInterests } from './interestService';
import { getConversations } from './chatService';

/**
 * Activity Service
 * Derives real account activity (interests, mutual matches, unread messages)
 * strictly from existing backend endpoints. No hardcoded or demo data.
 */

export type ActivityKind = 'interest_received' | 'interest_accepted' | 'message';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  body: string;
  timestamp: string;
  unread: boolean;
  conversationId?: string;
  partnerName?: string;
}

export interface ActivitySummary {
  pendingInterests: number;
  mutualMatches: number;
  unreadMessages: number;
  feed: ActivityItem[];
  /** Number of endpoints that failed (0-3). */
  failedCount: number;
  /** True when every endpoint failed (network / server unreachable). */
  allFailed: boolean;
}

const nameOf = (profile?: { displayName?: string }): string => profile?.displayName || 'A member';

export async function loadActivitySummary(token: string): Promise<ActivitySummary> {
  const [receivedRes, sentRes, convRes] = await Promise.allSettled([
    getReceivedInterests(token),
    getSentInterests(token),
    getConversations(token),
  ]);

  const feed: ActivityItem[] = [];
  let pendingInterests = 0;
  let mutualMatches = 0;
  let unreadMessages = 0;
  let failedCount = 0;

  if (receivedRes.status === 'fulfilled') {
    const items: InterestItem[] = receivedRes.value?.data || [];
    items.forEach((i) => {
      if (i.status === 'pending') {
        pendingInterests += 1;
        feed.push({
          id: `rx-${i.id}`,
          kind: 'interest_received',
          title: 'New Interest Received',
          body: `${nameOf(i.profile)} expressed interest in your profile.`,
          timestamp: i.createdAt,
          unread: true,
        });
      } else if (i.status === 'accepted') {
        mutualMatches += 1;
        feed.push({
          id: `rx-${i.id}`,
          kind: 'interest_accepted',
          title: 'Mutual Match',
          body: `You accepted ${nameOf(i.profile)}'s interest.`,
          timestamp: i.updatedAt || i.createdAt,
          unread: false,
        });
      }
    });
  } else {
    failedCount += 1;
  }

  if (sentRes.status === 'fulfilled') {
    const items: InterestItem[] = sentRes.value?.data || [];
    items.forEach((i) => {
      if (i.status === 'accepted') {
        mutualMatches += 1;
        feed.push({
          id: `tx-${i.id}`,
          kind: 'interest_accepted',
          title: 'Interest Accepted',
          body: `${nameOf(i.profile)} accepted your interest.`,
          timestamp: i.updatedAt || i.createdAt,
          unread: false,
        });
      }
    });
  } else {
    failedCount += 1;
  }

  if (convRes.status === 'fulfilled') {
    const items: ConversationItem[] = convRes.value?.data || [];
    items.forEach((c) => {
      const unread = c.unreadCount || 0;
      unreadMessages += unread;
      if (unread > 0 || c.lastMessage) {
        feed.push({
          id: `cv-${c.id}`,
          kind: 'message',
          title: unread > 0 ? `${unread} Unread Message${unread > 1 ? 's' : ''}` : 'Recent Conversation',
          body: c.lastMessage?.text
            ? `${nameOf(c.participant)}: ${c.lastMessage.text}`
            : `Conversation with ${nameOf(c.participant)}`,
          timestamp: c.lastMessage?.createdAt || c.updatedAt,
          unread: unread > 0,
          conversationId: c.id,
          partnerName: nameOf(c.participant),
        });
      }
    });
  } else {
    failedCount += 1;
  }

  feed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    pendingInterests,
    mutualMatches,
    unreadMessages,
    feed,
    failedCount,
    allFailed: failedCount === 3,
  };
}

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMin = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const hrs = Math.round(diffMin / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return new Date(iso).toLocaleDateString();
}
