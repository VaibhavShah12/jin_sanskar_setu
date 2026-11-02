"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAuth, requireVolunteerOrAdmin, getSanghAccessFilter } from "@/lib/auth/auth-helpers";
import { logAuditEvent } from "@/lib/audit/logger";
import {
  requestMemberFormOtp,
  verifyMemberFormOtp,
  RequestOtpResult,
  VerifyOtpResult,
} from "@/lib/otp/otp-service";
import { Prisma } from "@prisma/client";
import { normalizeMobile } from "@/lib/validation/family";

export interface MemberFormSubmissionInput {
  sessionToken: string;
  headInfoCorrect: boolean;
  addressChanged: boolean;
  newAddress?: string;
  newArea?: string;
  memberCount: number;
  membersUpToDate: boolean;
  correctionNeeded: boolean;
  correctionDetails?: string;
  additionalNotes?: string;
}

/**
 * Public action: requests OTP for registered mobile number + head name
 */
export async function requestOtpAction(mobile: string, headName: string): Promise<RequestOtpResult> {
  try {
    return await requestMemberFormOtp(mobile, headName);
  } catch (error: any) {
    console.error("[MEMBER_FORM] requestOtpAction error:", error);
    return {
      success: false,
      providerConfigured: false,
      providerMessage: "",
      error: error?.message || "Failed to process OTP request.",
    };
  }
}

/**
 * Public action: verifies OTP and returns safe family summary
 */
export async function verifyOtpAction(sessionToken: string, otp: string): Promise<VerifyOtpResult> {
  try {
    return await verifyMemberFormOtp(sessionToken, otp);
  } catch (error: any) {
    console.error("[MEMBER_FORM] verifyOtpAction error:", error);
    return {
      success: false,
      error: error?.message || "Verification failed.",
    };
  }
}

/**
 * Public action: submits member form using verified session token
 */
