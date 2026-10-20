import { requireAuth } from "@/lib/auth/auth-helpers";
import { redirect } from "next/navigation";
import {
  getPublicMemberFormUrl,
  generateMemberFormQrCodeDataUrl,
  generateMemberFormQrCodeSvg,
  getPublicMemberAccessUrl,
  generateMemberAccessQrCodeDataUrl,
  generateMemberAccessQrCodeSvg,
} from "@/lib/qr/qr-helper";
import AdminQrCodeClient from "@/components/AdminQrCodeClient";
import React from "react";

export const dynamic = "force-dynamic";

export default async function AdminQrCodePage() {
  const user = await requireAuth();
  if (user.role === "TRUSTEE") {
    redirect("/unauthorized");
  }

  const memberFormUrl = getPublicMemberFormUrl();
  const memberAccessUrl = getPublicMemberAccessUrl();

  const [formQrDataUrl, formQrSvg, accessQrDataUrl, accessQrSvg] = await Promise.all([
    generateMemberFormQrCodeDataUrl(memberFormUrl),
    generateMemberFormQrCodeSvg(memberFormUrl),
    generateMemberAccessQrCodeDataUrl(memberAccessUrl),
    generateMemberAccessQrCodeSvg(memberAccessUrl),
  ]);

  const memberFormQr = {
    title: "Member Verification & Update Form",
    hindiTitle: "सदस्य सत्यापन एवं संशोधन फॉर्म",
    subtitle: "Scan to verify family information and submit corrections to Sangh volunteers",
    targetUrl: memberFormUrl,
    qrDataUrl: formQrDataUrl,
    qrSvg: formQrSvg,
    filename: "jin_sanskar_setu_member_form_qr",
  };

  const memberAccessQr = {
    title: "Member Self-Service Access Portal",
    hindiTitle: "सदस्य स्व-सेवा पोर्टल",
    subtitle: "Scan to request viewing access to registered family survey records",
    targetUrl: memberAccessUrl,
    qrDataUrl: accessQrDataUrl,
    qrSvg: accessQrSvg,
    filename: "jin_sanskar_setu_member_access_qr",
  };

  return (
    <div className="container py-2 py-md-4">
      <div className="mb-4">
        <h1 className="h3 fw-bold text-dark mb-1">Member Form &amp; Portal QR Codes</h1>
        <p className="text-muted small mb-0">
          Official QR codes for Jin Sanskar Setu public forms. Share these at Derasars, Pathshalas, and community notices for easy camera scanning.
        </p>
      </div>

      <AdminQrCodeClient
        memberFormQr={memberFormQr}
        memberAccessQr={memberAccessQr}
      />
    </div>
  );
}
