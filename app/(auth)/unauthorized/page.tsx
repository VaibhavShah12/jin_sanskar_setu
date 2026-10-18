import Link from "next/link";
import React from "react";

export default function UnauthorizedPage() {
  return (
    <div className="container py-5 d-flex align-items-center justify-content-center" style={{ minHeight: "75vh" }}>
      <div className="col-12 col-sm-10 col-md-8 col-lg-6 col-xl-5">
        <div className="card-clean border-danger-subtle p-4 p-sm-5 text-center shadow-elevated">
          <div className="mb-3">
            <span className="display-4 text-danger">
              <i className="bi bi-shield-x"></i>
            </span>
          </div>

          <h1 className="h4 fw-bold text-dark mb-2">Access Denied</h1>
          <p className="brand-hindi text-muted mb-4">प्रवेश अस्वीकृत</p>

          <div className="alert alert-danger py-3 px-3 mb-4 text-start" role="alert">
            <p className="mb-0 fw-medium">
              Your account is not authorized to access Jin Sanskar Setu. Please contact the administrator.
            </p>
          </div>

          <div className="card bg-light border-0 p-3 text-start small text-secondary mb-4">
            <h6 className="fw-bold text-dark mb-2">Why am I seeing this?</h6>
            <ul className="mb-0 ps-3">
              <li className="mb-1">
                Jin Sanskar Setu is a private initiative for authorized Sangh community volunteers.
              </li>
              <li className="mb-1">
                Your email address has not yet been registered or has been marked as disabled by an administrator.
              </li>
              <li>
                To request access, please contact your local Sangh survey coordinator or system administrator.
              </li>
            </ul>
          </div>

          <div className="d-flex flex-column flex-sm-row gap-2 justify-content-center">
            <Link href="/login" className="btn btn-jain-primary px-4">
              <i className="bi bi-arrow-left me-2"></i> Return to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
