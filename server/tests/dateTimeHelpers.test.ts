import {
  formatApiDate,
  parseApiDate,
  formatDisplayDate,
  formatApiTime,
  parseApiTime,
  formatDisplayTime,
  isValidBookingDate,
  getBookingDateLimits,
  isValidDob,
  getDobDateLimits,
} from '@bandhansetu/shared';

describe('Date & Time Utilities and Validation Helpers', () => {
  const fixedNow = new Date(2026, 10, 15, 10, 30, 0); // 15 Nov 2026 (month is 0-indexed: 10 = Nov)

  describe('formatApiDate and parseApiDate', () => {
    it('formats a Date object to YYYY-MM-DD', () => {
      const d = new Date(2026, 10, 12);
      expect(formatApiDate(d)).toBe('2026-11-12');
    });

    it('parses a valid YYYY-MM-DD string into a local Date without timezone shifting', () => {
      const parsed = parseApiDate('2026-11-12');
      expect(parsed).not.toBeNull();
      expect(parsed!.getFullYear()).toBe(2026);
      expect(parsed!.getMonth()).toBe(10); // November
      expect(parsed!.getDate()).toBe(12);
    });

    it('is symmetrical (roundtrip consistency)', () => {
      const dateStr = '2026-05-20';
      const parsed = parseApiDate(dateStr);
      expect(formatApiDate(parsed!)).toBe(dateStr);
    });

    it('returns null for invalid, incomplete or malformed strings', () => {
      expect(parseApiDate('')).toBeNull();
      expect(parseApiDate('abc')).toBeNull();
      expect(parseApiDate('2026-13-01')).toBeNull(); // Month 13 invalid
      expect(parseApiDate('2026-02-30')).toBeNull(); // Feb 30 invalid
      expect(parseApiDate('2023-02-29')).toBeNull(); // 2023 not leap year
    });

    it('handles leap years correctly', () => {
      const leap = parseApiDate('2024-02-29'); // 2024 is leap
      expect(leap).not.toBeNull();
      expect(formatApiDate(leap!)).toBe('2024-02-29');
    });
  });

  describe('formatDisplayDate (Readable formats)', () => {
    it('formats date in English as "D Mon YYYY"', () => {
      expect(formatDisplayDate('2026-11-12', 'en')).toBe('12 Nov 2026');
      expect(formatDisplayDate('2026-01-05', 'en')).toBe('5 Jan 2026');
    });

    it('formats date in Hindi using Hindi month abbreviations', () => {
      expect(formatDisplayDate('2026-11-12', 'hi')).toBe('12 नवं 2026');
      expect(formatDisplayDate('2026-03-25', 'hi')).toBe('25 मार्च 2026');
    });

    it('returns empty string for null, undefined or empty input', () => {
      expect(formatDisplayDate(null)).toBe('');
      expect(formatDisplayDate(undefined)).toBe('');
      expect(formatDisplayDate('')).toBe('');
    });
  });

  describe('formatApiTime, parseApiTime, and formatDisplayTime', () => {
    it('parses valid HH:mm strings', () => {
      const t = parseApiTime('14:30');
      expect(t).not.toBeNull();
      expect(t!.getHours()).toBe(14);
      expect(t!.getMinutes()).toBe(30);
    });

    it('formats time to 24-hr HH:mm', () => {
      const d = new Date();
      d.setHours(9, 5, 0, 0);
      expect(formatApiTime(d)).toBe('09:05');
    });

    it('displays 12-hour format with AM/PM', () => {
      expect(formatDisplayTime('14:30')).toBe('02:30 PM');
      expect(formatDisplayTime('09:05')).toBe('09:05 AM');
      expect(formatDisplayTime('00:00')).toBe('12:00 AM');
      expect(formatDisplayTime('12:00')).toBe('12:00 PM');
      expect(formatDisplayTime('23:59')).toBe('11:59 PM');
    });

    it('returns null for invalid time strings', () => {
      expect(parseApiTime('25:00')).toBeNull();
      expect(parseApiTime('12:60')).toBeNull();
      expect(parseApiTime('invalid')).toBeNull();
    });
  });

  describe('isValidBookingDate (Today or later, within 1 year)', () => {
    it('accepts today as a valid booking date', () => {
      const todayStr = '2026-11-15';
      const res = isValidBookingDate(todayStr, fixedNow);
      expect(res.isValid).toBe(true);
    });

    it('accepts a future date within 1 year', () => {
      const res = isValidBookingDate('2027-02-10', fixedNow);
      expect(res.isValid).toBe(true);
    });

    it('accepts a date exactly 1 year from now', () => {
      const res = isValidBookingDate('2027-11-15', fixedNow);
      expect(res.isValid).toBe(true);
    });

    it('rejects a past date with error "past"', () => {
      const res = isValidBookingDate('2026-11-14', fixedNow);
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('past');
    });

    it('rejects a date beyond 1 year with error "beyond_one_year"', () => {
      const res = isValidBookingDate('2027-11-16', fixedNow);
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('beyond_one_year');
    });

    it('rejects invalid or empty string with error "invalid"', () => {
      expect(isValidBookingDate('', fixedNow).isValid).toBe(false);
      expect(isValidBookingDate('2026-99-99', fixedNow).isValid).toBe(false);
    });
  });

  describe('getBookingDateLimits', () => {
    it('sets minDate to today and maxDate to today + 1 year', () => {
      const { minDate, maxDate } = getBookingDateLimits(fixedNow);
      expect(formatApiDate(minDate)).toBe('2026-11-15');
      expect(formatApiDate(maxDate)).toBe('2027-11-15');
    });
  });

  describe('isValidDob (At least 18 years old, not in the future)', () => {
    it('accepts a date exactly 18 years ago today', () => {
      const dob18 = '2008-11-15'; // 2026 - 18 = 2008
      const res = isValidDob(dob18, fixedNow);
      expect(res.isValid).toBe(true);
    });

    it('accepts a date more than 18 years ago (e.g. 25 years old)', () => {
      const res = isValidDob('2001-05-10', fixedNow);
      expect(res.isValid).toBe(true);
    });

    it('rejects an underage date (e.g. 17 years and 364 days old) with error "underage"', () => {
      const dob17 = '2008-11-16'; // 1 day too young
      const res = isValidDob(dob17, fixedNow);
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('underage');
    });

    it('rejects a future date with error "future"', () => {
      const futureDate = '2026-11-16';
      const res = isValidDob(futureDate, fixedNow);
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('future');
    });

    it('rejects an invalid date format with error "invalid"', () => {
      expect(isValidDob('', fixedNow).isValid).toBe(false);
      expect(isValidDob('invalid', fixedNow).isValid).toBe(false);
    });
  });

  describe('getDobDateLimits', () => {
    it('sets maxDate to exactly 18 years ago and minDate to 120 years ago', () => {
      const { minDate, maxDate } = getDobDateLimits(fixedNow);
      expect(formatApiDate(maxDate)).toBe('2008-11-15');
      expect(formatApiDate(minDate)).toBe('1906-11-15');
    });
  });
});
