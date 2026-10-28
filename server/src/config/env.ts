import dotenv from 'dotenv';
import path from 'path';

// Check both server directory .env and root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const cleanEnvStr = (val: string | undefined): string =>
  (val || '').trim().replace(/^["']|["']$/g, '');

const cloudName = cleanEnvStr(process.env.CLOUDINARY_CLOUD_NAME);
const apiKey = cleanEnvStr(process.env.CLOUDINARY_API_KEY);
const apiSecret = cleanEnvStr(process.env.CLOUDINARY_API_SECRET);
const authTokenKey = cleanEnvStr(process.env.CLOUDINARY_AUTH_TOKEN_KEY);

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  mongodbUri: process.env.MONGODB_URI || '',
  corsOrigins: (process.env.CLIENT_ORIGIN || '*').split(',').map((origin) => origin.trim()),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev_jwt_access_secret_bandhansetu_auth_min_32',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_jwt_refresh_secret_bandhansetu_auth_min_32',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },
  otp: {
    deliveryMode: (process.env.OTP_DELIVERY_MODE || 'development_mock') as 'development_mock' | 'production_sms',
    expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '5', 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10),
    // Test code used specifically in development mock mode
    devTestCode: '123456',
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || 'saadibaano',
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '',
  },
  cloudinary: {
    cloudName,
    apiKey,
    apiSecret,
    /** OPTIONAL: Cloudinary token-based-authentication key. When set, signed photo URLs also expire. */
    authTokenKey,
    /** Lifetime of expiring photo URLs (only used when authTokenKey is set). */
    signedUrlTtlSeconds: Number(process.env.CLOUDINARY_SIGNED_URL_TTL_SECONDS) || 600,
    isConfigured: Boolean(cloudName && apiKey && apiSecret),
  },
};
