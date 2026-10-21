import { Request, Response, NextFunction } from 'express';
import { TokenService, TokenPayload } from '../services/token.service';
import { AppError } from './errorHandler';

// Extend Express Request type to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(
      'Authentication required. Please provide a valid Bearer token.',
      401,
      'UNAUTHORIZED'
    );
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = TokenService.verifyAccessToken(token);
    payload.id = payload.userId;
    req.user = payload;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Access token has expired. Please refresh your session.', 401, 'TOKEN_EXPIRED');
    }
    throw new AppError('Invalid authentication token.', 401, 'INVALID_TOKEN');
  }
};
