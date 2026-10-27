import { config } from '../src/config/env';
import { ProfileService } from '../src/services/profile.service';
import {
  buildPublicPhotos,
  canonicalPhotoUrl,
  isAuthenticatedPhotoUrl,
  isValidBlurredPhotoUrl,
  presentPhoto,
  presentPhotoUrl,
} from '../src/services/photoPrivacy';
import { planPhotoMigration } from '../src/services/photoMigration';
import { presetTransformation } from '@bandhansetu/shared';

// DUMMY secrets only (never real credentials).
const SECRET = 'dummy_test_secret';
const TOKEN_KEY = 'aabbccddeeff00112233445566778899';
const PUBLIC_URL = 'https://res.cloudinary.com/demo/image/upload/v1700000000/shaadibanao/profiles/u1/abc.jpg';
const AUTH_URL = 'https://res.cloudinary.com/demo/image/authenticated/v1700000001/shaadibanao/profiles/u1/abc.jpg';
const AUTH_ID = 'shaadibanao/profiles/u1/abc';

describe('Authenticated profile photos', () => {
  const realSecret = config.cloudinary.apiSecret;
  const realKey = config.cloudinary.authTokenKey;
  beforeEach(() => {
    config.cloudinary.apiSecret = SECRET;
    config.cloudinary.authTokenKey = '';
  });
  afterAll(() => {
    config.cloudinary.apiSecret = realSecret;
    config.cloudinary.authTokenKey = realKey;
  });

  describe('presentPhoto (allowed viewer)', () => {
    it('leaves public (upload) photos untouched', () => {
      expect(presentPhoto(PUBLIC_URL)).toEqual({ url: PUBLIC_URL });
      expect(isAuthenticatedPhotoUrl(PUBLIC_URL)).toBe(false);
      expect(isAuthenticatedPhotoUrl(AUTH_URL)).toBe(true);
    });

    it('signs avatar/card/hero variants of an authenticated photo with the preset transformations', () => {
      const out = presentPhoto(AUTH_URL, AUTH_ID);
      expect(out.url).toBe(out.variants!.hero);
      for (const v of ['avatar', 'card', 'hero'] as const) {
        expect(out.variants![v]).toMatch(
          new RegExp(`/image/authenticated/s--[\\w-]{8}--/${presetTransformation(v).replace(/[,]/g, ',')}/v1700000001/${AUTH_ID}\\.jpg$`)
        );
      }
      expect(out.url).not.toBe(AUTH_URL);
      expect(JSON.stringify(out)).not.toContain(SECRET);
      expect(out.urlExpiresAt).toBeUndefined(); // no token key => no expiry claimed
    });

    it('never returns the unsigned authenticated URL when signing is impossible', () => {
      config.cloudinary.apiSecret = '';
      expect(presentPhoto(AUTH_URL).url).toBe('');
      expect(presentPhotoUrl(AUTH_URL)).toBe('');
    });

    it('adds an expiring token when CLOUDINARY_AUTH_TOKEN_KEY is configured', () => {
      config.cloudinary.authTokenKey = TOKEN_KEY;
      const out = presentPhoto(AUTH_URL, AUTH_ID);
      expect(out.url).toContain('__cld_token__=');
      expect(out.url).toMatch(/exp=\d+/);
      expect(new Date(out.urlExpiresAt!).getTime()).toBeGreaterThan(Date.now());
      expect(out.url).not.toContain(TOKEN_KEY);
    });
  });

  describe('canonicalPhotoUrl (what the DB stores)', () => {
    it('strips signature, transformation and token from authenticated URLs', () => {
      config.cloudinary.authTokenKey = TOKEN_KEY;
      const signed = presentPhoto(AUTH_URL, AUTH_ID).variants!.card!;
      expect(canonicalPhotoUrl(signed)).toBe(AUTH_URL);
      expect(canonicalPhotoUrl(AUTH_URL)).toBe(AUTH_URL);
    });

    it('does not touch public or non-Cloudinary URLs', () => {
      expect(canonicalPhotoUrl(PUBLIC_URL)).toBe(PUBLIC_URL);
      expect(canonicalPhotoUrl('https://images.unsplash.com/x.jpg')).toBe('https://images.unsplash.com/x.jpg');
      expect(canonicalPhotoUrl('')).toBe('');
    });
  });

  describe('buildPublicPhotos with authenticated photos', () => {
    const doc = (photoPrivacy: string) => ({
      userId: 'u1',
      photoPrivacy,
      photos: [{ url: AUTH_URL, publicId: AUTH_ID, approved: true, isMain: true, privacy: 'everyone' }],
    });

    it("'everyone': viewer gets signed variants, never the unsigned authenticated URL", () => {
      const [p] = buildPublicPhotos(doc('everyone'));
      expect(p.isBlurred).toBe(false);
      expect(p.url).toMatch(/\/image\/authenticated\/s--/);
      expect(p.url).not.toBe(AUTH_URL);
      expect(p.variants?.avatar).toBeTruthy();
      expect(p.publicId).toBe(AUTH_ID);
    });

    it("'blurred': locked viewer gets a SIGNED BLUR of the authenticated photo, no variants/publicId", () => {
      const [p] = buildPublicPhotos(doc('blurred'));
      expect(p.isBlurred).toBe(true);
      expect(p.isLocked).toBe(true);
      expect(p.url).toMatch(/\/image\/authenticated\/s--[\w-]{8}--\/e_blur:2000/);
      expect(isValidBlurredPhotoUrl(p.url)).toBe(true);
      expect(p.variants).toBeUndefined();
      expect(p.publicId).toBeUndefined();
      expect(p.url).not.toBe(AUTH_URL);
    });

    it('a blur URL with the blur removed is rejected', () => {
      const [p] = buildPublicPhotos(doc('blurred'));
      expect(isValidBlurredPhotoUrl(p.url.replace('e_blur:2000,q_auto,f_auto,w_320/', ''))).toBe(false);
    });

    it("'after_interest_accepted': blurred until accepted, signed originals afterwards", () => {
      const locked = buildPublicPhotos(doc('after_interest_accepted'))[0];
      expect(locked.isBlurred).toBe(true);
      const open = buildPublicPhotos(doc('after_interest_accepted'), { acceptedUserIds: new Set(['u1']) })[0];
      expect(open.isBlurred).toBe(false);
      expect(open.variants?.hero).toBeTruthy();
    });

    it('locked + no secret => no URL at all', () => {
      config.cloudinary.apiSecret = '';
      expect(buildPublicPhotos(doc('blurred'))[0].url).toBe('');
    });
  });

  describe('ProfileService.upsertMyProfile', () => {
    const input = (photos: any[]) =>
      ({
        firstName: 'Test',
        lastName: 'User',
        dateOfBirth: '1995-01-01',
        photos,
      }) as any;

    it("rejects an authenticated photo from another member's folder (no signing of others' photos)", async () => {
      await expect(
        ProfileService.upsertMyProfile(
          'someone_else',
          input([{ url: AUTH_URL, publicId: AUTH_ID, isMain: true, privacy: 'everyone', approved: false }])
        )
      ).rejects.toMatchObject({ code: 'INVALID_PHOTO' });
    });

    it('stores the plain asset URL even if the client sends back a signed one, and returns signed URLs', async () => {
      const signedBack = presentPhoto(AUTH_URL, AUTH_ID).variants!.hero!;
      const saved: any = await ProfileService.upsertMyProfile(
        'u1',
        input([{ url: signedBack, publicId: AUTH_ID, isMain: true, privacy: 'everyone', approved: false }])
      );
      expect(saved.photos[0].url).toMatch(/\/image\/authenticated\/s--/); // owner view is signed
      expect(saved.photos[0].variants.card).toBeTruthy();
      const stored: any = await ProfileService.getMyProfile('u1');
      expect(stored.photos[0].publicId).toBe(AUTH_ID);
    });
  });

  describe('planPhotoMigration (dry-run planner)', () => {
    it('plans public photos in the owner folder, with an authenticated preview URL', () => {
      const plan: any = planPhotoMigration({ url: PUBLIC_URL, publicId: AUTH_ID }, 'u1');
      expect(plan.action).toBe('migrate');
      expect(plan.publicId).toBe(AUTH_ID);
      expect(plan.newUrlPreview).toBe(AUTH_URL.replace('v1700000001', 'v1700000000'));
    });

    it('skips already authenticated, foreign-folder, mismatching, local and empty photos', () => {
      expect((planPhotoMigration({ url: AUTH_URL }, 'u1') as any).reason).toBe('already-authenticated');
      expect((planPhotoMigration({ url: PUBLIC_URL }, 'someone_else') as any).reason).toBe('outside-owner-profile-folder');
      expect((planPhotoMigration({ url: PUBLIC_URL, publicId: 'x/y' }, 'u1') as any).reason).toBe('publicId-mismatch');
      expect((planPhotoMigration({ url: '/media/a.jpg' }, 'u1') as any).reason).toBe('not-a-cloudinary-image');
      expect((planPhotoMigration({}, 'u1') as any).reason).toBe('no-url');
    });
  });
});
