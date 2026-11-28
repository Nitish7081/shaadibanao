import mongoose from 'mongoose';
import { UserBlockModel } from '../models/user-block.model';
import { ReportModel } from '../models/report.model';
import { FriendRequestModel } from '../models/friend-request.model';
import { UserModel } from '../models/user.model';
import { AppError } from '../middleware/errorHandler';

export interface InMemoryFriendRequest {
  id: string;
  senderId: string;
  recipientId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  note?: string;
  conversationId?: string;
  respondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface InMemoryHello {
  id: string;
  senderId: string;
  recipientId: string;
  message: string;
  createdAt: Date;
}

export const inMemoryBlockStore = new Set<string>();
export const inMemoryFriendRequestStore: InMemoryFriendRequest[] = [];
export const inMemoryHelloStore: InMemoryHello[] = [];

function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export async function recordInMemoryBlock(blockerId: string, blockedUserId: string): Promise<void> {
  inMemoryBlockStore.add(`${blockerId}:${blockedUserId}`);
}

export async function removeInMemoryBlock(blockerId: string, blockedUserId: string): Promise<void> {
  inMemoryBlockStore.delete(`${blockerId}:${blockedUserId}`);
}

/**
 * Returns true if either user has blocked the other or either account is chat-blocked / suspended.
 */
export async function isPairBlocked(userA: string, userB: string): Promise<boolean> {
  if (!userA || !userB) return false;
  const isDbConnected = mongoose.connection.readyState === 1;

  if (!isDbConnected) {
    return (
      inMemoryBlockStore.has(`${userA}:${userB}`) ||
      inMemoryBlockStore.has(`${userB}:${userA}`)
    );
  }

  const validA = mongoose.Types.ObjectId.isValid(userA);
  const validB = mongoose.Types.ObjectId.isValid(userB);
  if (!validA || !validB) {
    return (
      inMemoryBlockStore.has(`${userA}:${userB}`) ||
      inMemoryBlockStore.has(`${userB}:${userA}`)
    );
  }

  const [blockDoc, reportDoc] = await Promise.all([
    UserBlockModel.exists({
      $or: [
        { blockerId: userA, blockedUserId: userB },
        { blockerId: userB, blockedUserId: userA },
      ],
    }),
    ReportModel.exists({
      $or: [
        { reporterId: userA, reportedUserId: userB },
        { reporterId: userB, reportedUserId: userA },
      ],
      status: { $in: ['pending', 'reviewed', 'actioned'] },
      actionTaken: { $in: ['warning', 'suspended', 'profile_removed'] },
    }),
  ]);

  return Boolean(blockDoc || reportDoc);
}

export async function assertPairNotBlocked(userA: string, userB: string): Promise<void> {
  if (await isPairBlocked(userA, userB)) {
    throw new AppError(
      'Communication is unavailable because one of the users has blocked this interaction.',
      403,
      'USER_BLOCKED'
    );
  }
}

export async function getFriendRequestBetween(
  userA: string,
  userB: string
): Promise<{ status: 'none' | 'pending' | 'accepted' | 'rejected' | 'cancelled'; request?: any }> {
  const isDbConnected = mongoose.connection.readyState === 1;

  if (isDbConnected && mongoose.Types.ObjectId.isValid(userA) && mongoose.Types.ObjectId.isValid(userB)) {
    const docs = await FriendRequestModel.find({
      $or: [
        { senderId: userA, recipientId: userB },
        { senderId: userB, recipientId: userA },
      ],
    })
      .sort({ updatedAt: -1 })
      .lean();

    if (!docs.length) return { status: 'none' };
    const accepted = docs.find((d: any) => d.status === 'accepted');
    if (accepted) return { status: 'accepted', request: accepted };
    const pending = docs.find((d: any) => d.status === 'pending');
    if (pending) return { status: 'pending', request: pending };
    const rejected = docs.find((d: any) => d.status === 'rejected');
    if (rejected) return { status: 'rejected', request: rejected };
    return { status: docs[0].status as any, request: docs[0] };
  }

  const matches = inMemoryFriendRequestStore.filter(
    (r) =>
      (r.senderId === userA && r.recipientId === userB) ||
      (r.senderId === userB && r.recipientId === userA)
  );
  if (!matches.length) return { status: 'none' };
  const accepted = matches.find((r) => r.status === 'accepted');
  if (accepted) return { status: 'accepted', request: accepted };
  const pending = matches.find((r) => r.status === 'pending');
  if (pending) return { status: 'pending', request: pending };
  const rejected = matches.find((r) => r.status === 'rejected');
  if (rejected) return { status: 'rejected', request: rejected };
  return { status: matches[0].status, request: matches[0] };
}

export function clearInMemorySocialStores(): void {
  inMemoryBlockStore.clear();
  inMemoryFriendRequestStore.length = 0;
  inMemoryHelloStore.length = 0;
}

export { pairKey };
