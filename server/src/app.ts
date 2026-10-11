import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { apiV1Router } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { config } from './config/env';

export const createApp = (): Express => {
  const app = express();

  // Security Middleware
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // Body Parsing Middleware
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));

  // Root welcome route
  app.get('/', (req: Request, res: Response) => {
    res.json({
      name: 'BandhanSetu Matrimonial API',
      status: 'active',
      healthCheck: '/api/v1/health',
      documentation: '/docs',
    });
  });

  // Mount API v1
  app.use('/api/v1', apiV1Router);

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
