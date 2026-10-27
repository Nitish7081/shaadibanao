import request from 'supertest';
import { createApp } from '../src/app';
import { TokenService } from '../src/services/token.service';
import {
  buildPublicPhotos,
  effectivePhotoPrivacy,
  toBlurredUrl,
} from '../src/services/photoPrivacy';
import { UpsertProfileInput } from '@bandhansetu/shared';

const ORIGINAL = 'https://res.cloudinary.com/demo/image/upload/v1700000000/profiles/abc123.jpg';
const token = (userId: string, mobile: string) =>
  TokenService.generateTokens({ userId, mobile, role: 'member' }).accessToken;

describe('Photo privacy (server-side)', () => {
  describe('toBlurredUrl / effectivePhotoPrivacy', () => {
    it('inserts a strong Cloudinary blur and never returns the original URL', () => {
      const blurred = toBlurredUrl(ORIGINAL);
      expect(blurred).toContain('/image/upload/e_blur:2000');
      expect(blurred).not.toBe(ORIGINAL);
      expect(blurred.endsWith('/v1700000000/profiles/abc123.jpg')).toBe(true);
    });

    it('returns no URL when the photo cannot be blurred server-side', () => {
      expect(toBlurredUrl('https://images.unsplash.com/photo-1')).toBe('');
      expect(toBlurredUrl('https://res.cloudinary.com/demo/image/authenticated/s--x--/v1/a.jpg')).toBe('');
      expect(toBlurredUrl('')).toBe('');
      expect(toBlurredUrl(undefined)).toBe('');
    });

    it('uses the stricter of profile-level and photo-level privacy', () => {
      expect(effectivePhotoPrivacy('everyone', 'everyone')).toBe('everyone');
      expect(effectivePhotoPrivacy('everyone', 'blurred')).toBe('blurred');
      expect(effectivePhotoPrivacy('after_interest_accepted', 'everyone')).toBe('after_interest_accepted');
      expect(effectivePhotoPrivacy('after_interest_accepted', 'blurred')).toBe('blurred');
      expect(effectivePhotoPrivacy(undefined, undefined)).toBe('everyone');
    });
  });

  describe('buildPublicPhotos per privacy mode', () => {
    const doc = (photoPrivacy: string, url = ORIGINAL, approved = true) => ({
      userId: 'owner1',
      photoPrivacy,
      photos: [{ url, publicId: 'profiles/abc123', isMain: true, privacy: photoPrivacy, approved }],
    });

    it("'everyone': original photo for any viewer", () => {
      const [p] = buildPublicPhotos(doc('everyone'), { viewerId: 'stranger' });
      expect(p.url).toBe(ORIGINAL);
      expect(p.isBlurred).toBe(false);
      expect(p.isLocked).toBe(false);
      expect(p.publicId).toBe('profiles/abc123');
    });

    it("'blurred': blurred URL, no publicId, for strangers AND accepted partners", () => {
      const accepted = new Set(['owner1']);
      for (const ctx of [{ viewerId: 'stranger' }, { viewerId: 'partner', acceptedUserIds: accepted }, {}]) {
        const [p] = buildPublicPhotos(doc('blurred'), ctx);
        expect(p.url).not.toBe(ORIGINAL);
        expect(p.url).toContain('e_blur:2000');
        expect(p.isBlurred).toBe(true);
        expect(p.isLocked).toBe(true);
        expect(p).not.toHaveProperty('publicId');
      }
    });

    it("'blurred': the public view stays blurred even for the owner (originals come from /profiles/me)", () => {
      const [p] = buildPublicPhotos(doc('blurred'), { viewerId: 'owner1' });
      expect(p.url).toContain('e_blur:2000');
      expect(p.isLocked).toBe(true);
    });

    it("'after_interest_accepted': locked for strangers and unknown viewers", () => {
      for (const ctx of [{ viewerId: 'stranger', acceptedUserIds: new Set<string>() }, { viewerId: 'stranger' }, {}]) {
        const [p] = buildPublicPhotos(doc('after_interest_accepted'), ctx);
        expect(p.url).not.toBe(ORIGINAL);
        expect(p.url).toContain('e_blur:2000');
        expect(p.isBlurred).toBe(true);
        expect(p).not.toHaveProperty('publicId');
      }
    });

    it("'after_interest_accepted': unlocked only when the viewer has an accepted interest", () => {
      const [p] = buildPublicPhotos(doc('after_interest_accepted'), {
        viewerId: 'partner',
        acceptedUserIds: new Set(['owner1']),
      });
      expect(p.url).toBe(ORIGINAL);
      expect(p.isBlurred).toBe(false);
      expect(p.isLocked).toBe(false);
    });

    it("'after_interest_accepted': an accepted interest with someone else does not unlock", () => {
      const [p] = buildPublicPhotos(doc('after_interest_accepted'), {
        viewerId: 'partner',
        acceptedUserIds: new Set(['someone-else']),
      });
      expect(p.isLocked).toBe(true);
      expect(p.url).not.toBe(ORIGINAL);
    });

    it("'after_interest_accepted': the public view of one's own profile is a faithful preview (locked)", () => {
      const [p] = buildPublicPhotos(doc('after_interest_accepted'), { viewerId: 'owner1' });
      expect(p.url).toContain('e_blur:2000');
      expect(p.isLocked).toBe(true);
    });

    it('sends no URL at all when a locked photo cannot be blurred (non-Cloudinary)', () => {
      const [p] = buildPublicPhotos(doc('blurred', 'https://images.unsplash.com/photo-1'), { viewerId: 'x' });
      expect(p.url).toBe('');
      expect(p.isLocked).toBe(true);
    });

    it('never outputs unapproved photos', () => {
      expect(buildPublicPhotos(doc('everyone', ORIGINAL, false), { viewerId: 'x' })).toHaveLength(0);
    });
  });

  describe('API: GET profile / search / interest unlock', () => {
    const app = createApp();

    const base = (firstName: string, photoPrivacy: 'everyone' | 'blurred' | 'after_interest_accepted'): UpsertProfileInput =>
      ({
        firstName,
        lastName: 'Tester',
        gender: 'female',
        dateOfBirth: '1997-03-10',
        maritalStatus: 'never_married',
        heightCm: 160,
        motherTongue: 'Hindi',
        religion: 'Hindu',
        manglik: 'no',
        country: 'India',
        state: 'Delhi',
        city: 'Delhi NCR',
        familyValues: 'moderate',
        familyType: 'nuclear',
        education: 'B.Com',
        employedIn: 'private',
        occupation: 'Accountant',
        showIncomeBand: true,
        photos: [
          {
            url: ORIGINAL,
            publicId: 'profiles/abc123',
            isMain: true,
            privacy: photoPrivacy,
            approved: true,
          },
        ],
        photoPrivacy,
        aboutMe: '',
      }) as unknown as UpsertProfileInput;

    const owners = {
      everyone: { id: 'pp_owner_everyone', name: 'Evana' },
      blurred: { id: 'pp_owner_blurred', name: 'Blura' },
      after: { id: 'pp_owner_after', name: 'Afteri' },
    };
    const ownerToken = (id: string) => token(id, '9800000001');
    const strangerId = 'pp_stranger';
    const partnerId = 'pp_partner';
    const strangerToken = token(strangerId, '9800000002');
    const partnerToken = token(partnerId, '9800000003');

    const getProfile = (id: string, t: string) =>
      request(app).get(`/api/v1/profiles/${id}`).set('Authorization', `Bearer ${t}`);

    const searchFor = async (t: string, name: string) => {
      const res = await request(app)
        .get('/api/v1/search')
        .query({ limit: 50 })
        .set('Authorization', `Bearer ${t}`);
      expect(res.status).toBe(200);
      return res.body.data.items.find((i: any) => i.displayName.startsWith(name));
    };

    beforeAll(async () => {
      for (const [mode, o] of [
        ['everyone', owners.everyone],
        ['blurred', owners.blurred],
        ['after_interest_accepted', owners.after],
      ] as const) {
        const res = await request(app)
          .put('/api/v1/profiles/me')
          .set('Authorization', `Bearer ${ownerToken(o.id)}`)
          .send(base(o.name, mode));
        expect(res.status).toBe(200);
      }
    });

    it("'everyone': stranger gets the original URL (profile + search)", async () => {
      const prof = await getProfile(owners.everyone.id, strangerToken);
      expect(prof.status).toBe(200);
      expect(prof.body.data.photos[0].url).toBe(ORIGINAL);
      expect(prof.body.data.photos[0].isBlurred).toBe(false);

      const item = await searchFor(strangerToken, owners.everyone.name);
      expect(item.photos[0].url).toBe(ORIGINAL);
    });

    it("'blurred': stranger never receives the original URL or publicId", async () => {
      const prof = await getProfile(owners.blurred.id, strangerToken);
      expect(prof.status).toBe(200);
      const photo = prof.body.data.photos[0];
      expect(photo.url).toContain('e_blur:2000');
      expect(photo.url).not.toBe(ORIGINAL);
      expect(photo.isBlurred).toBe(true);
      expect(photo.isLocked).toBe(true);
      expect(photo).not.toHaveProperty('publicId');
      expect(JSON.stringify(prof.body)).not.toContain(ORIGINAL);

      const item = await searchFor(strangerToken, owners.blurred.name);
      expect(item.photos[0].url).toContain('e_blur:2000');
      expect(JSON.stringify(item)).not.toContain(ORIGINAL);
    });

    it("'after_interest_accepted': locked for a stranger", async () => {
      const prof = await getProfile(owners.after.id, strangerToken);
      expect(prof.body.data.photos[0].url).toContain('e_blur:2000');
      expect(prof.body.data.photos[0].isLocked).toBe(true);
      expect(JSON.stringify(prof.body)).not.toContain(ORIGINAL);
    });

    let interestId = '';
    it("'after_interest_accepted': a PENDING interest does not unlock the photo", async () => {
      const sent = await request(app)
        .post(`/api/v1/interests/${owners.after.id}`)
        .set('Authorization', `Bearer ${partnerToken}`);
      expect(sent.status).toBe(201);
      interestId = sent.body.data.id;
      // the interest response itself must not leak the original either
      expect(JSON.stringify(sent.body)).not.toContain(ORIGINAL);

      const prof = await getProfile(owners.after.id, partnerToken);
      expect(prof.body.data.photos[0].isLocked).toBe(true);
      expect(prof.body.data.photos[0].url).not.toBe(ORIGINAL);
    });

    it("'after_interest_accepted': unlocked for the partner once the interest is ACCEPTED (profile + search)", async () => {
      const accept = await request(app)
        .patch(`/api/v1/interests/${interestId}`)
        .set('Authorization', `Bearer ${ownerToken(owners.after.id)}`)
        .send({ status: 'accepted' });
      expect(accept.status).toBe(200);

      const prof = await getProfile(owners.after.id, partnerToken);
      expect(prof.body.data.photos[0].url).toBe(ORIGINAL);
      expect(prof.body.data.photos[0].isBlurred).toBe(false);
      expect(prof.body.data.photos[0].isLocked).toBe(false);

      const item = await searchFor(partnerToken, owners.after.name);
      expect(item.photos[0].url).toBe(ORIGINAL);
    });

    it("'after_interest_accepted': a stranger stays locked after someone else's interest was accepted", async () => {
      const prof = await getProfile(owners.after.id, strangerToken);
      expect(prof.body.data.photos[0].isLocked).toBe(true);
      expect(prof.body.data.photos[0].url).not.toBe(ORIGINAL);
    });

    it("'blurred' stays blurred even for an accepted partner", async () => {
      const sent = await request(app)
        .post(`/api/v1/interests/${owners.blurred.id}`)
        .set('Authorization', `Bearer ${partnerToken}`);
      expect(sent.status).toBe(201);
      await request(app)
        .patch(`/api/v1/interests/${sent.body.data.id}`)
        .set('Authorization', `Bearer ${ownerToken(owners.blurred.id)}`)
        .send({ status: 'accepted' });

      const prof = await getProfile(owners.blurred.id, partnerToken);
      expect(prof.body.data.photos[0].url).toContain('e_blur:2000');
      expect(prof.body.data.photos[0].isLocked).toBe(true);
    });

    it('keeps existing fields (backward compatible): url, isMain, isBlurred are still present', async () => {
      const prof = await getProfile(owners.blurred.id, strangerToken);
      const photo = prof.body.data.photos[0];
      expect(photo).toHaveProperty('url');
      expect(photo).toHaveProperty('isMain', true);
      expect(photo).toHaveProperty('isBlurred', true);
    });
  });
});