export async function submitMemberFormAction(input: MemberFormSubmissionInput) {
  const {
    sessionToken,
    headInfoCorrect,
    addressChanged,
    newAddress,
    newArea,
    memberCount,
    membersUpToDate,
    correctionNeeded,
    correctionDetails,
    additionalNotes,
  } = input;

  if (!sessionToken) {
    return { success: false, error: "Missing verification session. Please verify your mobile number first." };
  }

  // Validate session record
  const otpRecord = await prisma.otpVerification.findUnique({
    where: { sessionToken },
  });

  if (!otpRecord || !otpRecord.verified || !otpRecord.familyId) {
    return { success: false, error: "Invalid or unverified session. Please verify your identity." };
  }

  // Load family record
  const family = await prisma.family.findUnique({
    where: { id: otpRecord.familyId },
    include: { sangh: true },
  });

  if (!family || family.status !== "ACTIVE") {
    return { success: false, error: "Associated family record is inactive. Please contact your Sangh." };
  }

  // Duplicate submission check: prevent rapid resubmissions while pending review
  const existingPending = await prisma.memberFormSubmission.findFirst({
    where: {
      familyId: family.id,
      status: "PENDING",
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingPending) {
    return {
      success: false,
      isDuplicate: true,
      submissionNumber: existingPending.submissionNumber,
      error: `A submission (${existingPending.submissionNumber}) is already pending review for this household. To avoid duplicate processing, please allow the volunteer team to review it.`,
    };
  }

  // Numeric member count validation
  const parsedCount = Number(memberCount);
  if (isNaN(parsedCount) || parsedCount < 1 || parsedCount > 50) {
    return { success: false, error: "Please enter a valid number of household members (1 to 50)." };
  }

  if (addressChanged && (!newAddress || newAddress.trim().length < 5)) {
    return { success: false, error: "Please provide your new residential address." };
  }

  if (addressChanged && (!newArea || newArea.trim().length < 2)) {
    return { success: false, error: "Please provide your new area or locality." };
  }

  if (correctionNeeded && (!correctionDetails || correctionDetails.trim().length < 2)) {
    return { success: false, error: "Please describe the required member corrections." };
  }

  try {
    const submission = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Atomic sequence increment for submission reference number
      const counter = await tx.submissionCounter.upsert({
        where: { id: "GLOBAL_SUBMISSION_COUNTER" },
        create: { id: "GLOBAL_SUBMISSION_COUNTER", lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
      });

      const currentYear = new Date().getFullYear();
      const paddedNum = String(counter.lastNumber).padStart(4, "0");
      const submissionNumber = `SUB-${currentYear}-${paddedNum}`;

      // 2. Create submission record (PENDING status)
      const created = await tx.memberFormSubmission.create({
        data: {
          submissionNumber,
          familyId: family.id,
          headMemberId: family.headMemberId,
          sanghId: family.sanghId,
          submittedMobile: otpRecord.mobile,
          submittedHeadName: family.headName,
          headInfoCorrect,
          addressChanged,
          newAddress: addressChanged ? newAddress?.trim() : null,
          newArea: addressChanged ? newArea?.trim() : null,
          memberCount: parsedCount,
          membersUpToDate,
          correctionNeeded,
          correctionDetails: correctionNeeded ? correctionDetails?.trim() : null,
          additionalNotes: additionalNotes ? additionalNotes.trim() : null,
          status: "PENDING",
        },
      });

      // 3. Immutable audit log entry
      await tx.auditLog.create({
        data: {
          action: "MEMBER_FORM_SUBMITTED",
          entityType: "MemberFormSubmission",
          entityId: created.id,
          performedBy: `MEMBER_${otpRecord.mobile}`,
          metadata: {
            submissionNumber,
            familyId: family.familyId,
            headName: family.headName,
            sanghPrefix: family.sangh.prefix,
            addressChanged,
            correctionNeeded,
          },
        },
      });

      return created;
    });

    return {
      success: true,
      submissionNumber: submission.submissionNumber,
      createdAt: submission.createdAt.toISOString(),
    };
  } catch (error: any) {
    console.error("[MEMBER_FORM] submitMemberFormAction error:", error);
    return {
      success: false,
      error: error?.message || "Failed to submit form. Please try again.",
    };
  }
}

/**
 * Volunteer / Admin action: approve a submission and apply validated changes atomically
 */
export async function approveSubmissionAction(submissionId: string) {
  const user = await requireVolunteerOrAdmin();

  if (!submissionId) {
    return { success: false, error: "Submission ID is required." };
  }

  try {
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Concurrency-Safe Atomic Check: Lock and verify submission is currently PENDING
      const submission = await tx.memberFormSubmission.findUnique({
        where: { id: submissionId },
        include: { family: true, sangh: true },
      });

      if (!submission) {
        throw new Error("Submission not found.");
      }

      if (submission.status !== "PENDING") {
        throw new Error(`ALREADY_PROCESSED: This submission has already been ${submission.status.toLowerCase()} by ${submission.reviewedBy || "another volunteer"}.`);
      }

      // Check Sangh authorization
      if (user.role === "VOLUNTEER" && user.sanghId && user.sanghId !== submission.sanghId) {
        throw new Error("Unauthorized: You do not have permission to review submissions for this Sangh.");
      }

      const appliedChanges: Record<string, any> = {};
      const familyUpdates: Record<string, any> = { updatedBy: user.username };

      if (submission.addressChanged && submission.newAddress && submission.newArea) {
        appliedChanges.address = {
          before: submission.family.address,
          after: submission.newAddress,
        };
        appliedChanges.area = {
          before: submission.family.area,
          after: submission.newArea,
        };
        familyUpdates.address = submission.newAddress;
        familyUpdates.area = submission.newArea;
      }

      if (submission.newNativePlace && submission.newNativePlace.trim()) {
        appliedChanges.nativePlace = {
          before: submission.family.nativePlace,
          after: submission.newNativePlace.trim(),
        };
        familyUpdates.nativePlace = submission.newNativePlace.trim();
      }

      if (submission.newMobile && submission.newMobile.trim()) {
        const cleanMobile = normalizeMobile(submission.newMobile.trim());
        appliedChanges.mobile = {
          before: submission.family.mobile,
          after: submission.newMobile.trim(),
        };
        familyUpdates.mobile = submission.newMobile.trim();
        familyUpdates.normalizedMobile = cleanMobile;
      }

      if (submission.newOccupation && submission.newOccupation.trim() && submission.family.headMemberId) {
        const headMember = await tx.member.findUnique({
          where: { id: submission.family.headMemberId },
        });
        if (headMember) {
          appliedChanges.occupation = {
            before: headMember.occupation,
            after: submission.newOccupation.trim(),
          };
          await tx.member.update({
            where: { id: headMember.id },
            data: {
              occupation: submission.newOccupation.trim(),
              updatedBy: user.username,
            },
          });
        }
      }

      // 2. Atomic transition to APPROVED (conditional update strictly where status is PENDING)
      const updateResult = await tx.memberFormSubmission.updateMany({
        where: {
          id: submission.id,
          status: "PENDING",
        },
        data: {
          status: "APPROVED",
          reviewedBy: user.username,
          reviewedAt: new Date(),
          appliedChanges: Object.keys(appliedChanges).length > 0 ? appliedChanges : Prisma.DbNull,
        },
      });

      if (updateResult.count === 0) {
        throw new Error("ALREADY_PROCESSED: This submission has already been reviewed by another volunteer.");
      }

      // 3. Apply changes to Family record if any field was updated
      if (Object.keys(familyUpdates).length > 1) {
        await tx.family.update({
          where: { id: submission.familyId },
          data: familyUpdates,
        });
      }

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          action: "MEMBER_FORM_APPROVED",
          entityType: "MemberFormSubmission",
          entityId: submission.id,
          performedBy: user.username,
          metadata: {
            submissionNumber: submission.submissionNumber,
            familyId: submission.family.familyId,
            appliedChanges,
          },
        },
      });

      const updatedRecord = await tx.memberFormSubmission.findUnique({
        where: { id: submission.id },
      });

      return updatedRecord;
    });

    return { success: true, submission: result };
  } catch (error: any) {
    console.error("[MEMBER_FORM] approveSubmissionAction error:", error);
    return {
      success: false,
      error: error?.message || "Failed to approve submission.",
    };
  }
}

