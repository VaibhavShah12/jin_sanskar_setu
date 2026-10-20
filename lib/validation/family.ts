import { z } from "zod";

// -----------------------------------------------------------------------------
// MOBILE & NAME NORMALIZATION HELPERS
// -----------------------------------------------------------------------------

// Mobile normalization helper: removes spaces, dashes, parentheses, +91 or 0 prefix
export function normalizeMobile(mobile: string): string {
  if (!mobile) return "";
  let cleaned = mobile.replace(/[^0-9]/g, "");
  // If starts with 91 and has 12 digits, strip 91
  if (cleaned.length === 12 && cleaned.startsWith("91")) {
    cleaned = cleaned.substring(2);
  }
  // If starts with 0 and has 11 digits, strip leading 0
  if (cleaned.length === 11 && cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }
  return cleaned;
}

// Mask mobile number helper: e.g. "9822012345" -> "982****345"
export function maskMobile(mobile: string): string {
  if (!mobile || mobile.length < 6) return "******";
  return mobile.substring(0, 3) + "****" + mobile.substring(mobile.length - 3);
}

// Name normalization helper: lowercases and collapses consecutive whitespace
export function normalizeName(name: string): string {
  if (!name) return "";
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

// -----------------------------------------------------------------------------
// DATE OF BIRTH & AGE CALCULATION HELPERS
// Timezone-safe, leap-year-safe calendar age calculation
// -----------------------------------------------------------------------------

export function parseDateString(val: string): { year: number; month: number; day: number } | null {
  if (!val || typeof val !== "string") return null;
  const match = val.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/**
 * Calculates completed years from date of birth.
 * Avoids timezone off-by-one errors by parsing calendar dates directly.
 * Throws an error if birth date is in the future.
 */
export function calculateAgeFromDob(
  dob: string | Date | { year: number; month: number; day: number } | null | undefined,
  refDate: Date = new Date()
): number | null {
  if (!dob) return null;

  let birthYear: number;
  let birthMonth: number;
  let birthDay: number;

  if (typeof dob === "string") {
    const parsed = parseDateString(dob);
    if (!parsed) {
      const d = new Date(dob);
      if (isNaN(d.getTime())) return null;
      birthYear = d.getUTCFullYear();
      birthMonth = d.getUTCMonth() + 1;
      birthDay = d.getUTCDate();
    } else {
      birthYear = parsed.year;
      birthMonth = parsed.month;
      birthDay = parsed.day;
    }
  } else if (dob instanceof Date) {
    // If it's a Date object from PostgreSQL @db.Date, use UTC components
    birthYear = dob.getUTCFullYear();
    birthMonth = dob.getUTCMonth() + 1;
    birthDay = dob.getUTCDate();
  } else if (typeof dob === "object" && "year" in dob && "month" in dob && "day" in dob) {
    birthYear = (dob as any).year;
    birthMonth = (dob as any).month;
    birthDay = (dob as any).day;
  } else {
    return null;
  }

  const nowYear = refDate.getFullYear();
  const nowMonth = refDate.getMonth() + 1;
  const nowDay = refDate.getDate();

  // Validate not in the future
  if (
    birthYear > nowYear ||
    (birthYear === nowYear && birthMonth > nowMonth) ||
    (birthYear === nowYear && birthMonth === nowMonth && birthDay > nowDay)
  ) {
    throw new Error("Date of birth cannot be in the future");
  }

  let age = nowYear - birthYear;
  if (nowMonth < birthMonth || (nowMonth === birthMonth && nowDay < birthDay)) {
    age--;
  }

  return Math.max(0, age);
}

/**
 * Converts a YYYY-MM-DD string into a UTC Date object for PostgreSQL @db.Date storage.
 */
export function toDatabaseDate(dobStr: string | null | undefined): Date | null {
  if (!dobStr || !dobStr.trim()) return null;
  const parsed = parseDateString(dobStr);
  if (!parsed) return null;
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
}

/**
 * Resolves effective age for a member: uses calculated age if DOB is present,
 * otherwise falls back to stored legacy age.
 */
export function getMemberCalculatedAge(member: {
  age: number;
  dateOfBirth?: Date | string | null;
}): number {
  if (member.dateOfBirth) {
    try {
      const calc = calculateAgeFromDob(member.dateOfBirth);
      if (calc !== null) return calc;
    } catch {
      // Fallback to legacy stored age if calculation throws
    }
  }
  return member.age;
}

// -----------------------------------------------------------------------------
// ENUMS & SCHEMAS
// -----------------------------------------------------------------------------

export const GenderEnum = z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]);
export const RelationshipEnum = z.enum([
  "HEAD",
  "SPOUSE",
  "SON",
  "DAUGHTER",
  "FATHER",
  "MOTHER",
  "BROTHER",
  "SISTER",
  "GRANDFATHER",
  "GRANDMOTHER",
  "GRANDCHILD",
  "OTHER",
]);

