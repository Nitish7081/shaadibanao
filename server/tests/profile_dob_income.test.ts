import request from 'supertest';
import { createApp } from '../src/app';
import { TokenService } from '../src/services/token.service';
import { ProfileModel } from '../src/models/profile.model';
import {
  checkDateOfBirth,
  upsertProfileSchema,
  DATE_OF_BIRTH_MESSAGES,
  UpsertProfileInput,
} from '@bandhansetu/shared';

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const yearsAgo = (years: number, dayOffset = 0) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() + dayOffset);
  return ymd(d);
};

describe('Date of birth validation & blank income', () => {
  const app = createApp();
  const userId = 'usr_dob_income_1';
  const token = TokenService.generateTokens({
    userId,
    mobile: '9811100001',
    role: 'member',
  }).accessToken;

  const base: UpsertProfileInput = {
    firstName: 'Anita',
    lastName: 'Verma',
    gender: 'female',
    dateOfBirth: '1998-05-14',
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
    photos: [],
    photoPrivacy: 'everyone',
    aboutMe: '',
  } as UpsertProfileInput;

  const put = (body: any) =>
    request(app).put('/api/v1/profiles/me').set('Authorization', `Bearer ${token}`).send(body);

  describe('checkDateOfBirth (shared)', () => {
    it('accepts a valid adult date', () => {
      expect(checkDateOfBirth('1998-05-14')).toBeNull();
      expect(checkDateOfBirth('2000-02-29')).toBeNull(); // real leap day
    });

    it('rejects wrong format', () => {
      expect(checkDateOfBirth('')).toBe('format');
      expect(checkDateOfBirth('14-05-1998')).toBe('format');
      expect(checkDateOfBirth('1998/05/14')).toBe('format');
    });

    it('rejects impossible calendar dates', () => {
      expect(checkDateOfBirth('9999-99-99')).toBe('invalid');
      expect(checkDateOfBirth('1998-02-30')).toBe('invalid');
      expect(checkDateOfBirth('1999-02-29')).toBe('invalid'); // not a leap year
      expect(checkDateOfBirth('1998-13-01')).toBe('invalid');
      expect(checkDateOfBirth('0000-01-01')).toBe('invalid');
    });

    it('rejects future dates', () => {
      expect(checkDateOfBirth('9999-12-31')).toBe('future');
      expect(checkDateOfBirth(yearsAgo(-1))).toBe('future');
    });

    it('rejects under 18 and accepts exactly 18', () => {
      expect(checkDateOfBirth(yearsAgo(17))).toBe('underage');
      expect(checkDateOfBirth(yearsAgo(18, 1))).toBe('underage'); // turns 18 tomorrow
      expect(checkDateOfBirth(yearsAgo(18))).toBeNull(); // turns 18 today
    });

    it('has a distinct message for each case', () => {
      const msgs = new Set(Object.values(DATE_OF_BIRTH_MESSAGES));
      expect(msgs.size).toBe(4);
    });
  });

  describe('API rejects bad dates (400 VALIDATION_ERROR)', () => {
    it.each([
      ['9999-99-99', DATE_OF_BIRTH_MESSAGES.invalid],
      ['9999-12-31', DATE_OF_BIRTH_MESSAGES.future],
      [yearsAgo(17), DATE_OF_BIRTH_MESSAGES.underage],
      ['not-a-date', DATE_OF_BIRTH_MESSAGES.format],
    ])('rejects %s', async (dob, message) => {
      const res = await put({ ...base, dateOfBirth: dob });
      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(JSON.stringify(res.body)).toContain(message);
    });

    it('still accepts a valid date', async () => {
      const res = await put({ ...base, dateOfBirth: '1998-05-14' });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('dateOfBirth', '1998-05-14');
      expect(res.body.data.age).toBeGreaterThanOrEqual(18);
    });
  });

  describe('Blank income stays blank', () => {
    it('shared schema adds no default income', () => {
      const parsed = upsertProfileSchema.parse(base);
      expect(parsed.annualIncomeBand).toBeUndefined();
    });

    it('Mongoose model has no default income and field is not required', () => {
      const doc = new ProfileModel({ userId: 'x' });
      expect(doc.annualIncomeBand).toBeUndefined();
      const path: any = ProfileModel.schema.path('annualIncomeBand');
      expect(path.instance).toBe('String');
      expect(path.isRequired).toBeFalsy();
      expect(path.defaultValue).toBeUndefined();
    });

    it('API saves a profile without income and returns it empty (no crash)', async () => {
      const res = await put(base);
      expect(res.status).toBe(200);
      expect(res.body.data.annualIncomeBand).toBeFalsy();
      const me = await request(app).get('/api/v1/profiles/me').set('Authorization', `Bearer ${token}`);
      expect(me.status).toBe(200);
      expect(me.body.data.annualIncomeBand).toBeFalsy();
    });

    it('API keeps an income value when one is provided', async () => {
      const res = await put({ ...base, annualIncomeBand: '₹15L - ₹25L' });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('annualIncomeBand', '₹15L - ₹25L');
    });
  });
});
