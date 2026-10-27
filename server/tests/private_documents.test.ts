import { StorageService } from '../src/services/storage.service';
import { safeChartKey } from '../src/services/astrology.service';
import { config } from '../src/config/env';

describe('Private documents and upload rules', () => {
  it('identity + kundli uploads are private (authenticated) purposes only', () => {
    const intent = (purpose: any) =>
      StorageService.generateUploadIntent({ userId: 'u1', purpose, fileName: 'a.jpg', fileType: 'image/jpeg', fileSizeBytes: 1000 });
    expect(intent('identity_document').isPrivate).toBe(true);
    expect(intent('kundli_chart').isPrivate).toBe(true);
    expect(intent('profile_photo').isPrivate).toBe(false);
  });

  it('kundli chart only keeps the owner\'s private key, never a raw URL', () => {
    const own = 'shaadibanao/private/kundli_chart/u1/abc';
    expect(safeChartKey(own, 'u1')).toBe(own);
    expect(safeChartKey(own, 'u2')).toBeUndefined();
    expect(safeChartKey('https://res.cloudinary.com/demo/image/upload/v1/a.jpg', 'u1')).toBeUndefined();
    expect(safeChartKey('https://shaadibanao.onrender.com/media/x.jpg', 'u1')).toBeUndefined();
    expect(safeChartKey(undefined, 'u1')).toBeUndefined();
  });

  it('uploads need Cloudinary (no local-disk fallback)', () => {
    const saved = { ...config.cloudinary };
    config.cloudinary.isConfigured = false as any;
    expect(StorageService.isConfigured()).toBe(false);
    Object.assign(config.cloudinary, saved);
  });
});
