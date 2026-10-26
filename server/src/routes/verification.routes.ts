import { Router, Request, Response, NextFunction } from 'express';
import { VerificationService } from '../services/verification.service';
import { requireAuth } from '../middleware/auth.middleware';
import { StorageService } from '../services/storage.service';
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

    // The key must be a private-vault document uploaded by THIS user (prevents referencing others' files)
    if (
      typeof documentStorageKey !== 'string' ||
      !StorageService.isPrivatePublicId(documentStorageKey) ||
      StorageService.getPrivateOwnerId(documentStorageKey) !== String(userId)
    ) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DOCUMENT',
          message: 'Please upload your identity document first, then submit the request.',
        },
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
