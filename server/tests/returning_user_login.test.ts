import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app';
import { UserModel } from '../src/models/user.model';
import { setFirebaseTokenVerifierForTesting } from '../src/config/firebase';

/**
 * Returning-user login flow against a REAL MongoDB engine (not the in-memory fallback):
 * firebase-login (new) -> create profile -> logout -> firebase-login (fresh token) again.
 */
jest.setTimeout(300000); // first run downloads the mongod binary

describe('Returning user login (real MongoDB)', () => {
  let mongod: MongoMemoryServer;
  const app = createApp();

  const profileBody = {
    firstName: 'Test',
    lastName: 'User',
    gender: 'female',
    dateOfBirth: '1998-05-14',
    maritalStatus: 'never_married',
    heightCm: 163,
    motherTongue: 'Hindi',
    religion: 'Hindu',
    country: 'India',
    state: 'Delhi',
    city: 'Delhi',
    familyValues: 'moderate',
    familyType: 'nuclear',
    education: 'MBA',
    employedIn: 'private',
    occupation: 'Manager',
    annualIncomeBand: '₹10L - ₹15L',
    showIncomeBand: true,
    photos: [],
    photoPrivacy: 'everyone',
    aboutMe: 'Looking for a supportive and kind partner who shares family values.',
    manglik: 'no',
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await UserModel.init(); // build unique indexes exactly like production
  });

  afterAll(async () => {
    setFirebaseTokenVerifierForTesting(null);
    await mongoose.disconnect();
    await mongod.stop();
  });

  const loginAs = (decoded: any) => {
    setFirebaseTokenVerifierForTesting(async () => decoded);
    return request(app).post('/api/v1/auth/firebase-login').send({ idToken: 'fresh_token' });
  };

  const createProfile = (accessToken: string) =>
    request(app).put('/api/v1/profiles/me').set('Authorization', `Bearer ${accessToken}`).send(profileBody);

  const cases: Array<[string, any]> = [
    ['phone-OTP user', { uid: 'uid_phone_1', phone_number: '+919800000001', signInProvider: 'phone' }],
    [
      'Google-only user',
      {
        uid: 'uid_google_1',
        email: 'google.user@example.com',
        email_verified: true,
        name: 'Google User',
        signInProvider: 'google.com',
      },
    ],
  ];

  describe.each(cases)('%s', (_label, decoded) => {
    it('signup -> profile -> server logout -> login again with fresh token', async () => {
      const first = await loginAs(decoded);
      expect(first.status).toBe(200);
      expect(first.body.data.isNewUser).toBe(true);

      const profile = await createProfile(first.body.data.tokens.accessToken);
      expect(profile.status).toBe(200);

      const logout = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${first.body.data.tokens.accessToken}`)
        .send({ refreshToken: first.body.data.tokens.refreshToken });
      expect(logout.status).toBe(200);

      const second = await loginAs(decoded);
      expect(second.status).toBe(200);
      expect(second.body.data.isNewUser).toBe(false);
      expect(second.body.data.user.id).toBe(first.body.data.user.id);
      expect(second.body.data.user.hasProfile).toBe(true);

      const me = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${second.body.data.tokens.accessToken}`);
      expect(me.status).toBe(200);
    });

    it('mobile-style logout (local clear only, no server call) -> login again', async () => {
      const again = await loginAs(decoded);
      expect(again.status).toBe(200);
      expect(again.body.data.isNewUser).toBe(false);
      const third = await loginAs(decoded);
      expect(third.status).toBe(200);
      expect(third.body.data.isNewUser).toBe(false);
    });

    it('app restart after logout: revoked refresh token is rejected, fresh login works', async () => {
      const s = await loginAs(decoded);
      await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${s.body.data.tokens.accessToken}`)
        .send({ refreshToken: s.body.data.tokens.refreshToken });

      const stale = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: s.body.data.tokens.refreshToken });
      expect(stale.status).toBe(401);

      const relogin = await loginAs(decoded);
      expect(relogin.status).toBe(200);
      expect(relogin.body.data.isNewUser).toBe(false);
    });

    it('app restart WITHOUT logout: stored refresh token still works', async () => {
      const s = await loginAs(decoded);
      const refreshed = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: s.body.data.tokens.refreshToken });
      expect(refreshed.status).toBe(200);
    });
  });

  it('concurrent first-time logins do not fail with duplicate-key errors', async () => {
    const decoded = {
      uid: 'uid_race_1',
      email: 'race@example.com',
      email_verified: true,
      signInProvider: 'google.com',
    };
    setFirebaseTokenVerifierForTesting(async () => decoded);
    const results = await Promise.all(
      [1, 2, 3].map(() => request(app).post('/api/v1/auth/firebase-login').send({ idToken: 't' }))
    );
    const statuses = results.map((r) => r.status);
    expect(statuses).toEqual([200, 200, 200]);
    expect(await UserModel.countDocuments({ firebaseUid: 'uid_race_1' })).toBe(1);
  });

  it('concurrent logins of an EXISTING user (e.g. app start + manual login) all succeed', async () => {
    const decoded = { uid: 'uid_conc_existing', phone_number: '+919800000055', signInProvider: 'phone' };
    const first = await loginAs(decoded);
    expect(first.status).toBe(200);
    const results = await Promise.all(
      [1, 2, 3, 4].map(() => request(app).post('/api/v1/auth/firebase-login').send({ idToken: 't' }))
    );
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200]);
    for (const r of results) expect(r.body.data.isNewUser).toBe(false);
    const u: any = await UserModel.findOne({ firebaseUid: 'uid_conc_existing' });
    // every issued refresh token must still be usable (no lost updates)
    const refreshed = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: results[results.length - 1].body.data.tokens.refreshToken });
    expect(refreshed.status).toBe(200);
    expect(u).toBeTruthy();
  });

  it('refresh racing with a new login never destroys the new session', async () => {
    const decoded = { uid: 'uid_refresh_race', phone_number: '+919800000066', signInProvider: 'phone' };
    for (let i = 0; i < 5; i++) {
      const a = await loginAs(decoded);
      const [b, refreshed] = await Promise.all([
        request(app).post('/api/v1/auth/firebase-login').send({ idToken: 't' }),
        request(app).post('/api/v1/auth/refresh').send({ refreshToken: a.body.data.tokens.refreshToken }),
      ]);
      expect(b.status).toBe(200);
      expect(refreshed.status).toBe(200);
      const useB = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: b.body.data.tokens.refreshToken });
      expect(useB.status).toBe(200);
    }
  });

  it('phone user later signs in with Google using SAME email maps to one record', async () => {
    const phone = await loginAs({ uid: 'uid_link_phone', phone_number: '+919800000077', signInProvider: 'phone' });
    expect(phone.status).toBe(200);
    // Firebase gives Google sign-in a different uid than phone sign-in
    const google = await loginAs({
      uid: 'uid_link_google',
      phone_number: '+919800000077',
      email: 'link@example.com',
      email_verified: true,
      signInProvider: 'google.com',
    });
    expect(google.status).toBe(200);
    expect(google.body.data.user.id).toBe(phone.body.data.user.id);
  });

  it('refresh token array stays bounded across many logins', async () => {
    const decoded = { uid: 'uid_many', phone_number: '+919800000088', signInProvider: 'phone' };
    for (let i = 0; i < 25; i++) {
      const r = await loginAs(decoded);
      expect(r.status).toBe(200);
    }
    const u: any = await UserModel.findOne({ firebaseUid: 'uid_many' });
    expect(u.refreshTokens.length).toBeLessThanOrEqual(10);
  });
});
