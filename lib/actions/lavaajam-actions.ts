"use server";

import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, getSanghAccessFilter } from "@/lib/auth/auth-helpers";
import { logAuditEvent } from "@/lib/audit/logger";
import {
  sendLavaajamReceiptEmail,
  sendSanghBroadcastEmail,
  sendDirectFamilyMessageEmail,
} from "@/lib/email/mailer";

export interface SaveLavaajamPayload {
  familyId: string; // Accepts either cuid or business Family ID (e.g. MSJS-FAM-0001)
  year: string;
  status: "PAID" | "PENDING";
  amount?: number | string | null;
  receiptNumber?: string | null;
  receiverName?: string | null;
  receiptPhoto?: string | null;
  paymentDate?: string | null;
  paymentMode?: string | null;
  notes?: string | null;
  email?: string | null;
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
            annualLavaajamAmount: true,
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
        email: fam.email,
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

    // Fetch active Sanghs for filter and fee configuration
    let sanghs: { id: string; name: string; prefix: string; annualLavaajamAmount?: number | null }[] = [];
    if (user.role === "ADMIN") {
      sanghs = await prisma.sangh.findMany({
        where: { active: true },
        select: { id: true, name: true, prefix: true, annualLavaajamAmount: true },
        orderBy: { name: "asc" },
      });
    } else if (user.sanghId && user.sanghName) {
      const currentSangh = await prisma.sangh.findUnique({
        where: { id: user.sanghId },
        select: { id: true, name: true, prefix: true, annualLavaajamAmount: true },
      });
      sanghs = [
        currentSangh || {
          id: user.sanghId,
          name: user.sanghName,
          prefix: user.sanghPrefix || "",
          annualLavaajamAmount: 1100,
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
 * Supports familyId being either DB cuid or business Family ID (e.g. MSJS-FAM-0001).
 * Automatically dispatches payment receipt to the family head's registered email when PAID.
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
    const trimmedId = payload.familyId.trim();
    const family = await prisma.family.findFirst({
      where: {
        OR: [
          { id: trimmedId },
          { familyId: trimmedId.toUpperCase() },
          { familyId: trimmedId },
        ],
      },
      include: { sangh: true },
    });

    if (!family) {
      return { success: false, error: `Family record not found for ID "${trimmedId}".` };
    }

    // Strict Sangh isolation: Trustee CANNOT record Lavaajam for another Sangh
    if (user.role === "TRUSTEE" && family.sanghId !== user.sanghId) {
      return {
        success: false,
        error: "Permission Denied: You can only record Lavaajam for families in your assigned Sangh.",
      };
    }

    // If a new email was provided in payload, update family record
    if (payload.email && payload.email.trim() && payload.email.includes("@")) {
      const cleanEmail = payload.email.trim().toLowerCase();
      if (family.email !== cleanEmail) {
        await prisma.family.update({
          where: { id: family.id },
          data: { email: cleanEmail },
        });
        family.email = cleanEmail;
      }
    }

    const defaultSanghFee = family.sangh.annualLavaajamAmount ?? 1100;
    const numericAmount =
      payload.amount !== undefined && payload.amount !== null && payload.amount !== ""
        ? parseFloat(String(payload.amount))
        : defaultSanghFee;

    const parsedDate =
      payload.paymentDate && payload.paymentDate.trim()
        ? new Date(payload.paymentDate)
        : payload.status === "PAID"
        ? new Date()
        : null;

    const receiptNo =
      payload.receiptNumber?.trim() ||
      (payload.status === "PAID" ? `REC-${Date.now().toString().slice(-6)}` : null);

    // Upsert record using family.id
    const record = await prisma.lavaajamRecord.upsert({
      where: {
        familyId_year: {
          familyId: family.id,
          year: payload.year,
        },
      },
      create: {
        familyId: family.id,
        sanghId: family.sanghId,
        year: payload.year,
        status: payload.status,
        amount: numericAmount,
        receiptNumber: receiptNo,
        receiverName: payload.receiverName?.trim() || user.name || user.username,
        receiptPhotoUrl: payload.receiptPhoto || null,
        paymentDate: parsedDate,
        paymentMode: (payload.paymentMode as any) || "CASH",
        notes: payload.notes?.trim() || null,
        recordedBy: user.username,
      },
      update: {
        status: payload.status,
        amount: numericAmount,
        receiptNumber: payload.receiptNumber !== undefined ? receiptNo : undefined,
        receiverName:
          payload.receiverName !== undefined
            ? payload.receiverName?.trim() || user.name || user.username
            : undefined,
        receiptPhotoUrl: payload.receiptPhoto !== undefined ? payload.receiptPhoto : undefined,
        paymentDate: parsedDate,
        paymentMode: (payload.paymentMode as any) || undefined,
        notes: payload.notes !== undefined ? payload.notes?.trim() || null : undefined,
        recordedBy: user.username,
      },
    });

    // Post-commit: Asynchronously dispatch email receipt if PAID and family has an email
    let emailSent = false;
    let emailRecipient: string | null = null;
    const targetEmail = family.email?.trim() || payload.email?.trim();

    if (payload.status === "PAID" && targetEmail && targetEmail.includes("@")) {
      sendLavaajamReceiptEmail({
        to: targetEmail,
        headName: family.headName,
        familyId: family.familyId,
        sanghName: family.sangh.name,
        receiptNumber: receiptNo || `REC-${record.id.slice(-6)}`,
        amount: numericAmount,
        year: payload.year,
        paymentDate: parsedDate ? parsedDate.toISOString() : new Date().toISOString(),
        paymentMode: payload.paymentMode || "CASH",
        receiverName: payload.receiverName?.trim() || user.name || user.username,
        notes: payload.notes?.trim() || null,
      }).catch((emailErr) => {
        console.error("[EMAIL_DISPATCH_ERROR] Failed to send Lavaajam receipt email:", emailErr);
      });

      emailSent = true;
      emailRecipient = targetEmail;
    }

    // Audit Log
    await logAuditEvent({
      action: payload.status === "PAID" ? "LAVAAJAM_PAYMENT_RECORDED" : "LAVAAJAM_STATUS_UPDATED",
      entityType: "Family",
      entityId: family.id,
      performedBy: user.username,
      metadata: {
        familyId: family.familyId,
        headName: family.headName,
        sangh: family.sangh.name,
        year: payload.year,
        status: payload.status,
        receiptNumber: receiptNo,
        receiverName: payload.receiverName || user.username,
        amount: numericAmount,
        hasPhoto: Boolean(payload.receiptPhoto),
        emailDispatched: emailSent,
        emailRecipient,
      },
    });

    return {
      success: true,
      message:
        payload.status === "PAID"
          ? `Lavaajam payment recorded successfully for ${family.headName}'s family (${family.familyId}).${
              emailSent ? ` Payment receipt emailed to ${emailRecipient}.` : ""
            }`
          : `Lavaajam marked as pending for ${family.headName}'s family.`,
      recordId: record.id,
      familyId: family.familyId,
      emailSent,
      emailRecipient,
    };
  } catch (err: any) {
    console.error("[SAVE_LAVAAJAM_ERROR]:", err);
    return { success: false, error: err?.message || "Failed to save Lavaajam record." };
  }
}

/**
 * Updates the annual Lavaajam fee amount for a specific Sangh.
 * Accessible to Trustees (for their own Sangh) and Admins.
 */
export async function updateSanghLavaajamFeeAction({
  sanghId,
  annualAmount,
}: {
  sanghId: string;
  annualAmount: number;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized. Please log in." };
  }

  if (user.role !== "TRUSTEE" && user.role !== "ADMIN") {
    return {
      success: false,
      error: "Access Denied: Only Trustees and Admins can configure Sangh Lavaajam fees.",
    };
  }

  if (user.role === "TRUSTEE" && user.sanghId !== sanghId) {
    return {
      success: false,
      error: "Permission Denied: You can only configure fees for your assigned Sangh.",
    };
  }

  const parsedAmount = typeof annualAmount === "number" ? annualAmount : parseFloat(String(annualAmount));
  if (isNaN(parsedAmount) || parsedAmount < 0) {
    return { success: false, error: "Please enter a valid non-negative fee amount." };
  }

  try {
    const updated = await prisma.sangh.update({
      where: { id: sanghId },
      data: { annualLavaajamAmount: parsedAmount },
    });

    await logAuditEvent({
      action: "SANGH_LAVAAJAM_FEE_UPDATED",
      entityType: "System",
      entityId: sanghId,
      performedBy: user.username,
      metadata: {
        sanghName: updated.name,
        sanghPrefix: updated.prefix,
        newAnnualFee: parsedAmount,
      },
    });

    return {
      success: true,
      message: `Annual Lavaajam fee for ${updated.name} updated to ₹${parsedAmount.toLocaleString("en-IN")}.`,
      annualAmount: parsedAmount,
      sanghId,
    };
  } catch (err: any) {
    console.error("[UPDATE_LAVAAJAM_FEE_ERROR]:", err);
    return { success: false, error: err?.message || "Failed to update Lavaajam fee." };
  }
}

/**
 * Broadcasts an announcement email to all families in a Sangh who have a registered email address.
 * Strictly scoped: Trustees can only broadcast to their own Sangh; Admins can broadcast to any.
 */
export async function sendSanghBroadcastEmailAction({
  sanghId,
  subject,
  message,
}: {
  sanghId: string;
  subject: string;
  message: string;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized. Please log in." };
  }

  if (user.role !== "TRUSTEE" && user.role !== "ADMIN") {
    return { success: false, error: "Access Denied: Only Trustees and Admins can send Sangh broadcasts." };
  }

  if (user.role === "TRUSTEE" && user.sanghId !== sanghId) {
    return { success: false, error: "Permission Denied: You can only broadcast to your assigned Sangh." };
  }

  if (!subject.trim() || !message.trim()) {
    return { success: false, error: "Subject and announcement message are required." };
  }

  try {
    const sangh = await prisma.sangh.findUnique({
      where: { id: sanghId },
      select: { name: true, prefix: true },
    });

    if (!sangh) {
      return { success: false, error: "Sangh not found." };
    }

    const families = await prisma.family.findMany({
      where: {
        sanghId,
        status: "ACTIVE",
        email: { not: null },
      },
      select: { email: true },
    });

    const emailList = Array.from(
      new Set(
        families
          .map((f) => f.email?.trim().toLowerCase())
          .filter((e): e is string => Boolean(e && e.includes("@")))
      )
    );

    if (emailList.length === 0) {
      return {
        success: false,
        error: `No families in ${sangh.name} currently have a registered email address.`,
      };
    }

    const emailRes = await sendSanghBroadcastEmail({
      recipients: emailList,
      sanghName: sangh.name,
      subject: subject.trim(),
      messageBody: message.trim(),
      senderName: user.name || user.username,
      senderRole: user.role,
    });

    await logAuditEvent({
      action: "SANGH_BROADCAST_EMAIL_SENT",
      entityType: "System",
      entityId: sanghId,
      performedBy: user.username,
      metadata: {
        sanghName: sangh.name,
        subject: subject.trim(),
        recipientCount: emailList.length,
        simulated: emailRes.simulated,
      },
    });

    return {
      success: true,
      message: `Announcement dispatched to ${emailList.length} registered families in ${sangh.name}.${
        emailRes.simulated ? " (Email simulated in console/dev mode)" : ""
      }`,
      recipientCount: emailList.length,
    };
  } catch (err: any) {
    console.error("[BROADCAST_EMAIL_ERROR]:", err);
    return { success: false, error: err?.message || "Failed to dispatch broadcast email." };
  }
}

/**
 * Sends a direct email message to a specific family's registered email.
 */
export async function sendDirectFamilyEmailAction({
  familyId,
  subject,
  message,
}: {
  familyId: string;
  subject: string;
  message: string;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized. Please log in." };
  }

  if (!subject.trim() || !message.trim()) {
    return { success: false, error: "Subject and message are required." };
  }

  try {
    const trimmed = familyId.trim();
    const family = await prisma.family.findFirst({
      where: {
        OR: [{ id: trimmed }, { familyId: trimmed.toUpperCase() }, { familyId: trimmed }],
      },
      include: { sangh: true },
    });

    if (!family) {
      return { success: false, error: `Family not found for ID "${familyId}".` };
    }

    if (user.role === "TRUSTEE" && user.sanghId !== family.sanghId) {
      return { success: false, error: "You can only message families within your assigned Sangh." };
    }

    if (!family.email || !family.email.trim() || !family.email.includes("@")) {
      return {
        success: false,
        error: `Family ${family.headName} (${family.familyId}) does not have an email address registered.`,
      };
    }

    const emailRes = await sendDirectFamilyMessageEmail({
      to: family.email.trim(),
      headName: family.headName,
      familyId: family.familyId,
      sanghName: family.sangh.name,
      subject: subject.trim(),
      message: message.trim(),
      senderName: `${user.name || user.username} (${user.role})`,
    });

    await logAuditEvent({
      action: "FAMILY_DIRECT_EMAIL_SENT",
      entityType: "Family",
      entityId: family.id,
      performedBy: user.username,
      metadata: {
        familyId: family.familyId,
        headName: family.headName,
        recipient: family.email,
        subject: subject.trim(),
      },
    });

    return {
      success: true,
      message: `Direct message dispatched to ${family.headName} at ${family.email}.${
        emailRes.simulated ? " (Email simulated in dev mode)" : ""
      }`,
    };
  } catch (err: any) {
    console.error("[DIRECT_FAMILY_EMAIL_ERROR]:", err);
    return { success: false, error: err?.message || "Failed to send email." };
  }
}