export const PathshalaStatusEnum = z.enum(["YES", "NO", "PREVIOUSLY_ATTENDED", "UNKNOWN"]);
export const PreferredDayEnum = z.enum(["SATURDAY", "SUNDAY", "WEEKDAY", "NO_PREFERENCE"]);
export const PreferredTimeEnum = z.enum(["MORNING", "AFTERNOON", "EVENING", "NO_PREFERENCE"]);
export const TransportPreferenceEnum = z.enum(["PICK_AND_DROP", "BY_SELF", "NONE"]).optional().nullable();

export const MemberInputSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(2, "Member name must have at least 2 characters").max(100),
    dateOfBirth: z.string().optional().nullable(),
    age: z.coerce.number().int().min(0, "Age cannot be negative").max(120, "Age must be valid"),
    gender: GenderEnum,
    relationship: RelationshipEnum,
    pathshalaStatus: PathshalaStatusEnum.default("UNKNOWN"),
    preferredDay: PreferredDayEnum.default("NO_PREFERENCE"),
    preferredTime: PreferredTimeEnum.default("NO_PREFERENCE"),
    preferredWeekdays: z.string().optional().nullable(),
    transportPreference: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.dateOfBirth && data.dateOfBirth.trim()) {
      try {
        const calculated = calculateAgeFromDob(data.dateOfBirth);
        if (calculated !== null) {
          // Server enforces: age MUST match calculated age from date of birth
          data.age = calculated;
        }
      } catch (err: any) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: err?.message || "Invalid date of birth",
          path: ["dateOfBirth"],
        });
      }
    }
  });

export const FamilyFormSchema = z
  .object({
    headName: z.string().min(2, "Head of family name is required").max(100),
    headDateOfBirth: z.string().optional().nullable(),
    headAge: z.coerce.number().int().min(1, "Valid age required").max(120),
    headGender: GenderEnum.default("MALE"),
    mobile: z.string().min(10, "Valid mobile number is required (min 10 digits)").max(15),
    address: z.string().min(5, "Address must have at least 5 characters").max(300),
    area: z.string().min(2, "Area or locality is required").max(100),
    sanghId: z.string().min(1, "Please select a Sangh"),
    headPathshalaStatus: PathshalaStatusEnum.default("UNKNOWN"),
    headPreferredDay: PreferredDayEnum.default("NO_PREFERENCE"),
    headPreferredTime: PreferredTimeEnum.default("NO_PREFERENCE"),
    headPreferredWeekdays: z.string().optional().nullable(),
    headTransportPreference: z.string().optional().nullable(),
    headWhatsappConsent: z.boolean().optional(),
    members: z.array(MemberInputSchema).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.headDateOfBirth && data.headDateOfBirth.trim()) {
      try {
        const calculated = calculateAgeFromDob(data.headDateOfBirth);
        if (calculated !== null) {
          data.headAge = calculated;
        }
      } catch (err: any) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: err?.message || "Invalid head date of birth",
          path: ["headDateOfBirth"],
        });
      }
    }
  });

export type MemberInput = z.infer<typeof MemberInputSchema>;
export type FamilyFormValues = z.infer<typeof FamilyFormSchema>;
