import { requireAdmin } from "@/lib/auth/auth-helpers";
import { prisma } from "@/lib/db/prisma";
import AdminSyncClient from "@/components/AdminSyncClient";
import React from "react";

export const dynamic = "force-dynamic";

export default async function AdminSyncPage() {
  await requireAdmin();

  const [syncs, total, synced, pending, failed] = await Promise.all([
    prisma.googleSheetSync.findMany({
      include: {
        member: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.googleSheetSync.count(),
    prisma.googleSheetSync.count({ where: { status: "SYNCED" } }),
    prisma.googleSheetSync.count({ where: { status: "PENDING" } }),
    prisma.googleSheetSync.count({ where: { status: "FAILED" } }),
  ]);

  const hasConfig = Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY &&
    process.env.GOOGLE_SHEET_ID
  );

  return (
    <div className="container py-2 py-md-4">
      <div className="mb-4">
        <h1 className="h3 fw-bold text-dark mb-1">Google Sheets Synchronization Manager</h1>
        <p className="text-muted small mb-0">
          Monitor background synchronized reporting. Failed attempts can be individually or bulk retried.
        </p>
      </div>

      <AdminSyncClient
        initialSyncs={syncs}
        stats={{ total, synced, pending, failed }}
        hasConfig={hasConfig}
      />
    </div>
  );
}
