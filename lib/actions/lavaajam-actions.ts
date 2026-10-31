"use server";

import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, getSanghAccessFilter } from "@/lib/auth/auth-helpers";
import { logAuditEvent } from "@/lib/audit/logger";

export interface SaveLavaajamPayload {
  familyId: string;
  year: string;
  status: "PAID" | "PENDING";
  amount?: number | string | null;
  receiptNumber?: string | null;
  receiverName?: string | null;
  receiptPhoto?: string | null;
  paymentDate?: string | null;
  paymentMode?: string | null;
  notes?: string | null;
}

/**
 * Fetches all families and their Lavaajam payment records for a given year.
 * STRICTLY SECURED: Accessible ONLY by Trustees and Admins.
 * Trustees can ONLY see families in their own assigned Sangh.
 */
export async function getLavaajamDataAction(year: string = "2026-2027", requestedSanghId?: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized. Please log in.", families: [], summary: null };
  }

  // Strict role check: Only TRUSTEE or ADMIN
  if (user.role !== "TRUSTEE" && user.role !== "ADMIN") {
    return {
      success: false,
      error: "Access Denied: Only Trustees and Admins are authorized to view or manage Lavaajam.",
      families: [],
      summary: null,
    };
  }

  try {
    const sanghFilter = getSanghAccessFilter(user, requestedSanghId);

    // Fetch families and their Lavaajam records for the specified year
    const families = await prisma.family.findMany({
      where: {
        status: "ACTIVE",
        ...sanghFilter,
      },
      include: {
        sangh: {
          select: {
            id: true,
            name: true,
            prefix: true,
          },
        },
        lavaajamRecords: {
          where: { year },
        },
        members: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            name: true,
            relationship: true,
            age: true,
          },
        },
      },
      orderBy: [{ familyId: "asc" }],
    });

    // Compute summary metrics
    let paidCount = 0;
    let pendingCount = 0;
    let totalAmount = 0;

    const formattedFamilies = families.map((fam) => {
      const record = fam.lavaajamRecords[0] || null;
      const isPaid = record?.status === "PAID";

      if (isPaid) {
        paidCount++;
        totalAmount += record.amount || 0;
      } else {
        pendingCount++;
      }

      return {
        id: fam.id,
        familyId: fam.familyId,
        headName: fam.headName,
        mobile: fam.mobile,
        area: fam.area,
        address: fam.address,
        sangh: fam.sangh,
        memberCount: fam.members.length,
        lavaajam: record
          ? {
              id: record.id,
              status: record.status,
              amount: record.amount,
              receiptNumber: record.receiptNumber,
              receiverName: record.receiverName,
              receiptPhoto: record.receiptPhotoUrl,
              paymentDate: record.paymentDate ? record.paymentDate.toISOString().split("T")[0] : null,
              paymentMode: record.paymentMode,
              notes: record.notes,
              recordedBy: record.recordedBy,
              updatedAt: record.updatedAt.toISOString(),
            }
          : null,
      };
    });

    // Fetch active Sanghs for filter (if Admin)
    let sanghs: { id: string; name: string; prefix: string }[] = [];
    if (user.role === "ADMIN") {
      sanghs = await prisma.sangh.findMany({
        where: { active: true },
        select: { id: true, name: true, prefix: true },
        orderBy: { name: "asc" },
      });
    } else if (user.sanghId && user.sanghName) {
      sanghs = [
        {
          id: user.sanghId,
          name: user.sanghName,
          prefix: user.sanghPrefix || "",
        },
      ];
    }

    return {
      success: true,
      year,
      families: formattedFamilies,
      summary: {
        totalFamilies: families.length,
        paidFamilies: paidCount,
        pendingFamilies: pendingCount,
        totalAmountCollected: totalAmount,
        paidPercentage: families.length > 0 ? Math.round((paidCount / families.length) * 100) : 0,
      },
      sanghs,
      userRole: user.role,
      userSanghId: user.sanghId,
    };
  } catch (err: any) {
    console.error("[LAVAAJAM_FETCH_ERROR]:", err);
    return {
      success: false,
      error: err?.message || "Failed to load Lavaajam records.",
      families: [],
      summary: null,
    };
  }
}

