"use client";

import React, { useState } from "react";
import StatusBadge from "@/components/StatusBadge";

interface AdminSyncClientProps {
  initialSyncs: any[];
  stats: {
    total: number;
    synced: number;
    pending: number;
    failed: number;
  };
  hasConfig: boolean;
}

export default function AdminSyncClient({ initialSyncs, stats: initialStats, hasConfig }: AdminSyncClientProps) {
  const [syncs, setSyncs] = useState<any[]>(initialSyncs);
  const [stats, setStats] = useState(initialStats);
  const [loading, setLoading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "danger" } | null>(null);

  const handleRetryOne = async (memberId: string) => {
    setRetryingId(memberId);
    setMessage(null);
    try {
      const res = await fetch("/api/sync/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error || "Retry failed", type: "danger" });
      } else {
        setMessage({ text: data.message, type: "success" });
        // Update local item
        setSyncs(
          syncs.map((s) =>
            s.memberId === memberId
              ? { ...s, status: data.successCount > 0 ? "SYNCED" : "FAILED", lastAttemptAt: new Date() }
              : s
          )
        );
      }
    } catch (err: any) {
      setMessage({ text: err?.message || "Retry failed", type: "danger" });
    } finally {
      setRetryingId(null);
    }
  };

  const handleRetryAllFailed = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/sync/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retryAll: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error || "Batch retry failed", type: "danger" });
      } else {
        setMessage({ text: data.message, type: "success" });
        // Reload or update stats
        setStats((prev) => ({
          ...prev,
          synced: prev.synced + data.successCount,
          failed: Math.max(0, prev.failed - data.successCount),
        }));
      }
    } catch (err: any) {
      setMessage({ text: err?.message || "Batch retry failed", type: "danger" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Configuration Status Callout */}
      {!hasConfig ? (
        <div className="alert alert-warning py-3 px-3 mb-4 shadow-sm" role="alert">
          <div className="d-flex align-items-start gap-2">
            <i className="bi bi-exclamation-triangle-fill fs-4 mt-1 text-warning"></i>
            <div>
              <h6 className="fw-bold mb-1">Google Sheets API Credentials Not Detected</h6>
              <p className="small mb-0">
                To enable live reporting synchronization, configure <code>GOOGLE_SERVICE_ACCOUNT_EMAIL</code>,{" "}
                <code>GOOGLE_PRIVATE_KEY</code>, and <code>GOOGLE_SHEET_ID</code> in your environment variables.
                PostgreSQL remains completely operational as the single source of truth.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="alert alert-success py-2 px-3 small mb-4 d-flex align-items-center gap-2">
          <i className="bi bi-check-circle-fill text-success"></i>
          <span>Google Sheets API credentials detected and ready for synchronization.</span>
        </div>
      )}

      {message && (
        <div className={`alert alert-${message.type} py-2 px-3 small mb-3`} role="alert">
          {message.text}
        </div>
      )}

      {/* KPI Cards */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="card-clean p-3">
            <span className="text-muted small fw-semibold text-uppercase d-block mb-1">Total Tracked</span>
            <div className="fs-3 fw-bold text-dark">{stats.total}</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card-clean p-3 border-success-subtle">
            <span className="text-muted small fw-semibold text-uppercase d-block mb-1">Synchronized</span>
            <div className="fs-3 fw-bold text-success">{stats.synced}</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card-clean p-3 border-warning-subtle">
            <span className="text-muted small fw-semibold text-uppercase d-block mb-1">Pending</span>
            <div className="fs-3 fw-bold text-warning">{stats.pending}</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card-clean p-3 border-danger-subtle">
            <span className="text-muted small fw-semibold text-uppercase d-block mb-1">Failed</span>
            <div className="fs-3 fw-bold text-danger">{stats.failed}</div>
          </div>
        </div>
      </div>

      {/* Header and Batch Action */}
      <div className="card-clean p-4 mb-4 bg-white">
        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3 mb-3 pb-3 border-bottom">
          <div>
            <h5 className="fw-bold text-dark mb-1">Member Sync Ledger (Single Google Sheet)</h5>
            <small className="text-muted">
              PostgreSQL is the source of truth • 17 standard columns per member row
            </small>
          </div>
          {stats.failed > 0 && (
            <button
              onClick={handleRetryAllFailed}
              disabled={loading}
              className="btn btn-outline-danger btn-sm px-3"
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1"></span> Retrying...
                </>
              ) : (
                <>
                  <i className="bi bi-arrow-repeat me-1"></i> Retry All Failed ({stats.failed})
                </>
              )}
            </button>
          )}
        </div>

        {/* Sync Table */}
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 small">
            <thead className="table-light">
              <tr>
                <th className="ps-3">Member ID</th>
                <th>Member Name</th>
                <th>Status</th>
                <th>Sheet Range</th>
                <th>Retries</th>
                <th>Last Attempt</th>
                <th className="text-end pe-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {syncs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-4 text-muted">
                    No sync records registered yet.
                  </td>
                </tr>
              ) : (
                syncs.map((s) => (
                  <tr key={s.id}>
                    <td className="ps-3 font-monospace fw-bold text-primary">{s.memberId}</td>
                    <td className="fw-semibold text-dark">{s.member?.name || "Member"}</td>
                    <td>
                      <StatusBadge type="sync" value={s.status} />
                    </td>
                    <td className="font-monospace text-muted">{s.sheetRowReference || "—"}</td>
                    <td>
                      <span className="badge bg-light text-dark border">{s.retryCount}</span>
                    </td>
                    <td className="text-muted">
                      {s.lastAttemptAt ? new Date(s.lastAttemptAt).toLocaleString() : "—"}
                    </td>
                    <td className="text-end pe-3">
                      <button
                        onClick={() => handleRetryOne(s.memberId)}
                        disabled={retryingId === s.memberId}
                        className="btn btn-outline-secondary btn-sm py-0 px-2"
                        title="Retry sync for this row"
                      >
                        {retryingId === s.memberId ? (
                          <span className="spinner-border spinner-border-sm"></span>
                        ) : (
                          <i className="bi bi-arrow-repeat"></i>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
