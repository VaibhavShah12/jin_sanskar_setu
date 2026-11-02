import React from "react";
import { Metadata } from "next";
import { requireAuth } from "@/lib/auth/auth-helpers";
import { getCorrectionRequestsAction } from "@/lib/actions/member-form-actions";
import CorrectionRequestsClient from "@/components/CorrectionRequestsClient";

export const metadata: Metadata = {
  title: "Profile Correction Requests | Jin Sanskar Setu",
  description: "Review and approve family member profile correction requests.",
};

export const dynamic = "force-dynamic";

export default async function CorrectionsPage() {
  const user = await requireAuth();
  const requests = await getCorrectionRequestsAction();

  const canManage = user.role === "ADMIN" || user.role === "VOLUNTEER" || user.role === "TRUSTEE";

  return <CorrectionRequestsClient initialRequests={requests} canManage={canManage} />;
}
