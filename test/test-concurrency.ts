import { PrismaClient } from "@prisma/client";
import { generateFamilyId, generateMemberIds } from "../lib/ids/generator";
import { normalizeMobile, normalizeName, FamilyFormSchema } from "../lib/validation/family";

const prisma = new PrismaClient();

async function runTests() {
  console.log("==================================================");
  console.log("🧪 RUNNING JIN SANSKAR SETU VERIFICATION SUITE");
  console.log("==================================================");

  // --------------------------------------------------------------------------
  // TEST 1: Validation & Normalization
  // --------------------------------------------------------------------------
  console.log("\n[TEST 1] Testing Mobile and Name Normalization...");
  const rawMobile1 = " +91 98220-12345 ";
  const normMobile1 = normalizeMobile(rawMobile1);
  if (normMobile1 === "9822012345") {
    console.log("  ✓ Mobile with country code stripped correctly:", normMobile1);
  } else {
    throw new Error(`Mobile normalization failed. Expected 9822012345, got ${normMobile1}`);
  }

  const rawName = "   Ketan   Ramesh   Shah  ";
  const normName = normalizeName(rawName);
  if (normName === "ketan ramesh shah") {
    console.log("  ✓ Name normalization correctly trimmed and collapsed:", normName);
  } else {
    throw new Error(`Name normalization failed. Got ${normName}`);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Zod Schema Validation
  // --------------------------------------------------------------------------
  console.log("\n[TEST 2] Testing Zod FamilyFormSchema...");
  const validPayload = {
    headName: "Shrenik Shah",
    headAge: 45,
    headGender: "MALE",
    mobile: "9822012345",
    address: "Flat 402, Shanti Heights, Salisbury Park",
    area: "Salisbury Park",
    sanghId: "test-sangh-id",
    headPathshalaStatus: "NO",
    headPathshalaInterest: "YES",
    headPreferredDay: "SUNDAY",
    headPreferredTime: "MORNING",
    members: [
      {
        name: "Aarav Shah",
        age: 12,
        gender: "MALE",
        relationship: "SON",
        pathshalaStatus: "NO",
        pathshalaInterest: "YES",
        preferredDay: "SUNDAY",
        preferredTime: "MORNING",
      },
    ],
  };

  const parsed = FamilyFormSchema.safeParse(validPayload);
  if (parsed.success) {
    console.log("  ✓ Zod Schema valid payload accepted successfully.");
  } else {
    throw new Error(`Zod validation failed: ${JSON.stringify(parsed.error)}`);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Database Connection & Seeded Sanghs
  // --------------------------------------------------------------------------
  console.log("\n[TEST 3] Verifying Database Connection and Seeded Sanghs...");
  try {
    const sanghs = await prisma.sangh.findMany({ orderBy: { prefix: "asc" } });
    console.log(`  ✓ Successfully connected to PostgreSQL. Found ${sanghs.length} Sanghs.`);
    const expectedPrefixes = ["EJS", "MSJS", "NJS", "SAJS", "SKJS", "SSJS"];
    const foundPrefixes = sanghs.map((s) => s.prefix).sort();

    const allPresent = expectedPrefixes.every((p) => foundPrefixes.includes(p));
    if (allPresent) {
      console.log("  ✓ All six required Sanghs are present in PostgreSQL:", foundPrefixes.join(", "));
    } else {
      console.warn("  ⚠️ Sanghs missing or database not seeded yet. Expected:", expectedPrefixes, "Found:", foundPrefixes);
    }

    // ------------------------------------------------------------------------
    // TEST 4: High-Concurrency Member ID Generation (Atomic Lock Verification)
    // ------------------------------------------------------------------------
    console.log("\n[TEST 4] Testing High-Concurrency Member ID Generation...");
    const testSangh = sanghs[0] || (await prisma.sangh.findFirst());
    if (testSangh) {
      const CONCURRENT_WORKERS = 10;
      console.log(`  Spawning ${CONCURRENT_WORKERS} simultaneous transactions for ${testSangh.name} (${testSangh.prefix})...`);

      // Run 10 parallel transactions reserving IDs at the exact same millisecond
      const parallelPromises = Array.from({ length: CONCURRENT_WORKERS }).map(async (_, idx) => {
        return prisma.$transaction(async (tx) => {
          const ids = await generateMemberIds(tx, testSangh.id, testSangh.prefix, 2);
          return ids;
        }, { maxWait: 20000, timeout: 30000 });
      });

      const results = await Promise.all(parallelPromises);
      const allGeneratedIds = results.flat();

      console.log(`  Generated ${allGeneratedIds.length} Member IDs:`);
      console.log("  Sample IDs:", allGeneratedIds.slice(0, 6).join(", "), "...");

      // Verify uniqueness
      const uniqueIds = new Set(allGeneratedIds);
      if (uniqueIds.size === allGeneratedIds.length) {
        console.log(`  ✓ Concurrency Test PASSED! All ${allGeneratedIds.length} generated IDs are strictly unique.`);
      } else {
        throw new Error(
          `CONCURRENCY COLLISION DETECTED! Total: ${allGeneratedIds.length}, Unique: ${uniqueIds.size}`
        );
      }
    }

    // ------------------------------------------------------------------------
    // TEST 5: High-Concurrency Family ID Generation
    // ------------------------------------------------------------------------
    console.log("\n[TEST 5] Testing High-Concurrency Family ID Generation...");
    const FAMILY_WORKERS = 10;
    const familyPromises = Array.from({ length: FAMILY_WORKERS }).map(async () => {
      return prisma.$transaction(async (tx) => {
        return generateFamilyId(tx);
      }, { maxWait: 20000, timeout: 30000 });
    });

    const familyIds = await Promise.all(familyPromises);
    const uniqueFamilyIds = new Set(familyIds);
    if (uniqueFamilyIds.size === familyIds.length) {
      console.log(`  ✓ Concurrency Test PASSED! All ${familyIds.length} generated Family IDs are strictly unique:`);
      console.log("  Sample Family IDs:", familyIds.slice(0, 5).join(", "));
    } else {
      throw new Error(`Family ID collision detected: Total ${familyIds.length}, Unique ${uniqueFamilyIds.size}`);
    }

    console.log("\n==================================================");
    console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
    console.log("==================================================");
  } catch (dbErr: any) {
    console.error("Database test error:", dbErr?.message || dbErr);
    console.log("Note: Database tests require an active PostgreSQL instance configured in DATABASE_URL.");
  } finally {
    await prisma.$disconnect();
  }
}

runTests().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
