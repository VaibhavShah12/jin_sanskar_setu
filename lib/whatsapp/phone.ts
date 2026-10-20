/**
 * Indian Mobile Phone Number Normalization and E.164 Formatting
 * Official WhatsApp Cloud API requires valid E.164 international phone format.
 *
 * Requirements:
 * - Must be an active 10-digit Indian mobile number (starting with 6, 7, 8, or 9).
 * - Strips leading +91, 91, 0, whitespace, hyphens, and parentheses.
 * - Rejects numbers that do not conform to Indian telecom standards (no guessing).
 * - Formats valid numbers strictly as +91XXXXXXXXXX.
 */

export function normalizeToIndianE164(phone: string | null | undefined): string | null {
  if (!phone || typeof phone !== "string") return null;

  // Remove all non-numeric characters
  let digits = phone.replace(/[^0-9]/g, "");

  // If starts with country code 91 and has 12 digits total
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.substring(2);
  }

  // If starts with trunk prefix 0 and has 11 digits total
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.substring(1);
  }

  // Validate exact 10 digits and starts with 6, 7, 8, or 9
  if (digits.length !== 10) {
    return null;
  }

  const firstDigit = digits.charAt(0);
  if (!["6", "7", "8", "9"].includes(firstDigit)) {
    return null;
  }

  return `+91${digits}`;
}

/**
 * Masks phone number for privacy in UI views and logs (e.g. "+91 982****345")
 */
export function maskPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "******";
  const normalized = normalizeToIndianE164(phone) || phone;
  if (normalized.length < 8) return "******";

  // Format: +91 982****345
  if (normalized.startsWith("+91") && normalized.length === 13) {
    const area = normalized.substring(0, 3); // +91
    const prefix = normalized.substring(3, 6); // 982
    const suffix = normalized.substring(10); // 345
    return `${area} ${prefix}****${suffix}`;
  }

  return normalized.substring(0, 4) + "****" + normalized.substring(normalized.length - 3);
}
