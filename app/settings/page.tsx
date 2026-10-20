import { requireAuth } from "@/lib/auth/auth-helpers";
import { prisma } from "@/lib/db/prisma";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import React from "react";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireAuth();

  const [sanghs, familyCounter, totalFamilies, totalMembers] = await Promise.all([
    prisma.sangh.findMany({
      include: {
        idCounter: true,
        _count: {
          select: { families: true, members: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.familyIdCounter.findUnique({
      where: { id: "GLOBAL_FAMILY_COUNTER" },
    }),
    prisma.family.count(),
    prisma.member.count(),
  ]);

  return (
    <div className="container py-2 py-md-4">
      <div className="mb-4">
        <h1 className="h3 fw-bold text-dark mb-1">System &amp; Sangh Settings</h1>
        <p className="text-muted small mb-0">
          Core architectural configuration, sequence counters, and user session profile.
        </p>
      </div>

      <div className="row g-4">
        {/* User Session Profile */}
        <div className="col-12 col-md-5">
          <div className="card-clean p-4 h-100 bg-white">
            <h5 className="fw-bold text-dark mb-3 border-bottom pb-2">Your Session Profile</h5>
            <div className="d-flex align-items-center gap-3 mb-3">
              <div className="rounded-circle bg-warning-subtle text-warning-emphasis p-3 fs-3">
                <i className="bi bi-person-badge"></i>
              </div>
              <div>
                <strong className="d-block text-dark fs-5">{user.name || "Sangh Volunteer"}</strong>
                <span className="text-muted small font-monospace">{user.username}</span>
              </div>
            </div>

            <div className="list-group list-group-flush small">
              <div className="list-group-item d-flex justify-content-between px-0">
                <span className="text-muted">Security Role</span>
                <span className="badge bg-primary font-monospace">{user.role}</span>
              </div>
              <div className="list-group-item d-flex justify-content-between px-0">
                <span className="text-muted">Account Status</span>
                <span className="badge bg-success font-monospace">{user.status}</span>
              </div>
              <div className="list-group-item d-flex justify-content-between px-0">
                <span className="text-muted">Assigned Sangh</span>
                <span className="fw-semibold text-dark">{user.sanghName || "All Sanghs (Full Access)"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Global Sequence Counters */}
        <div className="col-12 col-md-7">
          <div className="card-clean p-4 h-100 bg-white">
            <h5 className="fw-bold text-dark mb-2">Atomic Sequence Counters</h5>
            <p className="text-muted small mb-3">
              PostgreSQL atomic sequence state. These counters guarantee zero collisions across concurrent submissions.
            </p>

            <div className="p-3 bg-light rounded-3 mb-3 d-flex justify-content-between align-items-center">
              <div>
                <small className="text-muted d-block text-uppercase fw-semibold">Global Family ID Counter</small>
                <span className="font-monospace fs-5 fw-bold text-primary">
                  FAM-{String(familyCounter?.lastNumber || 0).padStart(6, "0")}
                </span>
              </div>
              <span className="badge bg-light text-dark border">
                {totalFamilies} active families
              </span>
            </div>

            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0 small">
                <thead className="table-light">
                  <tr>
                    <th>Sangh</th>
                    <th>Prefix</th>
                    <th>Last Member #</th>
                    <th>Next Member ID</th>
                  </tr>
                </thead>
                <tbody>
                  {sanghs.map((s) => {
                    const lastNum = s.idCounter?.lastNumber || 0;
                    const nextFormatted = `${s.prefix}-${String(lastNum + 1).padStart(6, "0")}`;
                    return (
                      <tr key={s.id}>
                        <td className="fw-semibold text-dark">{s.name}</td>
                        <td>
                          <span className="badge-sangh font-monospace">{s.prefix}</span>
                        </td>
                        <td className="font-monospace">{lastNum}</td>
                        <td className="font-monospace text-primary fw-semibold">{nextFormatted}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Change Password Section */}
        <div className="col-12 col-lg-8">
          <ChangePasswordForm />
        </div>

        {/* The Six Seeded Sanghs (Section 5) */}
        <div className="col-12">
          <div className="card-clean p-4 bg-white">
            <h5 className="fw-bold text-dark mb-1">Seeded Sangh Entities</h5>
            <p className="text-muted small mb-3">
              The six official Sanghs configured in the database:
            </p>

            <div className="row g-3">
              {sanghs.map((s, idx) => (
                <div key={s.id} className="col-12 col-sm-6 col-lg-4">
                  <div className="p-3 border rounded-3 bg-light h-100">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="badge bg-secondary-subtle text-secondary font-monospace">
                        Sangh #{idx + 1}
                      </span>
                      <span className="badge-sangh font-monospace fw-bold">{s.prefix}</span>
                    </div>
                    <strong className="d-block text-dark mb-2">{s.name}</strong>
                    <div className="d-flex justify-content-between small text-muted pt-2 border-top">
                      <span>{s._count.families} families</span>
                      <span>{s._count.members} members</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
