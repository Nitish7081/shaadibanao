import { Router, Request, Response, NextFunction } from 'express';
import { StorageService, MAX_FILE_SIZES } from '../services/storage.service';
import { requireAuth } from '../middleware/auth.middleware';
import { ApiResponse } from '@bandhansetu/shared';

export const storageRouter = Router();

const PRIVATE_PURPOSES = ['identity_document', 'kundli_chart'];

function storageNotConfigured(res: Response): void {
  res.status(503).json({
    success: false,
    message: 'Image storage is not available right now. Please try again later.',
    error: {
      code: 'STORAGE_NOT_CONFIGURED',
      message: 'Cloudinary is not configured on the server. Uploads are disabled (no local-disk fallback).',
    },
  });
}

// POST /api/v1/storage/upload-intent (Authenticated)
storageRouter.post('/upload-intent', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!StorageService.isConfigured()) {
      storageNotConfigured(res);
      return;
    }

    const { purpose, fileName, fileType, fileSizeBytes } = req.body;
    const userId = (req as any).user.id || (req as any).user.userId;

    if (!purpose || !fileName || !fileType || !fileSizeBytes) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'purpose, fileName, fileType, and fileSizeBytes are required.' },
      });
      return;
    }

    let intent;
    try {
      intent = StorageService.generateUploadIntent({
        userId,
        purpose,
        fileName,
        fileType,
        fileSizeBytes: Number(fileSizeBytes),
      });
    } catch (validationErr: any) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_UPLOAD', message: validationErr.message },
      });
      return;
    }

    const response: ApiResponse = {
      success: true,
      message: 'Upload intent generated successfully.',
      data: intent,
    };
    res.status(200).json(response);
  } catch (error: any) {
    next(error);
  }
});

