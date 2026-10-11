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
  status: 'active' | 'pending' | 'suspended';
}
