import PublicMemberFormClient from "@/components/PublicMemberFormClient";
import React from "react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Member Verification & Update Form | Jin Sanskar Setu",
  description: "Official mobile-friendly member verification and update form for Jin Sanskar Setu community census.",
};

export const dynamic = "force-dynamic";

export default function PublicMemberFormPage() {
  return (
    <main className="min-vh-100 bg-light">
      <PublicMemberFormClient />
    </main>
  );
}
