"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  saveLavaajamRecordAction,
  SaveLavaajamPayload,
  updateSanghLavaajamFeeAction,
  sendSanghBroadcastEmailAction,
  sendDirectFamilyEmailAction,
} from "@/lib/actions/lavaajam-actions";

export interface LavaajamFamilyItem {
  id: string;
  familyId: string;
  headName: string;
  mobile: string;
  email?: string | null;
  area: string;
  address: string;
  sangh: {
    id: string;
    name: string;
    prefix: string;
    annualLavaajamAmount?: number | null;
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
  annualLavaajamAmount?: number | null;
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
  const [formEmail, setFormEmail] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Photo viewer modal state
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState<string | null>(null);
  const [viewingPhotoTitle, setViewingPhotoTitle] = useState<string>("");

  // Printable receipt voucher modal state
  const [printingFamily, setPrintingFamily] = useState<LavaajamFamilyItem | null>(null);

  // Set Sangh Lavaajam Fee Modal State
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [feeSanghId, setFeeSanghId] = useState<string>(
    userSanghId || (sanghs.length > 0 ? sanghs[0].id : "")
  );
  const [feeAmountInput, setFeeAmountInput] = useState<string>("");
  const [feeSaving, setFeeSaving] = useState(false);
  const [feeMsg, setFeeMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Record by Family ID Modal State
  const [showRecordByIdModal, setShowRecordByIdModal] = useState(false);
  const [inputFamilyId, setInputFamilyId] = useState("");
  const [recordByIdError, setRecordByIdError] = useState<string | null>(null);

  // Broadcast Announcement Email Modal State
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastSanghId, setBroadcastSanghId] = useState<string>(
    userSanghId || (sanghs.length > 0 ? sanghs[0].id : "")
  );
  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Direct Family Email Modal State
  const [directEmailFam, setDirectEmailFam] = useState<LavaajamFamilyItem | null>(null);
  const [directSubject, setDirectSubject] = useState("");
  const [directMessage, setDirectMessage] = useState("");
  const [directSending, setDirectSending] = useState(false);
  const [directMsg, setDirectMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
        const matchEmail = (f.email || "").toLowerCase().includes(q);
        const matchReceipt = f.lavaajam?.receiptNumber?.toLowerCase().includes(q);
        const matchReceiver = f.lavaajam?.receiverName?.toLowerCase().includes(q);
        const matchArea = f.area.toLowerCase().includes(q);

        if (!matchName && !matchFamilyId && !matchMobile && !matchEmail && !matchReceipt && !matchReceiver && !matchArea) {
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
    setFormEmail(fam.email || "");

    const defaultSanghFee = fam.sangh.annualLavaajamAmount != null ? String(fam.sangh.annualLavaajamAmount) : "1100";

    if (fam.lavaajam && fam.lavaajam.status === "PAID") {
      setFormStatus("PAID");
      setFormAmount(fam.lavaajam.amount ? String(fam.lavaajam.amount) : defaultSanghFee);
      setFormReceiptNumber(fam.lavaajam.receiptNumber || "");
      setFormReceiverName(fam.lavaajam.receiverName || "");
      setFormPaymentMode(fam.lavaajam.paymentMode || "CASH");
      setFormPaymentDate(fam.lavaajam.paymentDate || new Date().toISOString().split("T")[0]);
      setFormNotes(fam.lavaajam.notes || "");
      setFormReceiptPhoto(fam.lavaajam.receiptPhoto || null);
    } else {
      setFormStatus("PAID");
      setFormAmount(defaultSanghFee);
      setFormReceiptNumber("");
      setFormReceiverName("");
      setFormPaymentMode("CASH");
      setFormPaymentDate(new Date().toISOString().split("T")[0]);
      setFormNotes("");
      setFormReceiptPhoto(null);
    }
  };

  // Open Fee Configuration Modal
  const handleOpenFeeModal = () => {
    const targetSanghId = userSanghId || (selectedSanghId !== "ALL" ? selectedSanghId : sanghs[0]?.id || "");
    const targetSangh = sanghs.find((s) => s.id === targetSanghId);
    setFeeSanghId(targetSanghId);
    setFeeAmountInput(targetSangh?.annualLavaajamAmount != null ? String(targetSangh.annualLavaajamAmount) : "1100");
    setFeeMsg(null);
    setShowFeeModal(true);
  };

  // Save Sangh Fee
  const handleSaveFee = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeeSaving(true);
    setFeeMsg(null);
    try {
      const num = parseFloat(feeAmountInput);
      const res = await updateSanghLavaajamFeeAction({
        sanghId: feeSanghId,
        annualAmount: num,
      });
      if (res.success) {
        setFeeMsg({ type: "success", text: res.message || "Fee updated successfully!" });
        sanghs.forEach((s) => {
          if (s.id === feeSanghId) s.annualLavaajamAmount = num;
        });
        setFamilies((prev) =>
          prev.map((f) => (f.sangh.id === feeSanghId ? { ...f, sangh: { ...f.sangh, annualLavaajamAmount: num } } : f))
        );
        setTimeout(() => setShowFeeModal(false), 1400);
      } else {
        setFeeMsg({ type: "error", text: res.error || "Failed to update fee." });
      }
    } catch (err: any) {
      setFeeMsg({ type: "error", text: err?.message || "Error updating fee." });
    } finally {
      setFeeSaving(false);
    }
  };

  // Lookup Family by ID to record payment
  const handleLookupFamilyById = (e: React.FormEvent) => {
    e.preventDefault();
    setRecordByIdError(null);
    const search = inputFamilyId.trim().toUpperCase();
    if (!search) {
      setRecordByIdError("Please enter a Family ID (e.g. MSJS-FAM-0001).");
      return;
    }
    const found = families.find(
      (f) => f.familyId.toUpperCase() === search || f.id === search
    );
    if (!found) {
      setRecordByIdError(`No family found matching ID "${search}". Please verify the Family ID.`);
      return;
    }
    setShowRecordByIdModal(false);
    setInputFamilyId("");
    handleOpenEditModal(found);
  };

  // Dispatch Broadcast Email to Sangh
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setBroadcastSending(true);
    setBroadcastMsg(null);
    try {
      const res = await sendSanghBroadcastEmailAction({
        sanghId: broadcastSanghId,
        subject: broadcastSubject,
        message: broadcastMessage,
      });
      if (res.success) {
        setBroadcastMsg({ type: "success", text: res.message || "Broadcast dispatched!" });
        setBroadcastSubject("");
        setBroadcastMessage("");
        setTimeout(() => setShowBroadcastModal(false), 2000);
      } else {
        setBroadcastMsg({ type: "error", text: res.error || "Failed to send broadcast." });
      }
    } catch (err: any) {
      setBroadcastMsg({ type: "error", text: err?.message || "An unexpected error occurred." });
    } finally {
      setBroadcastSending(false);
    }
  };

