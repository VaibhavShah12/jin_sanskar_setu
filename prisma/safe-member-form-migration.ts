import { prisma } from "../lib/db/prisma";

async function runSafeMigration() {
  console.log("[MIGRATION] Starting safe additive migration for Member Form, OTP & User Password management...");

  const queries = [
    // 1. Add mustChangePassword column to users table if not exists
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;`,

    // 2. Create SubmissionStatus enum if not exists
    `DO $$ BEGIN
       CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
     EXCEPTION
       WHEN duplicate_object THEN null;
     END $$;`,

    // 3. Create member_form_submissions table if not exists
    `CREATE TABLE IF NOT EXISTS "member_form_submissions" (
       "id" TEXT NOT NULL PRIMARY KEY,
       "submissionNumber" TEXT NOT NULL UNIQUE,
       "familyId" TEXT NOT NULL REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
       "headMemberId" TEXT,
       "sanghId" TEXT NOT NULL REFERENCES "sanghs"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
       "submittedMobile" TEXT NOT NULL,
       "submittedHeadName" TEXT NOT NULL,
       "headInfoCorrect" BOOLEAN NOT NULL DEFAULT true,
       "addressChanged" BOOLEAN NOT NULL DEFAULT false,
       "newAddress" TEXT,
       "newArea" TEXT,
       "memberCount" INTEGER NOT NULL,
       "membersUpToDate" BOOLEAN NOT NULL DEFAULT true,
       "correctionNeeded" BOOLEAN NOT NULL DEFAULT false,
       "correctionDetails" TEXT,
       "additionalNotes" TEXT,
       "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
       "reviewedBy" TEXT,
       "reviewedAt" TIMESTAMP(3),
       "rejectionReason" TEXT,
       "appliedChanges" JSONB,
       "ipAddress" TEXT,
       "userAgent" TEXT,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
       "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
     );`,

    // 4. Indexes for member_form_submissions
    `CREATE INDEX IF NOT EXISTS "member_form_submissions_status_idx" ON "member_form_submissions"("status");`,
    `CREATE INDEX IF NOT EXISTS "member_form_submissions_submittedMobile_idx" ON "member_form_submissions"("submittedMobile");`,
    `CREATE INDEX IF NOT EXISTS "member_form_submissions_familyId_idx" ON "member_form_submissions"("familyId");`,
    `CREATE INDEX IF NOT EXISTS "member_form_submissions_sanghId_idx" ON "member_form_submissions"("sanghId");`,
    `CREATE INDEX IF NOT EXISTS "member_form_submissions_createdAt_idx" ON "member_form_submissions"("createdAt");`,

    // 5. Create otp_verifications table if not exists
    `CREATE TABLE IF NOT EXISTS "otp_verifications" (
       "id" TEXT NOT NULL PRIMARY KEY,
       "mobile" TEXT NOT NULL,
       "codeHash" TEXT NOT NULL,
       "sessionToken" TEXT NOT NULL UNIQUE,
       "familyId" TEXT,
       "attempts" INTEGER NOT NULL DEFAULT 0,
       "verified" BOOLEAN NOT NULL DEFAULT false,
       "expiresAt" TIMESTAMP(3) NOT NULL,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
       "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
     );`,

    // 6. Indexes for otp_verifications
    `CREATE INDEX IF NOT EXISTS "otp_verifications_mobile_idx" ON "otp_verifications"("mobile");`,
    `CREATE INDEX IF NOT EXISTS "otp_verifications_sessionToken_idx" ON "otp_verifications"("sessionToken");`,

    // 7. Create submission_counters table if not exists
    `CREATE TABLE IF NOT EXISTS "submission_counters" (
       "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'GLOBAL_SUBMISSION_COUNTER',
       "lastNumber" INTEGER NOT NULL DEFAULT 0,
       "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
     );`,

    // 8. Seed default row in submission_counters
    `INSERT INTO "submission_counters" ("id", "lastNumber", "updatedAt")
     VALUES ('GLOBAL_SUBMISSION_COUNTER', 0, CURRENT_TIMESTAMP)
     ON CONFLICT ("id") DO NOTHING;`
  ];

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    console.log(`Executing step ${i + 1}/${queries.length}...`);
    let success = false;
    let attempts = 0;
    while (!success && attempts < 5) {
      try {
        attempts++;
        await prisma.$executeRawUnsafe(q);
        success = true;
      } catch (err: any) {
        if (attempts >= 5) throw err;
        console.log(`Attempt ${attempts} failed (${err.message}), retrying in 3000ms...`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  console.log("[MIGRATION] Safe additive migration completed successfully!");
}

runSafeMigration()
  .catch((e) => {
    console.error("[MIGRATION ERROR]:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
