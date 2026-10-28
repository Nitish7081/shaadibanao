import { Router, Request, Response } from 'express';
import { getDbStatus } from '../config/database';
import { config } from '../config/env';
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
    } as any,
    meta: {
      timestamp: new Date().toISOString(),
    },
  };

  res.status(200).json(response);
});
