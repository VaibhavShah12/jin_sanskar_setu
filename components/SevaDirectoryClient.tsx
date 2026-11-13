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

  // Seva Dispatcher Modal State
  const [showDispatcherModal, setShowDispatcherModal] = useState(false);
  const [dispatcherTemplate, setDispatcherTemplate] = useState<string>("VIHAR");
  const [eventDate, setEventDate] = useState("कल प्रातः 6:00 बजे (Tomorrow 6:00 AM)");
  const [eventLocation, setEventLocation] = useState("उपाश्रय / जिनालय (Upashray / Jinmandir)");
  const [contactPerson, setContactPerson] = useState("");
  const [customDispatcherText, setCustomDispatcherText] = useState("");
  const [copiedBroadcastMsg, setCopiedBroadcastMsg] = useState(false);

  const getBroadcastMessage = (memberName?: string) => {
    const greeting = memberName ? `जय जिनेन्द्र ${memberName} जी!` : `जय जिनेन्द्र!`;
    const contactLine = contactPerson ? `\n📞 संपर्क: ${contactPerson}` : "";

    switch (dispatcherTemplate) {
      case "VIHAR":
        return `${greeting}\n\n🙏 *विहार सेवा आवश्यक सूचना (Vihar Seva Callout)*\n\nपरम पूज्य गुरु भगवंत का विहार:\n📅 समय: ${eventDate}\n📍 स्थान/रूट: ${eventLocation}\n\nजिन संस्कार सेतु में आपकी विहार सेवा (Vihar Seva) की रुचि दर्ज है। आप सभी सेवाभावी साधर्मिक बंधुओं से सविनय निवेदन है कि विहार सेवा में पधारकर लाभ लेवें।\n\nकृपया अपनी उपस्थिति की पुष्टि करें।${contactLine}\n\n- श्री जैन श्वेताम्बर संघ`;
      case "GOCHARI":
        return `${greeting}\n\n🥣 *गोचरी सेवा विनंती (Gochari Seva Coordination)*\n\nपरम पूज्य गुरु भगवंत की गोचरी वहराने हेतु सेवा व्यवस्था:\n📅 समय: ${eventDate}\n📍 उपाश्रय: ${eventLocation}\n\nआपकी गोचरी सेवा (Gochari Seva) की रुचि दर्ज है। कृपया समय पर पधारकर लाभ लेवें।${contactLine}\n\n- श्री जैन श्वेताम्बर संघ`;
      case "PIROSNA":
        return `${greeting}\n\n🍽️ *पिरोसना / साधर्मिक वात्सल्य सेवा (Bhojanshala Seva)*\n\nसाधर्मिक भक्ति एवं भोजनशाला में पिरोसना सेवा:\n📅 तिथि/समय: ${eventDate}\n📍 भोजनशाला: ${eventLocation}\n\nआपकी पिरोसना एवं व्यवस्था सेवा में रुचि दर्ज है। सेवा में सम्मिलित होने हेतु सादर आमंत्रित हैं।${contactLine}\n\n- श्री जैन श्वेताम्बर संघ`;
      case "PATHSHALA":
        return `${greeting}\n\n📚 *पाठशाला शिक्षक एवं स्वाध्याय समन्वय (Pathshala Seva)*\n\nपाठशाला एवं ज्ञान सेवा संबंधी बैठक / आयोजन:\n📅 समय: ${eventDate}\n📍 स्थान: ${eventLocation}\n\nकृपया समय पर उपस्थित रहने की कृपा करें।${contactLine}\n\n- श्री जैन श्वेताम्बर संघ`;
      case "CUSTOM":
      default:
        return `${greeting}\n\n${customDispatcherText || "श्री संघ सेवा आयोजन में आपकी उपस्थिति प्रार्थनीय है।"}\n\n📅 समय: ${eventDate}\n📍 स्थान: ${eventLocation}${contactLine}\n\n- श्री जैन श्वेताम्बर संघ`;
    }
  };

  const handleCopyBroadcastMessage = () => {
    const msg = getBroadcastMessage();
    navigator.clipboard.writeText(msg);
    setCopiedBroadcastMsg(true);
    setTimeout(() => setCopiedBroadcastMsg(false), 2500);
  };

  const handleBroadcastToGroups = () => {
    const msg = getBroadcastMessage();
    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  };

  const handleDirectWhatsAppToMember = (m: SevaMember) => {
    const raw = m.whatsappNumber || m.family.mobile;
    if (!raw) return;
    const clean = raw.replace(/[^0-9]/g, "").slice(-10);
    const msg = getBroadcastMessage(m.name);
    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/91${clean}?text=${encoded}`, "_blank");
  };

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

          {/* Action Buttons: WhatsApp Dispatcher, Copy Numbers & Export CSV */}
          <div className="d-flex flex-wrap gap-2">
            <button
              type="button"
              disabled={filteredMembers.length === 0}
              onClick={() => setShowDispatcherModal(true)}
              className="btn btn-success btn-sm px-3 d-flex align-items-center gap-1 shadow-xs fw-semibold"
              title="Open WhatsApp Seva Broadcast & Dispatcher"
            >
              <i className="bi bi-whatsapp"></i>
              <span>WhatsApp Dispatcher ({filteredMembers.length})</span>
            </button>

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
      {/* =====================================================================
          WHATSAPP SEVA DISPATCHER & BROADCAST MODAL
          ===================================================================== */}
      {showDispatcherModal && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1060 }} role="dialog">
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content rounded-4 border-0 shadow-lg">
              <div className="modal-header bg-success text-white py-3 px-4">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-whatsapp fs-5"></i>
                  <div>
                    <h5 className="modal-title fw-bold mb-0">
                      WhatsApp Seva Dispatcher (सेवा आमंत्रण एवं प्रसारण)
                    </h5>
                    <small className="opacity-75">
                      Target Audience: {filteredMembers.length} Volunteers ({phoneNumbersList.length} Unique Phones)
                    </small>
                  </div>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowDispatcherModal(false)}></button>
              </div>

              <div className="modal-body p-4">
                {/* Template Selection Tabs */}
                <div className="mb-3">
                  <label className="form-label small fw-bold text-dark mb-1">Select Seva Callout Template:</label>
                  <div className="d-flex flex-wrap gap-1">
                    {[
                      { key: "VIHAR", label: "विहार सेवा (Vihar)", icon: "bi-flower1" },
                      { key: "GOCHARI", label: "गोचरी सेवा (Gochari)", icon: "bi-cup-hot" },
                      { key: "PIROSNA", label: "पिरोसना / भोजनशाला", icon: "bi-people" },
                      { key: "PATHSHALA", label: "पाठशाला समन्वय", icon: "bi-book" },
                      { key: "CUSTOM", label: "Custom Message", icon: "bi-pencil" },
                    ].map((tpl) => (
                      <button
                        key={tpl.key}
                        type="button"
                        onClick={() => setDispatcherTemplate(tpl.key)}
                        className={`btn btn-sm px-3 rounded-pill d-flex align-items-center gap-1 ${
                          dispatcherTemplate === tpl.key
                            ? "btn-dark text-white fw-semibold"
                            : "btn-light border text-muted"
                        }`}
                      >
                        <i className={`bi ${tpl.icon}`}></i>
                        <span>{tpl.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Event Date & Location Inputs */}
                <div className="row g-2 mb-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-bold text-dark mb-1">
                      Date &amp; Time (समय / तिथि):
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      placeholder="e.g. कल प्रातः 6:00 बजे"
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-bold text-dark mb-1">
                      Location / Upashray / Route (स्थान):
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={eventLocation}
                      onChange={(e) => setEventLocation(e.target.value)}
                      placeholder="e.g. गंगाधाम से बिबवेवाड़ी उपाश्रय"
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label small fw-bold text-dark mb-1">
                      Contact Person (संपर्क सूत्र - Optional):
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      placeholder="e.g. भावेश शाह - 98220xxxxx"
                    />
                  </div>
                </div>

                {dispatcherTemplate === "CUSTOM" && (
                  <div className="mb-3">
                    <label className="form-label small fw-bold text-dark mb-1">Custom Message Body:</label>
                    <textarea
                      rows={3}
                      className="form-control form-control-sm"
                      value={customDispatcherText}
                      onChange={(e) => setCustomDispatcherText(e.target.value)}
                      placeholder="सेवा संबंधी आवश्यक सूचना यहाँ लिखें..."
                    ></textarea>
                  </div>
                )}

                {/* Live Message Preview */}
                <div className="mb-3">
                  <label className="form-label small fw-bold text-dark mb-1">Live Broadcast Preview:</label>
                  <textarea
                    rows={7}
                    readOnly
                    className="form-control font-monospace small bg-light"
                    value={getBroadcastMessage()}
                  ></textarea>
                </div>

                {/* Broadcast to Groups Actions */}
                <div className="d-flex flex-wrap gap-2 mb-4 p-3 bg-light rounded-3 border">
                  <button
                    type="button"
                    onClick={handleBroadcastToGroups}
                    className="btn btn-success btn-sm px-4 fw-semibold d-flex align-items-center gap-1 shadow-xs"
                  >
                    <i className="bi bi-whatsapp"></i>
                    <span>Share to WhatsApp Groups / Broadcast</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyBroadcastMessage}
                    className="btn btn-outline-secondary btn-sm px-3 d-flex align-items-center gap-1"
                  >
                    <i className={`bi ${copiedBroadcastMsg ? "bi-check2-all text-success" : "bi-clipboard"}`}></i>
                    <span>{copiedBroadcastMsg ? "Copied Message!" : "Copy Text"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyNumbers}
                    className="btn btn-outline-dark btn-sm px-3 d-flex align-items-center gap-1"
                  >
                    <i className="bi bi-telephone"></i>
                    <span>Copy All {phoneNumbersList.length} Phone Numbers</span>
                  </button>
                </div>

                {/* 1-Click Individual Volunteer Dispatch List */}
                <div>
                  <h6 className="fw-bold text-dark mb-2">
                    <i className="bi bi-person-lines-fill me-1 text-primary"></i>
                    Send Direct 1-to-1 WhatsApp Invites to Matched Volunteers:
                  </h6>
                  <div className="list-group list-group-flush border rounded-3 overflow-auto" style={{ maxHeight: "250px" }}>
                    {filteredMembers.map((m) => {
                      const rawPhone = m.whatsappNumber || m.family.mobile;
                      const cleanPhone = rawPhone ? rawPhone.replace(/[^0-9]/g, "").slice(-10) : "";
                      return (
                        <div key={m.id} className="list-group-item d-flex justify-content-between align-items-center p-2">
                          <div>
                            <strong className="text-dark d-block">{m.name}</strong>
                            <span className="small text-muted">
                              {m.sangh.name} • Area: {m.family.area} • Phone: {cleanPhone || "—"}
                            </span>
                          </div>
                          <div>
                            {cleanPhone ? (
                              <button
                                type="button"
                                onClick={() => handleDirectWhatsAppToMember(m)}
                                className="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1 py-1 px-2"
                                title={`Send personalized WhatsApp invite to ${m.name}`}
                              >
                                <i className="bi bi-whatsapp"></i>
                                <span className="small">Send Invite</span>
                              </button>
                            ) : (
                              <span className="text-muted small fst-italic">No phone</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="modal-footer border-0 pt-0">
                <button type="button" className="btn btn-light" onClick={() => setShowDispatcherModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