/**
 * Records or updates a Lavaajam payment entry.
 * STRICTLY SECURED: Accessible ONLY by Trustees (for their own Sangh) and Admins.
 */
export async function saveLavaajamRecordAction(payload: SaveLavaajamPayload) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized. Please log in." };
  }

  if (user.role !== "TRUSTEE" && user.role !== "ADMIN") {
    return {
      success: false,
      error: "Access Denied: Only Trustees and Admins can record or update Lavaajam.",
    };
  }

  if (!payload.familyId || !payload.year) {
    return { success: false, error: "Missing required fields (Family ID and Year)." };
  }

  try {
    const family = await prisma.family.findUnique({
      where: { id: payload.familyId },
      include: { sangh: true },
    });

    if (!family) {
      return { success: false, error: "Family record not found." };
    }

    // Strict Sangh isolation: Trustee CANNOT record Lavaajam for another Sangh
    if (user.role === "TRUSTEE" && family.sanghId !== user.sanghId) {
      return {
        success: false,
        error: "Permission Denied: You can only record Lavaajam for families in your assigned Sangh.",
      };
    }

    const numericAmount = payload.amount !== undefined && payload.amount !== null && payload.amount !== ""
      ? parseFloat(String(payload.amount))
      : null;

    const parsedDate = payload.paymentDate && payload.paymentDate.trim()
      ? new Date(payload.paymentDate)
      : payload.status === "PAID"
      ? new Date()
      : null;

    // Upsert record
    const record = await prisma.lavaajamRecord.upsert({
      where: {
        familyId_year: {
          familyId: payload.familyId,
          year: payload.year,
        },
      },
      create: {
        familyId: payload.familyId,
        sanghId: family.sanghId,
        year: payload.year,
        status: payload.status,
        amount: numericAmount,
        receiptNumber: payload.receiptNumber?.trim() || null,
        receiverName: payload.receiverName?.trim() || null,
        receiptPhotoUrl: payload.receiptPhoto || null,
        paymentDate: parsedDate,
        paymentMode: (payload.paymentMode as any) || "CASH",
        notes: payload.notes?.trim() || null,
        recordedBy: user.username,
      },
      update: {
        status: payload.status,
        amount: numericAmount,
        receiptNumber: payload.receiptNumber !== undefined ? (payload.receiptNumber?.trim() || null) : undefined,
        receiverName: payload.receiverName !== undefined ? (payload.receiverName?.trim() || null) : undefined,
        receiptPhotoUrl: payload.receiptPhoto !== undefined ? payload.receiptPhoto : undefined,
        paymentDate: parsedDate,
        paymentMode: (payload.paymentMode as any) || undefined,
        notes: payload.notes !== undefined ? (payload.notes?.trim() || null) : undefined,
        recordedBy: user.username,
      },
    });

    // Audit Log
    await logAuditEvent({
      action: payload.status === "PAID" ? "LAVAAJAM_PAYMENT_RECORDED" : "LAVAAJAM_STATUS_UPDATED",
      entityType: "Family",
      entityId: payload.familyId,
      performedBy: user.username,
      metadata: {
        familyId: family.familyId,
        headName: family.headName,
        sangh: family.sangh.name,
        year: payload.year,
        status: payload.status,
        receiptNumber: payload.receiptNumber,
        receiverName: payload.receiverName,
        amount: numericAmount,
        hasPhoto: Boolean(payload.receiptPhoto),
      },
    });

    return {
      success: true,
      message:
        payload.status === "PAID"
          ? `Lavaajam payment recorded successfully for ${family.headName}'s family.`
          : `Lavaajam marked as pending for ${family.headName}'s family.`,
      recordId: record.id,
    };
  } catch (err: any) {
    console.error("[SAVE_LAVAAJAM_ERROR]:", err);
    return { success: false, error: err?.message || "Failed to save Lavaajam record." };
  }
}
