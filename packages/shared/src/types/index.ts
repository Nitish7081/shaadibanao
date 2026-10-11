/**
 * BandhanSetu Shared Type Definitions & API Contracts
 */

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

export interface HealthCheckResponse {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  timestamp: string;
  database: {
    status: 'connected' | 'disconnected' | 'connecting' | 'unconfigured';
    host?: string;
  };
  environment: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // in seconds
}

export interface UserSummary {
  id: string;
  mobile: string;
  role: 'member' | 'pandit' | 'moderator' | 'admin';
  hasProfile: boolean;
  profileFor: string;
  status: 'active' | 'pending' | 'suspended';
  createdAt: string;
}

export interface AuthResponse {
  user: UserSummary;
  tokens: AuthTokens;
  isNewUser: boolean;
}

export interface RequestOtpResponse {
  mobile: string;
  expiresInSeconds: number;
  deliveryMode: 'development_mock' | 'production_sms';
  devTestOtpHint?: string;
}

export interface VerifyOtpResponse {
  verified: boolean;
  mobile: string;
  verificationToken?: string;
  auth?: AuthResponse;
}
