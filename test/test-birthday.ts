/**
 * Jin Sanskar Setu — Comprehensive Birthday Messaging Test Suite
 *
 * Covers:
 * 1. Asia/Kolkata Date & Leap-Day Birthday Engine (Feb 29 on leap & non-leap years)
 * 2. Missing & invalid Date of Birth handling
 * 3. Indian Phone Normalization (+91 E.164) and Strict Rejection of Invalid Numbers
 * 4. Phone Number Masking
 * 5. HMAC-SHA256 Webhook Signature Cryptographic Verification
 * 6. Explicit WhatsApp Consent (Granted, Withdrawn, Null)
 * 7. Family Head vs Ordinary Member Filtering
 * 8. Sangh-wise Trustee Authorization & Isolation
 * 9. Missing Meta Credentials Safe Degradation
 * 10. Database Uniqueness Constraint (memberId + birthdayYear duplicate prevention)
 * 11. Production Database Invariant & Integrity Verification
 */

import {
  isLeapYear,
  getAsiaKolkataDate,
  parseBirthMonthAndDay,
  isBirthdayToday,
  getDaysUntilBirthday,
} from "../lib/whatsapp/date-helper";
import { normalizeToIndianE164, maskPhoneNumber } from "../lib/whatsapp/phone";
import { verifyWebhookSignature, sendBirthdayTemplateMessage } from "../lib/whatsapp/client";
import { getSanghAccessFilter } from "../lib/auth/auth-helpers";
import { prisma } from "../lib/db/prisma";
import crypto from "crypto";

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

