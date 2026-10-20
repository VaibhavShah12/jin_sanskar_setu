"use server";

import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/auth-helpers";
import { logAuditEvent } from "@/lib/audit/logger";
import {
  getAsiaKolkataDate,
  isBirthdayToday,
  getDaysUntilBirthday,
  parseBirthMonthAndDay,
} from "@/lib/whatsapp/date-helper";
import { maskPhoneNumber, normalizeToIndianE164 } from "@/lib/whatsapp/phone";
import {
  getWhatsAppConfig,
  sendBirthdayTemplateMessage,
} from "@/lib/whatsapp/client";
import { runDailyBirthdayScheduler } from "@/lib/whatsapp/scheduler";
import { BirthdayMessageStatus } from "@prisma/client";

export interface BirthdayRecipientView {
  memberId: string;
  memberDbId: string;
  name: string;
  familyId: string;
  sanghId: string;
  sanghName: string;
  sanghPrefix: string;
  maskedPhone: string;
  hasValidPhone: boolean;
  dateOfBirthStr: string;
  birthMonth: number;
  birthDay: number;
  age: number;
  daysUntil: number; // 0 = today, 1..30 = upcoming
  whatsappConsent: boolean;
  whatsappConsentDate?: string | null;
  whatsappConsentSource?: string | null;
  latestMessageStatus?: BirthdayMessageStatus | "PENDING_TODAY" | "NONE";
  errorMessage?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
}

export interface BirthdayMessageLogView {
  id: string;
  memberId: string;
  memberName: string;
  familyId: string;
  sanghName: string;
  sanghPrefix: string;
  maskedPhone: string;
  birthdayYear: number;
  status: BirthdayMessageStatus;
  templateName: string;
  errorMessage?: string | null;
  attemptCount: number;
  sentAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
}

export interface TrusteeDashboardData {
  sanghId: string;
  sanghName: string;
  sanghPrefix: string;
  todayCount: number;
  upcomingCount: number;
  consentedCount: number;
  eligibleTodayCount: number;
  sentThisYearCount: number;
  deliveredThisYearCount: number;
  failedThisYearCount: number;
  todayRecipients: BirthdayRecipientView[];
  upcomingRecipients: BirthdayRecipientView[];
  recentLogs: BirthdayMessageLogView[];
}

export interface SanghSummaryStat {
  sanghId: string;
  name: string;
  prefix: string;
  totalFamilyHeads: number;
  consentedCount: number;
  todayBirthdaysCount: number;
  sentThisYearCount: number;
  deliveredThisYearCount: number;
  failedThisYearCount: number;
}

export interface AdminDashboardData {
  totalEligibleHeads: number;
  totalConsented: number;
  totalNotConsented: number;
  todayTotalBirthdays: number;
  todayEligibleBirthdays: number;
  sentThisYear: number;
  deliveredThisYear: number;
  failedThisYear: number;
  skippedThisYear: number;
  currentMonthEstimatedCost: {
    sentMessagesCount: number;
    estimatedCostInr: string;
    ratePerMessageInr: string;
    disclaimer: string;
  };
  configStatus: {
    phoneNumberIdConfigured: boolean;
    businessAccountIdConfigured: boolean;
    accessTokenConfigured: boolean;
    apiVersion: string;
    templateName: string;
    templateLanguage: string;
    sendingEnabled: boolean;
    cronSecretConfigured: boolean;
    webhookVerifyTokenConfigured: boolean;
    testRecipientConfigured: boolean;
    testRecipientMasked: string | null;
  };
  sanghSummaries: SanghSummaryStat[];
  todayRecipients: BirthdayRecipientView[];
  recentLogs: BirthdayMessageLogView[];
}

/**
 * Fetch Birthday Dashboard Data for a Trustee (strictly scoped to their assigned Sangh)
 * or for an Administrator reviewing a specific Sangh.
 */