  // Open Direct Email to Family Modal
  const handleOpenDirectEmail = (fam: LavaajamFamilyItem) => {
    setDirectEmailFam(fam);
    setDirectSubject(`श्री ${fam.sangh.name} - परिवार संपर्क (${fam.familyId})`);
    setDirectMessage("");
    setDirectMsg(null);
  };

  // Dispatch Direct Email to Family
  const handleSendDirectEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directEmailFam) return;
    setDirectSending(true);
    setDirectMsg(null);
    try {
      const res = await sendDirectFamilyEmailAction({
        familyId: directEmailFam.familyId,
        subject: directSubject,
        message: directMessage,
      });
      if (res.success) {
        setDirectMsg({ type: "success", text: res.message || "Email sent!" });
        setTimeout(() => setDirectEmailFam(null), 1600);
      } else {
        setDirectMsg({ type: "error", text: res.error || "Failed to send email." });
      }
    } catch (err: any) {
      setDirectMsg({ type: "error", text: err?.message || "Error sending email." });
    } finally {
      setDirectSending(false);
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
        email: formEmail.trim() || null,
      };

      const res = await saveLavaajamRecordAction(payload);
      if (res.success) {
        setSaveSuccessMsg(
          res.message ||
            (res.emailSent
              ? `Saved! Receipt emailed to ${res.emailRecipient}.`
              : "Record saved successfully!")
        );

        // Update local family list state immediately
        const newStatus = formStatus;
        const newAmount = payload.amount ? Number(payload.amount) : null;

        setFamilies((prev) =>
          prev.map((f) => {
            if (f.id === editingFamily.id) {
              return {
                ...f,
                email: formEmail.trim() || f.email,
                lavaajam: {
                  id: res.recordId || "new",
                  status: newStatus,
                  amount: newAmount,
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

        // Update summary metrics locally
        setSummary((prev) => {
          const wasPaid = editingFamily.lavaajam?.status === "PAID";
          const oldAmount = wasPaid ? (editingFamily.lavaajam?.amount || 0) : 0;
          let newPaid = prev.paidFamilies;
          let newPending = prev.pendingFamilies;
          let newTotal = prev.totalAmountCollected - oldAmount;

          if (newStatus === "PAID") {
            if (!wasPaid) {
              newPaid++;
              newPending = Math.max(0, newPending - 1);
            }
            newTotal += newAmount || 0;
          } else {
            if (wasPaid) {
              newPaid = Math.max(0, newPaid - 1);
              newPending++;
            }
          }

          return {
            ...prev,
            paidFamilies: newPaid,
            pendingFamilies: newPending,
            totalAmountCollected: newTotal,
            paidPercentage: prev.totalFamilies > 0 ? Math.round((newPaid / prev.totalFamilies) * 100) : 0,
          };
        });

        setTimeout(() => {
          setEditingFamily(null);
        }, 1600);
      } else {
        setSaveError(res.error || "Failed to record Lavaajam.");
      }
    } catch (err: any) {
      setSaveError(err?.message || "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const currentSanghInfo = sanghs.find(
    (s) => s.id === (userSanghId || (selectedSanghId !== "ALL" ? selectedSanghId : sanghs[0]?.id))
  );

  return (
    <div className="container-fluid px-3 px-lg-4 py-4">
      {/* Top Banner with Action Buttons */}
      <div className="card shadow-sm border-0 rounded-4 p-4 mb-4 bg-white border-start border-4 border-warning">
        <div className="d-flex flex-column flex-xl-row justify-content-between align-items-start align-items-xl-center gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2 py-1">
                <i className="bi bi-shield-check me-1"></i> Trustee &amp; Admin Exclusive
              </span>
              {currentSanghInfo && (
                <span className="badge bg-primary text-white font-monospace">
                  {currentSanghInfo.name} • Fee: ₹{currentSanghInfo.annualLavaajamAmount ?? 1100}
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

          {/* Action Toolbar */}
          <div className="d-flex flex-wrap align-items-center gap-2">
            {/* Record by Family ID Button */}
            <button
              type="button"
              onClick={() => {
                setInputFamilyId("");
                setRecordByIdError(null);
                setShowRecordByIdModal(true);
              }}
              className="btn btn-primary btn-sm px-3 py-2 fw-semibold shadow-xs d-flex align-items-center gap-1"
            >
              <i className="bi bi-plus-circle-fill"></i> Record by Family ID (आईडी से भुगतान)
            </button>

            {/* Set Sangh Fee Button */}
            <button
              type="button"
              onClick={handleOpenFeeModal}
              className="btn btn-outline-warning text-dark btn-sm px-3 py-2 fw-semibold shadow-xs d-flex align-items-center gap-1"
            >
              <i className="bi bi-gear-fill text-warning"></i> Set Sangh Fee (लवाजम शुल्क)
            </button>

            {/* Broadcast Email Button */}
            <button
              type="button"
              onClick={() => {
                setBroadcastSubject("");
                setBroadcastMessage("");
                setBroadcastMsg(null);
                setShowBroadcastModal(true);
              }}
              className="btn btn-outline-success btn-sm px-3 py-2 fw-semibold shadow-xs d-flex align-items-center gap-1"
            >
              <i className="bi bi-broadcast"></i> Send Announcement (ईमेल सूचना)
            </button>

            {/* Year Selector */}
            <div className="d-flex align-items-center gap-2 bg-light p-1 px-2 rounded-3 border">
              <label className="small fw-bold text-dark text-nowrap mb-0">
                <i className="bi bi-calendar-check me-1 text-primary"></i> Year:
              </label>
              <select
                className="form-select form-select-sm fw-bold border-0 bg-white"
                style={{ minWidth: "130px" }}
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                <option value="2026-2027">2026–2027</option>
                <option value="2025-2026">2025–2026</option>
                <option value="2024-2025">2024–2025</option>
              </select>
            </div>
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
                placeholder="Family ID, Head, Mobile, Email, Receipt..."
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
                  <th>Contact &amp; Area / Email</th>
                  <th>Lavaajam Status</th>
                  <th>Receipt Details</th>
                  <th style={{ width: "90px" }}>Photo</th>
                  <th className="text-end" style={{ width: "180px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFamilies.map((fam) => {
                  const lav = fam.lavaajam;
                  const isPaid = lav?.status === "PAID";

                  return (
                    <tr key={fam.id} className={isPaid ? "" : "table-light text-muted"}>
                      {/* Family ID */}
                      <td>
                        <Link
                          href={`/families/${fam.id}`}
                          className="badge font-monospace bg-light text-primary border text-decoration-none px-2 py-1 fs-6"
                        >
                          {fam.familyId}
                        </Link>
                        <small className="d-block text-muted font-monospace" style={{ fontSize: "11px" }}>
                          {fam.sangh.prefix}
                        </small>
                      </td>

                      {/* Head Name */}
                      <td>
                        <div className="fw-bold text-dark">{fam.headName}</div>
                        <small className="text-muted">{fam.memberCount} members</small>
                      </td>

                      {/* Contact & Email */}
                      <td>
                        <div className="small text-dark font-monospace">
                          <i className="bi bi-telephone text-muted me-1"></i>
                          {fam.mobile || "—"}
                        </div>
                        {fam.email && (
                          <div className="small text-muted text-truncate" style={{ maxWidth: "190px" }} title={fam.email}>
                            <i className="bi bi-envelope-at text-primary me-1"></i>
                            {fam.email}
                          </div>
                        )}
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
                            <div className="fw-bold text-success font-monospace">
                              ₹{(lav?.amount || 0).toLocaleString("en-IN")} • {lav?.paymentMode || "CASH"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted small fst-italic">
                            Annual fee: ₹{fam.sangh.annualLavaajamAmount ?? 1100}
                          </span>
                        )}
                      </td>

                      {/* Photo Thumbnail */}
                      <td>
                        {lav?.receiptPhoto ? (
                          <button
                            type="button"
                            onClick={() => {
                              setViewingPhotoUrl(lav.receiptPhoto);
                              setViewingPhotoTitle(`Receipt - ${fam.headName} (${fam.familyId})`);
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
                          {/* Send Direct Email */}
                          {fam.email && (
                            <button
                              type="button"
                              onClick={() => handleOpenDirectEmail(fam)}
                              className="btn btn-sm btn-outline-info px-2 shadow-xs"
                              title={`Send message to ${fam.email}`}
                            >
                              <i className="bi bi-envelope"></i>
                            </button>
                          )}

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

                        {/* Receipt Email ID */}
                        <div className="col-12">
                          <label className="form-label small fw-semibold text-dark mb-1">
                            <i className="bi bi-envelope-at text-primary me-1"></i> Receipt Email ID (पावती ईमेल आईडी)
                          </label>
                          <input
                            type="email"
                            placeholder="family@example.com (Required for sending automated email receipt)"
                            className="form-control form-control-sm"
                            value={formEmail}
                            onChange={(e) => setFormEmail(e.target.value)}
                          />
                          <small className="text-muted d-block mt-1">
                            {formEmail && formEmail.includes("@") ? (
                              <span className="text-success fw-semibold">
                                <i className="bi bi-check-circle me-1"></i> Official payment voucher receipt will be dispatched to <strong>{formEmail}</strong> upon saving.
                              </span>
                            ) : (
                              <span>Enter the family email to automatically dispatch the official payment receipt.</span>
                            )}
                          </small>
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
                            Camera or gallery image of physical receipt or UPI payment screenshot.
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
                      placeholder="e.g. Paid during Sangh annual meeting"
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
          RECORD BY FAMILY ID MODAL
          ===================================================================== */}
      {showRecordByIdModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1050 }}
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow-lg">
              <div className="modal-header bg-dark text-white py-3 px-4">
                <h5 className="modal-title fw-bold mb-0">
                  <i className="bi bi-search me-2 text-warning"></i>
                  Record Payment by Family ID (आईडी से भुगतान)
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowRecordByIdModal(false)}
                ></button>
              </div>
              <form onSubmit={handleLookupFamilyById}>
                <div className="modal-body p-4">
                  <p className="text-muted small mb-3">
                    Enter the official Family ID to pull up the record, confirm contact email, and dispatch the payment receipt.
                  </p>

                  {recordByIdError && (
                    <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                      <i className="bi bi-exclamation-circle-fill"></i>
                      <span>{recordByIdError}</span>
                    </div>
                  )}

                  <label className="form-label small fw-bold text-dark mb-1">
                    Family ID (फैमिली आईडी) <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MSJS-FAM-0001 or GJS-FAM-0001"
                    className="form-control font-monospace text-uppercase mb-2"
                    value={inputFamilyId}
                    onChange={(e) => setInputFamilyId(e.target.value)}
                    autoFocus
                  />
                  <small className="text-muted d-block">
                    Type the prefix and number. Examples: <code>MSJS-FAM-0001</code>, <code>GJS-FAM-0002</code>
                  </small>
                </div>
                <div className="modal-footer bg-light py-2 px-4 d-flex justify-content-between">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setShowRecordByIdModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm px-4 fw-semibold">
                    Lookup &amp; Record Payment <i className="bi bi-arrow-right ms-1"></i>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SET SANGH FEE MODAL
          ===================================================================== */}
      {showFeeModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1050 }}
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow-lg">
              <div className="modal-header bg-warning text-dark py-3 px-4">
                <h5 className="modal-title fw-bold mb-0">
                  <i className="bi bi-gear-fill me-2"></i>
                  Set Sangh Lavaajam Fee (लवाजम शुल्क निर्धारण)
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowFeeModal(false)}
                ></button>
              </div>
              <form onSubmit={handleSaveFee}>
                <div className="modal-body p-4">
                  <p className="text-muted small mb-3">
                    Configure the standard annual membership contribution for this Sangh. Different Sanghs can maintain distinct fee structures.
                  </p>

                  {feeMsg && (
                    <div
                      className={`alert py-2 px-3 small d-flex align-items-center gap-2 mb-3 ${
                        feeMsg.type === "success" ? "alert-success" : "alert-danger"
                      }`}
                    >
                      <i className={`bi ${feeMsg.type === "success" ? "bi-check-circle-fill" : "bi-exclamation-triangle-fill"}`}></i>
                      <span>{feeMsg.text}</span>
                    </div>
                  )}

                  {/* Sangh Selector (if Admin has multiple) */}
                  {userRole === "ADMIN" && sanghs.length > 1 && (
                    <div className="mb-3">
                      <label className="form-label small fw-bold text-dark mb-1">
                        Select Shri Sangh (संघ चुनें)
                      </label>
                      <select
                        className="form-select form-select-sm"
                        value={feeSanghId}
                        onChange={(e) => {
                          const sid = e.target.value;
                          setFeeSanghId(sid);
                          const s = sanghs.find((item) => item.id === sid);
                          setFeeAmountInput(s?.annualLavaajamAmount != null ? String(s.annualLavaajamAmount) : "1100");
                        }}
                      >
                        {sanghs.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.prefix})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Annual Fee Input */}
                  <div className="mb-3">
                    <label className="form-label small fw-bold text-dark mb-1">
                      Annual Lavaajam Fee Amount (वार्षिक शुल्क राशि ₹) <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-light fw-bold">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        required
                        className="form-control font-monospace fw-bold"
                        placeholder="1100"
                        value={feeAmountInput}
                        onChange={(e) => setFeeAmountInput(e.target.value)}
                      />
                    </div>
                    <small className="text-muted mt-1 d-block">
                      This amount will be the default for all new Lavaajam receipts generated for this Sangh.
                    </small>
                  </div>
                </div>

                <div className="modal-footer bg-light py-2 px-4 d-flex justify-content-between">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setShowFeeModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={feeSaving}
                    className="btn btn-warning btn-sm px-4 fw-bold shadow-xs"
                  >
                    {feeSaving ? "Updating Fee..." : "Save Sangh Fee (सुरक्षित करें)"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          BROADCAST EMAIL ANNOUNCEMENT MODAL
          ===================================================================== */}
      {showBroadcastModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1050 }}
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content rounded-4 border-0 shadow-lg">
              <div className="modal-header bg-success text-white py-3 px-4">
                <h5 className="modal-title fw-bold mb-0">
                  <i className="bi bi-broadcast me-2"></i>
                  Broadcast Email Announcement (संघातील सदस्यांना ईमेल पाठवा)
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowBroadcastModal(false)}
                ></button>
              </div>
              <form onSubmit={handleSendBroadcast}>
                <div className="modal-body p-4">
                  <p className="text-muted small mb-3">
                    Send an official notification or circular to all families in this Shri Sangh who have registered email addresses.
                  </p>

                  {broadcastMsg && (
                    <div
                      className={`alert py-2 px-3 small d-flex align-items-center gap-2 mb-3 ${
                        broadcastMsg.type === "success" ? "alert-success" : "alert-danger"
                      }`}
                    >
                      <i className={`bi ${broadcastMsg.type === "success" ? "bi-check-circle-fill" : "bi-exclamation-triangle-fill"}`}></i>
                      <span>{broadcastMsg.text}</span>
                    </div>
                  )}

                  {/* Sangh Selector if Admin */}
                  {userRole === "ADMIN" && sanghs.length > 1 && (
                    <div className="mb-3">
                      <label className="form-label small fw-bold text-dark mb-1">
                        Target Shri Sangh (लक्षित संघ)
                      </label>
                      <select
                        className="form-select form-select-sm"
                        value={broadcastSanghId}
                        onChange={(e) => setBroadcastSanghId(e.target.value)}
                      >
                        {sanghs.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.prefix})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Subject */}
                  <div className="mb-3">
                    <label className="form-label small fw-bold text-dark mb-1">
                      Email Subject (ईमेल विषय) <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. वार्षिक लवाजम जमा करण्याबाबत नम्र सूचना / आगामी पर्युषण पर्व कार्यक्रम"
                      className="form-control form-control-sm"
                      value={broadcastSubject}
                      onChange={(e) => setBroadcastSubject(e.target.value)}
                    />
                  </div>

                  {/* Message Body */}
                  <div className="mb-3">
                    <label className="form-label small fw-bold text-dark mb-1">
                      Announcement Message (संदेश मजकूर) <span className="text-danger">*</span>
                    </label>
                    <textarea
                      required
                      rows={6}
                      placeholder="Write your announcement message here..."
                      className="form-control form-control-sm"
                      value={broadcastMessage}
                      onChange={(e) => setBroadcastMessage(e.target.value)}
                    ></textarea>
                  </div>
                </div>

                <div className="modal-footer bg-light py-2 px-4 d-flex justify-content-between">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setShowBroadcastModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={broadcastSending}
                    className="btn btn-success btn-sm px-4 fw-bold shadow-xs"
                  >
                    {broadcastSending ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1"></span>
                        Dispatching Emails...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-send-fill me-1"></i> Dispatch Announcement
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
          DIRECT FAMILY EMAIL MODAL
          ===================================================================== */}
      {directEmailFam && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1050 }}
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow-lg">
              <div className="modal-header bg-info text-dark py-3 px-4">
                <h5 className="modal-title fw-bold mb-0">
                  <i className="bi bi-envelope-fill me-2"></i>
                  Send Direct Email to Family (परिवार संदेश)
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setDirectEmailFam(null)}
                ></button>
              </div>
              <form onSubmit={handleSendDirectEmail}>
                <div className="modal-body p-4">
                  <div className="bg-light p-2 rounded-3 border mb-3 small">
                    <div><strong>Head of Family:</strong> {directEmailFam.headName}</div>
                    <div><strong>Family ID:</strong> <span className="font-monospace">{directEmailFam.familyId}</span></div>
                    <div><strong>Recipient Email:</strong> <span className="font-monospace text-primary">{directEmailFam.email}</span></div>
                  </div>

                  {directMsg && (
                    <div
                      className={`alert py-2 px-3 small d-flex align-items-center gap-2 mb-3 ${
                        directMsg.type === "success" ? "alert-success" : "alert-danger"
                      }`}
                    >
                      <i className={`bi ${directMsg.type === "success" ? "bi-check-circle-fill" : "bi-exclamation-triangle-fill"}`}></i>
                      <span>{directMsg.text}</span>
                    </div>
                  )}

                  {/* Subject */}
                  <div className="mb-3">
                    <label className="form-label small fw-bold text-dark mb-1">
                      Subject (विषय) <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      className="form-control form-control-sm"
                      value={directSubject}
                      onChange={(e) => setDirectSubject(e.target.value)}
                    />
                  </div>

                  {/* Message */}
                  <div className="mb-2">
                    <label className="form-label small fw-bold text-dark mb-1">
                      Message (संदेश) <span className="text-danger">*</span>
                    </label>
                    <textarea
                      required
                      rows={5}
                      placeholder="Enter personal message for this family..."
                      className="form-control form-control-sm"
                      value={directMessage}
                      onChange={(e) => setDirectMessage(e.target.value)}
                    ></textarea>
                  </div>
                </div>

                <div className="modal-footer bg-light py-2 px-4 d-flex justify-content-between">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setDirectEmailFam(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={directSending}
                    className="btn btn-info text-dark btn-sm px-4 fw-bold shadow-xs"
                  >
                    {directSending ? "Sending..." : "Send Email (ईमेल पाठवा)"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          PHOTO VIEWER MODAL
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
                  <i className="bi bi-image me-2"></i>
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
                  alt="Receipt Proof"
                  className="img-fluid rounded"
                  style={{ maxHeight: "75vh", objectFit: "contain" }}
                />
              </div>
              <div className="modal-footer border-secondary py-2 px-3 d-flex justify-content-between">
                <a
                  href={viewingPhotoUrl}
                  download="lavaajam-receipt.jpg"
                  className="btn btn-outline-light btn-sm"
                >
                  <i className="bi bi-download me-1"></i> Download Photo
                </a>
                <button
                  type="button"
                  onClick={() => setViewingPhotoUrl(null)}
                  className="btn btn-secondary btn-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          PRINTABLE OFFICIAL RECEIPT VOUCHER MODAL
          ===================================================================== */}
      {printingFamily && printingFamily.lavaajam && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.75)", zIndex: 1055 }}
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content rounded-4 border-0 shadow-lg overflow-hidden">
              <div className="modal-header bg-dark text-white py-3 px-4 d-print-none">
                <h5 className="modal-title fw-bold mb-0">
                  <i className="bi bi-receipt-cutoff me-2 text-warning"></i>
                  Official Lavaajam Payment Receipt (अधिकृत लवाजम पावती)
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setPrintingFamily(null)}
                ></button>
              </div>

              {/* Printable Body */}
              <div className="modal-body p-4 bg-white" id="lavaajam-printable-receipt">
                <div className="border border-dark border-2 p-4 rounded-3">
                  {/* Sangh Header */}
                  <div className="text-center pb-3 border-bottom border-dark mb-3">
                    <div className="fs-4 mb-1">॥ श्री जिनाय नमः ॥</div>
                    <h3 className="fw-bold text-dark mb-1">
                      श्री {printingFamily.sangh.name}
                    </h3>
                    <p className="text-muted small mb-0">
                      जिन संस्कार सेतु • वार्षिक लवाजम सहयोग पावती (Lavaajam Contribution Voucher)
                    </p>
                  </div>

                  {/* Receipt Meta */}
                  <div className="row g-2 mb-3 small">
                    <div className="col-6">
                      <span className="text-muted">रसीद क्र. / Receipt No:</span>{" "}
                      <strong className="font-monospace fs-6 text-dark">
                        #{printingFamily.lavaajam.receiptNumber || "N/A"}
                      </strong>
                    </div>
                    <div className="col-6 text-end">
                      <span className="text-muted">दिनांक / Date:</span>{" "}
                      <strong className="text-dark">
                        {printingFamily.lavaajam.paymentDate
                          ? new Date(printingFamily.lavaajam.paymentDate).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                            })
                          : new Date().toLocaleDateString("en-IN")}
                      </strong>
                    </div>
                    <div className="col-6">
                      <span className="text-muted">सत्र / Financial Session:</span>{" "}
                      <strong className="badge bg-warning text-dark border">
                        {selectedYear}
                      </strong>
                    </div>
                    <div className="col-6 text-end">
                      <span className="text-muted">Family ID:</span>{" "}
                      <strong className="font-monospace text-primary fs-6">
                        {printingFamily.familyId}
                      </strong>
                    </div>
                  </div>

                  {/* Family Details Table */}
                  <table className="table table-bordered table-sm align-middle mb-3">
                    <tbody>
                      <tr>
                        <td className="bg-light fw-bold text-dark" style={{ width: "30%" }}>
                          परिवार प्रमुख (Head)
                        </td>
                        <td className="fw-bold fs-6 text-dark">
                          {printingFamily.headName}
                        </td>
                      </tr>
                      <tr>
                        <td className="bg-light fw-bold text-dark">संपर्क (Mobile)</td>
                        <td className="font-monospace">{printingFamily.mobile || "—"}</td>
                      </tr>
                      {printingFamily.email && (
                        <tr>
                          <td className="bg-light fw-bold text-dark">ईमेल (Email)</td>
                          <td className="font-monospace">{printingFamily.email}</td>
                        </tr>
                      )}
                      <tr>
                        <td className="bg-light fw-bold text-dark">पत्ता / Area</td>
                        <td>
                          {printingFamily.address}, {printingFamily.area}
                        </td>
                      </tr>
                      <tr>
                        <td className="bg-light fw-bold text-dark">जमा राशि (Amount)</td>
                        <td>
                          <span className="fs-5 fw-bold text-success font-monospace">
                            ₹{(printingFamily.lavaajam.amount || 0).toLocaleString("en-IN")}/-
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="bg-light fw-bold text-dark">भुगतान माध्यम (Mode)</td>
                        <td className="fw-semibold">
                          {printingFamily.lavaajam.paymentMode || "CASH"}
                        </td>
                      </tr>
                      {printingFamily.lavaajam.notes && (
                        <tr>
                          <td className="bg-light fw-bold text-dark">टिप्पणी (Remarks)</td>
                          <td className="fst-italic">{printingFamily.lavaajam.notes}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Signatures */}
                  <div className="row pt-4 mt-3 align-items-end">
                    <div className="col-12 col-sm-7">
                      <small className="text-muted d-block">
                        प्राप्तकर्ता / Recorded By: <strong>{printingFamily.lavaajam.receiverName || "श्री संघ कार्यालय"}</strong>
                      </small>
                      <small className="text-muted fst-italic" style={{ fontSize: "11px" }}>
                        Computerized receipt generated via Jin Sanskar Setu.
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
