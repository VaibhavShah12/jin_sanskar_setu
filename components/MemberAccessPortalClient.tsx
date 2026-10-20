"use client";

import React, { useState, useEffect } from "react";
import Logo from "@/components/Logo";
import StatusBadge from "@/components/StatusBadge";
import {
  requestMemberAccessAction,
  checkMemberAccessStatusAction,
  getApprovedFamilyDataAction,
} from "@/lib/actions/member-access-actions";

type PortalState = "INPUT" | "PENDING" | "APPROVED" | "REJECTED";

export default function MemberAccessPortalClient() {
  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [portalState, setPortalState] = useState<PortalState>("INPUT");
  const [requestToken, setRequestToken] = useState<string | null>(null);
  const [grantToken, setGrantToken] = useState<string | null>(null);
  const [familyData, setFamilyData] = useState<any>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [rejectionReason, setRejectionReason] = useState<string>("");

  // Restore session from localStorage if present
  useEffect(() => {
    const savedToken = localStorage.getItem("jss_member_request_token");
    const savedGrant = localStorage.getItem("jss_member_grant_token");

    if (savedGrant) {
      setGrantToken(savedGrant);
      loadFamilyProfile(savedGrant);
    } else if (savedToken) {
      setRequestToken(savedToken);
      checkStatus(savedToken);
    }
  }, []);

  // Poll for approval status while PENDING
  useEffect(() => {
    if (portalState !== "PENDING" || !requestToken) return;

    const interval = setInterval(() => {
      checkStatus(requestToken);
    }, 6000);

    return () => clearInterval(interval);
  }, [portalState, requestToken]);

  const loadFamilyProfile = async (grant: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await getApprovedFamilyDataAction(grant);
      if (res.success && res.data) {
        setFamilyData(res.data);
        setPortalState("APPROVED");
      } else {
        localStorage.removeItem("jss_member_grant_token");
        setGrantToken(null);
        setPortalState("INPUT");
        setErrorMsg(res.error || "Session expired. Please request access again.");
      }
    } catch {
      setErrorMsg("Failed to load family information. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async (token: string) => {
    try {
      const res = await checkMemberAccessStatusAction(token);
      if (res.status === "APPROVED" && res.grantToken) {
        setGrantToken(res.grantToken);
        localStorage.setItem("jss_member_grant_token", res.grantToken);
        localStorage.removeItem("jss_member_request_token");
        loadFamilyProfile(res.grantToken);
      } else if (res.status === "REJECTED") {
        setPortalState("REJECTED");
        setRejectionReason(res.message || "Your request could not be validated.");
        localStorage.removeItem("jss_member_request_token");
      } else if (res.status === "EXPIRED" || res.status === "NOT_FOUND") {
        setPortalState("INPUT");
        setErrorMsg(res.message || "Access request expired.");
        localStorage.removeItem("jss_member_request_token");
      } else if (res.status === "PENDING") {
        setPortalState("PENDING");
        setStatusMessage(res.message || "Awaiting volunteer validation.");
      }
    } catch {
      // Keep state on network glitch
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await requestMemberAccessAction(mobile);
      if (!res.success) {
        setErrorMsg(res.message);
      } else if (res.requestToken) {
        setRequestToken(res.requestToken);
        localStorage.setItem("jss_member_request_token", res.requestToken);
        setPortalState("PENDING");
        setStatusMessage(res.message);
        // Immediate status check in case already approved
        checkStatus(res.requestToken);
      } else {
        // Generic response
        setStatusMessage(res.message);
        setPortalState("PENDING");
      }
    } catch {
      setErrorMsg("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    localStorage.removeItem("jss_member_request_token");
    localStorage.removeItem("jss_member_grant_token");
    setRequestToken(null);
    setGrantToken(null);
    setFamilyData(null);
    setMobile("");
    setErrorMsg(null);
    setPortalState("INPUT");
  };

  return (
    <div className="min-vh-100 bg-light py-4 px-3 d-flex flex-column justify-content-between">
      <div className="container" style={{ maxWidth: "780px" }}>
        {/* Brand Header */}
        <div className="text-center mb-4">
          <div className="d-inline-flex align-items-center justify-content-center p-3 bg-white rounded-circle shadow-sm mb-3">
            <Logo size={48} />
          </div>
          <h1 className="h3 fw-bold text-dark mb-1">Jin Sanskar Setu</h1>
          <h2 className="h5 text-primary mb-2">जिन संस्कार सेतु</h2>
          <p className="text-muted small mx-auto mb-0" style={{ maxWidth: "480px" }}>
            Connecting Families • Strengthening Sangh • Nurturing Sanskars
          </p>
        </div>

        {/* ===================================================================
            VIEW 1: INITIAL MOBILE REQUEST FORM
            =================================================================== */}
        {portalState === "INPUT" && (
          <div className="card-clean p-4 p-md-5 bg-white shadow-sm border rounded-4">
            <div className="text-center mb-4">
              <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-1 mb-2">
                Member Self-Service Portal
              </span>
              <h3 className="h5 fw-bold text-dark mb-2">View Your Family Records</h3>
              <p className="text-muted small mb-0">
                Registered family members can request secure access to view their recorded census data.
                Enter the primary mobile number registered during the volunteer survey.
              </p>
            </div>

            {errorMsg && (
              <div className="alert alert-danger d-flex align-items-center gap-2 small mb-4" role="alert">
                <i className="bi bi-exclamation-triangle-fill fs-5"></i>
                <div>{errorMsg}</div>
              </div>
            )}

            <form onSubmit={handleSubmitRequest}>
              <div className="mb-4">
                <label htmlFor="member-mobile-input" className="form-label fw-semibold text-dark">
                  Registered Mobile Number <span className="text-danger">*</span>
                </label>
                <div className="input-group input-group-lg">
                  <span className="input-group-text bg-light text-muted border-end-0">
                    <i className="bi bi-phone"></i>
                  </span>
                  <input
                    id="member-mobile-input"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    className="form-control border-start-0"
                    placeholder="Enter 10-digit mobile number"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
                    required
                  />
                </div>
                <div className="form-text small text-muted mt-2">
                  <i className="bi bi-shield-check text-success me-1"></i>
                  Your request is securely verified by your Sangh volunteers before access is granted.
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || mobile.length < 10}
                className="btn btn-jain-primary w-100 py-3 fw-bold fs-6 shadow-sm d-flex align-items-center justify-content-center gap-2"
                id="submit-member-access-btn"
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    <span>Submitting Request...</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-arrow-right-circle-fill"></i>
                    <span>Request Family Access</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-4 pt-3 border-top text-center text-muted small">
              Are you a survey volunteer or administrator?{" "}
              <a href="/login" className="text-primary text-decoration-none fw-semibold">
                Log in here
              </a>
            </div>
          </div>
        )}

        {/* ===================================================================
            VIEW 2: SUBMITTED / PENDING VOLUNTEER VALIDATION
            =================================================================== */}
        {portalState === "PENDING" && (
          <div className="card-clean p-4 p-md-5 bg-white shadow-sm border rounded-4 text-center">
            <div className="mb-3">
              <div
                className="spinner-grow text-warning mb-3"
                style={{ width: "3rem", height: "3rem" }}
                role="status"
              >
                <span className="visually-hidden">Validating...</span>
              </div>
              <h3 className="h5 fw-bold text-dark mb-2">Request Awaiting Volunteer Validation</h3>
              <p className="text-muted small mb-4">{statusMessage}</p>
            </div>

            <div className="p-3 bg-amber-50 rounded-3 border border-warning-subtle text-start small mb-4" style={{ backgroundColor: "#fffbeb" }}>
              <div className="d-flex align-items-start gap-2">
                <i className="bi bi-info-circle-fill text-warning fs-5"></i>
                <div>
                  <strong className="text-dark d-block mb-1">How verification works:</strong>
                  <span className="text-secondary">
                    To safeguard personal family records, a volunteer from your Sangh reviews each request to confirm your identity. Once approved, this page will automatically refresh with your family details.
                  </span>
                </div>
              </div>
            </div>

            <div className="d-flex flex-column flex-sm-row justify-content-center gap-2">
              <button
                type="button"
                onClick={() => requestToken && checkStatus(requestToken)}
                className="btn btn-outline-primary d-flex align-items-center justify-content-center gap-2 px-4 py-2"
              >
                <i className="bi bi-arrow-clockwise"></i>
                <span>Check Approval Status</span>
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="btn btn-outline-secondary px-3 py-2"
              >
                Cancel / Try Another Number
              </button>
            </div>
          </div>
        )}

        {/* ===================================================================
            VIEW 3: REJECTED
            =================================================================== */}
        {portalState === "REJECTED" && (
          <div className="card-clean p-4 p-md-5 bg-white shadow-sm border rounded-4 text-center">
            <div className="rounded-circle p-3 bg-danger-subtle text-danger d-inline-block fs-1 mb-3">
              <i className="bi bi-x-circle-fill"></i>
            </div>
            <h3 className="h5 fw-bold text-dark mb-2">Access Request Not Approved</h3>
            <p className="text-muted small mb-4">{rejectionReason}</p>

            <button
              type="button"
              onClick={handleReset}
              className="btn btn-jain-primary px-4 py-2 fw-semibold"
            >
              Back to Access Page
            </button>
          </div>
        )}

        {/* ===================================================================
            VIEW 4: APPROVED FAMILY PROFILE & QUESTIONNAIRE FRAMEWORK
            =================================================================== */}
        {portalState === "APPROVED" && familyData && (
          <div className="d-flex flex-column gap-4">
            {/* Success Banner & Session Controls */}
            <div className="alert alert-success d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2 p-3 shadow-sm mb-0">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-check-circle-fill fs-4 text-success"></i>
                <div>
                  <strong className="d-block text-dark">Verified Access Granted</strong>
                  <small className="text-muted">Viewing registered family records (Read-Only)</small>
                </div>
              </div>
              <button
                onClick={handleReset}
                className="btn btn-outline-secondary btn-sm text-nowrap align-self-sm-center"
              >
                <i className="bi bi-box-arrow-right me-1"></i> Exit Session
              </button>
            </div>

            {/* Family Card */}
            <div className="card-clean p-4 bg-white shadow-sm border rounded-4">
              <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-start gap-2 pb-3 mb-3 border-bottom">
                <div>
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <span className="badge bg-primary fs-6 font-monospace px-3 py-1">
                      {familyData.familyId}
                    </span>
                    <span className="badge-sangh font-monospace fs-6">
                      {familyData.sangh.prefix}
                    </span>
                  </div>
                  <h2 className="h4 fw-bold text-dark mb-0">{familyData.headName}&apos;s Family</h2>
                  <small className="text-muted">{familyData.sangh.name}</small>
                </div>
                <div className="text-sm-end text-muted small">
                  <span className="d-block">Primary Contact: <strong>{familyData.mobile}</strong></span>
                  <span className="d-block">{familyData.area}</span>
                </div>
              </div>

              <div className="row g-2 small text-secondary">
                <div className="col-12">
                  <i className="bi bi-geo-alt-fill text-primary me-1"></i>
                  <strong>Address:</strong> {familyData.address}
                </div>
              </div>
            </div>

            {/* Members Roster */}
            <div className="card-clean p-4 bg-white shadow-sm border rounded-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h3 className="h5 fw-bold text-dark mb-0">
                  Registered Family Members ({familyData.members.length})
                </h3>
              </div>

              {/* Desktop Table */}
              <div className="table-responsive d-none d-md-block">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light small">
                    <tr>
                      <th>Member ID</th>
                      <th>Name</th>
                      <th>Relationship</th>
                      <th>Date of Birth</th>
                      <th>Age</th>
                      <th>Gender</th>
                      <th>Pathshala</th>
                    </tr>
                  </thead>
                  <tbody>
                    {familyData.members.map((m: any) => (
                      <tr key={m.memberId}>
                        <td className="font-monospace fw-bold text-primary">{m.memberId}</td>
                        <td className="fw-semibold text-dark">{m.name}</td>
                        <td>
                          <span className="badge bg-light text-secondary border font-monospace">
                            {m.relationship}
                          </span>
                        </td>
                        <td>
                          {m.dateOfBirth ? (
                            <span className="font-monospace text-dark">{m.dateOfBirth}</span>
                          ) : (
                            <span className="text-muted small fst-italic">Not recorded</span>
                          )}
                        </td>
                        <td>
                          <strong className="text-dark">{m.calculatedAge}</strong> yrs
                        </td>
                        <td className="text-capitalize">{m.gender.toLowerCase().replace(/_/g, " ")}</td>
                        <td>
                          <StatusBadge type="pathshala" value={m.pathshalaStatus} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="d-md-none d-flex flex-column gap-2">
                {familyData.members.map((m: any) => (
                  <div key={m.memberId} className="p-3 border rounded-3 bg-light">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <strong className="d-block text-dark">{m.name}</strong>
                        <span className="badge bg-secondary-subtle text-secondary small me-1">
                          {m.relationship}
                        </span>
                        <span className="badge bg-primary-subtle text-primary font-monospace small">
                          {m.memberId}
                        </span>
                      </div>
                      <StatusBadge type="pathshala" value={m.pathshalaStatus} />
                    </div>
                    <div className="d-flex justify-content-between text-muted small pt-2 border-top">
                      <span>Age: <strong className="text-dark">{m.calculatedAge} yrs</strong></span>
                      <span>DOB: {m.dateOfBirth ? <strong className="text-dark font-monospace">{m.dateOfBirth}</strong> : <span className="fst-italic">—</span>}</span>
                      <span className="text-capitalize">{m.gender.toLowerCase().replace(/_/g, " ")}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ===================================================================
                QUESTIONNAIRE FRAMEWORK SECTION (Section 8)
                Clean reusable framework structure ready for future questions.
                =================================================================== */}
            <div className="card-clean p-4 p-md-5 bg-white shadow-sm border rounded-4 mb-4">
              <div className="d-flex align-items-center gap-3 mb-3 pb-3 border-bottom">
                <div className="rounded-circle p-3 bg-primary-subtle text-primary fs-3">
                  <i className="bi bi-card-checklist"></i>
                </div>
                <div>
                  <h3 className="h5 fw-bold text-dark mb-1">
                    Sanskar &amp; Community Questionnaire
                  </h3>
                  <p className="text-muted small mb-0">
                    जिन संस्कार सेतु — Family Feedback and Community Participation
                  </p>
                </div>
              </div>

              <p className="text-secondary small mb-4">
                Thank you for verifying your family records. This questionnaire section is prepared to collect valuable community insights, religious study preferences, and cultural feedback for your Sangh.
              </p>

              {/* Simple placeholder framework message as strictly required */}
              <div className="p-4 rounded-3 border border-dashed text-center bg-light">
                <i className="bi bi-clock-history text-muted display-6 d-block mb-2"></i>
                <h5 className="fw-semibold text-dark mb-1">The questionnaire will be available soon.</h5>
                <p className="text-muted small mb-0">
                  Questions are currently being formulated by Sangh leadership and will be published here. Please check back later.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="text-center text-muted small py-3 mt-4">
        Jin Sanskar Setu © {new Date().getFullYear()} • All Rights Reserved
      </footer>
    </div>
  );
}
