import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { StorageService, MAX_FILE_SIZES } from '../services/storage.service';
import { requireAuth } from '../middleware/auth.middleware';
import { config } from '../config/env';
import { ApiResponse } from '@bandhansetu/shared';

export const storageRouter = Router();

// POST /api/v1/storage/upload-intent (Authenticated)
storageRouter.post('/upload-intent', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { purpose, fileName, fileType, fileSizeBytes } = req.body;
    const userId = (req as any).user.id || (req as any).user.userId;

    if (!purpose || !fileName || !fileType || !fileSizeBytes) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'purpose, fileName, fileType, and fileSizeBytes are required.' },
      });
      return;
    }

    const intent = StorageService.generateUploadIntent({
      userId,
      purpose,
      fileName,
      fileType,
      fileSizeBytes: Number(fileSizeBytes),
    });

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

// POST /api/v1/storage/upload (Upload handler / gateway)
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

    // Extract key metadata
    const parts = key.split('/');
    const folderType = parts[0]; // 'secure-vault' or 'public-media'
    const purpose = parts[1] || 'profile_photo'; // 'profile_photo', 'community_post', 'identity_document', 'kundli_chart'
    const isPrivate = folderType === 'secure-vault' || purpose === 'identity_document' || purpose === 'kundli_chart';
    const fileIdentifier = parts[2] || '';
    const userIdFromKey = fileIdentifier.split('_')[0] || uid || 'member';

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

    // Validate actual file content via magic bytes
    const detectedFormat = StorageService.detectFileFormat(buffer);

    if (purpose === 'profile_photo' || purpose === 'community_post' || purpose === 'public_banner') {
      if (!['jpeg', 'png', 'webp'].includes(detectedFormat)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_FILE_TYPE',
            message: `Invalid file content. Expected JPEG, PNG, or WebP image, but detected '${detectedFormat}'.`,
          },
        });
        return;
      }
    } else if (isPrivate) {
      if (!['jpeg', 'png', 'pdf'].includes(detectedFormat)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_FILE_TYPE',
            message: `Invalid file content. Identity documents must be JPEG, PNG, or PDF, but detected '${detectedFormat}'.`,
          },
        });
        return;
      }
    }

    // STRICT PRIVACY GUARD:
    // Identity verification / Aadhaar documents must NEVER be stored on public Cloudinary URLs!
    if (isPrivate) {
      const uploadsBase = path.resolve(__dirname, '../../uploads');
      const targetFilePath = path.join(uploadsBase, key);
      const targetDir = path.dirname(targetFilePath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.writeFileSync(targetFilePath, buffer);

      res.status(200).json({
        success: true,
        message: 'Identity document secured in private restricted vault successfully.',
        data: {
          fileKey: key,
          isPrivate: true,
          uploadedAt: new Date().toISOString(),
        },
      });
      return;
    }

    // Public Media (Profile photos, Community posts, Public Banners):
    // Upload to Cloudinary if configured; fallback gracefully to local storage if running in offline test environment
    if (config.cloudinary.isConfigured) {
      try {
        let cloudinaryFolder = `shaadibanao/community/${userIdFromKey}`;
        if (purpose === 'profile_photo') {
          cloudinaryFolder = `shaadibanao/profiles/${userIdFromKey}`;
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
        return;
      } catch (cloudErr: any) {
        // Safe sanitization: never expose secret or credentials in error response
        res.status(502).json({
          success: false,
          error: {
            code: 'STORAGE_UPLOAD_FAILED',
            message: `Cloudinary upload failed: ${cloudErr.message || 'Remote gateway error'}`,
          },
        });
        return;
      }
    }

    // Local disk fallback for disconnected / testing environments
    const uploadsBase = path.resolve(__dirname, '../../uploads');
    const targetFilePath = path.join(uploadsBase, key);
    const targetDir = path.dirname(targetFilePath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.writeFileSync(targetFilePath, buffer);

    res.status(200).json({
      success: true,
      message: 'File uploaded and secured successfully.',
      data: {
        fileKey: key,
        url: `/media/${key}`,
        publicId: `local_${key.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    next(error);
  }
});
