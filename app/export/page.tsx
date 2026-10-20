import { requireAuth, getSanghAccessFilter } from "@/lib/auth/auth-helpers";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import React from "react";

export const dynamic = "force-dynamic";

export default async function ExportPage() {
  const user = await requireAuth();

  if (user.role === "TRUSTEE" && !user.canExport) {
    return (
      <div className="container py-5 text-center">
        <div className="card-clean p-5 max-w-lg mx-auto shadow-sm">
          <i className="bi bi-shield-lock text-warning display-4 d-block mb-3"></i>
          <h4 className="fw-bold text-dark mb-2">Export Permission Restricted</h4>
          <p className="text-muted mb-4">
            CSV data export permissions for your Trustee account are currently disabled. Please contact your system administrator to enable export privileges for your assigned Sangh.
          </p>
          <Link href="/dashboard" className="btn btn-outline-secondary">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const sanghFilter = getSanghAccessFilter(user);

  const [totalFamilies, totalMembers, totalPotential, sanghs] = await Promise.all([
    prisma.family.count({ where: { status: "ACTIVE", ...sanghFilter } }),
    prisma.member.count({ where: { status: "ACTIVE", ...sanghFilter } }),
    prisma.member.count({ where: { status: "ACTIVE", age: { lt: 18 }, pathshalaStatus: "NO", ...sanghFilter } }),
    prisma.sangh.findMany({
      where: {
        active: true,
        ...(user.role === "TRUSTEE" && user.sanghId ? { id: user.sanghId } : {}),
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="container py-2 py-md-4">
      {/* Header */}
      <div className="mb-4">
        <h1 className="h3 fw-bold text-dark mb-1">CSV Data Export Center</h1>
        <p className="text-muted small mb-0">
          Download certified comma-separated value (CSV) reports. All exports are dynamically generated server-side and recorded in the audit log.
        </p>
      </div>

      <div className="row g-4">
        {/* Export 1: All Members */}
        <div className="col-12 col-md-4">
          <div className="card-clean p-4 h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="badge bg-primary-subtle text-primary fs-5 p-2 rounded-3">
                  <i className="bi bi-people-fill"></i>
                </span>
                <span className="badge bg-light text-secondary border font-monospace">
                  {totalMembers} Records
                </span>
              </div>
              <h5 className="fw-bold text-dark mb-2">Members Master Dataset</h5>
              <p className="text-muted small mb-4">
                Complete roster of all surveyed individuals with 17 standard attributes: Member ID, Family ID, demographics, contact, address, and Pathshala schedule.
              </p>
            </div>
            <a
              href="/api/export/csv?type=members"
              className="btn btn-jain-primary w-100 py-2 d-flex align-items-center justify-content-center gap-2"
              download
            >
              <i className="bi bi-download"></i>
              <span>Download Members CSV</span>
            </a>
          </div>
        </div>

        {/* Export 2: Pathshala Potential */}
        <div className="col-12 col-md-4">
          <div className="card-clean p-4 h-100 d-flex flex-column justify-content-between border-warning">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="badge bg-warning-subtle text-warning-emphasis fs-5 p-2 rounded-3">
                  <i className="bi bi-mortarboard-fill"></i>
                </span>
                <span className="badge bg-warning text-dark font-monospace">
                  {totalPotential} Children
                </span>
              </div>
              <h5 className="fw-bold text-dark mb-2">Pathshala Potential Report</h5>
              <p className="text-muted small mb-4">
                Prioritized outreach report of children under 18 years old who are currently not attending Pathshala (Status: NO). Includes schedule and conveyance preferences.
              </p>
            </div>
            <a
              href="/api/export/csv?type=pathshala_potential"
              className="btn btn-warning text-dark fw-bold w-100 py-2 d-flex align-items-center justify-content-center gap-2"
              download
            >
              <i className="bi bi-download"></i>
              <span>Download Potential CSV</span>
            </a>
          </div>
        </div>

        {/* Export 3: Families Roster */}
        <div className="col-12 col-md-4">
          <div className="card-clean p-4 h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="badge bg-success-subtle text-success fs-5 p-2 rounded-3">
                  <i className="bi bi-house-door-fill"></i>
                </span>
                <span className="badge bg-light text-secondary border font-monospace">
                  {totalFamilies} Households
                </span>
              </div>
              <h5 className="fw-bold text-dark mb-2">Families Roster</h5>
              <p className="text-muted small mb-4">
                Household-level registry containing Family ID, Head of Family name, primary mobile number, residential address, area, and total member counts.
              </p>
            </div>
            <a
              href="/api/export/csv?type=families"
              className="btn btn-jain-outline w-100 py-2 d-flex align-items-center justify-content-center gap-2"
              download
            >
              <i className="bi bi-download"></i>
              <span>Download Families CSV</span>
            </a>
          </div>
        </div>
      </div>

      {/* Filtered Export Builder */}
      <div className="card-clean p-4 mt-4 bg-white">
        <h5 className="fw-bold text-dark mb-3">Filtered Custom Export</h5>
        <form method="GET" action="/api/export/csv" className="row g-3">
          <div className="col-12 col-md-4">
            <label className="form-label small fw-semibold text-dark">Sangh Filter</label>
            <select
              name="sanghId"
              className="form-select form-select-sm"
              disabled={user.role === "TRUSTEE"}
            >
              {user.role !== "TRUSTEE" && <option value="">All Sanghs</option>}
              {sanghs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.prefix})
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-4">
            <label className="form-label small fw-semibold text-dark">Pathshala Status</label>
            <select name="pathshalaStatus" className="form-select form-select-sm">
              <option value="">All Statuses</option>
              <option value="YES">Attending</option>
              <option value="NO">Not Attending</option>
              <option value="PREVIOUSLY_ATTENDED">Previously Attended</option>
            </select>
          </div>

          <div className="col-12 col-md-4">
            <label className="form-label small fw-semibold text-dark">Area / Locality</label>
            <input
              type="text"
              name="area"
              placeholder="e.g. Bibwewadi"
              className="form-control form-control-sm"
            />
          </div>

          <div className="col-12 text-end pt-2 border-top">
            <button type="submit" className="btn btn-outline-primary px-4 btn-sm">
              <i className="bi bi-file-earmark-spreadsheet me-2"></i> Download Filtered CSV
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
