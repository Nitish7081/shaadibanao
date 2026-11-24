import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { config } from '../config/env';
import { ErrorLogModel } from '../models/error-log.model';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(message: string, statusCode = 400, code = 'BAD_REQUEST', details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  // Handle Zod Validation Errors
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      error: {
        code: 'VALIDATION_ERROR',
        details: err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // Handle custom AppError
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: {
        code: err.code,
        details: err.details,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // Handle SyntaxError (e.g. malformed JSON body)
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      success: false,
      message: 'Malformed JSON payload in request body',
      error: {
        code: 'INVALID_JSON',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // Handle MongoDB Transient Network / Selection Errors
  if (
    err.name === 'MongoServerSelectionError' ||
    err.name === 'MongoNetworkError' ||
    err.name === 'MongoTimeoutError' ||
    err.message?.includes('socket disconnected') ||
    err.message?.includes('ETIMEDOUT')
  ) {
    console.warn('[Database Temporary Network Error]', err.message);
    res.status(503).json({
      success: false,
      message: 'Database connection is temporarily reconnecting. Please retry in a moment.',
      error: {
        code: 'DATABASE_TEMPORARY_UNAVAILABLE',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // Unexpected internal server errors
  const reqId = (req as any).requestId || (req.headers['x-request-id'] as string) || 'unknown';
  console.error(`[Unhandled Server Error] [reqId=${reqId}] [${req.method} ${req.originalUrl}] ${err.name || 'Error'}: ${err.message}`);
  if (!config.isProduction && err.stack) {
    console.error(err.stack);
  }

  // Automatic Error Monitoring Log (Sanitized, no credentials/OTPs/passwords logged)
  try {
    const errorId = `ERR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const originalUrl = req.originalUrl || '';
    const moduleName = originalUrl.includes('/booking')
      ? 'booking'
      : originalUrl.includes('/payment')
      ? 'payment'
      : originalUrl.includes('/pandit')
      ? 'pandit'
      : originalUrl.includes('/chat') || originalUrl.includes('/conversations')
      ? 'chat'
      : originalUrl.includes('/auth')
      ? 'auth'
      : originalUrl.includes('/admin')
      ? 'admin'
      : 'system';

    const cleanEndpoint = originalUrl.split('?')[0];

    if (mongoose.connection.readyState === 1) {
      ErrorLogModel.create({
        errorId,
        module: moduleName,
        errorMessage: err.message || 'Internal Server Error',
        stackTrace: err.stack ? err.stack.slice(0, 2000) : undefined,
        apiEndpoint: cleanEndpoint,
        httpMethod: req.method,
        statusCode: 500,
        severity: err.name?.includes('Mongo') ? 'critical' : 'high',
        userId: (req as any).user?.id || (req as any).user?.userId,
        userRole: (req as any).user?.role,
        clientIp: req.ip,
      }).catch(() => {});
    }
  } catch {
    // Non-blocking error monitoring
  }

  res.status(500).json({
    success: false,
    message: config.isProduction
      ? `An unexpected internal error occurred (Request ID: ${reqId}). Please retry.`
      : err.message || 'Internal Server Error',
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      requestId: reqId,
      ...(config.isProduction ? {} : { stack: err.stack }),
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: reqId,
    },
  });
};
