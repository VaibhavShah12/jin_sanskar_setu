"use server";

import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/auth-helpers";
import { FamilyFormSchema, normalizeMobile, normalizeName, FamilyFormValues } from "@/lib/validation/family";
import { generateFamilyId, generateMemberIds } from "@/lib/ids/generator";
import { checkFamilyDuplicates } from "@/lib/duplicates/checker";
import { logAuditEvent } from "@/lib/audit/logger";
import { triggerBackgroundSync } from "@/lib/google-sheets/sync";
import { sendFamilyRegistrationEmail, sendFamilyIdCardsEmail } from "@/lib/email/mailer";
import { revalidatePath } from "next/cache";

export interface CreateFamilyResult {
  success: boolean;
  familyId?: string;
  id?: string;
  headMemberId?: string;
  memberIds?: string[];
  error?: string;
  duplicateInfo?: any;
  warnings?: any[];
}

/**
 * Creates a Family and all its members inside a single atomic PostgreSQL transaction.
 * Concurrency-safe: utilizes atomic row locking / increment on sequence counters.
 * Google Sheets synchronization is triggered asynchronously post-commit.
 */
export async function createFamilyAction(
  rawData: FamilyFormValues,
  bypassMemberWarnings: boolean = false
): Promise<CreateFamilyResult> {
  // 1. Authenticate user server-side
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized. Please log in to register a family." };
  }

  // Trustees have strictly read-only access
  if (user.role === "TRUSTEE") {
    return { success: false, error: "Trustees have view-only access and are not authorized to register families." };
  }

  // 2. Validate Sangh permission (if volunteer restricted to specific Sangh)
  if (user.role === "VOLUNTEER" && user.sanghId && user.sanghId !== rawData.sanghId) {
    return { success: false, error: "You are only authorized to register families for your assigned Sangh." };
  }

  // 3. Validate form data schema via Zod
  const validation = FamilyFormSchema.safeParse(rawData);
  if (!validation.success) {
    const errorDetails = validation.error.errors.map((e) => e.message).join(", ");
    return { success: false, error: `Validation error: ${errorDetails}` };
  }

  const data = validation.data;
  const rawMobile = data.headWhatsappNumber || data.mobile || "";
  const normalizedMobile = rawMobile ? normalizeMobile(rawMobile) : "";

  // Flatten any nested wives, resident husbands, and children into full members
  // Automatically maps wives as DAUGHTER_IN_LAW, resident husbands as OTHER, and children as GRANDCHILD
  const flattenedMembers: typeof data.members = [];
  for (const m of data.members) {
    const { children, ...parent } = m;
    flattenedMembers.push(parent);

    // If son is married and wifeName provided -> auto-create her as an official Sangh Member (DAUGHTER_IN_LAW)
    if (m.relationship === "SON" && m.maritalStatus === "MARRIED" && m.wifeName && m.wifeName.trim()) {
      flattenedMembers.push({
        name: m.wifeName.trim(),
        dateOfBirth: m.wifeDateOfBirth || null,
        age: m.wifeAge || (m.age ? Math.max(18, m.age - 2) : 28),
        gender: "FEMALE",
        relationship: "DAUGHTER_IN_LAW",
        maritalStatus: "MARRIED",
        bloodGroup: m.wifeBloodGroup || null,
        whatsappNumber: m.wifeContact || null,
        residenceLocation: m.residenceLocation || "IN_PUNE",
        occupation: "HOUSEWIFE",
        pathshalaStatus: "UNKNOWN",
        preferredDay: "NO_PREFERENCE",
        preferredTime: "NO_PREFERENCE",
        preferredWeekdays: null,
        transportPreference: null,
      });
    }

    // If daughter or sister is married and husband resides in this household/Sangh -> auto-create him as an official Member
    if (
      (m.relationship === "DAUGHTER" || m.relationship === "SISTER") &&
      m.maritalStatus === "MARRIED" &&
      m.husbandIsResident &&
      m.husbandName &&
      m.husbandName.trim()
    ) {
      flattenedMembers.push({
        name: m.husbandName.trim(),
        dateOfBirth: m.husbandDateOfBirth || null,
        age: m.husbandAge || (m.age ? m.age + 2 : 30),
        gender: "MALE",
        relationship: "OTHER",
        maritalStatus: "MARRIED",
        bloodGroup: m.husbandBloodGroup || null,
        whatsappNumber: m.husbandContact || null,
        residenceLocation: m.residenceLocation || "IN_PUNE",
        occupation: "SERVICE",
        pathshalaStatus: "UNKNOWN",
        preferredDay: "NO_PREFERENCE",
        preferredTime: "NO_PREFERENCE",
        preferredWeekdays: null,
        transportPreference: null,
      });
    }

    // If children provided -> auto-create each child as an official Member (GRANDCHILD) with bloodGroup and phone
    if (children && children.length > 0) {
      for (const c of children) {
        if (c.name && c.name.trim()) {
          flattenedMembers.push({
            name: c.name.trim(),
            dateOfBirth: c.dateOfBirth || null,
            age: c.age || 0,
            gender: c.gender || "MALE",
            relationship: "GRANDCHILD", // Automatically mapped to Family Head
            maritalStatus: "UNMARRIED",
            bloodGroup: c.bloodGroup || null,
            whatsappNumber: c.whatsappNumber || null,
            residenceLocation: m.residenceLocation || "IN_PUNE",
            occupation: (c.age || 0) < 18 ? "STUDENT" : null,
            pathshalaStatus: "UNKNOWN",
            preferredDay: "NO_PREFERENCE",
            preferredTime: "NO_PREFERENCE",
            preferredWeekdays: null,
            transportPreference: null,
          });
        }
      }
    }
  }

  // 4. Duplicate Check: Exact duplicate (Normalized mobile + Sangh) if mobile is provided
  const duplicateCheck = await checkFamilyDuplicates({
    mobile: rawMobile,
    sanghId: data.sanghId,
    members: [
      { name: data.headName, age: data.headAge, relationship: "HEAD" },
      ...flattenedMembers,
    ],
  });

  // Exact duplicate: BLOCK
  if (duplicateCheck.isExactFamilyDuplicate && duplicateCheck.existingFamily) {
    return {
      success: false,
      error: "EXACT_DUPLICATE_FOUND",
      duplicateInfo: duplicateCheck.existingFamily,
    };
  }

  // Member warnings: If warnings exist and user has not explicitly confirmed, return warnings to prompt confirmation
  if (duplicateCheck.possibleMemberDuplicates.length > 0 && !bypassMemberWarnings) {
    return {
      success: false,
      error: "POSSIBLE_MEMBER_DUPLICATES",
      warnings: duplicateCheck.possibleMemberDuplicates,
    };
  }

  // Retrieve Sangh to get prefix for Member IDs
  const sangh = await prisma.sangh.findUnique({
    where: { id: data.sanghId },
  });

  if (!sangh || !sangh.active) {
    return { success: false, error: "Invalid or inactive Sangh selected." };
  }

  const totalMembersCount = 1 + flattenedMembers.length; // Head + all additional members (including grandchildren)

  try {
    // 5. ATOMIC POSTGRESQL TRANSACTION
    const result = await prisma.$transaction(
      async (tx) => {
        // A. Concurrency-Safe ID Generation
        const familyId = await generateFamilyId(tx);
        const memberIds = await generateMemberIds(tx, sangh.id, sangh.prefix, totalMembersCount);

        const headMemberId = memberIds[0];
        const additionalMemberIds = memberIds.slice(1);

        // B. Create Family record
        const family = await tx.family.create({
          data: {
            familyId,
            headName: data.headName.trim(),
            mobile: rawMobile.trim(),
            normalizedMobile,
            email: data.headEmail.trim().toLowerCase(),
            address: data.address.trim(),
            lane: data.lane?.trim() || null,
            area: data.area.trim(),
            nativePlace: data.nativePlace?.trim() || null,
            sect: data.sect?.trim() || null,
            otherSect: data.sect === "OTHER" ? (data.otherSect?.trim() || null) : null,
            volunteerName: data.volunteerName?.trim() || user.name || user.username,
            filledByMember: data.filledByMember?.trim() || null,
            sanghId: data.sanghId,
            status: "ACTIVE",
            createdBy: user.username,
            updatedBy: user.username,
          },
        });

        // C. Create Head Member
        const headMember = await tx.member.create({
          data: {
            memberId: headMemberId,
            familyId: family.id,
            sanghId: data.sanghId,
            name: data.headName.trim(),
            normalizedName: normalizeName(data.headName),
            dateOfBirth: data.headDateOfBirth ? new Date(data.headDateOfBirth) : null,
            age: data.headAge,
            gender: data.headGender,
            relationship: "HEAD",
            maritalStatus: "MARRIED",
            bloodGroup: data.headBloodGroup?.trim() || null,
            sect: data.sect === "OTHER" && data.otherSect?.trim() ? data.otherSect.trim() : (data.sect?.trim() || null),
            occupation: data.headOccupation?.trim() || null,
            pathshalaStatus: data.headPathshalaStatus,
            preferredDay: data.headPreferredDay,
            preferredTime: data.headPreferredTime,
            preferredWeekdays: data.headPreferredDay === "WEEKDAY" ? (data.headPreferredWeekdays || null) : null,
            transportPreference: data.headTransportPreference || null,
            whatsappNumber: rawMobile ? normalizeMobile(rawMobile) : null,
            whatsappConsent: Boolean(data.headWhatsappConsent),
            whatsappConsentDate: data.headWhatsappConsent ? new Date() : null,
            whatsappConsentSource: data.headWhatsappConsent ? "REGISTRATION_FORM" : null,
            whatsappConsentUpdatedBy: user.username,
            status: "ACTIVE",
            createdBy: user.username,
            updatedBy: user.username,
          },
        });

        // D. Update Family with headMemberId
        await tx.family.update({
          where: { id: family.id },
          data: { headMemberId: headMember.id },
        });

        // E. Create Additional Members
        const createdAdditionalMembers = [];
        for (let i = 0; i < flattenedMembers.length; i++) {
          const m = flattenedMembers[i];
          const mId = additionalMemberIds[i];

          const memberRecord = await tx.member.create({
            data: {
              memberId: mId,
              familyId: family.id,
              sanghId: data.sanghId,
              name: m.name.trim(),
              normalizedName: normalizeName(m.name),
              dateOfBirth: m.dateOfBirth ? new Date(m.dateOfBirth) : null,
              age: m.age,
              gender: m.gender,
              relationship: m.relationship,
              maritalStatus: m.maritalStatus || "UNMARRIED",
              husbandName: m.husbandName?.trim() || null,
              wifeName: m.wifeName?.trim() || null,
              wifeContact: m.wifeContact ? normalizeMobile(m.wifeContact) : null,
              residenceLocation: m.residenceLocation?.trim() || null,
              bloodGroup: m.bloodGroup?.trim() || null,
              occupation: m.occupation?.trim() || null,
              pathshalaStatus: m.pathshalaStatus,
              preferredDay: m.preferredDay,
              preferredTime: m.preferredTime,
              preferredWeekdays: m.preferredDay === "WEEKDAY" ? (m.preferredWeekdays || null) : null,
              transportPreference: m.transportPreference || null,
              whatsappNumber: m.whatsappNumber ? normalizeMobile(m.whatsappNumber) : null,
              status: "ACTIVE",
              createdBy: user.username,
              updatedBy: user.username,
            },
          });
          createdAdditionalMembers.push(memberRecord);
        }

        // F. Create Initial Google Sheet Sync Records (Pending)
        const allMemberIds = [headMemberId, ...additionalMemberIds];
        for (const mid of allMemberIds) {
          await tx.googleSheetSync.create({
            data: {
              memberId: mid,
              status: "PENDING",
            },
          });
        }

        // G. Audit Log
        await logAuditEvent(
          {
            action: "FAMILY_CREATED",
            entityType: "Family",
            entityId: family.id,
            performedBy: user.username,
            metadata: {
              familyId,
              headMemberId,
              sanghPrefix: sangh.prefix,
              totalMembers: totalMembersCount,
              memberIds: allMemberIds,
            },
          },
          tx
        );

        return {
          id: family.id,
          familyId,
          headMemberId,
          allMemberIds,
        };
      },
      {
        // 15-second timeout for transaction
        maxWait: 5000,
        timeout: 15000,
      }
    );

    // 6. Post-commit: Asynchronously trigger Google Sheet sync
    // Database data is safely committed; Google Sheet errors will not rollback the DB
    triggerBackgroundSync(result.allMemberIds, user.username);

    // 7. Post-commit: Dispatch confirmation email to Head of Family
    if (data.headEmail && data.headEmail.trim()) {
      const membersList = [
        { name: data.headName.trim(), relationship: "Head", memberId: result.headMemberId },
        ...flattenedMembers.map((m, idx) => ({
          name: m.name.trim(),
          relationship: m.relationship,
          memberId: result.allMemberIds[idx + 1] || "",
        })),
      ];

      try {
        const emailDispatchResult = await sendFamilyRegistrationEmail({
          to: data.headEmail.trim(),
          headName: data.headName.trim(),
          familyId: result.familyId,
          memberIds: result.allMemberIds,
          sanghName: sangh.name,
          membersList,
          phone: data.mobile || data.headWhatsappNumber || undefined,
        });
        if (!emailDispatchResult.success) {
          console.error("[EMAIL_DISPATCH_WARNING] Registration email was not dispatched:", emailDispatchResult.error);
        }
      } catch (emailErr) {
        console.error("[EMAIL_DISPATCH_ERROR] Failed to send family registration email:", emailErr);
      }
    }

    return {
      success: true,
      id: result.id,
      familyId: result.familyId,
      headMemberId: result.headMemberId,
      memberIds: result.allMemberIds,
    };
  } catch (err: any) {
    console.error("[TRANSACTION ERROR] createFamilyAction failed:", err);
    return {
      success: false,
      error: err?.message || "Failed to create family due to a database transaction error.",
    };
  }
}

