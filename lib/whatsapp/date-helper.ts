/**
 * Asia/Kolkata Date Helper & Leap-Day Birthday Matching Engine
 *
 * Requirements:
 * 1. Executes in Asia/Kolkata timezone (IST, UTC+5:30).
 * 2. Compares month and day using stored Date of Birth (dateOfBirth), not manually entered age.
 * 3. Leap-Day (February 29) Policy:
 *    - In leap years (e.g., 2024, 2028, 2032): February 29 birthdays are celebrated on February 29.
 *    - In non-leap years (e.g., 2025, 2026, 2027): February 29 birthdays are celebrated on FEBRUARY 28.
 *    - This standard Indian civic policy ensures that leap-day babies are never skipped and receive
 *      their auspicious Jin Sanskar birthday greeting every calendar year.
 */

export interface IndianDateComponents {
  year: number;
  month: number; // 1 - 12
  day: number; // 1 - 31
  isLeapYear: boolean;
}

/**
 * Returns whether a given calendar year is a leap year.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns the current calendar date in Asia/Kolkata (IST).
 */
export function getAsiaKolkataDate(refDate: Date = new Date()): IndianDateComponents {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });

  const parts = formatter.formatToParts(refDate);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }

  const year = parseInt(partMap.year, 10);
  const month = parseInt(partMap.month, 10); // 1-12
  const day = parseInt(partMap.day, 10); // 1-31

  return {
    year,
    month,
    day,
    isLeapYear: isLeapYear(year),
  };
}

/**
 * Parses calendar birth month and day from a Date object or ISO string.
 * Uses UTC components because Prisma stores @db.Date as UTC midnight.
 */
export function parseBirthMonthAndDay(
  dob: Date | string | null | undefined
): { birthMonth: number; birthDay: number; birthYear: number } | null {
  if (!dob) return null;

  let birthYear: number;
  let birthMonth: number;
  let birthDay: number;

  if (typeof dob === "string") {
    const match = dob.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    birthYear = parseInt(match[1], 10);
    birthMonth = parseInt(match[2], 10);
    birthDay = parseInt(match[3], 10);
  } else if (dob instanceof Date) {
    if (isNaN(dob.getTime())) return null;
    birthYear = dob.getUTCFullYear();
    birthMonth = dob.getUTCMonth() + 1;
    birthDay = dob.getUTCDate();
  } else {
    return null;
  }

  if (birthMonth < 1 || birthMonth > 12 || birthDay < 1 || birthDay > 31) {
    return null;
  }

  return { birthYear, birthMonth, birthDay };
}

/**
 * Checks if a member's birthday falls on today's date in Asia/Kolkata.
 * Handles the February 29 policy:
 * - On non-leap years, February 29 birthdays match on February 28.
 * - On leap years, February 29 birthdays match on February 29.
 */
export function isBirthdayToday(
  dob: Date | string | null | undefined,
  refDate: Date = new Date()
): boolean {
  const parsed = parseBirthMonthAndDay(dob);
  if (!parsed) return false;

  const today = getAsiaKolkataDate(refDate);

  // Exact month and day match
  if (parsed.birthMonth === today.month && parsed.birthDay === today.day) {
    return true;
  }

  // February 29 policy for non-leap years:
  // If born on Feb 29, and current year is NOT a leap year, match on Feb 28.
  if (parsed.birthMonth === 2 && parsed.birthDay === 29) {
    if (!today.isLeapYear && today.month === 2 && today.day === 28) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if a member's birthday falls within the next `daysAhead` days in Asia/Kolkata.
 * Returns the number of days until the birthday (0 = today, 1 = tomorrow, etc.), or null if outside range.
 */
export function getDaysUntilBirthday(
  dob: Date | string | null | undefined,
  daysAhead: number = 30,
  refDate: Date = new Date()
): number | null {
  const parsed = parseBirthMonthAndDay(dob);
  if (!parsed) return null;

  const today = getAsiaKolkataDate(refDate);

  for (let offset = 0; offset <= daysAhead; offset++) {
    const futureDate = new Date(refDate.getTime() + offset * 24 * 60 * 60 * 1000);
    const targetDay = getAsiaKolkataDate(futureDate);

    // Standard match
    if (parsed.birthMonth === targetDay.month && parsed.birthDay === targetDay.day) {
      return offset;
    }

    // Feb 29 non-leap year match
    if (parsed.birthMonth === 2 && parsed.birthDay === 29 && !targetDay.isLeapYear && targetDay.month === 2 && targetDay.day === 28) {
      return offset;
    }
  }

  return null;
}
