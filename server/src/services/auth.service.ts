import mongoose from 'mongoose';
import { UserModel, IUser } from '../models/user.model';
import { TokenService } from './token.service';
import { OtpService } from './otp.service';
import { verifyFirebaseIdToken } from '../config/firebase';
import { AppError } from '../middleware/errorHandler';
import {
  AuthResponse,
  RegisterInput,
  UserSummary,
  VerifyOtpResponse,
} from '@bandhansetu/shared';

// In-memory user store for dev/testing when MongoDB is unconfigured
const inMemoryUserStore = new Map<string, any>();

// Max concurrently valid refresh tokens (sessions/devices) kept per user. Oldest are dropped.
const MAX_REFRESH_TOKENS = 10;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Structured auth log: event + error code + reason. Never pass tokens, phone numbers,
 * emails or document data in `fields`.
 */
function authLog(
  level: 'info' | 'warn' | 'error',
  event: string,
  fields: Record<string, string | number | boolean | undefined> = {}
): void {
  if (process.env.NODE_ENV === 'test' && process.env.AUTH_LOG_IN_TEST !== 'true') return;
  const line = JSON.stringify({ scope: 'auth', event, ...fields, ts: new Date().toISOString() });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
}

function isDuplicateKeyError(err: any): boolean {
  return err?.code === 11000 || err?.name === 'MongoServerError' && err?.code === 11000;
}

/** Safe key for the dev in-memory store (never `undefined`). */
function memoryKey(user: any): string {
  return String(user.mobile || user.email || user.firebaseUid || user._id || user.id);
}

export class AuthService {
  /**
   * Helper to format User model or in-memory object to UserSummary
   */
  private static formatUserSummary(user: any): UserSummary {
    const approvalStatus =
      user.approvalStatus || (user.role === 'admin' ? 'approved' : 'pending');

    return {
      id: user._id?.toString() || user.id,
      mobile: user.mobile,
      email: user.email,
      role: user.role,
      hasProfile: user.hasProfile || false,
      profileFor: user.profileFor || 'myself',
      status: user.status || 'active',
      approvalStatus,
      phoneVerified: user.phoneVerified ?? false,
      identityVerificationStatus: user.identityVerificationStatus || 'none',
      photoApprovalStatus: user.photoApprovalStatus || 'none',
      approvedBy: user.approvedBy?.toString?.() || user.approvedBy,
      approvedAt: user.approvedAt?.toISOString?.() || user.approvedAt,
      rejectionReason: user.rejectionReason,
      moderationRemarks: user.moderationRemarks,
      authProvider: user.authProvider || (user.email && !user.mobile ? 'google' : 'phone'),
      firebaseUid: user.firebaseUid,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt?.toISOString?.() || new Date().toISOString(),
    };
  }

  /**
   * Finds user by mobile across MongoDB or dev in-memory store
   */
  public static async findUserByMobile(mobile: string): Promise<any> {
    if (mongoose.connection.readyState === 1) {
      return UserModel.findOne({ mobile, status: { $ne: 'deleted' } });
    }
    return inMemoryUserStore.get(mobile) || null;
  }

  /**
   * Finds user by Firebase UID across MongoDB or dev in-memory store
   */
  public static async findUserByFirebaseUid(firebaseUid: string): Promise<any> {
    if (mongoose.connection.readyState === 1) {
      return UserModel.findOne({ firebaseUid, status: { $ne: 'deleted' } });
    }
    for (const user of inMemoryUserStore.values()) {
      if (user.firebaseUid === firebaseUid && user.status !== 'deleted') {
        return user;
      }
    }
    return null;
  }

  /**
   * Finds user by email across MongoDB or dev in-memory store
   */
  public static async findUserByEmail(email: string): Promise<any> {
    const cleanEmail = email.toLowerCase().trim();
    if (mongoose.connection.readyState === 1) {
      return UserModel.findOne({ email: cleanEmail, status: { $ne: 'deleted' } });
    }
    for (const user of inMemoryUserStore.values()) {
      if (user.email?.toLowerCase?.() === cleanEmail && user.status !== 'deleted') {
        return user;
      }
    }
    return null;
  }

