import { requireAuth, getSanghAccessFilter } from "@/lib/auth/auth-helpers";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import React from "react";
import Logo from "@/components/Logo";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireAuth();
  const sanghFilter = getSanghAccessFilter(user);

  // Time boundary for today's registrations
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // 1. Core Aggregate Metrics from PostgreSQL
  const [
    totalFamilies,
    totalMembers,
    totalChildren,
    childrenAttending,
    childrenNotAttending,
    childrenInterested,
    todayFamilies,
    sanghs,
  ] = await Promise.all([
    prisma.family.count({
      where: { status: "ACTIVE", ...sanghFilter },
    }),
    prisma.member.count({
      where: { status: "ACTIVE", ...sanghFilter },
    }),
    prisma.member.count({
      where: { status: "ACTIVE", age: { lt: 18 }, ...sanghFilter },
    }),
    prisma.member.count({
      where: { status: "ACTIVE", age: { lt: 18 }, pathshalaStatus: "YES", ...sanghFilter },
    }),
    prisma.member.count({
      where: { status: "ACTIVE", age: { lt: 18 }, pathshalaStatus: "NO", ...sanghFilter },
    }),
    prisma.member.count({
      where: { status: "ACTIVE", age: { lt: 18 }, pathshalaInterest: "YES", ...sanghFilter },
    }),
    prisma.family.count({
      where: { status: "ACTIVE", createdAt: { gte: startOfToday }, ...sanghFilter },
    }),
    prisma.sangh.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            families: { where: { status: "ACTIVE" } },
            members: { where: { status: "ACTIVE" } },
          },
        },
      },
    }),
  ]);

  // Aggregate children count per Sangh
  const childrenPerSangh = await prisma.member.groupBy({
    by: ["sanghId"],
    where: { status: "ACTIVE", age: { lt: 18 } },
    _count: { id: true },
  });

  const childrenCountMap = new Map<string, number>();
  for (const c of childrenPerSangh) {
    childrenCountMap.set(c.sanghId, c._count.id);
  }

  // Percentage calculations
  const attendingPct = totalChildren > 0 ? Math.round((childrenAttending / totalChildren) * 100) : 0;

  return (
    <div className="container py-2 py-md-4">
      {/* Welcome & Quick Action Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2 py-1 mb-1">
            {user.role === "ADMIN" ? "Administrator Portal" : `Volunteer • ${user.sanghName || "All Sanghs"}`}
          </span>
          <h1 className="h3 fw-bold text-dark mb-0">Community Survey Dashboard</h1>
          <p className="text-muted small mb-0">
            Real-time survey indicators powered by PostgreSQL single source of truth
          </p>
        </div>
        <div className="d-flex gap-2">
          <Link href="/families/new" className="btn btn-jain-primary d-flex align-items-center gap-2 px-3 shadow-sm">
            <i className="bi bi-person-plus-fill"></i>
            <span>Register New Family</span>
          </Link>
          <Link href="/search" className="btn btn-outline-secondary d-flex align-items-center gap-2 px-3">
            <i className="bi bi-search"></i>
            <span>Search</span>
          </Link>
        </div>
      </div>

      {/* Pathshala Potential Callout Card */}
      {childrenNotAttending > 0 && (
        <div className="card-clean border-warning p-3 p-md-4 mb-4 bg-amber-50" style={{ backgroundColor: "#fefdf8" }}>
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
            <div className="d-flex align-items-center gap-3">
              <div className="rounded-circle p-3 bg-warning-subtle text-warning-emphasis fs-4">
                <i className="bi bi-mortarboard-fill"></i>
              </div>
              <div>
                <h5 className="fw-bold mb-1 text-dark">
                  Pathshala Potential: {childrenNotAttending} Children Not Yet Attending
                </h5>
                <p className="text-secondary small mb-0">
                  {childrenInterested} of these children have expressed interest in attending Pathshala classes.
                </p>
              </div>
            </div>
            <Link
              href="/search?ageMax=17&pathshalaStatus=NO"
              className="btn btn-warning text-dark fw-semibold px-4 shadow-sm text-nowrap"
            >
              View Potential Report <i className="bi bi-arrow-right ms-1"></i>
            </Link>
          </div>
        </div>
      )}

      {/* 7 KPI Dashboard Cards */}
      <div className="row g-3 mb-4">
        {/* Total Families */}
        <div className="col-6 col-lg-3">
          <div className="card-clean p-3 h-100">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="text-muted small fw-semibold text-uppercase">Families</span>
              <span className="badge bg-primary-subtle text-primary p-2 rounded-3">
                <i className="bi bi-house-door-fill"></i>
              </span>
            </div>
            <div className="display-6 fw-bold text-dark mb-1">{totalFamilies}</div>
            <div className="text-muted small">Registered households</div>
          </div>
        </div>

        {/* Total Members */}
        <div className="col-6 col-lg-3">
          <div className="card-clean p-3 h-100">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="text-muted small fw-semibold text-uppercase">Members</span>
              <span className="badge bg-info-subtle text-info-emphasis p-2 rounded-3">
                <i className="bi bi-people-fill"></i>
              </span>
            </div>
            <div className="display-6 fw-bold text-dark mb-1">{totalMembers}</div>
            <div className="text-muted small">Total surveyed individuals</div>
          </div>
        </div>

        {/* Total Children */}
        <div className="col-6 col-lg-3">
          <div className="card-clean p-3 h-100">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="text-muted small fw-semibold text-uppercase">Children (&lt;18)</span>
              <span className="badge bg-warning-subtle text-warning-emphasis p-2 rounded-3">
                <i className="bi bi-person-hearts"></i>
              </span>
            </div>
            <div className="display-6 fw-bold text-dark mb-1">{totalChildren}</div>
            <div className="text-muted small">Under 18 years old</div>
          </div>
        </div>

        {/* Today's Registrations */}
        <div className="col-6 col-lg-3">
          <div className="card-clean p-3 h-100">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <span className="text-muted small fw-semibold text-uppercase">Today&apos;s Survey</span>
              <span className="badge bg-success-subtle text-success p-2 rounded-3">
                <i className="bi bi-calendar2-check-fill"></i>
              </span>
            </div>
            <div className="display-6 fw-bold text-success mb-1">+{todayFamilies}</div>
            <div className="text-muted small">Families added today</div>
          </div>
        </div>
      </div>

      {/* Pathshala Metrics Breakdown Cards */}
      <h2 className="h5 fw-bold text-dark mb-3">Pathshala Engagement Summary (Children &lt; 18)</h2>
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-4">
          <div className="card-clean p-3 border-success-subtle h-100">
            <div className="d-flex align-items-center gap-3">
              <div className="rounded-circle p-3 bg-success-subtle text-success fs-4">
                <i className="bi bi-check-circle-fill"></i>
              </div>
              <div>
                <div className="text-muted small fw-semibold">Attending Pathshala</div>
                <div className="fs-3 fw-bold text-dark">{childrenAttending}</div>
                <small className="text-success fw-medium">{attendingPct}% attendance rate</small>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div className="card-clean p-3 border-danger-subtle h-100">
            <div className="d-flex align-items-center gap-3">
              <div className="rounded-circle p-3 bg-danger-subtle text-danger fs-4">
                <i className="bi bi-x-circle-fill"></i>
              </div>
              <div>
                <div className="text-muted small fw-semibold">Not Attending</div>
                <div className="fs-3 fw-bold text-dark">{childrenNotAttending}</div>
                <small className="text-danger fw-medium">Target outreach group</small>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div className="card-clean p-3 border-info-subtle h-100">
            <div className="d-flex align-items-center gap-3">
              <div className="rounded-circle p-3 bg-info-subtle text-info-emphasis fs-4">
                <i className="bi bi-star-fill"></i>
              </div>
              <div>
                <div className="text-muted small fw-semibold">Children Interested</div>
                <div className="fs-3 fw-bold text-dark">{childrenInterested}</div>
                <small className="text-info fw-medium">Ready for enrollment</small>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sangh Summary Table & Cards */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="h5 fw-bold text-dark mb-0">Six Sanghs Community Overview</h2>
        <Link href="/analytics" className="text-decoration-none small fw-semibold text-primary">
          View Detailed Charts <i className="bi bi-arrow-right"></i>
        </Link>
      </div>

      {/* Responsive Cards for Mobile, Clean Table for Desktop */}
      <div className="card-clean p-0 overflow-hidden shadow-sm mb-4">
        <div className="table-responsive d-none d-md-block">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th className="ps-4">Sangh Name</th>
                <th>Prefix</th>
                <th className="text-center">Total Families</th>
                <th className="text-center">Total Members</th>
                <th className="text-center">Children (&lt;18)</th>
                <th className="text-end pe-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sanghs.map((s) => {
                const childCount = childrenCountMap.get(s.id) || 0;
                return (
                  <tr key={s.id}>
                    <td className="ps-4 fw-semibold text-dark d-flex align-items-center gap-2">
                      <Logo size={20} />
                      <span>{s.name}</span>
                    </td>
                    <td>
                      <span className="badge-sangh font-monospace">{s.prefix}</span>
                    </td>
                    <td className="text-center fw-bold">{s._count.families}</td>
                    <td className="text-center fw-bold">{s._count.members}</td>
                    <td className="text-center fw-bold text-primary">{childCount}</td>
                    <td className="text-end pe-4">
                      <Link
                        href={`/search?sanghId=${s.id}`}
                        className="btn btn-outline-secondary btn-sm px-3"
                      >
                        <i className="bi bi-search me-1"></i> Filter
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile View: Cards */}
        <div className="d-md-none p-3">
          <div className="row g-2">
            {sanghs.map((s) => {
              const childCount = childrenCountMap.get(s.id) || 0;
              return (
                <div key={s.id} className="col-12">
                  <div className="p-3 border rounded-3 bg-light">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <strong className="d-block text-dark">{s.name}</strong>
                        <span className="badge-sangh font-monospace">{s.prefix}</span>
                      </div>
                      <Link
                        href={`/search?sanghId=${s.id}`}
                        className="btn btn-sm btn-outline-primary"
                      >
                        Search
                      </Link>
                    </div>
                    <div className="d-flex justify-content-between pt-2 border-top text-center">
                      <div>
                        <small className="text-muted d-block">Families</small>
                        <strong className="fs-6">{s._count.families}</strong>
                      </div>
                      <div>
                        <small className="text-muted d-block">Members</small>
                        <strong className="fs-6">{s._count.members}</strong>
                      </div>
                      <div>
                        <small className="text-muted d-block">Children</small>
                        <strong className="fs-6 text-primary">{childCount}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
