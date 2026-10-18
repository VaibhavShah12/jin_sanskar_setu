import { requireAdmin } from "@/lib/auth/auth-helpers";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import React from "react";

export const dynamic = "force-dynamic";

interface AuditLogsPageProps {
  searchParams: {
    page?: string;
    action?: string;
    entityType?: string;
    performedBy?: string;
  };
}

export default async function AuditLogsPage({ searchParams }: AuditLogsPageProps) {
  await requireAdmin();

  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const pageSize = 25;

  const action = searchParams.action || undefined;
  const entityType = searchParams.entityType || undefined;
  const performedBy = searchParams.performedBy?.trim() || undefined;

  const whereClause: any = {};
  if (action) whereClause.action = action;
  if (entityType) whereClause.entityType = entityType;
  if (performedBy) {
    whereClause.performedBy = { contains: performedBy, mode: "insensitive" };
  }

  const [logs, totalCount] = await Promise.all([
    prisma.auditLog.findMany({
      where: whereClause,
      orderBy: { performedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where: whereClause }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="container py-2 py-md-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h1 className="h3 fw-bold text-dark mb-1">System Audit Logs</h1>
          <p className="text-muted small mb-0">
            Immutable operational event ledger • Total tracked events: {totalCount}
          </p>
        </div>
      </div>

      {/* Filter Form */}
      <div className="card-clean p-3 mb-4 bg-white">
        <form method="GET" action="/admin/audit-logs" className="row g-2 align-items-center">
          <div className="col-12 col-sm-4 col-md-3">
            <select name="action" defaultValue={action || ""} className="form-select form-select-sm">
              <option value="">All Actions</option>
              <option value="FAMILY_CREATED">Family Created</option>
              <option value="FAMILY_ARCHIVED">Family Archived</option>
              <option value="USER_ADDED">User Added</option>
              <option value="USER_DISABLED">User Disabled</option>
              <option value="USER_ENABLED">User Enabled</option>
              <option value="CSV_EXPORTED">CSV Exported</option>
              <option value="GOOGLE_SHEET_SYNC_FAILED">Sync Failed</option>
              <option value="GOOGLE_SHEET_SYNC_RETRIED">Sync Retried</option>
              <option value="DATABASE_SEEDED">Database Seeded</option>
            </select>
          </div>

          <div className="col-6 col-sm-4 col-md-3">
            <select name="entityType" defaultValue={entityType || ""} className="form-select form-select-sm">
              <option value="">All Entity Types</option>
              <option value="Family">Family</option>
              <option value="Member">Member</option>
              <option value="User">User</option>
              <option value="Sync">Sync</option>
              <option value="Export">Export</option>
              <option value="System">System</option>
            </select>
          </div>

          <div className="col-6 col-sm-4 col-md-4">
            <input
              type="text"
              name="performedBy"
              defaultValue={performedBy || ""}
              placeholder="Filter by user email..."
              className="form-control form-control-sm"
            />
          </div>

          <div className="col-12 col-md-2 d-flex gap-2">
            <button type="submit" className="btn btn-primary btn-sm w-100">
              Filter
            </button>
            {action || entityType || performedBy ? (
              <Link href="/admin/audit-logs" className="btn btn-outline-secondary btn-sm">
                Reset
              </Link>
            ) : null}
          </div>
        </form>
      </div>

      {/* Logs Table */}
      {logs.length === 0 ? (
        <div className="card-clean text-center py-5">
          <i className="bi bi-clock-history text-muted display-4 d-block mb-3"></i>
          <h5 className="fw-bold text-dark mb-1">No audit events match filters</h5>
          <p className="text-muted small mb-0">System events will appear here as actions are performed.</p>
        </div>
      ) : (
        <div className="card-clean p-0 overflow-hidden shadow-sm mb-4">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 small">
              <thead className="table-light">
                <tr>
                  <th className="ps-3">Timestamp</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Entity ID</th>
                  <th>Performed By</th>
                  <th className="pe-3">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="ps-3 text-nowrap text-secondary">
                      {new Date(log.performedAt).toLocaleString()}
                    </td>
                    <td>
                      <span className="badge bg-secondary-subtle text-secondary font-monospace">
                        {log.action}
                      </span>
                    </td>
                    <td>
                      <span className="badge bg-light text-dark border">{log.entityType}</span>
                    </td>
                    <td className="font-monospace text-primary">{log.entityId}</td>
                    <td className="text-dark fw-medium">{log.performedBy}</td>
                    <td className="pe-3 font-monospace text-muted" style={{ maxWidth: 300 }}>
                      <div className="text-truncate">
                        {log.metadata ? JSON.stringify(log.metadata) : "—"}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="d-flex justify-content-between align-items-center mt-3">
          <span className="text-muted small">
            Page {page} of {totalPages} ({totalCount} total entries)
          </span>
          <div className="btn-group">
            {page > 1 ? (
              <Link
                href={`/admin/audit-logs?page=${page - 1}&action=${action || ""}&entityType=${entityType || ""}&performedBy=${performedBy || ""}`}
                className="btn btn-outline-secondary btn-sm"
              >
                Previous
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link
                href={`/admin/audit-logs?page=${page + 1}&action=${action || ""}&entityType=${entityType || ""}&performedBy=${performedBy || ""}`}
                className="btn btn-outline-secondary btn-sm"
              >
                Next
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
