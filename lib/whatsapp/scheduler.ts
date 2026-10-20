import { prisma } from "@/lib/db/prisma";
import { getAsiaKolkataDate, isBirthdayToday, parseBirthMonthAndDay } from "./date-helper";
import { normalizeToIndianE164 } from "./phone";
import { sendBirthdayTemplateMessage, getWhatsAppConfig } from "./client";
import { SchedulerRunResult, BirthdayCandidate } from "./types";
import { logAuditEvent } from "@/lib/audit/logger";
import { BirthdayMessageStatus } from "@prisma/client";

/**
 * Finds all active family heads and checks who has a birthday today in Asia/Kolkata.
 * Can be filtered by a specific sanghId for trustee/Sangh views.
 */
export async function getTodayBirthdayCandidates(sanghId?: string): Promise<BirthdayCandidate[]> {
  const today = getAsiaKolkataDate();

  // Query all active family heads who have a non-null dateOfBirth
  const headMembers = await prisma.member.findMany({
    where: {
      relationship: "HEAD",
      status: "ACTIVE",
      dateOfBirth: { not: null },
      family: {
        status: "ACTIVE",
        ...(sanghId ? { sanghId } : {}),
      },
    },
    include: {
      family: {
        select: {
          id: true,
          familyId: true,
          mobile: true,
          normalizedMobile: true,
          sanghId: true,
          sangh: {
            select: {
              name: true,
              prefix: true,
            },
          },
        },
      },
      birthdayMessages: {
        where: {
          birthdayYear: today.year,
        },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });

  const candidates: BirthdayCandidate[] = [];

  for (const member of headMembers) {
    if (!isBirthdayToday(member.dateOfBirth)) {
      continue;
    }

    const birthParsed = parseBirthMonthAndDay(member.dateOfBirth);
    const calculatedAge = birthParsed ? today.year - birthParsed.birthYear : member.age;
    const normalizedMobile = normalizeToIndianE164(member.family.mobile);

    const existingLog = member.birthdayMessages[0];

    candidates.push({
      memberId: member.id,
      familyId: member.family.id,
      sanghId: member.family.sanghId,
      sanghName: member.family.sangh.name,
      sanghPrefix: member.family.sangh.prefix,
      headName: member.name,
      rawMobile: member.family.mobile,
      normalizedMobile,
      dateOfBirth: member.dateOfBirth,
      age: member.age,
      calculatedAge,
      whatsappConsent: member.whatsappConsent,
      whatsappConsentDate: member.whatsappConsentDate,
      existingMessageStatus: existingLog?.status || null,
      existingMessageId: existingLog?.whatsappMessageId || null,
    });
  }

  return candidates;
}

/**
 * Core Daily Birthday Messaging Scheduler
 *
 * Runs once daily in Asia/Kolkata timezone.
 * Atomically checks, claims, and delivers greetings to eligible family heads.
 * Enforces:
 * - Current Indian calendar date match
 * - Active Family Head relationship
 * - Valid Indian E.164 phone number
 * - Explicit WhatsApp greeting consent
 * - Strict single send per recipient per birthday year via database uniqueness
 */
export async function runDailyBirthdayScheduler(options: {
  dryRun?: boolean;
  triggeredBy?: string;
  sanghId?: string;
}): Promise<SchedulerRunResult> {
  const isDryRun = Boolean(options.dryRun);
  const actor = options.triggeredBy || "SYSTEM_CRON";
  const today = getAsiaKolkataDate();
  const config = getWhatsAppConfig();

  const formattedDate = `${today.year}-${String(today.month).padStart(2, "0")}-${String(today.day).padStart(2, "0")}`;
  const scheduledDate = new Date(`${formattedDate}T00:00:00.000Z`);

  console.log(`[BIRTHDAY_SCHEDULER] Running on ${formattedDate} (IST). DryRun: ${isDryRun}. Triggered by: ${actor}`);

  // Fetch candidates whose birthday is today
  const candidates = await getTodayBirthdayCandidates(options.sanghId);

  const result: SchedulerRunResult = {
    runDate: formattedDate,
    year: today.year,
    totalHeadsChecked: candidates.length,
    todayBirthdaysCount: candidates.length,
    eligibleCount: 0,
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
    details: [],
  };

  for (const candidate of candidates) {
    // 1. Phone validation check
    if (!candidate.normalizedMobile) {
      result.skippedCount++;
      result.details.push({
        memberId: candidate.memberId,
        headName: candidate.headName,
        sanghPrefix: candidate.sanghPrefix,
        phone: candidate.rawMobile,
        status: "SKIPPED",
        reason: "INVALID_PHONE_NUMBER",
      });

      if (!isDryRun) {
        await logSkippedMessage({
          candidate,
          birthdayYear: today.year,
          scheduledDate,
          phone: candidate.rawMobile,
          skipReason: "INVALID_PHONE_NUMBER: Number does not conform to valid Indian E.164 (+91XXXXXXXXXX) standard.",
          templateName: config.templateName,
          templateLanguage: config.templateLanguage,
        });
      }
      continue;
    }

    // 2. Explicit Consent Check
    if (!candidate.whatsappConsent) {
      result.skippedCount++;
      result.details.push({
        memberId: candidate.memberId,
        headName: candidate.headName,
        sanghPrefix: candidate.sanghPrefix,
        phone: candidate.normalizedMobile,
        status: "SKIPPED",
        reason: "NO_CONSENT",
      });

      if (!isDryRun) {
        await logSkippedMessage({
          candidate,
          birthdayYear: today.year,
          scheduledDate,
          phone: candidate.normalizedMobile,
          skipReason: "NO_CONSENT: Recipient has not provided explicit consent to receive WhatsApp birthday greetings.",
          templateName: config.templateName,
          templateLanguage: config.templateLanguage,
        });
      }
      continue;
    }

    // 3. Duplicate Prevention Check (Has already been sent or scheduled this year?)
    const existingLog = await prisma.birthdayMessageLog.findUnique({
      where: {
        memberId_birthdayYear: {
          memberId: candidate.memberId,
          birthdayYear: today.year,
        },
      },
    });

    if (existingLog && ["SENT", "DELIVERED", "READ"].includes(existingLog.status)) {
      result.skippedCount++;
      result.details.push({
        memberId: candidate.memberId,
        headName: candidate.headName,
        sanghPrefix: candidate.sanghPrefix,
        phone: candidate.normalizedMobile,
        status: existingLog.status,
        reason: `ALREADY_SENT_FOR_${today.year}`,
        messageId: existingLog.whatsappMessageId || undefined,
      });
      continue;
    }

    result.eligibleCount++;

    // In Dry-Run mode, report candidate as ready to send without dispatching API call
    if (isDryRun) {
      result.sentCount++;
      result.details.push({
        memberId: candidate.memberId,
        headName: candidate.headName,
        sanghPrefix: candidate.sanghPrefix,
        phone: candidate.normalizedMobile,
        status: "SCHEDULED",
        reason: "DRY_RUN_PREVIEW: Eligible for birthday greeting",
      });
      continue;
    }

    // 4. Atomic Claim & Message Dispatch
    // Create/upsert a log record in SCHEDULED state to prevent race conditions
    let messageLog;
    try {
      messageLog = await prisma.birthdayMessageLog.upsert({
        where: {
          memberId_birthdayYear: {
            memberId: candidate.memberId,
            birthdayYear: today.year,
          },
        },
        create: {
          memberId: candidate.memberId,
          familyId: candidate.familyId,
          sanghId: candidate.sanghId,
          birthdayYear: today.year,
          scheduledDate,
          recipientName: candidate.headName,
          recipientPhone: candidate.normalizedMobile,
          templateName: config.templateName,
          templateLanguage: config.templateLanguage,
          status: "SCHEDULED",
          attemptCount: 1,
          lastAttemptAt: new Date(),
        },
        update: {
          attemptCount: { increment: 1 },
          lastAttemptAt: new Date(),
        },
      });
    } catch (upsertErr: any) {
      console.error(`[BIRTHDAY_SCHEDULER] Upsert error for member ${candidate.memberId}:`, upsertErr);
      result.failedCount++;
      continue;
    }

    // 5. Send message via Meta WhatsApp Cloud API
    const sendResult = await sendBirthdayTemplateMessage({
      to: candidate.normalizedMobile,
      recipientName: candidate.headName,
      templateName: config.templateName,
      templateLanguage: config.templateLanguage,
    });

    if (sendResult.success && sendResult.messageId) {
      result.sentCount++;
      await prisma.birthdayMessageLog.update({
        where: { id: messageLog.id },
        data: {
          status: "SENT",
          whatsappMessageId: sendResult.messageId,
          sentAt: new Date(),
          responsePayload: sendResult.rawResponse || undefined,
          failureReason: null,
        },
      });

      result.details.push({
        memberId: candidate.memberId,
        headName: candidate.headName,
        sanghPrefix: candidate.sanghPrefix,
        phone: candidate.normalizedMobile,
        status: "SENT",
        messageId: sendResult.messageId,
      });

      await logAuditEvent({
        action: "BIRTHDAY_MESSAGE_SENT",
        entityType: "Member",
        entityId: candidate.memberId,
        performedBy: actor,
        metadata: {
          birthdayYear: today.year,
          recipientName: candidate.headName,
          sanghPrefix: candidate.sanghPrefix,
          whatsappMessageId: sendResult.messageId,
        },
      });
    } else if (sendResult.status === "SKIPPED") {
      result.skippedCount++;
      await prisma.birthdayMessageLog.update({
        where: { id: messageLog.id },
        data: {
          status: "SKIPPED",
          skipReason: sendResult.skippedReason,
        },
      });

      result.details.push({
        memberId: candidate.memberId,
        headName: candidate.headName,
        sanghPrefix: candidate.sanghPrefix,
        phone: candidate.normalizedMobile,
        status: "SKIPPED",
        reason: sendResult.skippedReason,
      });
    } else {
      result.failedCount++;
      await prisma.birthdayMessageLog.update({
        where: { id: messageLog.id },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          failureReason: sendResult.error,
          responsePayload: sendResult.rawResponse || undefined,
        },
      });

      result.details.push({
        memberId: candidate.memberId,
        headName: candidate.headName,
        sanghPrefix: candidate.sanghPrefix,
        phone: candidate.normalizedMobile,
        status: "FAILED",
        reason: sendResult.error,
      });

      await logAuditEvent({
        action: "BIRTHDAY_MESSAGE_FAILED",
        entityType: "Member",
        entityId: candidate.memberId,
        performedBy: actor,
        metadata: {
          birthdayYear: today.year,
          recipientName: candidate.headName,
          error: sendResult.error,
        },
      });
    }
  }

  return result;
}

/**
 * Safely upserts a SKIPPED record in BirthdayMessageLog to record exclusions in audit history.
 */
async function logSkippedMessage(params: {
  candidate: BirthdayCandidate;
  birthdayYear: number;
  scheduledDate: Date;
  phone: string;
  skipReason: string;
  templateName: string;
  templateLanguage: string;
}) {
  try {
    await prisma.birthdayMessageLog.upsert({
      where: {
        memberId_birthdayYear: {
          memberId: params.candidate.memberId,
          birthdayYear: params.birthdayYear,
        },
      },
      create: {
        memberId: params.candidate.memberId,
        familyId: params.candidate.familyId,
        sanghId: params.candidate.sanghId,
        birthdayYear: params.birthdayYear,
        scheduledDate: params.scheduledDate,
        recipientName: params.candidate.headName,
        recipientPhone: params.phone || "UNKNOWN",
        templateName: params.templateName,
        templateLanguage: params.templateLanguage,
        status: "SKIPPED",
        skipReason: params.skipReason,
      },
      update: {
        skipReason: params.skipReason,
        status: "SKIPPED",
      },
    });
  } catch (err) {
    // Ignore duplicate key if already logged
  }
}
