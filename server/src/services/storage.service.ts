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
    
    // Public delivery URL is the Cloudinary secure_url returned AFTER upload (never a local /media path)
    const publicUrl = undefined;

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
    // Signature, expiry, user and purpose are ALL mandatory (no legacy "any 64-hex string" bypass)
    if (!fileKey || !signature || !exp || !uid || !purp) return false;

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

  /** True when Cloudinary credentials are present. Uploads must never fall back to local disk. */
  static isConfigured(): boolean {
    return config.cloudinary.isConfigured;
  }

  /** Logs storage readiness once at startup. Never prints secrets. */
  static logStartupStatus(): void {
    if (config.cloudinary.isConfigured) {
      console.log(`[Storage] Cloudinary configured (cloud: ${config.cloudinary.cloudName}). All uploads go to Cloudinary.`);
    } else {
      console.error(
        '[Storage] CLOUDINARY NOT CONFIGURED: set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET. ' +
          'Image uploads will be rejected with STORAGE_NOT_CONFIGURED (no local-disk fallback).'
      );
    }
  }

  /** Private (authenticated) assets live under this prefix: shaadibanao/private/<purpose>/<userId>/<id> */
  static readonly PRIVATE_PREFIX = 'shaadibanao/private/';

  static isPrivatePublicId(publicId: string): boolean {
    return typeof publicId === 'string' && publicId.startsWith(StorageService.PRIVATE_PREFIX);
  }

  /** Owner user id is encoded in the private public_id, so no extra DB field is needed. */
  static getPrivateOwnerId(publicId: string): string | null {
    if (!StorageService.isPrivatePublicId(publicId)) return null;
    const parts = publicId.split('/');
    return parts[3] || null;
  }

  /**
   * Create a short-lived (default 10 min) signed download URL for a PRIVATE asset.
   * Callers MUST have authorised the request (owner or admin) before calling this.
   * The URL and public_id are never logged.
   */
  static async getSignedPrivateUrl(publicId: string, ttlSeconds = 600): Promise<{ url: string; expiresInSeconds: number }> {
    this.ensureCloudinaryConfigured();
    if (!config.cloudinary.isConfigured) {
      throw new Error('Cloudinary environment credentials are not configured on server.');
    }
    if (!StorageService.isPrivatePublicId(publicId)) {
      throw new Error('Not a private asset.');
    }
    const resource: any = await cloudinary.api.resource(publicId, { type: 'authenticated', resource_type: 'image' });
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    const url = cloudinary.utils.private_download_url(publicId, resource.format, {
      type: 'authenticated',
      resource_type: 'image',
      expires_at: expiresAt,
      attachment: false,
    });
    return { url, expiresInSeconds: ttlSeconds };
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
      /** true => Cloudinary type "authenticated" (not publicly reachable; signed URL required) */
      isPrivate?: boolean;
    }
  ): Promise<CloudinaryUploadResult> {
    this.ensureCloudinaryConfigured();

    if (!config.cloudinary.isConfigured) {
      throw new Error('Cloudinary environment credentials are not configured on server.');
    }

    const isPrivate = options.isPrivate === true;

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: options.folder,
          public_id: options.publicId,
          resource_type: 'image',
          type: isPrivate ? 'authenticated' : 'upload',
          allowed_formats: isPrivate ? ['jpg', 'jpeg', 'png', 'pdf'] : ['jpg', 'jpeg', 'png', 'webp'],
          // Private documents are stored untouched; public images get auto quality/format
          ...(isPrivate
            ? {}
            : { transformation: [{ quality: 'auto:good' }, { fetch_format: 'auto' }] }),
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
