"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  INTEREST_CATEGORIES,
  MEMBER_INTERESTS,
  getInterestLabel,
  InterestCategory,
} from "@/lib/constants/interests";

export interface SevaMember {
  id: string;
  memberId: string;
  name: string;
  age: number;
  gender: string;
  relationship: string;
  maritalStatus?: string | null;
  whatsappNumber?: string | null;
  interests: string[];
  family: {
    id: string;
    familyId: string;
    headName: string;
    mobile: string;
    area: string;
    address: string;
  };
  sangh: {
    id: string;
    name: string;
    prefix: string;
  };
}

interface SanghOption {
  id: string;
  name: string;
  prefix: string;
}

interface SevaDirectoryClientProps {
  initialMembers: SevaMember[];
  sanghs: SanghOption[];
  userRole: string;
  userSanghId?: string | null;
}

export default function SevaDirectoryClient({
  initialMembers,
  sanghs,
  userRole,
  userSanghId,
}: SevaDirectoryClientProps) {
  // Filter States
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedSeva, setSelectedSeva] = useState<string>("ALL");
  const [selectedSanghId, setSelectedSanghId] = useState<string>(
    userSanghId || "ALL"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArea, setSelectedArea] = useState<string>("ALL");
  const [copied, setCopied] = useState(false);

  // Available options based on selected category
  const availableSevaOptions = useMemo(() => {
    if (selectedCategory === "ALL") {
      return MEMBER_INTERESTS;
    }
    const cat = INTEREST_CATEGORIES.find((c) => c.id === selectedCategory);
    return cat ? cat.options : MEMBER_INTERESTS;
  }, [selectedCategory]);

  // Extract unique areas from loaded members
  const uniqueAreas = useMemo(() => {
    const set = new Set<string>();
    initialMembers.forEach((m) => {
      if (m.family.area) set.add(m.family.area.trim());
    });
    return Array.from(set).sort();
  }, [initialMembers]);

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return initialMembers.filter((m) => {
      // Sangh filter
      if (selectedSanghId !== "ALL" && m.sangh.id !== selectedSanghId) {
        return false;
      }

      // Category / Seva filter
      if (selectedSeva !== "ALL") {
        if (!m.interests.includes(selectedSeva)) return false;
      } else if (selectedCategory !== "ALL") {
        const cat = INTEREST_CATEGORIES.find((c) => c.id === selectedCategory);
        if (cat) {
          const catKeys = new Set(cat.options.map((o) => o.key));
          const hasAny = m.interests.some((k) => catKeys.has(k));
          if (!hasAny) return false;
        }
      }

      // Area filter
      if (selectedArea !== "ALL" && m.family.area !== selectedArea) {
        return false;
      }

      // Search Query (Name, Phone, MemberID, Head Name)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const effectivePhone = (m.whatsappNumber || m.family.mobile || "").toLowerCase();
        const matchName = m.name.toLowerCase().includes(q);
        const matchMemberId = m.memberId.toLowerCase().includes(q);
        const matchHead = m.family.headName.toLowerCase().includes(q);
        const matchPhone = effectivePhone.includes(q);
        const matchArea = m.family.area.toLowerCase().includes(q);

        if (!matchName && !matchMemberId && !matchHead && !matchPhone && !matchArea) {
          return false;
        }
      }

      return true;
    });
  }, [
    initialMembers,
    selectedSanghId,
    selectedCategory,
    selectedSeva,
    selectedArea,
    searchQuery,
  ]);

  // Extract phone numbers for WhatsApp Broadcast / Copy
  const phoneNumbersList = useMemo(() => {
    const list: string[] = [];
    filteredMembers.forEach((m) => {
      const raw = m.whatsappNumber || m.family.mobile;
      if (raw) {
        const clean = raw.replace(/[^0-9]/g, "");
        if (clean.length >= 10 && !list.includes(clean)) {
          list.push(clean);
        }
      }
    });
    return list;
  }, [filteredMembers]);

  // Handle Copy All Phone Numbers
  const handleCopyNumbers = () => {
    if (phoneNumbersList.length === 0) return;
    const text = phoneNumbersList.join(", ");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  // Handle Export CSV
  const handleExportCSV = () => {
    if (filteredMembers.length === 0) return;

    const headers = [
      "Member ID",
      "Member Name",
      "Age",
      "Gender",
      "Relationship",
      "Marital Status",
      "Contact Phone",
      "Head of Family",
      "Family ID",
      "Sangh",
      "Area",
      "Address",
      "Interests",
    ];

    const rows = filteredMembers.map((m) => {
      const phone = m.whatsappNumber || m.family.mobile || "";
      const interestsStr = m.interests.map((k) => getInterestLabel(k)).join("; ");

      return [
        `"${m.memberId}"`,
        `"${m.name}"`,
        m.age,
        `"${m.gender}"`,
        `"${m.relationship}"`,
        `"${m.maritalStatus || "UNMARRIED"}"`,
        `"${phone}"`,
        `"${m.family.headName}"`,
        `"${m.family.familyId}"`,
        `"${m.sangh.name}"`,
        `"${m.family.area}"`,
        `"${m.family.address.replace(/"/g, '""')}"`,
        `"${interestsStr.replace(/"/g, '""')}"`,
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Jin_Sanskar_Setu_Seva_Volunteers_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="container-fluid px-3 px-lg-4 py-4">
      {/* Page Header Banner */}
      <div className="card shadow-sm border-0 rounded-4 p-4 mb-4 bg-white border-start border-4 border-primary">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
          <div>
            <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 mb-1">
              <i className="bi bi-people-fill me-1"></i> Seva Coordination Portal
            </span>
            <h1 className="h4 fw-bold text-dark mb-1">
              Seva Directory (सेवा निर्देशिका)
            </h1>
            <p className="text-muted small mb-0">
              Browse, filter, and coordinate community volunteers by their registered field of interest (विहार सेवा, वैयावच्च, व्यवस्था, पाठशाला आदि).
            </p>
          </div>

          {/* Action Buttons: Copy Numbers & Export CSV */}
          <div className="d-flex flex-wrap gap-2">
            <button
              type="button"
              disabled={phoneNumbersList.length === 0}
              onClick={handleCopyNumbers}
              className="btn btn-outline-success btn-sm px-3 d-flex align-items-center gap-1 shadow-xs"
              title="Copy phone numbers for WhatsApp broadcast"
            >
              <i className={`bi ${copied ? "bi-check2-all text-success" : "bi-clipboard"}`}></i>
              <span>{copied ? "Copied Numbers!" : `Copy Numbers (${phoneNumbersList.length})`}</span>
            </button>

            <button
              type="button"
              disabled={filteredMembers.length === 0}
              onClick={handleExportCSV}
              className="btn btn-primary btn-sm px-3 d-flex align-items-center gap-1 shadow-xs"
            >
              <i className="bi bi-file-earmark-spreadsheet me-1"></i>
              <span>Export CSV ({filteredMembers.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* FILTER CONTROLS BAR */}
      <div className="card shadow-sm border-0 rounded-4 p-3 p-md-4 bg-white mb-4">
        {/* Category Filter Tabs */}
        <div className="mb-3">
          <label className="form-label small fw-bold text-uppercase text-muted mb-2">
            Seva Category (सेवा वर्ग)
          </label>
          <div className="d-flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory("ALL");
                setSelectedSeva("ALL");
              }}
              className={`btn btn-sm px-3 rounded-pill transition-all ${
                selectedCategory === "ALL"
                  ? "btn-dark text-white fw-semibold shadow-xs"
                  : "btn-light border text-muted hover-bg-light"
              }`}
            >
              All Categories (सभी)
            </button>

            {INTEREST_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setSelectedSeva("ALL");
                  }}
                  className={`btn btn-sm px-3 rounded-pill transition-all d-flex align-items-center gap-1 ${
                    isSelected
                      ? "btn-primary text-white fw-semibold shadow-xs"
                      : "btn-light border text-dark hover-bg-light"
                  }`}
                >
                  <i className={`bi ${cat.icon}`}></i>
                  <span>{cat.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter Inputs Grid */}
        <div className="row g-2">
          {/* Specific Seva / Activity Dropdown */}
          <div className="col-12 col-md-4">
            <label className="form-label small fw-semibold text-dark mb-1">
              Specific Activity / Seva (विशिष्ट रुचि)
            </label>
            <select
              className="form-select form-select-sm"
              value={selectedSeva}
              onChange={(e) => setSelectedSeva(e.target.value)}
            >
              <option value="ALL">All Activities in Category</option>
              {availableSevaOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label} ({opt.hindiLabel})
                </option>
              ))}
            </select>
          </div>

          {/* Sangh Filter */}
          <div className="col-12 col-sm-6 col-md-3">
            <label className="form-label small fw-semibold text-dark mb-1">
              Sangh (संघ)
            </label>
            <select
              className="form-select form-select-sm"
              value={selectedSanghId}
              disabled={Boolean(userSanghId && userRole === "VOLUNTEER")}
              onChange={(e) => setSelectedSanghId(e.target.value)}
            >
              <option value="ALL">All Sanghs (सभी संघ)</option>
              {sanghs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.prefix})
                </option>
              ))}
            </select>
          </div>

          {/* Area Filter */}
          <div className="col-12 col-sm-6 col-md-2">
            <label className="form-label small fw-semibold text-dark mb-1">
              Area (क्षेत्र)
            </label>
            <select
              className="form-select form-select-sm"
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
            >
              <option value="ALL">All Areas (सभी क्षेत्र)</option>
              {uniqueAreas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* Search Query Input */}
          <div className="col-12 col-md-3">
            <label className="form-label small fw-semibold text-dark mb-1">
              Search Volunteer / Phone
            </label>
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-light text-muted">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Name, phone, or member ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setSearchQuery("")}
                >
                  <i className="bi bi-x"></i>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RESULTS COUNT & STATUS */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <span className="text-muted small">
            Found <strong>{filteredMembers.length} volunteers</strong> with registered interests
          </span>
          {selectedSeva !== "ALL" && (
            <span className="badge bg-primary text-white ms-2 font-monospace">
              {getInterestLabel(selectedSeva)}
            </span>
          )}
        </div>
        <div className="text-muted small">
          Active Sanghs: <strong>{sanghs.length}</strong>
        </div>
      </div>

      {/* VOLUNTEER CARDS GRID */}
      {filteredMembers.length === 0 ? (
        <div className="card shadow-sm border-0 rounded-4 p-5 text-center bg-white">
          <div className="text-muted mb-3">
            <i className="bi bi-person-x fs-1"></i>
          </div>
          <h5 className="fw-bold text-dark mb-1">No Volunteers Found</h5>
          <p className="text-muted small mb-3">
            No community members match your selected seva filter or search query.
          </p>
          <div>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory("ALL");
                setSelectedSeva("ALL");
                setSelectedSanghId("ALL");
                setSelectedArea("ALL");
                setSearchQuery("");
              }}
              className="btn btn-outline-secondary btn-sm px-3"
            >
              Reset Filters
            </button>
          </div>
        </div>
      ) : (
        <div className="row g-3">
          {filteredMembers.map((member) => {
            const rawPhone = member.whatsappNumber || member.family.mobile || "";
            const cleanPhone = rawPhone.replace(/[^0-9]/g, "");
            const formattedPhone = cleanPhone.startsWith("91") && cleanPhone.length === 12
              ? cleanPhone.substring(2)
              : cleanPhone;

            const whatsappMessage = encodeURIComponent(
              `जय जिनेन्द्र ${member.name} जी! जिन संस्कार सेतु (${member.sangh.name}) के माध्यम से संघ सेवा संदर्भ में आपसे संपर्क कर रहे हैं।`
            );

            return (
              <div key={member.id} className="col-12 col-md-6 col-xl-4">
                <div className="card shadow-sm border rounded-4 h-100 bg-white overflow-hidden transition-all hover-shadow">
                  {/* Card Header: Member Name & Sangh */}
                  <div className="card-header bg-light border-bottom py-2 px-3 d-flex justify-content-between align-items-center">
                    <div>
                      <span className="badge bg-secondary-subtle text-secondary font-monospace small me-1">
                        {member.memberId}
                      </span>
                      <span className="badge bg-primary-subtle text-primary font-monospace small">
                        {member.sangh.prefix}
                      </span>
                    </div>
                    <div className="text-muted small">
                      {member.relationship} • {member.age} yrs
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="card-body p-3">
                    <h5 className="fw-bold text-dark mb-1 d-flex align-items-center justify-content-between">
                      <span>{member.name}</span>
                      <span className="badge bg-light text-muted border fw-normal small" style={{ fontSize: "0.75rem" }}>
                        {member.gender}
                      </span>
                    </h5>

                    {/* Household Details */}
                    <div className="text-muted small mb-2">
                      <div>
                        Head: <strong>{member.family.headName}</strong> • Area:{" "}
                        <strong>{member.family.area}</strong>
                      </div>
                      <div>
                        Family ID:{" "}
                        <Link
                          href={`/families/${member.family.id}`}
                          className="text-decoration-none fw-semibold font-monospace"
                        >
                          {member.family.familyId}
                        </Link>
                      </div>
                    </div>

                    {/* Contact Phone & Direct Actions */}
                    <div className="bg-light p-2 rounded-3 border mb-3 d-flex justify-content-between align-items-center">
                      <div className="d-flex align-items-center gap-1 font-monospace small">
                        <i className="bi bi-telephone-fill text-muted me-1"></i>
                        <strong>{formattedPhone || "No direct phone"}</strong>
                        {member.whatsappNumber && (
                          <span className="badge bg-success-subtle text-success ms-1 small" title="Direct member number">
                            Direct
                          </span>
                        )}
                      </div>

                      {formattedPhone && (
                        <div className="d-flex gap-1">
                          <a
                            href={`https://wa.me/91${formattedPhone}?text=${whatsappMessage}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-success btn-sm py-1 px-2 d-flex align-items-center gap-1 shadow-xs"
                            title="Chat on WhatsApp"
                          >
                            <i className="bi bi-whatsapp"></i>
                            <span className="small d-none d-sm-inline">Chat</span>
                          </a>

                          <a
                            href={`tel:+91${formattedPhone}`}
                            className="btn btn-outline-primary btn-sm py-1 px-2 d-flex align-items-center"
                            title="Call Volunteer"
                          >
                            <i className="bi bi-telephone"></i>
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Member Interests Tags */}
                    <div>
                      <div className="small fw-semibold text-muted mb-1">
                        Selected Sevas ({member.interests.length}):
                      </div>
                      <div className="d-flex flex-wrap gap-1">
                        {member.interests.map((k) => {
                          const isMatch = selectedSeva !== "ALL" && k === selectedSeva;
                          return (
                            <span
                              key={k}
                              className={`badge ${
                                isMatch
                                  ? "bg-primary text-white shadow-xs"
                                  : "bg-light text-dark border"
                              }`}
                              style={{ fontSize: "0.75rem" }}
                            >
                              {getInterestLabel(k)}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
