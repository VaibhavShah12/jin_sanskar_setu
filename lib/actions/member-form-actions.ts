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
import { updateFamilyAndMembersAction } from "@/lib/actions/family-actions";
import { sendCorrectionApprovedEmail } from "@/lib/email/mailer";

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
export async function approveSubmissionAction(submissionId: string, adjustedProposedData?: any) {
  const user = await requireVolunteerOrAdmin();

  if (!submissionId) {
    return { success: false, error: "Submission ID is required." };
  }

  try {
    // 1. Fetch submission with family and sangh
    const submission = await prisma.memberFormSubmission.findUnique({
      where: { id: submissionId },
      include: {
        family: {
          include: {
            members: { where: { status: "ACTIVE" } },
          },
        },
        sangh: true,
      },
    });

    if (!submission) {
      return { success: false, error: "Submission not found." };
    }

    if (submission.status !== "PENDING") {
      return {
        success: false,
        error: `ALREADY_PROCESSED: This submission has already been ${submission.status.toLowerCase()} by ${submission.reviewedBy || "another volunteer"}.`,
      };
    }

    // Role check: Volunteers can only review their assigned Sangh
    if (user.role === "VOLUNTEER" && user.sanghId && user.sanghId !== submission.sanghId) {
      return {
        success: false,
        error: "Unauthorized: You do not have permission to review submissions for this Sangh.",
      };
    }

    const appliedChangesJson = (submission.appliedChanges as any) || {};
    const proposedData = adjustedProposedData || appliedChangesJson.proposedData;

    // A. Full Form Refill Approval workflow
    if (proposedData) {
      const updateRes = await updateFamilyAndMembersAction({
        ...proposedData,
        familyId: submission.familyId,
      });

      if (!updateRes.success) {
        return {
          success: false,
          error: updateRes.error || "Failed to apply full form changes to database.",
        };
      }

      const updateResult = await prisma.memberFormSubmission.updateMany({
        where: {
          id: submission.id,
          status: "PENDING",
        },
        data: {
          status: "APPROVED",
          reviewedBy: user.username,
          reviewedAt: new Date(),
          appliedChanges: {
            ...appliedChangesJson,
            approvedAt: new Date().toISOString(),
            approvedBy: user.username,
            appliedData: proposedData,
          },
        },
      });

      if (updateResult.count === 0) {
        return {
          success: false,
          error: "ALREADY_PROCESSED: This submission has already been reviewed by another volunteer.",
        };
      }

      // Send email to family if registered email exists
      if (submission.family.email) {
        try {
          await sendCorrectionApprovedEmail({
            to: submission.family.email,
            headName: submission.submittedHeadName || submission.family.headName,
            familyId: submission.family.familyId,
            sanghName: submission.sangh.name,
            submissionNumber: submission.submissionNumber,
          });
        } catch (emailErr) {
          console.error("[EMAIL] Failed to send correction approval email:", emailErr);
        }
      }

      await logAuditEvent({
        action: "MEMBER_FORM_APPROVED",
        entityType: "Family",
        entityId: submission.familyId,
        performedBy: user.username,
        metadata: {
          submissionNumber: submission.submissionNumber,
          familyId: submission.family.familyId,
          fullFormRefillApproved: true,
        },
      });

      const updatedRecord = await prisma.memberFormSubmission.findUnique({
        where: { id: submission.id },
      });

      return { success: true, submission: updatedRecord };
    }

    // B. Legacy 5-Field atomic transaction workflow
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

      // Atomic transition to APPROVED
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

      // Apply changes to Family record if any field was updated
      if (Object.keys(familyUpdates).length > 1) {
        await tx.family.update({
          where: { id: submission.familyId },
          data: familyUpdates,
        });
      }

      // Audit Log
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
  proposedData?: any; // Full proposed update payload
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

    const proposed = input.proposedData;
    const effectiveMobile = (proposed?.mobile || input.newMobile)?.trim() || family.mobile;
    const effectiveHeadName = (proposed?.headName || family.headName)?.trim();
    const effectiveAddress = (proposed?.address || input.newAddress)?.trim() || null;
    const effectiveArea = (proposed?.area || input.newArea)?.trim() || null;
    const effectiveNativePlace = (proposed?.nativePlace || input.newNativePlace)?.trim() || null;
    const effectiveOccupation = (proposed?.headOccupation || input.newOccupation)?.trim() || null;
    const effectiveMemberCount = proposed?.members ? proposed.members.length : family.members.length;

    const appliedChangesData: any = proposed
      ? {
          proposedData: proposed,
          notes: input.additionalNotes || null,
          submittedAt: new Date().toISOString(),
        }
      : Prisma.DbNull;

    const submission = await prisma.memberFormSubmission.create({
      data: {
        submissionNumber,
        familyId: family.id,
        headMemberId: family.headMemberId,
        sanghId: family.sanghId,
        submittedMobile: effectiveMobile,
        submittedHeadName: effectiveHeadName,
        headInfoCorrect: false,
        addressChanged: Boolean(effectiveAddress && effectiveAddress !== family.address),
        newAddress: effectiveAddress,
        newArea: effectiveArea,
        newNativePlace: effectiveNativePlace,
        newOccupation: effectiveOccupation,
        newMobile: effectiveMobile !== family.mobile ? effectiveMobile : null,
        memberCount: effectiveMemberCount,
        membersUpToDate: true,
        correctionNeeded: true,
        correctionDetails:
          input.correctionDetails?.trim() ||
          (proposed ? "Full family and member details refill/re-update submitted for Admin approval" : null),
        additionalNotes: input.additionalNotes?.trim() || null,
        status: "PENDING",
        appliedChanges: appliedChangesData,
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
        hasFullProposedData: Boolean(proposed),
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
    rawMobile: s.submittedMobile,
    currentAddress: s.family.address,
    currentLane: (s.family as any).lane || "",
    currentArea: s.family.area,
    currentNativePlace: s.family.nativePlace || "—",
    currentSect: (s.family as any).sect || "",
    currentOtherSect: (s.family as any).otherSect || "",
    currentHeadBloodGroup: (s.family as any).headBloodGroup || "",
    currentEmail: s.family.email || "",
    currentMemberCount: s.family.members.length,
    currentMembers: s.family.members.map((m) => ({
      id: m.id,
      memberId: m.memberId,
      name: m.name,
      relationship: m.relationship,
      age: m.age,
      gender: m.gender,
      bloodGroup: m.bloodGroup || "",
      residenceLocation: m.residenceLocation || "IN_PUNE",
      maritalStatus: m.maritalStatus || "UNMARRIED",
      wifeName: m.wifeName || "",
      wifeContact: m.wifeContact || "",
      husbandName: m.husbandName || "",
      occupation: m.occupation || "",
      whatsappNumber: m.whatsappNumber || "",
    })),
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
