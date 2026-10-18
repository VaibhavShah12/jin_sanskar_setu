import React from "react";

export default function Footer() {
  return (
    <footer className="bg-white border-top py-4 text-center mt-auto">
      <div className="container">
        <div className="d-flex justify-content-center align-items-center gap-2 mb-2">
          <span className="fs-5">🪷</span>
          <span className="fw-bold brand-title">Jin Sanskar Setu</span>
          <span className="text-muted">•</span>
          <span className="brand-hindi">जिन संस्कार सेतु</span>
        </div>
        <p className="text-secondary small mb-1 fw-medium">
          Connecting Families • Strengthening Sangh • Nurturing Sanskars
        </p>
        <p className="text-muted fs-8 mb-0">
          Sangh Community Survey & Management Initiative • Powered by PostgreSQL
        </p>
      </div>
    </footer>
  );
}
