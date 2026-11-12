import { requireAuth, getSanghAccessFilter } from "@/lib/auth/auth-helpers";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import { getMemberCalculatedAge } from "@/lib/validation/family";
import { MEMBER_INTERESTS } from "@/lib/constants/interests";
import React from "react";

export const dynamic = "force-dynamic";

interface MembersPageProps {
  searchParams: {
    page?: string;
    q?: string;
    sanghId?: string;
    interest?: string;
    isChild?: string;
    location?: string;
  };
}

export default async function MembersPage({ searchParams }: MembersPageProps) {
  const user = await requireAuth();

  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const pageSize = 20;
  const q = searchParams.q?.trim() || "";
  const requestedSanghId = searchParams.sanghId || undefined;
  const interest = searchParams.interest || undefined;
  const isChild = searchParams.isChild === "true";
  const location = searchParams.location || "present"; // Default: only members present in Sangh / India

  const sanghFilter = getSanghAccessFilter(user, requestedSanghId);

  const andConditions: any[] = [{ status: "ACTIVE" }, sanghFilter];

  if (q) {
    andConditions.push({
      OR: [
        { memberId: { contains: q, mode: "insensitive" as const } },
        { name: { contains: q, mode: "insensitive" as const } },
        { family: { familyId: { contains: q, mode: "insensitive" as const } } },
        { family: { headName: { contains: q, mode: "insensitive" as const } } },
      ],
    });
  }

  if (interest) {
    andConditions.push({ interests: { has: interest } });
  }

  if (isChild) {
    andConditions.push({ age: { lt: 18 } });
  }

  // Location filter:
  // "present" (DEFAULT): Only members present in the Sangh / not in foreign
  // "foreign": Only members abroad / foreign (NRI)
  // "all": All members without location filtering
  if (location === "foreign") {
    andConditions.push({ residenceLocation: "FOREIGN" });
  } else if (location === "all") {
    // No location restriction
  } else {
    // "present" (Default view)
    andConditions.push({
      OR: [{ residenceLocation: null }, { residenceLocation: { not: "FOREIGN" } }],
    });
  }

  const whereClause = { AND: andConditions };

  const [members, totalCount, sanghs, presentCount, foreignCount, allCount] = await Promise.all([
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
    prisma.sangh.findMany({
      where: user.role === "TRUSTEE" && user.sanghId ? { id: user.sanghId, active: true } : { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.member.count({
      where: {
        status: "ACTIVE",
        ...sanghFilter,
        OR: [{ residenceLocation: null }, { residenceLocation: { not: "FOREIGN" } }],
      },
    }),
    prisma.member.count({
      where: {
        status: "ACTIVE",
        ...sanghFilter,
        residenceLocation: "FOREIGN",
      },
    }),
    prisma.member.count({
      where: {
        status: "ACTIVE",
        ...sanghFilter,
      },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="container py-2 py-md-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h1 className="h3 fw-bold text-dark mb-1">Members Directory</h1>
          <p className="text-muted small mb-0">
            Registered Sangh community members • Showing:{" "}
            <strong>
              {location === "foreign"
                ? "Members Abroad (In Foreign / NRI)"
                : location === "all"
                ? "All Members"
                : "Members Present in Sangh (At Present)"}
            </strong>{" "}
            ({totalCount} found)
          </p>
        </div>
        {user.role !== "TRUSTEE" && (
          <Link href="/families/new" className="btn btn-jain-primary d-flex align-items-center gap-2 px-3 shadow-sm">
            <i className="bi bi-person-plus-fill"></i>
            <span>Add Family &amp; Members</span>
          </Link>
        )}
      </div>

      {/* Location View Tabs */}
      <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
        <Link
          href={`/members?location=present&sanghId=${requestedSanghId || ""}&q=${encodeURIComponent(q)}&interest=${interest || ""}`}
          className={`btn btn-sm d-flex align-items-center gap-1 ${
            location === "present"
              ? "btn-primary shadow-xs"
              : "btn-outline-secondary bg-white"
          }`}
        >
          <i className="bi bi-geo-alt-fill"></i>
          <span>📍 Present in Sangh ({presentCount})</span>
          {location === "present" && (
            <span className="badge bg-white text-primary ms-1 small" style={{ fontSize: "0.65rem" }}>
              Default
            </span>
          )}
        </Link>

        <Link
          href={`/members?location=foreign&sanghId=${requestedSanghId || ""}&q=${encodeURIComponent(q)}&interest=${interest || ""}`}
          className={`btn btn-sm d-flex align-items-center gap-1 ${
            location === "foreign"
              ? "btn-danger shadow-xs text-white"
              : "btn-outline-secondary bg-white"
          }`}
        >
          <i className="bi bi-airplane-fill"></i>
          <span>✈️ In Foreign / NRI ({foreignCount})</span>
        </Link>

        <Link
          href={`/members?location=all&sanghId=${requestedSanghId || ""}&q=${encodeURIComponent(q)}&interest=${interest || ""}`}
          className={`btn btn-sm d-flex align-items-center gap-1 ${
            location === "all"
              ? "btn-dark shadow-xs"
              : "btn-outline-secondary bg-white"
          }`}
        >
          <i className="bi bi-people-fill"></i>
          <span>👥 All Members ({allCount})</span>
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="card-clean p-3 mb-4 bg-white">
        <form method="GET" action="/members" className="row g-2 align-items-center">
          <input type="hidden" name="location" value={location} />

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
              name="interest"
              defaultValue={interest || ""}
              className="form-select"
            >
              <option value="">Interests: All</option>
              {MEMBER_INTERESTS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label} ({item.hindiLabel})
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-2 d-flex gap-2">
            <button type="submit" className="btn btn-primary w-100">
              Filter
            </button>
            {q || requestedSanghId || interest || location !== "present" ? (
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
                    <th>Field of Interests</th>
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
                          <div>{m.name}</div>
                          <div className="d-flex align-items-center gap-1 mt-1 flex-wrap">
                            {m.relationship === "HEAD" && (
                              <span className="badge bg-secondary">Head</span>
                            )}
                            {m.bloodGroup && (
                              <span className="badge bg-danger-subtle text-danger border border-danger-subtle">
                                🩸 {m.bloodGroup}
                              </span>
                            )}
                            {m.residenceLocation === "FOREIGN" ? (
                              <span className="badge bg-danger text-white">
                                <i className="bi bi-airplane-fill me-1"></i>In Foreign (NRI)
                              </span>
                            ) : m.residenceLocation === "OUT_OF_PUNE" ? (
                              <span className="badge bg-secondary-subtle text-secondary border">
                                📍 Outside Pune
                              </span>
                            ) : m.residenceLocation === "IN_PUNE" ? (
                              <span className="badge bg-success-subtle text-success border border-success-subtle">
                                📍 In Pune
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          <span className="fw-semibold">{calculatedAge} yrs</span>
                          {isChild && <span className="badge bg-warning text-dark ms-1">Child</span>}
                          {dobString && (
                            <div className="small text-muted font-monospace">{dobString}</div>
                          )}
                        </td>
                        <td className="text-capitalize">{m.gender.toLowerCase()}</td>
                        <td>
                          <div className="fw-medium">
                            {m.relationship === "DAUGHTER_IN_LAW"
                              ? "Daughter-in-law"
                              : m.relationship === "GRANDCHILD"
                              ? "Grandchild (पोता/पोती)"
                              : m.relationship}
                          </div>
                        </td>
                        <td>
                          <Link href={`/families/${m.familyId}`} className="font-monospace text-decoration-none text-secondary">
                            {m.family.familyId}
                          </Link>
                        </td>
                        <td>
                          <span className="badge-sangh font-monospace">{m.sangh.prefix}</span>
                        </td>
                        <td>
                          {m.interests && m.interests.length > 0 ? (
                            <div className="d-flex flex-wrap gap-1" style={{ maxWidth: "240px" }}>
                              {m.interests.map((interestKey: string) => {
                                const opt = MEMBER_INTERESTS.find((i) => i.key === interestKey);
                                return (
                                  <span
                                    key={interestKey}
                                    className="badge bg-primary-subtle text-primary border border-primary-subtle"
                                    title={opt ? opt.hindiLabel : interestKey}
                                  >
                                    {opt ? opt.label : interestKey}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-muted small">—</span>
                          )}
                        </td>
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
                    <div className="d-flex align-items-center gap-1 mt-1 flex-wrap">
                      {m.bloodGroup && (
                        <span className="badge bg-danger-subtle text-danger border border-danger-subtle">
                          🩸 {m.bloodGroup}
                        </span>
                      )}
                      {m.residenceLocation === "FOREIGN" ? (
                        <span className="badge bg-danger text-white">
                          <i className="bi bi-airplane-fill me-1"></i>In Foreign (NRI)
                        </span>
                      ) : m.residenceLocation === "OUT_OF_PUNE" ? (
                        <span className="badge bg-secondary-subtle text-secondary border">
                          📍 Outside Pune
                        </span>
                      ) : m.residenceLocation === "IN_PUNE" ? (
                        <span className="badge bg-success-subtle text-success border border-success-subtle">
                          📍 In Pune
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {m.interests && m.interests.length > 0 && (
                    <div className="pt-2 border-top small mb-2">
                      <span className="text-muted d-block fs-8 mb-1">Field of Interests (रुचि):</span>
                      <div className="d-flex flex-wrap gap-1">
                        {m.interests.map((interestKey: string) => {
                          const opt = MEMBER_INTERESTS.find((i) => i.key === interestKey);
                          return (
                            <span
                              key={interestKey}
                              className="badge bg-primary-subtle text-primary border border-primary-subtle"
                            >
                              {opt ? `${opt.label} (${opt.hindiLabel})` : interestKey}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="d-flex justify-content-end align-items-center pt-2 border-top">
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
                    href={`/members?page=${page - 1}&location=${location}&q=${encodeURIComponent(q)}&sanghId=${requestedSanghId || ""}&interest=${interest || ""}`}
                    className="btn btn-outline-secondary btn-sm"
                  >
                    Previous
                  </Link>
                ) : null}
                {page < totalPages ? (
                  <Link
                    href={`/members?page=${page + 1}&location=${location}&q=${encodeURIComponent(q)}&sanghId=${requestedSanghId || ""}&interest=${interest || ""}`}
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
