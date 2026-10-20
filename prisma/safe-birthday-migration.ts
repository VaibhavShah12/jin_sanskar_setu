import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runSafeBirthdayMigration() {
  console.log("=================================================================");
  console.log("🚀 EXECUTING SAFE ADDITIVE BIRTHDAY MESSAGING MIGRATION");
  console.log("=================================================================");

  const statements = [
    // 1. Add WhatsApp consent fields to members table
    `ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "whatsappConsent" BOOLEAN NOT NULL DEFAULT false;`,
    `ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "whatsappConsentDate" TIMESTAMP(3);`,
    `ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "whatsappConsentSource" TEXT;`,
    `ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "whatsappConsentUpdatedBy" TEXT;`,

    // 2. Create BirthdayMessageStatus enum safely
    `DO $$ BEGIN
      CREATE TYPE "BirthdayMessageStatus" AS ENUM ('SCHEDULED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SKIPPED');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    // 3. Create birthday_message_logs table
    `CREATE TABLE IF NOT EXISTS "birthday_message_logs" (
      "id" TEXT NOT NULL,
      "memberId" TEXT NOT NULL,
      "familyId" TEXT NOT NULL,
      "sanghId" TEXT NOT NULL,
      "birthdayYear" INTEGER NOT NULL,
      "scheduledDate" DATE NOT NULL,
      "recipientName" TEXT NOT NULL,
      "recipientPhone" TEXT NOT NULL,
      "templateName" TEXT NOT NULL,
      "templateLanguage" TEXT NOT NULL,
      "status" "BirthdayMessageStatus" NOT NULL DEFAULT 'SCHEDULED',
      "whatsappMessageId" TEXT,
      "attemptCount" INTEGER NOT NULL DEFAULT 0,
      "lastAttemptAt" TIMESTAMP(3),
      "sentAt" TIMESTAMP(3),
      "deliveredAt" TIMESTAMP(3),
      "readAt" TIMESTAMP(3),
      "failedAt" TIMESTAMP(3),
      "failureReason" TEXT,
      "skipReason" TEXT,
      "responsePayload" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "birthday_message_logs_pkey" PRIMARY KEY ("id")
    );`,

    // 4. Create unique constraint preventing duplicate birthday messages per member per year
    `CREATE UNIQUE INDEX IF NOT EXISTS "birthday_message_logs_memberId_birthdayYear_key" ON "birthday_message_logs"("memberId", "birthdayYear");`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "birthday_message_logs_whatsappMessageId_key" ON "birthday_message_logs"("whatsappMessageId");`,

    // 5. Create performance indexes
    `CREATE INDEX IF NOT EXISTS "birthday_message_logs_status_idx" ON "birthday_message_logs"("status");`,
    `CREATE INDEX IF NOT EXISTS "birthday_message_logs_sanghId_idx" ON "birthday_message_logs"("sanghId");`,
    `CREATE INDEX IF NOT EXISTS "birthday_message_logs_scheduledDate_idx" ON "birthday_message_logs"("scheduledDate");`,
    `CREATE INDEX IF NOT EXISTS "birthday_message_logs_birthdayYear_idx" ON "birthday_message_logs"("birthdayYear");`,
    `CREATE INDEX IF NOT EXISTS "birthday_message_logs_whatsappMessageId_idx" ON "birthday_message_logs"("whatsappMessageId");`,

    // 6. Add Foreign Keys safely
    `DO $$ BEGIN
      ALTER TABLE "birthday_message_logs" ADD CONSTRAINT "birthday_message_logs_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    `DO $$ BEGIN
      ALTER TABLE "birthday_message_logs" ADD CONSTRAINT "birthday_message_logs_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    `DO $$ BEGIN
      ALTER TABLE "birthday_message_logs" ADD CONSTRAINT "birthday_message_logs_sanghId_fkey" FOREIGN KEY ("sanghId") REFERENCES "sanghs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,
  ];

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    console.log(`[MIGRATION ${i + 1}/${statements.length}] Running statement...`);
    try {
      await prisma.$executeRawUnsafe(stmt);
      console.log(`  ✓ Success`);
    } catch (err: any) {
      console.error(`  ❌ Error in statement: ${err?.message || err}`);
      throw err;
    }
  }

  console.log("\n=================================================================");
  console.log("🎉 SAFE ADDITIVE BIRTHDAY MIGRATION COMPLETED SUCCESSFULLY!");
  console.log("=================================================================");
}

runSafeBirthdayMigration()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
