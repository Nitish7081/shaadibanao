import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { config } from '../config/env';
import { OtpModel } from '../models/otp.model';
import { TokenService } from './token.service';
import { AppError } from '../middleware/errorHandler';
import { RequestOtpResponse, VerifyOtpResponse } from '@bandhansetu/shared';

// In-memory rate limiting store for OTP requests (phone -> timestamps[])
const rateLimitMap = new Map<string, number[]>();

// In-memory fallback for development when MongoDB is unconfigured
interface InMemoryOtp {
  mobile: string;
  otpHash: string;
  attempts: number;
  expiresAt: Date;
  verified: boolean;
  verificationToken?: string;
}
const inMemoryOtpStore = new Map<string, InMemoryOtp>();

export class OtpService {
  /**
   * Enforces rate limiting: max 3 requests within 10 minutes per mobile
   */
  private static checkRateLimit(mobile: string): void {
    const now = Date.now();
    const windowMs = 10 * 60 * 1000; // 10 minutes
    const maxRequests = 3;

    const timestamps = rateLimitMap.get(mobile) || [];
    const recent = timestamps.filter((t) => now - t < windowMs);

    if (recent.length >= maxRequests) {
      const waitMinutes = Math.ceil((windowMs - (now - recent[0])) / 60000);
      throw new AppError(
        `Too many OTP requests for this number. Please wait ${waitMinutes} minute(s) before requesting again.`,
        429,
        'RATE_LIMIT_EXCEEDED'
      );
    }

    recent.push(now);
    rateLimitMap.set(mobile, recent);
  }

  /**
   * Generates and stores OTP.
   * In development_mock mode, the fixed test OTP '123456' is used and transparently indicated.
   */
  public static async requestOtp(mobile: string): Promise<RequestOtpResponse> {
    this.checkRateLimit(mobile);

    // Production Guard: Mock OTP '123456' is strictly prohibited in production mode
    if (config.isProduction && config.otp.deliveryMode === 'development_mock') {
      throw new AppError(
        'SMS gateway is unconfigured in production mode. Real SMS delivery is required and mock OTP is disabled.',
        503,
        'SMS_GATEWAY_UNCONFIGURED'
      );
    }

    const isDevMock = !config.isProduction && config.otp.deliveryMode === 'development_mock';
    const otpCode = isDevMock
      ? config.otp.devTestCode
      : Math.floor(100000 + Math.random() * 900000).toString();

    // Securely hash OTP before database storage - plaintext is NEVER stored
    const otpHash = await bcrypt.hash(otpCode, 10);
    const expiresAt = new Date(Date.now() + config.otp.expiryMinutes * 60 * 1000);

    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      // Invalidate existing active OTPs for this number
      await OtpModel.deleteMany({ mobile });
      await OtpModel.create({
        mobile,
        otpHash,
        attempts: 0,
        expiresAt,
        verified: false,
      });
    } else {
      // In-memory fallback
      inMemoryOtpStore.set(mobile, {
        mobile,
        otpHash,
        attempts: 0,
        expiresAt,
        verified: false,
      });
    }

    return {
      mobile,
      expiresInSeconds: config.otp.expiryMinutes * 60,
      deliveryMode: isDevMock ? 'development_mock' : 'production_sms',
      devTestOtpHint: isDevMock
        ? 'DEVELOPMENT MODE: Use test OTP 123456. No real SMS was dispatched.'
        : undefined,
    };
  }

  /**
   * Verifies the OTP entered by the user
   */
  public static async verifyOtp(
    mobile: string,
    enteredOtp: string
  ): Promise<{ verified: boolean; verificationToken: string }> {
    const isDbConnected = mongoose.connection.readyState === 1;

    let record: any = null;

    if (isDbConnected) {
      record = await OtpModel.findOne({ mobile }).sort({ createdAt: -1 });
    } else {
      record = inMemoryOtpStore.get(mobile);
    }

    if (!record) {
      throw new AppError(
        'No OTP request found for this mobile number. Please request a new OTP.',
        400,
        'OTP_NOT_FOUND'
      );
    }

    // Check expiration
    if (new Date() > new Date(record.expiresAt)) {
      throw new AppError('OTP has expired. Please request a fresh code.', 400, 'OTP_EXPIRED');
    }

    // Check attempt lockout
    if (record.attempts >= config.otp.maxAttempts) {
      throw new AppError(
        'Maximum verification attempts exceeded. Please request a new OTP.',
        429,
        'OTP_MAX_ATTEMPTS_EXCEEDED'
      );
    }

    // Compare candidate OTP with cryptographic hash
    const isMatch = await bcrypt.compare(enteredOtp, record.otpHash);

    if (!isMatch) {
      record.attempts += 1;
      if (isDbConnected) {
        await record.save();
      }
      const attemptsLeft = config.otp.maxAttempts - record.attempts;
      throw new AppError(
        `Incorrect OTP. ${attemptsLeft} attempt(s) remaining.`,
        400,
        'INVALID_OTP',
        { attemptsLeft }
      );
    }

    // OTP matched successfully. Issue a single-use verification token
    const verificationToken = TokenService.generateVerificationToken(mobile);
    record.verified = true;
    record.verificationToken = verificationToken;

    if (isDbConnected) {
      await record.save();
    } else {
      inMemoryOtpStore.set(mobile, record);
    }

    return {
      verified: true,
      verificationToken,
    };
  }
}
