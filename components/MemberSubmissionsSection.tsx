"use client";

import React, { useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import {
  approveSubmissionAction,
  rejectSubmissionAction,
} from "@/lib/actions/member-form-actions";

export interface MemberSubmissionItem {
  id: string;
  submissionNumber: string;
  familyId: string;
  familyRefId: string;
  headName: string;
  maskedMobile: string;
  currentAddress: string;
  currentArea: string;
  currentMemberCount: number;
  sanghName: string;
  sanghPrefix: string;
  headInfoCorrect: boolean;
  addressChanged: boolean;
  newAddress: string | null;
  newArea: string | null;
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

interface MemberSubmissionsSectionProps {
  initialSubmissions: MemberSubmissionItem[];
  canManage: boolean; // True for VOLUNTEER & ADMIN; false for TRUSTEE
}

export default function MemberSubmissionsSection({
  initialSubmissions,
  canManage,
}: MemberSubmissionsSectionProps) {
  const [submissions, setSubmissions] = useState<MemberSubmissionItem[]>(initialSubmissions);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [selectedSubmission, setSelectedSubmission] = useState<MemberSubmissionItem | null>(null);
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "danger"; text: string } | null>(null);

  const filtered = submissions.filter((s) => {
    if (statusFilter === "ALL") return true;
    return s.status === statusFilter;
  });

  const pendingCount = submissions.filter((s) => s.status === "PENDING").length;
  const approvedCount = submissions.filter((s) => s.status === "APPROVED").length;
  const rejectedCount = submissions.filter((s) => s.status === "REJECTED").length;

  // Handle Approve
  const handleApprove = async (sub: MemberSubmissionItem) => {
    if (!canManage) return;
    if (!confirm(`Are you sure you want to approve submission ${sub.submissionNumber} for ${sub.headName}? Validated updates will be saved to PostgreSQL.`)) {
      return;
    }

    setActionLoading(true);
    setAlertMsg(null);

    const res = await approveSubmissionAction(sub.id);
    setActionLoading(false);

    if (!res.success) {
      setAlertMsg({ type: "danger", text: res.error || "Failed to approve submission." });
      return;
    }

    setSubmissions((prev) =>
      prev.map((item) =>
        item.id === sub.id
          ? {
              ...item,
              status: "APPROVED",
              reviewedBy: "You",
              reviewedAt: new Date().toISOString(),
              currentAddress: item.addressChanged && item.newAddress ? item.newAddress : item.currentAddress,
              currentArea: item.addressChanged && item.newArea ? item.newArea : item.currentArea,
            }
          : item
      )
    );

    setAlertMsg({
      type: "success",
      text: `Submission ${sub.submissionNumber} approved successfully. Verified records updated.`,
    });
  };

  // Open Rejection Modal
  const openRejectModal = (sub: MemberSubmissionItem) => {
    setSelectedSubmission(sub);
    setRejectionReason("");
    setRejectionModalOpen(true);
  };

  // Submit Rejection
  const handleSubmitReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubmission || !canManage) return;

    if (!rejectionReason.trim()) {
      alert("Please provide a reason for rejection.");
      return;
    }

    setActionLoading(true);
    setAlertMsg(null);

    const res = await rejectSubmissionAction(selectedSubmission.id, rejectionReason.trim());
    setActionLoading(false);

    if (!res.success) {
      setAlertMsg({ type: "danger", text: res.error || "Failed to reject submission." });
      return;
    }

    setSubmissions((prev) =>
      prev.map((item) =>
        item.id === selectedSubmission.id
          ? {
              ...item,
              status: "REJECTED",
              reviewedBy: "You",
              reviewedAt: new Date().toISOString(),
              rejectionReason: rejectionReason.trim(),
            }
          : item
      )
    );

    setRejectionModalOpen(false);
    setSelectedSubmission(null);
    setAlertMsg({
      type: "success",
      text: `Submission ${selectedSubmission.submissionNumber} has been rejected.`,
    });
  };

  return (
    <div className="card-clean p-4 bg-white border shadow-sm rounded-4 mb-4">
      {/* Header & Filter Controls */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-3">
        <div>
          <h2 className="h5 fw-bold text-dark mb-1">
            <i className="bi bi-ui-checks text-primary me-2"></i>
            Member Form Submissions
          </h2>
          <p className="text-muted small mb-0">
            Public update requests submitted via QR code. Compare changes with existing records and validate.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="btn-group btn-group-sm">
          <button
            type="button"
            onClick={() => setStatusFilter("PENDING")}
            className={`btn ${statusFilter === "PENDING" ? "btn-warning fw-bold text-dark" : "btn-outline-secondary"}`}
          >
            Pending ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("APPROVED")}
            className={`btn ${statusFilter === "APPROVED" ? "btn-success fw-bold text-white" : "btn-outline-secondary"}`}
          >
            Approved ({approvedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("REJECTED")}
            className={`btn ${statusFilter === "REJECTED" ? "btn-danger fw-bold text-white" : "btn-outline-secondary"}`}
          >
            Rejected ({rejectedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`btn ${statusFilter === "ALL" ? "btn-primary fw-bold text-white" : "btn-outline-secondary"}`}
          >
            All ({submissions.length})
          </button>
        </div>
      </div>

      {/* Alert Notification */}
      {alertMsg && (
        <div
          className={`alert alert-${alertMsg.type} alert-dismissible fade show border-${alertMsg.type}-subtle small mb-3`}
          role="alert"
        >
          {alertMsg.text}
          <button
            type="button"
            className="btn-close"
            onClick={() => setAlertMsg(null)}
            aria-label="Close"
          ></button>
        </div>
      )}

      {/* Submission List */}
      {filtered.length === 0 ? (
        <div className="text-center py-4 text-muted bg-light rounded-3 border">
          <i className="bi bi-inbox fs-3 d-block mb-1"></i>
          <span className="small">No {statusFilter.toLowerCase()} submissions found.</span>
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          {filtered.map((sub) => (
            <div
              key={sub.id}
              className={`p-3 rounded-3 border ${
                sub.status === "PENDING"
                  ? "bg-warning-subtle border-warning-subtle"
                  : sub.status === "APPROVED"
                  ? "bg-white border-success-subtle"
                  : "bg-light border-secondary-subtle"
              }`}
            >
              <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-start gap-2 mb-2 pb-2 border-bottom">
                <div>
                  <span className="font-monospace fw-bold text-primary me-2">{sub.submissionNumber}</span>
                  <StatusBadge type="submission" value={sub.status} />
                  <span className="badge bg-light text-secondary border ms-2 font-monospace">
                    {sub.familyRefId}
                  </span>
                  <span className="badge bg-primary-subtle text-primary border border-primary-subtle ms-1">
                    {sub.sanghPrefix}
                  </span>
                </div>
                <small className="text-muted">
                  Submitted: {new Date(sub.createdAt).toLocaleString("en-IN")}
                </small>
              </div>

              {/* Family Head & Contact */}
              <div className="row g-2 mb-3">
                <div className="col-12 col-md-4">
                  <small className="text-muted d-block">Family Head:</small>
                  <strong className="text-dark">{sub.headName}</strong>
                </div>
                <div className="col-6 col-md-4">
                  <small className="text-muted d-block">Registered Mobile:</small>
                  <span className="font-monospace text-secondary">{sub.maskedMobile}</span>
                </div>
                <div className="col-6 col-md-4">
                  <small className="text-muted d-block">Sangh / Area:</small>
                  <span>
                    {sub.sanghName} • {sub.currentArea}
                  </span>
                </div>
              </div>

              {/* Submitted Answers Comparison */}
              <div className="p-3 bg-white rounded-3 border mb-3">
                <h6 className="fw-bold text-dark small mb-2">Submitted Responses &amp; Comparison:</h6>
                <div className="row g-2 small">
                  {/* Q1 */}
                  <div className="col-12 col-md-6">
                    <span className="text-muted">1. Head info correct? </span>
                    <strong className={sub.headInfoCorrect ? "text-success" : "text-danger"}>
                      {sub.headInfoCorrect ? "Yes (Correct)" : "No (Needs update)"}
                    </strong>
                  </div>

                  {/* Q3 */}
                  <div className="col-12 col-md-6">
                    <span className="text-muted">3. Household members count: </span>
                    <strong className="text-dark">{sub.memberCount} members</strong>{" "}
                    <span className="text-muted">
                      (Record currently has {sub.currentMemberCount})
                    </span>
                  </div>

                  {/* Q2: Address Comparison */}
                  <div className="col-12">
                    <span className="text-muted">2. Residential address changed? </span>
                    <strong className={sub.addressChanged ? "text-primary" : "text-secondary"}>
                      {sub.addressChanged ? "Yes (Address Changed)" : "No (Same Address)"}
                    </strong>
                    {sub.addressChanged && sub.newAddress && (
                      <div className="mt-2 p-2 bg-light border border-primary-subtle rounded">
                        <div className="row g-2">
                          <div className="col-12 col-md-6">
                            <span className="text-muted d-block" style={{ fontSize: "0.75rem" }}>
                              Existing Registered Address:
                            </span>
                            <span className="text-danger-emphasis text-decoration-line-through">
                              {sub.currentAddress}, {sub.currentArea}
                            </span>
                          </div>
                          <div className="col-12 col-md-6">
                            <span className="text-muted d-block" style={{ fontSize: "0.75rem" }}>
                              Proposed New Address:
                            </span>
                            <strong className="text-success-emphasis">
                              {sub.newAddress}, {sub.newArea}
                            </strong>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Q4 */}
                  <div className="col-12 col-md-6">
                    <span className="text-muted">4. Members details up to date? </span>
                    <strong className={sub.membersUpToDate ? "text-success" : "text-warning-emphasis"}>
                      {sub.membersUpToDate ? "Yes (Up to date)" : "No (Needs corrections)"}
                    </strong>
                  </div>

                  {/* Q5 & Q6 */}
                  <div className="col-12">
                    <span className="text-muted">5. Member corrections required? </span>
                    <strong className={sub.correctionNeeded ? "text-danger" : "text-secondary"}>
                      {sub.correctionNeeded ? "Yes (Corrections requested)" : "No (None)"}
                    </strong>
                    {sub.correctionNeeded && sub.correctionDetails && (
                      <div className="mt-1 p-2 bg-warning-subtle rounded border border-warning-subtle text-dark">
                        <strong className="d-block" style={{ fontSize: "0.75rem" }}>
                          6. Correction Details:
                        </strong>
                        <span>{sub.correctionDetails}</span>
                      </div>
                    )}
                  </div>

                  {/* Q7 */}
                  {sub.additionalNotes && (
                    <div className="col-12">
                      <span className="text-muted">7. Additional Notes: </span>
                      <span className="fst-italic text-secondary">{sub.additionalNotes}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Review Audit Info (if reviewed) */}
              {sub.reviewedBy && (
                <div className="p-2 bg-light rounded border mb-2 small text-secondary">
                  <i className="bi bi-clock-history me-1"></i>
                  Reviewed by <strong>{sub.reviewedBy}</strong> on{" "}
                  {sub.reviewedAt ? new Date(sub.reviewedAt).toLocaleString("en-IN") : ""}
                  {sub.rejectionReason && (
                    <span className="d-block text-danger mt-1">
                      <strong>Rejection reason:</strong> {sub.rejectionReason}
                    </span>
                  )}
                </div>
              )}

              {/* Actions for Volunteers / Admins on PENDING submissions */}
              {sub.status === "PENDING" && canManage && (
                <div className="d-flex gap-2 justify-content-end pt-2">
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => openRejectModal(sub)}
                    className="btn btn-outline-danger btn-sm px-3"
                  >
                    <i className="bi bi-x-circle me-1"></i> Reject / Request Info
                  </button>

                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleApprove(sub)}
                    className="btn btn-success btn-sm px-3 d-flex align-items-center gap-1 shadow-sm"
                  >
                    <i className="bi bi-check-circle-fill"></i>
                    <span>Approve &amp; Update Record</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {rejectionModalOpen && selectedSubmission && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow border-0 rounded-4">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold text-dark">
                  Reject Submission {selectedSubmission.submissionNumber}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setRejectionModalOpen(false)}
                  aria-label="Close"
                ></button>
              </div>

              <form onSubmit={handleSubmitReject}>
                <div className="modal-body p-4">
                  <p className="text-muted small mb-3">
                    Please provide a clear reason for rejecting this update request for{" "}
                    <strong>{selectedSubmission.headName}</strong>. This note will be recorded in the audit trail.
                  </p>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-dark mb-1">
                      Rejection Reason <span className="text-danger">*</span>
                    </label>
                    <textarea
                      className="form-control"
                      rows={3}
                      placeholder="e.g. Could not verify with family head over call, or incorrect phone number supplied."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="modal-footer border-top">
                  <button
                    type="button"
                    onClick={() => setRejectionModalOpen(false)}
                    className="btn btn-outline-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading || !rejectionReason.trim()}
                    className="btn btn-danger"
                  >
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
