/**
 * BandhanSetu Date & Time Utilities
 * Provides safe date/time parsing, validation, and locale-aware formatting.
 * Avoids UTC timezone day-shift bugs by operating on local calendar values.
 */

export const MONTH_NAMES_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

export const MONTH_NAMES_HI = [
  'जन', 'फर', 'मार्च', 'अप्रै', 'मई', 'जून',
  'जुला', 'अग', 'सितं', 'अक्टू', 'नवं', 'दिसं',
] as const;

/**
 * Format a Date object to API format: "YYYY-MM-DD"
 */
export function formatApiDate(date: Date): string {
  if (!date || isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parse an API date string ("YYYY-MM-DD") to a local Date object.
 * Sets time to 12:00:00 (noon) to avoid any DST boundary or negative timezone rollover.
 */
export function parseApiDate(str: string | null | undefined): Date | null {
  if (!str || typeof str !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str.trim());
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1; // 0-indexed
  const day = parseInt(match[3], 10);
  const d = new Date(year, month, day, 12, 0, 0);
  if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) {
    return null;
  }
  return d;
}

/**
 * Display date in a readable format, e.g. "12 Nov 2026" or "12 नवं 2026"
 */
export function formatDisplayDate(dateOrStr: Date | string | null | undefined, locale: 'en' | 'hi' = 'en'): string {
  if (!dateOrStr) return '';
  let d: Date | null = null;
  if (typeof dateOrStr === 'string') {
    d = parseApiDate(dateOrStr);
  } else if (dateOrStr instanceof Date && !isNaN(dateOrStr.getTime())) {
    d = dateOrStr;
  }
  if (!d) return '';
  const day = d.getDate();
  const monthIdx = d.getMonth();
  const year = d.getFullYear();
  const monthName = locale === 'hi' ? MONTH_NAMES_HI[monthIdx] : MONTH_NAMES_EN[monthIdx];
  return `${day} ${monthName} ${year}`;
}

/**
 * Format a Date object to API time: "HH:mm" (24-hour format)
 */
export function formatApiTime(date: Date): string {
  if (!date || isNaN(date.getTime())) return '';
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Parse an API time string ("HH:mm" or "H:m" or "HH:mm:ss") into a Date object.
 */
export function parseApiTime(str: string | null | undefined): Date | null {
  if (!str || typeof str !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(str.trim());
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/**
 * Display time in readable 12-hour format, e.g. "02:30 PM"
 */
export function formatDisplayTime(dateOrStr: Date | string | null | undefined, _locale: 'en' | 'hi' = 'en'): string {
  if (!dateOrStr) return '';
  let d: Date | null = null;
  if (typeof dateOrStr === 'string') {
    d = parseApiTime(dateOrStr);
  } else if (dateOrStr instanceof Date && !isNaN(dateOrStr.getTime())) {
    d = dateOrStr;
  }
  if (!d) return '';
  const hours24 = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${String(hours12).padStart(2, '0')}:${minutes} ${period}`;
}

/**
 * Booking date validation:
 * Rule: Today or later only, and within 1 year from now.
 */
export type BookingDateError = 'past' | 'beyond_one_year' | 'invalid';

export function isValidBookingDate(
  dateOrStr: Date | string | null | undefined,
  now: Date = new Date()
): { isValid: boolean; error?: BookingDateError } {
  let d: Date | null = null;
  if (typeof dateOrStr === 'string') {
    d = parseApiDate(dateOrStr);
  } else if (dateOrStr instanceof Date && !isNaN(dateOrStr.getTime())) {
    d = dateOrStr;
  }
  if (!d) return { isValid: false, error: 'invalid' };

  // Compare calendar day (midnight-normalized)
  const candidate = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const maxDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).getTime();

  if (candidate < today) {
    return { isValid: false, error: 'past' };
  }
  if (candidate > maxDate) {
    return { isValid: false, error: 'beyond_one_year' };
  }
  return { isValid: true };
}

/**
 * Returns the minimum and maximum Date limits for booking date pickers.
 */
export function getBookingDateLimits(now: Date = new Date()): { minDate: Date; maxDate: Date } {
  const minDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const maxDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate(), 23, 59, 59);
  return { minDate, maxDate };
}

/**
 * Date of birth validation:
 * Rule: At least 18 years old, and not in the future.
 */
export type DobError = 'future' | 'underage' | 'invalid';

export function isValidDob(
  dateOrStr: Date | string | null | undefined,
  now: Date = new Date()
): { isValid: boolean; error?: DobError } {
  let d: Date | null = null;
  if (typeof dateOrStr === 'string') {
    d = parseApiDate(dateOrStr);
  } else if (dateOrStr instanceof Date && !isNaN(dateOrStr.getTime())) {
    d = dateOrStr;
  }
  if (!d) return { isValid: false, error: 'invalid' };

  const candidate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (candidate.getTime() > today.getTime()) {
    return { isValid: false, error: 'future' };
  }

  // Exactly 18 years cutoff: candidate must be <= (now.year - 18, now.month, now.day)
  const min18Date = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
  if (candidate.getTime() > min18Date.getTime()) {
    return { isValid: false, error: 'underage' };
  }

  return { isValid: true };
}

/**
 * Returns the minimum and maximum Date limits for Date of Birth pickers.
 * - Max date: exactly 18 years ago today.
 * - Min date: 120 years ago.
 */
export function getDobDateLimits(now: Date = new Date()): { minDate: Date; maxDate: Date; defaultInitialDate: Date } {
  const maxDate = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate(), 12, 0, 0);
  const minDate = new Date(now.getFullYear() - 120, now.getMonth(), now.getDate(), 12, 0, 0);
  // Sensible default initial date when user opens picker for the first time: 25 years ago
  const defaultInitialDate = new Date(now.getFullYear() - 25, now.getMonth(), now.getDate(), 12, 0, 0);
  return { minDate, maxDate, defaultInitialDate };
}
