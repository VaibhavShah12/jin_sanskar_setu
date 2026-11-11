import { prisma } from "../lib/db/prisma";

async function runSafeMigration() {
  console.log("==================================================");
  console.log("🛡️ RUNNING SAFE ADDITIVE MIGRATION: GHORPADI SANGH & NEW FIELDS");
  console.log("==================================================");

  try {
    // 1. Add Ghorpadi Jain Sangh with prefix GJS
    console.log("1. Upserting Ghorpadi Jain Sangh (GJS)...");
    const ghorpadiSangh = await prisma.sangh.upsert({
      where: { prefix: "GJS" },
      update: { name: "Ghorpadi Jain Sangh", active: true },
      create: { name: "Ghorpadi Jain Sangh", prefix: "GJS", active: true },
    });

    await prisma.idCounter.upsert({
      where: { sanghId: ghorpadiSangh.id },
      update: {},
      create: { sanghId: ghorpadiSangh.id, lastNumber: 0 },
    });
    console.log(`   ✓ Sangh: ${ghorpadiSangh.name} (${ghorpadiSangh.prefix}) upserted successfully.`);

    // 2. Add columns to families table
    console.log("2. Adding volunteerName and filledByMember to families table...");
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "families" 
      ADD COLUMN IF NOT EXISTS "volunteerName" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "families" 
      ADD COLUMN IF NOT EXISTS "filledByMember" TEXT;
    `);
    console.log("   ✓ volunteerName & filledByMember added to families table.");

    // 3. Make mobile and normalizedMobile optional/default empty in families table
    console.log("3. Making mobile and normalizedMobile columns nullable with default in families table...");
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "families" ALTER COLUMN "mobile" DROP NOT NULL;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "families" ALTER COLUMN "mobile" SET DEFAULT '';
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "families" ALTER COLUMN "normalizedMobile" DROP NOT NULL;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "families" ALTER COLUMN "normalizedMobile" SET DEFAULT '';
    `);
    console.log("   ✓ families mobile columns updated safely.");

    // 4. Add husbandName to members table
    console.log("4. Adding husbandName column to members table...");
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "members" 
      ADD COLUMN IF NOT EXISTS "husbandName" TEXT;
    `);
    console.log("   ✓ husbandName added to members table.");

    console.log("==================================================");
    console.log("🎉 ALL MIGRATIONS COMPLETED SAFELY!");
    console.log("==================================================");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runSafeMigration();

