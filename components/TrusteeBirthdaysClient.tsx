"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  TrusteeDashboardData,
  BirthdayRecipientView,
} from "@/lib/actions/birthday-actions";

interface Props {
  initialData: TrusteeDashboardData;
  userRole: "ADMIN" | "TRUSTEE" | "VOLUNTEER";
  allSanghs?: { id: string; name: string; prefix: string }[];
  currentSanghId: string;
}

export default function TrusteeBirthdaysClient({
  initialData,
  userRole,
  allSanghs,
  currentSanghId,
}: Props) {
  const router = useRouter();
  const [data] = useState<TrusteeDashboardData>(initialData);
  const [activeTab, setActiveTab] = useState<"today" | "upcoming">("today");

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  const handleSanghChange = (newSanghId: string) => {
    if (newSanghId === currentSanghId) return;
    router.push(`/birthdays?sanghId=${newSanghId}`);
  };

  const filterRecipients = (list: BirthdayRecipientView[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.memberId.toLowerCase().includes(q) ||
        r.familyId.toLowerCase().includes(q)
    );
  };

  const filteredToday = filterRecipients(data.todayRecipients);
  const filteredUpcoming = filterRecipients(data.upcomingRecipients);

  return (
    <div className="container-fluid px-3 px-lg-4 py-4">
      {/* Top Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="badge bg-primary-subtle text-primary border border-primary-subtle fs-7 px-2 py-1">
              <i className="bi bi-shield-check me-1"></i>
              {data.sanghName} ({data.sanghPrefix})
            </span>
            {userRole === "ADMIN" && (
              <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle fs-7">
                Admin View
              </span>
            )}
          </div>
          <h1 className="h3 fw-bold text-dark mb-0">
            <i className="bi bi-cake2-fill text-danger me-2"></i>
            Sangh Birthday Greetings (जन्मदिवस शुभकामनाएँ)
          </h1>
          <p className="text-muted small mb-0 mt-1">
            View eligible family heads and upcoming birthdays for <strong>{data.sanghName}</strong>.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          {/* Admin Sangh Selector */}
          {userRole === "ADMIN" && allSanghs && allSanghs.length > 0 && (
            <div className="d-flex align-items-center gap-2">
              <label htmlFor="sangh-filter-select" className="small fw-semibold text-muted text-nowrap">
                Select Sangh:
              </label>
              <select
                id="sangh-filter-select"
                className="form-select form-select-sm"
                value={currentSanghId}
                onChange={(e) => handleSanghChange(e.target.value)}
              >
                {allSanghs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.prefix})
                  </option>
                ))}
              </select>
            </div>
          )}

          <Link href="/dashboard" className="btn btn-outline-secondary btn-sm">
            <i className="bi bi-speedometer2 me-1"></i> Dashboard
          </Link>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="row g-3 mb-4">
        {/* Today's Birthdays */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card-clean p-3 shadow-sm border-start border-danger border-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <span className="text-muted small fw-semibold text-uppercase">Today's Birthdays</span>
              <div className="rounded-circle bg-danger-subtle p-2 text-danger">
                <i className="bi bi-cake2-fill fs-5"></i>
              </div>
            </div>
            <div className="d-flex align-items-baseline gap-2">
              <h2 className="display-6 fw-bold text-dark mb-0">{data.todayCount}</h2>
              <span className="text-muted small">family heads</span>
            </div>
            <div className="mt-2 small text-muted">
              Celebrating today in Asia/Kolkata
            </div>
          </div>
        </div>

        {/* Upcoming in 30 Days */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card-clean p-3 shadow-sm border-start border-primary border-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <span className="text-muted small fw-semibold text-uppercase">Upcoming (30 Days)</span>
              <div className="rounded-circle bg-primary-subtle p-2 text-primary">
                <i className="bi bi-calendar-event-fill fs-5"></i>
              </div>
            </div>
            <div className="d-flex align-items-baseline gap-2">
              <h2 className="display-6 fw-bold text-dark mb-0">{data.upcomingCount}</h2>
              <span className="text-muted small">family heads</span>
            </div>
            <div className="mt-2 small text-muted">
              Next 30 calendar days
            </div>
          </div>
        </div>

        {/* Total Registered Heads */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card-clean p-3 shadow-sm border-start border-success border-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <span className="text-muted small fw-semibold text-uppercase">Sangh Community</span>
              <div className="rounded-circle bg-success-subtle p-2 text-success">
                <i className="bi bi-people-fill fs-5"></i>
              </div>
            </div>
            <div className="d-flex align-items-baseline gap-2">
              <h2 className="display-6 fw-bold text-dark mb-0">{data.sanghPrefix}</h2>
              <span className="text-muted small">{data.sanghName}</span>
            </div>
            <div className="mt-2 small text-muted">
              Active census jurisdiction
            </div>
          </div>
        </div>

        {/* Community Greetings */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card-clean p-3 shadow-sm border-start border-info border-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <span className="text-muted small fw-semibold text-uppercase">Personal Greetings</span>
              <div className="rounded-circle bg-info-subtle p-2 text-info-emphasis">
                <i className="bi bi-heart-fill fs-5 text-danger"></i>
              </div>
            </div>
            <div className="d-flex align-items-baseline gap-2">
              <h2 className="display-6 fw-bold text-dark mb-0">Active</h2>
              <span className="text-muted small">Direct Sangh outreach</span>
            </div>
            <div className="mt-2 small text-muted">
              Personalized community wishes
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Search Navigation */}
      <div className="card-clean shadow-sm p-3 mb-4">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-stretch align-items-md-center gap-3">
          {/* Navigation Tabs */}
          <ul className="nav nav-pills gap-1">
            <li className="nav-item">
              <button
                className={`nav-link py-2 px-3 fw-semibold ${activeTab === "today" ? "active bg-danger text-white" : "text-dark"}`}
                onClick={() => setActiveTab("today")}
              >
                <i className="bi bi-cake2-fill me-1"></i> Today's Birthdays
                <span className={`badge ms-2 ${activeTab === "today" ? "bg-white text-danger" : "bg-danger text-white"}`}>
                  {data.todayCount}
                </span>
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link py-2 px-3 fw-semibold ${activeTab === "upcoming" ? "active" : "text-dark"}`}
                onClick={() => setActiveTab("upcoming")}
              >
                <i className="bi bi-calendar3 me-1"></i> Upcoming (30 Days)
                <span className={`badge ms-2 ${activeTab === "upcoming" ? "bg-white text-primary" : "bg-light text-dark border"}`}>
                  {data.upcomingCount}
                </span>
              </button>
            </li>
          </ul>

          {/* Search Box */}
          <div className="position-relative" style={{ minWidth: "240px" }}>
            <i className="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"></i>
            <input
              type="text"
              className="form-control form-control-sm ps-5"
              placeholder="Search name, member ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* TAB 1: TODAY'S BIRTHDAYS */}
      {activeTab === "today" && (
        <div className="card-clean shadow-sm p-3 p-md-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="fw-bold text-dark mb-0">
              <i className="bi bi-star-fill text-warning me-2"></i>
              Today's Birthday Celebrations ({filteredToday.length})
            </h5>
            <small className="text-muted">Celebrated today in Asia/Kolkata timezone</small>
          </div>

          {filteredToday.length === 0 ? (
            <div className="text-center py-5">
              <div className="rounded-circle bg-light d-inline-flex p-4 text-muted mb-3">
                <i className="bi bi-cake2 fs-1"></i>
              </div>
              <h6 className="text-dark fw-bold">No Birthdays Today</h6>
              <p className="text-muted small mb-0">
                {searchQuery
                  ? "No family heads matched your search filter."
                  : `There are no registered family heads with birthdays today in ${data.sanghName}.`}
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Family Head &amp; ID</th>
                    <th>Contact Phone</th>
                    <th>Date of Birth / Age</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredToday.map((r) => (
                    <tr key={r.memberId}>
                      <td>
                        <div className="fw-bold text-dark">{r.name}</div>
                        <div className="small text-muted font-monospace">
                          <span className="badge-sangh me-1">{r.memberId}</span>
                          <span>(Family: {r.familyId})</span>
                        </div>
                      </td>
                      <td>
                        <span className="font-monospace text-dark fw-semibold">{r.maskedPhone}</span>
                        {!r.hasValidPhone && (
                          <div className="text-danger small">
                            <i className="bi bi-exclamation-circle me-1"></i> Invalid phone
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="fw-medium text-dark">{r.dateOfBirthStr}</div>
                        <div className="small text-muted">{r.age} years completed</div>
                      </td>
                      <td className="text-end">
                        <Link
                          href={`/families/${r.familyId}`}
                          className="btn btn-outline-primary btn-sm"
                        >
                          <i className="bi bi-eye me-1"></i> View Family
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: UPCOMING 30 DAYS */}
      {activeTab === "upcoming" && (
        <div className="card-clean shadow-sm p-3 p-md-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="fw-bold text-dark mb-0">
              <i className="bi bi-calendar-event me-2 text-primary"></i>
              Upcoming Family Head Birthdays ({filteredUpcoming.length})
            </h5>
            <small className="text-muted">Next 30 calendar days</small>
          </div>

          {filteredUpcoming.length === 0 ? (
            <div className="text-center py-5">
              <div className="rounded-circle bg-light d-inline-flex p-4 text-muted mb-3">
                <i className="bi bi-calendar-check fs-1"></i>
              </div>
              <h6 className="text-dark fw-bold">No Upcoming Birthdays</h6>
              <p className="text-muted small mb-0">
                No family head birthdays recorded in the next 30 days for this Sangh.
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Days Left</th>
                    <th>Family Head &amp; ID</th>
                    <th>Contact Phone</th>
                    <th>Birth Date</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUpcoming.map((r) => (
                    <tr key={r.memberId}>
                      <td>
                        <span className={`badge ${r.daysUntil <= 3 ? "bg-warning text-dark" : "bg-light text-dark border"}`}>
                          in {r.daysUntil} {r.daysUntil === 1 ? "day" : "days"}
                        </span>
                      </td>
                      <td>
                        <div className="fw-bold text-dark">{r.name}</div>
                        <div className="small text-muted font-monospace">
                          <span className="badge-sangh me-1">{r.memberId}</span>
                          <span>(Family: {r.familyId})</span>
                        </div>
                      </td>
                      <td>
                        <span className="font-monospace text-dark fw-semibold">{r.maskedPhone}</span>
                        {!r.hasValidPhone && (
                          <div className="text-danger small">
                            <i className="bi bi-exclamation-circle me-1"></i> Invalid phone
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="fw-medium text-dark">{r.dateOfBirthStr}</div>
                        <div className="small text-muted">Turning {r.age + 1} yrs</div>
                      </td>
                      <td className="text-end">
                        <Link
                          href={`/families/${r.familyId}`}
                          className="btn btn-outline-primary btn-sm"
                        >
                          <i className="bi bi-eye me-1"></i> View Family
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
