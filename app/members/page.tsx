import { requireAuth, getSanghAccessFilter } from "@/lib/auth/auth-helpers";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import { getMemberCalculatedAge } from "@/lib/validation/family";
import React from "react";

export const dynamic = "force-dynamic";

interface MembersPageProps {
  searchParams: {
    page?: string;
    q?: string;
    sanghId?: string;
    pathshalaStatus?: string;
    isChild?: string;
  };
}

export default async function MembersPage({ searchParams }: MembersPageProps) {
  const user = await requireAuth();

  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const pageSize = 20;
  const q = searchParams.q?.trim() || "";
  const requestedSanghId = searchParams.sanghId || undefined;
  const pathshalaStatus = searchParams.pathshalaStatus || undefined;
  const isChild = searchParams.isChild === "true";

  const sanghFilter = getSanghAccessFilter(user, requestedSanghId);

  const searchFilter = q
    ? {
        OR: [
          { memberId: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } },
          { family: { familyId: { contains: q, mode: "insensitive" as const } } },
          { family: { headName: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const whereClause: any = {
    status: "ACTIVE",
    ...sanghFilter,
    ...searchFilter,
  };

  if (pathshalaStatus) {
    whereClause.pathshalaStatus = pathshalaStatus;
  }

  if (isChild) {
    whereClause.age = { lt: 18 };
  }

  const [members, totalCount, sanghs] = await Promise.all([
    prisma.member.findMany({
      where: whereClause,
      include: {
        family: true,
        sangh: true,
      },
      orderBy: [{ sanghId: "asc" }, { memberId: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.member.count({ where: whereClause }),
    prisma.sangh.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="container py-2 py-md-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h1 className="h3 fw-bold text-dark mb-1">Members Directory</h1>
          <p className="text-muted small mb-0">
            Registered Sangh community members • Total active members: {totalCount}
          </p>
        </div>
        {user.role !== "TRUSTEE" && (
          <Link href="/families/new" className="btn btn-jain-primary d-flex align-items-center gap-2 px-3 shadow-sm">
            <i className="bi bi-person-plus-fill"></i>
            <span>Add Family &amp; Members</span>
          </Link>
        )}
      </div>

      {/* Filter Bar */}
      <div className="card-clean p-3 mb-4 bg-white">
        <form method="GET" action="/members" className="row g-2 align-items-center">
          <div className="col-12 col-md-4">
            <input
              type="text"
              name="q"
              defaultValue={q}
              className="form-control"
              placeholder="Search by Member ID, Name, Family ID..."
            />
          </div>

          <div className="col-6 col-md-3">
            <select
              name="sanghId"
              defaultValue={requestedSanghId || ""}
              className="form-select"
              disabled={(user.role === "VOLUNTEER" && !!user.sanghId) || user.role === "TRUSTEE"}
            >
              <option value="">All Sanghs</option>
              {sanghs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.prefix})
                </option>
              ))}
            </select>
          </div>

          <div className="col-6 col-md-3">
            <select
              name="pathshalaStatus"
              defaultValue={pathshalaStatus || ""}
              className="form-select"
            >
              <option value="">Pathshala: All</option>
              <option value="YES">Attending (YES)</option>
              <option value="NO">Not Attending (NO)</option>
              <option value="PREVIOUSLY_ATTENDED">Previously Attended</option>
            </select>
          </div>

          <div className="col-12 col-md-2 d-flex gap-2">
            <button type="submit" className="btn btn-primary w-100">
              Filter
            </button>
            {q || requestedSanghId || pathshalaStatus ? (
              <Link href="/members" className="btn btn-outline-secondary">
                Reset
              </Link>
            ) : null}
          </div>
        </form>
      </div>

      {/* Table / Cards */}
      {members.length === 0 ? (
        <div className="card-clean text-center py-5">
          <i className="bi bi-person-x text-muted display-4 d-block mb-3"></i>
          <h5 className="fw-bold text-dark mb-1">No members found</h5>
          <p className="text-muted small mb-0">Try clearing or adjusting search filters.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="card-clean p-0 overflow-hidden shadow-sm d-none d-lg-block mb-4">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="ps-4">Member ID</th>
                    <th>Name</th>
                    <th>Age / DOB</th>
                    <th>Gender</th>
                    <th>Relationship</th>
                    <th>Family ID</th>
                    <th>Sangh</th>
                    <th>Pathshala</th>
                    <th className="text-end pe-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => {
                    const calculatedAge = getMemberCalculatedAge(m);
                    const isChild = calculatedAge < 18;
                    const dobString = m.dateOfBirth
                      ? new Date(m.dateOfBirth).toISOString().split("T")[0]
                      : null;
                    return (
                      <tr key={m.id} className={isChild ? "table-warning-subtle" : ""}>
                        <td className="ps-4">
                          <Link href={`/members/${m.id}`} className="font-monospace fw-bold text-primary text-decoration-none">
                            {m.memberId}
                          </Link>
                        </td>
                        <td className="fw-semibold text-dark">
                          {m.name}
                          {m.relationship === "HEAD" && (
                            <span className="badge bg-secondary ms-1">Head</span>
                          )}
                        </td>
                        <td>
                          <span className="fw-semibold">{calculatedAge} yrs</span>
                          {isChild && <span className="badge bg-warning text-dark ms-1">Child</span>}
                          {dobString && (
                            <div className="small text-muted font-monospace">{dobString}</div>
                          )}
                        </td>
                        <td className="text-capitalize">{m.gender.toLowerCase()}</td>
                        <td>{m.relationship}</td>
                        <td>
                          <Link href={`/families/${m.familyId}`} className="font-monospace text-decoration-none text-secondary">
                            {m.family.familyId}
                          </Link>
                        </td>
                        <td>
                          <span className="badge-sangh font-monospace">{m.sangh.prefix}</span>
                        </td>
                        <td><StatusBadge type="pathshala" value={m.pathshalaStatus} /></td>
                        <td className="text-end pe-4">
                          <Link href={`/members/${m.id}`} className="btn btn-outline-secondary btn-sm">
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="d-lg-none d-flex flex-column gap-3 mb-4">
            {members.map((m) => {
              const calculatedAge = getMemberCalculatedAge(m);
              const dobString = m.dateOfBirth
                ? new Date(m.dateOfBirth).toISOString().split("T")[0]
                : null;
              return (
                <div key={m.id} className="card-clean p-3">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <Link href={`/members/${m.id}`} className="font-monospace fw-bold text-primary fs-6 text-decoration-none">
                        {m.memberId}
                      </Link>
                      <h6 className="fw-bold text-dark mb-0 mt-1">{m.name}</h6>
                    </div>
                    <span className="badge-sangh font-monospace">{m.sangh.prefix}</span>
                  </div>

                  <div className="small text-secondary mb-2">
                    <div>Family: <Link href={`/families/${m.familyId}`} className="font-monospace fw-bold text-decoration-none">{m.family.familyId}</Link> ({m.family.headName})</div>
                    <div>
                      Age: {calculatedAge} yrs {dobString && `(DOB: ${dobString})`} • Gender: {m.gender} • Rel: {m.relationship}
                    </div>
                  </div>

                  <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                    <StatusBadge type="pathshala" value={m.pathshalaStatus} />
                    <Link href={`/members/${m.id}`} className="btn btn-outline-primary btn-sm">
                      View Profile
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-3">
              <span className="text-muted small">
                Showing page {page} of {totalPages}
              </span>
              <div className="btn-group">
                {page > 1 ? (
                  <Link
                    href={`/members?page=${page - 1}&q=${encodeURIComponent(q)}&sanghId=${requestedSanghId || ""}&pathshalaStatus=${pathshalaStatus || ""}`}
                    className="btn btn-outline-secondary btn-sm"
                  >
                    Previous
                  </Link>
                ) : null}
                {page < totalPages ? (
                  <Link
                    href={`/members?page=${page + 1}&q=${encodeURIComponent(q)}&sanghId=${requestedSanghId || ""}&pathshalaStatus=${pathshalaStatus || ""}`}
                    className="btn btn-outline-secondary btn-sm"
                  >
                    Next
                  </Link>
                ) : null}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
