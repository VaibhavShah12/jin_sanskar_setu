"use client";

import React, { useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import {
  approveSubmissionAction,
  rejectSubmissionAction,
} from "@/lib/actions/member-form-actions";

export interface CorrectionRequestItem {
  id: string;
  submissionNumber: string;
  familyId: string;
  familyRefId: string;
  headName: string;
  maskedMobile: string;
  rawMobile?: string;
  currentAddress: string;
  currentLane?: string;
  currentArea: string;
  currentNativePlace: string;
  currentSect?: string;
  currentOtherSect?: string;
  currentHeadBloodGroup?: string;
  currentEmail?: string;
  currentMemberCount: number;
  currentMembers?: any[];
  sanghName: string;
  sanghPrefix: string;
  headInfoCorrect: boolean;
  addressChanged: boolean;
  newAddress: string | null;
  newArea: string | null;
  newNativePlace: string | null;
  newOccupation: string | null;
  newMobile: string | null;
  memberCount: number;
  membersUpToDate: boolean;
  correctionNeeded: boolean;
  correctionDetails: string | null;
  additionalNotes: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  appliedChanges: any | null;
  createdAt: string;
}

interface CorrectionRequestsClientProps {
  initialRequests: CorrectionRequestItem[];
  canManage: boolean;
}

export default function CorrectionRequestsClient({
  initialRequests,
  canManage,
}: CorrectionRequestsClientProps) {
  const [requests, setRequests] = useState<CorrectionRequestItem[]>(initialRequests);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "danger"; text: string } | null>(null);

  const filtered = requests.filter((r) => {
    if (statusFilter === "ALL") return true;
    return r.status === statusFilter;
  });

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;
  const approvedCount = requests.filter((r) => r.status === "APPROVED").length;
  const rejectedCount = requests.filter((r) => r.status === "REJECTED").length;

  const handleApprove = async (reqItem: CorrectionRequestItem) => {
    if (!canManage) return;
    if (
      !confirm(
        `Are you sure you want to approve request ${reqItem.submissionNumber} for ${reqItem.headName}? All requested updates will be immediately synced to PostgreSQL.`
      )
    ) {
      return;
    }

    setActionLoading(true);
    setAlertMsg(null);

    const res = await approveSubmissionAction(reqItem.id);
    setActionLoading(false);

    if (!res.success) {
      setAlertMsg({ type: "danger", text: res.error || "Failed to approve request." });
      return;
    }

    setRequests((prev) =>
      prev.map((item) =>
        item.id === reqItem.id
          ? {
              ...item,
              status: "APPROVED",
              reviewedBy: "You",
              reviewedAt: new Date().toISOString(),
              currentAddress: item.newAddress || item.currentAddress,
              currentArea: item.newArea || item.currentArea,
              currentNativePlace: item.newNativePlace || item.currentNativePlace,
            }
          : item
      )
    );

    setAlertMsg({
      type: "success",
      text: `Request ${reqItem.submissionNumber} approved successfully. Verified changes have been applied to family records!`,
    });
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingId) return;

    setActionLoading(true);
    setAlertMsg(null);

    const res = await rejectSubmissionAction(rejectingId, rejectionReason);
    setActionLoading(false);

    if (!res.success) {
      setAlertMsg({ type: "danger", text: res.error || "Failed to reject request." });
      return;
    }

    setRequests((prev) =>
      prev.map((item) =>
        item.id === rejectingId
          ? {
              ...item,
              status: "REJECTED",
              reviewedBy: "You",
              reviewedAt: new Date().toISOString(),
              rejectionReason,
            }
          : item
      )
    );

    setAlertMsg({
      type: "success",
      text: `Request has been rejected.`,
    });
    setRejectingId(null);
    setRejectionReason("");
  };

  return (
    <div className="container py-2 py-md-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2 py-1">
              <i className="bi bi-pencil-square me-1"></i> Member Self-Service
            </span>
          </div>
          <h1 className="h3 fw-bold text-dark mb-1">
            Profile Correction Requests (विवरण सुधार अनुरोध)
          </h1>
          <p className="text-muted small mb-0">
            Review and approve member-submitted updates to addresses, phone numbers, native village (*Mul Gaam*), and occupations.
          </p>
        </div>

        {/* Filter Badges */}
        <div className="btn-group shadow-sm">
          <button
            className={`btn btn-sm ${statusFilter === "PENDING" ? "btn-warning fw-bold text-dark" : "btn-outline-secondary"}`}
            onClick={() => setStatusFilter("PENDING")}
          >
            Pending ({pendingCount})
          </button>
          <button
            className={`btn btn-sm ${statusFilter === "APPROVED" ? "btn-success fw-bold text-white" : "btn-outline-secondary"}`}
            onClick={() => setStatusFilter("APPROVED")}
          >
            Approved ({approvedCount})
          </button>
          <button
            className={`btn btn-sm ${statusFilter === "REJECTED" ? "btn-danger fw-bold text-white" : "btn-outline-secondary"}`}
            onClick={() => setStatusFilter("REJECTED")}
          >
            Rejected ({rejectedCount})
          </button>
          <button
            className={`btn btn-sm ${statusFilter === "ALL" ? "btn-secondary fw-bold text-white" : "btn-outline-secondary"}`}
            onClick={() => setStatusFilter("ALL")}
          >
            All ({requests.length})
          </button>
        </div>
      </div>

      {/* Notifications */}
      {alertMsg && (
        <div className={`alert alert-${alertMsg.type} alert-dismissible fade show shadow-sm mb-4`} role="alert">
          <i className={`bi ${alertMsg.type === "success" ? "bi-check-circle-fill" : "bi-exclamation-triangle-fill"} me-2`}></i>
          {alertMsg.text}
          <button type="button" className="btn-close" onClick={() => setAlertMsg(null)} aria-label="Close"></button>
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card-clean p-5 text-center text-muted">
          <i className="bi bi-inbox fs-1 d-block mb-2 text-secondary"></i>
          <h5>No {statusFilter.toLowerCase()} correction requests found</h5>
          <p className="small mb-0">Any changes submitted by families will appear here for review.</p>
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          {filtered.map((item) => {
            const proposed = item.appliedChanges?.proposedData;
            const hasAddressChange = Boolean(item.newAddress && item.newAddress !== item.currentAddress);
            const hasAreaChange = Boolean(item.newArea && item.newArea !== item.currentArea);
            const hasNativePlaceChange = Boolean(item.newNativePlace && item.newNativePlace !== item.currentNativePlace);
            const hasMobileChange = Boolean(item.newMobile);
            const hasOccupationChange = Boolean(item.newOccupation);

            return (
              <div
                key={item.id}
                className={`card-clean p-4 border ${
                  item.status === "PENDING"
                    ? "border-warning bg-warning-subtle bg-opacity-10"
                    : item.status === "APPROVED"
                    ? "border-success-subtle bg-white"
                    : "border-secondary-subtle bg-light"
                }`}
              >
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-start gap-2 mb-3 pb-3 border-bottom">
                  <div>
                    <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                      <span className="font-monospace fw-bold text-primary fs-6">{item.submissionNumber}</span>
                      <StatusBadge type="submission" value={item.status} />
                      <span className="badge bg-light text-secondary border font-monospace">{item.familyRefId}</span>
                      <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                        {item.sanghPrefix} - {item.sanghName}
                      </span>
                      {proposed && (
                        <span className="badge bg-success-subtle text-success border border-success-subtle">
                          ✨ Full Form Refill / Re-update
                        </span>
                      )}
                    </div>
                    <div className="fw-bold text-dark fs-5">{item.headName}</div>
                    <div className="small text-muted">
                      Registered Mobile: <span className="font-monospace">{item.maskedMobile}</span>
                      {item.rawMobile && <span className="ms-2 font-monospace text-primary">({item.rawMobile})</span>}
                    </div>
                  </div>
                  <div className="text-md-end">
                    <span className="small text-muted d-block">
                      Submitted: {new Date(item.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                    {item.reviewedBy && (
                      <span className="badge bg-light text-dark border mt-1">
                        Reviewed by {item.reviewedBy} on {item.reviewedAt ? new Date(item.reviewedAt).toLocaleDateString("en-IN") : ""}
                      </span>
                    )}
                  </div>
                </div>

                {/* Diff Comparison Table */}
                <div className="bg-white rounded-3 border p-3 mb-3 shadow-sm">
                  <h6 className="fw-bold text-dark mb-2 small text-uppercase tracking-wider">
                    <i className="bi bi-arrow-left-right text-primary me-2"></i>
                    Proposed Field Changes (Before vs After)
                  </h6>

                  {proposed ? (
                    /* FULL FORM REFILL DIFF TABLE */
                    <div className="table-responsive">
                      <table className="table table-sm align-middle mb-0">
                        <thead className="table-light small">
                          <tr>
                            <th style={{ width: "22%" }}>Household Field</th>
                            <th style={{ width: "39%" }}>Current Database Record</th>
                            <th style={{ width: "39%" }} className="text-primary">Requested Update (प्रस्तावित)</th>
                          </tr>
                        </thead>
                        <tbody className="small">
                          {/* Head Name */}
                          <tr className={proposed.headName !== item.headName ? "table-warning bg-opacity-25" : ""}>
                            <td className="fw-semibold">Head Full Name</td>
                            <td className="text-muted">{item.headName}</td>
                            <td>
                              <strong className={proposed.headName !== item.headName ? "text-primary fw-bold" : "text-dark"}>
                                {proposed.headName}
                              </strong>
                            </td>
                          </tr>

                          {/* Primary Mobile */}
                          <tr className={proposed.mobile && proposed.mobile !== item.rawMobile ? "table-warning bg-opacity-25" : ""}>
                            <td className="fw-semibold">Mobile / WhatsApp</td>
                            <td className="text-muted font-monospace">{item.maskedMobile}</td>
                            <td>
                              <strong className="text-success font-monospace">{proposed.mobile || item.maskedMobile}</strong>
                            </td>
                          </tr>

                          {/* Email */}
                          <tr className={proposed.email && proposed.email !== item.currentEmail ? "table-warning bg-opacity-25" : ""}>
                            <td className="fw-semibold">Registered Email</td>
                            <td className="text-muted">{item.currentEmail || "—"}</td>
                            <td>
                              <strong className="text-dark">{proposed.email || "—"}</strong>
                            </td>
                          </tr>

                          {/* Address & Lane */}
                          <tr className={proposed.address !== item.currentAddress || proposed.lane !== item.currentLane ? "table-warning bg-opacity-25" : ""}>
                            <td className="fw-semibold">Address &amp; Lane (गली/शेरी)</td>
                            <td className="text-muted">
                              {item.currentAddress || "—"}
                              {item.currentLane && <div className="text-primary small">Lane: {item.currentLane}</div>}
                            </td>
                            <td>
                              <strong className="text-dark d-block">{proposed.address}</strong>
                              {proposed.lane && (
                                <span className="badge bg-primary-subtle text-primary border border-primary-subtle small mt-1">
                                  <i className="bi bi-signpost-split me-1"></i>Lane: {proposed.lane}
                                </span>
                              )}
                            </td>
                          </tr>

                          {/* Area */}
                          <tr className={proposed.area !== item.currentArea ? "table-warning bg-opacity-25" : ""}>
                            <td className="fw-semibold">Area / Locality</td>
                            <td className="text-muted">{item.currentArea || "—"}</td>
                            <td>
                              <strong className="text-dark">{proposed.area}</strong>
                            </td>
                          </tr>

                          {/* Native Place */}
                          <tr className={proposed.nativePlace !== item.currentNativePlace ? "table-warning bg-opacity-25" : ""}>
                            <td className="fw-semibold">Native Place (મૂળ ગામ)</td>
                            <td className="text-muted">{item.currentNativePlace || "—"}</td>
                            <td>
                              <strong className="text-primary fw-bold">
                                <i className="bi bi-house-door me-1"></i>{proposed.nativePlace || "—"}
                              </strong>
                            </td>
                          </tr>

                          {/* Jain Sect */}
                          <tr className={proposed.sect !== item.currentSect ? "table-warning bg-opacity-25" : ""}>
                            <td className="fw-semibold">Jain Sect (सम्प्रदाय)</td>
                            <td className="text-muted">{item.currentSect || "—"}</td>
                            <td>
                              <span className="badge bg-light text-dark border">
                                {proposed.sect || "—"}{proposed.otherSect ? ` (${proposed.otherSect})` : ""}
                              </span>
                            </td>
                          </tr>

                          {/* Head Blood Group */}
                          <tr className={proposed.headBloodGroup !== item.currentHeadBloodGroup ? "table-warning bg-opacity-25" : ""}>
                            <td className="fw-semibold">Head Blood Group</td>
                            <td className="text-muted">{item.currentHeadBloodGroup || "—"}</td>
                            <td>
                              {proposed.headBloodGroup ? (
                                <span className="badge bg-danger text-white">
                                  🩸 {proposed.headBloodGroup}
                                </span>
                              ) : (
                                <span className="text-muted italic">—</span>
                              )}
                            </td>
                          </tr>

                          {/* Head Occupation */}
                          {proposed.headOccupation && (
                            <tr className="table-warning bg-opacity-25">
                              <td className="fw-semibold">Head Occupation</td>
                              <td className="text-muted">—</td>
                              <td>
                                <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                                  <i className="bi bi-briefcase me-1"></i>{proposed.headOccupation}
                                </span>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    /* LEGACY 5-FIELD DIFF TABLE */
                    <div className="table-responsive">
                      <table className="table table-sm align-middle mb-0">
                        <thead className="table-light small">
                          <tr>
                            <th style={{ width: "20%" }}>Field</th>
                            <th style={{ width: "40%" }}>Current Database Record</th>
                            <th style={{ width: "40%" }} className="text-primary">Requested Update</th>
                          </tr>
                        </thead>
                        <tbody className="small">
                          {/* Address */}
                          <tr className={hasAddressChange ? "table-warning bg-opacity-25" : ""}>
                            <td className="fw-semibold">Address</td>
                            <td className="text-muted">{item.currentAddress || "—"}</td>
                            <td>
                              {item.newAddress ? (
                                <strong className="text-dark">{item.newAddress}</strong>
                              ) : (
                                <span className="text-muted italic">No change</span>
                              )}
                            </td>
                          </tr>

                          {/* Area */}
                          <tr className={hasAreaChange ? "table-warning bg-opacity-25" : ""}>
                            <td className="fw-semibold">Area / Locality</td>
                            <td className="text-muted">{item.currentArea || "—"}</td>
                            <td>
                              {item.newArea ? (
                                <strong className="text-dark">{item.newArea}</strong>
                              ) : (
                                <span className="text-muted italic">No change</span>
                              )}
                            </td>
                          </tr>

                          {/* Native Place */}
                          <tr className={hasNativePlaceChange ? "table-warning bg-opacity-25" : ""}>
                            <td className="fw-semibold">Native Place (મૂળ ગામ)</td>
                            <td className="text-muted">{item.currentNativePlace || "—"}</td>
                            <td>
                              {item.newNativePlace ? (
                                <strong className="text-primary fw-bold">
                                  <i className="bi bi-house-door me-1"></i>{item.newNativePlace}
                                </strong>
                              ) : (
                                <span className="text-muted italic">No change</span>
                              )}
                            </td>
                          </tr>

                          {/* Occupation */}
                          {hasOccupationChange && (
                            <tr className="table-warning bg-opacity-25">
                              <td className="fw-semibold">Head Occupation</td>
                              <td className="text-muted">—</td>
                              <td>
                                <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                                  <i className="bi bi-briefcase me-1"></i>{item.newOccupation}
                                </span>
                              </td>
                            </tr>
                          )}

                          {/* Mobile */}
                          {hasMobileChange && (
                            <tr className="table-warning bg-opacity-25">
                              <td className="fw-semibold">Primary Mobile</td>
                              <td className="text-muted font-monospace">{item.maskedMobile}</td>
                              <td>
                                <strong className="font-monospace text-success">{item.newMobile}</strong>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* PROPOSED MEMBERS ROSTER (If full form refill) */}
                  {proposed?.members && proposed.members.length > 0 && (
                    <div className="mt-3 pt-3 border-top">
                      <h6 className="fw-bold text-dark mb-2 small text-uppercase tracking-wider">
                        <i className="bi bi-people text-primary me-2"></i>
                        Proposed Family Members Roster ({proposed.members.length} Members)
                      </h6>
                      <div className="table-responsive">
                        <table className="table table-sm table-bordered align-middle mb-0 bg-white small">
                          <thead className="table-light">
                            <tr>
                              <th>Member Name</th>
                              <th>Relation</th>
                              <th>Age / Gender</th>
                              <th>Blood Group</th>
                              <th>Location (निवास)</th>
                              <th>Marital / Spouse</th>
                              <th>Contact / Occ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {proposed.members.map((m: any, mIdx: number) => (
                              <tr key={mIdx}>
                                <td>
                                  <strong className="text-dark">{m.name}</strong>
                                  {!m.id && (
                                    <span className="badge bg-success text-white ms-2">
                                      🆕 New Member / Child
                                    </span>
                                  )}
                                  {m.memberId && (
                                    <div className="font-monospace text-muted small">{m.memberId}</div>
                                  )}
                                </td>
                                <td>
                                  <span className="badge bg-light text-secondary border">
                                    {m.relationship === "DAUGHTER_IN_LAW" ? "Daughter-in-law (पुत्रवधू)" : m.relationship}
                                  </span>
                                </td>
                                <td>{m.age} yrs • {m.gender}</td>
                                <td>
                                  {m.bloodGroup ? (
                                    <span className="badge bg-danger-subtle text-danger border border-danger-subtle">
                                      🩸 {m.bloodGroup}
                                    </span>
                                  ) : (
                                    <span className="text-muted">—</span>
                                  )}
                                </td>
                                <td>
                                  {m.residenceLocation === "FOREIGN" ? (
                                    <span className="badge bg-danger text-white">✈️ Foreign (विदेश)</span>
                                  ) : m.residenceLocation === "OUT_OF_PUNE" ? (
                                    <span className="badge bg-secondary-subtle text-secondary border">📍 Outside Pune</span>
                                  ) : (
                                    <span className="badge bg-success-subtle text-success border border-success-subtle">📍 In Pune</span>
                                  )}
                                </td>
                                <td>
                                  <div>{m.maritalStatus || "UNMARRIED"}</div>
                                  {m.wifeName && (
                                    <small className="text-primary d-block">
                                      Wife: {m.wifeName} {m.wifeContact ? `(${m.wifeContact})` : ""}
                                    </small>
                                  )}
                                  {m.husbandName && (
                                    <small className="text-primary d-block">
                                      Husband: {m.husbandName}
                                    </small>
                                  )}
                                </td>
                                <td>
                                  {m.whatsappNumber && <div className="text-success small">📱 {m.whatsappNumber}</div>}
                                  {m.occupation && <div className="text-muted small">{m.occupation}</div>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Additional Notes / Details */}
                  {(item.correctionDetails || item.additionalNotes || item.appliedChanges?.notes) && (
                    <div className="mt-3 pt-2 border-top">
                      {item.correctionDetails && (
                        <div className="mb-2">
                          <strong className="text-dark small d-block">Correction Details / Member Additions:</strong>
                          <div className="p-2 bg-light rounded text-dark small font-monospace">
                            {item.correctionDetails}
                          </div>
                        </div>
                      )}
                      {(item.additionalNotes || item.appliedChanges?.notes) && (
                        <div>
                          <strong className="text-muted small d-block">Family Remarks:</strong>
                          <div className="text-secondary small fst-italic">
                            {item.additionalNotes || item.appliedChanges?.notes}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Rejection Reason if rejected */}
                  {item.rejectionReason && (
                    <div className="alert alert-danger mb-0 mt-3 p-2 small">
                      <strong>Rejection Reason:</strong> {item.rejectionReason}
                    </div>
                  )}
                </div>

                {/* Action Buttons for Pending */}
                {item.status === "PENDING" && canManage && (
                  <div className="d-flex justify-content-end gap-2 pt-2">
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm px-3"
                      disabled={actionLoading}
                      onClick={() => {
                        setRejectingId(item.id);
                        setRejectionReason("");
                      }}
                    >
                      <i className="bi bi-x-circle me-1"></i> Reject
                    </button>
                    <button
                      type="button"
                      className="btn btn-success btn-sm px-4 fw-semibold text-white shadow-sm"
                      disabled={actionLoading}
                      onClick={() => handleApprove(item)}
                    >
                      <i className="bi bi-check2-circle me-1"></i> Approve &amp; Sync to Database
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectingId && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title fs-6 fw-bold">
                  <i className="bi bi-exclamation-triangle me-1"></i> Reject Correction Request
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setRejectingId(null)}></button>
              </div>
              <form onSubmit={handleRejectSubmit}>
                <div className="modal-body p-4">
                  <p className="text-dark small mb-3">
                    Please provide a specific reason for rejecting this correction request. The reason will be recorded in the audit log.
                  </p>
                  <label className="form-label small fw-semibold text-dark">Reason for Rejection *</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="e.g. Mobile number could not be verified / Incomplete information provided"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    required
                  ></textarea>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRejectingId(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-danger btn-sm px-3" disabled={actionLoading || rejectionReason.trim().length < 3}>
                    {actionLoading ? "Rejecting..." : "Confirm Rejection"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