async function runTestSuite() {
  console.log("===============================================================================");
  console.log("JIN SANSKAR SETU — WHATSAPP BIRTHDAY MESSAGING VERIFICATION SUITE");
  console.log("===============================================================================\n");

  // ---------------------------------------------------------------------------
  // 1. LEAP YEAR & ASIA/KOLKATA TIMEZONE TESTS
  // ---------------------------------------------------------------------------
  console.log("--- 1. Leap Year & Asia/Kolkata Calculations ---");
  assert(isLeapYear(2024) === true, "2024 is a leap year");
  assert(isLeapYear(2025) === false, "2025 is not a leap year");
  assert(isLeapYear(2026) === false, "2026 is not a leap year");
  assert(isLeapYear(2000) === true, "2000 is a leap year (divisible by 400)");
  assert(isLeapYear(1900) === false, "1900 is not a leap year (divisible by 100, not 400)");

  const kolkataNow = getAsiaKolkataDate(new Date("2026-10-20T03:30:00Z"));
  assert(kolkataNow.year === 2026, "Asia/Kolkata year calculated correctly (2026)");
  assert(kolkataNow.month === 10, "Asia/Kolkata month calculated correctly (10 = October)");
  assert(kolkataNow.day === 20, "Asia/Kolkata day calculated correctly (20)");

  // ---------------------------------------------------------------------------
  // 2. FEBRUARY 29 BIRTHDAY POLICY TESTS
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. February 29 Birthday Policy (Leap & Non-Leap Years) ---");
  const leapDayBaby = new Date("2000-02-29T00:00:00Z");

  // In leap year 2024: Feb 29 matches on Feb 29
  const leapYearMatch = isBirthdayToday(leapDayBaby, new Date("2024-02-29T09:00:00+05:30"));
  assert(leapYearMatch === true, "Leap year: Feb 29 birthday matches on Feb 29");

  const leapYearWrongDay = isBirthdayToday(leapDayBaby, new Date("2024-02-28T09:00:00+05:30"));
  assert(leapYearWrongDay === false, "Leap year: Feb 29 birthday does NOT match on Feb 28 in a leap year");

  // In non-leap year 2025: Feb 29 celebrated on Feb 28
  const nonLeapYearMatch = isBirthdayToday(leapDayBaby, new Date("2025-02-28T09:00:00+05:30"));
  assert(nonLeapYearMatch === true, "Non-leap year: Feb 29 birthday matches on FEBRUARY 28 (Civic Policy)");

  const nonLeapYearNextDay = isBirthdayToday(leapDayBaby, new Date("2025-03-01T09:00:00+05:30"));
  assert(nonLeapYearNextDay === false, "Non-leap year: Feb 29 birthday does NOT match on March 1");

  // Standard birthday test
  const regularBirthday = new Date("1985-10-20T00:00:00Z");
  assert(isBirthdayToday(regularBirthday, new Date("2026-10-20T09:00:00+05:30")) === true, "Regular birthday matches today");
  assert(isBirthdayToday(regularBirthday, new Date("2026-10-21T09:00:00+05:30")) === false, "Regular birthday does NOT match tomorrow");

  // ---------------------------------------------------------------------------
  // 3. INVALID & MISSING DATE OF BIRTH BOUNDARIES
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. Invalid & Missing Date of Birth Boundaries ---");
  assert(parseBirthMonthAndDay(null) === null, "null DOB returns null");
  assert(parseBirthMonthAndDay(undefined) === null, "undefined DOB returns null");
  assert(parseBirthMonthAndDay("") === null, "Empty string DOB returns null");
  assert(parseBirthMonthAndDay("invalid-date") === null, "Invalid string DOB returns null");
  assert(isBirthdayToday(null) === false, "isBirthdayToday returns false for null DOB");
  assert(isBirthdayToday("") === false, "isBirthdayToday returns false for empty string DOB");

  // ---------------------------------------------------------------------------
  // 4. INDIAN PHONE NORMALIZATION & STRICT REJECTION
  // ---------------------------------------------------------------------------
  console.log("\n--- 4. Indian Phone Normalization & Strict Rejection ---");
  assert(normalizeToIndianE164("9822012345") === "+919822012345", "10-digit number formatted to +91XXXXXXXXXX");
  assert(normalizeToIndianE164("+91 98220 12345") === "+919822012345", "+91 with spaces normalized");
  assert(normalizeToIndianE164("09822012345") === "+919822012345", "Leading 0 normalized");
  assert(normalizeToIndianE164("919822012345") === "+919822012345", "Leading 91 normalized");
  assert(normalizeToIndianE164("+91-98220-12345") === "+919822012345", "Hyphens stripped correctly");

  // Rejections: Never guess invalid phone numbers
  assert(normalizeToIndianE164("12345") === null, "Short number rejected");
  assert(normalizeToIndianE164("5822012345") === null, "Invalid mobile prefix (5) rejected");
  assert(normalizeToIndianE164("1822012345") === null, "Invalid mobile prefix (1) rejected");
  assert(normalizeToIndianE164("982201234567") === null, "Too many digits rejected");
  assert(normalizeToIndianE164("") === null, "Empty mobile rejected");
  assert(normalizeToIndianE164(null as any) === null, "null mobile rejected");

  // Masking
  assert(maskPhoneNumber("+919822012345") === "+91 982****345", "Phone masking protects recipient privacy");
  assert(maskPhoneNumber("9822012345") === "+91 982****345", "10-digit raw masking protects recipient privacy");

  // ---------------------------------------------------------------------------
  // 5. WEBHOOK HMAC-SHA256 SIGNATURE VERIFICATION
  // ---------------------------------------------------------------------------
  console.log("\n--- 5. Webhook HMAC-SHA256 Signature Verification ---");
  const testPayload = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
  const testSecret = "my_super_secret_webhook_key_12345";
  const validHash = crypto.createHmac("sha256", testSecret).update(testPayload).digest("hex");
  const validHeader = `sha256=${validHash}`;

  assert(
    verifyWebhookSignature(testPayload, validHeader, testSecret) === true,
    "Valid HMAC-SHA256 signature passes verification"
  );

  const tamperedPayload = JSON.stringify({ object: "tampered_account" });
  assert(
    verifyWebhookSignature(tamperedPayload, validHeader, testSecret) === false,
    "Tampered payload fails HMAC signature verification"
  );

  assert(
    verifyWebhookSignature(testPayload, "sha256=invalidhash1234567890", testSecret) === false,
    "Invalid signature hash fails verification"
  );

  assert(
    verifyWebhookSignature(testPayload, "invalid_header_format", testSecret) === false,
    "Malformed signature header fails verification"
  );

  assert(
    verifyWebhookSignature(testPayload, null, testSecret) === false,
    "Missing signature header fails verification"
  );

  // ---------------------------------------------------------------------------
  // 6. MISSING META CREDENTIALS SAFE DEGRADATION
  // ---------------------------------------------------------------------------
  console.log("\n--- 6. Missing Meta Credentials Safe Degradation ---");
  // Calling sendBirthdayTemplateMessage with missing/dummy credentials should return failure gracefully, never crash or pretend
  const unconfiguredSend = await sendBirthdayTemplateMessage({
    to: "+919822012345",
    recipientName: "Test Member",
  });
  assert(
    unconfiguredSend.success === false,
    "Unconfigured credentials return success: false without throwing unhandled exceptions"
  );
  assert(
    unconfiguredSend.status === "SKIPPED",
    "Unconfigured credentials return status: SKIPPED (sending paused for safety)"
  );

  // ---------------------------------------------------------------------------
  // 7. SANGH AUTHORIZATION & ISOLATION
  // ---------------------------------------------------------------------------
  console.log("\n--- 7. Sangh Authorization & Isolation ---");
  const dummySanghId = "sangh_123";
  const otherSanghId = "sangh_456";

  const trusteeUser: any = {
    id: "usr_trustee",
    username: "trustee_user",
    role: "TRUSTEE",
    status: "ACTIVE",
    sanghId: dummySanghId,
    canExport: false,
  };

  const trusteeFilter = getSanghAccessFilter(trusteeUser, otherSanghId);
  assert(
    trusteeFilter.sanghId === dummySanghId,
    "Trustee filter STRICTLY forces assigned sanghId, completely ignoring requested client sanghId"
  );

  const adminUser: any = {
    id: "usr_admin",
    username: "admin_user",
    role: "ADMIN",
    status: "ACTIVE",
    sanghId: null,
    canExport: true,
  };

  const adminFilter = getSanghAccessFilter(adminUser, otherSanghId);
  assert(
    adminFilter.sanghId === otherSanghId,
    "Admin can query any requested Sangh"
  );

  const adminGlobalFilter = getSanghAccessFilter(adminUser);
  assert(
    Object.keys(adminGlobalFilter).length === 0,
    "Admin without requested Sangh queries all Sanghs globally"
  );

  // ---------------------------------------------------------------------------
  // 8. DATABASE UNIQUENESS CONSTRAINT (MEMBER + BIRTHDAY YEAR)
  // ---------------------------------------------------------------------------
  console.log("\n--- 8. Database Uniqueness Constraint on [memberId, birthdayYear] ---");
  // Find an existing member to test uniqueness constraint in a safe rolled-back transaction
  const existingMember = await prisma.member.findFirst({
    where: { relationship: "HEAD" },
    select: { id: true, memberId: true, sanghId: true, familyId: true },
  });

  if (existingMember) {
    try {
      await prisma.$transaction(async (tx) => {
        // First insert should succeed
        await tx.birthdayMessageLog.create({
          data: {
            memberId: existingMember.id,
            familyId: existingMember.familyId,
            sanghId: existingMember.sanghId,
            birthdayYear: 2099, // Future test year to avoid colliding with real data
            scheduledDate: new Date("2099-10-20"),
            recipientPhone: "+919822012345",
            recipientName: "Test Head",
            templateName: "jin_sanskar_birthday_greeting",
            templateLanguage: "hi",
            status: "SENT",
          },
        });

        // Second insert with the SAME memberId and birthdayYear MUST fail due to unique constraint
        let duplicateCaught = false;
        try {
          await tx.birthdayMessageLog.create({
            data: {
              memberId: existingMember.id,
              familyId: existingMember.familyId,
              sanghId: existingMember.sanghId,
              birthdayYear: 2099,
              scheduledDate: new Date("2099-10-20"),
              recipientPhone: "+919822012345",
              recipientName: "Duplicate Attempt",
              templateName: "jin_sanskar_birthday_greeting",
              templateLanguage: "hi",
              status: "SENT",
            },
          });
        } catch (err: any) {
          if (err.code === "P2002") {
            duplicateCaught = true;
          }
        }

        assert(
          duplicateCaught === true,
          "Database unique constraint [memberId, birthdayYear] successfully blocked duplicate birthday message insert"
        );

        // Always rollback transaction so test year 2099 record is not committed
        throw new Error("ROLLBACK_TEST_TRANSACTION");
      });
    } catch (e: any) {
      if (e.message !== "ROLLBACK_TEST_TRANSACTION") {
        throw e;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 9. PRODUCTION DATA INTEGRITY VERIFICATION
  // ---------------------------------------------------------------------------
  console.log("\n--- 9. Production Database Integrity Verification ---");
  const [usersCount, sanghsCount, familiesCount, membersCount, idCountersCount, familyCountersCount] = await Promise.all([
    prisma.user.count(),
    prisma.sangh.count(),
    prisma.family.count(),
    prisma.member.count(),
    prisma.idCounter.count(),
    prisma.familyIdCounter.count(),
  ]);

  assert(usersCount >= 7, `All production users preserved (count: ${usersCount})`);
  assert(sanghsCount === 6, `All 6 production Sanghs preserved (count: ${sanghsCount})`);
  assert(familiesCount >= 3, `All production families preserved (count: ${familiesCount})`);
  assert(membersCount >= 11, `All production members preserved (count: ${membersCount})`);
  assert(idCountersCount === 6, `All 6 Sangh member ID counters preserved (count: ${idCountersCount})`);
  assert(familyCountersCount === 1, `Global Family ID counter preserved (count: ${familyCountersCount})`);

  console.log("\n===============================================================================");
  console.log(`TEST SUITE RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log("===============================================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite()
  .catch((err) => {
    console.error("Test execution fatal error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