/**
 * Volunteer / Admin action: reject a submission with mandatory reason
 */
export async function rejectSubmissionAction(submissionId: string, reason: string) {
  const user = await requireVolunteerOrAdmin();

  if (!submissionId) {
    return { success: false, error: "Submission ID is required." };
  }

  const trimmedReason = reason?.trim();
  if (!trimmedReason || trimmedReason.length < 3) {
    return { success: false, error: "Please enter a specific reason for rejection or requesting corrections." };
  }

  try {
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Concurrency check
      const submission = await tx.memberFormSubmission.findUnique({
        where: { id: submissionId },
        include: { family: true },
      });

      if (!submission) {
        throw new Error("Submission not found.");
      }

      if (submission.status !== "PENDING") {
        throw new Error(`ALREADY_PROCESSED: This submission has already been ${submission.status.toLowerCase()} by ${submission.reviewedBy || "another volunteer"}.`);
      }

      if (user.role === "VOLUNTEER" && user.sanghId && user.sanghId !== submission.sanghId) {
        throw new Error("Unauthorized: You do not have permission to review submissions for this Sangh.");
      }

      // Atomic transition to REJECTED (strictly conditional on status == PENDING)
      const updateResult = await tx.memberFormSubmission.updateMany({
        where: {
          id: submission.id,
          status: "PENDING",
        },
        data: {
          status: "REJECTED",
          reviewedBy: user.username,
          reviewedAt: new Date(),
          rejectionReason: trimmedReason,
        },
      });

      if (updateResult.count === 0) {
        throw new Error("ALREADY_PROCESSED: This submission has already been reviewed by another volunteer.");
      }

      const updated = await tx.memberFormSubmission.findUnique({
        where: { id: submission.id },
      });

      await tx.auditLog.create({
        data: {
          action: "MEMBER_FORM_REJECTED",
          entityType: "MemberFormSubmission",
          entityId: submission.id,
          performedBy: user.username,
          metadata: {
            submissionNumber: submission.submissionNumber,
            familyId: submission.family.familyId,
            reason: trimmedReason,
          },
        },
      });

      return updated;
    });

    return { success: true, submission: result };
  } catch (error: any) {
    console.error("[MEMBER_FORM] rejectSubmissionAction error:", error);
    return {
      success: false,
      error: error?.message || "Failed to reject submission.",
    };
  }
}

export interface CorrectionRequestInput {
  familyId: string;
  newAddress?: string;
  newArea?: string;
  newNativePlace?: string;
  newOccupation?: string;
  newMobile?: string;
  correctionDetails?: string;
  additionalNotes?: string;
}

/**
 * Submits a new correction request for an existing family
 */
