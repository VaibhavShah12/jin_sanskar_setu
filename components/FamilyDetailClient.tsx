"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import ConfirmModal from "@/components/ConfirmModal";
import { archiveFamilyAction, archiveMemberAction } from "@/lib/actions/family-actions";
import { getMemberCalculatedAge } from "@/lib/validation/family";

interface FamilyDetailClientProps {
  family: any;
  isAdmin: boolean;
  canEdit: boolean;
}

export default function FamilyDetailClient({ family, isAdmin }: FamilyDetailClientProps) {
  const router = useRouter();
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [memberToArchive, setMemberToArchive] = useState<any | null>(null);
  const [archivingMember, setArchivingMember] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

          {/* Archive Family Button: STRICTLY ADMIN ONLY */}
          {isAdmin && family.status === "ACTIVE" && (
            <div className="d-flex gap-2">
              <button
                onClick={() => setShowArchiveModal(true)}
                className="btn btn-outline-danger btn-sm px-3"
              >
                <i className="bi bi-archive me-1"></i> Archive Family
              </button>
            </div>
          )}
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
          <div className="col-12">
            <span className="text-muted small d-block">Residential Address</span>
            <span className="text-secondary">{family.address}</span>
          </div>
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
                <th>Pathshala Status</th>
                <th>Conveyance</th>
                <th>Preferred Schedule</th>
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
                      {m.status === "ARCHIVED" && (
                        <span className="badge bg-secondary ms-1">Archived</span>
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
                    <td>{m.relationship}</td>
                    <td><StatusBadge type="pathshala" value={m.pathshalaStatus} /></td>
                    <td>
                      {m.transportPreference === "PICK_AND_DROP" ? (
                        <span className="badge bg-success-subtle text-success border border-success-subtle">
                          🚐 Pick &amp; Drop
                        </span>
                      ) : m.transportPreference === "BY_SELF" ? (
                        <span className="badge bg-light text-dark border">
                          🚶 By Self
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="small text-muted">
                      {m.preferredDay === "WEEKDAY" && m.preferredWeekdays ? (
                        <div>
                          <div>Weekday ({m.preferredWeekdays})</div>
                          <div className="text-secondary small">{m.preferredTime}</div>
                        </div>
                      ) : m.preferredDay !== "NO_PREFERENCE" || m.preferredTime !== "NO_PREFERENCE" ? (
                        `${m.preferredDay}, ${m.preferredTime}`
                      ) : (
                        "No preference"
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
                    {m.status === "ARCHIVED" && <span className="badge bg-secondary ms-1">Archived</span>}
                  </h6>
                </div>
                <div className="text-end">
                  <span className="badge bg-light text-secondary border">
                    {m.relationship} • {calculatedAge} yrs
                  </span>
                  {dobString && (
                    <div className="small text-muted font-monospace">{dobString}</div>
                  )}
                </div>
              </div>

              <div className="row g-2 pt-2 border-top small mb-2">
                <div className="col-6">
                  <span className="text-muted d-block fs-8">Pathshala:</span>
                  <StatusBadge type="pathshala" value={m.pathshalaStatus} />
                </div>
                <div className="col-6">
                  <span className="text-muted d-block fs-8">Conveyance:</span>
                  {m.transportPreference === "PICK_AND_DROP" ? (
                    <span className="badge bg-success-subtle text-success border border-success-subtle">
                      🚐 Pick &amp; Drop
                    </span>
                  ) : m.transportPreference === "BY_SELF" ? (
                    <span className="badge bg-light text-dark border">
                      🚶 By Self
                    </span>
                  ) : (
                    "—"
                  )}
                </div>
                {(m.preferredDay !== "NO_PREFERENCE" || m.preferredTime !== "NO_PREFERENCE") && (
                  <div className="col-12">
                    <span className="text-muted fs-8">Schedule: </span>
                    <span className="text-dark">
                      {m.preferredDay === "WEEKDAY" && m.preferredWeekdays
                        ? `Weekday (${m.preferredWeekdays}), ${m.preferredTime}`
                        : `${m.preferredDay}, ${m.preferredTime}`}
                    </span>
                  </div>
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
    </>
  );
}
