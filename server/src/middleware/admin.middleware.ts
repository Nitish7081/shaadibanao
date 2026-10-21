import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

/**
 * Middleware ensuring the authenticated user possesses the 'admin' role
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    throw new AppError('Authentication required. Please log in as an administrator.', 401, 'UNAUTHORIZED');
  }

  if (req.user.role !== 'admin') {
    throw new AppError(
      'Administrative privileges required. You do not have permission to access this resource.',
      403,
      'FORBIDDEN'
    );
  }

  next();
};