export async function submitCorrectionRequestAction(input: CorrectionRequestInput) {
  try {
    const family = await prisma.family.findUnique({
      where: { id: input.familyId },
      include: { sangh: true, members: { where: { status: "ACTIVE" } } },
    });

    if (!family) {
      return { success: false, error: "Family record not found." };
    }

    const counter = await prisma.submissionCounter.upsert({
      where: { id: "GLOBAL_SUBMISSION_COUNTER" },
      create: { id: "GLOBAL_SUBMISSION_COUNTER", lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });

    const currentYear = new Date().getFullYear();
    const paddedNum = String(counter.lastNumber).padStart(4, "0");
    const submissionNumber = `REQ-${currentYear}-${paddedNum}`;

    const submission = await prisma.memberFormSubmission.create({
      data: {
        submissionNumber,
        familyId: family.id,
        headMemberId: family.headMemberId,
        sanghId: family.sanghId,
        submittedMobile: input.newMobile?.trim() || family.mobile,
        submittedHeadName: family.headName,
        headInfoCorrect: !Boolean(input.newMobile || input.newOccupation),
        addressChanged: Boolean(input.newAddress && input.newAddress.trim() !== family.address),
        newAddress: input.newAddress?.trim() || null,
        newArea: input.newArea?.trim() || null,
        newNativePlace: input.newNativePlace?.trim() || null,
        newOccupation: input.newOccupation?.trim() || null,
        newMobile: input.newMobile?.trim() || null,
        memberCount: family.members.length,
        membersUpToDate: true,
        correctionNeeded: true,
        correctionDetails: input.correctionDetails?.trim() || null,
        additionalNotes: input.additionalNotes?.trim() || null,
        status: "PENDING",
      },
    });

    await logAuditEvent({
      action: "MEMBER_CORRECTION_REQUESTED",
      entityType: "Family",
      entityId: family.id,
      performedBy: "PORTAL_USER",
      metadata: {
        submissionNumber,
        familyId: family.familyId,
        headName: family.headName,
        sangh: family.sangh.name,
      },
    });

    return {
      success: true,
      submissionNumber,
      submissionId: submission.id,
    };
  } catch (error: any) {
    console.error("[MEMBER_FORM] submitCorrectionRequestAction error:", error);
    return {
      success: false,
      error: error?.message || "Failed to submit correction request.",
    };
  }
}

/**
 * Fetches all correction requests and member form submissions
 */
export async function getCorrectionRequestsAction(statusFilter?: "ALL" | "PENDING" | "APPROVED" | "REJECTED") {
  const user = await requireAuth();
  const sanghFilter = getSanghAccessFilter(user);

  const submissions = await prisma.memberFormSubmission.findMany({
    where: {
      ...sanghFilter,
      ...(statusFilter && statusFilter !== "ALL" ? { status: statusFilter } : {}),
    },
    include: {
      family: {
        include: {
          sangh: true,
          members: { where: { status: "ACTIVE" } },
        },
      },
      sangh: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return submissions.map((s) => ({
    id: s.id,
    submissionNumber: s.submissionNumber,
    familyId: s.familyId,
    familyRefId: s.family.familyId,
    headName: s.submittedHeadName,
    maskedMobile: s.submittedMobile.length > 5 ? `${s.submittedMobile.slice(0, 3)}****${s.submittedMobile.slice(-3)}` : s.submittedMobile,
    currentAddress: s.family.address,
    currentArea: s.family.area,
    currentNativePlace: s.family.nativePlace || "—",
    currentMemberCount: s.family.members.length,
    sanghName: s.sangh.name,
    sanghPrefix: s.sangh.prefix,
    headInfoCorrect: s.headInfoCorrect,
    addressChanged: s.addressChanged,
    newAddress: s.newAddress,
    newArea: s.newArea,
    newNativePlace: s.newNativePlace,
    newOccupation: s.newOccupation,
    newMobile: s.newMobile,
    memberCount: s.memberCount,
    membersUpToDate: s.membersUpToDate,
    correctionNeeded: s.correctionNeeded,
    correctionDetails: s.correctionDetails,
    additionalNotes: s.additionalNotes,
    status: s.status,
    reviewedBy: s.reviewedBy,
    reviewedAt: s.reviewedAt ? s.reviewedAt.toISOString() : null,
    rejectionReason: s.rejectionReason,
    appliedChanges: s.appliedChanges,
    createdAt: s.createdAt.toISOString(),
  }));
}
