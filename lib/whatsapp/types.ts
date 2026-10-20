import { BirthdayMessageStatus } from "@prisma/client";

export interface WhatsAppConfig {
  accessToken?: string;
  phoneNumberId?: string;
  businessAccountId?: string;
  apiVersion: string;
  webhookVerifyToken?: string;
  appSecret?: string;
  templateName: string;
  templateLanguage: string;
  sendingEnabled: boolean;
  testRecipientPhone?: string;
  isConfigured: boolean;
  missingConfig: string[];
}

export interface BirthdayCandidate {
  memberId: string;
  familyId: string;
  sanghId: string;
  sanghName: string;
  sanghPrefix: string;
  headName: string;
  rawMobile: string;
  normalizedMobile: string | null;
  dateOfBirth: Date | null;
  age: number;
  calculatedAge: number;
  whatsappConsent: boolean;
  whatsappConsentDate: Date | null;
  existingMessageStatus?: BirthdayMessageStatus | null;
  existingMessageId?: string | null;
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  status: BirthdayMessageStatus;
  error?: string;
  skippedReason?: string;
  rawResponse?: any;
}

export interface SchedulerRunResult {
  runDate: string; // YYYY-MM-DD
  year: number;
  totalHeadsChecked: number;
  todayBirthdaysCount: number;
  eligibleCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  details: {
    memberId: string;
    headName: string;
    sanghPrefix: string;
    phone: string;
    status: BirthdayMessageStatus;
    reason?: string;
    messageId?: string;
  }[];
}
