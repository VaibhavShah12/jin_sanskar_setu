import { requireAuth } from "@/lib/auth/auth-helpers";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import React from "react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Change Password | Jin Sanskar Setu",
};

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  await requireAuth();

  return (
    <div className="container py-4 py-md-5" style={{ maxWidth: "600px" }}>
      <ChangePasswordForm />
    </div>
  );
}