  /**
   * Finds user by ID across MongoDB or dev in-memory store
   */
  public static async findUserById(userId: string): Promise<any> {
    if (mongoose.connection.readyState === 1) {
      return UserModel.findById(userId);
    }
    for (const user of inMemoryUserStore.values()) {
      if (user.id === userId || user._id?.toString() === userId) {
        return user;
      }
    }
    return null;
  }

  /**
   * Authenticates or creates user from verified Firebase ID token
   */
  public static async loginWithFirebase(
    idToken: string,
    profileFor: string = 'myself',
    ipAddress?: string
  ): Promise<AuthResponse> {
    let decoded: Awaited<ReturnType<typeof verifyFirebaseIdToken>>;
    try {
      decoded = await verifyFirebaseIdToken(idToken);
    } catch (err: any) {
      authLog('warn', 'firebase_login.token_rejected', {
        code: err?.code || 'INVALID_FIREBASE_TOKEN',
        reason: err?.code === 'TOKEN_EXPIRED' ? 'expired id token' : 'verification failed',
      });
      throw err;
    }

    // Rule 5: Never link accounts based only on an unverified email address
    if (decoded.email && decoded.email_verified !== true) {
      throw new AppError(
        'Email address is not verified by Google. Cannot authenticate or link unverified email.',
        400,
        'UNVERIFIED_EMAIL'
      );
    }

    let existingUser: any = null;
    let cleanMobile: string | undefined = undefined;

    if (decoded.phone_number) {
      cleanMobile = decoded.phone_number.replace(/^\+91/, '').replace(/\D/g, '');
      if (cleanMobile.length > 10) {
        cleanMobile = cleanMobile.slice(-10);
      }
    }

    // 1. Try finding by firebaseUid first
    if (decoded.uid) {
      existingUser = await this.findUserByFirebaseUid(decoded.uid);
    }

    // 2. If not found by firebaseUid, try finding by verified phone or email
    if (!existingUser && cleanMobile) {
      existingUser = await this.findUserByMobile(cleanMobile);
    }

    if (!existingUser && decoded.email && decoded.email_verified === true) {
      existingUser = await this.findUserByEmail(decoded.email);
    }

    if (mongoose.connection.readyState === 1) {
      return this.loginWithFirebaseDb(decoded, existingUser, cleanMobile, profileFor, ipAddress);
    }

    const isDbConnected = false;
    let isNewUser = false;
    let targetUser: any = null;

    if (existingUser) {
      targetUser = existingUser;
      // Link firebaseUid if not present
      if (!targetUser.firebaseUid) {
        targetUser.firebaseUid = decoded.uid;
      }

      // Link phone if user previously only had Google
      if (cleanMobile && !targetUser.mobile) {
        targetUser.mobile = cleanMobile;
      }

      // Link email if verified and user didn't have email
      if (decoded.email && decoded.email_verified === true && !targetUser.email) {
        targetUser.email = decoded.email.toLowerCase().trim();
        targetUser.emailVerified = true;
      }

      // Update provider to both if both phone & email exist
      if (targetUser.mobile && targetUser.email) {
        targetUser.authProvider = 'both';
      }

      if (!targetUser.displayName && decoded.name) {
        targetUser.displayName = decoded.name;
      }
      if (!targetUser.avatarUrl && decoded.picture) {
        targetUser.avatarUrl = decoded.picture;
      }

      if (isDbConnected) {
        await targetUser.save();
      } else {
        const storeKey = targetUser.mobile || targetUser.email || targetUser.firebaseUid;
        inMemoryUserStore.set(storeKey, targetUser);
      }
    } else {
      // Create new user
      isNewUser = true;
      const authProvider = cleanMobile && decoded.email ? 'both' : (decoded.email ? 'google' : 'phone');

      const userData: any = {
        mobile: cleanMobile,
        email: decoded.email ? decoded.email.toLowerCase().trim() : undefined,
        emailVerified: !!decoded.email_verified,
        firebaseUid: decoded.uid,
        authProvider,
        displayName: decoded.name,
        avatarUrl: decoded.picture,
        role: 'member',
        status: 'active',
        approvalStatus: 'pending',
        hasProfile: false,
        profileFor: profileFor || 'myself',
        consent: {
          agreedAt: new Date(),
          ipAddress,
          termsVersion: 'v1.0',
        },
        refreshTokens: [],
      };

      if (isDbConnected) {
        targetUser = await UserModel.create(userData);
      } else {
        const tempId = `usr_${Date.now()}`;
        targetUser = {
          id: tempId,
          _id: tempId,
          ...userData,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const storeKey = cleanMobile || decoded.email || decoded.uid;
        inMemoryUserStore.set(storeKey, targetUser);
      }
    }

    const userSummary = this.formatUserSummary(targetUser);
    const tokens = TokenService.generateTokens({
      userId: userSummary.id,
      mobile: userSummary.mobile,
      email: userSummary.email,
      role: userSummary.role,
    });

    const tokenHash = TokenService.hashToken(tokens.refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    targetUser.refreshTokens = targetUser.refreshTokens || [];
    targetUser.refreshTokens.push({ tokenHash, expiresAt, createdAt: new Date() });

    if (isDbConnected) {
      await targetUser.save();
    } else {
      const storeKey = targetUser.mobile || targetUser.email || targetUser.firebaseUid;
      inMemoryUserStore.set(storeKey, targetUser);
    }

    return {
      user: userSummary,
      tokens,
      isNewUser,
    };
  }


  /**
   * MongoDB login path. Every write is a single atomic operation:
   *  - new user: one insert (refresh token included)
   *  - existing user: one findOneAndUpdate ($set missing links + $push capped refresh token)
   * Duplicate-key races (two simultaneous first logins) re-fetch the existing user instead of failing.
   */
  private static async loginWithFirebaseDb(
    decoded: any,
    foundUser: any,
    cleanMobile: string | undefined,
    profileFor: string,
    ipAddress?: string
  ): Promise<AuthResponse> {
    const provider = decoded.signInProvider || 'unknown';
    const emailVerified = decoded.email && decoded.email_verified === true;
    const cleanEmail = decoded.email ? decoded.email.toLowerCase().trim() : undefined;

    const refetch = async (): Promise<any> => {
      let u: any = null;
      if (decoded.uid) u = await this.findUserByFirebaseUid(decoded.uid);
      if (!u && cleanMobile) u = await this.findUserByMobile(cleanMobile);
      if (!u && cleanEmail && emailVerified) u = await this.findUserByEmail(cleanEmail);
      return u;
    };

    const issue = (userDoc: any) => {
      const summary = this.formatUserSummary(userDoc);
      const tokens = TokenService.generateTokens({
        userId: summary.id,
        mobile: summary.mobile,
        email: summary.email,
        role: summary.role,
      });
      const entry = {
        tokenHash: TokenService.hashToken(tokens.refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        createdAt: new Date(),
      };
      return { tokens, entry };
    };

    let existing = foundUser;

    // ---- New user: single insert ----
    if (!existing) {
      const newId = new mongoose.Types.ObjectId();
      const authProvider = cleanMobile && cleanEmail ? 'both' : cleanEmail ? 'google' : 'phone';
      const { tokens, entry } = issue({
        _id: newId,
        mobile: cleanMobile,
        email: cleanEmail,
        role: 'member',
        hasProfile: false,
        approvalStatus: 'pending',
        status: 'active',
      });
      try {
        const created: any = await UserModel.create({
          _id: newId,
          mobile: cleanMobile,
          email: cleanEmail,
          emailVerified: !!decoded.email_verified,
          firebaseUid: decoded.uid,
          authProvider,
          displayName: decoded.name,
          avatarUrl: decoded.picture,
          role: 'member',
          status: 'active',
          approvalStatus: 'pending',
          hasProfile: false,
          profileFor: profileFor || 'myself',
          consent: { agreedAt: new Date(), ipAddress, termsVersion: 'v1.0' },
          refreshTokens: [entry],
        });
        authLog('info', 'firebase_login.success', { provider, isNewUser: true, userId: String(created._id) });
        return { user: this.formatUserSummary(created), tokens, isNewUser: true };
      } catch (err: any) {
        if (!isDuplicateKeyError(err)) {
          authLog('error', 'firebase_login.create_failed', { provider, reason: err?.name || 'unknown' });
          throw err;
        }
        // Lost a race (or index collision): someone else created this account first.
        existing = await refetch();
        if (!existing) {
          authLog('error', 'firebase_login.duplicate_unresolved', {
            provider,
            code: 'ACCOUNT_CONFLICT',
            reason: `duplicate key on ${Object.keys(err?.keyPattern || {}).join(',') || 'unknown'}`,
          });
          throw new AppError(
            'We could not sign you in because this phone number or email is linked to another account. Please contact support.',
            409,
            'ACCOUNT_CONFLICT'
          );
        }
        authLog('warn', 'firebase_login.duplicate_recovered', { provider, userId: String(existing._id) });
      }
    }

    // ---- Existing user: one atomic update ----
    const setFields: Record<string, any> = {};
    if (decoded.uid && !existing.firebaseUid) setFields.firebaseUid = decoded.uid;
    if (cleanMobile && !existing.mobile) setFields.mobile = cleanMobile;
    if (cleanEmail && emailVerified && !existing.email) {
      setFields.email = cleanEmail;
      setFields.emailVerified = true;
    }
    if (!existing.displayName && decoded.name) setFields.displayName = decoded.name;
    if (!existing.avatarUrl && decoded.picture) setFields.avatarUrl = decoded.picture;
    const finalMobile = setFields.mobile || existing.mobile;
    const finalEmail = setFields.email || existing.email;
    if (finalMobile && finalEmail) setFields.authProvider = 'both';

    const { tokens, entry } = issue({
      _id: existing._id,
      mobile: finalMobile,
      email: finalEmail,
      role: existing.role,
      approvalStatus: existing.approvalStatus,
      hasProfile: existing.hasProfile,
    });
    const pushOp = { refreshTokens: { $each: [entry], $slice: -MAX_REFRESH_TOKENS } };

    let updated: any = null;
    try {
      updated = await UserModel.findOneAndUpdate(
        { _id: existing._id },
        { $set: setFields, $push: pushOp },
        { new: true }
      );
    } catch (err: any) {
      if (!isDuplicateKeyError(err)) {
        authLog('error', 'firebase_login.update_failed', {
          provider,
          userId: String(existing._id),
          reason: err?.name || 'unknown',
        });
        throw err;
      }
      // A link target (mobile/email/uid) already belongs to another account: sign in without linking it.
      authLog('warn', 'firebase_login.link_conflict', {
        provider,
        userId: String(existing._id),
        reason: `duplicate key on ${Object.keys(err?.keyPattern || {}).join(',') || 'unknown'}`,
      });
      delete setFields.mobile;
      delete setFields.email;
      delete setFields.emailVerified;
      delete setFields.firebaseUid;
      delete setFields.authProvider;
      updated = await UserModel.findOneAndUpdate(
        { _id: existing._id },
        { $set: setFields, $push: pushOp },
        { new: true }
      );
    }

    if (!updated) {
      authLog('error', 'firebase_login.user_vanished', { provider, userId: String(existing._id) });
      throw new AppError('Your account could not be found. Please try again.', 404, 'USER_NOT_FOUND');
    }

    authLog('info', 'firebase_login.success', { provider, isNewUser: false, userId: String(updated._id) });
    return { user: this.formatUserSummary(updated), tokens, isNewUser: false };
  }

  /**
   * Verifies OTP and logs in existing user or provides verificationToken for new registration

   */
  public static async verifyOtpAndAuthenticate(
    mobile: string,
    otp: string
  ): Promise<VerifyOtpResponse> {
    const { verified, verificationToken } = await OtpService.verifyOtp(mobile, otp);

    const existingUser = await this.findUserByMobile(mobile);

    if (existingUser) {
      // Existing user: issue full session tokens
      const userSummary = this.formatUserSummary(existingUser);
      const tokens = TokenService.generateTokens({
        userId: userSummary.id,
        mobile: userSummary.mobile,
        role: userSummary.role,
      });

      // Save hashed refresh token
      const tokenHash = TokenService.hashToken(tokens.refreshToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      if (mongoose.connection.readyState === 1) {
        existingUser.refreshTokens.push({ tokenHash, expiresAt, createdAt: new Date() });
        await existingUser.save();
      } else {
        existingUser.refreshTokens = existingUser.refreshTokens || [];
        existingUser.refreshTokens.push({ tokenHash, expiresAt, createdAt: new Date() });
        inMemoryUserStore.set(mobile, existingUser);
      }

      return {
        verified: true,
        mobile,
        auth: {
          user: userSummary,
          tokens,
          isNewUser: false,
        },
      };
    }

    // New user: return verificationToken so they can complete registration
    return {
      verified: true,
      mobile,
      verificationToken,
    };
  }

  /**
   * Registers a new account after mobile verification
   */
  public static async register(input: RegisterInput, ipAddress?: string): Promise<AuthResponse> {
    const { mobile, profileFor } = input;

    // Check if user already exists
    const existing = await this.findUserByMobile(mobile);
    if (existing) {
      throw new AppError(
        'An account already exists for this mobile number. Please log in.',
        409,
        'USER_ALREADY_EXISTS'
      );
    }

    let newUser: any = null;

    if (mongoose.connection.readyState === 1) {
      newUser = await UserModel.create({
        mobile,
        phoneVerified: true,
        profileFor,
        role: 'member',
        status: 'active',
        approvalStatus: 'pending',
        hasProfile: false,
        consent: {
          agreedAt: new Date(),
          ipAddress,
          termsVersion: 'v1.0',
        },
        refreshTokens: [],
      });
    } else {
      newUser = {
        id: `usr_${Date.now()}`,
        _id: `usr_${Date.now()}`,
        mobile,
        phoneVerified: true,
        profileFor,
        role: 'member',
        status: 'active',
        approvalStatus: 'pending',
        hasProfile: false,
        consent: {
          agreedAt: new Date(),
          ipAddress,
          termsVersion: 'v1.0',
        },
        refreshTokens: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inMemoryUserStore.set(mobile, newUser);
    }

    const userSummary = this.formatUserSummary(newUser);
    const tokens = TokenService.generateTokens({
      userId: userSummary.id,
      mobile: userSummary.mobile,
      role: userSummary.role,
    });

    // Save refresh token
    const tokenHash = TokenService.hashToken(tokens.refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    if (mongoose.connection.readyState === 1) {
      newUser.refreshTokens.push({ tokenHash, expiresAt, createdAt: new Date() });
      await newUser.save();
    } else {
      newUser.refreshTokens.push({ tokenHash, expiresAt, createdAt: new Date() });
      inMemoryUserStore.set(mobile, newUser);
    }

    return {
      user: userSummary,
      tokens,
      isNewUser: true,
    };
  }

  /**
   * Retrieves profile for current authenticated user
   */
  public static async getCurrentUser(userId: string): Promise<UserSummary> {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new AppError('User account not found', 404, 'USER_NOT_FOUND');
    }
    return this.formatUserSummary(user);
  }

  /**
   * Revokes refresh token on logout
   */
  public static async logout(userId: string, refreshToken?: string): Promise<void> {
    const user = await this.findUserById(userId);
    if (!user) {
      authLog('warn', 'logout.user_not_found', { code: 'USER_NOT_FOUND' });
      return;
    }

    if (mongoose.connection.readyState === 1) {
      // Atomic: removes only the matching hash (or all sessions) without rewriting the document
      const update = refreshToken
        ? { $pull: { refreshTokens: { tokenHash: TokenService.hashToken(refreshToken) } } }
        : { $set: { refreshTokens: [] } };
      await UserModel.updateOne({ _id: user._id }, update);
    } else {
      user.refreshTokens = refreshToken
        ? (user.refreshTokens || []).filter(
            (t: any) => t.tokenHash !== TokenService.hashToken(refreshToken)
          )
        : [];
      inMemoryUserStore.set(memoryKey(user), user);
    }
    authLog('info', 'logout.success', { userId: String(user._id || user.id), allSessions: !refreshToken });
  }


  /**
   * Refreshes access token using a valid, unexpired refresh token
   */
  public static async refreshSession(refreshToken: string): Promise<AuthResponse> {
    if (!refreshToken || !refreshToken.trim()) {
      throw new AppError('Refresh token is required.', 400, 'REFRESH_TOKEN_REQUIRED');
    }

    const tokenHash = TokenService.hashToken(refreshToken);
    const isDbConnected = mongoose.connection.readyState === 1;

    let user: any = null;

    if (isDbConnected) {
      user = await UserModel.findOne({
        'refreshTokens.tokenHash': tokenHash,
        status: { $ne: 'deleted' },
      });
    } else {
      for (const u of inMemoryUserStore.values()) {
        const hasToken = (u.refreshTokens || []).some((t: any) => t.tokenHash === tokenHash);
        if (hasToken) {
          user = u;
          break;
        }
      }
    }

    if (!user) {
      throw new AppError('Invalid or revoked refresh token. Please log in again.', 401, 'INVALID_REFRESH_TOKEN');
    }

    // Check if the specific refresh token has expired
    const tokenRecord = (user.refreshTokens || []).find((t: any) => t.tokenHash === tokenHash);
    if (!tokenRecord || new Date() > new Date(tokenRecord.expiresAt)) {
      // Remove expired token
      if (isDbConnected && user._id) {
        await UserModel.findByIdAndUpdate(user._id, {
          $pull: { refreshTokens: { tokenHash } },
        });
      } else {
        user.refreshTokens = (user.refreshTokens || []).filter((t: any) => t.tokenHash !== tokenHash);
        inMemoryUserStore.set(memoryKey(user), user);
      }
      authLog('warn', 'refresh.rejected', { code: 'REFRESH_TOKEN_EXPIRED', reason: 'expired' });
      throw new AppError('Refresh token has expired. Please log in again.', 401, 'REFRESH_TOKEN_EXPIRED');
    }

    // Generate fresh tokens
    const userSummary = this.formatUserSummary(user);
    const newTokens = TokenService.generateTokens({
      userId: userSummary.id,
      mobile: userSummary.mobile,
      email: userSummary.email,
      role: userSummary.role,
    });

    // Rotate refresh token: replace old token with new token
    const newEntry = {
      tokenHash: TokenService.hashToken(newTokens.refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      createdAt: new Date(),
    };

    if (isDbConnected && user._id) {
      // Atomic positional replace of ONLY the matching entry. Never rewrites the whole array,
      // so a concurrent login's freshly pushed token cannot be lost. If the token was already
      // rotated/revoked in the meantime, the filter matches nothing and we reject.
      const claimed = await UserModel.findOneAndUpdate(
        { _id: user._id, 'refreshTokens.tokenHash': tokenHash },
        { $set: { 'refreshTokens.$': newEntry } },
        { new: true }
      );
      if (!claimed) {
        authLog('warn', 'refresh.rejected', {
          code: 'INVALID_REFRESH_TOKEN',
          reason: 'token already rotated or revoked',
          userId: String(user._id),
        });
        throw new AppError('Invalid or revoked refresh token. Please log in again.', 401, 'INVALID_REFRESH_TOKEN');
      }
    } else {
      user.refreshTokens = [
        ...(user.refreshTokens || []).filter((t: any) => t.tokenHash !== tokenHash),
        newEntry,
      ];
      inMemoryUserStore.set(memoryKey(user), user);
    }


    return {
      user: userSummary,
      tokens: newTokens,
      isNewUser: false,
    };
  }

  public static registerInMemoryUserForTesting(user: any): void {
    const id = user._id?.toString() || user.id;
    if (id) inMemoryUserStore.set(id, user);
    if (user.mobile) inMemoryUserStore.set(user.mobile, user);
    if (user.email) inMemoryUserStore.set(user.email, user);
  }

  public static clearInMemoryUserForTesting(): void {
    inMemoryUserStore.clear();
  }
}
