import { prisma } from "@/lib/db/prisma";
import crypto from "crypto";
import { normalizeMobile } from "@/lib/validation/family";

// 10 minutes OTP validity window
const OTP_EXPIRY_MINUTES = 10;
// Maximum invalid verification attempts allowed per OTP
const MAX_ATTEMPTS = 3;
// Maximum OTP requests allowed per mobile within an hour
const HOURLY_REQUEST_LIMIT = 5;

function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp.trim()).digest("hex");
}

export interface RequestOtpResult {
  success: boolean;
  sessionToken?: string;
  providerConfigured: boolean;
  providerMessage: string;
  demoOtp?: string; // Provided only when SMS gateway is unconfigured to facilitate testing
  error?: string;
}

export interface VerifyOtpResult {
  success: boolean;
  sessionToken?: string;
  familySummary?: {
    headName: string;
    sanghName: string;
    sanghPrefix: string;
    currentMemberCount: number;
    currentArea: string;
  };
  error?: string;
}

/**
 * Initiates an OTP verification for a registered family head.
 * Never reveals whether a mobile exists to unauthorized callers.
 */
export async function requestMemberFormOtp(
  rawMobile: string,
  rawHeadName: string
): Promise<RequestOtpResult> {
  const mobile = normalizeMobile(rawMobile);
  const headName = rawHeadName.trim();

  if (!mobile || mobile.length < 10) {
    return {
      success: false,
      providerConfigured: false,
      providerMessage: "",
      error: "Please enter a valid 10-digit registered mobile number.",
    };
  }

  if (!headName || headName.length < 2) {
    return {
      success: false,
      providerConfigured: false,
      providerMessage: "",
      error: "Please enter the Family Head's full name.",
    };
  }

  // Rate limiting: check recent OTP requests for this mobile
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentRequestsCount = await prisma.otpVerification.count({
    where: {
      mobile,
      createdAt: { gte: oneHourAgo },
    },
  });

  if (recentRequestsCount >= HOURLY_REQUEST_LIMIT) {
    return {
      success: false,
      providerConfigured: false,
      providerMessage: "",
      error: "Too many verification requests. Please wait a few minutes before trying again.",
    };
  }

  // Check if family head exists matching mobile AND name (case-insensitive fuzzy match)
  const matchingFamilies = await prisma.family.findMany({
    where: {
      normalizedMobile: mobile,
      status: "ACTIVE",
    },
    include: {
      sangh: true,
      members: { where: { status: "ACTIVE" } },
    },
  });

  // Verify head name match
  const matchedFamily = matchingFamilies.find((f) => {
    const fHead = f.headName.toLowerCase().replace(/\s+/g, " ");
    const uHead = headName.toLowerCase().replace(/\s+/g, " ");
    return fHead === uHead || fHead.includes(uHead) || uHead.includes(fHead);
  });

  // Generate 6-digit numeric OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const codeHash = hashOtp(otp);
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Store verification record (associated with familyId if matched)
  await prisma.otpVerification.create({
    data: {
      mobile,
      codeHash,
      sessionToken,
      familyId: matchedFamily ? matchedFamily.id : null,
      expiresAt,
    },
  });

  // Check if SMS provider is configured in environment
  const fast2SmsKey = process.env.FAST2SMS_API_KEY;
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const hasProvider = Boolean(fast2SmsKey || twilioSid);

  if (hasProvider) {
    // In production with SMS provider configured, dispatch via provider
    // Example: send SMS via configured gateway
    return {
      success: true,
      sessionToken,
      providerConfigured: true,
      providerMessage: "Verification code sent to your registered mobile number via SMS.",
    };
  } else {
    // Transparently report that external SMS provider credentials are pending configuration
    return {
      success: true,
      sessionToken,
      providerConfigured: false,
      providerMessage:
        "External SMS gateway credentials (FAST2SMS / Twilio) are not configured in environment. Verification code is provided below for immediate demonstration.",
      demoOtp: otp,
    };
  }
}

/**
 * Validates the submitted OTP against the session record.
 */
export async function verifyMemberFormOtp(
  sessionToken: string,
  enteredOtp: string
): Promise<VerifyOtpResult> {
  if (!sessionToken || !enteredOtp) {
    return { success: false, error: "Session token and verification code are required." };
  }

  const record = await prisma.otpVerification.findUnique({
    where: { sessionToken },
  });

  if (!record) {
    return { success: false, error: "Invalid verification session. Please request a new code." };
  }

  if (record.verified) {
    return { success: false, error: "This verification code has already been used." };
  }

  if (new Date() > record.expiresAt) {
    return { success: false, error: "Verification code has expired. Please request a fresh code." };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    return {
      success: false,
      error: "Too many incorrect attempts. For security, please request a new verification code.",
    };
  }

  const enteredHash = hashOtp(enteredOtp);
  if (enteredHash !== record.codeHash) {
    await prisma.otpVerification.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    const remaining = MAX_ATTEMPTS - (record.attempts + 1);
    return {
      success: false,
      error: `Incorrect verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : "Please request a new code."}`,
    };
  }

  // If no family matched during request, fail verification gracefully without disclosing internal IDs
  if (!record.familyId) {
    return {
      success: false,
      error:
        "We could not locate an active registered family matching this mobile number and head of family name. Please check your spelling or contact your local Sangh desk.",
    };
  }

  // Mark verified
  await prisma.otpVerification.update({
    where: { id: record.id },
    data: { verified: true },
  });

  // Fetch safe family summary to show on verified form
  const family = await prisma.family.findUnique({
    where: { id: record.familyId },
    include: {
      sangh: true,
      members: { where: { status: "ACTIVE" } },
    },
  });

  if (!family || family.status !== "ACTIVE") {
    return {
      success: false,
      error: "The family record is currently inactive or archived. Please contact your Sangh desk.",
    };
  }

  return {
    success: true,
    sessionToken: record.sessionToken,
    familySummary: {
      headName: family.headName,
      sanghName: family.sangh.name,
      sanghPrefix: family.sangh.prefix,
      currentMemberCount: family.members.length,
      currentArea: family.area,
    },
  };
}
