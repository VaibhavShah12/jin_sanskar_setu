"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";
import { archiveMemberAction } from "@/lib/actions/family-actions";

interface MemberDetailActionsProps {
  memberId: string;
  memberDbId: string;
  memberName: string;
  familyId: string;
  status: string;
  isAdmin: boolean;
}

export default function MemberDetailActions({
  memberId,
  memberDbId,
  memberName,
  familyId,
  status,
  isAdmin,
}: MemberDetailActionsProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Volunteers CANNOT archive any member
  if (!isAdmin || status !== "ACTIVE") {
    return null;
  }

  const handleArchive = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await archiveMemberAction(memberDbId);
      if (!res.success) {
        setErrorMsg(res.error || "Failed to archive member.");
        setLoading(false);
        setShowModal(false);
        return;
      }
      router.push(`/families/${familyId}?memberArchived=true`);
    } catch (err: any) {
      setErrorMsg(err?.message || "An unexpected error occurred.");
      setLoading(false);
      setShowModal(false);
    }
  };

  return (
    <>
      {errorMsg && (
        <div className="alert alert-danger py-2 px-3 small my-2" role="alert">
          {errorMsg}
        </div>
      )}

      <button
        onClick={() => setShowModal(true)}
        className="btn btn-outline-danger btn-sm px-3"
      >
        <i className="bi bi-person-x me-1"></i> Archive Member
      </button>

      <ConfirmModal
        isOpen={showModal}
        title="Archive Member Record?"
        message={`Are you sure you want to archive ${memberId} (${memberName})? Only administrators can perform this action. The member will be hidden from active community directories.`}
        confirmText="Yes, Archive Member"
        confirmVariant="danger"
        isLoading={loading}
        onConfirm={handleArchive}
        onCancel={() => setShowModal(false)}
      />
    </>
  );
}
