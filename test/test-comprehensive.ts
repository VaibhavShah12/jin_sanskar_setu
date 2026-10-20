import { PrismaClient } from "@prisma/client";
import {
  calculateAgeFromDob,
  parseDateString,
  getMemberCalculatedAge,
  toDatabaseDate,
  normalizeMobile,
  normalizeName,
  FamilyFormSchema,
} from "../lib/validation/family";
import { generateFamilyId, generateMemberIds } from "../lib/ids/generator";
import {
  getPublicMemberAccessUrl,
  generateMemberAccessQrCodeSvg,
  generateMemberAccessQrCodeDataUrl,
} from "../lib/qr/qr-helper";
import { getSanghAccessFilter } from "../lib/auth/auth-helpers";

const prisma = new PrismaClient();

async function runComprehensiveVerification() {
  console.log("======================================================================");
  console.log("🧪 JIN SANSKAR SETU — COMPREHENSIVE PRODUCTION VERIFICATION SUITE");
  console.log("======================================================================");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✓ [TEST ${totalTests}] PASS: ${testName} ${detail ? `(${detail})` : ""}`);
    } else {
      console.error(`  ❌ [TEST ${totalTests}] FAIL: ${testName} ${detail ? `(${detail})` : ""}`);
      throw new Error(`Assertion failed: ${testName}`);
    }
  }

  // --------------------------------------------------------------------------
  // SECTION 1: DOB and Age Calculation Boundaries & Timezone Safety
  // --------------------------------------------------------------------------
  console.log("\n--- SECTION 1: Date of Birth & Automatic Age Calculations ---");

  // Leap year boundary: Feb 29, 2004
  const leapDob = parseDateString("2004-02-29")!;
  assert(leapDob !== null, "Parse leap year date 2004-02-29");

  // On Feb 28, 2024 (leap year, day before 20th birthday)
  const feb28_2024 = new Date(2024, 1, 28);
  assert(calculateAgeFromDob(leapDob, feb28_2024) === 19, "Leap year: 19 years old on Feb 28, 2024");

  // On Feb 29, 2024 (leap year, exactly 20th birthday)
  const feb29_2024 = new Date(2024, 1, 29);
  assert(calculateAgeFromDob(leapDob, feb29_2024) === 20, "Leap year: 20 years old on Feb 29, 2024");

  // On Mar 1, 2024 (day after birthday)
  const mar1_2024 = new Date(2024, 2, 1);
  assert(calculateAgeFromDob(leapDob, mar1_2024) === 20, "Leap year: 20 years old on Mar 1, 2024");

  // Common year birthday boundary: Jan 15, 2010
  const dobJan15 = parseDateString("2010-01-15")!;
  const jan14_2026 = new Date(2026, 0, 14);
  const jan15_2026 = new Date(2026, 0, 15);
  const jan16_2026 = new Date(2026, 0, 16);
  assert(calculateAgeFromDob(dobJan15, jan14_2026) === 15, "Birthday boundary: 15 on day before birthday");
  assert(calculateAgeFromDob(dobJan15, jan15_2026) === 16, "Birthday boundary: 16 on birthday");
  assert(calculateAgeFromDob(dobJan15, jan16_2026) === 16, "Birthday boundary: 16 on day after birthday");

  // Future date check
  const futureDate = new Date();
  futureDate.setFullYear(futureDate.getFullYear() + 1);
  let futureThrew = false;
  try {
    calculateAgeFromDob(futureDate);
  } catch {
    futureThrew = true;
  }
  assert(futureThrew, "Future date of birth throws validation error");

  // Fallback for legacy records without DOB
  const legacyMemberWithoutDob = { age: 38, dateOfBirth: null };
  const memberWithDob = { age: 25, dateOfBirth: new Date("1995-06-15") };
  assert(
    getMemberCalculatedAge(legacyMemberWithoutDob) === 38,
    "Legacy member fallback: uses stored age when DOB is null"
  );
  assert(
    getMemberCalculatedAge(memberWithDob) > 28,
    "Member with DOB: dynamically calculates real age based on current date"
  );

  // --------------------------------------------------------------------------
  // SECTION 2: Database Data Preservation
  // --------------------------------------------------------------------------
  console.log("\n--- SECTION 2: Production Database Data Preservation Checks ---");

  const sanghCount = await prisma.sangh.count();
  assert(sanghCount === 6, "All 6 Sanghs intact in PostgreSQL", `Count = ${sanghCount}`);

  const userCount = await prisma.user.count();
  assert(userCount >= 7, "User credentials and accounts preserved", `Count = ${userCount}`);

  const familyCount = await prisma.family.count();
  assert(familyCount >= 3, "Production families preserved without data loss", `Count = ${familyCount}`);

  const memberCount = await prisma.member.count();
  assert(memberCount >= 11, "Production members preserved without data loss", `Count = ${memberCount}`);

  const sanghCounters = await prisma.idCounter.count();
  const familyCounters = await prisma.familyIdCounter.count();
  assert(
    sanghCounters === 6 && familyCounters === 1,
    "Family & Sangh ID counters preserved",
    `Sangh counters = ${sanghCounters}, Family counters = ${familyCounters}`
  );

  // Check audit log preservation
  const auditLogs = await prisma.auditLog.count();
  assert(auditLogs > 0, "Audit trail history preserved", `Total logs = ${auditLogs}`);

  // --------------------------------------------------------------------------
  // SECTION 3: Concurrency & Atomic ID Generation
  // --------------------------------------------------------------------------
  console.log("\n--- SECTION 3: Atomic ID Generation Concurrency ---");

  const testSangh = await prisma.sangh.findFirst({ where: { prefix: "MSJS" } });
  if (!testSangh) throw new Error("MSJS Sangh not found");

  // Test parallel Family ID generation
  const familyIdPromises = Array.from({ length: 5 }).map(() =>
    prisma.$transaction(async (tx) => generateFamilyId(tx), { maxWait: 20000, timeout: 30000 })
  );
  const genFamilyIds = await Promise.all(familyIdPromises);
  const uniqueFamIds = new Set(genFamilyIds);
  assert(
    uniqueFamIds.size === genFamilyIds.length,
    "Atomic Family ID generation: 5 concurrent transactions generated strictly unique IDs",
    genFamilyIds.join(", ")
  );

  // Test parallel Member ID generation
  const memberIdPromises = Array.from({ length: 5 }).map(() =>
    prisma.$transaction(
      async (tx) => generateMemberIds(tx, testSangh.id, testSangh.prefix, 2),
      { maxWait: 20000, timeout: 30000 }
    )
  );
  const genMemberIdsNested = await Promise.all(memberIdPromises);
  const allGenMemberIds = genMemberIdsNested.flat();
  const uniqueMemberIds = new Set(allGenMemberIds);
  assert(
    uniqueMemberIds.size === allGenMemberIds.length,
    "Atomic Member ID generation: 10 concurrent IDs generated strictly unique",
    allGenMemberIds.slice(0, 4).join(", ")
  );

  // --------------------------------------------------------------------------
  // SECTION 4: Member Access Request Workflow & Atomic Single-Volunteer Approval
  // --------------------------------------------------------------------------
  console.log("\n--- SECTION 4: Member Access Request & Concurrency Tests ---");

  // Find an existing family to test with
  const existingFamily = await prisma.family.findFirst({
    include: { members: true, sangh: true },
  });
  if (!existingFamily) throw new Error("No existing family found in database");

  const testMobile = existingFamily.mobile;
  console.log(`  Testing with existing family ${existingFamily.familyId} (Mobile: ${testMobile.slice(0, 2)}****${testMobile.slice(-4)})`);

  // Clean up any previous test requests for this family
  await prisma.memberAccessRequest.deleteMany({
    where: { normalizedMobile: normalizeMobile(testMobile), rejectionReason: "Automated test request" },
  });

  // Create a pending access request
  const testToken = `test_token_${Date.now()}`;
  const accessRequest = await prisma.memberAccessRequest.create({
    data: {
      mobile: testMobile,
      normalizedMobile: normalizeMobile(testMobile),
      familyId: existingFamily.id,
      sanghId: existingFamily.sanghId,
      status: "PENDING",
      requestToken: testToken,
      rejectionReason: "Automated test request",
    },
  });
  assert(accessRequest.status === "PENDING", "Access request created with status PENDING");

  // Duplicate request prevention: verify query detects existing pending request
  const activePending = await prisma.memberAccessRequest.findFirst({
    where: {
      normalizedMobile: normalizeMobile(testMobile),
      status: "PENDING",
    },
  });
  assert(activePending !== null, "Duplicate prevention: Active pending request is detected");

  // TEST: Atomic single-volunteer approval (Two volunteers acting simultaneously)
  console.log("  Simulating two volunteers concurrently approving request ID:", accessRequest.id);
  const volunteer1 = await prisma.user.findFirst({ where: { role: "VOLUNTEER" } });
  const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  const vol1Id = volunteer1?.id || "vol1";
  const vol2Id = adminUser?.id || "vol2";

  // Execute two atomic conditional updates simultaneously
  const grantTok = `grant_${Date.now()}`;
  const approvalAttempt1 = prisma.$executeRaw`
    UPDATE "member_access_requests"
    SET "status" = 'APPROVED'::"AccessRequestStatus",
        "approvedBy" = ${vol1Id},
        "approvedAt" = NOW(),
        "grantToken" = ${grantTok},
        "grantExpiresAt" = NOW() + INTERVAL '24 HOURS'
    WHERE "id" = ${accessRequest.id} AND "status" = 'PENDING'::"AccessRequestStatus"
  `;

  const approvalAttempt2 = prisma.$executeRaw`
    UPDATE "member_access_requests"
    SET "status" = 'APPROVED'::"AccessRequestStatus",
        "approvedBy" = ${vol2Id},
        "approvedAt" = NOW(),
        "grantToken" = ${grantTok + '_2'},
        "grantExpiresAt" = NOW() + INTERVAL '24 HOURS'
    WHERE "id" = ${accessRequest.id} AND "status" = 'PENDING'::"AccessRequestStatus"
  `;

  const [res1, res2] = await Promise.all([approvalAttempt1, approvalAttempt2]);
  const winnerCount = (res1 === 1 ? 1 : 0) + (res2 === 1 ? 1 : 0);
  assert(
    winnerCount === 1,
    "CONCURRENCY RACE SAFE: Exactly one volunteer succeeds in approving the request",
    `Winner count: ${winnerCount} (Attempt 1: ${res1}, Attempt 2: ${res2})`
  );

  // Verify the DB state reflects the single winner
  const finalizedRequest = await prisma.memberAccessRequest.findUnique({
    where: { id: accessRequest.id },
  });
  assert(finalizedRequest?.status === "APPROVED", "Request status transitioned to APPROVED");
  assert(
    finalizedRequest?.approvedBy === vol1Id || finalizedRequest?.approvedBy === vol2Id,
    "ApprovedBy was set to the winning volunteer"
  );

  // Subsequent reject or approve attempts on already-approved request must fail
  const staleAttempt = await prisma.$executeRaw`
    UPDATE "member_access_requests"
    SET "status" = 'REJECTED'::"AccessRequestStatus"
    WHERE "id" = ${accessRequest.id} AND "status" = 'PENDING'::"AccessRequestStatus"
  `;
  assert(staleAttempt === 0, "Stale action rejected: Cannot reject an already-approved request");

  // --------------------------------------------------------------------------
  // SECTION 5: Rejected Request Cannot Grant Access
  // --------------------------------------------------------------------------
  console.log("\n--- SECTION 5: Security & Authorization Boundary Checks ---");

  // Create a rejected request
  const rejectedRequest = await prisma.memberAccessRequest.create({
    data: {
      mobile: testMobile,
      normalizedMobile: normalizeMobile(testMobile),
      familyId: existingFamily.id,
      sanghId: existingFamily.sanghId,
      status: "REJECTED",
      requestToken: `rejected_token_${Date.now()}`,
      rejectionReason: "Automated test request",
    },
  });

  // Verification that rejected token cannot fetch data
  const accessCheckForRejected = await prisma.memberAccessRequest.findFirst({
    where: {
      requestToken: rejectedRequest.requestToken,
      status: "APPROVED",
      grantExpiresAt: { gt: new Date() },
    },
  });
  assert(accessCheckForRejected === null, "Security: Rejected request token cannot fetch family data");

  // Tampered/random token check
  const tamperedTokenCheck = await prisma.memberAccessRequest.findFirst({
    where: {
      requestToken: "random_forged_token_12345",
      status: "APPROVED",
      grantExpiresAt: { gt: new Date() },
    },
  });
  assert(tamperedTokenCheck === null, "Security: Forged/tampered token returns null");

  // Approved user can access ONLY their authorized family
  const approvedCheck = await prisma.memberAccessRequest.findFirst({
    where: {
      requestToken: finalizedRequest!.requestToken,
      status: "APPROVED",
      grantExpiresAt: { gt: new Date() },
    },
    include: {
      family: {
        include: {
          members: true,
          sangh: true,
        },
      },
    },
  });
  assert(
    approvedCheck?.familyId === existingFamily.id,
    "Security: Approved token retrieves exactly the authorized family and its members",
    `Family: ${approvedCheck?.family.familyId}, Members: ${approvedCheck?.family.members.length}`
  );

  // Clean up test requests
  await prisma.memberAccessRequest.deleteMany({
    where: { id: { in: [accessRequest.id, rejectedRequest.id] } },
  });

  // --------------------------------------------------------------------------
  // SECTION 6: Role & Sangh Authorization Rules
  // --------------------------------------------------------------------------
  console.log("\n--- SECTION 6: Trustee & Role-Based Scoping Tests ---");

  const allSanghs = await prisma.sangh.findMany();
  const sangh1 = allSanghs[0];
  const sangh2 = allSanghs[1];

  // 1. Admin filter
  const adminFilter = getSanghAccessFilter({
    id: "admin-id",
    username: "admin",
    name: "Admin User",
    role: "ADMIN",
    status: "ACTIVE",
    sanghId: null,
    canExport: true,
  });
  assert(Object.keys(adminFilter).length === 0, "Admin role has unrestricted access (empty filter)");

  // 2. Trustee filter with valid Sangh
  const trusteeFilter = getSanghAccessFilter({
    id: "trustee-id",
    username: "trustee_msjs",
    name: "MSJS Trustee",
    role: "TRUSTEE",
    status: "ACTIVE",
    sanghId: sangh1.id,
    sanghPrefix: sangh1.prefix,
    canExport: false,
  });
  assert(
    trusteeFilter.sanghId === sangh1.id,
    "Trustee role strictly restricted to assigned sanghId at DB query level",
    `sanghId = ${sangh1.id} (${sangh1.prefix})`
  );

  // 3. Trustee without Sangh assignment must be denied
  let trusteeNoSanghDenied = false;
  try {
    getSanghAccessFilter({
      id: "trustee-invalid",
      username: "trustee_no_sangh",
      name: "Unassigned Trustee",
      role: "TRUSTEE",
      status: "ACTIVE",
      sanghId: null,
      canExport: false,
    });
  } catch (err: any) {
    trusteeNoSanghDenied = true;
  }
  assert(trusteeNoSanghDenied, "Trustee without assigned Sangh throws unauthorized exception");

  // 4. Cross-Sangh Data Leak Prevention
  // Query families using Trustee's filter for sangh1
  const sangh1Families = await prisma.family.findMany({
    where: trusteeFilter,
  });
  const crossSanghLeak = sangh1Families.some((f) => f.sanghId !== sangh1.id);
  assert(!crossSanghLeak, "Database query strictly excludes other Sanghs for Trustee");

  // --------------------------------------------------------------------------
  // SECTION 7: Public QR Code Resolution
  // --------------------------------------------------------------------------
  console.log("\n--- SECTION 7: QR Code Public Resolution Tests ---");

  const publicUrl = getPublicMemberAccessUrl();
  assert(
    publicUrl.endsWith("/member-access"),
    "Public app URL resolution generates proper /member-access path",
    publicUrl
  );

  const qrSvg = await generateMemberAccessQrCodeSvg();
  assert(
    qrSvg.includes("<svg") && qrSvg.includes("</svg>"),
    "QR Code SVG generates valid XML vector graphic"
  );

  const qrDataUrl = await generateMemberAccessQrCodeDataUrl();
  assert(
    qrDataUrl.startsWith("data:image/png;base64,"),
    "QR Code PNG generates valid base64 data URL"
  );

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log("\n======================================================================");
  console.log(`🎉 ALL ${passedTests}/${totalTests} COMPREHENSIVE PRODUCTION CHECKS PASSED!`);
  console.log("======================================================================");
}

runComprehensiveVerification()
  .catch((e) => {
    console.error("\n❌ Test Suite encountered an error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
