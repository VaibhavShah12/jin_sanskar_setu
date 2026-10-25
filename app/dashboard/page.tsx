import { requireAuth, getSanghAccessFilter } from "@/lib/auth/auth-helpers";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import React from "react";
import Logo from "@/components/Logo";
import MemberAccessRequestsSection, { AccessRequestItem } from "@/components/MemberAccessRequestsSection";
import MemberSubmissionsSection, { MemberSubmissionItem } from "@/components/MemberSubmissionsSection";
import TrusteeRequestsSection, { PendingTrusteeItem } from "@/components/TrusteeRequestsSection";
import VolunteerQrCard from "@/components/VolunteerQrCard";
import { getPublicMemberFormUrl, generateMemberFormQrCodeDataUrl } from "@/lib/qr/qr-helper";
import { maskMobile } from "@/lib/validation/family";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireAuth();

  // If trustee has no sanghId assigned, deny access
  if (user.role === "TRUSTEE" && !user.sanghId) {
    redirect("/login?error=TRUSTEE_NO_SANGH");
  }

  const isTrustee = user.role === "TRUSTEE";
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
    todayFamilies,
    pendingAccessRequests,
    approvedAccessRequests,
    sanghs,
    rawPendingRequests,
    rawMemberSubmissions,
    pendingFormSubmissions,
    rawPendingTrustees,
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
    prisma.family.count({
      where: { status: "ACTIVE", createdAt: { gte: startOfToday }, ...sanghFilter },
    }),
    !isTrustee
      ? prisma.memberAccessRequest.count({
          where: { status: "PENDING", ...sanghFilter },
        })
      : Promise.resolve(0),
    !isTrustee
      ? prisma.memberAccessRequest.count({
          where: { status: "APPROVED", ...sanghFilter },
        })
      : Promise.resolve(0),
    prisma.sangh.findMany({
      where: isTrustee ? { id: user.sanghId || undefined, active: true } : { active: true },
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
    !isTrustee
      ? prisma.memberAccessRequest.findMany({
          where: { status: "PENDING", ...sanghFilter },
          include: {
            family: { select: { familyId: true, headName: true, area: true } },
            sangh: { select: { name: true, prefix: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        })
      : Promise.resolve([]),
    !isTrustee
      ? prisma.memberFormSubmission.findMany({
          where: { ...sanghFilter },
          include: {
            family: {
              select: {
                familyId: true,
                headName: true,
                address: true,
                area: true,
                members: { where: { status: "ACTIVE" }, select: { id: true } },
              },
            },
            sangh: { select: { name: true, prefix: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 40,
        })
      : Promise.resolve([]),
    !isTrustee
      ? prisma.memberFormSubmission.count({
          where: { status: "PENDING", ...sanghFilter },
        })
      : Promise.resolve(0),
    user.role === "ADMIN"
      ? prisma.user.findMany({
          where: { role: "TRUSTEE", status: "PENDING" },
          include: { sangh: true },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  // Generate public member form QR code for volunteer desk
  const memberFormUrl = getPublicMemberFormUrl();
  const memberFormQrDataUrl = await generateMemberFormQrCodeDataUrl(memberFormUrl);

  // Transform raw pending requests for client component
  const pendingRequests: AccessRequestItem[] = rawPendingRequests.map((r) => ({
    id: r.id,
    requestId: r.requestId,
    maskedMobile: maskMobile(r.mobile),
    familyId: r.family.familyId,
    headName: r.family.headName,
    area: r.family.area,
    sanghName: r.sangh.name,
    sanghPrefix: r.sangh.prefix,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));

  // Transform raw member form submissions for client component
  const memberSubmissions: MemberSubmissionItem[] = rawMemberSubmissions.map((s) => ({
    id: s.id,
    submissionNumber: s.submissionNumber,
    familyId: s.familyId,
    familyRefId: s.family.familyId,
    headName: s.family.headName,
    maskedMobile: maskMobile(s.submittedMobile),
    currentAddress: s.family.address,
    currentArea: s.family.area,
    currentMemberCount: s.family.members.length,
    sanghName: s.sangh.name,
    sanghPrefix: s.sangh.prefix,
    headInfoCorrect: s.headInfoCorrect,
    addressChanged: s.addressChanged,
    newAddress: s.newAddress,
    newArea: s.newArea,
    memberCount: s.memberCount,
    membersUpToDate: s.membersUpToDate,
    correctionNeeded: s.correctionNeeded,
    correctionDetails: s.correctionDetails,
    additionalNotes: s.additionalNotes,
    status: s.status,
    reviewedBy: s.reviewedBy,
    reviewedAt: s.reviewedAt ? s.reviewedAt.toISOString() : null,
    rejectionReason: s.rejectionReason,
    appliedChanges: s.appliedChanges,
    createdAt: s.createdAt.toISOString(),
  }));

  // Transform raw pending trustees for Admin review component
  const pendingTrustees: PendingTrusteeItem[] = ((rawPendingTrustees as any[]) || []).map((t) => ({
    id: t.id,
    username: t.username,
    name: t.name,
    email: t.email,
    phone: t.phone,
    role: t.role,
    status: t.status,
    sanghId: t.sanghId,
    sanghName: t.sangh?.name || "Assigned Sangh",
    sanghPrefix: t.sangh?.prefix || "",
    createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : String(t.createdAt),
  }));

  // Aggregate children count per Sangh
  const childrenPerSangh = await prisma.member.groupBy({
    by: ["sanghId"],
    where: { status: "ACTIVE", age: { lt: 18 }, ...sanghFilter },
    _count: { id: true },
  });

  const childrenCountMap = new Map<string, number>();
  for (const c of childrenPerSangh) {
    childrenCountMap.set(c.sanghId, c._count.id);
  }

  // Percentage calculations
  const attendingPct = totalChildren > 0 ? Math.round((childrenAttending / totalChildren) * 100) : 0;

  const canRegister = user.role === "ADMIN" || user.role === "VOLUNTEER";

  return (
    <div className="container py-2 py-md-4">
      {/* Welcome & Quick Action Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2 py-1 mb-1">
            {user.role === "ADMIN"
              ? "Administrator Portal"
              : isTrustee
              ? `Trustee • ${user.sanghName || "Assigned Sangh"}`
              : `Volunteer • ${user.sanghName || "All Sanghs"}`}
          </span>
          <h1 className="h3 fw-bold text-dark mb-0">
            {isTrustee ? `${user.sanghName} Dashboard` : "Community Survey Dashboard"}
          </h1>
          <p className="text-muted small mb-0">
            Real-time survey indicators powered by PostgreSQL single source of truth
          </p>
        </div>
        <div className="d-flex gap-2">
          {canRegister && (
            <Link href="/families/new" className="btn btn-jain-primary d-flex align-items-center gap-2 px-3 shadow-sm">
              <i className="bi bi-person-plus-fill"></i>
              <span>Register New Family</span>
            </Link>
          )}
          <Link href="/search" className="btn btn-outline-secondary d-flex align-items-center gap-2 px-3">
            <i className="bi bi-search"></i>
            <span>Search</span>
          </Link>
          {!isTrustee && (
            <Link href="/admin/qr-code" className="btn btn-outline-primary d-flex align-items-center gap-2 px-3">
              <i className="bi bi-qr-code"></i>
              <span>Portal QR</span>
            </Link>
          )}
        </div>
      </div>

      {/* Admin: Pending Trustee Registration Requests */}
      {user.role === "ADMIN" && (
        <TrusteeRequestsSection initialTrustees={pendingTrustees} />
      )}

      {/* Primary KPI Dashboard Cards */}
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
            <div className="text-muted small">Calculated age &lt; 18 yrs</div>
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

      {/* Pathshala & Member Access Summary Cards */}
      <h2 className="h5 fw-bold text-dark mb-3">
        {isTrustee ? "Pathshala Status" : "Pathshala Status & Member Portal Requests"}
      </h2>
      <div className="row g-3 mb-4">
        {/* Attending */}
        <div className={isTrustee ? "col-12 col-md-6" : "col-6 col-md-3"}>
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

        {/* Not Attending */}
        <div className={isTrustee ? "col-12 col-md-6" : "col-6 col-md-3"}>
          <div className="card-clean p-3 border-danger-subtle h-100">
            <div className="d-flex align-items-center gap-3">
              <div className="rounded-circle p-3 bg-danger-subtle text-danger fs-4">
                <i className="bi bi-x-circle-fill"></i>
              </div>
              <div>
                <div className="text-muted small fw-semibold">Not Attending</div>
                <div className="fs-3 fw-bold text-dark">{childrenNotAttending}</div>
                <small className="text-danger fw-medium">Outreach potential</small>
              </div>
            </div>
          </div>
        </div>

        {/* Member Access Summary Cards (Admin & Volunteer only) */}
        {!isTrustee && (
          <>
            {/* Pending Member Access */}
            <div className="col-6 col-md-3">
              <div className="card-clean p-3 border-warning-subtle h-100">
                <div className="d-flex align-items-center gap-3">
                  <div className="rounded-circle p-3 bg-warning-subtle text-warning-emphasis fs-4">
                    <i className="bi bi-hourglass-split"></i>
                  </div>
                  <div>
                    <div className="text-muted small fw-semibold">Pending Requests</div>
                    <div className="fs-3 fw-bold text-warning-emphasis">{pendingAccessRequests}</div>
                    <small className="text-muted">Awaiting validation</small>
                  </div>
                </div>
              </div>
            </div>

            {/* Approved Member Access */}
            <div className="col-6 col-md-3">
              <div className="card-clean p-3 border-info-subtle h-100">
                <div className="d-flex align-items-center gap-3">
                  <div className="rounded-circle p-3 bg-info-subtle text-info-emphasis fs-4">
                    <i className="bi bi-shield-check"></i>
                  </div>
                  <div>
                    <div className="text-muted small fw-semibold">Approved Access</div>
                    <div className="fs-3 fw-bold text-dark">{approvedAccessRequests}</div>
                    <small className="text-info fw-medium">Active member sessions</small>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Member Form Submissions (Volunteer / Admin only) */}
      {!isTrustee && (
        <MemberSubmissionsSection
          initialSubmissions={memberSubmissions}
          canManage={!isTrustee}
        />
      )}

      {/* Volunteer Desk Portal QR Card */}
      {!isTrustee && (
        <VolunteerQrCard
          qrDataUrl={memberFormQrDataUrl}
          targetUrl={memberFormUrl}
        />
      )}

      {/* Section 6: Member Access Requests (Volunteer / Admin only) */}
      {!isTrustee && (
        <MemberAccessRequestsSection
          initialRequests={pendingRequests}
          canManage={!isTrustee}
        />
      )}

      {/* Sangh Summary Table & Cards */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="h5 fw-bold text-dark mb-0">
          {isTrustee ? "Assigned Sangh Overview" : "Six Sanghs Community Overview"}
        </h2>
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
