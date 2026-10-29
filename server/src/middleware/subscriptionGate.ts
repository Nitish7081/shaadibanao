import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { config } from '../config/env';
import { ProfileModel } from '../models/profile.model';
import { inMemoryProfileStore } from '../services/profile.service';
import { MembershipService } from '../services/membership.service';

/**
 * Helper to resolve a profile document from MongoDB or in-memory store
 */
export async function resolveProfileRecord(idOrUserId: string): Promise<any | null> {
  if (!idOrUserId) return null;

  const isDbConnected = mongoose.connection.readyState === 1;

  if (isDbConnected) {
    if (mongoose.Types.ObjectId.isValid(idOrUserId)) {
      return ProfileModel.findOne({
        $or: [{ _id: idOrUserId }, { userId: idOrUserId }],
      }).lean();
    }
    return ProfileModel.findOne({ userId: idOrUserId }).lean();
  }

  // In-memory lookup for testing or offline environments
  if (inMemoryProfileStore.has(idOrUserId)) {
    return inMemoryProfileStore.get(idOrUserId);
  }

  for (const p of inMemoryProfileStore.values()) {
    const pid = p._id?.toString() || p.id?.toString();
    const puid = p.userId?.toString();
    if (pid === idOrUserId || puid === idOrUserId) {
      return p;
    }
  }

  return null;
}

/**
 * Subscription Gate Middleware
 *
 * Rules:
 * 1. Scrolling and browsing profile cards/lists is ALWAYS FREE for everyone.
 * 2. Tapping a FEMALE profile to view full biodata/details requires an active paid plan (Plus or Premium)
 *    if the viewer is MALE (or non-female). Free tier male users see the paywall (HTTP 402).
 * 3. FEMALE users are completely free: they can view male profiles, send interests, and interact without subscription.
 * 4. Male viewing male profile is free (target is not female).
 * 5. Users can always view their OWN profile.
 * 6. Admins and moderators are exempt.
 * 7. Whitelisted test accounts in PAYWALL_EXEMPT_USERS are exempt.
 * 8. PAYWALL_ENABLED=false disables the gate completely.
 */
export const requireSubscriptionForFemaleProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Env switch check: if paywall is disabled, bypass immediately
    if (!config.paywall.enabled) {
      return next();
    }

    const viewer = req.user;
    if (!viewer || !viewer.userId) {
      return next(); // requireAuth will handle unauthenticated requests
    }

    const viewerUserId = String(viewer.userId);

    // 2. Admins and moderators are exempt
    if (viewer.role === 'admin' || viewer.role === 'moderator') {
      return next();
    }

    // 3. Whitelisted test users exemption check
    const exemptList = config.paywall.exemptUsers;
    const viewerEmail = viewer.email ? viewer.email.toLowerCase() : '';
    if (
      exemptList.includes(viewerUserId.toLowerCase()) ||
      (viewerEmail && exemptList.includes(viewerEmail))
    ) {
      return next();
    }

    // 4. Resolve target profile
    const targetIdentifier =
      req.params.profileId ||
      req.params.id ||
      req.body.participantId ||
      req.body.targetUserId ||
      req.body.profileId;

    if (!targetIdentifier) {
      return next();
    }

    const targetProfile = await resolveProfileRecord(String(targetIdentifier));

    // If target profile not found, let route handler handle 404
    if (!targetProfile) {
      return next();
    }

    const targetUserId = String(targetProfile.userId?._id || targetProfile.userId || targetProfile.id);

    // 5. A user can ALWAYS see their OWN profile
    if (targetUserId === viewerUserId || String(targetProfile._id || targetProfile.id) === viewerUserId) {
      return next();
    }

    // 6. Target Profile Gender check: only FEMALE profiles are gated
    if (targetProfile.gender !== 'female') {
      // Viewing a male profile is free for all viewers
      return next();
    }

    // 7. Viewer Gender check: FEMALE viewers are completely free!
    const viewerProfile = await resolveProfileRecord(viewerUserId);
    if (viewerProfile && viewerProfile.gender === 'female') {
      return next();
    }

    // 8. Viewer is male (or non-female) viewing a female profile -> Check membership status
    const membership = await MembershipService.getUserMembership(viewerUserId);

    const isPaidPlan = membership.planId === 'plus' || membership.planId === 'premium';
    const isActiveStatus = membership.status === 'active';

    let isNotExpired = true;
    if (membership.expiresAt) {
      const expiryTime = new Date(membership.expiresAt).getTime();
      if (!isNaN(expiryTime) && expiryTime <= Date.now()) {
        isNotExpired = false;
      }
    }

    if (isPaidPlan && isActiveStatus && isNotExpired) {
      // Active paid membership verified
      return next();
    }

    // 9. Block with HTTP 402 SUBSCRIPTION_REQUIRED
    res.status(402).json({
      success: false,
      error: {
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'A paid membership plan (Plus or Premium) is required to view full biodata and direct details of female profiles.',
        details: {
          viewerGender: viewerProfile?.gender || 'male',
          targetGender: targetProfile.gender,
          currentPlan: membership.planId,
          membershipStatus: isNotExpired ? membership.status : 'expired',
          requiredPlanTiers: ['plus', 'premium'],
          availablePlans: ['plus', 'premium'],
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

