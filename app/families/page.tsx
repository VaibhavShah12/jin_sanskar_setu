import { requireAuth, getSanghAccessFilter } from "@/lib/auth/auth-helpers";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import React from "react";

export const dynamic = "force-dynamic";

interface FamiliesPageProps {
  searchParams: {
    page?: string;
    q?: string;
    sanghId?: string;
  };
}

export default async function FamiliesPage({ searchParams }: FamiliesPageProps) {
  const user = await requireAuth();

  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const pageSize = 15;
  const q = searchParams.q?.trim() || "";
  const requestedSanghId = searchParams.sanghId || undefined;

  const sanghFilter = getSanghAccessFilter(user, requestedSanghId);

  // Search filter matching familyId, headName, or mobile
  const searchFilter = q
    ? {
        OR: [
          { familyId: { contains: q, mode: "insensitive" as const } },
          { headName: { contains: q, mode: "insensitive" as const } },
          { mobile: { contains: q } },
          { area: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const whereClause = {
    status: "ACTIVE" as const,
    ...sanghFilter,
    ...searchFilter,
  };

  const [families, totalCount, sanghs] = await Promise.all([
    prisma.family.findMany({
      where: whereClause,
      include: {
        sangh: true,
        members: { where: { status: "ACTIVE" } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.family.count({ where: whereClause }),
    prisma.sangh.findMany({
      where: user.role === "TRUSTEE" && user.sanghId ? { id: user.sanghId, active: true } : { active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="container py-2 py-md-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h1 className="h3 fw-bold text-dark mb-1">Families Directory</h1>
          <p className="text-muted small mb-0">
            Registered Sangh households • Total active families: {totalCount}
          </p>
        </div>
        {user.role !== "TRUSTEE" && (
          <Link href="/families/new" className="btn btn-jain-primary d-flex align-items-center gap-2 px-3 shadow-sm">
            <i className="bi bi-person-plus-fill"></i>
            <span>Add New Family</span>
          </Link>
        )}
      </div>

      {/* Filter Bar */}
      <div className="card-clean p-3 mb-4 bg-white">
        <form method="GET" action="/families" className="row g-2 align-items-center">
          <div className="col-12 col-md-5">
            <div className="input-group">
              <span className="input-group-text bg-light border-end-0">
                <i className="bi bi-search text-muted"></i>
              </span>
              <input
                type="text"
                name="q"
                defaultValue={q}
                className="form-control border-start-0"
                placeholder="Search by Family ID, Head Name, Mobile, Area..."
              />
            </div>
          </div>

          <div className="col-8 col-md-4">
            <select
              name="sanghId"
              defaultValue={requestedSanghId || ""}
              className="form-select"
              disabled={(user.role === "VOLUNTEER" && !!user.sanghId) || user.role === "TRUSTEE"}
            >
              <option value="">All Permitted Sanghs</option>
              {sanghs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.prefix})
                </option>
              ))}
            </select>
          </div>

          <div className="col-4 col-md-3 d-flex gap-2">
            <button type="submit" className="btn btn-primary w-100">
              Filter
            </button>
            {q || requestedSanghId ? (
              <Link href="/families" className="btn btn-outline-secondary">
                Reset
              </Link>
            ) : null}
          </div>
        </form>
      </div>

      {/* Content Table / Cards */}
      {families.length === 0 ? (
        <div className="card-clean text-center py-5">
          <i className="bi bi-inbox text-muted display-4 d-block mb-3"></i>
          <h5 className="fw-bold text-dark mb-1">No families found</h5>
          <p className="text-muted small mb-3">
            {q ? "No family matched your search query." : "No families have been registered for this filter yet."}
          </p>
          <Link href="/families/new" className="btn btn-jain-primary btn-sm px-4">
            <i className="bi bi-plus-lg me-1"></i> Register New Family
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="card-clean p-0 overflow-hidden shadow-sm d-none d-lg-block mb-4">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="ps-4">Family ID</th>
                    <th>Head of Family</th>
                    <th>Mobile</th>
                    <th>Sangh</th>
                    <th>Area / Locality</th>
                    <th className="text-center">Members</th>
                    <th>Registered</th>
                    <th className="text-end pe-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {families.map((f) => (
                    <tr key={f.id}>
                      <td className="ps-4">
                        <Link href={`/families/${f.id}`} className="font-monospace fw-bold text-primary text-decoration-none">
                          {f.familyId}
                        </Link>
                      </td>
                      <td className="fw-semibold text-dark">{f.headName}</td>
                      <td>
                        <a href={`tel:${f.mobile}`} className="text-decoration-none text-secondary">
                          <i className="bi bi-telephone me-1 text-muted"></i>
                          {f.mobile}
                        </a>
                      </td>
                      <td>
                        <span className="badge-sangh font-monospace">{f.sangh.prefix}</span>
                        <small className="text-muted ms-1 d-block fs-8">{f.sangh.name}</small>
                      </td>
                      <td>{f.area}</td>
                      <td className="text-center">
                        <span className="badge bg-light text-dark border px-2 py-1">
                          {f.members.length}
                        </span>
                      </td>
                      <td className="text-muted small">
                        {new Date(f.createdAt).toLocaleDateString()}
                      </td>
                      <td className="text-end pe-4">
                        <Link href={`/families/${f.id}`} className="btn btn-outline-primary btn-sm px-3">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards View */}
          <div className="d-lg-none d-flex flex-column gap-3 mb-4">
            {families.map((f) => (
              <div key={f.id} className="card-clean p-3">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <Link href={`/families/${f.id}`} className="font-monospace fw-bold text-primary fs-5 text-decoration-none">
                      {f.familyId}
                    </Link>
                    <h6 className="fw-bold text-dark mb-0 mt-1">{f.headName}</h6>
                  </div>
                  <span className="badge-sangh font-monospace">{f.sangh.prefix}</span>
                </div>

                <div className="small text-secondary mb-3">
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <i className="bi bi-telephone text-muted"></i>
                    <a href={`tel:${f.mobile}`} className="text-decoration-none text-dark">
                      {f.mobile}
                    </a>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <i className="bi bi-geo-alt text-muted"></i>
                    <span>{f.area}</span>
                  </div>
                </div>

                <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                  <span className="small text-muted">
                    <i className="bi bi-people me-1"></i> {f.members.length} members
                  </span>
                  <Link href={`/families/${f.id}`} className="btn btn-jain-primary btn-sm px-3">
                    View Family <i className="bi bi-arrow-right ms-1"></i>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Server-Side Pagination */}
          {totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-3">
              <span className="text-muted small">
                Showing page {page} of {totalPages}
              </span>
              <div className="btn-group">
                {page > 1 ? (
                  <Link
                    href={`/families?page=${page - 1}&q=${encodeURIComponent(q)}&sanghId=${requestedSanghId || ""}`}
                    className="btn btn-outline-secondary btn-sm"
                  >
                    Previous
                  </Link>
                ) : null}
                {page < totalPages ? (
                  <Link
                    href={`/families?page=${page + 1}&q=${encodeURIComponent(q)}&sanghId=${requestedSanghId || ""}`}
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
