import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function resetData() {
  console.log("🧹 [RESET] Starting clean-up of all test family and member data...");

  // 1. Delete dependent tables
  const delQuestionnaires = await prisma.questionnaireResponse.deleteMany({});
  console.log(`  ✓ Deleted ${delQuestionnaires.count} questionnaire responses`);

  const delBirthdays = await prisma.birthdayMessageLog.deleteMany({});
  console.log(`  ✓ Deleted ${delBirthdays.count} birthday message logs`);

  const delSheetSyncs = await prisma.googleSheetSync.deleteMany({});
  console.log(`  ✓ Deleted ${delSheetSyncs.count} Google sheet syncs`);

  const delAccessRequests = await prisma.memberAccessRequest.deleteMany({});
  console.log(`  ✓ Deleted ${delAccessRequests.count} member access requests`);

  const delLavaajam = await prisma.lavaajamRecord.deleteMany({});
  console.log(`  ✓ Deleted ${delLavaajam.count} lavaajam records`);

  const delSubmissions = await prisma.memberFormSubmission.deleteMany({});
  console.log(`  ✓ Deleted ${delSubmissions.count} member form submissions`);

  // 2. Delete members
  const delMembers = await prisma.member.deleteMany({});
  console.log(`  ✓ Deleted ${delMembers.count} members`);

  // 3. Delete families
  const delFamilies = await prisma.family.deleteMany({});
  console.log(`  ✓ Deleted ${delFamilies.count} families`);

  // 4. Reset sequence counters so next tests start cleanly at 0001
  await prisma.familyIdCounter.upsert({
    where: { id: "GLOBAL_FAMILY_COUNTER" },
    update: { lastNumber: 0 },
    create: { id: "GLOBAL_FAMILY_COUNTER", lastNumber: 0 },
  });
  console.log("  ✓ Reset Family ID counter to 0");

  await prisma.idCounter.updateMany({
    data: { lastNumber: 0 },
  });
  console.log("  ✓ Reset Sangh Member ID counters to 0");

  try {
    await prisma.submissionCounter.upsert({
      where: { id: "GLOBAL_SUBMISSION_COUNTER" },
      update: { lastNumber: 0 },
      create: { id: "GLOBAL_SUBMISSION_COUNTER", lastNumber: 0 },
    });
    console.log("  ✓ Reset Member Form Submission counter to 0");
  } catch {
    // Ignore if table not yet populated
  }

  console.log("✨ [RESET COMPLETE] All family and member data removed successfully! Database is ready for fresh testing.");
}

resetData()
  .catch((e) => {
    console.error("❌ Reset error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
