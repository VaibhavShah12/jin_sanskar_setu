"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { saveLavaajamRecordAction, SaveLavaajamPayload } from "@/lib/actions/lavaajam-actions";

export interface LavaajamFamilyItem {
  id: string;
  familyId: string;
  headName: string;
  mobile: string;
  area: string;
  address: string;
  sangh: {
    id: string;
    name: string;
    prefix: string;
  };
  memberCount: number;
  lavaajam: {
    id: string;
    status: "PAID" | "PENDING";
    amount: number | null;
    receiptNumber: string | null;
    receiverName: string | null;
    receiptPhoto: string | null;
    paymentDate: string | null;
    paymentMode: string | null;
    notes: string | null;
    recordedBy: string | null;
    updatedAt: string;
  } | null;
}

interface SummaryData {
  totalFamilies: number;
  paidFamilies: number;
  pendingFamilies: number;
  totalAmountCollected: number;
  paidPercentage: number;
}

interface SanghOption {
  id: string;
  name: string;
  prefix: string;
}

interface LavaajamPortalClientProps {
  initialFamilies: LavaajamFamilyItem[];
  initialSummary: SummaryData;
  initialYear: string;
  sanghs: SanghOption[];
  userRole: string;
  userSanghId?: string | null;
}

export default function LavaajamPortalClient({
  initialFamilies,
  initialSummary,
  initialYear,
  sanghs,
  userRole,
  userSanghId,
}: LavaajamPortalClientProps) {
  const [families, setFamilies] = useState<LavaajamFamilyItem[]>(initialFamilies);
  const [summary, setSummary] = useState<SummaryData>(initialSummary);
  const [selectedYear, setSelectedYear] = useState<string>(initialYear);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PAID" | "PENDING">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArea, setSelectedArea] = useState<string>("ALL");
  const [selectedSanghId, setSelectedSanghId] = useState<string>(userSanghId || "ALL");

  // Modal State for Editing / Recording
  const [editingFamily, setEditingFamily] = useState<LavaajamFamilyItem | null>(null);
  const [formStatus, setFormStatus] = useState<"PAID" | "PENDING">("PAID");
  const [formAmount, setFormAmount] = useState<string>("1100");
  const [formReceiptNumber, setFormReceiptNumber] = useState<string>("");
  const [formReceiverName, setFormReceiverName] = useState<string>("");
  const [formPaymentMode, setFormPaymentMode] = useState<string>("CASH");
  const [formPaymentDate, setFormPaymentDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [formNotes, setFormNotes] = useState<string>("");
  const [formReceiptPhoto, setFormReceiptPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Photo viewer modal state
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState<string | null>(null);
  const [viewingPhotoTitle, setViewingPhotoTitle] = useState<string>("");

  // Printable receipt voucher modal state
  const [printingFamily, setPrintingFamily] = useState<LavaajamFamilyItem | null>(null);

  const handleShareWhatsApp = (fam: LavaajamFamilyItem) => {
    const lav = fam.lavaajam;
    if (!lav) return;
    const cleanMobile = fam.mobile.replace(/[^0-9]/g, "");
    const targetNumber = cleanMobile.startsWith("91") ? cleanMobile : `91${cleanMobile.slice(-10)}`;
    const dateFormatted = lav.paymentDate
      ? new Date(lav.paymentDate).toLocaleDateString("en-IN")
      : new Date().toLocaleDateString("en-IN");

    const text = `जय जिनेन्द्र 🙏\n\n*श्री ${fam.sangh.name} - वार्षिक लवाजम रसीद*\n----------------------------------------\n*सत्र / Financial Year:* ${selectedYear}\n*परिवार प्रमुख:* ${fam.headName}\n*Family ID:* ${fam.familyId}\n*रसीद संख्या (Receipt No):* #${lav.receiptNumber || "N/A"}\n*जमा राशि:* ₹${(lav.amount || 0).toLocaleString("en-IN")}\n*भुगतान माध्यम:* ${lav.paymentMode || "CASH"}\n*तारीख:* ${dateFormatted}\n*प्राप्तकर्ता:* ${lav.receiverName || "संघ कार्यालय"}\n----------------------------------------\nसंघ कार्यों में आपके निरंतर सहयोग के लिए हार्दिक धन्यवाद! 🙏`;

    const url = `https://wa.me/${targetNumber}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  // Unique areas for filtering
  const uniqueAreas = useMemo(() => {
    const set = new Set<string>();
    families.forEach((f) => {
      if (f.area) set.add(f.area.trim());
    });
    return Array.from(set).sort();
  }, [families]);

  // Filtered families list
  const filteredFamilies = useMemo(() => {
    return families.filter((f) => {
      // Sangh filter (if Admin can switch)
      if (selectedSanghId !== "ALL" && f.sangh.id !== selectedSanghId) {
        return false;
      }

      // Status filter
      const isPaid = f.lavaajam?.status === "PAID";
      if (statusFilter === "PAID" && !isPaid) return false;
      if (statusFilter === "PENDING" && isPaid) return false;

      // Area filter
      if (selectedArea !== "ALL" && f.area !== selectedArea) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = f.headName.toLowerCase().includes(q);
        const matchFamilyId = f.familyId.toLowerCase().includes(q);
        const matchMobile = f.mobile.includes(q);
        const matchReceipt = f.lavaajam?.receiptNumber?.toLowerCase().includes(q);
        const matchReceiver = f.lavaajam?.receiverName?.toLowerCase().includes(q);
        const matchArea = f.area.toLowerCase().includes(q);

        if (!matchName && !matchFamilyId && !matchMobile && !matchReceipt && !matchReceiver && !matchArea) {
          return false;
        }
      }

      return true;
    });
  }, [families, selectedSanghId, statusFilter, selectedArea, searchQuery]);

  // Open Edit Modal for a family
  const handleOpenEditModal = (fam: LavaajamFamilyItem) => {
    setEditingFamily(fam);
    setSaveError(null);
    setSaveSuccessMsg(null);

    if (fam.lavaajam && fam.lavaajam.status === "PAID") {
      setFormStatus("PAID");
      setFormAmount(fam.lavaajam.amount ? String(fam.lavaajam.amount) : "1100");
      setFormReceiptNumber(fam.lavaajam.receiptNumber || "");
      setFormReceiverName(fam.lavaajam.receiverName || "");
      setFormPaymentMode(fam.lavaajam.paymentMode || "CASH");
      setFormPaymentDate(fam.lavaajam.paymentDate || new Date().toISOString().split("T")[0]);
      setFormNotes(fam.lavaajam.notes || "");
      setFormReceiptPhoto(fam.lavaajam.receiptPhoto || null);
    } else {
      setFormStatus("PAID");
      setFormAmount("1100");
      setFormReceiptNumber("");
      setFormReceiverName("");
      setFormPaymentMode("CASH");
      setFormPaymentDate(new Date().toISOString().split("T")[0]);
      setFormNotes("");
      setFormReceiptPhoto(null);
    }
  };

  // Compress & read image as base64
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setSaveError("Please select an image file (PNG, JPG, JPEG, WebP).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Resize image to max 1200px width/height to keep payload light
        const canvas = document.createElement("canvas");
        const maxDim = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.82);
        setFormReceiptPhoto(compressedBase64);
        setSaveError(null);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Submit Lavaajam Record
  const handleSaveLavaajam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFamily) return;

    setSaving(true);
    setSaveError(null);

    try {
      const payload: SaveLavaajamPayload = {
        familyId: editingFamily.id,
        year: selectedYear,
        status: formStatus,
        amount: formStatus === "PAID" && formAmount ? parseFloat(formAmount) : null,
        receiptNumber: formStatus === "PAID" ? formReceiptNumber : null,
        receiverName: formStatus === "PAID" ? formReceiverName : null,
        paymentDate: formStatus === "PAID" ? formPaymentDate : null,
        paymentMode: formStatus === "PAID" ? formPaymentMode : null,
        notes: formNotes,
        receiptPhoto: formStatus === "PAID" ? formReceiptPhoto : null,
      };

      const res = await saveLavaajamRecordAction(payload);
      if (res.success) {
        setSaveSuccessMsg(res.message || "Record saved successfully!");

        // Update local family list state immediately
        setFamilies((prev) =>
          prev.map((f) => {
            if (f.id === editingFamily.id) {
              return {
                ...f,
                lavaajam: {
                  id: res.recordId || "new",
                  status: formStatus,
                  amount: payload.amount ? Number(payload.amount) : null,
                  receiptNumber: payload.receiptNumber || null,
                  receiverName: payload.receiverName || null,
                  receiptPhoto: payload.receiptPhoto || null,
                  paymentDate: payload.paymentDate || null,
                  paymentMode: payload.paymentMode || null,
                  notes: payload.notes || null,
                  recordedBy: "You",
                  updatedAt: new Date().toISOString(),
                },
              };
            }
            return f;
          })
        );

        // Recalculate summary
        setTimeout(() => {
          setEditingFamily(null);
        }, 1200);
      } else {
        setSaveError(res.error || "Failed to record Lavaajam.");
      }
    } catch (err: any) {
      setSaveError(err?.message || "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-fluid px-3 px-lg-4 py-4">
      {/* Top Banner */}
      <div className="card shadow-sm border-0 rounded-4 p-4 mb-4 bg-white border-start border-4 border-warning">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2 py-1">
                <i className="bi bi-shield-check me-1"></i> Trustee &amp; Admin Exclusive
              </span>
              {userSanghId && sanghs.find((s) => s.id === userSanghId) && (
                <span className="badge bg-primary text-white font-monospace">
                  {sanghs.find((s) => s.id === userSanghId)?.name}
                </span>
              )}
            </div>
            <h1 className="h4 fw-bold text-dark mb-1">
              Sangh Lavaajam Register (संघ लवाजम रजिस्टर)
            </h1>
            <p className="text-muted small mb-0">
              Official annual membership contribution records. Strictly scoped to Trustees and Admins for their respective Shri Sangh.
            </p>
          </div>

          {/* Year Selector */}
          <div className="d-flex align-items-center gap-2 bg-light p-2 rounded-3 border">
            <label className="small fw-bold text-dark text-nowrap mb-0">
              <i className="bi bi-calendar-check me-1 text-primary"></i> Year / सत्र:
            </label>
            <select
              className="form-select form-select-sm fw-bold border-0 bg-white"
              style={{ minWidth: "135px" }}
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              <option value="2026-2027">2026–2027 (Current)</option>
              <option value="2025-2026">2025–2026</option>
              <option value="2024-2025">2024–2025</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI SUMMARY CARDS */}
      <div className="row g-3 mb-4">
        {/* Total Families */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card shadow-sm border-0 rounded-4 p-3 bg-white h-100">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <span className="text-muted small fw-semibold text-uppercase">Total Families</span>
                <h3 className="h3 fw-bold text-dark mb-0 mt-1">{summary.totalFamilies}</h3>
                <small className="text-muted">Registered in Sangh</small>
              </div>
              <div
                className="rounded-circle bg-light text-secondary d-flex align-items-center justify-content-center"
                style={{ width: "48px", height: "48px" }}
              >
                <i className="bi bi-houses-fill fs-4"></i>
              </div>
            </div>
          </div>
        </div>

        {/* Paid Families */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card shadow-sm border-0 rounded-4 p-3 bg-white h-100 border-start border-3 border-success">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <span className="text-success small fw-semibold text-uppercase">Lavaajam Paid (चुकता)</span>
                <h3 className="h3 fw-bold text-success mb-0 mt-1">{summary.paidFamilies}</h3>
                <div className="progress mt-2" style={{ height: "6px", width: "120px" }}>
                  <div
                    className="progress-bar bg-success"
                    style={{ width: `${summary.paidPercentage}%` }}
                  ></div>
                </div>
                <small className="text-muted">{summary.paidPercentage}% of families</small>
              </div>
              <div
                className="rounded-circle bg-success-subtle text-success d-flex align-items-center justify-content-center"
                style={{ width: "48px", height: "48px" }}
              >
                <i className="bi bi-check-circle-fill fs-4"></i>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Families */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card shadow-sm border-0 rounded-4 p-3 bg-white h-100 border-start border-3 border-danger">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <span className="text-danger small fw-semibold text-uppercase">Pending (बाकी)</span>
                <h3 className="h3 fw-bold text-danger mb-0 mt-1">{summary.pendingFamilies}</h3>
                <small className="text-muted">Awaiting collection</small>
              </div>
              <div
                className="rounded-circle bg-danger-subtle text-danger d-flex align-items-center justify-content-center"
                style={{ width: "48px", height: "48px" }}
              >
                <i className="bi bi-clock-history fs-4"></i>
              </div>
            </div>
          </div>
        </div>

        {/* Amount Collected */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card shadow-sm border-0 rounded-4 p-3 bg-white h-100 border-start border-3 border-primary">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <span className="text-primary small fw-semibold text-uppercase">Total Collected</span>
                <h3 className="h3 fw-bold text-primary mb-0 mt-1">
                  ₹{summary.totalAmountCollected.toLocaleString("en-IN")}
                </h3>
                <small className="text-muted">{selectedYear} collection</small>
              </div>
              <div
                className="rounded-circle bg-primary-subtle text-primary d-flex align-items-center justify-content-center"
                style={{ width: "48px", height: "48px" }}
              >
                <i className="bi bi-currency-rupee fs-4"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="card shadow-sm border-0 rounded-4 p-3 bg-white mb-4">
        <div className="row g-2 align-items-center">
          {/* Status Filter Tabs */}
          <div className="col-12 col-md-5">
            <div className="btn-group btn-group-sm w-100 p-1 bg-light rounded-pill border">
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className={`btn btn-sm rounded-pill fw-semibold ${
                  statusFilter === "ALL" ? "btn-dark text-white shadow-xs" : "btn-light text-muted border-0"
                }`}
              >
                All ({families.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("PAID")}
                className={`btn btn-sm rounded-pill fw-semibold ${
                  statusFilter === "PAID" ? "btn-success text-white shadow-xs" : "btn-light text-muted border-0"
                }`}
              >
                ✓ Paid ({summary.paidFamilies})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("PENDING")}
                className={`btn btn-sm rounded-pill fw-semibold ${
                  statusFilter === "PENDING" ? "btn-danger text-white shadow-xs" : "btn-light text-muted border-0"
                }`}
              >
                ⚠️ Pending ({summary.pendingFamilies})
              </button>
            </div>
          </div>

          {/* Area Filter */}
          <div className="col-6 col-md-3">
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

          {/* Search Query */}
          <div className="col-6 col-md-4">
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-light text-muted">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="Family ID, Head, Mobile, Receipt #..."
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

      {/* FAMILIES TABLE / ROSTER */}
      <div className="card shadow-sm border-0 rounded-4 overflow-hidden bg-white mb-4">
        <div className="card-header bg-light border-bottom py-3 px-3 px-md-4 d-flex justify-content-between align-items-center">
          <div>
            <h5 className="h6 fw-bold text-dark mb-0">
              Lavaajam Payment Roster ({filteredFamilies.length} families)
            </h5>
          </div>
          <span className="text-muted small">
            Session: <strong>{selectedYear}</strong>
          </span>
        </div>

        {filteredFamilies.length === 0 ? (
          <div className="p-5 text-center text-muted">
            <i className="bi bi-clipboard-x fs-1 d-block mb-2 text-muted opacity-50"></i>
            <h6 className="fw-bold">No Records Matching Filter</h6>
            <p className="small mb-0">Try changing status tab or clearing search text.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr className="small text-muted text-uppercase">
                  <th style={{ width: "130px" }}>Family ID</th>
                  <th>Head of Family</th>
                  <th>Contact &amp; Area</th>
                  <th>Lavaajam Status</th>
                  <th>Receipt Details</th>
                  <th>Receipt Photo</th>
                  <th className="text-end" style={{ width: "140px" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredFamilies.map((fam) => {
                  const lav = fam.lavaajam;
                  const isPaid = lav?.status === "PAID";

                  return (
                    <tr key={fam.id}>
                      {/* Family ID & Sangh */}
                      <td>
                        <Link
                          href={`/families/${fam.id}`}
                          className="fw-bold font-monospace text-primary text-decoration-none"
                        >
                          {fam.familyId}
                        </Link>
                        <div>
                          <span className="badge bg-light text-muted border font-monospace small">
                            {fam.sangh.prefix}
                          </span>
                        </div>
                      </td>

                      {/* Head Name */}
                      <td>
                        <div className="fw-bold text-dark">{fam.headName}</div>
                        <div className="text-muted small">
                          {fam.memberCount} family members
                        </div>
                      </td>

                      {/* Contact & Area */}
                      <td>
                        <div className="font-monospace small">
                          <i className="bi bi-telephone text-muted me-1"></i>
                          {fam.mobile}
                        </div>
                        <div className="text-muted small">
                          <i className="bi bi-geo-alt text-muted me-1"></i>
                          {fam.area}
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td>
                        {isPaid ? (
                          <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                            <i className="bi bi-check-circle-fill me-1"></i> Paid (चुकता)
                          </span>
                        ) : (
                          <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1">
                            <i className="bi bi-clock-history me-1"></i> Pending (बाकी)
                          </span>
                        )}
                      </td>

                      {/* Receipt Details */}
                      <td>
                        {isPaid ? (
                          <div className="small">
                            <div>
                              Receipt: <strong>{lav?.receiptNumber || "N/A"}</strong>
                            </div>
                            <div className="text-muted">
                              Receiver: <strong>{lav?.receiverName || "Sangh Desk"}</strong>
                            </div>
                            <div className="text-muted font-monospace">
                              ₹{lav?.amount?.toLocaleString("en-IN") || 0} • {lav?.paymentMode}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted small fst-italic">— Not collected —</span>
                        )}
                      </td>

                      {/* Receipt Photo Thumbnail */}
                      <td>
                        {lav?.receiptPhoto ? (
                          <button
                            type="button"
                            onClick={() => {
                              setViewingPhotoUrl(lav.receiptPhoto);
                              setViewingPhotoTitle(
                                `${fam.headName} (${fam.familyId}) - Receipt #${lav.receiptNumber || ""}`
                              );
                            }}
                            className="btn btn-outline-secondary btn-sm p-1 d-flex align-items-center gap-1 shadow-xs"
                            title="Click to view full receipt photo"
                          >
                            <img
                              src={lav.receiptPhoto}
                              alt="Receipt"
                              className="rounded border"
                              style={{ width: "32px", height: "32px", objectFit: "cover" }}
                            />
                            <span className="small d-none d-lg-inline">View</span>
                          </button>
                        ) : isPaid ? (
                          <span className="text-muted small fst-italic">No photo</span>
                        ) : (
                          <span className="text-muted small">—</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="text-end text-nowrap">
                        <div className="d-flex justify-content-end align-items-center gap-1">
                          {isPaid && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleShareWhatsApp(fam)}
                                className="btn btn-sm btn-outline-success px-2 shadow-xs"
                                title="Share Receipt on WhatsApp"
                              >
                                <i className="bi bi-whatsapp"></i>
                              </button>
                              <button
                                type="button"
                                onClick={() => setPrintingFamily(fam)}
                                className="btn btn-sm btn-outline-secondary px-2 shadow-xs"
                                title="Print / PDF Official Receipt"
                              >
                                <i className="bi bi-printer"></i>
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(fam)}
                            className="btn btn-sm btn-outline-primary px-3 shadow-xs"
                          >
                            <i className="bi bi-pencil-square me-1"></i>
                            <span>{isPaid ? "Edit" : "Record"}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =====================================================================
          RECORD / EDIT LAVAAJAM MODAL
          ===================================================================== */}
      {editingFamily && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1050 }}
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content rounded-4 border-0 shadow-lg overflow-hidden">
              <div className="modal-header bg-primary text-white py-3 px-4">
                <div>
                  <h5 className="modal-title fw-bold mb-0">
                    Record Lavaajam Payment (लवाजम दर्ज करें)
                  </h5>
                  <small className="text-white-50">
                    Family: {editingFamily.headName} • ID: {editingFamily.familyId} • Sangh: {editingFamily.sangh.name}
                  </small>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setEditingFamily(null)}
                ></button>
              </div>

              <form onSubmit={handleSaveLavaajam}>
                <div className="modal-body p-4">
                  {saveSuccessMsg && (
                    <div className="alert alert-success d-flex align-items-center gap-2 mb-3">
                      <i className="bi bi-check-circle-fill fs-5"></i>
                      <span>{saveSuccessMsg}</span>
                    </div>
                  )}

                  {saveError && (
                    <div className="alert alert-danger d-flex align-items-center gap-2 mb-3">
                      <i className="bi bi-exclamation-triangle-fill fs-5"></i>
                      <span>{saveError}</span>
                    </div>
                  )}

                  {/* Payment Status Switch */}
                  <div className="mb-3">
                    <label className="form-label small fw-bold text-dark">
                      Payment Status (लवाजम स्थिति) <span className="text-danger">*</span>
                    </label>
                    <div className="d-flex gap-3">
                      <div className="form-check">
                        <input
                          type="radio"
                          id="status-paid"
                          name="formStatus"
                          className="form-check-input"
                          checked={formStatus === "PAID"}
                          onChange={() => setFormStatus("PAID")}
                        />
                        <label htmlFor="status-paid" className="form-check-label fw-semibold text-success">
                          ✓ Paid (जमा / चुकता)
                        </label>
                      </div>

                      <div className="form-check">
                        <input
                          type="radio"
                          id="status-pending"
                          name="formStatus"
                          className="form-check-input"
                          checked={formStatus === "PENDING"}
                          onChange={() => setFormStatus("PENDING")}
                        />
                        <label htmlFor="status-pending" className="form-check-label fw-semibold text-danger">
                          ⚠️ Pending (बकाया)
                        </label>
                      </div>
                    </div>
                  </div>

                  {formStatus === "PAID" && (
                    <div className="bg-light p-3 rounded-3 border mb-3">
                      <div className="row g-3">
                        {/* Receipt Number Input */}
                        <div className="col-12 col-sm-6">
                          <label className="form-label small fw-semibold text-dark mb-1">
                            Receipt Number (रसीद क्रमांक) <span className="text-danger">*</span>
                          </label>
                          <input
                            type="text"
                            required={formStatus === "PAID"}
                            placeholder="e.g. REC-2026-0042"
                            className="form-control form-control-sm font-monospace"
                            value={formReceiptNumber}
                            onChange={(e) => setFormReceiptNumber(e.target.value)}
                          />
                        </div>

                        {/* Receiver's Name Input */}
                        <div className="col-12 col-sm-6">
                          <label className="form-label small fw-semibold text-dark mb-1">
                            Receiver&apos;s Name (प्राप्तकर्ता / ट्रस्टी का नाम) <span className="text-danger">*</span>
                          </label>
                          <input
                            type="text"
                            required={formStatus === "PAID"}
                            placeholder="Name of person who received payment"
                            className="form-control form-control-sm"
                            value={formReceiverName}
                            onChange={(e) => setFormReceiverName(e.target.value)}
                          />
                        </div>

                        {/* Amount */}
                        <div className="col-6 col-sm-4">
                          <label className="form-label small fw-semibold text-dark mb-1">
                            Amount (राशि ₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            placeholder="1100"
                            className="form-control form-control-sm font-monospace"
                            value={formAmount}
                            onChange={(e) => setFormAmount(e.target.value)}
                          />
                        </div>

                        {/* Payment Mode */}
                        <div className="col-6 col-sm-4">
                          <label className="form-label small fw-semibold text-dark mb-1">
                            Payment Mode
                          </label>
                          <select
                            className="form-select form-select-sm"
                            value={formPaymentMode}
                            onChange={(e) => setFormPaymentMode(e.target.value)}
                          >
                            <option value="CASH">Cash (नकद)</option>
                            <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                            <option value="CHEQUE">Cheque</option>
                            <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                          </select>
                        </div>

                        {/* Payment Date */}
                        <div className="col-12 col-sm-4">
                          <label className="form-label small fw-semibold text-dark mb-1">
                            Payment Date
                          </label>
                          <input
                            type="date"
                            className="form-control form-control-sm"
                            value={formPaymentDate}
                            onChange={(e) => setFormPaymentDate(e.target.value)}
                          />
                        </div>

                        {/* Receipt Photo Upload */}
                        <div className="col-12">
                          <label className="form-label small fw-semibold text-dark mb-1">
                            <i className="bi bi-camera-fill text-primary me-1"></i>
                            Upload Receipt Photo (रसीद का फोटो अपलोड करें)
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            className="form-control form-control-sm"
                            onChange={handlePhotoUpload}
                          />
                          <div className="form-text small">
                            Camera or gallery image of the physical receipt or online payment screenshot.
                          </div>

                          {/* Image Preview */}
                          {formReceiptPhoto && (
                            <div className="mt-2 position-relative d-inline-block">
                              <img
                                src={formReceiptPhoto}
                                alt="Receipt Preview"
                                className="img-thumbnail rounded"
                                style={{ maxHeight: "160px", maxWidth: "260px" }}
                              />
                              <button
                                type="button"
                                onClick={() => setFormReceiptPhoto(null)}
                                className="btn btn-danger btn-sm rounded-circle position-absolute top-0 end-0 m-1 p-1"
                                style={{ width: "26px", height: "26px", lineHeight: "1" }}
                                title="Remove photo"
                              >
                                <i className="bi bi-x"></i>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Notes / Remarks */}
                  <div className="mb-2">
                    <label className="form-label small fw-semibold text-dark mb-1">
                      Notes / Remarks (टिप्पणी - Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Paid during Paryushan parva"
                      className="form-control form-control-sm"
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                    />
                  </div>
                </div>

                <div className="modal-footer bg-light py-2 px-4 d-flex justify-content-between">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm px-3"
                    onClick={() => setEditingFamily(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn btn-primary btn-sm px-4 fw-semibold shadow-xs"
                  >
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                        Saving Record...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check2 me-1"></i> Save Lavaajam Record
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          FULLSCREEN RECEIPT PHOTO VIEWER MODAL
          ===================================================================== */}
      {viewingPhotoUrl && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.85)", zIndex: 1060 }}
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content rounded-4 border-0 overflow-hidden shadow-lg bg-dark text-white">
              <div className="modal-header border-secondary py-2 px-3">
                <h6 className="modal-title fw-bold text-truncate" style={{ maxWidth: "80%" }}>
                  <i className="bi bi-receipt me-2 text-warning"></i>
                  {viewingPhotoTitle}
                </h6>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setViewingPhotoUrl(null)}
                ></button>
              </div>
              <div className="modal-body p-2 text-center bg-black">
                <img
                  src={viewingPhotoUrl}
                  alt="Full Receipt"
                  className="img-fluid rounded"
                  style={{ maxHeight: "75vh", objectFit: "contain" }}
                />
              </div>
              <div className="modal-footer border-secondary py-2 px-3 d-flex justify-content-between">
                <a
                  href={viewingPhotoUrl}
                  download={`Receipt_${viewingPhotoTitle.replace(/\s+/g, "_")}.jpg`}
                  className="btn btn-outline-light btn-sm"
                >
                  <i className="bi bi-download me-1"></i> Download Image
                </a>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setViewingPhotoUrl(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          OFFICIAL PRINTABLE RECEIPT MODAL
          ===================================================================== */}
      {printingFamily && printingFamily.lavaajam && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.65)", zIndex: 1060 }}
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content rounded-4 border-0 shadow-lg overflow-hidden">
              <div className="modal-header bg-dark text-white py-3 px-4 d-print-none">
                <h5 className="modal-title fw-bold mb-0">
                  <i className="bi bi-receipt me-2 text-warning"></i>
                  Official Lavaajam Receipt Voucher
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setPrintingFamily(null)}
                ></button>
              </div>

              {/* Printable Voucher Body */}
              <div className="modal-body p-4 bg-white" id="lavaajam-printable-receipt">
                <div className="border border-2 border-primary-subtle rounded-4 p-4 position-relative bg-light-subtle">
                  {/* Watermark/Emblem header */}
                  <div className="text-center pb-3 border-bottom border-primary-subtle">
                    <span className="badge bg-primary text-white text-uppercase px-3 py-1 mb-2">
                      ॥ श्री जिनाय नमः ॥
                    </span>
                    <h3 className="fw-bold text-dark mb-1">
                      {printingFamily.sangh.name} ({printingFamily.sangh.prefix})
                    </h3>
                    <p className="small text-muted mb-0">
                      जिन संस्कार सेतु • वार्षिक लवाजम सहयोग रसीद • सत्र: <strong>{selectedYear}</strong>
                    </p>
                  </div>

                  {/* Receipt Meta */}
                  <div className="row g-2 py-3 border-bottom small">
                    <div className="col-6 col-sm-4">
                      <span className="text-muted d-block">रसीद संख्या (Receipt #):</span>
                      <strong className="fs-6 font-monospace text-primary">
                        {printingFamily.lavaajam.receiptNumber || "TEMP-" + printingFamily.familyId}
                      </strong>
                    </div>
                    <div className="col-6 col-sm-4">
                      <span className="text-muted d-block">भुगतान तारीख (Date):</span>
                      <strong>
                        {printingFamily.lavaajam.paymentDate
                          ? new Date(printingFamily.lavaajam.paymentDate).toLocaleDateString("en-IN")
                          : new Date().toLocaleDateString("en-IN")}
                      </strong>
                    </div>
                    <div className="col-12 col-sm-4">
                      <span className="text-muted d-block">परिवार क्रमांक (Family ID):</span>
                      <strong className="font-monospace">{printingFamily.familyId}</strong>
                    </div>
                  </div>

                  {/* Donor & Family Details */}
                  <div className="py-3 border-bottom">
                    <div className="row g-2 small">
                      <div className="col-12 col-sm-6">
                        <span className="text-muted d-block">परिवार प्रमुख (Family Head):</span>
                        <strong className="fs-6 text-dark">{printingFamily.headName}</strong>
                      </div>
                      <div className="col-12 col-sm-6">
                        <span className="text-muted d-block">सम्पर्क (Mobile):</span>
                        <span className="font-monospace">{printingFamily.mobile}</span>
                      </div>
                      <div className="col-12">
                        <span className="text-muted d-block">क्षेत्र एवं पता (Area & Address):</span>
                        <span>{printingFamily.area} — {printingFamily.address}</span>
                      </div>
                    </div>
                  </div>

                  {/* Financial Details */}
                  <div className="py-3 border-bottom bg-white rounded-3 p-3 my-3 border shadow-xs">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="text-muted small">सहयोग मद (Particulars):</span>
                      <strong className="text-dark small">वार्षिक संघ लवाजम ({selectedYear})</strong>
                    </div>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="text-muted small">भुगतान माध्यम (Payment Mode):</span>
                      <span className="badge bg-secondary-subtle text-secondary font-monospace">
                        {printingFamily.lavaajam.paymentMode || "CASH"}
                      </span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                      <span className="fw-bold text-dark fs-6">कुल प्राप्त राशि (Total Received):</span>
                      <h3 className="fw-bold text-success mb-0 font-monospace">
                        ₹{(printingFamily.lavaajam.amount || 0).toLocaleString("en-IN")}
                      </h3>
                    </div>
                  </div>

                  {/* Signatures & Blessings */}
                  <div className="row g-3 pt-3 align-items-end text-center text-sm-start">
                    <div className="col-12 col-sm-7">
                      <small className="text-muted d-block fst-italic">
                        * यह रसीद जिन संस्कार सेतु प्रणाली द्वारा अधिकृत रूप से उत्पन्न की गई है।
                      </small>
                      <small className="text-muted">
                        दर्जकर्ता: <strong>{printingFamily.lavaajam.receiverName || "संघ डेस्क"}</strong>
                      </small>
                    </div>
                    <div className="col-12 col-sm-5 text-sm-end">
                      <div className="border-top border-dark pt-1 d-inline-block text-center" style={{ minWidth: "160px" }}>
                        <small className="text-dark fw-bold d-block">अधिकृत हस्ताक्षर / मोहर</small>
                        <small className="text-muted font-monospace">{printingFamily.sangh.prefix}</small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="modal-footer py-2 px-3 d-flex justify-content-between d-print-none bg-light">
                <button
                  type="button"
                  onClick={() => handleShareWhatsApp(printingFamily)}
                  className="btn btn-outline-success btn-sm shadow-xs"
                >
                  <i className="bi bi-whatsapp me-1"></i> Send on WhatsApp
                </button>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="btn btn-primary btn-sm shadow-xs"
                  >
                    <i className="bi bi-printer-fill me-1"></i> Print / Save PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintingFamily(null)}
                    className="btn btn-secondary btn-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
