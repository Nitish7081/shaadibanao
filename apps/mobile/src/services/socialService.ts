import { apiClient } from './apiClient';
import {
  ApiResponse,
  FreeHelloItem,
  FriendRequestItem,
  ProfileStoryItem,
} from '@bandhansetu/shared';

export async function getStories(
  accessToken: string
): Promise<ApiResponse<ProfileStoryItem[]>> {
  return apiClient<ApiResponse<ProfileStoryItem[]>>('/stories', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function sendFreeHello(
  accessToken: string,
  recipientId: string,
  message?: string
): Promise<ApiResponse<FreeHelloItem>> {
  return apiClient<ApiResponse<FreeHelloItem>>(`/hello/${recipientId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(message ? { message } : {}),
  });
}

export async function getHelloStatus(
  accessToken: string,
  recipientId: string
): Promise<ApiResponse<{ sent: boolean; hello?: FreeHelloItem }>> {
  return apiClient<ApiResponse<{ sent: boolean; hello?: FreeHelloItem }>>(
    `/hello/status/${recipientId}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
}

export async function getSentHellos(
  accessToken: string
): Promise<ApiResponse<FreeHelloItem[]>> {
  return apiClient<ApiResponse<FreeHelloItem[]>>('/hello/sent', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function getReceivedHellos(
  accessToken: string
): Promise<ApiResponse<FreeHelloItem[]>> {
  return apiClient<ApiResponse<FreeHelloItem[]>>('/hello/received', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function sendFriendRequest(
  accessToken: string,
  recipientId: string,
  note?: string
): Promise<ApiResponse<FriendRequestItem>> {
  return apiClient<ApiResponse<FriendRequestItem>>(`/friend-requests/${recipientId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(note ? { note } : {}),
  });
}

export async function respondToFriendRequest(
  accessToken: string,
  requestId: string,
  action: 'accept' | 'reject'
): Promise<ApiResponse<FriendRequestItem>> {
  return apiClient<ApiResponse<FriendRequestItem>>(`/friend-requests/${requestId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ action }),
  });
}

export async function getReceivedFriendRequests(
  accessToken: string
): Promise<ApiResponse<FriendRequestItem[]>> {
  return apiClient<ApiResponse<FriendRequestItem[]>>('/friend-requests/received', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function getSentFriendRequests(
  accessToken: string
): Promise<ApiResponse<FriendRequestItem[]>> {
  return apiClient<ApiResponse<FriendRequestItem[]>>('/friend-requests/sent', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function getFriends(
  accessToken: string
): Promise<ApiResponse<FriendRequestItem[]>> {
  return apiClient<ApiResponse<FriendRequestItem[]>>('/friends', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function blockUserAccount(
  accessToken: string,
  targetId: string,
  reason?: string
): Promise<ApiResponse<{ blockerId: string; blockedUserId: string; blocked: boolean }>> {
  return apiClient<ApiResponse<{ blockerId: string; blockedUserId: string; blocked: boolean }>>(
    `/blocks/${targetId}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(reason ? { reason } : {}),
    }
  );
}
