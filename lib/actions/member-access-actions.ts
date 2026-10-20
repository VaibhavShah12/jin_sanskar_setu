"use server";

import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/auth-helpers";
import { normalizeMobile, getMemberCalculatedAge, maskMobile } from "@/lib/validation/family";
import { logAuditEvent } from "@/lib/audit/logger";
import crypto from "crypto";

// -----------------------------------------------------------------------------
// 1. PUBLIC REQUEST ACCESS (Called from /member-access)
// -----------------------------------------------------------------------------
export async function requestMemberAccessAction(
  rawMobile: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ success: boolean; message: string; requestToken?: string }> {
  const normalized = normalizeMobile(rawMobile);
  if (!normalized || normalized.length < 10) {
    return {
      success: false,
      message: "Please enter a valid 10-digit registered mobile number.",
    };
  }

  // Rate Limiting: Check if more than 5 requests in last 15 minutes for this mobile
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  const recentCount = await prisma.memberAccessRequest.count({
    where: {
      normalizedMobile: normalized,
      createdAt: { gte: fifteenMinutesAgo },
    },
  });

  if (recentCount >= 5) {
    return {
      success: false,
      message: "Too many access attempts. Please wait 15 minutes before trying again.",
    };
  }

  // Find registered active family
  const family = await prisma.family.findFirst({
    where: {
      normalizedMobile: normalized,
      status: "ACTIVE",
    },
    include: {
      sangh: true,
    },
  });

  if (!family) {
    return {
      success: false,
      message:
        "This mobile number is not registered in Jin Sanskar Setu. Please verify your 10-digit number or contact your Sangh volunteer for registration.",
    };
  }

  // Check for existing active request within last 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existingRequest = await prisma.memberAccessRequest.findFirst({
    where: {
      normalizedMobile: normalized,
      familyId: family.id,
      createdAt: { gte: oneDayAgo },
      status: { in: ["PENDING", "APPROVED"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingRequest) {
    if (existingRequest.status === "APPROVED" && existingRequest.grantExpiresAt && existingRequest.grantExpiresAt > new Date()) {
      return {
        success: true,
        requestToken: existingRequest.requestToken,
        message: "Your access request has already been approved! Loading your family profile...",
      };
    }
    if (existingRequest.status === "PENDING") {
      return {
        success: true,
        requestToken: existingRequest.requestToken,
        message: "Your access request has already been submitted and is currently awaiting volunteer verification.",
      };
    }
  }

  // Generate cryptographic token for client session
  const requestToken = crypto.randomBytes(32).toString("hex");

  try {
    const accessRequest = await prisma.memberAccessRequest.create({
      data: {
        mobile: rawMobile.trim(),
        normalizedMobile: normalized,
        familyId: family.id,
        sanghId: family.sanghId,
        status: "PENDING",
        requestToken,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });

    await logAuditEvent({
      action: "ACCESS_REQUEST_CREATED",
      entityType: "Family",
      entityId: family.id,
      performedBy: `MEMBER_PORTAL:${maskMobile(normalized)}`,
      metadata: {
        requestId: accessRequest.requestId,
        sanghPrefix: family.sangh.prefix,
        familyId: family.familyId,
      },
    });

    return {
      success: true,
      requestToken,
      message: "Your access request has been successfully submitted and is awaiting volunteer verification.",
    };
  } catch (err: any) {
    console.error("[ACCESS REQUEST ERROR]:", err);
    return {
      success: false,
      message: "Failed to submit access request. Please try again later.",
    };
  }
}

// -----------------------------------------------------------------------------
// 2. CHECK STATUS (Polls or loads state for requester)
// -----------------------------------------------------------------------------
export async function checkMemberAccessStatusAction(requestToken: string) {
  if (!requestToken || requestToken.trim().length < 10) {
    return { status: "INVALID", message: "Invalid request token." };
  }

  const reqRecord = await prisma.memberAccessRequest.findUnique({
    where: { requestToken: requestToken.trim() },
    include: {
      family: {
        select: { familyId: true, headName: true },
      },
      sangh: {
        select: { name: true, prefix: true },
      },
    },
  });

  if (!reqRecord) {
    return { status: "NOT_FOUND", message: "No active access request found." };
  }

  // Check 24-hour expiration for pending requests
  const isExpired = Date.now() - new Date(reqRecord.createdAt).getTime() > 24 * 60 * 60 * 1000;
  if (reqRecord.status === "PENDING" && isExpired) {
    await prisma.memberAccessRequest.update({
      where: { id: reqRecord.id },
      data: { status: "EXPIRED" },
    });
    return { status: "EXPIRED", message: "Your request expired after 24 hours. Please submit a new request." };
  }

  if (reqRecord.status === "PENDING") {
    return {
      status: "PENDING",
      message: "Your access request is currently pending volunteer validation.",
      createdAt: reqRecord.createdAt,
    };
  }

  if (reqRecord.status === "REJECTED") {
    return {
      status: "REJECTED",
      message: reqRecord.rejectionReason || "Your access request was rejected by a volunteer.",
      rejectedAt: reqRecord.rejectedAt,
    };
  }

  if (reqRecord.status === "APPROVED") {
    // Check grant expiry
    if (reqRecord.grantExpiresAt && reqRecord.grantExpiresAt < new Date()) {
      return {
        status: "EXPIRED",
        message: "Your approved session has expired. Please submit a new access request.",
      };
    }

    return {
      status: "APPROVED",
      grantToken: reqRecord.grantToken,
      familyId: reqRecord.family.familyId,
      headName: reqRecord.family.headName,
      sanghName: reqRecord.sangh.name,
      grantExpiresAt: reqRecord.grantExpiresAt,
    };
  }

  return { status: reqRecord.status, message: "Request status: " + reqRecord.status };
}

// -----------------------------------------------------------------------------
// 3. GET APPROVED FAMILY DATA (Strictly token-anchored read-only access)
// -----------------------------------------------------------------------------
export async function getApprovedFamilyDataAction(grantToken: string) {
  if (!grantToken || grantToken.trim().length < 10) {
    return { success: false, error: "Invalid access token." };
  }

  const accessGrant = await prisma.memberAccessRequest.findUnique({
    where: { grantToken: grantToken.trim() },
    include: {
      family: {
        include: {
          sangh: true,
          members: {
            where: { status: "ACTIVE" },
            orderBy: [{ relationship: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });

  if (!accessGrant) {
    return { success: false, error: "Access grant not found or invalid." };
  }

  if (accessGrant.status !== "APPROVED") {
    return { success: false, error: "Access request is not approved." };
  }

  if (accessGrant.grantExpiresAt && accessGrant.grantExpiresAt < new Date()) {
    return { success: false, error: "Access session has expired. Please request access again." };
  }

  const family = accessGrant.family;
  const members = family.members.map((m) => ({
    id: m.id,
    memberId: m.memberId,
    name: m.name,
    dateOfBirth: m.dateOfBirth ? m.dateOfBirth.toISOString().split("T")[0] : null,
    calculatedAge: getMemberCalculatedAge(m),
    gender: m.gender,
    relationship: m.relationship,
    pathshalaStatus: m.pathshalaStatus,
    preferredDay: m.preferredDay,
    preferredTime: m.preferredTime,
    preferredWeekdays: m.preferredWeekdays,
    transportPreference: m.transportPreference,
    interests: m.interests || [],
  }));

  return {
    success: true,
    data: {
      familyId: family.familyId,
      headName: family.headName,
      mobile: maskMobile(family.mobile),
      address: family.address,
      area: family.area,
      sangh: {
        name: family.sangh.name,
        prefix: family.sangh.prefix,
      },
      members,
      grantExpiresAt: accessGrant.grantExpiresAt,
    },
  };
}

// -----------------------------------------------------------------------------
// 4. ATOMIC CONCURRENT APPROVE (Only one volunteer can succeed)
// -----------------------------------------------------------------------------
export async function approveAccessRequestAction(requestId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized. Please log in." };
  }

  // Trustees cannot approve requests
  if (user.role === "TRUSTEE") {
    return { success: false, error: "Trustees do not have permission to approve access requests." };
  }

  // Check request existence and Sangh authorization
  const reqRecord = await prisma.memberAccessRequest.findUnique({
    where: { id: requestId },
  });

  if (!reqRecord) {
    return { success: false, error: "Request not found." };
  }

  if (user.role === "VOLUNTEER" && user.sanghId && user.sanghId !== reqRecord.sanghId) {
    return { success: false, error: "You are only authorized to review requests for your assigned Sangh." };
  }

  const grantToken = crypto.randomBytes(32).toString("hex");
  const grantExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  try {
    // ATOMIC CONDITIONAL UPDATE:
    // Only succeeds if status is currently PENDING!
    const rowsUpdated = await prisma.$executeRaw`
      UPDATE "member_access_requests"
      SET "status" = 'APPROVED'::"AccessRequestStatus",
          "approvedBy" = ${user.username},
          "approvedAt" = NOW(),
          "grantToken" = ${grantToken},
          "grantExpiresAt" = ${grantExpiresAt},
          "updatedAt" = NOW()
      WHERE "id" = ${requestId}
        AND "status" = 'PENDING'::"AccessRequestStatus"
    `;

    if (rowsUpdated === 0) {
      // Race condition caught: another volunteer already handled it
      await logAuditEvent({
        action: "ACCESS_REQUEST_CONFLICT_DETECTED",
        entityType: "Family",
        entityId: reqRecord.familyId,
        performedBy: user.username,
        metadata: {
          requestId,
          conflictType: "CONCURRENT_APPROVAL_ATTEMPT",
          message: "Attempted to approve request that was already handled by another volunteer.",
        },
      });

      return {
        success: false,
        error: "This access request has already been handled by another volunteer.",
      };
    }

    // Exactly one volunteer succeeded
    await logAuditEvent({
      action: "ACCESS_REQUEST_APPROVED",
      entityType: "Family",
      entityId: reqRecord.familyId,
      performedBy: user.username,
      metadata: {
        requestId,
        approvedBy: user.username,
        sanghId: reqRecord.sanghId,
      },
    });

    return { success: true, message: "Member access request approved successfully." };
  } catch (err: any) {
    console.error("[APPROVE ERROR]:", err);
    return { success: false, error: err?.message || "Failed to approve request." };
  }
}

// -----------------------------------------------------------------------------
// 5. ATOMIC REJECT
// -----------------------------------------------------------------------------
export async function rejectAccessRequestAction(requestId: string, reason?: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized. Please log in." };
  }

  if (user.role === "TRUSTEE") {
    return { success: false, error: "Trustees do not have permission to reject access requests." };
  }

  const reqRecord = await prisma.memberAccessRequest.findUnique({
    where: { id: requestId },
  });

  if (!reqRecord) {
    return { success: false, error: "Request not found." };
  }

  if (user.role === "VOLUNTEER" && user.sanghId && user.sanghId !== reqRecord.sanghId) {
    return { success: false, error: "You are only authorized to review requests for your assigned Sangh." };
  }

  try {
    const rowsUpdated = await prisma.$executeRaw`
      UPDATE "member_access_requests"
      SET "status" = 'REJECTED'::"AccessRequestStatus",
          "rejectedBy" = ${user.username},
          "rejectedAt" = NOW(),
          "rejectionReason" = ${reason || "Information could not be verified by volunteer"},
          "updatedAt" = NOW()
      WHERE "id" = ${requestId}
        AND "status" = 'PENDING'::"AccessRequestStatus"
    `;

    if (rowsUpdated === 0) {
      return {
        success: false,
        error: "This access request has already been handled by another volunteer.",
      };
    }

    await logAuditEvent({
      action: "ACCESS_REQUEST_REJECTED",
      entityType: "Family",
      entityId: reqRecord.familyId,
      performedBy: user.username,
      metadata: {
        requestId,
        rejectedBy: user.username,
        reason: reason || "Verification failed",
      },
    });

    return { success: true, message: "Request rejected." };
  } catch (err: any) {
    console.error("[REJECT ERROR]:", err);
    return { success: false, error: err?.message || "Failed to reject request." };
  }
}

// -----------------------------------------------------------------------------
// 6. LIST PENDING REQUESTS (Scoped to volunteer Sangh or all for Admin)
// -----------------------------------------------------------------------------
export async function getPendingAccessRequestsAction() {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized", requests: [] };
  }

  const whereClause: any = {
    status: "PENDING",
  };

  if (user.role === "VOLUNTEER" && user.sanghId) {
    whereClause.sanghId = user.sanghId;
  } else if (user.role === "TRUSTEE") {
    whereClause.sanghId = user.sanghId || "__UNAUTHORIZED__";
  }

  const requests = await prisma.memberAccessRequest.findMany({
    where: whereClause,
    include: {
      family: {
        select: {
          familyId: true,
          headName: true,
          area: true,
        },
      },
      sangh: {
        select: {
          name: true,
          prefix: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const masked = requests.map((r) => ({
    id: r.id,
    requestId: r.requestId,
    maskedMobile: maskMobile(r.mobile),
    familyId: r.family.familyId,
    headName: r.family.headName,
    area: r.family.area,
    sanghName: r.sangh.name,
    sanghPrefix: r.sangh.prefix,
    status: r.status,
    createdAt: r.createdAt,
  }));

  return { success: true, requests: masked };
}

// -----------------------------------------------------------------------------
// 7. SAVE MEMBER INTERESTS (Strictly token-anchored update)
// -----------------------------------------------------------------------------
export async function saveFamilyMemberInterestsAction(
  grantToken: string,
  memberInterests: { memberId: string; interests: string[] }[]
): Promise<{ success: boolean; message: string; error?: string }> {
  if (!grantToken || grantToken.trim().length < 10) {
    return { success: false, message: "Invalid access token.", error: "INVALID_TOKEN" };
  }

  const accessGrant = await prisma.memberAccessRequest.findUnique({
    where: { grantToken: grantToken.trim() },
    include: {
      family: {
        include: {
          members: { where: { status: "ACTIVE" } },
        },
      },
    },
  });

  if (!accessGrant || accessGrant.status !== "APPROVED") {
    return { success: false, message: "Unauthorized or session expired. Please request validation again.", error: "UNAUTHORIZED" };
  }

  if (accessGrant.grantExpiresAt && accessGrant.grantExpiresAt < new Date()) {
    return { success: false, message: "Access session has expired.", error: "SESSION_EXPIRED" };
  }

  const family = accessGrant.family;
  const validMemberIds = new Set(family.members.map((m) => m.id));

  try {
    for (const item of memberInterests) {
      if (validMemberIds.has(item.memberId)) {
        await prisma.member.update({
          where: { id: item.memberId },
          data: {
            interests: item.interests || [],
          },
        });
      }
    }

    await logAuditEvent({
      action: "MEMBER_INTERESTS_UPDATED",
      entityType: "Family",
      entityId: family.id,
      performedBy: `MEMBER_SELF_SERVICE:${maskMobile(accessGrant.mobile)}`,
      metadata: {
        familyId: family.familyId,
        memberCount: memberInterests.length,
      },
    });

    return {
      success: true,
      message: "Family member interests updated successfully! (परिवार के सदस्यों की रुचियाँ सफलतापूर्वक दर्ज कर ली गईं)",
    };
  } catch (err: any) {
    console.error("[SAVE INTERESTS ERROR]:", err);
    return {
      success: false,
      message: "Failed to save member interests. Please try again.",
      error: err?.message,
    };
  }
}

