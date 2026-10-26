import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app';
import { StorageService } from '../src/services/storage.service';
import { AstrologyService } from '../src/services/astrology.service';
import { VerificationService } from '../src/services/verification.service';

const app = createApp();

describe('ShaadiBanao - Modern Matrimony, Astrology & Pandit Services Platform Suite', () => {
  describe('1. Storage & Secure Upload Intent Service', () => {
    it('should generate signed upload intent for profile photo within limits', () => {
      const intent = StorageService.generateUploadIntent({
        userId: 'user_12345',
        purpose: 'profile_photo',
        fileName: 'portrait.jpg',
        fileType: 'image/jpeg',
        fileSizeBytes: 2 * 1024 * 1024,
      });

      expect(intent).toBeDefined();
      expect(intent.uploadUrl).toContain('/api/v1/storage/upload');
      expect(intent.isPrivate).toBe(false);
      // No local-disk fallback anymore: public URL comes from Cloudinary after upload
      expect(intent.publicUrl).toBeUndefined();
      expect(intent.headers['X-Upload-Signature']).toBeDefined();
    });

    it('should mark identity documents as strictly private and not provide publicUrl', () => {
      const intent = StorageService.generateUploadIntent({
        userId: 'user_67890',
        purpose: 'identity_document',
        fileName: 'aadhaar_doc.pdf',
        fileType: 'application/pdf',
        fileSizeBytes: 1 * 1024 * 1024,
      });

      expect(intent.isPrivate).toBe(true);
      expect(intent.publicUrl).toBeUndefined();
      expect(intent.fileKey).toContain('secure-vault');
    });

    it('should reject disallowed file types', () => {
      expect(() => {
        StorageService.generateUploadIntent({
          userId: 'user_123',
          purpose: 'profile_photo',
          fileName: 'script.exe',
          fileType: 'application/x-msdownload',
          fileSizeBytes: 1024,
        });
      }).toThrow('Invalid file type');
    });
  });

  describe('2. Identity Verification & Data Minimization', () => {
    it('should correctly mask Aadhaar / ID number to preserve privacy', () => {
      const masked = VerificationService.maskIdentityNumber('9876 5432 1098');
      expect(masked).toBe('XXXX-XXXX-1098');
    });

    it('should require explicit user consent for identity verification', async () => {
      await expect(
        VerificationService.submitIdentityVerification({
          userId: new mongoose.Types.ObjectId().toString(),
          documentType: 'aadhaar_card',
          documentReferenceNumber: '1234 5678 9012',
          documentStorageKey: 'secure-vault/doc.pdf',
          consentGranted: false,
        })
      ).rejects.toThrow('Explicit consent is required');
    });
  });

  describe('3. Astrology & Ashta Koota (36 Gunas) Calculation', () => {
    it('should accurately calculate Ashta Koota breakdown totaling 36 max points', () => {
      const result = AstrologyService.calculateAshtaKoota(
        'Mesh (Aries)',
        'Ashwini',
        'Simha (Leo)',
        'Magha',
        false,
        false
      );

      expect(result).toBeDefined();
      expect(result.maxScore).toBe(36);
      expect(result.breakdown).toHaveLength(8);

      const kootaNames = result.breakdown.map((b) => b.kootaName);
      expect(kootaNames).toEqual([
        'Varna',
        'Vashya',
        'Tara',
        'Yoni',
        'Graha Maitri',
        'Gana',
        'Bhakoot',
        'Nadi',
      ]);

      expect(result.totalScore).toBeGreaterThanOrEqual(0);
      expect(result.totalScore).toBeLessThanOrEqual(36);
      expect(['Excellent', 'Good', 'Average', 'Not Recommended']).toContain(
        result.compatibilityVerdict
      );
      expect(result.manglikAnalysis.summary).toBeDefined();
    });

    it('should balance Manglik Dosha when both partners are Manglik', () => {
      const result = AstrologyService.calculateAshtaKoota(
        'Kark (Cancer)',
        'Pushya',
        'Vrishchik (Scorpio)',
        'Anuradha',
        true,
        true
      );

      expect(result.manglikAnalysis.manglikMatch).toBe(true);
      expect(result.manglikAnalysis.summary).toContain('mutually cancelled');
    });
  });

  describe('4. HTTP API Endpoints for New Modules', () => {
    it('GET /api/v1/pandits should return list of verified pandits', async () => {
      const res = await request(app).get('/api/v1/pandits');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toBeDefined();
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('GET /api/v1/pandits?ceremonyType=wedding should return wedding and muhurat specialists', async () => {
      const res = await request(app).get('/api/v1/pandits?ceremonyType=wedding');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('POST /api/v1/astrology/match should return valid Ashta Koota calculation', async () => {
      const res = await request(app)
        .post('/api/v1/astrology/match')
        .send({
          boyRashi: 'Mesh (Aries)',
          boyNakshatra: 'Ashwini',
          girlRashi: 'Simha (Leo)',
          girlNakshatra: 'Magha',
          boyManglik: false,
          girlManglik: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalScore).toBeDefined();
      expect(res.body.data.breakdown.length).toBe(8);
    });

    it('GET /api/v1/community/feed should return public approved posts', async () => {
      const res = await request(app).get('/api/v1/community/feed');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('POST /api/v1/storage/upload should reject requests without valid signature', async () => {
      const res = await request(app).post('/api/v1/storage/upload');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_SIGNATURE');
    });
  });
});
