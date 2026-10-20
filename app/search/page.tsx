import { requireAuth, getSanghAccessFilter } from "@/lib/auth/auth-helpers";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import { getMemberCalculatedAge } from "@/lib/validation/family";
import { MEMBER_INTERESTS } from "@/lib/constants/interests";
import React from "react";

export const dynamic = "force-dynamic";

interface SearchPageProps {
  searchParams: {
    page?: string;
    sortBy?: string;
    sortOrder?: string;
    familyId?: string;
    memberId?: string;
    name?: string;
    headName?: string;
    mobile?: string;
    sanghId?: string;
    area?: string;
    ageMin?: string;
    ageMax?: string;
    gender?: string;
    relationship?: string;
    pathshalaStatus?: string;
    preferredDay?: string;
    preferredTime?: string;
    startDate?: string;
    endDate?: string;
    preset?: string;
    interest?: string;
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const user = await requireAuth();

  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const pageSize = 15;
  const sortBy = searchParams.sortBy || "createdAt";
  const sortOrder = searchParams.sortOrder === "asc" ? "asc" : "desc";

  // Check if Pathshala Potential preset is active
  const isPotentialPreset = searchParams.preset === "pathshala_potential";

  // Build combinable Prisma where clause
  const where: any = {
    status: "ACTIVE",
    ...getSanghAccessFilter(user, searchParams.sanghId),
  };

  // Family relation filters
  const familyWhere: any = {};
  if (searchParams.familyId?.trim()) {
    familyWhere.familyId = { contains: searchParams.familyId.trim(), mode: "insensitive" };
  }
  if (searchParams.headName?.trim()) {
    familyWhere.headName = { contains: searchParams.headName.trim(), mode: "insensitive" };
  }
  if (searchParams.mobile?.trim()) {
    familyWhere.mobile = { contains: searchParams.mobile.trim() };
  }
  if (searchParams.area?.trim()) {
    familyWhere.area = { contains: searchParams.area.trim(), mode: "insensitive" };
  }
  if (Object.keys(familyWhere).length > 0) {
    where.family = familyWhere;
  }

  // Member direct filters
  if (searchParams.memberId?.trim()) {
    where.memberId = { contains: searchParams.memberId.trim(), mode: "insensitive" };
  }
  if (searchParams.name?.trim()) {
    where.name = { contains: searchParams.name.trim(), mode: "insensitive" };
  }
  if (searchParams.gender) {
    where.gender = searchParams.gender;
  }
  if (searchParams.relationship) {
    where.relationship = searchParams.relationship;
  }

  // Pathshala Filters
  if (isPotentialPreset) {
    where.age = { lt: 18 };
    where.pathshalaStatus = "NO";
  } else {
    if (searchParams.pathshalaStatus) {
      where.pathshalaStatus = searchParams.pathshalaStatus;
    }

    // Age / Age Range
    const ageMin = searchParams.ageMin ? parseInt(searchParams.ageMin) : undefined;
    const ageMax = searchParams.ageMax ? parseInt(searchParams.ageMax) : undefined;
    if (ageMin !== undefined || ageMax !== undefined) {
      where.age = {};
      if (ageMin !== undefined && !isNaN(ageMin)) where.age.gte = ageMin;
      if (ageMax !== undefined && !isNaN(ageMax)) where.age.lte = ageMax;
    }
  }

  // Schedule Filters
  if (searchParams.preferredDay) {
    where.preferredDay = searchParams.preferredDay;
  }
  if (searchParams.preferredTime) {
    where.preferredTime = searchParams.preferredTime;
  }

  // Interest Filter (Vihar Seva, Pathshala, Gahuli/Rangoli, Shuddhikaran, Suguru Vaiyyavach)
  if (searchParams.interest) {
    where.interests = {
      has: searchParams.interest,
    };
  }

  // Date Range Filter
  if (searchParams.startDate || searchParams.endDate) {
    where.createdAt = {};
    if (searchParams.startDate) {
      where.createdAt.gte = new Date(searchParams.startDate);
    }
    if (searchParams.endDate) {
      const end = new Date(searchParams.endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  // Execute database query and count
  const [members, totalCount, sanghs] = await Promise.all([
    prisma.member.findMany({
      where,
      include: {
        family: true,
        sangh: true,
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.member.count({ where }),
    prisma.sangh.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  // Construct Export query parameters
  const exportParams = new URLSearchParams();
  if (isPotentialPreset) exportParams.set("type", "pathshala_potential");
  if (searchParams.sanghId) exportParams.set("sanghId", searchParams.sanghId);
  if (searchParams.pathshalaStatus) exportParams.set("pathshalaStatus", searchParams.pathshalaStatus);
  if (searchParams.area) exportParams.set("area", searchParams.area);
  if (searchParams.interest) exportParams.set("interest", searchParams.interest);

  return (
    <div className="container py-2 py-md-4">
      {/* Header & Preset Toggles */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h1 className="h3 fw-bold text-dark mb-1">Advanced Community Search</h1>
          <p className="text-muted small mb-0">
            Combinable multi-criteria query engine • PostgreSQL server-side filtered
          </p>
        </div>

        <div className="d-flex flex-wrap gap-2">
          {/* Pathshala Potential Quick Button (Section 20) */}
          <Link
            href="/search?preset=pathshala_potential"
            className={`btn btn-sm d-flex align-items-center gap-1 ${isPotentialPreset ? "btn-warning text-dark fw-bold" : "btn-outline-warning text-dark"}`}
          >
            <i className="bi bi-mortarboard-fill"></i>
            <span>Pathshala Potential (&lt;18 Not Attending)</span>
          </Link>

          <a
            href={`/api/export/csv?${exportParams.toString()}`}
            className="btn btn-outline-success btn-sm d-flex align-items-center gap-1"
            download
          >
            <i className="bi bi-download"></i>
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* Combinable Filters Form (Section 17) */}
      <div className="card-clean p-3 p-md-4 mb-4 bg-white">
        <form method="GET" action="/search">
          <div className="row g-2">
            {/* Row 1: Identifiers & Names */}
            <div className="col-6 col-md-3">
              <label className="form-label small fw-semibold text-dark mb-1">Member ID</label>
              <input
                type="text"
                name="memberId"
                defaultValue={searchParams.memberId || ""}
                placeholder="e.g. MSJS-000001"
                className="form-control form-control-sm font-monospace"
              />
            </div>

            <div className="col-6 col-md-3">
              <label className="form-label small fw-semibold text-dark mb-1">Family ID</label>
              <input
                type="text"
                name="familyId"
                defaultValue={searchParams.familyId || ""}
                placeholder="e.g. FAM-000001"
                className="form-control form-control-sm font-monospace"
              />
            </div>

            <div className="col-12 col-md-3">
              <label className="form-label small fw-semibold text-dark mb-1">Member Name</label>
              <input
                type="text"
                name="name"
                defaultValue={searchParams.name || ""}
                placeholder="First or last name"
                className="form-control form-control-sm"
              />
            </div>

            <div className="col-12 col-md-3">
              <label className="form-label small fw-semibold text-dark mb-1">Head of Family</label>
              <input
                type="text"
                name="headName"
                defaultValue={searchParams.headName || ""}
                placeholder="Head name"
                className="form-control form-control-sm"
              />
            </div>

            {/* Row 2: Sangh, Mobile, Area */}
            <div className="col-6 col-md-4">
              <label className="form-label small fw-semibold text-dark mb-1">Sangh</label>
              <select
                name="sanghId"
                defaultValue={searchParams.sanghId || ""}
                className="form-select form-select-sm"
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

            <div className="col-6 col-md-4">
              <label className="form-label small fw-semibold text-dark mb-1">Mobile Number</label>
              <input
                type="text"
                name="mobile"
                defaultValue={searchParams.mobile || ""}
                placeholder="Mobile number"
                className="form-control form-control-sm"
              />
            </div>

            <div className="col-12 col-md-4">
              <label className="form-label small fw-semibold text-dark mb-1">Area / Locality</label>
              <input
                type="text"
                name="area"
                defaultValue={searchParams.area || ""}
                placeholder="Area or locality"
                className="form-control form-control-sm"
              />
            </div>

            {/* Row 3: Demographics & Pathshala */}
            <div className="col-6 col-sm-3 col-md-2">
              <label className="form-label small fw-semibold text-dark mb-1">Min Age</label>
              <input
                type="number"
                name="ageMin"
                defaultValue={searchParams.ageMin || ""}
                min="0"
                max="120"
                placeholder="0"
                className="form-control form-control-sm"
              />
            </div>

            <div className="col-6 col-sm-3 col-md-2">
              <label className="form-label small fw-semibold text-dark mb-1">Max Age</label>
              <input
                type="number"
                name="ageMax"
                defaultValue={searchParams.ageMax || ""}
                min="0"
                max="120"
                placeholder="18"
                className="form-control form-control-sm"
              />
            </div>

            <div className="col-6 col-sm-3 col-md-2">
              <label className="form-label small fw-semibold text-dark mb-1">Gender</label>
              <select
                name="gender"
                defaultValue={searchParams.gender || ""}
                className="form-select form-select-sm"
              >
                <option value="">All</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="col-6 col-sm-3 col-md-2">
              <label className="form-label small fw-semibold text-dark mb-1">Relationship</label>
              <select
                name="relationship"
                defaultValue={searchParams.relationship || ""}
                className="form-select form-select-sm"
              >
                <option value="">All</option>
                <option value="HEAD">Head</option>
                <option value="SPOUSE">Spouse</option>
                <option value="SON">Son</option>
                <option value="DAUGHTER">Daughter</option>
                <option value="FATHER">Father</option>
                <option value="MOTHER">Mother</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="col-12 col-md-4">
              <label className="form-label small fw-semibold text-dark mb-1">Pathshala Status</label>
              <select
                name="pathshalaStatus"
                defaultValue={searchParams.pathshalaStatus || ""}
                className="form-select form-select-sm"
              >
                <option value="">All</option>
                <option value="YES">Attending (YES)</option>
                <option value="NO">Not Attending (NO)</option>
                <option value="PREVIOUSLY_ATTENDED">Previously</option>
                <option value="UNKNOWN">Unknown</option>
              </select>
            </div>

            {/* Row 4: Preferences, Sorting, Interest & Action */}
            <div className="col-12 col-md-4">
              <label className="form-label small fw-semibold text-dark mb-1">
                Field of Interest (रुचि क्षेत्र)
              </label>
              <select
                name="interest"
                defaultValue={searchParams.interest || ""}
                className="form-select form-select-sm"
              >
                <option value="">All Interests (सभी रुचियाँ)</option>
                {MEMBER_INTERESTS.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label} ({item.hindiLabel})
                  </option>
                ))}
              </select>
            </div>

            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold text-dark mb-1">Preferred Day</label>
              <select
                name="preferredDay"
                defaultValue={searchParams.preferredDay || ""}
                className="form-select form-select-sm"
              >
                <option value="">Any</option>
                <option value="SUNDAY">Sunday</option>
                <option value="SATURDAY">Saturday</option>
                <option value="WEEKDAY">Weekday</option>
              </select>
            </div>

            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold text-dark mb-1">Preferred Time</label>
              <select
                name="preferredTime"
                defaultValue={searchParams.preferredTime || ""}
                className="form-select form-select-sm"
              >
                <option value="">Any</option>
                <option value="MORNING">Morning</option>
                <option value="AFTERNOON">Afternoon</option>
                <option value="EVENING">Evening</option>
              </select>
            </div>

            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold text-dark mb-1">Sort By</label>
              <select
                name="sortBy"
                defaultValue={sortBy}
                className="form-select form-select-sm"
              >
                <option value="createdAt">Registration Date</option>
                <option value="memberId">Member ID</option>
                <option value="name">Name</option>
                <option value="age">Age</option>
              </select>
            </div>

            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold text-dark mb-1">Sort Direction</label>
              <select
                name="sortOrder"
                defaultValue={sortOrder}
                className="form-select form-select-sm"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2 mt-3 pt-2 border-top">
            <Link href="/search" className="btn btn-outline-secondary btn-sm px-3">
              Clear All Filters
            </Link>
            <button type="submit" className="btn btn-jain-primary btn-sm px-4">
              <i className="bi bi-search me-1"></i> Apply Combinable Filters
            </button>
          </div>
        </form>
      </div>

      {/* Results Count & Banner */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <span className="fw-semibold text-dark">
          Search Results: <span className="badge bg-primary fs-6">{totalCount}</span> matching records
        </span>
        {isPotentialPreset && (
          <span className="badge bg-warning text-dark border px-3 py-1">
            <i className="bi bi-filter-circle-fill me-1"></i> Filter: Pathshala Potential (&lt;18 and Status=NO)
          </span>
        )}
      </div>

      {/* Results Display */}
      {members.length === 0 ? (
        <div className="card-clean text-center py-5">
          <i className="bi bi-search text-muted display-4 d-block mb-3"></i>
          <h5 className="fw-bold text-dark mb-1">No matching members found</h5>
          <p className="text-muted small mb-0">Adjust or broaden your search criteria above.</p>
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
                    <th>Family ID</th>
                    <th>Head of Family</th>
                    <th>Sangh</th>
                    <th>Area</th>
                    <th>Mobile</th>
                    <th>Pathshala Status</th>
                    <th>Schedule</th>
                    <th>Interests (रुचि)</th>
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
                          {isChild && <span className="badge bg-warning text-dark ms-1">Child</span>}
                        </td>
                        <td>
                          <span className="fw-semibold">{calculatedAge} yrs</span>
                          {dobString && (
                            <div className="small text-muted font-monospace">{dobString}</div>
                          )}
                        </td>
                        <td>
                          <Link href={`/families/${m.familyId}`} className="font-monospace text-decoration-none">
                            {m.family.familyId}
                          </Link>
                        </td>
                        <td>{m.family.headName}</td>
                        <td>
                          <span className="badge-sangh font-monospace">{m.sangh.prefix}</span>
                        </td>
                        <td>{m.family.area}</td>
                        <td>
                          <a href={`tel:${m.family.mobile}`} className="text-decoration-none text-secondary">
                            {m.family.mobile}
                          </a>
                        </td>
                        <td><StatusBadge type="pathshala" value={m.pathshalaStatus} /></td>
                        <td className="small text-muted">
                          {m.preferredDay !== "NO_PREFERENCE" ? `${m.preferredDay}, ${m.preferredTime}` : "—"}
                        </td>
                        <td>
                          {m.interests && m.interests.length > 0 ? (
                            <div className="d-flex flex-wrap gap-1" style={{ maxWidth: "220px" }}>
                              {m.interests.map((k: string) => {
                                const opt = MEMBER_INTERESTS.find((i) => i.key === k);
                                return (
                                  <span key={k} className="badge bg-primary-subtle text-primary border border-primary-subtle" style={{ fontSize: "0.72rem" }}>
                                    {opt ? opt.label : k}
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
                    <div>Head: {m.family.headName} • <Link href={`/families/${m.familyId}`} className="font-monospace text-decoration-none">{m.family.familyId}</Link></div>
                    <div>Area: {m.family.area} • Mobile: <a href={`tel:${m.family.mobile}`}>{m.family.mobile}</a></div>
                    <div>
                      Age: {calculatedAge} yrs {dobString && `(DOB: ${dobString})`} {calculatedAge < 18 ? "(Child)" : ""} • Rel: {m.relationship}
                    </div>
                  </div>

                  {m.interests && m.interests.length > 0 && (
                    <div className="mt-2 pt-2 border-top">
                      <small className="text-muted fw-semibold d-block mb-1">Interests (रुचि):</small>
                      <div className="d-flex flex-wrap gap-1">
                        {m.interests.map((k: string) => {
                          const opt = MEMBER_INTERESTS.find((i) => i.key === k);
                          return (
                            <span key={k} className="badge bg-primary-subtle text-primary border border-primary-subtle" style={{ fontSize: "0.72rem" }}>
                              {opt ? opt.label : k}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                    <StatusBadge type="pathshala" value={m.pathshalaStatus} />
                    <Link href={`/members/${m.id}`} className="btn btn-outline-primary btn-sm">
                      View
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
                Page {page} of {totalPages} ({totalCount} total results)
              </span>
              <div className="btn-group">
                {page > 1 ? (
                  <Link
                    href={`/search?page=${page - 1}&sortBy=${sortBy}&sortOrder=${sortOrder}&${new URLSearchParams(searchParams as any).toString()}`}
                    className="btn btn-outline-secondary btn-sm"
                  >
                    Previous
                  </Link>
                ) : null}
                {page < totalPages ? (
                  <Link
                    href={`/search?page=${page + 1}&sortBy=${sortBy}&sortOrder=${sortOrder}&${new URLSearchParams(searchParams as any).toString()}`}
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