// POST /api/v1/storage/upload (signed upload gateway -> Cloudinary only)
storageRouter.post('/upload', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const key = req.query.key as string;
    const sig = req.query.sig as string;
    const exp = req.query.exp as string | undefined;
    const uid = req.query.uid as string | undefined;
    const purp = req.query.purp as string | undefined;

    if (!key || !sig) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_SIGNATURE', message: 'Missing key or signature parameters.' },
      });
      return;
    }

    const isValid = StorageService.verifyUploadSignature(key, sig, exp, uid, purp);
    if (!isValid) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Upload signature verification failed or intent expired.' },
      });
      return;
    }

    if (!StorageService.isConfigured()) {
      console.error('[Storage] Upload rejected: Cloudinary is not configured (code=STORAGE_NOT_CONFIGURED).');
      storageNotConfigured(res);
      return;
    }

    // purpose and uid come from the SIGNED query (tamper-proof), not from client-controlled data
    const purpose = purp as string;
    const ownerId = uid as string;
    const isPrivate = PRIVATE_PURPOSES.includes(purpose);

    // Extract file buffer from request body
    let buffer: Buffer | null = null;
    if (Buffer.isBuffer(req.body) && req.body.length > 0) {
      buffer = req.body;
    } else if (typeof req.body === 'object' && req.body?.base64) {
      let rawBase64 = String(req.body.base64);
      if (rawBase64.includes(';base64,')) {
        rawBase64 = rawBase64.split(';base64,').pop() || '';
      }
      buffer = Buffer.from(rawBase64, 'base64');
    }

    if (!buffer || buffer.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'EMPTY_PAYLOAD', message: 'No image or document payload provided.' },
      });
      return;
    }

    // Validate size against max limits
    const maxSize = MAX_FILE_SIZES[purpose] || 5 * 1024 * 1024;
    if (buffer.length > maxSize) {
      res.status(400).json({
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: `File size ${buffer.length} bytes exceeds allowed limit of ${maxSize / (1024 * 1024)}MB.`,
        },
      });
      return;
    }

    // Validate actual file content via magic bytes (never trust the client-declared type)
    const detectedFormat = StorageService.detectFileFormat(buffer);
    const allowedFormats = isPrivate ? ['jpeg', 'png', 'pdf'] : ['jpeg', 'png', 'webp'];
    if (!allowedFormats.includes(detectedFormat)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: `Invalid file content. Allowed: ${allowedFormats.join(', ').toUpperCase()}, but detected '${detectedFormat}'.`,
        },
      });
      return;
    }

    try {
      // ---------- PRIVATE: identity & kundli files -> Cloudinary "authenticated" ----------
      if (isPrivate) {
        const cloudResult = await StorageService.uploadToCloudinary(buffer, {
          folder: `${StorageService.PRIVATE_PREFIX}${purpose}/${ownerId}`,
          tags: ['shaadibanao', 'private', purpose],
          isPrivate: true,
        });

        // NEVER return the raw Cloudinary URL for private files; only the opaque key
        res.status(200).json({
          success: true,
          message: 'Document stored securely in the private vault.',
          data: {
            fileKey: cloudResult.publicId,
            isPrivate: true,
            uploadedAt: new Date().toISOString(),
          },
        });
        return;
      }

      // ---------- PUBLIC: profile photos, community posts, banners -> Cloudinary public ----------
      let cloudinaryFolder = `shaadibanao/community/${ownerId}`;
      if (purpose === 'profile_photo') {
        cloudinaryFolder = `shaadibanao/profiles/${ownerId}`;
      } else if (purpose === 'public_banner') {
        cloudinaryFolder = 'shaadibanao/banners';
      }

      const cloudResult = await StorageService.uploadToCloudinary(buffer, {
        folder: cloudinaryFolder,
        tags: ['shaadibanao', purpose],
      });

      res.status(200).json({
        success: true,
        message: 'Photo uploaded and secured in Cloudinary successfully.',
        data: {
          fileKey: key,
          url: cloudResult.secureUrl,
          publicId: cloudResult.publicId,
          secureUrl: cloudResult.secureUrl,
          format: cloudResult.format,
          width: cloudResult.width,
          height: cloudResult.height,
          bytes: cloudResult.bytes,
          uploadedAt: new Date().toISOString(),
        },
      });
    } catch (cloudErr: any) {
      // Log code + purpose only. Never log file content, URLs or document numbers.
      console.error(`[Storage] Cloudinary upload failed (code=STORAGE_UPLOAD_FAILED, purpose=${purpose}, private=${isPrivate}).`);
      res.status(502).json({
        success: false,
        error: {
          code: 'STORAGE_UPLOAD_FAILED',
          message: `Cloudinary upload failed: ${cloudErr.message || 'Remote gateway error'}`,
        },
      });
    }
  } catch (error: any) {
    next(error);
  }
});

// POST /api/v1/storage/private-url (Authenticated: owner or admin/moderator only)
// Returns a short-lived (10 min) signed URL for a private identity/kundli file.
storageRouter.post('/private-url', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { key } = req.body || {};
    const user = (req as any).user;
    const userId = String(user.id || user.userId);

    if (!key || typeof key !== 'string' || !StorageService.isPrivatePublicId(key)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_KEY', message: 'A valid private document key is required.' },
      });
      return;
    }

    const ownerId = StorageService.getPrivateOwnerId(key);
    const isStaff = user.role === 'admin' || user.role === 'moderator';
    if (!isStaff && ownerId !== userId) {
      console.warn(`[Storage] Private URL denied (code=FORBIDDEN, user=${userId}).`);
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have access to this document.' },
      });
      return;
    }

    if (!StorageService.isConfigured()) {
      storageNotConfigured(res);
      return;
    }

    try {
      const signed = await StorageService.getSignedPrivateUrl(key, 600);
      console.info(`[Storage] Private URL issued (user=${userId}, staff=${isStaff}).`);
      res.status(200).json({
        success: true,
        data: { url: signed.url, expiresInSeconds: signed.expiresInSeconds },
      });
    } catch {
      res.status(404).json({
        success: false,
        error: { code: 'DOCUMENT_NOT_FOUND', message: 'The requested document could not be found.' },
      });
    }
  } catch (error: any) {
    next(error);
  }
});
