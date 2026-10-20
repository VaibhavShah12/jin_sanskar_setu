"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";

interface VolunteerQrCardProps {
  qrDataUrl: string;
  targetUrl: string;
}

export default function VolunteerQrCard({ qrDataUrl, targetUrl }: VolunteerQrCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("Copy Portal Form URL:", targetUrl);
    }
  };

  return (
    <div className="card-clean p-3 p-md-4 mb-4 bg-white border border-primary-subtle rounded-4 shadow-sm">
      <div className="row align-items-center g-3">
        {/* Left: QR Code Preview */}
        <div className="col-12 col-sm-auto text-center">
          <div className="d-inline-block p-2 bg-white border border-2 border-primary-subtle rounded-3 shadow-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="Jin Sanskar Setu Member Portal QR"
              width={130}
              height={130}
              className="d-block mx-auto rounded"
            />
          </div>
        </div>

        {/* Middle: Information */}
        <div className="col-12 col-sm">
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="badge bg-primary text-white fs-8 px-2 py-1">
              <i className="bi bi-qr-code me-1"></i> Volunteer Desk QR
            </span>
            <span className="text-muted small">Self-Service Access &amp; Interests</span>
          </div>
          <h2 className="h5 fw-bold text-dark mb-1">
            Member Survey &amp; Interests Form QR Code
          </h2>
          <p className="text-muted small mb-2">
            Ask community members to scan this QR code with their mobile camera to open the form. They only need to enter their registered mobile number, which sends an instant validation request to this dashboard!
          </p>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
            >
              <i className={`bi ${copied ? "bi-check2 text-success" : "bi-link-45deg"}`}></i>
              <span>{copied ? "Link Copied!" : "Copy Form Link"}</span>
            </button>
            <Link
              href="/admin/qr-code"
              className="btn btn-jain-primary btn-sm d-flex align-items-center gap-1"
            >
              <i className="bi bi-printer me-1"></i>
              <span>Print / Download Standee Poster</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
