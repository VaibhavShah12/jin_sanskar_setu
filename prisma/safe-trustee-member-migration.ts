import { prisma } from "../lib/db/prisma";

async function runMigration() {
  console.log("Running safe database migration for Trustee Registration & Member WhatsApp...");

  try {
    // 1. Add PENDING to UserStatus enum
    console.log("1. Adding PENDING to UserStatus enum...");
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'PENDING';
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log("   ✓ UserStatus enum updated with PENDING.");

    // 2. Add phone column to users table
    console.log("2. Adding phone column to users table...");
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "phone" TEXT;
    `);
    console.log("   ✓ phone column added to users table.");

    // 3. Add whatsappNumber to members table
    console.log("3. Adding whatsappNumber column to members table...");
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "members" 
      ADD COLUMN IF NOT EXISTS "whatsappNumber" TEXT;
    `);
    console.log("   ✓ whatsappNumber column added to members table.");

    console.log("\nMigration completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