/**
 * Soft delete / Archive family and its members (ADMIN ONLY)
 */
export async function archiveFamilyAction(familyDbId: string): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized." };
  }

  // Strict role check: Volunteers CANNOT archive families or members
  if (user.role !== "ADMIN") {
    return { success: false, error: "Access denied. Only administrators are authorized to archive families." };
  }

  try {
    const family = await prisma.family.findUnique({
      where: { id: familyDbId },
    });

    if (!family) {
      return { success: false, error: "Family not found." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.family.update({
        where: { id: familyDbId },
        data: { status: "ARCHIVED", updatedBy: user.username },
      });

      await tx.member.updateMany({
        where: { familyId: familyDbId },
        data: { status: "ARCHIVED", updatedBy: user.username },
      });

      await logAuditEvent(
        {
          action: "FAMILY_ARCHIVED",
          entityType: "Family",
          entityId: familyDbId,
          performedBy: user.username,
          metadata: { familyId: family.familyId },
        },
        tx
      );
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to archive family." };
  }
}

/**
 * Soft delete / Archive a single member (ADMIN ONLY)
 */
export async function archiveMemberAction(memberDbId: string): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized." };
  }

  // Strict role check: Volunteers CANNOT archive any member
  if (user.role !== "ADMIN") {
    return { success: false, error: "Access denied. Only administrators are authorized to archive members." };
  }

  try {
    const member = await prisma.member.findUnique({
      where: { id: memberDbId },
      include: { family: true },
    });

    if (!member) {
      return { success: false, error: "Member not found." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.member.update({
        where: { id: memberDbId },
        data: { status: "ARCHIVED", updatedBy: user.username },
      });

      await logAuditEvent(
        {
          action: "MEMBER_ARCHIVED",
          entityType: "Member",
          entityId: memberDbId,
          performedBy: user.username,
          metadata: {
            memberId: member.memberId,
            name: member.name,
            familyId: member.family.familyId,
          },
        },
        tx
      );
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to archive member." };
  }
}

/**
 * Restore an archived family and its members back to ACTIVE status (ADMIN ONLY)
 */
export async function restoreFamilyAction(familyDbId: string): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return { success: false, error: "Access denied. Only administrators are authorized to restore archived families." };
  }

  try {
    const family = await prisma.family.findUnique({
      where: { id: familyDbId },
    });

    if (!family) {
      return { success: false, error: "Family not found." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.family.update({
        where: { id: familyDbId },
        data: { status: "ACTIVE", updatedBy: user.username },
      });

      await tx.member.updateMany({
        where: { familyId: familyDbId },
        data: { status: "ACTIVE", updatedBy: user.username },
      });

      await logAuditEvent(
        {
          action: "FAMILY_RESTORED",
          entityType: "Family",
          entityId: familyDbId,
          performedBy: user.username,
          metadata: { familyId: family.familyId },
        },
        tx
      );
    });

    revalidatePath("/families");
    revalidatePath("/dashboard");
    revalidatePath(`/families/${familyDbId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to restore family." };
  }
}

/**
 * Permanently hard-delete a family and all associated records from PostgreSQL (ADMIN ONLY).
 * Frees up the family ID so it can be reused immediately.
 */
export async function deleteFamilyPermanentlyAction(familyDbId: string): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return { success: false, error: "Access denied. Only administrators are authorized to permanently delete families from the database." };
  }

  try {
    const family = await prisma.family.findUnique({
      where: { id: familyDbId },
      include: {
        members: { select: { id: true, memberId: true } },
      },
    });

    if (!family) {
      return { success: false, error: "Family record not found in database." };
    }

    const memberIds = family.members.map((m) => m.memberId);

    await prisma.$transaction(async (tx) => {
      // 1. Unlink circular headMemberId first
      await tx.family.update({
        where: { id: familyDbId },
        data: { headMemberId: null },
      });

      // 2. Delete child records
      if (memberIds.length > 0) {
        await tx.googleSheetSync.deleteMany({
          where: { memberId: { in: memberIds } },
        });
      }
      await tx.birthdayMessageLog.deleteMany({
        where: { familyId: familyDbId },
      });
      await tx.lavaajamRecord.deleteMany({
        where: { familyId: familyDbId },
      });
      await tx.memberAccessRequest.deleteMany({
        where: { familyId: familyDbId },
      });
      await tx.memberFormSubmission.deleteMany({
        where: { familyId: familyDbId },
      });
      await tx.auditLog.deleteMany({
        where: { entityId: familyDbId },
      });

      // 3. Delete all member records
      await tx.member.deleteMany({
        where: { familyId: familyDbId },
      });

      // 4. Delete the family record itself
      await tx.family.delete({
        where: { id: familyDbId },
      });
    });

    revalidatePath("/families");
    revalidatePath("/dashboard");
    revalidatePath("/members");
    return { success: true };
  } catch (err: any) {
    console.error("[PERMANENT_DELETE_FAMILY_ERROR]", err);
    return { success: false, error: err?.message || "Failed to permanently delete family from database." };
  }
}

/**
 * Permanently hard-delete a single member from PostgreSQL (ADMIN ONLY).
 */
export async function deleteMemberPermanentlyAction(memberDbId: string): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return { success: false, error: "Access denied. Only administrators are authorized to delete members." };
  }

  try {
    const member = await prisma.member.findUnique({
      where: { id: memberDbId },
      include: { family: true },
    });

    if (!member) {
      return { success: false, error: "Member not found." };
    }

    if (member.family.headMemberId === member.id) {
      return {
        success: false,
        error: "Cannot delete the Head of Family directly. Please reassign the family head first or delete the entire family.",
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.googleSheetSync.deleteMany({
        where: { memberId: member.memberId },
      });
      await tx.member.delete({
        where: { id: memberDbId },
      });
    });

    revalidatePath(`/families/${member.familyId}`);
    revalidatePath("/members");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to permanently delete member." };
  }
}

/**
 * Live check for duplicate mobile number while typing (returns existing family info if found)
 */
export async function checkMobileAvailabilityAction(mobile: string): Promise<{
  exists: boolean;
  familyId?: string;
  id?: string;
  headName?: string;
  sanghName?: string;
  sanghPrefix?: string;
}> {
  try {
    const normalized = normalizeMobile(mobile);
    if (!normalized || normalized.length < 10) {
      return { exists: false };
    }

    const existing = await prisma.family.findFirst({
      where: {
        normalizedMobile: normalized,
        status: "ACTIVE",
      },
      select: {
        id: true,
        familyId: true,
        headName: true,
        sangh: {
          select: {
            name: true,
            prefix: true,
          },
        },
      },
    });

    if (existing) {
      return {
        exists: true,
        familyId: existing.familyId,
        id: existing.id,
        headName: existing.headName,
        sanghName: existing.sangh.name,
        sanghPrefix: existing.sangh.prefix,
      };
    }

    return { exists: false };
  } catch {
    return { exists: false };
  }
}

/**
 * Sends official Digital Family ID Cards to the registered email address.
 */
export async function sendFamilyIdCardsEmailAction(
  familyDbId: string,
  overrideEmail?: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized. Please log in." };
  }

  try {
    const family = await prisma.family.findUnique({
      where: { id: familyDbId },
      include: {
        sangh: true,
        members: {
          where: { status: "ACTIVE" },
          orderBy: [{ relationship: "asc" }, { age: "desc" }],
        },
      },
    });

    if (!family) {
      return { success: false, error: "Family not found." };
    }

    if (user.role === "TRUSTEE" && family.sanghId !== user.sanghId) {
      return {
        success: false,
        error: "Permission Denied: You can only send ID cards to families in your assigned Sangh.",
      };
    }

    const targetEmail = overrideEmail?.trim() || family.email?.trim();
    if (!targetEmail || !targetEmail.includes("@")) {
      return {
        success: false,
        error: `No valid email address registered for family ${family.familyId}.`,
      };
    }

    const membersData = family.members.map((m) => ({
      memberId: m.memberId,
      name: m.name,
      relationship: m.relationship,
      age: m.age,
      gender: m.gender,
      bloodGroup: m.bloodGroup,
      residenceLocation: m.residenceLocation,
      dateOfBirth: m.dateOfBirth ? m.dateOfBirth.toISOString().split("T")[0] : null,
    }));

    const result = await sendFamilyIdCardsEmail({
      to: targetEmail,
      headName: family.headName,
      familyId: family.familyId,
      sanghName: family.sangh.name,
      sanghPrefix: family.sangh.prefix,
      address: family.address,
      lane: family.lane,
      area: family.area,
      sect: family.sect,
      members: membersData,
    });

    if (!result.success) {
      return { success: false, error: result.error || "Failed to dispatch email." };
    }

    await logAuditEvent({
      action: "FAMILY_ID_CARDS_EMAILED",
      entityType: "Family",
      entityId: family.id,
      performedBy: user.username,
      metadata: {
        familyId: family.familyId,
        recipient: targetEmail,
        totalMembers: family.members.length,
      },
    });

    return {
      success: true,
      message: `Family ID Cards successfully emailed to ${targetEmail}!`,
    };
  } catch (err: any) {
    console.error("[SEND_FAMILY_ID_CARDS_ERROR]:", err);
    return { success: false, error: err?.message || "Failed to send Family ID Cards." };
  }
}

export interface UpdateFamilyAndMembersPayload {
  familyId: string; // Family DB ID
  headName: string;
  mobile?: string | null;
  email: string;
  address: string;
  lane?: string | null;
  area: string;
  nativePlace?: string | null;
  sect?: string | null;
  otherSect?: string | null;
  headOccupation?: string | null;
  headBloodGroup?: string | null;
  headDateOfBirth?: string | null;
  headAge?: number;
  members: Array<{
    id?: string;
    name: string;
    dateOfBirth?: string | null;
    age: number;
    gender: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";
    relationship: string;
    maritalStatus?: string | null;
    wifeName?: string | null;
    wifeContact?: string | null;
    husbandName?: string | null;
    residenceLocation?: string | null;
    bloodGroup?: string | null;
    whatsappNumber?: string | null;
    occupation?: string | null;
  }>;
}

/**
 * Directly updates an existing Family and its Member records.
 * Allows updating blood group, foreigner location, sect, lane, marital status, wife/husband info,
 * and adding new members/grandchildren WITHOUT deleting any existing data or resetting IDs.
 */
export async function updateFamilyAndMembersAction(
  payload: UpdateFamilyAndMembersPayload
): Promise<{ success: boolean; error?: string; message?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized. Please log in." };
  }

  try {
    const family = await prisma.family.findUnique({
      where: { id: payload.familyId },
      include: {
        sangh: true,
        members: { where: { status: "ACTIVE" } },
      },
    });

    if (!family) {
      return { success: false, error: "Family not found." };
    }

    // Role check: Volunteers/Trustees can only edit their own Sangh
    if (
      (user.role === "VOLUNTEER" && user.sanghId && user.sanghId !== family.sanghId) ||
      (user.role === "TRUSTEE" && user.sanghId !== family.sanghId)
    ) {
      return { success: false, error: "Access Denied: You can only edit families in your assigned Sangh." };
    }

    const rawMobile = payload.mobile || family.mobile || "";
    const normalizedMobile = rawMobile ? normalizeMobile(rawMobile) : null;

    await prisma.$transaction(async (tx) => {
      // 1. Update Family record
      await tx.family.update({
        where: { id: family.id },
        data: {
          headName: payload.headName.trim(),
          mobile: rawMobile.trim(),
          normalizedMobile: normalizedMobile || family.normalizedMobile,
          email: payload.email.trim().toLowerCase(),
          address: payload.address.trim(),
          lane: payload.lane?.trim() || null,
          area: payload.area.trim(),
          nativePlace: payload.nativePlace?.trim() || null,
          sect: payload.sect?.trim() || null,
          otherSect: payload.sect === "OTHER" ? (payload.otherSect?.trim() || null) : null,
          updatedBy: user.username,
        },
      });

      // 2. Separate existing members vs newly added members
      const existingMembers = payload.members.filter((m) => Boolean(m.id));
      const newMembers = payload.members.filter((m) => !m.id && m.name.trim().length >= 2);

      // Update existing members
      for (const m of existingMembers) {
        if (!m.id) continue;
        await tx.member.update({
          where: { id: m.id },
          data: {
            name: m.name.trim(),
            normalizedName: normalizeName(m.name),
            dateOfBirth: m.dateOfBirth ? new Date(m.dateOfBirth) : null,
            age: m.age,
            gender: m.gender,
            relationship: m.relationship as any,
            maritalStatus: (m.maritalStatus as any) || "UNMARRIED",
            wifeName: m.wifeName?.trim() || null,
            wifeContact: m.wifeContact ? normalizeMobile(m.wifeContact) : null,
            husbandName: m.husbandName?.trim() || null,
            residenceLocation: m.residenceLocation || null,
            bloodGroup: m.bloodGroup || null,
            whatsappNumber: m.whatsappNumber ? normalizeMobile(m.whatsappNumber) : null,
            occupation: m.occupation?.trim() || null,
            updatedBy: user.username,
          },
        });
      }

      // Update Head Member record if head-specific details changed
      if (family.headMemberId) {
        await tx.member.update({
          where: { id: family.headMemberId },
          data: {
            name: payload.headName.trim(),
            normalizedName: normalizeName(payload.headName),
            age: payload.headAge !== undefined ? payload.headAge : undefined,
            dateOfBirth: payload.headDateOfBirth ? new Date(payload.headDateOfBirth) : undefined,
            bloodGroup: payload.headBloodGroup || undefined,
            occupation: payload.headOccupation || undefined,
            updatedBy: user.username,
          },
        });
      }

      // 3. Create any newly added members with generated Member IDs
      if (newMembers.length > 0) {
        const newMemberIds = await generateMemberIds(
          tx,
          family.sanghId,
          family.sangh.prefix,
          newMembers.length
        );

        for (let i = 0; i < newMembers.length; i++) {
          const nm = newMembers[i];
          const mid = newMemberIds[i];

          await tx.member.create({
            data: {
              memberId: mid,
              familyId: family.id,
              sanghId: family.sanghId,
              name: nm.name.trim(),
              normalizedName: normalizeName(nm.name),
              dateOfBirth: nm.dateOfBirth ? new Date(nm.dateOfBirth) : null,
              age: nm.age,
              gender: nm.gender,
              relationship: nm.relationship as any,
              maritalStatus: (nm.maritalStatus as any) || "UNMARRIED",
              wifeName: nm.wifeName?.trim() || null,
              wifeContact: nm.wifeContact ? normalizeMobile(nm.wifeContact) : null,
              husbandName: nm.husbandName?.trim() || null,
              residenceLocation: nm.residenceLocation || null,
              bloodGroup: nm.bloodGroup || null,
              whatsappNumber: nm.whatsappNumber ? normalizeMobile(nm.whatsappNumber) : null,
              occupation: nm.occupation?.trim() || null,
              status: "ACTIVE",
              createdBy: user.username,
              updatedBy: user.username,
            },
          });

          await tx.googleSheetSync.create({
            data: {
              memberId: mid,
              status: "PENDING",
            },
          });
        }

        // Trigger background sync for new members
        triggerBackgroundSync(newMemberIds, user.username);
      }

      // Audit Log
      await logAuditEvent({
        action: "FAMILY_UPDATED",
        entityType: "Family",
        entityId: family.id,
        performedBy: user.username,
        metadata: {
          familyId: family.familyId,
          headName: payload.headName,
          updatedMembersCount: existingMembers.length,
          newMembersCount: newMembers.length,
        },
      }, tx);
    });

    revalidatePath(`/families/${payload.familyId}`);
    revalidatePath("/families");
    revalidatePath("/members");

    return {
      success: true,
      message: "Family household and member details updated successfully!",
    };
  } catch (err: any) {
    console.error("[UPDATE_FAMILY_ERROR]:", err);
    return {
      success: false,
      error: err?.message || "Failed to update family details.",
    };
  }
}

/**
 * Live lookup for a contact number across all Sanghs in the database.
 * Detects if a married daughter, wife, or member is already registered in another Sangh.
 */
export async function lookupCrossSanghContactAction(contactNumber: string) {
  try {
    const normalized = normalizeMobile(contactNumber);
    if (!normalized || normalized.length < 10) {
      return { found: false };
    }

    // Look for any active member matching whatsappNumber or wifeContact or family mobile
    const matchedMember = await prisma.member.findFirst({
      where: {
        OR: [
          { whatsappNumber: normalized },
          { wifeContact: normalized },
        ],
        status: "ACTIVE",
      },
      include: {
        family: {
          include: { sangh: true },
        },
      },
    });

    if (matchedMember) {
      return {
        found: true,
        type: "MEMBER" as const,
        member: {
          id: matchedMember.id,
          memberId: matchedMember.memberId,
          name: matchedMember.name,
          age: matchedMember.age,
          gender: matchedMember.gender,
          dateOfBirth: matchedMember.dateOfBirth
            ? matchedMember.dateOfBirth.toISOString().split("T")[0]
            : null,
          relationship: matchedMember.relationship,
          maritalStatus: matchedMember.maritalStatus,
          husbandName: matchedMember.husbandName,
          wifeName: matchedMember.wifeName,
          bloodGroup: matchedMember.bloodGroup,
          residenceLocation: matchedMember.residenceLocation,
          familyId: matchedMember.family.familyId,
          headName: matchedMember.family.headName,
          sanghId: matchedMember.family.sanghId,
          sanghName: matchedMember.family.sangh.name,
          sanghPrefix: matchedMember.family.sangh.prefix,
        },
      };
    }

    return { found: false };
  } catch (err) {
    console.warn("lookupCrossSanghContactAction error:", err);
    return { found: false };
  }
}