export async function getTrusteeBirthdayDashboardDataAction(
  requestedSanghId?: string
): Promise<{ success: boolean; data?: TrusteeDashboardData; error?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized. Please log in." };
  }

  // Strict server-side Sangh authorization check
  let targetSanghId = requestedSanghId;

  if (user.role === "TRUSTEE") {
    if (!user.sanghId) {
      return { success: false, error: "Access denied. Trustee has no assigned Sangh." };
    }
    // Enforce isolation: Trustees can NEVER inspect another Sangh's recipients
    targetSanghId = user.sanghId;
  } else if (user.role === "VOLUNTEER") {
    if (user.sanghId) {
      targetSanghId = user.sanghId;
    } else {
      return { success: false, error: "Access denied for this role." };
    }
  } else if (user.role === "ADMIN") {
    // Admin can view specified Sangh or defaults to the first available Sangh
    if (!targetSanghId) {
      const firstSangh = await prisma.sangh.findFirst({ where: { active: true }, orderBy: { prefix: "asc" } });
      targetSanghId = firstSangh?.id;
    }
  }

  if (!targetSanghId) {
    return { success: false, error: "No valid Sangh specified." };
  }

  const sangh = await prisma.sangh.findUnique({
    where: { id: targetSanghId },
  });

  if (!sangh) {
    return { success: false, error: "Sangh not found." };
  }

  const today = getAsiaKolkataDate();

  try {
    // Fetch all active family heads in this Sangh with date of birth
    const headMembers = await prisma.member.findMany({
      where: {
        relationship: "HEAD",
        status: "ACTIVE",
        dateOfBirth: { not: null },
        sanghId: targetSanghId,
        family: {
          status: "ACTIVE",
          sanghId: targetSanghId,
        },
      },
      include: {
        family: {
          select: {
            id: true,
            familyId: true,
            mobile: true,
            normalizedMobile: true,
          },
        },
        birthdayMessages: {
          where: {
            birthdayYear: today.year,
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    });

    const todayRecipients: BirthdayRecipientView[] = [];
    const upcomingRecipients: BirthdayRecipientView[] = [];
    let consentedCount = 0;

    for (const m of headMembers) {
      if (m.whatsappConsent) consentedCount++;

      const daysUntil = getDaysUntilBirthday(m.dateOfBirth, 30);
      if (daysUntil === null) continue; // Not within 30 days

      const parsed = parseBirthMonthAndDay(m.dateOfBirth)!;
      const latestMsg = m.birthdayMessages[0];
      const normalizedPhone = normalizeToIndianE164(m.family.mobile);

      let latestStatus: BirthdayMessageStatus | "PENDING_TODAY" | "NONE" = "NONE";
      if (latestMsg) {
        latestStatus = latestMsg.status;
      } else if (daysUntil === 0) {
        latestStatus = "PENDING_TODAY";
      }

      const item: BirthdayRecipientView = {
        memberId: m.memberId,
        memberDbId: m.id,
        name: m.name,
        familyId: m.family.familyId,
        sanghId: sangh.id,
        sanghName: sangh.name,
        sanghPrefix: sangh.prefix,
        maskedPhone: maskPhoneNumber(normalizedPhone || m.family.mobile),
        hasValidPhone: Boolean(normalizedPhone),
        dateOfBirthStr: m.dateOfBirth ? m.dateOfBirth.toISOString().split("T")[0] : "",
        birthMonth: parsed.birthMonth,
        birthDay: parsed.birthDay,
        age: m.age,
        daysUntil,
        whatsappConsent: m.whatsappConsent,
        whatsappConsentDate: m.whatsappConsentDate ? m.whatsappConsentDate.toISOString() : null,
        whatsappConsentSource: m.whatsappConsentSource,
        latestMessageStatus: latestStatus,
        errorMessage: latestMsg ? (latestMsg.failureReason || latestMsg.skipReason || null) : null,
        sentAt: latestMsg?.sentAt ? latestMsg.sentAt.toISOString() : null,
        deliveredAt: latestMsg?.deliveredAt ? latestMsg.deliveredAt.toISOString() : null,
      };

      if (daysUntil === 0) {
        todayRecipients.push(item);
      } else {
        upcomingRecipients.push(item);
      }
    }

    // Sort upcoming recipients by days until birthday ascending
    upcomingRecipients.sort((a, b) => a.daysUntil - b.daysUntil);

    // Fetch recent 50 birthday message logs for this Sangh
    const recentDbLogs = await prisma.birthdayMessageLog.findMany({
      where: { sanghId: targetSanghId },
      include: {
        member: {
          select: {
            name: true,
            family: {
              select: { familyId: true },
            },
          },
        },
        sangh: {
          select: { name: true, prefix: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const recentLogs: BirthdayMessageLogView[] = recentDbLogs.map((log) => ({
      id: log.id,
      memberId: log.memberId,
      memberName: log.member.name,
      familyId: log.member.family.familyId,
      sanghName: log.sangh.name,
      sanghPrefix: log.sangh.prefix,
      maskedPhone: maskPhoneNumber(log.recipientPhone),
      birthdayYear: log.birthdayYear,
      status: log.status,
      templateName: log.templateName,
      errorMessage: log.failureReason || log.skipReason || null,
      attemptCount: log.attemptCount,
      sentAt: log.sentAt ? log.sentAt.toISOString() : null,
      deliveredAt: log.deliveredAt ? log.deliveredAt.toISOString() : null,
      createdAt: log.createdAt.toISOString(),
    }));

    // Message counts for this year in this Sangh
    const [sentCount, deliveredCount, failedCount] = await Promise.all([
      prisma.birthdayMessageLog.count({
        where: { sanghId: targetSanghId, birthdayYear: today.year, status: "SENT" },
      }),
      prisma.birthdayMessageLog.count({
        where: { sanghId: targetSanghId, birthdayYear: today.year, status: { in: ["DELIVERED", "READ"] } },
      }),
      prisma.birthdayMessageLog.count({
        where: { sanghId: targetSanghId, birthdayYear: today.year, status: "FAILED" },
      }),
    ]);

    const eligibleTodayCount = todayRecipients.filter((r) => r.whatsappConsent && r.hasValidPhone).length;

    return {
      success: true,
      data: {
        sanghId: sangh.id,
        sanghName: sangh.name,
        sanghPrefix: sangh.prefix,
        todayCount: todayRecipients.length,
        upcomingCount: upcomingRecipients.length,
        consentedCount,
        eligibleTodayCount,
        sentThisYearCount: sentCount + deliveredCount,
        deliveredThisYearCount: deliveredCount,
        failedThisYearCount: failedCount,
        todayRecipients,
        upcomingRecipients,
        recentLogs,
      },
    };
  } catch (error: any) {
    console.error("[BIRTHDAY ACTION ERROR] getTrusteeBirthdayDashboardDataAction failed:", error);
    return { success: false, error: error?.message || "Failed to load birthday data." };
  }
}

/**
 * Fetch Comprehensive Birthday Automation Administration Data (ADMIN ONLY)
 */
export async function getAdminBirthdayDashboardDataAction(): Promise<{
  success: boolean;
  data?: AdminDashboardData;
  error?: string;
}> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return { success: false, error: "Unauthorized. Admin privileges required." };
  }

  const today = getAsiaKolkataDate();
  const config = getWhatsAppConfig();

  try {
    const sanghs = await prisma.sangh.findMany({
      where: { active: true },
      orderBy: { prefix: "asc" },
    });

    const sanghSummaries: SanghSummaryStat[] = [];
    const allTodayRecipients: BirthdayRecipientView[] = [];

    let totalEligibleHeads = 0;
    let totalConsented = 0;

    for (const s of sanghs) {
      const heads = await prisma.member.findMany({
        where: {
          relationship: "HEAD",
          status: "ACTIVE",
          dateOfBirth: { not: null },
          sanghId: s.id,
          family: { status: "ACTIVE", sanghId: s.id },
        },
        include: {
          family: {
            select: { id: true, familyId: true, mobile: true, normalizedMobile: true },
          },
          birthdayMessages: {
            where: { birthdayYear: today.year },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      totalEligibleHeads += heads.length;
      let sConsented = 0;
      let sTodayBirthdays = 0;

      for (const m of heads) {
        if (m.whatsappConsent) {
          sConsented++;
          totalConsented++;
        }

        if (isBirthdayToday(m.dateOfBirth)) {
          sTodayBirthdays++;
          const parsed = parseBirthMonthAndDay(m.dateOfBirth)!;
          const latestMsg = m.birthdayMessages[0];
          const normalizedPhone = normalizeToIndianE164(m.family.mobile);

          let latestStatus: BirthdayMessageStatus | "PENDING_TODAY" | "NONE" = "NONE";
          if (latestMsg) {
            latestStatus = latestMsg.status;
          } else {
            latestStatus = "PENDING_TODAY";
          }

          allTodayRecipients.push({
            memberId: m.memberId,
            memberDbId: m.id,
            name: m.name,
            familyId: m.family.familyId,
            sanghId: s.id,
            sanghName: s.name,
            sanghPrefix: s.prefix,
            maskedPhone: maskPhoneNumber(normalizedPhone || m.family.mobile),
            hasValidPhone: Boolean(normalizedPhone),
            dateOfBirthStr: m.dateOfBirth ? m.dateOfBirth.toISOString().split("T")[0] : "",
            birthMonth: parsed.birthMonth,
            birthDay: parsed.birthDay,
            age: m.age,
            daysUntil: 0,
            whatsappConsent: m.whatsappConsent,
            whatsappConsentDate: m.whatsappConsentDate ? m.whatsappConsentDate.toISOString() : null,
            whatsappConsentSource: m.whatsappConsentSource,
            latestMessageStatus: latestStatus,
            errorMessage: latestMsg ? (latestMsg.failureReason || latestMsg.skipReason || null) : null,
            sentAt: latestMsg?.sentAt ? latestMsg.sentAt.toISOString() : null,
            deliveredAt: latestMsg?.deliveredAt ? latestMsg.deliveredAt.toISOString() : null,
          });
        }
      }

      const [sentCount, deliveredCount, failedCount] = await Promise.all([
        prisma.birthdayMessageLog.count({
          where: { sanghId: s.id, birthdayYear: today.year, status: "SENT" },
        }),
        prisma.birthdayMessageLog.count({
          where: { sanghId: s.id, birthdayYear: today.year, status: { in: ["DELIVERED", "READ"] } },
        }),
        prisma.birthdayMessageLog.count({
          where: { sanghId: s.id, birthdayYear: today.year, status: "FAILED" },
        }),
      ]);

      sanghSummaries.push({
        sanghId: s.id,
        name: s.name,
        prefix: s.prefix,
        totalFamilyHeads: heads.length,
        consentedCount: sConsented,
        todayBirthdaysCount: sTodayBirthdays,
        sentThisYearCount: sentCount + deliveredCount,
        deliveredThisYearCount: deliveredCount,
        failedThisYearCount: failedCount,
      });
    }

    // Global counts for current year
    const [globalSent, globalDelivered, globalFailed, globalSkipped] = await Promise.all([
      prisma.birthdayMessageLog.count({
        where: { birthdayYear: today.year, status: "SENT" },
      }),
      prisma.birthdayMessageLog.count({
        where: { birthdayYear: today.year, status: { in: ["DELIVERED", "READ"] } },
      }),
      prisma.birthdayMessageLog.count({
        where: { birthdayYear: today.year, status: "FAILED" },
      }),
      prisma.birthdayMessageLog.count({
        where: { birthdayYear: today.year, status: "SKIPPED" },
      }),
    ]);

    // Current calendar month's billable messages count
    const startOfMonth = new Date(Date.UTC(today.year, today.month - 1, 1));
    const currentMonthSent = await prisma.birthdayMessageLog.count({
      where: {
        status: { in: ["SENT", "DELIVERED", "READ"] },
        createdAt: { gte: startOfMonth },
      },
    });

    // Meta WhatsApp Cloud API Marketing Rate in India: ~₹0.85 per delivered marketing message
    const ratePerMessage = 0.85;
    const estimatedCost = (currentMonthSent * ratePerMessage).toFixed(2);

    // Global recent 100 message logs
    const recentDbLogs = await prisma.birthdayMessageLog.findMany({
      include: {
        member: {
          select: {
            name: true,
            family: { select: { familyId: true } },
          },
        },
        sangh: { select: { name: true, prefix: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const recentLogs: BirthdayMessageLogView[] = recentDbLogs.map((log) => ({
      id: log.id,
      memberId: log.memberId,
      memberName: log.member.name,
      familyId: log.member.family.familyId,
      sanghName: log.sangh.name,
      sanghPrefix: log.sangh.prefix,
      maskedPhone: maskPhoneNumber(log.recipientPhone),
      birthdayYear: log.birthdayYear,
      status: log.status,
      templateName: log.templateName,
      errorMessage: log.failureReason || log.skipReason || null,
      attemptCount: log.attemptCount,
      sentAt: log.sentAt ? log.sentAt.toISOString() : null,
      deliveredAt: log.deliveredAt ? log.deliveredAt.toISOString() : null,
      createdAt: log.createdAt.toISOString(),
    }));

    const testRecipientPhone = process.env.WHATSAPP_TEST_RECIPIENT_PHONE || null;

    return {
      success: true,
      data: {
        totalEligibleHeads,
        totalConsented,
        totalNotConsented: totalEligibleHeads - totalConsented,
        todayTotalBirthdays: allTodayRecipients.length,
        todayEligibleBirthdays: allTodayRecipients.filter((r) => r.whatsappConsent && r.hasValidPhone).length,
        sentThisYear: globalSent + globalDelivered,
        deliveredThisYear: globalDelivered,
        failedThisYear: globalFailed,
        skippedThisYear: globalSkipped,
        currentMonthEstimatedCost: {
          sentMessagesCount: currentMonthSent,
          estimatedCostInr: `₹${estimatedCost}`,
          ratePerMessageInr: `₹${ratePerMessage.toFixed(2)}/msg`,
          disclaimer:
            "Estimated charges based on Meta WhatsApp Business Platform marketing conversation rates for India. This estimate is purely informational and does not constitute an invoice.",
        },
        configStatus: {
          phoneNumberIdConfigured: Boolean(config.phoneNumberId),
          businessAccountIdConfigured: Boolean(config.businessAccountId),
          accessTokenConfigured: Boolean(config.accessToken),
          apiVersion: config.apiVersion,
          templateName: config.templateName,
          templateLanguage: config.templateLanguage,
          sendingEnabled: config.sendingEnabled,
          cronSecretConfigured: Boolean(process.env.CRON_SECRET),
          webhookVerifyTokenConfigured: Boolean(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN),
          testRecipientConfigured: Boolean(testRecipientPhone),
          testRecipientMasked: testRecipientPhone ? maskPhoneNumber(testRecipientPhone) : null,
        },
        sanghSummaries,
        todayRecipients: allTodayRecipients,
        recentLogs,
      },
    };
  } catch (error: any) {
    console.error("[ADMIN ACTION ERROR] getAdminBirthdayDashboardDataAction failed:", error);
    return { success: false, error: error?.message || "Failed to load admin birthday data." };
  }
}

/**
 * Updates WhatsApp birthday greetings consent for a specific member.
 * Authorized for ADMIN and TRUSTEE (for their assigned Sangh only).
 */
export async function toggleMemberBirthdayConsentAction(
  memberId: string,
  consent: boolean
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized. Please log in." };
  }

  try {
    const member = await prisma.member.findUnique({
      where: { memberId },
      include: {
        family: { select: { familyId: true, sanghId: true } },
      },
    });

    if (!member) {
      return { success: false, error: "Member record not found." };
    }

    // Server-side authorization check:
    if (user.role === "TRUSTEE") {
      if (!user.sanghId || user.sanghId !== member.sanghId) {
        return {
          success: false,
          error: "Unauthorized: You are only permitted to update consent for members in your assigned Sangh.",
        };
      }
    } else if (user.role !== "ADMIN") {
      return { success: false, error: "Access denied: Insufficient permissions." };
    }

    const source = user.role === "ADMIN" ? "ADMIN_DASHBOARD" : "TRUSTEE_DASHBOARD";

    await prisma.$transaction(async (tx) => {
      await tx.member.update({
        where: { id: member.id },
        data: {
          whatsappConsent: consent,
          whatsappConsentDate: new Date(),
          whatsappConsentSource: source,
          whatsappConsentUpdatedBy: user.username,
        },
      });

      await logAuditEvent(
        {
          action: "WHATSAPP_CONSENT_UPDATED",
          entityType: "Member",
          entityId: member.id,
          performedBy: user.username,
          metadata: {
            memberId: member.memberId,
            name: member.name,
            familyId: member.family.familyId,
            newConsentStatus: consent,
            source,
          },
        },
        tx
      );
    });

    return { success: true };
  } catch (error: any) {
    console.error("[CONSENT ACTION ERROR] toggleMemberBirthdayConsentAction failed:", error);
    return { success: false, error: error?.message || "Failed to update consent status." };
  }
}

/**
 * Triggers a manual execution of the daily birthday scheduler (ADMIN ONLY).
 * Can be run in dry-run mode (preview without sending) or live mode.
 */
export async function triggerManualSchedulerRunAction(
  dryRun: boolean = true
): Promise<{ success: boolean; result?: any; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return { success: false, error: "Unauthorized: Administrator privileges required." };
  }

  try {
    const result = await runDailyBirthdayScheduler({
      dryRun,
      triggeredBy: `MANUAL_ADMIN_${user.username}`,
    });

    await logAuditEvent({
      action: dryRun ? "BIRTHDAY_SCHEDULER_DRY_RUN" : "BIRTHDAY_SCHEDULER_MANUAL_EXECUTION",
      entityType: "System",
      entityId: "MANUAL_RUN",
      performedBy: user.username,
      metadata: {
        dryRun,
        todayBirthdaysCount: result.todayBirthdaysCount,
        eligibleCount: result.eligibleCount,
        sentCount: result.sentCount,
        skippedCount: result.skippedCount,
        failedCount: result.failedCount,
      },
    });

    return { success: true, result };
  } catch (error: any) {
    console.error("[MANUAL SCHEDULER ERROR] triggerManualSchedulerRunAction failed:", error);
    return { success: false, error: error?.message || "Manual scheduler execution failed." };
  }
}

/**
 * Safe Test Mode: Dispatches a WhatsApp template message ONLY to a designated test recipient (ADMIN ONLY).
 * Strictly guards against sending test messages to real database recipients.
 */
export async function sendTestBirthdayMessageAction(
  testRecipientPhone: string,
  testRecipientName: string = "प्रिय सदस्य"
): Promise<{ success: boolean; messageId?: string; error?: string; rawResponse?: any }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return { success: false, error: "Unauthorized: Administrator privileges required." };
  }

  const normalizedPhone = normalizeToIndianE164(testRecipientPhone);
  if (!normalizedPhone) {
    return {
      success: false,
      error: "Invalid phone number. Test recipient must be a valid 10-digit Indian mobile number (+91XXXXXXXXXX).",
    };
  }

  // Check if WHATSAPP_TEST_RECIPIENT_PHONE is configured
  const configuredTestPhone = process.env.WHATSAPP_TEST_RECIPIENT_PHONE;
  if (configuredTestPhone) {
    const normalizedConfigured = normalizeToIndianE164(configuredTestPhone);
    if (normalizedConfigured && normalizedConfigured !== normalizedPhone) {
      return {
        success: false,
        error: `Security Restriction: The test phone number does not match the configured server test recipient (${maskPhoneNumber(
          normalizedConfigured
        )}).`,
      };
    }
  }

  try {
    const sendResult = await sendBirthdayTemplateMessage({
      to: normalizedPhone,
      recipientName: testRecipientName.trim() || "प्रिय सदस्य",
    });

    await logAuditEvent({
      action: "WHATSAPP_TEST_MESSAGE_DISPATCHED",
      entityType: "System",
      entityId: normalizedPhone,
      performedBy: user.username,
      metadata: {
        success: sendResult.success,
        messageId: sendResult.messageId,
        error: sendResult.error,
        recipientName: testRecipientName,
      },
    });

    if (sendResult.success) {
      return {
        success: true,
        messageId: sendResult.messageId,
        rawResponse: sendResult.rawResponse,
      };
    } else {
      return {
        success: false,
        error: sendResult.error || "Meta WhatsApp Cloud API rejected the test message.",
        rawResponse: sendResult.rawResponse,
      };
    }
  } catch (error: any) {
    console.error("[TEST MESSAGE ACTION ERROR] sendTestBirthdayMessageAction failed:", error);
    return { success: false, error: error?.message || "Failed to dispatch test message." };
  }
}
