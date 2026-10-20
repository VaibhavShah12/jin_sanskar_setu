"use client";

import React, { useState, useEffect } from "react";
import {
  approveAccessRequestAction,
  rejectAccessRequestAction,
  getPendingAccessRequestsAction,
} from "@/lib/actions/member-access-actions";

export interface AccessRequestItem {
  id: string;
  requestId: string;
  maskedMobile: string;
  familyId: string;
  headName: string;
  area: string;
  sanghName: string;
  sanghPrefix: string;
  status: string;
  createdAt: Date | string;
}

interface MemberAccessRequestsSectionProps {
  initialRequests: AccessRequestItem[];
  canManage: boolean; // false for Trustees
}

export default function MemberAccessRequestsSection({
  initialRequests,
  canManage,
}: MemberAccessRequestsSectionProps) {
  const [requests, setRequests] = useState<AccessRequestItem[]>(initialRequests);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [hasNewAlert, setHasNewAlert] = useState(false);

  // Live polling for new requests every 4 seconds so volunteers get instant notifications
  useEffect(() => {
    if (!canManage) return;

    const interval = setInterval(async () => {
      try {
        const res = await getPendingAccessRequestsAction();
        if (res.success && res.requests) {
          setRequests((prev) => {
            const currentIds = new Set(prev.map((r) => r.id));
            const newIncoming = res.requests.filter((r: any) => !currentIds.has(r.id));
            if (newIncoming.length > 0) {
              setHasNewAlert(true);
            }
            return res.requests.map((r: any) => ({
              ...r,
              createdAt: r.createdAt,
            }));
          });
        }
      } catch {
        // Silent network retry
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [canManage]);

  const handleApprove = async (id: string, headName: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setProcessingId(id);

    try {
      const res = await approveAccessRequestAction(id);
      if (res.success) {
        setSuccessMsg(res.message || `Validated and allowed ${headName} to proceed!`);
        setRequests((prev) => prev.filter((r) => r.id !== id));
      } else {
        setErrorMsg(res.error || "Failed to approve request.");
        if (res.error?.includes("already been handled")) {
          setRequests((prev) => prev.filter((r) => r.id !== id));
        }
      }
    } catch {
      setErrorMsg("A server error occurred while approving request.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt("Reason for rejection (optional):", "Information could not be verified");
    if (reason === null) return; // User cancelled prompt

    setErrorMsg(null);
    setSuccessMsg(null);
    setProcessingId(id);

    try {
      const res = await rejectAccessRequestAction(id, reason);
      if (res.success) {
        setSuccessMsg(res.message || "Request rejected.");
        setRequests((prev) => prev.filter((r) => r.id !== id));
      } else {
        setErrorMsg(res.error || "Failed to reject request.");
        if (res.error?.includes("already been handled")) {
          setRequests((prev) => prev.filter((r) => r.id !== id));
        }
      }
    } catch {
      setErrorMsg("A server error occurred while rejecting request.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="card-clean p-3 p-md-4 mb-4 bg-white border border-primary-subtle rounded-4 shadow-sm">
      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2 mb-3 pb-2 border-bottom">
        <div>
          <div className="d-flex align-items-center gap-2">
            <h2 className="h5 fw-bold text-dark mb-0 d-flex align-items-center gap-2">
              <i className="bi bi-person-check-fill text-primary"></i>
              <span>Live Member Form Access Requests</span>
            </h2>
            <span className={`badge ${requests.length > 0 ? "bg-warning text-dark animate-pulse" : "bg-light text-muted border"} font-monospace rounded-pill`}>
              {requests.length} Pending
            </span>
            <span className="badge bg-success-subtle text-success border border-success-subtle small">
              <i className="bi bi-broadcast me-1"></i> Live Auto-Sync
            </span>
          </div>
          <p className="text-muted small mb-0 mt-1">
            When a family member opens the portal and enters their registered mobile number, their request appears here in real-time. Validate and allow them to proceed without OTP!
          </p>
        </div>
      </div>

      {hasNewAlert && (
        <div className="alert alert-warning py-2 px-3 small mb-3 d-flex align-items-center justify-content-between gap-2 shadow-xs border-warning">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-bell-fill text-warning-emphasis fs-5 animate-bounce"></i>
            <strong>New member form access request received! Validate below to let them proceed.</strong>
          </div>
          <button
            type="button"
            className="btn-close btn-sm"
            onClick={() => setHasNewAlert(false)}
          ></button>
        </div>
      )}

      {errorMsg && (
        <div className="alert alert-danger alert-dismissible fade show small mb-3 py-2" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {errorMsg}
          <button type="button" className="btn-close py-2" onClick={() => setErrorMsg(null)}></button>
        </div>
      )}

      {successMsg && (
        <div className="alert alert-success alert-dismissible fade show small mb-3 py-2" role="alert">
          <i className="bi bi-check-circle-fill me-2"></i>
          {successMsg}
          <button type="button" className="btn-close py-2" onClick={() => setSuccessMsg(null)}></button>
        </div>
      )}

      {requests.length === 0 ? (
        <div className="text-center py-4 text-muted small bg-light rounded-3 border border-dashed">
          <i className="bi bi-check2-circle fs-3 d-block text-success mb-1"></i>
          No pending member access requests at this time. Incoming requests from the portal form will appear here automatically.
        </div>
      ) : (
        <div className="d-flex flex-column gap-2">
          {requests.map((r) => (
            <div
              key={r.id}
              className="p-3 border rounded-3 bg-light d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 border-start border-4 border-warning shadow-xs"
            >
              <div>
                <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                  <span className="badge bg-primary-subtle text-primary font-monospace fw-bold fs-7">
                    <i className="bi bi-telephone-fill me-1"></i>
                    {r.maskedMobile}
                  </span>
                  <span className="badge-sangh font-monospace small">
                    {r.sanghPrefix} • {r.sanghName}
                  </span>
                  <span className="text-muted small font-monospace">
                    Family: <strong className="text-dark">{r.familyId}</strong> (Head: {r.headName})
                  </span>
                </div>
                <div className="text-muted small">
                  <span>Area: {r.area || "Registered Area"}</span> •{" "}
                  <span>Requested: {new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                </div>
              </div>

              {canManage && (
                <div className="d-flex align-items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    disabled={processingId === r.id}
                    onClick={() => handleApprove(r.id, r.headName)}
                    className="btn btn-success btn-sm d-flex align-items-center gap-1 px-3 shadow-sm fw-semibold"
                    title="Validate & Allow member to proceed to interests form"
                  >
                    {processingId === r.id ? (
                      <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                    ) : (
                      <i className="bi bi-check-circle-fill me-1"></i>
                    )}
                    <span>Validate &amp; Allow</span>
                  </button>

                  <button
                    type="button"
                    disabled={processingId === r.id}
                    onClick={() => handleReject(r.id)}
                    className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1 px-2"
                    title="Reject access request"
                  >
                    <i className="bi bi-x-lg"></i>
                    <span>Reject</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
