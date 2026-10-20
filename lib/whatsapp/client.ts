import crypto from "crypto";
import { WhatsAppConfig, SendMessageResult } from "./types";
import { normalizeToIndianE164 } from "./phone";

/**
 * Retrieves server-side WhatsApp configuration from environment variables.
 * Never exposes credentials to client-side code.
 */
export function getWhatsAppConfig(): WhatsAppConfig {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim();
  const apiVersion = process.env.WHATSAPP_API_VERSION?.trim() || "v21.0";
  const webhookVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();
  const templateName = process.env.WHATSAPP_BIRTHDAY_TEMPLATE_NAME?.trim() || "jin_sanskar_birthday_greeting";
  const templateLanguage = process.env.WHATSAPP_BIRTHDAY_TEMPLATE_LANGUAGE?.trim() || "hi";
  const sendingEnabled = process.env.WHATSAPP_BIRTHDAY_SENDING_ENABLED?.trim().toLowerCase() === "true";
  const testRecipientPhone = process.env.WHATSAPP_TEST_RECIPIENT_PHONE?.trim();

  const missingConfig: string[] = [];
  if (!accessToken) missingConfig.push("WHATSAPP_ACCESS_TOKEN");
  if (!phoneNumberId) missingConfig.push("WHATSAPP_PHONE_NUMBER_ID");

  const isConfigured = missingConfig.length === 0;

  return {
    accessToken,
    phoneNumberId,
    businessAccountId,
    apiVersion,
    webhookVerifyToken,
    appSecret,
    templateName,
    templateLanguage,
    sendingEnabled,
    testRecipientPhone,
    isConfigured,
    missingConfig,
  };
}

/**
 * Sends a personalized birthday template greeting via official Meta WhatsApp Cloud API.
 * Uses template messaging approved by Meta.
 */
export async function sendBirthdayTemplateMessage(params: {
  to: string; // E.164 phone (+91XXXXXXXXXX)
  recipientName: string;
  templateName?: string;
  templateLanguage?: string;
  isTestSend?: boolean;
}): Promise<SendMessageResult> {
  const config = getWhatsAppConfig();

  // 1. Check credentials
  if (!config.isConfigured) {
    return {
      success: false,
      status: "SKIPPED",
      skippedReason: `WhatsApp API credentials missing: ${config.missingConfig.join(", ")}`,
      error: "WhatsApp API credentials are not configured in environment.",
    };
  }

  // 2. Check sending toggle (unless explicitly marked as a test send by Admin)
  if (!config.sendingEnabled && !params.isTestSend) {
    return {
      success: false,
      status: "SKIPPED",
      skippedReason: "Automated birthday sending is disabled in application settings (WHATSAPP_BIRTHDAY_SENDING_ENABLED is false).",
    };
  }

  // 3. Normalize recipient phone
  const normalizedPhone = normalizeToIndianE164(params.to);
  if (!normalizedPhone) {
    return {
      success: false,
      status: "FAILED",
      error: `Invalid Indian phone number format: "${params.to}". Must be 10 digits starting with 6-9.`,
    };
  }

  const template = params.templateName || config.templateName;
  const language = params.templateLanguage || config.templateLanguage;
  const endpoint = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;

  // WhatsApp Cloud API accepts phone number either with or without '+'
  const destinationPhone = normalizedPhone.replace(/^\+/, "");

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: destinationPhone,
    type: "template",
    template: {
      name: template,
      language: {
        code: language,
      },
      components: [
        {
          type: "body",
          parameters: [
            {
              type: "text",
              text: params.recipientName.trim(),
            },
          ],
        },
      ],
    },
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15-second timeout

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (response.ok && data.messages && data.messages.length > 0) {
      const messageId = data.messages[0].id;
      return {
        success: true,
        messageId,
        status: "SENT",
        rawResponse: data,
      };
    }

    // Handle Meta Graph API errors safely (never log the bearer token)
    const errorObj = data.error || {};
    const sanitizedError = errorObj.message || errorObj.error_user_msg || `Meta API Error (Code: ${errorObj.code || response.status})`;

    return {
      success: false,
      status: "FAILED",
      error: sanitizedError,
      rawResponse: {
        code: errorObj.code,
        type: errorObj.type,
        error_subcode: errorObj.error_subcode,
        message: sanitizedError,
      },
    };
  } catch (err: any) {
    const errorMsg = err.name === "AbortError" ? "WhatsApp API request timed out (15s)." : err.message || "Network error connecting to Meta WhatsApp Cloud API.";
    return {
      success: false,
      status: "FAILED",
      error: errorMsg,
    };
  }
}

/**
 * Cryptographically verifies Meta WhatsApp webhook HMAC-SHA256 signature.
 * Prevents unauthorized or forged webhook payloads.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  appSecret?: string
): boolean {
  const secret = appSecret || process.env.WHATSAPP_APP_SECRET?.trim();
  if (!secret || !signatureHeader) {
    // If no secret is configured, reject signature verification
    return false;
  }

  // Signature header format: "sha256=<hash>"
  const parts = signatureHeader.split("=");
  if (parts.length !== 2 || parts[0] !== "sha256") {
    return false;
  }

  const expectedSignature = parts[1];
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBody);
  const calculatedSignature = hmac.digest("hex");

  try {
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const calculatedBuffer = Buffer.from(calculatedSignature, "hex");
    if (expectedBuffer.length !== calculatedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuffer, calculatedBuffer);
  } catch {
    return false;
  }
}
