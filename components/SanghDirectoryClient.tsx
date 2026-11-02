"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";

export interface DirectoryMember {
  id: string;
  memberId: string;
  name: string;
  age: number;
  gender: string;
  relationship: string;
  occupation: string | null;
  whatsappNumber: string | null;
}

export interface DirectoryFamily {
  id: string;
  familyId: string;
  headName: string;
  mobile: string;
  address: string;
  area: string;
  nativePlace: string | null;
  sangh: {
    id: string;
    name: string;
    prefix: string;
  };
  members: DirectoryMember[];
}

interface SanghOption {
  id: string;
  name: string;
  prefix: string;
}

interface SanghDirectoryClientProps {
  initialFamilies: DirectoryFamily[];
  sanghs: SanghOption[];
  userRole: string;
  userSanghId?: string | null;
}

export default function SanghDirectoryClient({
  initialFamilies,
  sanghs,
  userRole,
  userSanghId,
}: SanghDirectoryClientProps) {
  const [selectedSangh, setSelectedSangh] = useState<string>(
    userRole === "TRUSTEE" && userSanghId ? userSanghId : "ALL"
  );
  const [selectedArea, setSelectedArea] = useState<string>("ALL");
  const [selectedNativePlace, setSelectedNativePlace] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"BOOKLET" | "TABLE">("BOOKLET");
  const [groupBy, setGroupBy] = useState<"NONE" | "AREA" | "NATIVE">("AREA");

  // Distinct Areas
  const uniqueAreas = useMemo(() => {
    const set = new Set<string>();
    initialFamilies.forEach((f) => {
      if (f.area && f.area.trim()) set.add(f.area.trim());
    });
    return Array.from(set).sort();
  }, [initialFamilies]);

  // Distinct Native Places
  const uniqueNativePlaces = useMemo(() => {
    const set = new Set<string>();
    initialFamilies.forEach((f) => {
      if (f.nativePlace && f.nativePlace.trim()) set.add(f.nativePlace.trim());
    });
    return Array.from(set).sort();
  }, [initialFamilies]);

  // Filtered families
  const filteredFamilies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return initialFamilies.filter((f) => {
      // Sangh Filter
      if (selectedSangh !== "ALL" && f.sangh.id !== selectedSangh) {
        return false;
      }
      // Area Filter
      if (selectedArea !== "ALL" && f.area !== selectedArea) {
        return false;
      }
      // Native Place Filter
      if (selectedNativePlace !== "ALL") {
        if (!f.nativePlace || f.nativePlace !== selectedNativePlace) {
          return false;
        }
      }
      // Search Query
      if (query) {
        const matchesHead = f.headName.toLowerCase().includes(query);
        const matchesId = f.familyId.toLowerCase().includes(query);
        const matchesMobile = f.mobile.includes(query);
        const matchesArea = f.area.toLowerCase().includes(query);
        const matchesAddress = f.address.toLowerCase().includes(query);
        const matchesNative = f.nativePlace ? f.nativePlace.toLowerCase().includes(query) : false;
        const matchesMember = f.members.some(
          (m) =>
            m.name.toLowerCase().includes(query) ||
            m.memberId.toLowerCase().includes(query) ||
            (m.occupation && m.occupation.toLowerCase().includes(query))
        );

        if (!matchesHead && !matchesId && !matchesMobile && !matchesArea && !matchesAddress && !matchesNative && !matchesMember) {
          return false;
        }
      }
      return true;
    });
  }, [initialFamilies, selectedSangh, selectedArea, selectedNativePlace, searchQuery]);

  // Grouped structure
  const groupedData = useMemo(() => {
    if (groupBy === "NONE") {
      return [{ groupTitle: "All Families", families: filteredFamilies }];
    }

    const groups: { [key: string]: DirectoryFamily[] } = {};

    filteredFamilies.forEach((f) => {
      let key = "Other";
      if (groupBy === "AREA") {
        key = f.area ? f.area.trim() : "Unspecified Area";
      } else if (groupBy === "NATIVE") {
        key = f.nativePlace ? f.nativePlace.trim() : "Unspecified Native Place";
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    });

    return Object.keys(groups)
      .sort()
      .map((k) => ({
        groupTitle: k,
        families: groups[k],
      }));
  }, [filteredFamilies, groupBy]);

  // Total Member Count
  const totalMemberCount = useMemo(() => {
    return filteredFamilies.reduce((sum, f) => sum + f.members.length, 0);
  }, [filteredFamilies]);

  // Trigger browser print
  const handlePrint = () => {
    window.print();
  };

  // CSV Export with UTF-8 BOM
  const handleExportCSV = () => {
    const headers = [
      "Family ID",
      "Sangh",
      "Head of Family",
      "Mobile",
      "Native Village / Mul Gaam",
      "Area / Locality",
      "Residential Address",
      "Total Members",
      "Member Details (Name [Relation, Age, Occupation])",
    ];

    const rows = filteredFamilies.map((f) => {
      const memberRoster = f.members
        .map((m) => `${m.name} (${m.relationship}, ${m.age}y${m.occupation ? `, ${m.occupation}` : ""})`)
        .join("; ");

      return [
        `"${f.familyId}"`,
        `"${f.sangh.name}"`,
        `"${f.headName}"`,
        `"${f.mobile}"`,
        `"${f.nativePlace || ""}"`,
        `"${f.area}"`,
        `"${f.address.replace(/"/g, '""')}"`,
        f.members.length,
        `"${memberRoster.replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Sangh_Directory_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      {/* Print Specific CSS */}
      <style jsx global>{`
        @media print {
          /* Hide non-printable elements */
          nav,
          header,
          footer,
          .no-print,
          .btn,
          .btn-group,
          .navbar,
          input,
          select {
            display: none !important;
          }

          body {
            background-color: #ffffff !important;
            font-size: 11pt !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .container,
          .container-fluid {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .print-header {
            display: block !important;
            text-align: center;
            border-bottom: 2px solid #b45309;
            padding-bottom: 8px;
            margin-bottom: 16px;
          }

          .directory-card {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            border: 1px solid #999 !important;
            margin-bottom: 12px !important;
            box-shadow: none !important;
            background: #fff !important;
          }

          .badge {
            border: 1px solid #777 !important;
            color: #000 !important;
            background: transparent !important;
          }
        }

        .print-header {
          display: none;
        }
      `}</style>

      {/* Screen & Print Container */}
      <div className="container py-2 py-md-4">
        {/* Printable Official Header */}
        <div className="print-header">
          <div className="text-secondary small fw-bold">॥ ॐ नमः श्री जिनेश्वराय ॥ श्री जिन शासन जयवंत वर्ते ॥</div>
          <h2 className="fw-bold mb-1" style={{ color: "#b45309" }}>जिन संस्कार सेतु — संघ परिवार निर्देशिका</h2>
          <div className="small text-muted">
            {selectedSangh !== "ALL"
              ? sanghs.find((s) => s.id === selectedSangh)?.name
              : "समस्त संघ निर्देशिका (Combined Sanghs)"}{" "}
            • Total {filteredFamilies.length} Households • {totalMemberCount} Individuals
          </div>
          <div className="small text-muted font-monospace mt-1">
            Generated on: {new Date().toLocaleDateString("en-IN", { dateStyle: "full" })}
          </div>
        </div>

        {/* Top Controls (Screen Only) */}
        <div className="no-print">
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1">
                  <i className="bi bi-book-half me-1"></i> Community Directory
                </span>
                <span className="badge bg-light text-secondary border font-monospace">
                  {filteredFamilies.length} Families • {totalMemberCount} Members
                </span>
              </div>
              <h1 className="h3 fw-bold text-dark mb-1">Printable Sangh Directory (संघ परिवार निर्देशिका)</h1>
              <p className="text-muted small mb-0">
                Filter by Sangh, Area, or Native Village (*Mul Gaam*). Export to CSV or generate clean printable booklets.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="d-flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExportCSV}
                className="btn btn-outline-success btn-sm px-3 shadow-sm d-flex align-items-center gap-1"
                title="Download currently filtered directory as an Excel-friendly CSV"
              >
                <i className="bi bi-file-earmark-excel-fill"></i>
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="btn btn-jain-primary btn-sm px-4 shadow-sm d-flex align-items-center gap-2"
                title="Print directory or save as official PDF booklet"
              >
                <i className="bi bi-printer-fill fs-6"></i>
                <span className="fw-semibold">Print Directory / PDF</span>
              </button>
            </div>
          </div>

          {/* Filter Bar Card */}
          <div className="card-clean p-3 mb-4 shadow-sm">
            <div className="row g-2 align-items-center">
              {/* Search input */}
              <div className="col-12 col-md-4">
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-light text-muted border-end-0">
                    <i className="bi bi-search"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control border-start-0"
                    placeholder="Search name, mobile, village, address..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      className="btn btn-outline-secondary border-start-0"
                      type="button"
                      onClick={() => setSearchQuery("")}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Sangh Selector (if not locked to single) */}
              {userRole !== "TRUSTEE" && (
                <div className="col-6 col-md-2">
                  <select
                    className="form-select form-select-sm"
                    value={selectedSangh}
                    onChange={(e) => setSelectedSangh(e.target.value)}
                  >
                    <option value="ALL">All Sanghs</option>
                    {sanghs.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.prefix} - {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Area Selector */}
              <div className="col-6 col-md-2">
                <select
                  className="form-select form-select-sm"
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value)}
                >
                  <option value="ALL">All Areas ({uniqueAreas.length})</option>
                  {uniqueAreas.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              {/* Native Village Selector */}
              <div className="col-6 col-md-2">
                <select
                  className="form-select form-select-sm"
                  value={selectedNativePlace}
                  onChange={(e) => setSelectedNativePlace(e.target.value)}
                >
                  <option value="ALL">All Native Villages ({uniqueNativePlaces.length})</option>
                  {uniqueNativePlaces.map((np) => (
                    <option key={np} value={np}>
                      {np}
                    </option>
                  ))}
                </select>
              </div>

              {/* Group By selector */}
              <div className="col-6 col-md-2">
                <select
                  className="form-select form-select-sm bg-light"
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as any)}
                >
                  <option value="AREA">Group by Area</option>
                  <option value="NATIVE">Group by Mul Gaam</option>
                  <option value="NONE">No Grouping (Flat)</option>
                </select>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
              <span className="text-muted small">
                Showing <strong>{filteredFamilies.length}</strong> households (
                {totalMemberCount} members)
              </span>

              <div className="btn-group btn-group-sm">
                <button
                  type="button"
                  className={`btn ${viewMode === "BOOKLET" ? "btn-secondary text-white fw-semibold" : "btn-outline-secondary"}`}
                  onClick={() => setViewMode("BOOKLET")}
                >
                  <i className="bi bi-grid-fill me-1"></i> Booklet Cards
                </button>
                <button
                  type="button"
                  className={`btn ${viewMode === "TABLE" ? "btn-secondary text-white fw-semibold" : "btn-outline-secondary"}`}
                  onClick={() => setViewMode("TABLE")}
                >
                  <i className="bi bi-table me-1"></i> Compact Table
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Directory Content */}
        {filteredFamilies.length === 0 ? (
          <div className="card-clean p-5 text-center text-muted">
            <i className="bi bi-search fs-1 d-block mb-2 text-secondary"></i>
            <h5>No family records match your filters</h5>
            <p className="small mb-0">Try clearing filters or search keywords to view the directory.</p>
          </div>
        ) : (
          <div>
            {groupedData.map((group, gIdx) => (
              <div key={gIdx} className="mb-4">
                {groupBy !== "NONE" && (
                  <div className="d-flex align-items-center gap-2 mb-3 pb-2 border-bottom border-2 border-primary border-opacity-50">
                    <h5 className="fw-bold text-dark mb-0">
                      <i className={`bi ${groupBy === "AREA" ? "bi-geo-alt-fill text-danger" : "bi-house-door-fill text-primary"} me-2`}></i>
                      {group.groupTitle}
                    </h5>
                    <span className="badge bg-secondary-subtle text-secondary border">
                      {group.families.length} Families
                    </span>
                  </div>
                )}

                {/* View 1: Booklet Cards */}
                {viewMode === "BOOKLET" ? (
                  <div className="row g-3">
                    {group.families.map((fam) => (
                      <div key={fam.id} className="col-12 col-md-6 col-lg-6">
                        <div className="card-clean directory-card p-3 h-100 shadow-sm border">
                          {/* Card Header */}
                          <div className="d-flex justify-content-between align-items-start mb-2 pb-2 border-bottom">
                            <div>
                              <div className="d-flex align-items-center gap-2">
                                <Link
                                  href={`/families/${fam.id}`}
                                  className="fw-bold text-dark fs-6 text-decoration-none hover-primary"
                                >
                                  {fam.headName}
                                </Link>
                                <span className="badge bg-secondary-subtle text-secondary small">Head</span>
                              </div>
                              <span className="font-monospace small text-primary fw-bold me-2">
                                {fam.familyId}
                              </span>
                              <span className="badge bg-light text-secondary border font-monospace small">
                                {fam.sangh.prefix}
                              </span>
                            </div>

                            <div className="text-end">
                              <a
                                href={`tel:${fam.mobile}`}
                                className="text-decoration-none font-monospace fw-bold text-dark small d-block"
                              >
                                <i className="bi bi-telephone-fill text-success me-1"></i>
                                {fam.mobile}
                              </a>
                              {fam.nativePlace && (
                                <span className="badge bg-primary-subtle text-primary border border-primary-subtle small mt-1">
                                  <i className="bi bi-house-door me-1"></i>
                                  {fam.nativePlace}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Address & Area */}
                          <div className="small text-muted mb-2">
                            <span className="text-dark fw-semibold me-1">
                              <i className="bi bi-geo-alt me-1 text-danger"></i>
                              {fam.area}:
                            </span>
                            {fam.address}
                          </div>

                          {/* Members List */}
                          <div className="bg-light p-2 rounded border small">
                            <div className="d-flex justify-content-between text-muted fs-8 mb-1 border-bottom pb-1">
                              <span>Family Members ({fam.members.length})</span>
                              <span>Age • Occupation</span>
                            </div>
                            <div className="d-flex flex-column gap-1">
                              {fam.members.map((m) => (
                                <div key={m.id} className="d-flex justify-content-between align-items-center">
                                  <span className="fw-medium text-dark">
                                    {m.name}{" "}
                                    <span className="text-muted fs-8">({m.relationship})</span>
                                  </span>
                                  <span className="text-end">
                                    <span className="text-secondary me-2">{m.age}y</span>
                                    {m.occupation && (
                                      <span className="badge bg-white text-secondary border fs-8">
                                        {m.occupation}
                                      </span>
                                    )}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* View 2: Compact Master Table */
                  <div className="card-clean p-0 overflow-hidden shadow-sm border mb-3">
                    <div className="table-responsive">
                      <table className="table table-sm table-hover align-middle mb-0">
                        <thead className="table-light small">
                          <tr>
                            <th>Family ID</th>
                            <th>Head Name</th>
                            <th>Mobile</th>
                            <th>Native Village</th>
                            <th>Area</th>
                            <th>Address</th>
                            <th>Members Roster</th>
                          </tr>
                        </thead>
                        <tbody className="small">
                          {group.families.map((fam) => (
                            <tr key={fam.id}>
                              <td className="font-monospace fw-bold text-primary">
                                <Link href={`/families/${fam.id}`} className="text-decoration-none">
                                  {fam.familyId}
                                </Link>
                              </td>
                              <td className="fw-semibold text-dark">{fam.headName}</td>
                              <td className="font-monospace">
                                <a href={`tel:${fam.mobile}`} className="text-decoration-none text-dark">
                                  {fam.mobile}
                                </a>
                              </td>
                              <td>
                                {fam.nativePlace ? (
                                  <span className="badge bg-light text-primary border">
                                    {fam.nativePlace}
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="fw-medium text-dark">{fam.area}</td>
                              <td className="text-muted" style={{ maxWidth: 220 }}>
                                <div className="text-truncate" title={fam.address}>
                                  {fam.address}
                                </div>
                              </td>
                              <td>
                                <div className="d-flex flex-wrap gap-1">
                                  {fam.members.map((m) => (
                                    <span
                                      key={m.id}
                                      className="badge bg-light text-dark border"
                                      title={`${m.name} (${m.relationship}, ${m.age} yrs${m.occupation ? ` - ${m.occupation}` : ""})`}
                                    >
                                      {m.name} ({m.age}y)
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
