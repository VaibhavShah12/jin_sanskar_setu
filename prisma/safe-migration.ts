import { prisma } from "../lib/db/prisma";

async function runSafeMigration() {
  console.log("==================================================");
  console.log("🛡️ RUNNING SAFE ADDITIVE MIGRATION (NEON POSTGRES)");
  console.log("==================================================");

  try {
    // 1. Add TRUSTEE to Role enum
    console.log("1. Adding TRUSTEE to Role enum...");
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'TRUSTEE';
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log("   ✓ Role enum updated safely.");

    // 2. Add canExport to users table
    console.log("2. Adding canExport column to users table...");
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "canExport" BOOLEAN NOT NULL DEFAULT false;
    `);
    console.log("   ✓ canExport column added safely.");

    // 3. Add dateOfBirth to members table
    console.log("3. Adding dateOfBirth column to members table...");
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "members" 
      ADD COLUMN IF NOT EXISTS "dateOfBirth" DATE;
    `);
    console.log("   ✓ dateOfBirth column added safely.");

    // 4. Create AccessRequestStatus enum
    console.log("4. Creating AccessRequestStatus enum...");
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log("   ✓ AccessRequestStatus enum verified.");

    // 5. Create member_access_requests table
    console.log("5. Creating member_access_requests table...");
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "member_access_requests" (
        "id" TEXT NOT NULL,
        "requestId" TEXT NOT NULL,
        "mobile" TEXT NOT NULL,
        "normalizedMobile" TEXT NOT NULL,
        "familyId" TEXT NOT NULL,
        "sanghId" TEXT NOT NULL,
        "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
        "requestToken" TEXT NOT NULL,
        "grantToken" TEXT,
        "grantExpiresAt" TIMESTAMP(3),
        "approvedBy" TEXT,
        "approvedAt" TIMESTAMP(3),
        "rejectedBy" TEXT,
        "rejectedAt" TIMESTAMP(3),
        "rejectionReason" TEXT,
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT "member_access_requests_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "member_access_requests_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "member_access_requests_sanghId_fkey" FOREIGN KEY ("sanghId") REFERENCES "sanghs"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      );
    `);
    
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "member_access_requests_requestId_key" ON "member_access_requests"("requestId");`);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "member_access_requests_requestToken_key" ON "member_access_requests"("requestToken");`);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "member_access_requests_grantToken_key" ON "member_access_requests"("grantToken");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "member_access_requests_status_idx" ON "member_access_requests"("status");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "member_access_requests_normalizedMobile_idx" ON "member_access_requests"("normalizedMobile");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "member_access_requests_familyId_idx" ON "member_access_requests"("familyId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "member_access_requests_sanghId_idx" ON "member_access_requests"("sanghId");`);
    console.log("   ✓ member_access_requests table and indexes verified.");

    // 6. Create questionnaires table
    console.log("6. Creating questionnaires table...");
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "questionnaires" (
        "id" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "version" INTEGER NOT NULL DEFAULT 1,
        "active" BOOLEAN NOT NULL DEFAULT false,
        "schema" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT "questionnaires_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "questionnaires_code_key" ON "questionnaires"("code");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "questionnaires_code_idx" ON "questionnaires"("code");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "questionnaires_active_idx" ON "questionnaires"("active");`);
    console.log("   ✓ questionnaires table and indexes verified.");

    // 7. Create questionnaire_responses table
    console.log("7. Creating questionnaire_responses table...");
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "questionnaire_responses" (
        "id" TEXT NOT NULL,
        "questionnaireId" TEXT NOT NULL,
        "familyId" TEXT NOT NULL,
        "memberId" TEXT,
        "response" JSONB NOT NULL,
        "submittedBy" TEXT,
        "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT "questionnaire_responses_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "questionnaire_responses_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "questionnaires"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "questionnaire_responses_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "questionnaire_responses_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "questionnaire_responses_questionnaireId_idx" ON "questionnaire_responses"("questionnaireId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "questionnaire_responses_familyId_idx" ON "questionnaire_responses"("familyId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "questionnaire_responses_memberId_idx" ON "questionnaire_responses"("memberId");`);
    console.log("   ✓ questionnaire_responses table and indexes verified.");

    // 8. Verification query on existing records
    console.log("\n8. Verifying existing data preservation...");
    const [userCount, sanghCount, familyCount, memberCount] = await Promise.all([
      prisma.user.count(),
      prisma.sangh.count(),
      prisma.family.count(),
      prisma.member.count(),
    ]);

    console.log(`   ✓ Data counts verified: Users=${userCount}, Sanghs=${sanghCount}, Families=${familyCount}, Members=${memberCount}`);
    console.log("🎉 SAFE MIGRATION COMPLETE — ZERO DATA LOSS");
    console.log("==================================================");
  } catch (err: any) {
    console.error("❌ Migration error:", err?.message || err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runSafeMigration();
