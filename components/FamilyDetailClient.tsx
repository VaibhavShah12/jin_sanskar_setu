"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import ConfirmModal from "@/components/ConfirmModal";
import {
  archiveFamilyAction,
  archiveMemberAction,
  sendFamilyIdCardsEmailAction,
  updateFamilyAndMembersAction,
} from "@/lib/actions/family-actions";
import { submitCorrectionRequestAction } from "@/lib/actions/member-form-actions";
import { sendDirectFamilyEmailAction } from "@/lib/actions/lavaajam-actions";
import { getMemberCalculatedAge } from "@/lib/validation/family";
import { MEMBER_INTERESTS } from "@/lib/constants/interests";
import { getSectLabel } from "@/components/FamilyForm";

interface FamilyDetailClientProps {
  family: any;
  isAdmin: boolean;
  canEdit: boolean;
  canViewLavaajam?: boolean;
  lavaajamRecord?: any;
}

export default function FamilyDetailClient({
  family,
  isAdmin,
  canEdit = false,
  canViewLavaajam = false,
  lavaajamRecord = null,
}: FamilyDetailClientProps) {
  const router = useRouter();
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [memberToArchive, setMemberToArchive] = useState<any | null>(null);
  const [archivingMember, setArchivingMember] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Send Family ID Cards State
  const [sendingCards, setSendingCards] = useState(false);
  const [cardsMsg, setCardsMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSendFamilyIdCards = async () => {
    if (!family.email) {
      alert("No email address registered for this family. Please update the family email first.");
      return;
    }
    const ok = window.confirm(`Send official digital Family ID Cards for all members to ${family.email}?`);
    if (!ok) return;

    setSendingCards(true);
    setCardsMsg(null);
    try {
      const res = await sendFamilyIdCardsEmailAction(family.id);
      if (res.success) {
        setCardsMsg({ type: "success", text: res.message || "Family ID Cards successfully emailed!" });
      } else {
        setCardsMsg({ type: "error", text: res.error || "Failed to send ID cards." });
      }
    } catch (err: any) {
      setCardsMsg({ type: "error", text: err?.message || "Failed to send ID cards." });
    } finally {
      setSendingCards(false);
    }
  };

  // Direct Edit Family & Members State (Admins / Volunteers)
  const [showEditModal, setShowEditModal] = useState(false);
  const [editActiveTab, setEditActiveTab] = useState<"HOUSEHOLD" | "MEMBERS">("HOUSEHOLD");
  const [editingData, setEditingData] = useState({
    headName: family.headName || "",
    mobile: family.mobile || "",
    email: family.email || "",
    address: family.address || "",
    lane: family.lane || "",
    area: family.area || "",
    nativePlace: family.nativePlace || "",
    sect: family.sect || "",
    otherSect: family.otherSect || "",
    headOccupation: family.headOccupation || "",
    headBloodGroup: family.headBloodGroup || "",
    members: (family.members || []).map((m: any) => ({
      id: m.id,
      memberId: m.memberId,
      name: m.name || "",
      age: m.age || 0,
      dateOfBirth: m.dateOfBirth ? new Date(m.dateOfBirth).toISOString().split("T")[0] : "",
      gender: m.gender || "MALE",
      relationship: m.relationship || "SPOUSE",
      maritalStatus: m.maritalStatus || "UNMARRIED",
      wifeName: m.wifeName || "",
      wifeContact: m.wifeContact || "",
      husbandName: m.husbandName || "",
      residenceLocation: m.residenceLocation || "IN_PUNE",
      bloodGroup: m.bloodGroup || "",
      whatsappNumber: m.whatsappNumber || "",
      occupation: m.occupation || "",
    })),
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  const handleAddNewMemberInEdit = () => {
    setEditingData((prev) => ({
      ...prev,
      members: [
        ...prev.members,
        {
          name: "",
          age: 5,
          dateOfBirth: "",
          gender: "MALE",
          relationship: "GRANDCHILD",
          maritalStatus: "UNMARRIED",
          wifeName: "",
          wifeContact: "",
          husbandName: "",
          residenceLocation: "IN_PUNE",
          bloodGroup: "",
          whatsappNumber: "",
          occupation: "STUDENT",
        },
      ],
    }));
  };

  const handleRemoveMemberInEdit = (idx: number) => {
    setEditingData((prev) => ({
      ...prev,
      members: prev.members.filter((_: any, i: number) => i !== idx),
    }));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEdit(true);
    setEditError(null);
    setEditSuccess(null);

    try {
      const res = await updateFamilyAndMembersAction({
        familyId: family.id,
        headName: editingData.headName,
        mobile: editingData.mobile,
        email: editingData.email,
        address: editingData.address,
        lane: editingData.lane,
        area: editingData.area,
        nativePlace: editingData.nativePlace,
        sect: editingData.sect,
        otherSect: editingData.otherSect,
        headOccupation: editingData.headOccupation,
        headBloodGroup: editingData.headBloodGroup,
        members: editingData.members,
      });

      if (!res.success) {
        setEditError(res.error || "Failed to update family details.");
      } else {
        setEditSuccess(res.message || "Updated successfully!");
        setTimeout(() => {
          setShowEditModal(false);
          router.refresh();
        }, 1200);
      }
    } catch (err: any) {
      setEditError(err?.message || "An unexpected error occurred.");
    } finally {
      setSavingEdit(false);
    }
  };

  // Correction Request State
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [submittingCorrection, setSubmittingCorrection] = useState(false);
  const [correctionSuccess, setCorrectionSuccess] = useState<string | null>(null);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [correctionForm, setCorrectionForm] = useState({
    newAddress: family.address || "",
    newArea: family.area || "",
    newNativePlace: family.nativePlace || "",
    newOccupation: "",
    newMobile: "",
    correctionDetails: "",
    additionalNotes: "",
  });

  // Direct Family Email State
  const [showDirectEmailModal, setShowDirectEmailModal] = useState(false);
  const [directSubject, setDirectSubject] = useState(`श्री ${family.sangh?.name || "संघ"} - परिवार संपर्क (${family.familyId})`);
  const [directMessage, setDirectMessage] = useState("");
  const [directSending, setDirectSending] = useState(false);
  const [directEmailMsg, setDirectEmailMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSendDirectEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setDirectSending(true);
    setDirectEmailMsg(null);
    try {
      const res = await sendDirectFamilyEmailAction({
        familyId: family.familyId,
        subject: directSubject,
        message: directMessage,
      });
      if (res.success) {
        setDirectEmailMsg({ type: "success", text: res.message || "Email sent successfully!" });
        setDirectMessage("");
        setTimeout(() => setShowDirectEmailModal(false), 2000);
      } else {
        setDirectEmailMsg({ type: "error", text: res.error || "Failed to send email." });
      }
    } catch (err: any) {
      setDirectEmailMsg({ type: "error", text: err?.message || "An unexpected error occurred." });
    } finally {
      setDirectSending(false);
    }
  };

  // Archive Family (ADMIN ONLY)
  const handleArchive = async () => {
    setArchiving(true);
    setErrorMsg(null);
    try {
      const res = await archiveFamilyAction(family.id);
      if (!res.success) {
        setErrorMsg(res.error || "Failed to archive family.");
        setArchiving(false);
        setShowArchiveModal(false);
        return;
      }
      router.push("/families?archived=true");
    } catch (err: any) {
      setErrorMsg(err?.message || "An unexpected error occurred.");
      setArchiving(false);
      setShowArchiveModal(false);
    }
  };

  // Archive Single Member (ADMIN ONLY)
  const handleArchiveMember = async () => {
    if (!memberToArchive) return;
    setArchivingMember(true);
    setErrorMsg(null);
    try {
      const res = await archiveMemberAction(memberToArchive.id);
      if (!res.success) {
        setErrorMsg(res.error || "Failed to archive member.");
        setArchivingMember(false);
        setMemberToArchive(null);
        return;
      }
      setArchivingMember(false);
      setMemberToArchive(null);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err?.message || "An unexpected error occurred.");
      setArchivingMember(false);
      setMemberToArchive(null);
    }
  };

  return (
    <>
      {errorMsg && (
        <div className="alert alert-danger py-2 px-3 small mb-4" role="alert">
          {errorMsg}
        </div>
      )}

      {/* Alert for Emailing Family ID Cards */}
      {cardsMsg && (
        <div className={`alert ${cardsMsg.type === "success" ? "alert-success" : "alert-danger"} alert-dismissible fade show mb-3 shadow-xs`}>
          <i className={`bi ${cardsMsg.type === "success" ? "bi-check-circle-fill text-success" : "bi-exclamation-triangle-fill text-danger"} me-2`}></i>
          {cardsMsg.text}
          <button type="button" className="btn-close" onClick={() => setCardsMsg(null)}></button>
        </div>
      )}

      {/* Household Profile Card */}
      <div className="card-clean p-4 mb-4 bg-white">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-start gap-3 mb-3 pb-3 border-bottom">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="font-monospace fs-4 fw-bold text-primary">{family.familyId}</span>
              <span className="badge-sangh font-monospace fs-6">{family.sangh.prefix}</span>
              {family.status === "ARCHIVED" && (
                <span className="badge bg-secondary">Archived</span>
              )}
            </div>
            <h2 className="h4 fw-bold text-dark mb-0">{family.headName}&apos;s Family</h2>
            <small className="text-muted">
              {family.sangh.name} • Registered on {new Date(family.createdAt).toLocaleDateString()}
            </small>
          </div>

          {/* Action Buttons */}
          <div className="d-flex flex-wrap gap-2">
            {/* Direct Edit Details (Admins & Volunteers) */}
            {canEdit && (
              <button
                onClick={() => {
                  setShowEditModal(true);
                  setEditError(null);
                  setEditSuccess(null);
                }}
                className="btn btn-jain-primary btn-sm px-3 shadow-sm d-flex align-items-center gap-1"
                title="Directly edit family and member details (Blood group, foreigner status, sect, lane, marital info)"
              >
                <i className="bi bi-pencil-fill"></i>
                <span>Edit Details (संशोधन करें)</span>
              </button>
            )}

            {/* Email Family ID Cards */}
            {family.email && (
              <button
                onClick={handleSendFamilyIdCards}
                disabled={sendingCards}
                className="btn btn-outline-success btn-sm px-3 shadow-sm d-flex align-items-center gap-1 fw-semibold text-dark"
                title="Send official digital Family ID Cards for all members to registered email"
              >
                <i className="bi bi-card-heading text-success"></i>
                <span>{sendingCards ? "Sending..." : "✉️ Email Family ID Cards"}</span>
              </button>
            )}

            <button
              onClick={() => {
                setShowCorrectionModal(true);
                setCorrectionSuccess(null);
                setCorrectionError(null);
              }}
              className="btn btn-outline-warning btn-sm px-3 text-dark fw-semibold shadow-sm"
              title="Submit a profile update or correction request"
            >
              <i className="bi bi-pencil-square me-1 text-warning-emphasis"></i> Request Correction
            </button>
            {family.email && (
              <button
                onClick={() => {
                  setShowDirectEmailModal(true);
                  setDirectEmailMsg(null);
                }}
                className="btn btn-outline-info btn-sm px-3 text-dark fw-semibold shadow-sm"
                title="Send official message to registered email"
              >
                <i className="bi bi-envelope-at me-1 text-info"></i> Send Email
              </button>
            )}
            {isAdmin && family.status === "ACTIVE" && (
              <button
                onClick={() => setShowArchiveModal(true)}
                className="btn btn-outline-danger btn-sm px-3 shadow-sm"
              >
                <i className="bi bi-archive me-1"></i> Archive Family
              </button>
            )}
          </div>
        </div>

        <div className="row g-3">
          <div className="col-12 col-sm-6 col-md-3">
            <span className="text-muted small d-block">Head of Family</span>
            <strong className="fs-6 text-dark">{family.headName}</strong>
          </div>
          <div className="col-12 col-sm-6 col-md-3">
            <span className="text-muted small d-block">Mobile Contact</span>
            <a href={`tel:${family.mobile}`} className="text-decoration-none fw-semibold text-primary">
              <i className="bi bi-telephone-fill me-1"></i> {family.mobile}
            </a>
          </div>
          {family.email && (
            <div className="col-12 col-sm-6 col-md-3">
              <span className="text-muted small d-block">Registered Email</span>
              <a href={`mailto:${family.email}`} className="text-decoration-none fw-semibold text-primary">
                <i className="bi bi-envelope-fill me-1"></i> {family.email}
              </a>
            </div>
          )}
          <div className="col-12 col-sm-6 col-md-3">
            <span className="text-muted small d-block">Area / Locality</span>
            <span className="fw-semibold text-dark">{family.area}</span>
          </div>
          <div className="col-12 col-sm-6 col-md-3">
            <span className="text-muted small d-block">Total Members</span>
            <span className="badge bg-light text-dark border px-2 py-1 fs-6">
              {family.members.length} members
            </span>
          </div>
          {family.lane && (
            <div className="col-12 col-sm-6 col-md-3">
              <span className="text-muted small d-block">Lane / Gali / Road</span>
              <strong className="fs-6 text-dark">
                <i className="bi bi-signpost-split text-primary me-1"></i>
                {family.lane}
              </strong>
            </div>
          )}
          {family.nativePlace && (
            <div className="col-12 col-sm-6 col-md-3">
              <span className="text-muted small d-block">Native Village / Mul Gaam</span>
              <strong className="fs-6 text-dark">
                <i className="bi bi-house-door text-primary me-1"></i>
                {family.nativePlace}
              </strong>
            </div>
          )}
          {family.sect && (
            <div className="col-12 col-sm-6 col-md-3">
              <span className="text-muted small d-block">Jain Sect / Sampradaya</span>
              <strong className="fs-6 text-dark">
                <i className="bi bi-tag text-primary me-1"></i>
                {getSectLabel(family.sect, family.otherSect)}
              </strong>
            </div>
          )}
          <div className="col-12">
            <span className="text-muted small d-block">Residential Address</span>
            <span className="text-secondary">{family.address}</span>
          </div>

          {/* Sangh Lavaajam Status (TRUSTEE & ADMIN ONLY) */}
          {canViewLavaajam && (
            <div className="col-12 mt-3 pt-3 border-top">
              <div className="d-flex flex-wrap align-items-center justify-content-between p-3 rounded-3 bg-light border gap-2">
                <div className="d-flex align-items-center gap-3">
                  <div
                    className={`p-2 rounded-circle d-flex align-items-center justify-content-center ${
                      lavaajamRecord?.status === "PAID"
                        ? "bg-success-subtle text-success"
                        : "bg-warning-subtle text-warning-emphasis"
                    }`}
                    style={{ width: "42px", height: "42px" }}
                  >
                    <i
                      className={`bi ${
                        lavaajamRecord?.status === "PAID"
                          ? "bi-check-circle-fill fs-5"
                          : "bi-exclamation-circle-fill fs-5"
                      }`}
                    ></i>
                  </div>
                  <div>
                    <div className="d-flex align-items-center gap-2">
                      <span className="fw-bold text-dark">Sangh Lavaajam (2026-2027)</span>
                      <span
                        className={`badge ${
                          lavaajamRecord?.status === "PAID"
                            ? "bg-success"
                            : "bg-warning text-dark"
                        }`}
                      >
                        {lavaajamRecord?.status === "PAID" ? "PAID (जमा)" : "PENDING (बाकी)"}
                      </span>
                    </div>
                    <small className="text-muted d-block mt-1">
                      {lavaajamRecord?.status === "PAID" ? (
                        <>
                          Receipt #{lavaajamRecord.receiptNumber || "N/A"} • Receiver: {lavaajamRecord.receiverName || "N/A"}
                          {lavaajamRecord.amount ? ` • ₹${lavaajamRecord.amount}` : ""}
                          {lavaajamRecord.paymentDate ? ` • Date: ${new Date(lavaajamRecord.paymentDate).toLocaleDateString()}` : ""}
                        </>
                      ) : (
                        "Annual Sangh Lavaajam has not been recorded as paid yet for this family."
                      )}
                    </small>
                  </div>
                </div>
                <Link
                  href={`/lavaajam?year=2026-2027&search=${encodeURIComponent(family.familyId)}`}
                  className="btn btn-sm btn-outline-primary fw-medium"
                >
                  <i className="bi bi-pencil-square me-1"></i> Open in Lavaajam Register
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Members Section */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3 className="h5 fw-bold text-dark mb-0">
          Family Members ({family.members.length})
        </h3>
      </div>

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
                <th>Field of Interests</th>
                <th className="text-end pe-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {family.members.map((m: any) => {
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
                        <span className="badge bg-secondary ms-2">Head</span>
                      )}
                      {m.bloodGroup && (
                        <span className="badge bg-danger-subtle text-danger border border-danger-subtle ms-2 small">
                          🩸 {m.bloodGroup}
                        </span>
                      )}
                      {m.status === "ARCHIVED" && (
                        <span className="badge bg-secondary ms-1">Archived</span>
                      )}
                      {m.occupation && (
                        <span className="badge bg-secondary-subtle text-secondary border ms-2 small">
                          <i className="bi bi-briefcase me-1"></i>{m.occupation}
                        </span>
                      )}
                      {m.whatsappNumber && (
                        <div className="small text-success fw-normal mt-1">
                          <i className="bi bi-whatsapp me-1"></i>{m.whatsappNumber}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="fw-semibold text-dark">{calculatedAge} yrs</span>
                      {isChild && <span className="badge bg-warning text-dark ms-1">Child</span>}
                      {dobString && (
                        <div className="small text-muted font-monospace">{dobString}</div>
                      )}
                    </td>
                    <td className="text-capitalize">{m.gender.toLowerCase().replace(/_/g, " ")}</td>
                    <td>
                      <div className="fw-medium">
                        {m.relationship === "DAUGHTER_IN_LAW" ? "Daughter-in-law (पुत्रवधू)" : m.relationship}
                      </div>
                      {m.relationship === "SON" && (
                        <div className="small mt-1">
                          {m.maritalStatus === "MARRIED" ? (
                            <span className="text-primary">
                              <i className="bi bi-heart me-1"></i>
                              Wife: <strong>{m.wifeName || "—"}</strong>
                              {m.wifeContact ? ` (${m.wifeContact})` : ""}
                            </span>
                          ) : (
                            <span className="text-muted">Unmarried</span>
                          )}
                        </div>
                      )}
                      {m.husbandName && (
                        <div className="small text-primary mt-1">
                          <i className="bi bi-person-heart me-1"></i>
                          Husband: <strong>{m.husbandName}</strong>
                        </div>
                      )}
                      {m.residenceLocation && (
                        <div className="small mt-1">
                          {m.residenceLocation === "FOREIGN" ? (
                            <span className="badge bg-danger text-white">
                              <i className="bi bi-airplane-fill me-1"></i>In Foreign (विदेश / NRI)
                            </span>
                          ) : m.residenceLocation === "OUT_OF_PUNE" ? (
                            <span className="badge bg-secondary-subtle text-secondary border">
                              📍 Outside Pune
                            </span>
                          ) : (
                            <span className="badge bg-success-subtle text-success border border-success-subtle">
                              📍 In Pune
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      {m.interests && m.interests.length > 0 ? (
                        <div className="d-flex flex-wrap gap-1" style={{ maxWidth: "280px" }}>
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
                      <div className="d-inline-flex align-items-center gap-1">
                        <Link href={`/members/${m.id}`} className="btn btn-outline-secondary btn-sm">
                          View
                        </Link>
                        {/* Member Archive: ONLY ADMIN */}
                        {isAdmin && m.status === "ACTIVE" && (
                          <button
                            onClick={() => setMemberToArchive(m)}
                            className="btn btn-outline-danger btn-sm"
                            title="Archive Member (Admin Only)"
                          >
                            <i className="bi bi-person-x"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards View */}
      <div className="d-lg-none d-flex flex-column gap-3 mb-4">
        {family.members.map((m: any) => {
          const calculatedAge = getMemberCalculatedAge(m);
          const isChild = calculatedAge < 18;
          const dobString = m.dateOfBirth
            ? new Date(m.dateOfBirth).toISOString().split("T")[0]
            : null;

          return (
            <div key={m.id} className={`card-clean p-3 ${isChild ? "border-warning" : ""}`}>
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <Link href={`/members/${m.id}`} className="font-monospace fw-bold text-primary fs-6 text-decoration-none">
                    {m.memberId}
                  </Link>
                  <h6 className="fw-bold text-dark mb-0 mt-1">
                    {m.name} {m.relationship === "HEAD" && <span className="badge bg-secondary ms-1">Head</span>}
                    {m.bloodGroup && (
                      <span className="badge bg-danger-subtle text-danger border border-danger-subtle ms-1 small">
                        🩸 {m.bloodGroup}
                      </span>
                    )}
                    {m.status === "ARCHIVED" && <span className="badge bg-secondary ms-1">Archived</span>}
                    {m.occupation && (
                      <span className="badge bg-secondary-subtle text-secondary border ms-1 small">
                        <i className="bi bi-briefcase me-1"></i>{m.occupation}
                      </span>
                    )}
                  </h6>
                  {m.relationship === "SON" && (
                    <div className="small mt-1">
                      {m.maritalStatus === "MARRIED" ? (
                        <span className="text-primary">
                          <i className="bi bi-heart me-1"></i>
                          Wife: <strong>{m.wifeName || "—"}</strong>
                          {m.wifeContact ? ` (${m.wifeContact})` : ""}
                        </span>
                      ) : (
                        <span className="text-muted">Unmarried</span>
                      )}
                    </div>
                  )}
                  {m.whatsappNumber && (
                    <div className="small text-success mt-1">
                      <i className="bi bi-whatsapp me-1"></i>{m.whatsappNumber}
                    </div>
                  )}
                  {m.husbandName && (
                    <div className="small text-primary mt-1">
                      <i className="bi bi-person-heart me-1"></i>
                      Husband: <strong>{m.husbandName}</strong>
                    </div>
                  )}
                  {m.residenceLocation && (
                    <div className="small mt-1">
                      {m.residenceLocation === "FOREIGN" ? (
                        <span className="badge bg-danger text-white">
                          <i className="bi bi-airplane-fill me-1"></i>In Foreign (विदेश / NRI)
                        </span>
                      ) : m.residenceLocation === "OUT_OF_PUNE" ? (
                        <span className="badge bg-secondary-subtle text-secondary border">
                          📍 Outside Pune
                        </span>
                      ) : (
                        <span className="badge bg-success-subtle text-success border border-success-subtle">
                          📍 In Pune
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-end">
                  <span className="badge bg-light text-secondary border">
                    {m.relationship === "DAUGHTER_IN_LAW" ? "Daughter-in-law" : m.relationship} • {calculatedAge} yrs
                  </span>
                  {dobString && (
                    <div className="small text-muted font-monospace">{dobString}</div>
                  )}
                </div>
              </div>

              <div className="pt-2 border-top small mb-2">
                <span className="text-muted d-block fs-8 mb-1">Field of Interests (रुचि):</span>
                {m.interests && m.interests.length > 0 ? (
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
                ) : (
                  <span className="text-muted small fst-italic">None specified</span>
                )}
              </div>

              <div className="d-flex justify-content-end align-items-center gap-2 pt-2 border-top">
                <Link href={`/members/${m.id}`} className="btn btn-sm btn-outline-primary px-3">
                  View Full Profile <i className="bi bi-arrow-right ms-1"></i>
                </Link>
                {/* Member Archive: ONLY ADMIN */}
                {isAdmin && m.status === "ACTIVE" && (
                  <button
                    onClick={() => setMemberToArchive(m)}
                    className="btn btn-sm btn-outline-danger px-2"
                    title="Archive Member (Admin Only)"
                  >
                    <i className="bi bi-person-x me-1"></i> Archive
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Survey & Form Submission Attribution Card (At the last below) */}
      <div className="card-clean p-4 mb-4 bg-white border border-primary-subtle shadow-sm">
        <div className="d-flex align-items-center gap-2 mb-3 pb-2 border-bottom">
          <div className="p-2 bg-primary-subtle rounded-circle text-primary">
            <i className="bi bi-clipboard2-check fs-5"></i>
          </div>
          <div>
            <h5 className="fs-6 fw-bold text-dark mb-0">Survey Entry &amp; Submission Attribution (सर्वेक्षण प्रविष्टि विवरण)</h5>
            <small className="text-muted">Attribution of the volunteer who surveyed this family and the family member who provided details.</small>
          </div>
        </div>
        <div className="row g-3 small">
          <div className="col-12 col-sm-6 col-md-4">
            <span className="text-muted d-block">Who Added This Family (Volunteer / स्वयंसेवक):</span>
            <strong className="fs-6 text-primary">
              <i className="bi bi-person-badge me-1"></i>
              {family.volunteerName || family.createdBy || "Sangh Volunteer"}
            </strong>
          </div>
          <div className="col-12 col-sm-6 col-md-4">
            <span className="text-muted d-block">Form Filled / Names Provided By (Family Member / सदस्य):</span>
            <strong className="fs-6 text-success">
              <i className="bi bi-person-check me-1"></i>
              {family.filledByMember || "Family Member"}
            </strong>
          </div>
          <div className="col-12 col-sm-6 col-md-4">
            <span className="text-muted d-block">Survey Registration Date:</span>
            <span className="fw-semibold text-dark">
              <i className="bi bi-calendar3 me-1"></i>
              {new Date(family.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Archiving Family (ADMIN ONLY) */}
      <ConfirmModal
        isOpen={showArchiveModal}
        title="Archive Family Record?"
        message={`Are you sure you want to archive ${family.familyId} (${family.headName}) and all associated members? Data will be preserved in PostgreSQL but hidden from active community directories.`}
        confirmText="Yes, Archive Family"
        confirmVariant="danger"
        isLoading={archiving}
        onConfirm={handleArchive}
        onCancel={() => setShowArchiveModal(false)}
      />

      {/* Confirmation Modal for Archiving Single Member (ADMIN ONLY) */}
      <ConfirmModal
        isOpen={!!memberToArchive}
        title="Archive Individual Member?"
        message={`Are you sure you want to archive member ${memberToArchive?.memberId} (${memberToArchive?.name})? The family record will remain active, but this member will be archived.`}
        confirmText="Yes, Archive Member"
        confirmVariant="danger"
        isLoading={archivingMember}
        onConfirm={handleArchiveMember}
        onCancel={() => setMemberToArchive(null)}
      />

      {/* Profile Correction Request Modal */}
      {showCorrectionModal && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-warning bg-opacity-25 border-bottom">
                <h5 className="modal-title fs-6 fw-bold text-dark">
                  <i className="bi bi-pencil-square text-warning-emphasis me-2"></i>
                  Request Profile Correction (विवरण सुधार अनुरोध)
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowCorrectionModal(false)}></button>
              </div>

              {correctionSuccess ? (
                <div className="modal-body p-4 text-center">
                  <div className="display-4 text-success mb-3">
                    <i className="bi bi-check-circle-fill"></i>
                  </div>
                  <h5 className="fw-bold text-dark">Correction Request Submitted!</h5>
                  <p className="text-muted small mb-3">
                    Your request has been recorded under reference number:
                  </p>
                  <div className="alert alert-success d-inline-block font-monospace fw-bold fs-5 px-4 py-2 mb-3">
                    {correctionSuccess}
                  </div>
                  <p className="text-muted small">
                    Sangh Trustees will review and approve the requested updates. Once verified, the database will be automatically synced.
                  </p>
                  <button type="button" className="btn btn-primary btn-sm px-4" onClick={() => setShowCorrectionModal(false)}>
                    Close
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setSubmittingCorrection(true);
                    setCorrectionError(null);
                    try {
                      const res = await submitCorrectionRequestAction({
                        familyId: family.id,
                        newAddress: correctionForm.newAddress,
                        newArea: correctionForm.newArea,
                        newNativePlace: correctionForm.newNativePlace,
                        newOccupation: correctionForm.newOccupation,
                        newMobile: correctionForm.newMobile,
                        correctionDetails: correctionForm.correctionDetails,
                        additionalNotes: correctionForm.additionalNotes,
                      });
                      if (!res.success) {
                        setCorrectionError(res.error || "Failed to submit request.");
                      } else {
                        setCorrectionSuccess(res.submissionNumber || "REQ-SUBMITTED");
                      }
                    } catch (err: any) {
                      setCorrectionError(err?.message || "An unexpected error occurred.");
                    } finally {
                      setSubmittingCorrection(false);
                    }
                  }}
                >
                  <div className="modal-body p-4">
                    {correctionError && (
                      <div className="alert alert-danger small mb-3">
                        <i className="bi bi-exclamation-triangle-fill me-1"></i> {correctionError}
                      </div>
                    )}
                    <p className="text-muted small mb-3">
                      Enter any fields that need updating for family <strong>{family.headName}</strong> ({family.familyId}). Unchanged fields can be left as-is.
                    </p>

                    <div className="row g-3">
                      <div className="col-12 col-md-8">
                        <label className="form-label small fw-semibold text-dark">Residential Address</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={correctionForm.newAddress}
                          onChange={(e) => setCorrectionForm({ ...correctionForm, newAddress: e.target.value })}
                          placeholder="Full flat / building / street address"
                        />
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small fw-semibold text-dark">Area / Locality</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={correctionForm.newArea}
                          onChange={(e) => setCorrectionForm({ ...correctionForm, newArea: e.target.value })}
                          placeholder="e.g. Bibvewadi, Salisbury Park"
                        />
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label small fw-semibold text-dark">Native Village / Mul Gaam (મૂળ ગામ)</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={correctionForm.newNativePlace}
                          onChange={(e) => setCorrectionForm({ ...correctionForm, newNativePlace: e.target.value })}
                          placeholder="e.g. Patan, Palanpur, Sirohi"
                        />
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label small fw-semibold text-dark">Primary Mobile (if changed)</label>
                        <input
                          type="tel"
                          maxLength={10}
                          className="form-control form-control-sm"
                          value={correctionForm.newMobile}
                          onChange={(e) => setCorrectionForm({ ...correctionForm, newMobile: e.target.value })}
                          placeholder="e.g. 9822012345 (Leave blank if same)"
                        />
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label small fw-semibold text-dark">Head Occupation</label>
                        <select
                          className="form-select form-select-sm"
                          value={correctionForm.newOccupation}
                          onChange={(e) => setCorrectionForm({ ...correctionForm, newOccupation: e.target.value })}
                        >
                          <option value="">-- Keep Current / Not Changed --</option>
                          <option value="SERVICE">Service (Job)</option>
                          <option value="BUSINESS">Business</option>
                          <option value="RETIRED">Retired</option>
                          <option value="HOUSEWIFE">Housewife</option>
                          <option value="STUDENT">Student</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                      <div className="col-12">
                        <label className="form-label small fw-semibold text-dark">Family Member Corrections or Additions</label>
                        <textarea
                          className="form-control form-control-sm"
                          rows={3}
                          value={correctionForm.correctionDetails}
                          onChange={(e) => setCorrectionForm({ ...correctionForm, correctionDetails: e.target.value })}
                          placeholder="e.g. Please add newborn daughter Jiya born on 15/08/2026 / Update son's age to 14"
                        ></textarea>
                      </div>
                      <div className="col-12">
                        <label className="form-label small fw-semibold text-dark">Additional Remarks / Message to Sangh</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={correctionForm.additionalNotes}
                          onChange={(e) => setCorrectionForm({ ...correctionForm, additionalNotes: e.target.value })}
                          placeholder="Optional notes or convenient time to call"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCorrectionModal(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-warning btn-sm px-4 fw-semibold text-dark shadow-sm" disabled={submittingCorrection}>
                      {submittingCorrection ? "Submitting..." : "Submit Correction Request"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Direct Family Email Modal */}
      {showDirectEmailModal && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1050 }} role="dialog">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow-lg">
              <div className="modal-header bg-info text-dark py-3 px-4">
                <h5 className="modal-title fw-bold mb-0">
                  <i className="bi bi-envelope-at-fill me-2"></i>
                  Send Email to {family.headName} ({family.familyId})
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowDirectEmailModal(false)}></button>
              </div>
              <form onSubmit={handleSendDirectEmail}>
                <div className="modal-body p-4">
                  <div className="bg-light p-2 rounded-3 border mb-3 small">
                    <div><strong>Head of Family:</strong> {family.headName}</div>
                    <div><strong>Recipient Email:</strong> <span className="font-monospace text-primary">{family.email}</span></div>
                  </div>

                  {directEmailMsg && (
                    <div className={`alert py-2 px-3 small d-flex align-items-center gap-2 mb-3 ${
                      directEmailMsg.type === "success" ? "alert-success" : "alert-danger"
                    }`}>
                      <i className={`bi ${directEmailMsg.type === "success" ? "bi-check-circle-fill" : "bi-exclamation-triangle-fill"}`}></i>
                      <span>{directEmailMsg.text}</span>
                    </div>
                  )}

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

                  <div className="mb-2">
                    <label className="form-label small fw-bold text-dark mb-1">
                      Message (संदेश) <span className="text-danger">*</span>
                    </label>
                    <textarea
                      required
                      rows={5}
                      placeholder="Type your message here..."
                      className="form-control form-control-sm"
                      value={directMessage}
                      onChange={(e) => setDirectMessage(e.target.value)}
                    ></textarea>
                  </div>
                </div>

                <div className="modal-footer bg-light py-2 px-4 d-flex justify-content-between">
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowDirectEmailModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" disabled={directSending} className="btn btn-info text-dark btn-sm px-4 fw-bold shadow-xs">
                    {directSending ? "Sending..." : "Send Email (ईमेल पाठवा)"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          DIRECT EDIT FAMILY & MEMBERS MODAL (ADMINS & VOLUNTEERS)
          ===================================================================== */}
      {showEditModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.65)", zIndex: 1060 }}
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable">
            <div className="modal-content rounded-4 border-0 shadow-lg overflow-hidden">
              <div className="modal-header bg-primary text-white py-3 px-4">
                <div>
                  <h5 className="modal-title fw-bold mb-0">
                    <i className="bi bi-pencil-square me-2"></i>
                    Edit Family &amp; Members (पारिवारिक विवरण संशोधन)
                  </h5>
                  <small className="text-white-50">
                    Family ID: {family.familyId} • Sangh: {family.sangh?.name} • Head: {family.headName}
                  </small>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowEditModal(false)}
                ></button>
              </div>

              {/* Tabs Navigation */}
              <div className="bg-light border-bottom px-4 pt-2">
                <ul className="nav nav-tabs border-0">
                  <li className="nav-item">
                    <button
                      type="button"
                      onClick={() => setEditActiveTab("HOUSEHOLD")}
                      className={`nav-link fw-semibold ${editActiveTab === "HOUSEHOLD" ? "active border-bottom-0 bg-white text-primary" : "text-secondary"}`}
                    >
                      <i className="bi bi-house-door me-1"></i> Household Details (घर व परिवार)
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      type="button"
                      onClick={() => setEditActiveTab("MEMBERS")}
                      className={`nav-link fw-semibold ${editActiveTab === "MEMBERS" ? "active border-bottom-0 bg-white text-primary" : "text-secondary"}`}
                    >
                      <i className="bi bi-people me-1"></i> Family Members ({editingData.members.length}) (सदस्य सूची)
                    </button>
                  </li>
                </ul>
              </div>

              <form onSubmit={handleSaveEdit}>
                <div className="modal-body p-4" style={{ maxHeight: "calc(80vh - 140px)", overflowY: "auto" }}>
                  {editSuccess && (
                    <div className="alert alert-success d-flex align-items-center gap-2 mb-3 shadow-xs">
                      <i className="bi bi-check-circle-fill fs-5"></i>
                      <span>{editSuccess}</span>
                    </div>
                  )}

                  {editError && (
                    <div className="alert alert-danger d-flex align-items-center gap-2 mb-3 shadow-xs">
                      <i className="bi bi-exclamation-triangle-fill fs-5"></i>
                      <span>{editError}</span>
                    </div>
                  )}

                  {/* TAB 1: HOUSEHOLD DETAILS */}
                  {editActiveTab === "HOUSEHOLD" && (
                    <div className="row g-3">
                      <div className="col-12 col-md-6">
                        <label className="form-label small fw-semibold text-dark mb-1">
                          Head of Family Full Name <span className="text-danger">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          className="form-control form-control-sm"
                          value={editingData.headName}
                          onChange={(e) => setEditingData({ ...editingData, headName: e.target.value })}
                        />
                      </div>

                      <div className="col-12 col-md-6">
                        <label className="form-label small fw-semibold text-dark mb-1">
                          Head Mobile / WhatsApp Contact
                        </label>
                        <input
                          type="tel"
                          maxLength={15}
                          className="form-control form-control-sm"
                          value={editingData.mobile}
                          onChange={(e) => setEditingData({ ...editingData, mobile: e.target.value })}
                        />
                      </div>

                      <div className="col-12 col-md-6">
                        <label className="form-label small fw-semibold text-dark mb-1">
                          Registered Email ID <span className="text-danger">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          className="form-control form-control-sm"
                          value={editingData.email}
                          onChange={(e) => setEditingData({ ...editingData, email: e.target.value })}
                        />
                        <div className="form-text small">Used for digital family ID cards &amp; Lavaajam receipts.</div>
                      </div>

                      <div className="col-12 col-md-6">
                        <label className="form-label small fw-semibold text-dark mb-1">
                          Area / Locality <span className="text-danger">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          className="form-control form-control-sm"
                          value={editingData.area}
                          onChange={(e) => setEditingData({ ...editingData, area: e.target.value })}
                        />
                      </div>

                      <div className="col-12 col-md-6">
                        <label className="form-label small fw-semibold text-dark mb-1">
                          <i className="bi bi-signpost-split text-primary me-1"></i>
                          Lane / Gali / Road / शेरी
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="e.g. Lane No. 4, Gali No. 2, Main Street"
                          value={editingData.lane}
                          onChange={(e) => setEditingData({ ...editingData, lane: e.target.value })}
                        />
                      </div>

                      <div className="col-12 col-md-6">
                        <label className="form-label small fw-semibold text-dark mb-1">
                          Native Village / Mul Gaam (મૂળ ગામ)
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={editingData.nativePlace}
                          onChange={(e) => setEditingData({ ...editingData, nativePlace: e.target.value })}
                        />
                      </div>

                      <div className="col-12">
                        <label className="form-label small fw-semibold text-dark mb-1">
                          Residential Address <span className="text-danger">*</span>
                        </label>
                        <textarea
                          rows={2}
                          required
                          className="form-control form-control-sm"
                          value={editingData.address}
                          onChange={(e) => setEditingData({ ...editingData, address: e.target.value })}
                        ></textarea>
                      </div>

                      {/* Jain Sect / Sampradaya */}
                      <div className="col-12 col-md-6">
                        <label className="form-label small fw-semibold text-dark mb-1">
                          <i className="bi bi-tag text-primary me-1"></i>
                          Jain Sect (सम्प्रदाय / फिरका)
                        </label>
                        <select
                          className="form-select form-select-sm"
                          value={editingData.sect}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditingData({
                              ...editingData,
                              sect: val,
                              otherSect: val === "OTHER" ? editingData.otherSect : "",
                            });
                          }}
                        >
                          <option value="">Select Sect</option>
                          <option value="MURTIPUJAK">Murtipujak (मूर्तिपूजक / મૂર્તિપૂજક)</option>
                          <option value="STHANAKWASI">Sthanakwasi (स्थानकवासी / સ્થાનકવાસી)</option>
                          <option value="DIGAMBAR">Digambar (दिगंबर / દિગંબર)</option>
                          <option value="TERAPANTHI">Terapanthi (तेरापंथी / તેરાપંથી)</option>
                          <option value="OTHER">Others (अन्य / અન્ય)</option>
                        </select>
                      </div>

                      {editingData.sect === "OTHER" && (
                        <div className="col-12 col-md-6">
                          <label className="form-label small fw-semibold text-dark mb-1">
                            Specific Sect Name (अन्य सम्प्रदाय) <span className="text-danger">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            className="form-control form-control-sm border-primary"
                            placeholder="e.g. Shrimad Rajchandra, Kanji Swami"
                            value={editingData.otherSect}
                            onChange={(e) => setEditingData({ ...editingData, otherSect: e.target.value })}
                          />
                        </div>
                      )}

                      {/* Head Blood Group */}
                      <div className="col-12 col-md-6">
                        <label className="form-label small fw-semibold text-dark mb-1">
                          <i className="bi bi-droplet-half text-danger me-1"></i>
                          Head Blood Group (रक्त समूह)
                        </label>
                        <select
                          className="form-select form-select-sm"
                          value={editingData.headBloodGroup}
                          onChange={(e) => setEditingData({ ...editingData, headBloodGroup: e.target.value })}
                        >
                          <option value="">Select Blood Group</option>
                          <option value="A+">A+</option>
                          <option value="A-">A-</option>
                          <option value="B+">B+</option>
                          <option value="B-">B-</option>
                          <option value="AB+">AB+</option>
                          <option value="AB-">AB-</option>
                          <option value="O+">O+</option>
                          <option value="O-">O-</option>
                          <option value="UNKNOWN">Unknown / पता नहीं</option>
                        </select>
                      </div>

                      {/* Head Occupation */}
                      <div className="col-12 col-md-6">
                        <label className="form-label small fw-semibold text-dark mb-1">
                          Head Occupation
                        </label>
                        <select
                          className="form-select form-select-sm"
                          value={editingData.headOccupation}
                          onChange={(e) => setEditingData({ ...editingData, headOccupation: e.target.value })}
                        >
                          <option value="">Select Occupation</option>
                          <option value="SERVICE">Service (Job)</option>
                          <option value="BUSINESS">Business</option>
                          <option value="RETIRED">Retired</option>
                          <option value="HOUSEWIFE">Housewife</option>
                          <option value="STUDENT">Student</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: FAMILY MEMBERS */}
                  {editActiveTab === "MEMBERS" && (
                    <div>
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <div>
                          <h6 className="fw-bold text-dark mb-0">Family Members Roster</h6>
                          <small className="text-muted">
                            Update individual blood group, residence location (foreign/in-pune), marital details, or add new members/grandchildren.
                          </small>
                        </div>
                        <button
                          type="button"
                          onClick={handleAddNewMemberInEdit}
                          className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1 shadow-xs"
                        >
                          <i className="bi bi-person-plus-fill"></i>
                          <span>+ Add Member / Child</span>
                        </button>
                      </div>

                      <div className="d-flex flex-column gap-3">
                        {editingData.members.map((m: any, idx: number) => {
                          const isSon = m.relationship === "SON";
                          const isDaughter = m.relationship === "DAUGHTER";
                          const isSister = m.relationship === "SISTER";
                          const isMarried = m.maritalStatus === "MARRIED";

                          const updateField = (field: string, val: any) => {
                            setEditingData((prev) => {
                              const updated = [...prev.members];
                              updated[idx] = { ...updated[idx], [field]: val };
                              return { ...prev, members: updated };
                            });
                          };

                          return (
                            <div key={idx} className="card p-3 border rounded-3 bg-light shadow-xs">
                              <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom flex-wrap gap-1">
                                <div className="d-flex align-items-center gap-2">
                                  <span className="badge bg-secondary font-monospace small">
                                    {m.memberId || `New Member #${idx + 1}`}
                                  </span>
                                  <strong className="text-dark">{m.name || "Unnamed"}</strong>
                                  {m.residenceLocation === "FOREIGN" && (
                                    <span className="badge bg-danger text-white small">✈️ Foreign</span>
                                  )}
                                  {m.bloodGroup && (
                                    <span className="badge bg-danger-subtle text-danger border border-danger-subtle small">
                                      🩸 {m.bloodGroup}
                                    </span>
                                  )}
                                </div>
                                {!m.id && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveMemberInEdit(idx)}
                                    className="btn btn-outline-danger btn-sm py-0 px-2 small"
                                    title="Remove this new member"
                                  >
                                    <i className="bi bi-trash"></i> Remove
                                  </button>
                                )}
                              </div>

                              <div className="row g-2">
                                <div className="col-12 col-sm-6 col-md-3">
                                  <label className="form-label small fw-semibold text-dark mb-1">
                                    Full Name <span className="text-danger">*</span>
                                  </label>
                                  <input
                                    type="text"
                                    required
                                    className="form-control form-control-sm"
                                    value={m.name}
                                    onChange={(e) => updateField("name", e.target.value)}
                                  />
                                </div>

                                <div className="col-6 col-sm-3 col-md-2">
                                  <label className="form-label small fw-semibold text-dark mb-1">
                                    Age <span className="text-danger">*</span>
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="120"
                                    required
                                    className="form-control form-control-sm"
                                    value={m.age}
                                    onChange={(e) => updateField("age", parseInt(e.target.value) || 0)}
                                  />
                                </div>

                                <div className="col-6 col-sm-3 col-md-2">
                                  <label className="form-label small fw-semibold text-dark mb-1">Gender</label>
                                  <select
                                    className="form-select form-select-sm"
                                    value={m.gender}
                                    onChange={(e) => updateField("gender", e.target.value)}
                                  >
                                    <option value="MALE">Male</option>
                                    <option value="FEMALE">Female</option>
                                    <option value="OTHER">Other</option>
                                  </select>
                                </div>

                                <div className="col-6 col-sm-4 col-md-3">
                                  <label className="form-label small fw-semibold text-dark mb-1">
                                    Relationship <span className="text-danger">*</span>
                                  </label>
                                  <select
                                    className="form-select form-select-sm"
                                    value={m.relationship}
                                    onChange={(e) => updateField("relationship", e.target.value)}
                                  >
                                    <option value="HEAD">Head (मुखिया)</option>
                                    <option value="SPOUSE">Spouse (पति / पत्नी)</option>
                                    <option value="SON">Son (पुत्र / बेटा)</option>
                                    <option value="DAUGHTER">Daughter (पुत्री / बेटी)</option>
                                    <option value="DAUGHTER_IN_LAW">Daughter-in-law (पुत्रवधू / बहू)</option>
                                    <option value="FATHER">Father (पिता)</option>
                                    <option value="MOTHER">Mother (माता)</option>
                                    <option value="BROTHER">Brother (भाई)</option>
                                    <option value="SISTER">Sister (बहन)</option>
                                    <option value="GRANDFATHER">Grandfather (दादा / नाना)</option>
                                    <option value="GRANDMOTHER">Grandmother (दादी / नानी)</option>
                                    <option value="GRANDCHILD">Grandchild (पोता / पोती / नाती)</option>
                                    <option value="OTHER">Other (अन्य)</option>
                                  </select>
                                </div>

                                {/* Blood Group */}
                                <div className="col-6 col-sm-4 col-md-2">
                                  <label className="form-label small fw-semibold text-dark mb-1">
                                    <i className="bi bi-droplet-half text-danger me-1"></i>
                                    Blood Group
                                  </label>
                                  <select
                                    className="form-select form-select-sm"
                                    value={m.bloodGroup || ""}
                                    onChange={(e) => updateField("bloodGroup", e.target.value)}
                                  >
                                    <option value="">Select</option>
                                    <option value="A+">A+</option>
                                    <option value="A-">A-</option>
                                    <option value="B+">B+</option>
                                    <option value="B-">B-</option>
                                    <option value="AB+">AB+</option>
                                    <option value="AB-">AB-</option>
                                    <option value="O+">O+</option>
                                    <option value="O-">O-</option>
                                    <option value="UNKNOWN">Unknown</option>
                                  </select>
                                </div>

                                {/* Current Residence Location */}
                                <div className="col-12 col-sm-6 col-md-3">
                                  <label className="form-label small fw-semibold text-dark mb-1">
                                    <i className="bi bi-geo-alt text-danger me-1"></i>
                                    Residence Location
                                  </label>
                                  <select
                                    className="form-select form-select-sm"
                                    value={m.residenceLocation || "IN_PUNE"}
                                    onChange={(e) => updateField("residenceLocation", e.target.value)}
                                  >
                                    <option value="IN_PUNE">📍 In Pune (पुणे में)</option>
                                    <option value="OUT_OF_PUNE">📍 Outside Pune / India</option>
                                    <option value="FOREIGN">✈️ Foreign / Abroad (NRI)</option>
                                  </select>
                                </div>

                                {/* Marital Status */}
                                <div className="col-6 col-sm-6 col-md-3">
                                  <label className="form-label small fw-semibold text-dark mb-1">
                                    Marital Status
                                  </label>
                                  <select
                                    className="form-select form-select-sm"
                                    value={m.maritalStatus || "UNMARRIED"}
                                    onChange={(e) => updateField("maritalStatus", e.target.value)}
                                  >
                                    <option value="UNMARRIED">Unmarried (अविवाहित)</option>
                                    <option value="MARRIED">Married (विवाहित)</option>
                                    <option value="WIDOWED">Widowed (विधवा/विधुर)</option>
                                    <option value="DIVORCED">Divorced</option>
                                  </select>
                                </div>

                                {/* Married Son: Wife Details */}
                                {isSon && isMarried && (
                                  <>
                                    <div className="col-12 col-sm-6 col-md-3">
                                      <label className="form-label small fw-semibold text-dark mb-1">
                                        Wife&apos;s Name (पत्नी का नाम)
                                      </label>
                                      <input
                                        type="text"
                                        className="form-control form-control-sm"
                                        placeholder="Wife's full name"
                                        value={m.wifeName || ""}
                                        onChange={(e) => updateField("wifeName", e.target.value)}
                                      />
                                    </div>
                                    <div className="col-12 col-sm-6 col-md-3">
                                      <label className="form-label small fw-semibold text-dark mb-1">
                                        Wife&apos;s Contact
                                      </label>
                                      <input
                                        type="tel"
                                        className="form-control form-control-sm"
                                        placeholder="Wife contact number"
                                        value={m.wifeContact || ""}
                                        onChange={(e) => updateField("wifeContact", e.target.value)}
                                      />
                                    </div>
                                  </>
                                )}

                                {/* Married Daughter or Sister: Husband Details */}
                                {(isDaughter || isSister) && isMarried && (
                                  <>
                                    <div className="col-12 col-sm-6 col-md-3">
                                      <label className="form-label small fw-semibold text-dark mb-1">
                                        Husband&apos;s Name (पति का नाम)
                                      </label>
                                      <input
                                        type="text"
                                        className="form-control form-control-sm"
                                        placeholder="Husband's name"
                                        value={m.husbandName || ""}
                                        onChange={(e) => updateField("husbandName", e.target.value)}
                                      />
                                    </div>
                                    <div className="col-12 col-sm-6 col-md-3">
                                      <label className="form-label small fw-semibold text-dark mb-1">
                                        Her Contact Number
                                      </label>
                                      <input
                                        type="tel"
                                        className="form-control form-control-sm"
                                        placeholder="Mobile number"
                                        value={m.whatsappNumber || ""}
                                        onChange={(e) => updateField("whatsappNumber", e.target.value)}
                                      />
                                    </div>
                                  </>
                                )}

                                {/* WhatsApp Number for other members */}
                                {!((isDaughter || isSister) && isMarried) && (
                                  <div className="col-12 col-sm-6 col-md-3">
                                    <label className="form-label small fw-semibold text-dark mb-1">
                                      Phone / WhatsApp
                                    </label>
                                    <input
                                      type="tel"
                                      className="form-control form-control-sm"
                                      placeholder="Member phone"
                                      value={m.whatsappNumber || ""}
                                      onChange={(e) => updateField("whatsappNumber", e.target.value)}
                                    />
                                  </div>
                                )}

                                <div className="col-12 col-sm-6 col-md-3">
                                  <label className="form-label small fw-semibold text-dark mb-1">
                                    Occupation
                                  </label>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    placeholder="e.g. Student, Service, Business"
                                    value={m.occupation || ""}
                                    onChange={(e) => updateField("occupation", e.target.value)}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="modal-footer bg-light py-2 px-4 d-flex justify-content-between">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setShowEditModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="btn btn-primary btn-sm px-4 fw-semibold shadow-xs"
                  >
                    {savingEdit ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                        Saving Changes...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check2-circle me-1"></i> Save All Changes (संशोधन सुरक्षित करें)
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
