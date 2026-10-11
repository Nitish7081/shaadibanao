import { apiClient, getApiBaseUrl } from './apiClient';
import { io, Socket } from 'socket.io-client';
import {
  ApiResponse,
  ConversationItem,
  ChatMessage,
  PaginatedResponse,
  ContactExchangeDetails,
} from '@bandhansetu/shared';

/**
 * Mobile Chat Service
 * Centralized service for conversations, messaging, read receipts, and real-time Socket.IO
 */

let socketInstance: Socket | null = null;

// ======================== REST API CLIENTS ========================

export async function getConversations(
  accessToken: string
): Promise<ApiResponse<ConversationItem[]>> {
  return apiClient<ApiResponse<ConversationItem[]>>('/conversations', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function getOrCreateConversation(
  accessToken: string,
  participantId: string
): Promise<ApiResponse<ConversationItem>> {
  return apiClient<ApiResponse<ConversationItem>>('/conversations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ participantId }),
  });
}

export async function getMessages(
  accessToken: string,
  conversationId: string,
  page = 1,
  limit = 20
): Promise<ApiResponse<PaginatedResponse<ChatMessage>>> {
  return apiClient<ApiResponse<PaginatedResponse<ChatMessage>>>(
    `/conversations/${conversationId}/messages?page=${page}&limit=${limit}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
}

export async function sendMessage(
  accessToken: string,
  conversationId: string,
  text: string
): Promise<ApiResponse<ChatMessage>> {
  return apiClient<ApiResponse<ChatMessage>>(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ text }),
  });
}

export async function markMessagesAsRead(
  accessToken: string,
  conversationId: string
): Promise<ApiResponse<void>> {
  return apiClient<ApiResponse<void>>(`/conversations/${conversationId}/read`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function requestContactExchange(
  accessToken: string,
  conversationId: string,
  action: 'request' | 'accept' | 'decline'
): Promise<ApiResponse<ContactExchangeDetails>> {
  return apiClient<ApiResponse<ContactExchangeDetails>>(
    `/conversations/${conversationId}/contact-request`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ action }),
    }
  );
}

// ======================== REAL-TIME SOCKET.IO ========================

/**
 * Initializes authenticated Socket.IO connection
 */
export function initChatSocket(accessToken: string): Socket {
  if (socketInstance?.connected) {
    return socketInstance;
  }

  // Base server URL (without /api/v1)
  const baseUrl = getApiBaseUrl().replace('/api/v1', '');

  socketInstance = io(baseUrl, {
    auth: {
      token: accessToken,
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  return socketInstance;
}

export function getChatSocket(): Socket | null {
  return socketInstance;
}

export function joinConversationRoom(conversationId: string): void {
  if (socketInstance) {
    socketInstance.emit('join_conversation', { conversationId });
  }
}

export function leaveConversationRoom(conversationId: string): void {
  if (socketInstance) {
    socketInstance.emit('leave_conversation', { conversationId });
  }
}

export function disconnectChatSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
