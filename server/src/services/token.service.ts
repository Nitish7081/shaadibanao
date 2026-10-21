import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/env';
import { AuthTokens } from '@bandhansetu/shared';

export interface TokenPayload {
  userId: string;
  id?: string;
  mobile?: string;
  email?: string;
  role: string;
}


export class TokenService {
  /**
   * Generates short-lived access token and long-lived refresh token
   */
  public static generateTokens(payload: TokenPayload): AuthTokens {
    const accessToken = jwt.sign(payload, config.jwt.accessSecret, {
      expiresIn: config.jwt.accessExpiry,
    } as jwt.SignOptions);

    // Cryptographically secure random 64-character hex refresh token
    const refreshToken = crypto.randomBytes(32).toString('hex');

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
    };
  }

  /**
   * Verifies access token and extracts payload
   */
  public static verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(token, config.jwt.accessSecret) as TokenPayload;
  }

  /**
   * One-way hash for refresh tokens and verification tokens before DB persistence
   */
  public static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generates a secure, temporary verification token for registration
   */
  public static generateVerificationToken(mobile: string): string {
    const random = crypto.randomBytes(16).toString('hex');
    const signature = crypto
      .createHmac('sha256', config.jwt.accessSecret)
      .update(`${mobile}:${random}:${Date.now()}`)
      .digest('hex');
    return `${random}.${signature}`;
  }
}
