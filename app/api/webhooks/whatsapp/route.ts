import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyWebhookSignature } from "@/lib/whatsapp/client";
import { BirthdayMessageStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Meta WhatsApp Cloud API Webhook
 *
 * GET: Verification challenge during Meta Webhook setup.
 * POST: Delivery status notifications (SENT, DELIVERED, READ, FAILED).
 */

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expectedVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (!expectedVerifyToken) {
    console.error("[WHATSAPP WEBHOOK] WHATSAPP_WEBHOOK_VERIFY_TOKEN is not configured.");
    return new Response("Webhook verification token not configured on server.", { status: 500 });
  }

  // Verification request from Meta Graph API
  if (mode === "subscribe" && token === expectedVerifyToken) {
    console.log("[WHATSAPP WEBHOOK] Verification challenge succeeded.");
    return new Response(challenge || "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.warn("[WHATSAPP WEBHOOK] Verification token mismatch or invalid mode.");
  return new Response("Forbidden: Verification token mismatch.", { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("x-hub-signature-256");
    const appSecret = process.env.WHATSAPP_APP_SECRET;

    // Cryptographic signature check if app secret is provided
    if (appSecret && appSecret.trim().length > 0) {
      const isValid = verifyWebhookSignature(rawBody, signatureHeader, appSecret);
      if (!isValid) {
        console.warn("[WHATSAPP WEBHOOK] Invalid HMAC-SHA256 signature.");
        return NextResponse.json(
          { error: "Invalid signature. Payload authenticity could not be verified." },
          { status: 401 }
        );
      }
    }

    const payload = JSON.parse(rawBody);

    // Meta Webhook structure: entry[].changes[].value.statuses[]
    if (payload.object === "whatsapp_business_account" && Array.isArray(payload.entry)) {
      for (const entry of payload.entry) {
        if (!Array.isArray(entry.changes)) continue;

        for (const change of entry.changes) {
          const value = change.value;
          if (!value || !Array.isArray(value.statuses)) continue;

          for (const statusItem of value.statuses) {
            await processStatusUpdate(statusItem);
          }
        }
      }
    }

    // Always acknowledge 200 OK fast to prevent Meta from retrying delivery notifications
    return NextResponse.json({ status: "EVENT_RECEIVED" }, { status: 200 });
  } catch (error: any) {
    console.error("[WHATSAPP WEBHOOK] Error processing webhook event:", error);
    // Return 200 to acknowledge reception even on payload parse error to prevent infinite retries
    return NextResponse.json({ status: "ERROR_RECORDED", error: error?.message }, { status: 200 });
  }
}

const STATUS_PRECEDENCE: Record<BirthdayMessageStatus, number> = {
  SCHEDULED: 0,
  SKIPPED: 1,
  FAILED: 1,
  SENT: 2,
  DELIVERED: 3,
  READ: 4,
};

async function processStatusUpdate(statusItem: any) {
  const messageId = statusItem.id;
  const rawStatus = (statusItem.status || "").toLowerCase();
  const timestamp = statusItem.timestamp ? new Date(parseInt(statusItem.timestamp, 10) * 1000) : new Date();

  if (!messageId) return;

  // Find the corresponding message log by WhatsApp Message ID
  const messageLog = await prisma.birthdayMessageLog.findFirst({
    where: { whatsappMessageId: messageId },
  });

  if (!messageLog) {
    // Might be another message or test message not tracked in birthday logs
    return;
  }

  const currentPrecedence = STATUS_PRECEDENCE[messageLog.status] || 0;

  if (rawStatus === "sent") {
    if (currentPrecedence < STATUS_PRECEDENCE.SENT) {
      await prisma.birthdayMessageLog.update({
        where: { id: messageLog.id },
        data: {
          status: "SENT",
          sentAt: messageLog.sentAt || timestamp,
        },
      });
    }
  } else if (rawStatus === "delivered") {
    if (currentPrecedence < STATUS_PRECEDENCE.DELIVERED) {
      await prisma.birthdayMessageLog.update({
        where: { id: messageLog.id },
        data: {
          status: "DELIVERED",
          deliveredAt: timestamp,
        },
      });
    }
  } else if (rawStatus === "read") {
    if (currentPrecedence < STATUS_PRECEDENCE.READ) {
      await prisma.birthdayMessageLog.update({
        where: { id: messageLog.id },
        data: {
          status: "READ",
          readAt: timestamp,
          deliveredAt: messageLog.deliveredAt || timestamp,
        },
      });
    }
  } else if (rawStatus === "failed") {
    // Do not downgrade if already confirmed delivered or read
    if (currentPrecedence < STATUS_PRECEDENCE.DELIVERED) {
      const errorObj = Array.isArray(statusItem.errors) && statusItem.errors.length > 0 ? statusItem.errors[0] : null;
      const errorMsg = errorObj ? `${errorObj.title || "Error"}: ${errorObj.message || ""}` : "Delivery failed.";

      await prisma.birthdayMessageLog.update({
        where: { id: messageLog.id },
        data: {
          status: "FAILED",
          failureReason: errorMsg.trim(),
          failedAt: timestamp,
        },
      });
    }
  }
}
