import { apiClient } from './apiClient';
import { ApiResponse, ConversationItem, PanditChatEntitlementSummary } from '@bandhansetu/shared';

export interface AuthorizedWhatsappResponse {
  authorized: boolean;
  panditId: string;
  panditName: string;
  whatsappNumber: string;
  whatsappUrl: string;
}

export interface PanditChatOrderResponse {
  orderId: string;
  amount: number;
  amountInr: number;
  currency: 'INR';
  keyId: string;
  panditId: string;
  panditName: string;
  mode: 'live' | 'test_mode';
}

export async function getPanditDetail(panditId: string): Promise<ApiResponse<any>> {
  return apiClient<ApiResponse<any>>(`/pandits/${panditId}`, {
    method: 'GET',
  });
}

export async function getPanditChatEligibility(
  panditId: string
): Promise<ApiResponse<PanditChatEntitlementSummary>> {
  return apiClient<ApiResponse<PanditChatEntitlementSummary>>(
    `/pandits/${panditId}/chat-eligibility`,
    {
      method: 'GET',
    }
  );
}

export async function getAuthorizedPanditWhatsapp(
  panditId: string
): Promise<ApiResponse<AuthorizedWhatsappResponse>> {
  return apiClient<ApiResponse<AuthorizedWhatsappResponse>>(`/pandits/${panditId}/whatsapp`, {
    method: 'GET',
  });
}

export async function createPanditChatOrder(
  panditId: string
): Promise<ApiResponse<PanditChatOrderResponse>> {
  return apiClient<ApiResponse<PanditChatOrderResponse>>(`/pandits/${panditId}/chat/order`, {
    method: 'POST',
  });
}

export async function verifyPanditChatPayment(
  panditId: string,
  payload: { orderId: string; paymentId: string; signature?: string; paymentMethod?: string }
): Promise<ApiResponse<{ verified: boolean; paymentStatus: string; entitlement: PanditChatEntitlementSummary }>> {
  return apiClient<ApiResponse<any>>(`/pandits/${panditId}/chat/verify`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function openBookingConsultationChat(
  bookingId: string
): Promise<ApiResponse<ConversationItem>> {
  return apiClient<ApiResponse<ConversationItem>>(`/bookings/${bookingId}/chat`, {
    method: 'POST',
  });
}
