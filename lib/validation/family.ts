import { z } from "zod";

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

// Name normalization helper: lowercases and collapses consecutive whitespace
export function normalizeName(name: string): string {
  if (!name) return "";
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

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
export const PathshalaInterestEnum = z.enum(["YES", "MAYBE", "NO", "UNKNOWN"]);
export const PreferredDayEnum = z.enum(["SATURDAY", "SUNDAY", "WEEKDAY", "NO_PREFERENCE"]);
export const PreferredTimeEnum = z.enum(["MORNING", "AFTERNOON", "EVENING", "NO_PREFERENCE"]);

export const TransportPreferenceEnum = z.enum(["PICK_AND_DROP", "BY_SELF", "NONE"]).optional().nullable();

export const MemberInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Member name must have at least 2 characters").max(100),
  age: z.coerce.number().int().min(0, "Age cannot be negative").max(120, "Age must be valid"),
  gender: GenderEnum,
  relationship: RelationshipEnum,
  pathshalaStatus: PathshalaStatusEnum.default("UNKNOWN"),
  pathshalaInterest: PathshalaInterestEnum.default("UNKNOWN"),
  preferredDay: PreferredDayEnum.default("NO_PREFERENCE"),
  preferredTime: PreferredTimeEnum.default("NO_PREFERENCE"),
  preferredWeekdays: z.string().optional().nullable(),
  transportPreference: z.string().optional().nullable(),
  noInterestReason: z.string().optional().nullable(),
});

export const FamilyFormSchema = z.object({
  headName: z.string().min(2, "Head of family name is required").max(100),
  headAge: z.coerce.number().int().min(1, "Valid age required").max(120),
  headGender: GenderEnum.default("MALE"),
  mobile: z.string().min(10, "Valid mobile number is required (min 10 digits)").max(15),
  address: z.string().min(5, "Address must have at least 5 characters").max(300),
  area: z.string().min(2, "Area or locality is required").max(100),
  sanghId: z.string().min(1, "Please select a Sangh"),
  headPathshalaStatus: PathshalaStatusEnum.default("UNKNOWN"),
  headPathshalaInterest: PathshalaInterestEnum.default("UNKNOWN"),
  headPreferredDay: PreferredDayEnum.default("NO_PREFERENCE"),
  headPreferredTime: PreferredTimeEnum.default("NO_PREFERENCE"),
  headPreferredWeekdays: z.string().optional().nullable(),
  headTransportPreference: z.string().optional().nullable(),
  headNoInterestReason: z.string().optional().nullable(),
  members: z.array(MemberInputSchema).default([]),
});

export type MemberInput = z.infer<typeof MemberInputSchema>;
export type FamilyFormValues = z.infer<typeof FamilyFormSchema>;
