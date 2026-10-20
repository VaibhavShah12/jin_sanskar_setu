import PublicMemberFormClient from "@/components/PublicMemberFormClient";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Member Portal & Interests | Jin Sanskar Setu (जिन संस्कार सेतु)",
  description: "Request secure self-service access to view and update your registered family profile and interests.",
};

export const dynamic = "force-dynamic";

export default function MemberAccessPage() {
  return (
    <main className="min-vh-100 bg-light">
      <PublicMemberFormClient />
    </main>
  );
}
