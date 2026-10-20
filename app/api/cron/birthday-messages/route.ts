import { NextRequest, NextResponse } from "next/server";
import { runDailyBirthdayScheduler } from "@/lib/whatsapp/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow sufficient time for bounded batch processing

/**
 * Daily Birthday Greeting Cron Job
 * Triggered by Vercel Cron at 03:30 UTC (09:00 AM IST Asia/Kolkata).
 *
 * Security:
 * Requires authorization via CRON_SECRET:
 * - Header: Authorization: Bearer <CRON_SECRET>
 * - Header: x-cron-secret: <CRON_SECRET>
 * - Query param: ?secret=<CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}

async function handleCron(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  // 1. Verify CRON_SECRET is configured
  if (!cronSecret || cronSecret.trim().length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: "CRON_SECRET is not configured on the server. Scheduled jobs are paused for security.",
      },
      { status: 500 }
    );
  }

  // 2. Validate incoming request authorization
  const authHeader = request.headers.get("authorization") || "";
  const customHeader = request.headers.get("x-cron-secret") || "";
  const querySecret = request.nextUrl.searchParams.get("secret") || "";

  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.substring(7).trim() : "";

  const isAuthorized =
    bearerToken === cronSecret ||
    customHeader === cronSecret ||
    querySecret === cronSecret;

  if (!isAuthorized) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized: Invalid or missing authorization credentials for cron endpoint.",
      },
      { status: 401 }
    );
  }

  // Check if dryRun is requested (e.g. for testing execution pipeline without actual dispatch)
  const dryRunParam = request.nextUrl.searchParams.get("dryRun");
  const isDryRun = dryRunParam === "true";

  try {
    const result = await runDailyBirthdayScheduler({
      dryRun: isDryRun,
      triggeredBy: isDryRun ? "CRON_DRY_RUN" : "VERCEL_CRON",
    });

    return NextResponse.json({
      success: true,
      message: isDryRun
        ? "Dry-run execution completed. No actual messages were sent."
        : "Daily birthday greeting scheduler completed successfully.",
      result,
    });
  } catch (error: any) {
    console.error("[CRON ROUTE ERROR] Birthday scheduler failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "An unexpected error occurred during birthday scheduler execution.",
      },
      { status: 500 }
    );
  }
}
