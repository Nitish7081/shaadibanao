import request from 'supertest';
import { createApp } from '../src/app';
import { StorageService } from '../src/services/storage.service';
import { config } from '../src/config/env';

describe('All Upload Types & Cloudinary Storage Verification Suite', () => {
  const app = createApp();
  const userId = '6ad31f7a8ceb74912950d95d';

  // Sample magic bytes for valid test buffers
  const validJpeg = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]),
    Buffer.alloc(100),
  ]);
  const validPng = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(100),
  ]);
  const validPdf = Buffer.concat([
    Buffer.from('%PDF-1.4\n%test pdf header\n'),
    Buffer.alloc(100),
  ]);
  const invalidHtml = Buffer.from('<html><head><title>Spoof</title></head><body>Fake</body></html>');

  const origCloudinary = { ...config.cloudinary };

  beforeEach(() => {
    config.cloudinary.cloudName = 'test-cloud';
    config.cloudinary.apiKey = 'test-api-key';
    config.cloudinary.apiSecret = 'test-api-secret';
    config.cloudinary.isConfigured = true;
  });

  afterAll(() => {
    Object.assign(config.cloudinary, origCloudinary);
  });

  describe('Upload Types and Destination Routing', () => {
    it('1. Profile photo: authenticated storage in shaadibanao/profiles/:userId, returns signed preview URL', async () => {
      const intent = StorageService.generateUploadIntent({
        userId,
        purpose: 'profile_photo',
        fileName: 'avatar.jpg',
        fileType: 'image/jpeg',
        fileSizeBytes: validJpeg.length,
      });

      const spy = jest.spyOn(StorageService, 'uploadToCloudinary').mockResolvedValueOnce({
        publicId: `shaadibanao/profiles/${userId}/photo_123`,
        secureUrl: `https://res.cloudinary.com/test-cloud/image/authenticated/v1/shaadibanao/profiles/${userId}/photo_123.jpg`,
        format: 'jpg',
        width: 600,
        height: 600,
        bytes: validJpeg.length,
      });

      const res = await request(app)
        .post(intent.uploadUrl)
        .set('Content-Type', 'image/jpeg')
        .send(validJpeg);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(spy).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          folder: `shaadibanao/profiles/${userId}`,
          authenticated: true,
        })
      );
      expect(res.body.data.publicId).toBe(`shaadibanao/profiles/${userId}/photo_123`);
      expect(res.body.data.url).toBeDefined();
      spy.mockRestore();
    });

    it('2. Identity document: authenticated private storage, returns opaque key only (NEVER raw URL)', async () => {
      const intent = StorageService.generateUploadIntent({
        userId,
        purpose: 'identity_document',
        fileName: 'aadhaar.pdf',
        fileType: 'application/pdf',
        fileSizeBytes: validPdf.length,
      });

      const privateKey = `shaadibanao/private/identity_document/${userId}/doc_999`;
      const spy = jest.spyOn(StorageService, 'uploadToCloudinary').mockResolvedValueOnce({
        publicId: privateKey,
        secureUrl: `https://res.cloudinary.com/test-cloud/image/authenticated/v1/${privateKey}.pdf`,
        format: 'pdf',
        width: 800,
        height: 1100,
        bytes: validPdf.length,
      });

      const res = await request(app)
        .post(intent.uploadUrl)
        .set('Content-Type', 'application/pdf')
        .send(validPdf);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(spy).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          folder: `shaadibanao/private/identity_document/${userId}`,
          isPrivate: true,
        })
      );
      // Strictly verify opaque fileKey returned and NO public or secure URL returned
      expect(res.body.data.fileKey).toBe(privateKey);
      expect(res.body.data.isPrivate).toBe(true);
      expect(res.body.data.url).toBeUndefined();
      expect(res.body.data.secureUrl).toBeUndefined();
      spy.mockRestore();
    });

    it('3. Kundli chart: authenticated private storage, returns opaque key only', async () => {
      const intent = StorageService.generateUploadIntent({
        userId,
        purpose: 'kundli_chart',
        fileName: 'chart.png',
        fileType: 'image/png',
        fileSizeBytes: validPng.length,
      });

      const privateKey = `shaadibanao/private/kundli_chart/${userId}/kundli_456`;
      const spy = jest.spyOn(StorageService, 'uploadToCloudinary').mockResolvedValueOnce({
        publicId: privateKey,
        secureUrl: `https://res.cloudinary.com/test-cloud/image/authenticated/v1/${privateKey}.png`,
        format: 'png',
        width: 800,
        height: 800,
        bytes: validPng.length,
      });

      const res = await request(app)
        .post(intent.uploadUrl)
        .set('Content-Type', 'image/png')
        .send(validPng);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(spy).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          folder: `shaadibanao/private/kundli_chart/${userId}`,
          isPrivate: true,
        })
      );
      expect(res.body.data.fileKey).toBe(privateKey);
      expect(res.body.data.isPrivate).toBe(true);
      expect(res.body.data.url).toBeUndefined();
      spy.mockRestore();
    });

    it('4. Community post: public Cloudinary storage in shaadibanao/community/:userId, returns public secureUrl', async () => {
      const intent = StorageService.generateUploadIntent({
        userId,
        purpose: 'community_post',
        fileName: 'wedding_ritual.jpg',
        fileType: 'image/jpeg',
        fileSizeBytes: validJpeg.length,
      });

      const publicUrl = `https://res.cloudinary.com/test-cloud/image/upload/v1/shaadibanao/community/${userId}/post_789.jpg`;
      const spy = jest.spyOn(StorageService, 'uploadToCloudinary').mockResolvedValueOnce({
        publicId: `shaadibanao/community/${userId}/post_789`,
        secureUrl: publicUrl,
        format: 'jpg',
        width: 1080,
        height: 720,
        bytes: validJpeg.length,
      });

      const res = await request(app)
        .post(intent.uploadUrl)
        .set('Content-Type', 'image/jpeg')
        .send(validJpeg);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(spy).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          folder: `shaadibanao/community/${userId}`,
          authenticated: false,
        })
      );
      expect(res.body.data.secureUrl).toBe(publicUrl);
      spy.mockRestore();
    });

    it('5. Admin banner: public Cloudinary storage in shaadibanao/banners, returns public secureUrl', async () => {
      const intent = StorageService.generateUploadIntent({
        userId,
        purpose: 'public_banner',
        fileName: 'navratri_offer.jpg',
        fileType: 'image/jpeg',
        fileSizeBytes: validJpeg.length,
      });

      const bannerUrl = 'https://res.cloudinary.com/test-cloud/image/upload/v1/shaadibanao/banners/banner_001.jpg';
      const spy = jest.spyOn(StorageService, 'uploadToCloudinary').mockResolvedValueOnce({
        publicId: 'shaadibanao/banners/banner_001',
        secureUrl: bannerUrl,
        format: 'jpg',
        width: 1200,
        height: 400,
        bytes: validJpeg.length,
      });

      const res = await request(app)
        .post(intent.uploadUrl)
        .set('Content-Type', 'image/jpeg')
        .send(validJpeg);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(spy).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          folder: 'shaadibanao/banners',
          authenticated: false,
        })
      );
      expect(res.body.data.secureUrl).toBe(bannerUrl);
      spy.mockRestore();
    });

    it('6. JSON base64 upload flow (mobile app format)', async () => {
      const intent = StorageService.generateUploadIntent({
        userId,
        purpose: 'profile_photo',
        fileName: 'mobile_avatar.jpg',
        fileType: 'image/jpeg',
        fileSizeBytes: validJpeg.length,
      });

      const spy = jest.spyOn(StorageService, 'uploadToCloudinary').mockResolvedValueOnce({
        publicId: `shaadibanao/profiles/${userId}/photo_mobile`,
        secureUrl: `https://res.cloudinary.com/test-cloud/image/authenticated/v1/shaadibanao/profiles/${userId}/photo_mobile.jpg`,
        format: 'jpg',
        width: 400,
        height: 400,
        bytes: validJpeg.length,
      });

      const res = await request(app)
        .post(intent.uploadUrl)
        .send({ base64: validJpeg.toString('base64') });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.publicId).toBe(`shaadibanao/profiles/${userId}/photo_mobile`);
      spy.mockRestore();
    });
  });

  describe('Validation & Security Guards', () => {
    it('rejects spoofed file content (e.g. HTML disguised as JPEG) with INVALID_FILE_TYPE', async () => {
      const intent = StorageService.generateUploadIntent({
        userId,
        purpose: 'profile_photo',
        fileName: 'avatar.jpg',
        fileType: 'image/jpeg',
        fileSizeBytes: invalidHtml.length,
      });

      const res = await request(app)
        .post(intent.uploadUrl)
        .set('Content-Type', 'image/jpeg')
        .send(invalidHtml);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_FILE_TYPE');
    });

    it('rejects oversized photos (> 5MB) at intent generation and at upload handler with FILE_TOO_LARGE', async () => {
      // 1. Intent size check
      expect(() => {
        StorageService.generateUploadIntent({
          userId,
          purpose: 'profile_photo',
          fileName: 'huge.jpg',
          fileType: 'image/jpeg',
          fileSizeBytes: 6 * 1024 * 1024,
        });
      }).toThrow(/exceeds limit/);

      // 2. Upload handler size check (if client sends more bytes than declared)
      const validIntent = StorageService.generateUploadIntent({
        userId,
        purpose: 'profile_photo',
        fileName: 'photo.jpg',
        fileType: 'image/jpeg',
        fileSizeBytes: 1000,
      });

      const oversized = Buffer.concat([
        Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]),
        Buffer.alloc(5 * 1024 * 1024 + 1024),
      ]);

      const res = await request(app)
        .post(validIntent.uploadUrl)
        .set('Content-Type', 'image/jpeg')
        .send(oversized);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FILE_TOO_LARGE');
    });

    it('rejects tampered upload signature with FORBIDDEN', async () => {
      const intent = StorageService.generateUploadIntent({
        userId,
        purpose: 'profile_photo',
        fileName: 'photo.jpg',
        fileType: 'image/jpeg',
        fileSizeBytes: validJpeg.length,
      });

      const tamperedUrl = intent.uploadUrl.replace(/sig=[a-f0-9]{10}/, 'sig=ffffffffff');
      const res = await request(app)
        .post(tamperedUrl)
        .set('Content-Type', 'image/jpeg')
        .send(validJpeg);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('rejects upload when Cloudinary is not configured with STORAGE_NOT_CONFIGURED', async () => {
      config.cloudinary.isConfigured = false;

      const intent = StorageService.generateUploadIntent({
        userId,
        purpose: 'profile_photo',
        fileName: 'photo.jpg',
        fileType: 'image/jpeg',
        fileSizeBytes: validJpeg.length,
      });

      const res = await request(app)
        .post(intent.uploadUrl)
        .set('Content-Type', 'image/jpeg')
        .send(validJpeg);

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('STORAGE_NOT_CONFIGURED');
    });
  });
});
