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
    const decoded = await verifyFirebaseIdToken(idToken);

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

    const isDbConnected = mongoose.connection.readyState === 1;
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
    if (!user) return;

    if (refreshToken) {
      const hash = TokenService.hashToken(refreshToken);
      user.refreshTokens = (user.refreshTokens || []).filter((t: any) => t.tokenHash !== hash);
    } else {
      // Clear all active sessions
      user.refreshTokens = [];
    }

    if (mongoose.connection.readyState === 1) {
      await user.save();
    } else {
      inMemoryUserStore.set(user.mobile, user);
    }
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
        inMemoryUserStore.set(user.mobile, user);
      }
      throw new AppError('Refresh token has expired. Please log in again.', 401, 'REFRESH_TOKEN_EXPIRED');
    }

    // Generate fresh tokens
    const userSummary = this.formatUserSummary(user);
    const newTokens = TokenService.generateTokens({
      userId: userSummary.id,
      mobile: userSummary.mobile,
      role: userSummary.role,
    });

    // Rotate refresh token: replace old token with new token
    const newHash = TokenService.hashToken(newTokens.refreshToken);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const updatedRefreshTokens = [
      ...(user.refreshTokens || []).filter((t: any) => t.tokenHash !== tokenHash),
      { tokenHash: newHash, expiresAt: newExpiresAt, createdAt: new Date() },
    ];
    user.refreshTokens = updatedRefreshTokens;

    if (isDbConnected && user._id) {
      // Atomic findByIdAndUpdate prevents Mongoose VersionError on concurrent refresh requests
      await UserModel.findByIdAndUpdate(user._id, {
        $set: { refreshTokens: updatedRefreshTokens },
      });
    } else {
      inMemoryUserStore.set(user.mobile, user);
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
