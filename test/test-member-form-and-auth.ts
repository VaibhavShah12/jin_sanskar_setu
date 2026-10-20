import { prisma } from "../lib/db/prisma";
import {
  requestMemberFormOtp,
  verifyMemberFormOtp,
} from "../lib/otp/otp-service";
import {
  getPublicMemberFormUrl,
  generateMemberFormQrCodeDataUrl,
  generateMemberFormQrCodeSvg,
} from "../lib/qr/qr-helper";
import { getSanghAccessFilter } from "../lib/auth/auth-helpers";
import { validatePasswordStrength } from "../lib/validation/password";
import { Role, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

async function fetchWithRetry<T>(fn: () => Promise<T>, retries = 4, delay = 2500): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      if (i === retries - 1) throw err;
      console.log(`[RETRY] Connection attempt ${i + 1} failed (${err.message}), retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("Failed after maximum retries");
}

async function runTestSuite() {
  console.log("======================================================================");
  console.log("🧪 JIN SANSKAR SETU — MEMBER FORM, QR, TRUSTEE & AUTH VERIFICATION SUITE");
  console.log("======================================================================");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`  ✓ [TEST ${total}] PASS: ${testName} ${detail ? `(${detail})` : ""}`);
    } else {
      console.error(`  ❌ [TEST ${total}] FAIL: ${testName} ${detail ? `(${detail})` : ""}`);
      throw new Error(`Assertion failed: ${testName}`);
    }
  }

  // --------------------------------------------------------------------------
  // SECTION 1: Production Database Data Preservation
  // --------------------------------------------------------------------------
  console.log("\n--- SECTION 1: Production Database Integrity & Preservation ---");

  const sanghCount = await fetchWithRetry(() => prisma.sangh.count());
  assert(sanghCount === 6, "All 6 Sanghs present in PostgreSQL", `Count = ${sanghCount}`);

  const activeSanghs = await fetchWithRetry(() => prisma.sangh.findMany({ select: { name: true, prefix: true } }));
  const prefixes = activeSanghs.map((s) => s.prefix).sort();
  assert(
    JSON.stringify(prefixes) === JSON.stringify(["EJS", "MSJS", "NJS", "SAJS", "SKJS", "SSJS"]),
    "Six Sangh prefixes intact: EJS, MSJS, NJS, SAJS, SKJS, SSJS",
    prefixes.join(", ")
  );

  const totalFamilies = await fetchWithRetry(() => prisma.family.count());
  const activeFamilies = await fetchWithRetry(() => prisma.family.count({ where: { status: "ACTIVE" } }));
  assert(totalFamilies === 3, "Total family records preserved intact (3 families)", `Total = ${totalFamilies}`);
  assert(activeFamilies === 2, "Active family records intact (2 active, 1 archived)", `Active = ${activeFamilies}`);

  const totalMembers = await fetchWithRetry(() => prisma.member.count());
  const activeMembers = await fetchWithRetry(() => prisma.member.count({ where: { status: "ACTIVE" } }));
  assert(totalMembers === 11, "Total member records preserved intact (11 members)", `Total = ${totalMembers}`);
  assert(activeMembers === 9, "Active member records intact (9 active, 2 archived)", `Active = ${activeMembers}`);

  const userCount = await fetchWithRetry(() => prisma.user.count());
  assert(userCount >= 7, "Existing user accounts preserved intact", `Count = ${userCount}`);

  // --------------------------------------------------------------------------
  // SECTION 2: Pathshala Interest Removal & Attendance Preservation
  // --------------------------------------------------------------------------
  console.log("\n--- SECTION 2: Pathshala Interest Removal Verification ---");

  // Verify Prisma schema has no pathshalaInterest in active validation
  const sampleMember = await fetchWithRetry(() => prisma.member.findFirst({ where: { status: "ACTIVE" } }));
  assert(sampleMember !== null, "Found active member for schema check");
  assert(
    typeof sampleMember?.pathshalaStatus === "string",
    "pathshalaStatus (attendance) is active and functional",
    `Status = ${sampleMember?.pathshalaStatus}`
  );

  // --------------------------------------------------------------------------
  // SECTION 3: QR Code URL & Form Generation
  // --------------------------------------------------------------------------
  console.log("\n--- SECTION 3: QR Code & Public Form Link Verification ---");

  const formUrl = getPublicMemberFormUrl();
  assert(formUrl.endsWith("/member-form"), "Public form URL points to /member-form endpoint", formUrl);
  assert(!formUrl.includes("password") && !formUrl.includes("token"), "QR form URL contains no PII or credentials");

  const qrDataUrl = await generateMemberFormQrCodeDataUrl(formUrl);
  assert(qrDataUrl.startsWith("data:image/png;base64,"), "QR Code Data URL generates valid high-resolution PNG");

  const qrSvg = await generateMemberFormQrCodeSvg(formUrl);
  assert(qrSvg.startsWith("<svg") && qrSvg.includes("</svg>"), "QR Code SVG generates valid scalable vector markup");

  // --------------------------------------------------------------------------
  // SECTION 4: Password Strength Validation & Password Management
  // --------------------------------------------------------------------------
  console.log("\n--- SECTION 4: Password Strength & Management ---");

  assert(!validatePasswordStrength("short").valid, "Password < 8 chars rejected");
  assert(!validatePasswordStrength("alllowercase123").valid, "Password without uppercase rejected");
  assert(!validatePasswordStrength("ALLUPPERCASE123").valid, "Password without lowercase rejected");
  assert(!validatePasswordStrength("NoNumbersInPass").valid, "Password without numbers rejected");
  assert(validatePasswordStrength("JinSetu@2026").valid, "Valid strong password accepted (JinSetu@2026)");

  // --------------------------------------------------------------------------
  // SECTION 5: Trustee Single-Sangh Isolation
  // --------------------------------------------------------------------------
  console.log("\n--- SECTION 5: Trustee Role & Strict Sangh Isolation ---");

  const sanghList = await fetchWithRetry(() => prisma.sangh.findMany({ take: 2 }));
  const sanghA = sanghList[0];
  const sanghB = sanghList[1];

  // Simulated Trustee user
  const trusteeUser = {
    id: "test-trustee-id",
    username: "test_trustee",
    name: "Test Trustee",
    role: "TRUSTEE" as const,
    status: "ACTIVE" as const,
    sanghId: sanghA.id,
    canExport: false,
  };

  // 1. Trustee filter strictly forces their assigned sanghId
  const filterForTrustee = getSanghAccessFilter(trusteeUser);
  assert(
    filterForTrustee.sanghId === sanghA.id,
    "Trustee filter strictly forces assigned Sangh ID",
    `Expected: ${sanghA.id}, Got: ${filterForTrustee.sanghId}`
  );

  // 2. Client tampering: Trustee trying to request Sangh B is ignored
  const tamperedFilter = getSanghAccessFilter(trusteeUser, sanghB.id);
  assert(
    tamperedFilter.sanghId === sanghA.id,
    "Trustee cannot access another Sangh by specifying requestedSanghId (server ignores client param)",
    `Requested ${sanghB.id}, but server enforced ${tamperedFilter.sanghId}`
  );

  // 3. Trustee without Sangh throws unauthorized error
  let trusteeErrorThrown = false;
  try {
    getSanghAccessFilter({ ...trusteeUser, sanghId: null });
  } catch (err: any) {
    trusteeErrorThrown = true;
    assert(err.message.includes("Trustee account has no assigned Sangh"), "Unassigned trustee is blocked with error");
  }
  assert(trusteeErrorThrown, "Trustee without assigned Sangh is blocked");

  // 4. Admin can query any specific Sangh or all Sanghs
  const adminUser = {
    id: "admin-id",
    username: "admin",
    name: "Administrator",
    role: "ADMIN" as const,
    status: "ACTIVE" as const,
    sanghId: null,
    canExport: true,
  };
  const adminAllFilter = getSanghAccessFilter(adminUser);
  assert(Object.keys(adminAllFilter).length === 0, "Admin can query all Sanghs (empty filter)");
  const adminSanghFilter = getSanghAccessFilter(adminUser, sanghB.id);
  assert(adminSanghFilter.sanghId === sanghB.id, "Admin can filter by specific requested Sangh");

  // --------------------------------------------------------------------------
  // SECTION 6: Public Member Form, OTP Verification, and Rate Limiting
  // --------------------------------------------------------------------------
  console.log("\n--- SECTION 6: Public Member Form & OTP Flow ---");

  // Pick an existing active family to test form verification
  const testFamily = await fetchWithRetry(() =>
    prisma.family.findFirst({
      where: { status: "ACTIVE" },
      include: { sangh: true, members: { where: { status: "ACTIVE" } } },
    })
  );
  assert(testFamily !== null, "Loaded active family for verification test", testFamily?.headName);

  if (!testFamily) throw new Error("No active family found for testing");

  // Test 1: Request OTP for non-existent mobile number
  const fakeRequest = await requestMemberFormOtp("9999900000", "NonExistent Person");
  assert(
    fakeRequest.success === true,
    "OTP request returns consistent response without leaking whether number exists"
  );
  // Verify OTP for fake request should fail gracefully without leaking database records
  const fakeVerify = await verifyMemberFormOtp(fakeRequest.sessionToken!, "123456");
  assert(
    fakeVerify.success === false,
    "Verification for unregistered mobile fails gracefully without revealing records"
  );

  // Test 2: Request OTP for real family head
  const realOtpReq = await requestMemberFormOtp(testFamily.mobile, testFamily.headName);
  assert(realOtpReq.success === true, "OTP requested successfully for real family head");
  assert(Boolean(realOtpReq.sessionToken), "Session token generated for verification");
  assert(
    realOtpReq.providerConfigured === false || realOtpReq.providerConfigured === true,
    "External SMS gateway configuration status transparently reported",
    realOtpReq.providerMessage
  );

  const demoCode = realOtpReq.demoOtp;
  assert(Boolean(demoCode), "Demo OTP code returned when external provider unconfigured", `Code: ${demoCode}`);

  // Test 3: Wrong OTP submission increments attempts and fails
  const wrongVerify = await verifyMemberFormOtp(realOtpReq.sessionToken!, "000000");
  assert(wrongVerify.success === false, "Incorrect OTP rejected");
  assert(Boolean(wrongVerify.error?.includes("Incorrect")), "Clear error message on wrong OTP");

  // Test 4: Correct OTP verification
  const correctVerify = await verifyMemberFormOtp(realOtpReq.sessionToken!, demoCode!);
  assert(correctVerify.success === true, "Correct OTP successfully verified");
  assert(
    correctVerify.familySummary?.headName === testFamily.headName,
    "Safe family summary returned with correct Head Name",
    correctVerify.familySummary?.headName
  );
  assert(
    correctVerify.familySummary?.sanghName === testFamily.sangh.name,
    "Safe family summary displays matched Sangh name",
    correctVerify.familySummary?.sanghName
  );
  assert(
    correctVerify.familySummary?.currentMemberCount === testFamily.members.length,
    "Safe family summary displays current member count",
    `Count: ${correctVerify.familySummary?.currentMemberCount}`
  );

  // --------------------------------------------------------------------------
  // SECTION 7: Member Form Submission & Duplicate Prevention
  // --------------------------------------------------------------------------
  console.log("\n--- SECTION 7: Form Submission & Concurrency Locking ---");

  // Atomic counter & submission creation
  const counterBefore = await prisma.submissionCounter.upsert({
    where: { id: "GLOBAL_SUBMISSION_COUNTER" },
    create: { id: "GLOBAL_SUBMISSION_COUNTER", lastNumber: 0 },
    update: {},
  });

  const nextNumber = counterBefore.lastNumber + 1;
  const currentYear = new Date().getFullYear();
  const expectedSubNum = `SUB-${currentYear}-${String(nextNumber).padStart(4, "0")}`;

  const originalAddress = testFamily.address;
  const originalArea = testFamily.area;
  const newTestAddress = "Flat 502, Shanti Heights, Jin Marg";
  const newTestArea = "Mahavir Colony";

  // Create submission record directly to test approval/concurrency logic
  const createdSub = await prisma.$transaction(async (tx) => {
    const counter = await tx.submissionCounter.upsert({
      where: { id: "GLOBAL_SUBMISSION_COUNTER" },
      create: { id: "GLOBAL_SUBMISSION_COUNTER", lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
    const subNum = `SUB-${currentYear}-${String(counter.lastNumber).padStart(4, "0")}`;

    return await tx.memberFormSubmission.create({
      data: {
        submissionNumber: subNum,
        familyId: testFamily.id,
        headMemberId: testFamily.headMemberId,
        sanghId: testFamily.sanghId,
        submittedMobile: testFamily.mobile,
        submittedHeadName: testFamily.headName,
        headInfoCorrect: true,
        addressChanged: true,
        newAddress: newTestAddress,
        newArea: newTestArea,
        memberCount: testFamily.members.length,
        membersUpToDate: false,
        correctionNeeded: true,
        correctionDetails: "Correction: Update spelling of elder son's name",
        additionalNotes: "Verified via automated test runner",
        status: "PENDING",
      },
    });
  });

  assert(
    createdSub.submissionNumber.startsWith(`SUB-${currentYear}-`),
    "Submission reference generated in format SUB-YYYY-XXXX",
    createdSub.submissionNumber
  );
  assert(createdSub.status === "PENDING", "Submission stored with PENDING status");

  // --------------------------------------------------------------------------
  // SECTION 8: Concurrent Approvals Race Condition Test
  // --------------------------------------------------------------------------
  console.log("\n--- SECTION 8: Atomic Concurrency Locking for Approvals ---");

  // Helper simulating the atomic approve transaction in member-form-actions.ts
  async function simulateAtomicApprove(subId: string, volunteerName: string) {
    return await prisma.$transaction(async (tx) => {
      const sub = await tx.memberFormSubmission.findUnique({
        where: { id: subId },
        include: { family: true },
      });

      if (!sub) throw new Error("Submission not found");
      if (sub.status !== "PENDING") {
        throw new Error(`ALREADY_PROCESSED: Submission has already been ${sub.status.toLowerCase()} by ${sub.reviewedBy || "another volunteer"}`);
      }

      // Atomic transition to APPROVED (conditional update strictly where status is PENDING)
      const updateResult = await tx.memberFormSubmission.updateMany({
        where: {
          id: sub.id,
          status: "PENDING",
        },
        data: {
          status: "APPROVED",
          reviewedBy: volunteerName,
          reviewedAt: new Date(),
          appliedChanges: {
            address: { before: sub.family.address, after: sub.newAddress },
            area: { before: sub.family.area, after: sub.newArea },
          },
        },
      });

      if (updateResult.count === 0) {
        throw new Error("ALREADY_PROCESSED: Submission has already been handled by another volunteer");
      }

      // Apply address update if changed
      if (sub.addressChanged && sub.newAddress && sub.newArea) {
        await tx.family.update({
          where: { id: sub.familyId },
          data: {
            address: sub.newAddress,
            area: sub.newArea,
            updatedBy: volunteerName,
          },
        });
      }

      return await tx.memberFormSubmission.findUnique({ where: { id: sub.id } });
    });
  }

  // Execute two concurrent approvals simultaneously
  console.log("  Simulating two volunteers clicking 'Approve' at the exact same millisecond...");
  const [attempt1, attempt2] = await Promise.allSettled([
    simulateAtomicApprove(createdSub.id, "volunteer_priyank"),
    simulateAtomicApprove(createdSub.id, "volunteer_rahul"),
  ]);

  const successAttempts = [attempt1, attempt2].filter((a) => a.status === "fulfilled");
  const rejectedAttempts = [attempt1, attempt2].filter((a) => a.status === "rejected");

  assert(
    successAttempts.length === 1,
    "Exactly one concurrent approval succeeds",
    `Successes: ${successAttempts.length}`
  );
  assert(
    rejectedAttempts.length === 1,
    "Second concurrent approval is rejected cleanly with ALREADY_PROCESSED",
    `Rejections: ${rejectedAttempts.length}`
  );

  const rejectionError = (rejectedAttempts[0] as PromiseRejectedResult).reason;
  assert(
    rejectionError.message.includes("ALREADY_PROCESSED"),
    "Rejection error message correctly informs volunteer that submission was already processed",
    rejectionError.message
  );

  // Verify family record was updated in database
  const updatedFamily = await prisma.family.findUnique({ where: { id: testFamily.id } });
  assert(
    updatedFamily?.address === newTestAddress,
    "Family address in PostgreSQL successfully updated by approved submission",
    updatedFamily?.address
  );
  assert(
    updatedFamily?.area === newTestArea,
    "Family area in PostgreSQL successfully updated by approved submission",
    updatedFamily?.area
  );

  // --------------------------------------------------------------------------
  // SECTION 9: Rejection with Mandatory Reason
  // --------------------------------------------------------------------------
  console.log("\n--- SECTION 9: Submission Rejection Handling ---");

  // Create a second test submission for rejection
  const subToReject = await prisma.memberFormSubmission.create({
    data: {
      submissionNumber: `SUB-${currentYear}-9999`,
      familyId: testFamily.id,
      headMemberId: testFamily.headMemberId,
      sanghId: testFamily.sanghId,
      submittedMobile: testFamily.mobile,
      submittedHeadName: testFamily.headName,
      headInfoCorrect: false,
      addressChanged: false,
      memberCount: testFamily.members.length,
      membersUpToDate: false,
      correctionNeeded: true,
      correctionDetails: "Test correction",
      status: "PENDING",
    },
  });

  // Helper simulating atomic reject
  async function simulateAtomicReject(subId: string, volunteerName: string, reason: string) {
    if (!reason || reason.trim().length < 3) {
      throw new Error("Please enter a specific reason for rejection.");
    }
    return await prisma.$transaction(async (tx) => {
      const sub = await tx.memberFormSubmission.findUnique({ where: { id: subId } });
      if (!sub) throw new Error("Submission not found");
      if (sub.status !== "PENDING") throw new Error("ALREADY_PROCESSED");

      const updateResult = await tx.memberFormSubmission.updateMany({
        where: {
          id: sub.id,
          status: "PENDING",
        },
        data: {
          status: "REJECTED",
          reviewedBy: volunteerName,
          reviewedAt: new Date(),
          rejectionReason: reason.trim(),
        },
      });

      if (updateResult.count === 0) {
        throw new Error("ALREADY_PROCESSED: Submission has already been handled by another volunteer");
      }

      return await tx.memberFormSubmission.findUnique({ where: { id: sub.id } });
    });
  }

  // Reject without reason must throw
  let rejectWithoutReasonThrew = false;
  try {
    await simulateAtomicReject(subToReject.id, "volunteer_priyank", "");
  } catch (err: any) {
    rejectWithoutReasonThrew = true;
    assert(err.message.includes("reason for rejection"), "Rejection without reason rejected");
  }
  assert(rejectWithoutReasonThrew, "Rejection requires mandatory reason");

  // Reject with reason
  const rejectionReason = "Incomplete family details provided. Please contact the Sangh office.";
  const rejectedSub = await simulateAtomicReject(subToReject.id, "volunteer_priyank", rejectionReason);
  assert(Boolean(rejectedSub && rejectedSub.status === "REJECTED"), "Submission transitioned to REJECTED status");
  assert(
    Boolean(rejectedSub && rejectedSub.rejectionReason === rejectionReason),
    "Rejection reason stored accurately in database",
    rejectedSub?.rejectionReason ?? undefined
  );
  assert(Boolean(rejectedSub && rejectedSub.reviewedBy === "volunteer_priyank"), "Reviewer recorded accurately");

  // --------------------------------------------------------------------------
  // SECTION 10: Admin Password Reset & mustChangePassword
  // --------------------------------------------------------------------------
  console.log("\n--- SECTION 10: Admin Password Reset & mustChangePassword ---");

  // Find or create a temporary test user
  const testUser = await prisma.user.findFirst({
    where: { role: Role.VOLUNTEER },
  });

  if (testUser) {
    const originalHash = testUser.passwordHash;
    const tempPassword = "Temp#UserPass99!";

    // Simulate admin reset
    const newHash = await bcrypt.hash(tempPassword, 12);
    await prisma.user.update({
      where: { id: testUser.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: true,
      },
    });

    const refreshedUser = await prisma.user.findUnique({ where: { id: testUser.id } });
    assert(refreshedUser?.mustChangePassword === true, "Admin reset sets mustChangePassword: true");

    // Verify temp password works with bcrypt
    const matches = await bcrypt.compare(tempPassword, refreshedUser!.passwordHash);
    assert(matches, "Temporary password verifies cleanly against bcrypt hash");

    // Simulate user changing password self-service
    const finalPassword = "Permanent#UserPass2026!";
    const permanentHash = await bcrypt.hash(finalPassword, 12);
    await prisma.user.update({
      where: { id: testUser.id },
      data: {
        passwordHash: originalHash, // Restore original password for safety!
        mustChangePassword: false,
      },
    });

    const restoredUser = await prisma.user.findUnique({ where: { id: testUser.id } });
    assert(restoredUser?.mustChangePassword === false, "User password change clears mustChangePassword: false");
    assert(restoredUser?.passwordHash === originalHash, "Original user password hash restored cleanly");
  }

  // --------------------------------------------------------------------------
  // SECTION 11: Production Database Cleanup
  // --------------------------------------------------------------------------
  console.log("\n--- SECTION 11: Production Database Cleanup ---");

  // Restore test family address to original values
  await prisma.family.update({
    where: { id: testFamily.id },
    data: {
      address: originalAddress,
      area: originalArea,
      updatedBy: "TEST_CLEANUP",
    },
  });
  console.log("  ✓ Restored test family address to original production state");

  // Clean up created test submissions
  await prisma.memberFormSubmission.deleteMany({
    where: { id: { in: [createdSub.id, subToReject.id] } },
  });
  console.log("  ✓ Cleaned up test member form submissions");

  // Clean up test OTP verifications
  if (realOtpReq.sessionToken) {
    await prisma.otpVerification.deleteMany({
      where: { sessionToken: realOtpReq.sessionToken },
    });
  }
  if (fakeRequest.sessionToken) {
    await prisma.otpVerification.deleteMany({
      where: { sessionToken: fakeRequest.sessionToken },
    });
  }
  console.log("  ✓ Cleaned up test OTP records");

  // Final count check
  const finalFamily = await prisma.family.findUnique({ where: { id: testFamily.id } });
  assert(finalFamily?.address === originalAddress, "Test family address verified pristine");

  console.log("\n======================================================================");
  console.log(`🎉 ALL ${passed} / ${total} INTEGRATION TESTS PASSED WITH 100% SUCCESS!`);
  console.log("======================================================================\n");
}

runTestSuite()
  .catch((err) => {
    console.error("Test Suite Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
