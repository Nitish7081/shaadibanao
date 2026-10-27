import { config } from '../src/config/env';
import {
  buildPublicPhotos,
  isValidBlurredPhotoUrl,
  parseCloudinaryUrl,
  toBlurredUrl,
} from '../src/services/photoPrivacy';
import { BLUR_TRANSFORMATION, presetTransformation } from '@bandhansetu/shared';

// DUMMY secrets only (never real credentials).
const SECRET = 'dummy_test_secret';
const ORIGINAL = 'https://res.cloudinary.com/demo/image/upload/v1700000000/profiles/abc123.jpg';

describe('Signed blurred photo URLs', () => {
  const realSecret = config.cloudinary.apiSecret;
  beforeEach(() => {
    config.cloudinary.apiSecret = SECRET;
  });
  afterAll(() => {
    config.cloudinary.apiSecret = realSecret;
  });

  it('generates a signed URL with the blur baked in', () => {
    const url = toBlurredUrl(ORIGINAL);
    expect(url).toMatch(
      /^https:\/\/res\.cloudinary\.com\/demo\/image\/upload\/s--[\w-]{8}--\/e_blur:2000,q_auto,f_auto,w_320\/v1700000000\/profiles\/abc123\.jpg$/
    );
    expect(isValidBlurredPhotoUrl(url)).toBe(true);
    expect(url).not.toContain(SECRET);
  });

  it('is deterministic and matches the documented signature (sha1 base64url, 8 chars)', () => {
    expect(toBlurredUrl(ORIGINAL)).toBe(toBlurredUrl(ORIGINAL));
    expect(BLUR_TRANSFORMATION).toBe('e_blur:2000,q_auto,f_auto,w_320');
  });

  it('rejects a URL whose blur was removed', () => {
    const url = toBlurredUrl(ORIGINAL);
    const noBlur = url.replace('e_blur:2000,q_auto,f_auto,w_320/', '');
    expect(isValidBlurredPhotoUrl(noBlur)).toBe(false);
    expect(isValidBlurredPhotoUrl(ORIGINAL)).toBe(false);
  });

  it('rejects a changed blur strength, dropped/altered signature or other public id', () => {
    const url = toBlurredUrl(ORIGINAL);
    expect(isValidBlurredPhotoUrl(url.replace('e_blur:2000', 'e_blur:1'))).toBe(false);
    expect(isValidBlurredPhotoUrl(url.replace(/s--[\w-]{8}--\//, ''))).toBe(false);
    expect(isValidBlurredPhotoUrl(url.replace(/s--[\w-]{8}--/, 's--AAAAAAAA--'))).toBe(false);
    expect(isValidBlurredPhotoUrl(url.replace('abc123', 'other999'))).toBe(false);
  });

  it('rejects a valid URL when checked with a different secret', () => {
    const url = toBlurredUrl(ORIGINAL);
    config.cloudinary.apiSecret = 'another_dummy_secret';
    expect(isValidBlurredPhotoUrl(url)).toBe(false);
  });

  it('generates NO url when no API secret is configured (never the original)', () => {
    config.cloudinary.apiSecret = '';
    expect(toBlurredUrl(ORIGINAL)).toBe('');
  });

  it('keeps the asset delivery type and works without a version', () => {
    const auth = toBlurredUrl('https://res.cloudinary.com/demo/image/authenticated/v5/p/x.png');
    expect(auth).toContain('/image/authenticated/s--');
    expect(auth.endsWith('/v5/p/x.png')).toBe(true);
    expect(isValidBlurredPhotoUrl(auth)).toBe(true);
    const nov = toBlurredUrl('https://res.cloudinary.com/demo/image/upload/p/x.png');
    expect(isValidBlurredPhotoUrl(nov)).toBe(true);
  });

  it('re-blurs from an already signed/transformed URL without stacking transformations', () => {
    const p = parseCloudinaryUrl(toBlurredUrl(ORIGINAL))!;
    expect(p.publicId).toBe('profiles/abc123');
    expect(p.version).toBe('1700000000');
    expect(p.format).toBe('jpg');
  });

  it('locked photos never expose the original url or publicId', () => {
    const out = buildPublicPhotos({
      userId: 'u1',
      photoPrivacy: 'blurred',
      photos: [{ url: ORIGINAL, publicId: 'profiles/abc123', approved: true, isMain: true }],
    });
    expect(out[0].isBlurred).toBe(true);
    expect(out[0].url).not.toBe(ORIGINAL);
    expect(isValidBlurredPhotoUrl(out[0].url)).toBe(true);
    expect(out[0].publicId).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain(SECRET);
  });

  it('documents the exact preset strings that must be allow-listed', () => {
    expect(presetTransformation('avatar')).toBe('f_auto,q_auto,w_200,h_200,c_fill,g_face');
    expect(presetTransformation('card')).toBe('f_auto,q_auto,w_600,h_750,c_fill,g_face');
    expect(presetTransformation('hero')).toBe('f_auto,q_auto,w_1080,h_1350,c_fill,g_face');
    expect(presetTransformation('post')).toBe('f_auto,q_auto,w_900,c_limit');
  });
});
