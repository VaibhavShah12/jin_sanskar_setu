"use server";

import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/auth-helpers";
import { FamilyFormSchema, normalizeMobile, normalizeName, FamilyFormValues } from "@/lib/validation/family";
import { generateFamilyId, generateMemberIds } from "@/lib/ids/generator";
import { checkFamilyDuplicates } from "@/lib/duplicates/checker";
import { logAuditEvent } from "@/lib/audit/logger";
import { triggerBackgroundSync } from "@/lib/google-sheets/sync";

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
  const normalizedMobile = normalizeMobile(data.mobile);

  // 4. Duplicate Check: Exact duplicate (Normalized mobile + Sangh)
  const duplicateCheck = await checkFamilyDuplicates({
    mobile: data.mobile,
    sanghId: data.sanghId,
    members: [
      { name: data.headName, age: data.headAge, relationship: "HEAD" },
      ...data.members,
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

  const totalMembersCount = 1 + data.members.length; // Head + additional members

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
            mobile: data.mobile.trim(),
            normalizedMobile,
            address: data.address.trim(),
            area: data.area.trim(),
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
            age: data.headAge,
            gender: data.headGender,
            relationship: "HEAD",
            pathshalaStatus: data.headPathshalaStatus,
            pathshalaInterest: data.headPathshalaInterest,
            preferredDay: data.headPreferredDay,
            preferredTime: data.headPreferredTime,
            preferredWeekdays: data.headPathshalaInterest === "YES" && data.headPreferredDay === "WEEKDAY" ? (data.headPreferredWeekdays || null) : null,
            transportPreference: data.headPathshalaInterest === "YES" ? (data.headTransportPreference || null) : null,
            noInterestReason: data.headPathshalaInterest === "NO" ? (data.headNoInterestReason || null) : null,
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
        for (let i = 0; i < data.members.length; i++) {
          const m = data.members[i];
          const mId = additionalMemberIds[i];

          const memberRecord = await tx.member.create({
            data: {
              memberId: mId,
              familyId: family.id,
              sanghId: data.sanghId,
              name: m.name.trim(),
              normalizedName: normalizeName(m.name),
              age: m.age,
              gender: m.gender,
              relationship: m.relationship,
              pathshalaStatus: m.pathshalaStatus,
              pathshalaInterest: m.pathshalaInterest,
              preferredDay: m.preferredDay,
              preferredTime: m.preferredTime,
              preferredWeekdays: m.pathshalaInterest === "YES" && m.preferredDay === "WEEKDAY" ? (m.preferredWeekdays || null) : null,
              transportPreference: m.pathshalaInterest === "YES" ? (m.transportPreference || null) : null,
              noInterestReason: m.pathshalaInterest === "NO" ? (m.noInterestReason || null) : null,
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
