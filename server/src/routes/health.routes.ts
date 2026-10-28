import { isFirebaseServiceAccountConfigured } from '../config/firebase';
import { Router, Request, Response } from 'express';
import { getDbStatus } from '../config/database';
import { config } from '../config/env';
import { StorageService } from '../services/storage.service';
import { ApiResponse, HealthCheckResponse } from '@bandhansetu/shared';

export const healthRouter = Router();

healthRouter.get('/', (req: Request, res: Response) => {
  const dbInfo = getDbStatus();

  // API is "ok" if running; if DB was explicitly configured but is disconnected, status is "degraded"
  const isDegraded = config.mongodbUri !== '' && dbInfo.status === 'disconnected';

  const healthData: HealthCheckResponse = {
    status: isDegraded ? 'degraded' : 'ok',
    service: 'BandhanSetu API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    database: dbInfo,
    environment: config.nodeEnv,
  };

  const response: ApiResponse<HealthCheckResponse> = {
    success: true,
    message: isDegraded
      ? 'BandhanSetu API running with degraded database connectivity'
      : 'BandhanSetu API is healthy and operational',
    data: {
      ...healthData,
      storage: config.cloudinary.isConfigured ? 'configured' : 'missing',
      cloudinary: config.cloudinary.isConfigured ? 'configured' : 'not configured',
      firebaseAdmin: isFirebaseServiceAccountConfigured() ? 'configured' : 'missing',
    } as any,
    meta: {
      timestamp: new Date().toISOString(),
    },
  };

  res.status(200).json(response);
});

/**
 * Storage Health Check: GET /api/v1/health/storage
 * Returns strictly:
 * { cloudinaryConfigured: true/false, reasonCode: "OK" | "MISSING_CLOUD_NAME" | "MISSING_API_KEY" | "MISSING_API_SECRET" | "INIT_FAILED" }
 * Never leaks any secret values or internal details.
 */
healthRouter.get('/storage', (req: Request, res: Response) => {
  const health = StorageService.getHealthStatus();
  res.status(200).json(health);
});
