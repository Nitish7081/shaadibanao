import express, { Express, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import helmet from 'helmet';
import { apiV1Router } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { config } from './config/env';
import { StorageService } from './services/storage.service';
import { apiGeneralLimiter, sensitiveEndpointLimiter } from './middleware/rateLimiter';

export const createApp = (): Express => {
  const app = express();

  // Production reverse-proxy support (Nginx, Cloudflare, AWS ALB)
  app.set('trust proxy', 1);

  // Request ID tracking for observability and error correlation
  app.use((req: Request, res: Response, next: NextFunction) => {
    const rawReqId = req.headers['x-request-id'];
    const reqId = (typeof rawReqId === 'string' && rawReqId.trim())
      ? rawReqId.trim().slice(0, 64)
      : `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
    (req as any).requestId = reqId;
    res.setHeader('X-Request-Id', reqId);
    next();
  });

  // Security Middleware with custom CSP to permit Cloudinary media, Google Fonts, and Admin interactions
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          scriptSrcAttr: ["'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: [
            "'self'",
            'data:',
            'blob:',
            'https://res.cloudinary.com',
            'https://*.cloudinary.com',
            'https://images.unsplash.com',
          ],
          connectSrc: ["'self'", 'https://res.cloudinary.com', 'https://api.cloudinary.com', 'ws:', 'wss:'],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );
  app.use(
    cors({
      origin:
        config.nodeEnv === 'development' || config.corsOrigins.includes('*')
          ? true
          : config.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Upload-Signature'],
    })
  );

  // Body Parsing Middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(express.raw({ type: ['image/*', 'application/pdf', 'application/octet-stream'], limit: '15mb' }));

  // Root welcome route
  app.get('/', (req: Request, res: Response) => {
    res.json({
      name: 'BandhanSetu Matrimonial API',
      status: 'active',
      healthCheck: '/api/v1/health',
      documentation: '/docs',
    });
  });

  // Storage health check (root-level alias)
  app.get('/health/storage', (req: Request, res: Response) => {
    const health = StorageService.getHealthStatus();
    res.status(200).json(health);
  });

  // Sensitive endpoint rate limiting
  app.use('/api/v1/auth', sensitiveEndpointLimiter);
  app.use('/api/v1/storage/upload', sensitiveEndpointLimiter);
  app.use('/api/v1/admin/login', sensitiveEndpointLimiter);
  app.use('/api/v1', apiGeneralLimiter);

  // Mount API v1
  app.use('/api/v1', apiV1Router);

  // Strict Privacy Guard: Private vault files (e.g. Aadhaar, passport) MUST NEVER be served statically
  app.use('/media', (req: Request, res: Response, next: NextFunction) => {
    if (
      req.path.includes('secure-vault') ||
      req.path.includes('identity_document') ||
      req.path.includes('kundli_chart')
    ) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Direct public access to confidential identity documents is strictly forbidden.',
        },
      });
    }
    next();
  });

  // LEGACY read-only: serves files already on disk from before the Cloudinary migration.
  // The server never writes here anymore. Remove once scripts/migrate-local-uploads-to-cloudinary.ts is applied.
  const mediaPath = path.resolve(__dirname, '../uploads');
  if (fs.existsSync(mediaPath)) {
    app.use('/media', express.static(mediaPath));
  }

  // Serve Admin Web Panel
  const adminStaticPath = path.resolve(__dirname, '../public/admin');
  app.get(['/admin', '/admin/'], (req: Request, res: Response) => {
    res.sendFile(path.join(adminStaticPath, 'index.html'));
  });
  app.use('/admin', express.static(adminStaticPath));
  app.get('/admin/*', (req: Request, res: Response) => {
    res.sendFile(path.join(adminStaticPath, 'index.html'));
  });

  // 404 Not Found Catch-All
  app.use('*', (req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      message: `Cannot ${req.method} ${req.originalUrl}`,
      error: {
        code: 'ROUTE_NOT_FOUND',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
};
