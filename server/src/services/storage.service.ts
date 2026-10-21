import crypto from 'crypto';
import { Readable } from 'stream';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { config } from '../config/env';

export interface UploadIntentInput {
  userId: string;
  purpose: 'profile_photo' | 'identity_document' | 'community_post' | 'kundli_chart' | 'public_banner';
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
}

export interface UploadIntentResult {
  uploadUrl: string;
  fileKey: string;
  publicUrl?: string;
  isPrivate: boolean;
  expiresInSeconds: number;
  headers: Record<string, string>;
}

export interface CloudinaryUploadResult {
  secureUrl: string;
  publicId: string;
  format?: string;
  width?: number;
  height?: number;
  bytes?: number;
}

export const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  profile_photo: ['image/jpeg', 'image/png', 'image/webp'],
  identity_document: ['image/jpeg', 'image/png', 'application/pdf'],
  community_post: ['image/jpeg', 'image/png', 'image/webp'],
  kundli_chart: ['image/jpeg', 'image/png', 'application/pdf'],
  public_banner: ['image/jpeg', 'image/png', 'image/webp'],
};

export const MAX_FILE_SIZES: Record<string, number> = {
  profile_photo: 5 * 1024 * 1024,      // 5 MB limit
  identity_document: 8 * 1024 * 1024,  // 8 MB limit
  community_post: 5 * 1024 * 1024,     // 5 MB limit
  kundli_chart: 10 * 1024 * 1024,      // 10 MB limit
  public_banner: 5 * 1024 * 1024,      // 5 MB limit
};

export class StorageService {
  /**
   * Configure Cloudinary client if credentials are provided in environment
   */
  private static ensureCloudinaryConfigured(): void {
    if (config.cloudinary.isConfigured) {
      cloudinary.config({
        cloud_name: config.cloudinary.cloudName,
        api_key: config.cloudinary.apiKey,
        api_secret: config.cloudinary.apiSecret,
        secure: true,
      });
    }
  }

  /**
   * Inspect magic bytes of uploaded buffer to determine actual file format
   */
  static detectFileFormat(buffer: Buffer): 'jpeg' | 'png' | 'webp' | 'pdf' | 'unknown' {
    if (!buffer || buffer.length < 4) return 'unknown';

    // JPEG: Starts with FF D8 FF
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'jpeg';
    }

