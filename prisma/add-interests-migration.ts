import { prisma } from "../lib/db/prisma";

async function run() {
  console.log("[MIGRATION] Checking and adding interests column to members table...");
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "interests" TEXT[] DEFAULT ARRAY[]::TEXT[];
  `);
  console.log("[MIGRATION] Column 'interests' added or verified successfully!");
}

run()
  .catch((err) => {
    console.error("[MIGRATION ERROR]:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
