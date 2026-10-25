"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  approveTrusteeAction,
  rejectTrusteeAction,
  getPendingTrusteesAction,
} from "@/lib/actions/user-actions";

export interface PendingTrusteeItem {
  id: string;
  username: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  sanghId: string | null;
  sanghName?: string;
  sanghPrefix?: string;
  createdAt: string;
}

interface TrusteeRequestsSectionProps {
  initialTrustees: PendingTrusteeItem[];
}

export default function TrusteeRequestsSection({
  initialTrustees,
}: TrusteeRequestsSectionProps) {
  const [trustees, setTrustees] = useState<PendingTrusteeItem[]>(initialTrustees);
  const [exportPermMap, setExportPermMap] = useState<Record<string, boolean>>({});
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Poll for newly submitted trustee registration requests every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await getPendingTrusteesAction();
        if (res.success && res.trustees) {
          setTrustees(res.trustees);
        }
      } catch {
        // Silent retry
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleApprove = async (trustee: PendingTrusteeItem) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setApprovingId(trustee.id);

    const allowExport = Boolean(exportPermMap[trustee.id]);
    const res = await approveTrusteeAction(trustee.id, allowExport);
    setApprovingId(null);

    if (!res.success) {
      setErrorMsg(res.error || "Failed to approve trustee registration.");
      return;
    }

    setTrustees((prev) => prev.filter((t) => t.id !== trustee.id));
    setSuccessMsg(
      `Trustee "${trustee.name || trustee.username}" (${trustee.sanghName || "Sangh"}) approved successfully! Their login is now active.`
    );
  };

  const handleReject = async (trustee: PendingTrusteeItem) => {
    if (
      !window.confirm(
        `Are you sure you want to reject the trustee registration request for "${trustee.name || trustee.username}"?`
      )
    ) {
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setRejectingId(trustee.id);

    const res = await rejectTrusteeAction(trustee.id);
    setRejectingId(null);

    if (!res.success) {
      setErrorMsg(res.error || "Failed to reject trustee registration.");
      return;
    }

    setTrustees((prev) => prev.filter((t) => t.id !== trustee.id));
    setSuccessMsg(
      `Trustee registration request for "${trustee.name || trustee.username}" has been rejected.`
    );
  };

  if (trustees.length === 0 && !successMsg && !errorMsg) {
    return null;
  }

  return (
    <div className="card-clean border-warning shadow-sm mb-4 bg-white overflow-hidden">
      {/* Header Banner */}
      <div className="p-3 bg-warning-subtle border-bottom border-warning-subtle d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
        <div className="d-flex align-items-center gap-2">
          <span className="badge bg-warning text-dark px-2 py-1 fs-6">
            <i className="bi bi-hourglass-split me-1"></i>
            {trustees.length} Pending
          </span>
          <h5 className="fw-bold text-dark mb-0">Trustee Registration Requests</h5>
        </div>
        <div className="d-flex align-items-center gap-2">
          <span className="text-secondary small d-none d-md-inline">
            Verification required before login access is enabled
          </span>
          <Link href="/admin/users" className="btn btn-outline-dark btn-sm py-0 px-2 small">
            <i className="bi bi-people me-1"></i> All Users
          </Link>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="alert alert-success alert-dismissible fade show m-3 mb-0 d-flex align-items-center gap-2">
          <i className="bi bi-check-circle-fill"></i>
          <span>{successMsg}</span>
          <button
            type="button"
            className="btn-close ms-auto"
            onClick={() => setSuccessMsg(null)}
          ></button>
        </div>
      )}

      {errorMsg && (
        <div className="alert alert-danger alert-dismissible fade show m-3 mb-0 d-flex align-items-center gap-2">
          <i className="bi bi-exclamation-triangle-fill"></i>
          <span>{errorMsg}</span>
          <button
            type="button"
            className="btn-close ms-auto"
            onClick={() => setErrorMsg(null)}
          ></button>
        </div>
      )}

      {trustees.length > 0 ? (
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th className="ps-3">Applicant Name &amp; Username</th>
                <th>Designated Sangh</th>
                <th>Contact Details</th>
                <th>Requested Date</th>
                <th>Allow CSV Export?</th>
                <th className="text-end pe-3">Verification Action</th>
              </tr>
            </thead>
            <tbody>
              {trustees.map((t) => {
                const isBusy = approvingId === t.id || rejectingId === t.id;
                return (
                  <tr key={t.id} className="table-warning-subtle">
                    <td className="ps-3">
                      <strong className="d-block text-dark">{t.name || t.username}</strong>
                      <span className="font-monospace small text-primary">{t.username}</span>
                    </td>
                    <td>
                      {t.sanghName ? (
                        <span className="badge-sangh font-monospace">
                          {t.sanghPrefix ? `${t.sanghPrefix} — ` : ""}
                          {t.sanghName}
                        </span>
                      ) : (
                        <span className="text-muted small">No Sangh</span>
                      )}
                    </td>
                    <td className="small">
                      {t.phone && (
                        <div className="text-dark d-flex align-items-center gap-1">
                          <i className="bi bi-telephone text-primary"></i>
                          <a href={`tel:${t.phone}`} className="text-decoration-none fw-semibold">
                            {t.phone}
                          </a>
                        </div>
                      )}
                      {t.email && (
                        <div className="text-muted d-flex align-items-center gap-1">
                          <i className="bi bi-envelope"></i>
                          <span>{t.email}</span>
                        </div>
                      )}
                      {!t.phone && !t.email && <span className="text-muted">—</span>}
                    </td>
                    <td className="small text-muted">
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "Recent"}
                    </td>
                    <td>
                      <div className="form-check form-switch mb-0">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`dash-export-pending-${t.id}`}
                          checked={Boolean(exportPermMap[t.id])}
                          onChange={(e) =>
                            setExportPermMap({
                              ...exportPermMap,
                              [t.id]: e.target.checked,
                            })
                          }
                        />
                        <label
                          className="form-check-label small"
                          htmlFor={`dash-export-pending-${t.id}`}
                        >
                          Enable Export
                        </label>
                      </div>
                    </td>
                    <td className="text-end pe-3">
                      <div className="d-flex justify-content-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleApprove(t)}
                          disabled={isBusy}
                          className="btn btn-sm btn-success d-inline-flex align-items-center gap-1 shadow-sm px-3 fw-semibold"
                          title="Verify and activate trustee login"
                        >
                          {approvingId === t.id ? (
                            <span
                              className="spinner-border spinner-border-sm"
                              role="status"
                            ></span>
                          ) : (
                            <i className="bi bi-check-circle-fill"></i>
                          )}
                          <span>Verify &amp; Approve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(t)}
                          disabled={isBusy}
                          className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1"
                          title="Reject and delete request"
                        >
                          {rejectingId === t.id ? (
                            <span
                              className="spinner-border spinner-border-sm"
                              role="status"
                            ></span>
                          ) : (
                            <i className="bi bi-trash"></i>
                          )}
                          <span>Reject</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
