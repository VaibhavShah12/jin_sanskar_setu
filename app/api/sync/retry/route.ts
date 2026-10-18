import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/auth-helpers";
import { syncMemberToGoogleSheet } from "@/lib/google-sheets/sync";
import { prisma } from "@/lib/db/prisma";
import { logAuditEvent } from "@/lib/audit/logger";

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const { memberId, retryAll } = body;

    let retriedCount = 0;
    let successCount = 0;

    if (memberId) {
      const res = await syncMemberToGoogleSheet(memberId, admin.username);
      retriedCount = 1;
      if (res.success) successCount = 1;
    } else if (retryAll) {
      const failedSyncs = await prisma.googleSheetSync.findMany({
        where: { status: "FAILED" },
        take: 50, // Batch limit
      });

      retriedCount = failedSyncs.length;
      for (const item of failedSyncs) {
        const res = await syncMemberToGoogleSheet(item.memberId, admin.username);
        if (res.success) successCount++;
      }
    }

    await logAuditEvent({
      action: "GOOGLE_SHEET_SYNC_RETRIED",
      entityType: "Sync",
      entityId: memberId || "BATCH_RETRY",
      performedBy: admin.username,
      metadata: { retriedCount, successCount },
    });

    return NextResponse.json({
      success: true,
      retriedCount,
      successCount,
      message: `Retried ${retriedCount} record(s). ${successCount} successfully synchronized.`,
    });
  } catch (err: any) {
    console.error("Retry sync error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to retry Google Sheet sync" },
      { status: 500 }
    );
  }
}
