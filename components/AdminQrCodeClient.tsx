"use client";

import React, { useRef, useState } from "react";
import Logo from "@/components/Logo";

interface QrItem {
  title: string;
  hindiTitle: string;
  subtitle: string;
  targetUrl: string;
  qrDataUrl: string;
  qrSvg: string;
  filename: string;
}

interface AdminQrCodeClientProps {
  memberFormQr: QrItem;
  memberAccessQr: QrItem;
}

export default function AdminQrCodeClient({
  memberFormQr,
  memberAccessQr,
}: AdminQrCodeClientProps) {
  const [activeTab, setActiveTab] = useState<"member-form" | "member-access">("member-form");
  const [copied, setCopied] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const currentQr = activeTab === "member-form" ? memberFormQr : memberAccessQr;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(currentQr.targetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      prompt("Copy form URL:", currentQr.targetUrl);
    }
  };

  const handleDownloadPng = () => {
    const a = document.createElement("a");
    a.href = currentQr.qrDataUrl;
    a.download = `${currentQr.filename}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadSvg = () => {
    const blob = new Blob([currentQr.qrSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentQr.filename}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      {/* Tab Switcher */}
      <div className="d-flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab("member-form")}
          className={`btn ${
            activeTab === "member-form" ? "btn-jain-primary shadow-sm" : "btn-outline-secondary"
          } d-flex align-items-center gap-2 px-3 py-2`}
        >
          <i className="bi bi-ui-checks"></i>
          <span>Member Verification &amp; Update Form QR</span>
        </button>
        <button
          onClick={() => setActiveTab("member-access")}
          className={`btn ${
            activeTab === "member-access" ? "btn-jain-primary shadow-sm" : "btn-outline-secondary"
          } d-flex align-items-center gap-2 px-3 py-2`}
        >
          <i className="bi bi-shield-check"></i>
          <span>Member Access Portal QR</span>
        </button>
      </div>

      <div className="row g-4">
        {/* Left Column: Printable QR Code Flyer */}
        <div className="col-12 col-md-6 col-lg-5">
          <div
            ref={printRef}
            className="card-clean p-4 bg-white text-center border shadow-sm rounded-4"
            id="printable-qr-flyer"
          >
            {/* Header on print card */}
            <div className="mb-3">
              <div className="d-inline-flex align-items-center justify-content-center p-2 bg-light rounded-circle mb-2">
                <Logo size={44} />
              </div>
              <h4 className="fw-bold text-dark mb-0">Jin Sanskar Setu</h4>
              <h5 className="h6 text-primary mb-1">जिन संस्कार सेतु</h5>
              <div className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2 py-1 mt-1">
                {currentQr.title}
              </div>
            </div>

            {/* QR Code image */}
            <div className="p-3 bg-light rounded-3 d-inline-block border mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentQr.qrDataUrl}
                alt={`${currentQr.title} QR Code`}
                className="img-fluid"
                style={{ maxWidth: "260px", width: "100%", height: "auto" }}
              />
            </div>

            <p className="text-secondary small fw-medium mb-2">{currentQr.subtitle}</p>
            <div className="font-monospace small text-primary p-2 bg-light rounded border text-break">
              {currentQr.targetUrl}
            </div>
            <small className="text-muted d-block mt-2" style={{ fontSize: "0.75rem" }}>
              Scan with any mobile camera • No volunteer login required
            </small>
          </div>
        </div>

        {/* Right Column: Actions & Configuration Details */}
        <div className="col-12 col-md-6 col-lg-7">
          <div className="card-clean p-4 bg-white border shadow-sm rounded-4 h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <h4 className="fw-bold text-dark mb-1">{currentQr.title}</h4>
                  <p className="text-muted small mb-0">{currentQr.subtitle}</p>
                </div>
                <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                  Active
                </span>
              </div>

              <div className="d-flex flex-column gap-3 my-4">
                {/* Configured Production URL with Copy Button */}
                <div className="p-3 bg-light rounded-3 border">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="text-muted small fw-semibold">Public Destination URL:</span>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="btn btn-sm btn-outline-primary py-0 px-2 d-flex align-items-center gap-1"
                      title="Copy URL"
                    >
                      <i className={`bi ${copied ? "bi-check2" : "bi-clipboard"}`}></i>
                      <span>{copied ? "Copied!" : "Copy Link"}</span>
                    </button>
                  </div>
                  <strong className="font-monospace text-primary text-break fs-6">
                    {currentQr.targetUrl}
                  </strong>
                </div>

                {/* Security Guarantee Box */}
                <div className="p-3 bg-success-subtle rounded-3 border border-success-subtle text-success-emphasis small">
                  <i className="bi bi-shield-check me-2 fs-5 align-middle"></i>
                  <strong>Zero Credentials &amp; PII Safe:</strong> This QR code contains only the clean production endpoint URL. It does not encode personal information, phone numbers, family IDs, passwords, or temporary preview links.
                </div>

                {/* Mobile Usage Guidelines */}
                <div className="p-3 bg-body-tertiary rounded-3 border small text-muted">
                  <h6 className="fw-bold text-dark mb-1">
                    <i className="bi bi-phone me-1"></i> How Family Heads Use This Form:
                  </h6>
                  <ol className="mb-0 ps-3">
                    <li>Family head scans this QR code with their mobile phone camera.</li>
                    <li>They enter their registered 10-digit mobile number and full name.</li>
                    <li>A secure 6-digit OTP is verified before matched records are accessed.</li>
                    <li>
                      They answer 7 simple status questions (address updates, member count, corrections).
                    </li>
                    <li>
                      Submitted updates are placed in a <strong>PENDING</strong> queue for volunteer validation.
                    </li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="d-flex flex-wrap gap-2 pt-3 border-top">
              <button
                type="button"
                onClick={handleDownloadPng}
                className="btn btn-jain-primary d-flex align-items-center gap-2 px-3 py-2 shadow-sm"
              >
                <i className="bi bi-download"></i>
                <span>Download PNG Image</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadSvg}
                className="btn btn-outline-secondary d-flex align-items-center gap-2 px-3 py-2"
              >
                <i className="bi bi-file-earmark-code"></i>
                <span>Download Vector SVG</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="btn btn-outline-primary d-flex align-items-center gap-2 px-3 py-2"
              >
                <i className="bi bi-printer"></i>
                <span>Print Poster</span>
              </button>

              <a
                href={currentQr.targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline-secondary d-flex align-items-center gap-2 px-3 py-2"
              >
                <i className="bi bi-box-arrow-up-right"></i>
                <span>Open Form</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
