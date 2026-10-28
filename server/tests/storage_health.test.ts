import request from 'supertest';
import { createApp } from '../src/app';
import { config } from '../src/config/env';
import { StorageService } from '../src/services/storage.service';
import { en } from '../../apps/mobile/src/i18n/locales/en';
import { hi } from '../../apps/mobile/src/i18n/locales/hi';

describe('Storage Health and Cloudinary Status Check Suite', () => {
  const app = createApp();

  describe('GET /health/storage and GET /api/v1/health/storage', () => {
    it('GET /health/storage should return 200 with strictly cloudinaryConfigured and reasonCode only', async () => {
      const res = await request(app).get('/health/storage');
      expect(res.status).toBe(200);

      // Verify shape strictly
      expect(typeof res.body.cloudinaryConfigured).toBe('boolean');
      expect(['OK', 'MISSING_CLOUD_NAME', 'MISSING_API_KEY', 'MISSING_API_SECRET', 'INIT_FAILED']).toContain(
        res.body.reasonCode
      );

      // Enforce: ONLY cloudinaryConfigured and reasonCode in the response
      const keys = Object.keys(res.body).sort();
      expect(keys).toEqual(['cloudinaryConfigured', 'reasonCode'].sort());

      // Absolute security guard: verify secrets never leak
      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain('apiKey');
      expect(bodyStr).not.toContain('apiSecret');
      expect(bodyStr).not.toContain('cloudName');
    });

    it('GET /api/v1/health/storage should return identical schema at versioned path', async () => {
      const res = await request(app).get('/api/v1/health/storage');
      expect(res.status).toBe(200);

      expect(typeof res.body.cloudinaryConfigured).toBe('boolean');
      expect(['OK', 'MISSING_CLOUD_NAME', 'MISSING_API_KEY', 'MISSING_API_SECRET', 'INIT_FAILED']).toContain(
        res.body.reasonCode
      );

      const keys = Object.keys(res.body).sort();
      expect(keys).toEqual(['cloudinaryConfigured', 'reasonCode'].sort());
    });
  });

  describe('StorageService.getHealthStatus unit tests', () => {
    const origCloud = { ...config.cloudinary };

    afterEach(() => {
      Object.assign(config.cloudinary, origCloud);
    });

    it('returns MISSING_CLOUD_NAME when cloudName is empty', () => {
      config.cloudinary.cloudName = '';
      config.cloudinary.apiKey = 'test_key';
      config.cloudinary.apiSecret = 'test_secret';
      config.cloudinary.isConfigured = false;

      const health = StorageService.getHealthStatus();
      expect(health).toEqual({
        cloudinaryConfigured: false,
        reasonCode: 'MISSING_CLOUD_NAME',
      });
    });

    it('returns MISSING_API_KEY when apiKey is empty', () => {
      config.cloudinary.cloudName = 'test_cloud';
      config.cloudinary.apiKey = '';
      config.cloudinary.apiSecret = 'test_secret';
      config.cloudinary.isConfigured = false;

      const health = StorageService.getHealthStatus();
      expect(health).toEqual({
        cloudinaryConfigured: false,
        reasonCode: 'MISSING_API_KEY',
      });
    });

    it('returns MISSING_API_SECRET when apiSecret is empty', () => {
      config.cloudinary.cloudName = 'test_cloud';
      config.cloudinary.apiKey = 'test_key';
      config.cloudinary.apiSecret = '';
      config.cloudinary.isConfigured = false;

      const health = StorageService.getHealthStatus();
      expect(health).toEqual({
        cloudinaryConfigured: false,
        reasonCode: 'MISSING_API_SECRET',
      });
    });

    it('returns OK when all Cloudinary credentials are set and configured', () => {
      config.cloudinary.cloudName = 'test_cloud';
      config.cloudinary.apiKey = 'test_key';
      config.cloudinary.apiSecret = 'test_secret';
      config.cloudinary.isConfigured = true;

      const health = StorageService.getHealthStatus();
      expect(health).toEqual({
        cloudinaryConfigured: true,
        reasonCode: 'OK',
      });
    });

    it('logStartupStatus logs safely without printing secrets', () => {
      const logs: string[] = [];
      const origLog = console.log;
      console.log = (...args: any[]) => logs.push(args.join(' '));

      try {
        config.cloudinary.cloudName = 'test_cloud_name_secret';
        config.cloudinary.apiKey = 'test_api_key_secret';
        config.cloudinary.apiSecret = 'test_api_secret_val';
        config.cloudinary.isConfigured = true;

        StorageService.logStartupStatus();

        const combined = logs.join('\n');
        expect(combined).not.toContain('test_cloud_name_secret');
        expect(combined).not.toContain('test_api_key_secret');
        expect(combined).not.toContain('test_api_secret_val');
        expect(combined).toContain('cloud name: set');
      } finally {
        console.log = origLog;
      }
    });
  });

  describe('Mobile Upload Error Bilingual Translations in Locales', () => {
    it('has complete English and Hindi translations for all specific upload failure types', () => {
      const keys = [
        'storageNotConfigured',
        'networkError',
        'fileTooLarge',
        'unsupportedType',
        'uploadFailed',
      ] as const;

      for (const k of keys) {
        expect((en.errors as any)[k]).toBeDefined();
        expect(typeof (en.errors as any)[k]).toBe('string');
        expect((en.errors as any)[k].length).toBeGreaterThan(5);

        expect((hi.errors as any)[k]).toBeDefined();
        expect(typeof (hi.errors as any)[k]).toBe('string');
        expect((hi.errors as any)[k].length).toBeGreaterThan(5);
      }
    });
  });
});
