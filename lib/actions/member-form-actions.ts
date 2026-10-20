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

      if (submission.addressChanged && submission.newAddress && submission.newArea) {
        appliedChanges.address = {
          before: submission.family.address,
          after: submission.newAddress,
        };
        appliedChanges.area = {
          before: submission.family.area,
          after: submission.newArea,
        };
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

      // 3. If residential address changed, apply safe update to Family record
      if (submission.addressChanged && submission.newAddress && submission.newArea) {
        await tx.family.update({
          where: { id: submission.familyId },
          data: {
            address: submission.newAddress,
            area: submission.newArea,
            updatedBy: user.username,
          },
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
