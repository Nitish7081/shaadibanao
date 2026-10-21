import { Router, Request, Response, NextFunction } from 'express';
import { VerificationService } from '../services/verification.service';
import { requireAuth } from '../middleware/auth.middleware';
import { ApiResponse } from '@bandhansetu/shared';

export const verificationRouter = Router();

// GET /api/v1/verification/status
verificationRouter.get('/status', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const status = await VerificationService.getUserVerificationStatus(userId);

    const response: ApiResponse = {
      success: true,
      data: status,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/verification/identity
verificationRouter.post('/identity', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { documentType, documentReferenceNumber, documentStorageKey, consentGranted, termsVersion } = req.body;

    if (!documentType || !documentReferenceNumber || !documentStorageKey) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'documentType, documentReferenceNumber, and documentStorageKey are required.' },
      });
      return;
    }

    if (!consentGranted) {
      res.status(400).json({
        success: false,
        error: { code: 'CONSENT_REQUIRED', message: 'Explicit consent is mandatory to process identity verification.' },
      });
      return;
    }

    const result = await VerificationService.submitIdentityVerification({
      userId,
      documentType,
      documentReferenceNumber,
      documentStorageKey,
      consentGranted: !!consentGranted,
      termsVersion,
    });

    const response: ApiResponse = {
      success: true,
      message: result.message,
      data: result,
    };
    res.status(201).json(response);
  } catch (error: any) {
    next(error);
  }
});
