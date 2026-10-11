import mongoose from 'mongoose';
import { UserModel, IUser } from '../models/user.model';
import { TokenService } from './token.service';
import { OtpService } from './otp.service';
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
    return {
      id: user._id?.toString() || user.id,
      mobile: user.mobile,
      role: user.role,
      hasProfile: user.hasProfile || false,
      profileFor: user.profileFor || 'myself',
      status: user.status || 'active',
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
        profileFor,
        role: 'member',
        status: 'active',
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
        profileFor,
        role: 'member',
        status: 'active',
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
}
