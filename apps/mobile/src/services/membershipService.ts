import { apiClient } from './apiClient';
import {
  ApiResponse,
  MembershipPlan,
  UserMembership,
  CheckoutResponse,
  PlanTier,
} from '@bandhansetu/shared';

/**
 * Mobile Membership Service
 * Centralized service for plans, active entitlements, and checkout advisories
 */

export async function getMembershipPlans(): Promise<ApiResponse<MembershipPlan[]>> {
  return apiClient<ApiResponse<MembershipPlan[]>>('/membership/plans', {
    method: 'GET',
  });
}

export async function getMyMembership(
  accessToken: string
): Promise<ApiResponse<UserMembership>> {
  return apiClient<ApiResponse<UserMembership>>('/membership/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function requestCheckout(
  accessToken: string,
  planId: 'plus' | 'premium'
): Promise<ApiResponse<CheckoutResponse>> {
  return apiClient<ApiResponse<CheckoutResponse>>('/membership/checkout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ planId }),
  });
}
