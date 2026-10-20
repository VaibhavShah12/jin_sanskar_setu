import { requireAuth } from "@/lib/auth/auth-helpers";
import { prisma } from "@/lib/db/prisma";
import StatusBadge from "@/components/StatusBadge";
import MemberDetailActions from "@/components/MemberDetailActions";
import Link from "next/link";
import { notFound } from "next/navigation";
import React from "react";
import { MEMBER_INTERESTS } from "@/lib/constants/interests";

export const dynamic = "force-dynamic";

interface MemberDetailPageProps {
  params: {
    id: string;
  };
}

export default async function MemberDetailPage({ params }: MemberDetailPageProps) {
  const user = await requireAuth();

  const member = await prisma.member.findUnique({
    where: { id: params.id },
    include: {
      family: true,
      sangh: true,
      sheetSync: true,
    },
  });

  if (!member) {
    notFound();
  }

  // Check authorization
  if (
    (user.role === "VOLUNTEER" && user.sanghId && user.sanghId !== member.sanghId) ||
    (user.role === "TRUSTEE" && (!user.sanghId || user.sanghId !== member.sanghId))
  ) {
    return (
      <div className="container py-5 text-center">
        <div className="alert alert-danger d-inline-block p-4">
          <i className="bi bi-shield-lock display-4 d-block mb-2"></i>
          <h4 className="fw-bold">Unauthorized Member Access</h4>
          <p className="mb-3">You are only permitted to view records from your assigned Sangh.</p>
          <Link href="/members" className="btn btn-outline-danger">
            Back to Permitted Members
          </Link>
        </div>
      </div>
    );
  }

  const calculatedAge = member.dateOfBirth
    ? (() => {
        try {
          const birthDate = new Date(member.dateOfBirth);
          const today = new Date();
          let age = today.getFullYear() - birthDate.getUTCFullYear();
          const m = today.getMonth() - birthDate.getUTCMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getUTCDate())) {
            age--;
          }
          return Math.max(0, age);
        } catch {
          return member.age;
        }
      })()
    : member.age;

  const isChild = calculatedAge < 18;
  const dobFormatted = member.dateOfBirth
    ? new Date(member.dateOfBirth).toISOString().split("T")[0]
    : null;

  return (
    <div className="container py-2 py-md-4">
      {/* Breadcrumb Navigation */}
      <nav aria-label="breadcrumb" className="mb-3">
        <ol className="breadcrumb small">
          <li className="breadcrumb-item">
            <Link href="/dashboard" className="text-decoration-none">Dashboard</Link>
          </li>
          <li className="breadcrumb-item">
            <Link href="/members" className="text-decoration-none">Members</Link>
          </li>
          <li className="breadcrumb-item active font-monospace" aria-current="page">
            {member.memberId}
          </li>
        </ol>
      </nav>

      {/* Member Profile Header */}
      <div className="card-clean p-4 mb-4 bg-white">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-start gap-3 mb-3 pb-3 border-bottom">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="font-monospace fs-4 fw-bold text-primary">{member.memberId}</span>
              <span className="badge-sangh font-monospace fs-6">{member.sangh.prefix}</span>
              {member.status === "ARCHIVED" && (
                <span className="badge bg-secondary">Archived</span>
              )}
              {isChild && <span className="badge bg-warning text-dark">Child (&lt;18)</span>}
              {member.relationship === "HEAD" && <span className="badge bg-secondary">Head of Family</span>}
            </div>
            <h1 className="h3 fw-bold text-dark mb-0">{member.name}</h1>
            <small className="text-muted">
              {member.sangh.name} • Registered on {new Date(member.createdAt).toLocaleDateString()}
            </small>
          </div>

          <div className="d-flex align-items-center gap-2">
            <MemberDetailActions
              memberId={member.memberId}
              memberDbId={member.id}
              memberName={member.name}
              familyId={member.familyId}
              status={member.status}
              isAdmin={user.role === "ADMIN"}
            />
            <Link href={`/families/${member.familyId}`} className="btn btn-outline-primary btn-sm px-3">
              <i className="bi bi-house-door me-1"></i> View Family ({member.family.familyId})
            </Link>
          </div>
        </div>

        <div className="row g-3">
          <div className="col-6 col-md-3">
            <span className="text-muted small d-block">Age</span>
            <strong className="fs-5 text-dark">{calculatedAge} years</strong>
            {dobFormatted ? (
              <span className="badge bg-light text-secondary border font-monospace mt-1 d-inline-block">
                DOB: {dobFormatted}
              </span>
            ) : (
              <span className="text-muted small d-block">DOB not recorded</span>
            )}
          </div>
          <div className="col-6 col-md-3">
            <span className="text-muted small d-block">Gender</span>
            <strong className="fs-5 text-dark text-capitalize">{member.gender.toLowerCase().replace(/_/g, " ")}</strong>
          </div>
          <div className="col-6 col-md-3">
            <span className="text-muted small d-block">Relationship to Head</span>
            <strong className="fs-5 text-dark">{member.relationship}</strong>
          </div>
          <div className="col-6 col-md-3">
            <span className="text-muted small d-block">Family Contact</span>
            <a href={`tel:${member.family.mobile}`} className="text-decoration-none fw-semibold text-primary">
              <i className="bi bi-telephone me-1"></i> {member.family.mobile}
            </a>
          </div>
          <div className="col-12 col-md-6">
            <span className="text-muted small d-block">Head of Family</span>
            <span className="fw-semibold text-dark">{member.family.headName}</span>
          </div>
          <div className="col-12 col-md-6">
            <span className="text-muted small d-block">Area / Residence</span>
            <span className="text-secondary">{member.family.area} — {member.family.address}</span>
          </div>
        </div>
      </div>

      {/* Pathshala Profile Card */}
      <div className="card-clean p-4 mb-4 bg-white">
        <h3 className="h5 fw-bold text-dark mb-3 border-bottom pb-2">
          Pathshala &amp; Religious Education Status
        </h3>

        <div className="row g-3">
          <div className="col-12 col-sm-6 col-md-4">
            <span className="text-muted small d-block mb-1">Current Attendance Status</span>
            <StatusBadge type="pathshala" value={member.pathshalaStatus} />
          </div>

          <div className="col-12 col-sm-6 col-md-4">
            <span className="text-muted small d-block mb-1">Preferred Day</span>
            <strong className="text-dark d-block">
              {member.preferredDay !== "NO_PREFERENCE" ? member.preferredDay : "No Specific Preference"}
            </strong>
            {member.preferredDay === "WEEKDAY" && member.preferredWeekdays && (
              <span className="badge bg-primary-subtle text-primary border border-primary-subtle mt-1">
                {member.preferredWeekdays}
              </span>
            )}
          </div>

          <div className="col-12 col-sm-6 col-md-4">
            <span className="text-muted small d-block mb-1">Preferred Time</span>
            <strong className="text-dark">
              {member.preferredTime !== "NO_PREFERENCE" ? member.preferredTime : "No Specific Preference"}
            </strong>
          </div>

          <div className="col-12 col-md-6">
            <span className="text-muted small d-block mb-1">Conveyance / Pick &amp; Drop (पिक-एंड-ड्रॉप)</span>
            {member.transportPreference === "PICK_AND_DROP" ? (
              <span className="badge bg-success-subtle text-success fs-6 fw-semibold border border-success-subtle px-2 py-1">
                🚐 Wants Pick &amp; Drop Service (पिक-एंड-ड्रॉप सेवा)
              </span>
            ) : member.transportPreference === "BY_SELF" ? (
              <span className="badge bg-light text-dark fs-6 border px-2 py-1">
                🚶 By Self / Parents Conveyance (स्वयं द्वारा)
              </span>
            ) : (
              <span className="text-muted small">No conveyance preference specified</span>
            )}
          </div>
        </div>
      </div>

      {/* Interests Card */}
      <div className="card-clean p-4 mb-4 bg-white">
        <h3 className="h5 fw-bold text-dark mb-3 border-bottom pb-2">
          Interests &amp; Seva Activities (आपकी रुचि)
        </h3>

        {member.interests && member.interests.length > 0 ? (
          <div className="d-flex flex-wrap gap-2">
            {member.interests.map((interestKey: string) => {
              const opt = MEMBER_INTERESTS.find((i) => i.key === interestKey);
              return (
                <span
                  key={interestKey}
                  className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-2 fs-6 rounded-pill"
                >
                  <i className="bi bi-star-fill text-warning me-1"></i>
                  {opt ? `${opt.label} (${opt.hindiLabel})` : interestKey}
                </span>
              );
            })}
          </div>
        ) : (
          <p className="text-muted small mb-0">
            No specific interest areas recorded yet. These can be selected via the Member Verification &amp; Interest Portal.
          </p>
        )}
      </div>

      {/* Google Sheet Sync Info */}
      <div className="card-clean p-3 bg-light">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <span className="small text-muted d-block">Google Sheet Synchronized Key:</span>
            <span className="font-monospace fw-bold text-dark">{member.memberId}</span>
          </div>
          <div>
            <StatusBadge type="sync" value={member.sheetSync?.status || "PENDING"} />
          </div>
        </div>
      </div>
    </div>
  );
}