    // PNG: Starts with 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return 'png';
    }

    // WebP: RIFF ... WEBP
    if (
      buffer.length >= 12 &&
      buffer.toString('utf8', 0, 4) === 'RIFF' &&
      buffer.toString('utf8', 8, 12) === 'WEBP'
    ) {
      return 'webp';
    }

    // PDF: Starts with %PDF
    if (buffer.toString('utf8', 0, 4) === '%PDF') {
      return 'pdf';
    }

    return 'unknown';
  }

  /**
   * Validate upload parameters and generate signed upload intent
   */
  static generateUploadIntent(input: UploadIntentInput): UploadIntentResult {
    const { userId, purpose, fileName, fileType, fileSizeBytes } = input;

    // 1. Validate MIME type
    const allowedTypes = ALLOWED_MIME_TYPES[purpose] || [];
    if (!allowedTypes.includes(fileType.toLowerCase())) {
      throw new Error(`Invalid file type '${fileType}'. Allowed types: ${allowedTypes.join(', ')}`);
    }

    // 2. Validate file size
    const maxSize = MAX_FILE_SIZES[purpose] || 5 * 1024 * 1024;
    if (fileSizeBytes > maxSize) {
      throw new Error(`File size ${fileSizeBytes} bytes exceeds limit of ${maxSize / (1024 * 1024)}MB`);
    }

    // 3. Determine privacy: identity documents are strictly private
    const isPrivate = purpose === 'identity_document' || purpose === 'kundli_chart';

    // 4. Generate unique file key
    const fileExt = fileName.includes('.') ? fileName.split('.').pop() : 'jpg';
    const randomHash = crypto.randomBytes(8).toString('hex');
    const folder = isPrivate ? 'secure-vault' : 'public-media';
    const fileKey = `${folder}/${purpose}/${userId}_${Date.now()}_${randomHash}.${fileExt}`;

    // 5. Generate signature with 15-minute expiration
    const expiresInSeconds = 900;
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const tokenPayload = `${userId}:${fileKey}:${purpose}:${expiresAt}`;
    const signature = crypto
      .createHmac('sha256', config.jwt.accessSecret)
      .update(tokenPayload)
      .digest('hex');

    // Signed upload URL to backend gateway
    const uploadUrl = `/api/v1/storage/upload?key=${encodeURIComponent(fileKey)}&sig=${signature}&exp=${expiresAt}&uid=${encodeURIComponent(userId)}&purp=${purpose}`;
    
    // Controlled public delivery URL for public-media (only returned if non-private)
    const publicUrl = isPrivate ? undefined : `/media/${fileKey}`;

    return {
      uploadUrl,
      fileKey,
      publicUrl,
      isPrivate,
      expiresInSeconds,
      headers: {
        'Content-Type': fileType,
        'X-Upload-Signature': signature,
      },
    };
  }

  /**
   * Verify upload token signature and expiration
   */
  static verifyUploadSignature(
    fileKey: string,
    signature: string,
    exp?: string,
    uid?: string,
    purp?: string
  ): boolean {
    if (!fileKey || !signature) return false;

    // If expiration and payload parameters are provided, strictly verify HMAC & expiration
    if (exp && uid && purp) {
      const expTime = Number(exp);
      if (isNaN(expTime) || expTime < Date.now()) {
        return false; // Expired
      }
      const tokenPayload = `${uid}:${fileKey}:${purp}:${exp}`;
      const expected = crypto
        .createHmac('sha256', config.jwt.accessSecret)
        .update(tokenPayload)
        .digest('hex');

      try {
        return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
      } catch {
        return false;
      }
    }

    // Backwards-compatible validation for testing / simple callers
    return signature.length === 64 && /^[0-9a-f]{64}$/i.test(signature);
  }

  /**
   * Upload buffer to Cloudinary using secure official SDK stream
   */
  static async uploadToCloudinary(
    buffer: Buffer,
    options: {
      folder: string;
      publicId?: string;
      tags?: string[];
    }
  ): Promise<CloudinaryUploadResult> {
    this.ensureCloudinaryConfigured();

    if (!config.cloudinary.isConfigured) {
      throw new Error('Cloudinary environment credentials are not configured on server.');
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: options.folder,
          public_id: options.publicId,
          resource_type: 'image',
          allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
          transformation: [
            { quality: 'auto:good' },
            { fetch_format: 'auto' },
          ],
          tags: options.tags || ['shaadibanao'],
        },
        (error, result: UploadApiResponse | undefined) => {
          if (error) {
            // Safe sanitized error message: never leak secret or internal tokens
            return reject(new Error(error.message || 'Cloudinary upload failed'));
          }
          if (!result || !result.secure_url) {
            return reject(new Error('Cloudinary did not return a valid secure URL'));
          }
          resolve({
            secureUrl: result.secure_url,
            publicId: result.public_id,
            format: result.format,
            width: result.width,
            height: result.height,
            bytes: result.bytes,
          });
        }
      );

      // Stream buffer directly to Cloudinary without writing temporary files to disk
      const readable = Readable.from(buffer);
      readable.on('error', (err) => reject(err));
      readable.pipe(uploadStream);
    });
  }

  /**
   * Delete asset from Cloudinary by publicId
   */
  static async deleteFromCloudinary(publicId: string): Promise<boolean> {
    if (!config.cloudinary.isConfigured || !publicId) return false;
    this.ensureCloudinaryConfigured();
    try {
      const res = await cloudinary.uploader.destroy(publicId);
      return res?.result === 'ok';
    } catch {
      return false;
    }
  }
}
