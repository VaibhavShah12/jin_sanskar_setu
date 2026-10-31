import { requireAuth } from "@/lib/auth/auth-helpers";
import { getLavaajamDataAction } from "@/lib/actions/lavaajam-actions";
import LavaajamPortalClient, { LavaajamFamilyItem } from "@/components/LavaajamPortalClient";
import React from "react";
import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Sangh Lavaajam Register (संघ लवाजम) | Jin Sanskar Setu",
  description: "Sangh annual membership and Lavaajam register for authorized Trustees and Admins.",
};

export const dynamic = "force-dynamic";

export default async function LavaajamPage() {
  const user = await requireAuth();

  // Strict role enforcement: ONLY Trustees and Admins
  if (user.role !== "TRUSTEE" && user.role !== "ADMIN") {
    redirect("/dashboard?error=unauthorized_lavaajam");
  }

  const initialYear = "2026-2027";
  const result = await getLavaajamDataAction(initialYear);

  if (!result.success || !result.summary) {
    return (
      <main className="min-vh-100 bg-light py-5">
        <div className="container">
          <div className="alert alert-danger shadow-sm">
            <h5 className="alert-heading">
              <i className="bi bi-shield-lock-fill me-2"></i> Access or Load Error
            </h5>
            <p className="mb-0">{result.error || "Unable to load Lavaajam records."}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-vh-100 bg-light pb-5">
      <LavaajamPortalClient
        initialFamilies={result.families as LavaajamFamilyItem[]}
        initialSummary={result.summary}
        initialYear={initialYear}
        sanghs={result.sanghs || []}
        userRole={user.role}
        userSanghId={user.sanghId}
      />
    </main>
  );
}
