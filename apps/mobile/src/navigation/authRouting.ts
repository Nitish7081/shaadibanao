import { UserSummary } from '@bandhansetu/shared';

export type PostAuthRoute =
  | { screen: 'LoginOtp'; params?: undefined }
  | { screen: 'IdentityVerification'; params: { mandatory: boolean } }
  | { screen: 'ApprovalPending'; params?: undefined }
  | { screen: 'ProfileCreation'; params?: undefined }
  | { screen: 'MainTabs'; params?: undefined };

/**
 * Checks whether the user has been approved / identity-verified by an Admin.
 * Only Admin-verified users may create a matrimonial profile or enter MainTabs.
 */
export function isUserAdminVerified(user: UserSummary | null | undefined): boolean {
  if (!user) return false;
  if (user.status === 'suspended') return false;
  if (user.role === 'admin') return true;
  return user.approvalStatus === 'approved' || user.identityVerificationStatus === 'verified';
}

/**
 * Single source of truth for post-authentication & app-launch routing:
 * 1. Suspended user -> ApprovalPending (shows restriction notice)
 * 2. Not yet verified by Admin:
 *    - ID doc not uploaded ('none') or 'rejected' -> IdentityVerification (mandatory: true)
 *    - ID doc uploaded ('pending') -> ApprovalPending (wait for Admin verification)
 * 3. Admin verified:
 *    - Profile not created yet (!hasProfile) -> ProfileCreation
 *    - Profile exists -> MainTabs
 */
export function getNextRouteForUser(user: UserSummary | null | undefined): PostAuthRoute {
  if (!user) {
    return { screen: 'LoginOtp' };
  }

  if (user.status === 'suspended') {
    return { screen: 'ApprovalPending' };
  }

  if (!isUserAdminVerified(user)) {
    const idStatus = user.identityVerificationStatus || 'none';
    if (idStatus === 'none' || idStatus === 'rejected') {
      return { screen: 'IdentityVerification', params: { mandatory: true } };
    }
    return { screen: 'ApprovalPending' };
  }

  if (!user.hasProfile) {
    return { screen: 'ProfileCreation' };
  }

  return { screen: 'MainTabs' };
}
