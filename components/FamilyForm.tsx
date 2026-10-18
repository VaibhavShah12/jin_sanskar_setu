"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createFamilyAction } from "@/lib/actions/family-actions";
import { FamilyFormValues, MemberInput } from "@/lib/validation/family";

interface SanghOption {
  id: string;
  name: string;
  prefix: string;
}

interface FamilyFormProps {
  sanghs: SanghOption[];
  userSanghId?: string | null;
  userUsername?: string;
}

const WEEKDAYS = [
  { id: "Monday", label: "Monday", hindi: "सोम" },
  { id: "Tuesday", label: "Tuesday", hindi: "मंगल" },
  { id: "Wednesday", label: "Wednesday", hindi: "बुध" },
  { id: "Thursday", label: "Thursday", hindi: "गुरु" },
  { id: "Friday", label: "Friday", hindi: "शुक्र" },
];

function toggleWeekdaySelection(currentStr: string | null | undefined, day: string): string {
  const currentList = currentStr ? currentStr.split(",").map((d) => d.trim()).filter(Boolean) : [];
  const nextList = currentList.includes(day)
    ? currentList.filter((d) => d !== day)
    : [...currentList, day];
  const order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  return order.filter((d) => nextList.includes(d)).join(", ");
}

export default function FamilyForm({ sanghs, userSanghId, userUsername }: FamilyFormProps) {
  const router = useRouter();

  // Current Step: 1 = Family Details, 2 = Members, 3 = Pathshala Info, 4 = Review, 5 = Success
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [duplicateData, setDuplicateData] = useState<any | null>(null);
  const [memberWarnings, setMemberWarnings] = useState<any[] | null>(null);
  const [bypassWarnings, setBypassWarnings] = useState(false);

  // Success payload
  const [successResult, setSuccessResult] = useState<{
    familyId: string;
    id: string;
    headMemberId: string;
    memberIds: string[];
  } | null>(null);

  // Form State
  const [formData, setFormData] = useState<FamilyFormValues>({
    headName: "",
    headAge: 40,
    headGender: "MALE",
    mobile: "",
    address: "",
    area: "",
    sanghId: userSanghId || (sanghs.length > 0 ? sanghs[0].id : ""),
    headPathshalaStatus: "UNKNOWN",
    headPathshalaInterest: "UNKNOWN",
    headPreferredDay: "NO_PREFERENCE",
    headPreferredTime: "NO_PREFERENCE",
    headPreferredWeekdays: "",
    headTransportPreference: "BY_SELF",
    headNoInterestReason: "",
    members: [],
  });

  // Dynamic Members State
  const addMember = () => {
    setFormData((prev) => ({
      ...prev,
      members: [
        ...prev.members,
        {
          name: "",
          age: 10,
          gender: "MALE",
          relationship: "SON",
          pathshalaStatus: "NO",
          pathshalaInterest: "YES",
          preferredDay: "SUNDAY",
          preferredTime: "MORNING",
          preferredWeekdays: "",
          transportPreference: "PICK_AND_DROP",
          noInterestReason: "",
        },
      ],
    }));
  };

  const removeMember = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      members: prev.members.filter((_, idx) => idx !== index),
    }));
  };

  const updateMember = (index: number, field: keyof MemberInput, value: any) => {
    setFormData((prev) => {
      const updated = [...prev.members];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, members: updated };
    });
  };

  // Step 1 Validation
  const validateStep1 = () => {
    setErrorMsg(null);
    if (!formData.headName.trim() || formData.headName.trim().length < 2) {
      setErrorMsg("Please enter a valid Head of Family name (minimum 2 characters).");
      return false;
    }
    if (!formData.mobile.trim() || formData.mobile.replace(/[^0-9]/g, "").length < 10) {
      setErrorMsg("Please enter a valid 10-digit mobile number.");
      return false;
    }
    if (!formData.address.trim() || formData.address.trim().length < 5) {
      setErrorMsg("Please enter an address (minimum 5 characters).");
      return false;
    }
    if (!formData.area.trim()) {
      setErrorMsg("Please enter an area / locality.");
      return false;
    }
    if (!formData.sanghId) {
      setErrorMsg("Please select a Sangh.");
      return false;
    }
    return true;
  };

  // Step 2 Validation
  const validateStep2 = () => {
    setErrorMsg(null);
    for (let i = 0; i < formData.members.length; i++) {
      const m = formData.members[i];
      if (!m.name.trim() || m.name.trim().length < 2) {
        setErrorMsg(`Please enter a valid name for member #${i + 1}.`);
        return false;
      }
      if (m.age === undefined || m.age < 0 || m.age > 120) {
        setErrorMsg(`Please enter a valid age for member #${i + 1} (${m.name || "Member"}).`);
        return false;
      }
    }
    return true;
  };

  // Handle Next
  const handleNext = async () => {
    if (currentStep === 1) {
      if (!validateStep1()) return;
      // Pre-check duplicate on step 1
      try {
        const res = await fetch("/api/duplicate-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mobile: formData.mobile,
            sanghId: formData.sanghId,
          }),
        });
        const data = await res.json();
        if (data.isExactFamilyDuplicate && data.existingFamily) {
          setDuplicateData(data.existingFamily);
          return;
        } else {
          setDuplicateData(null);
        }
      } catch (err) {
        console.warn("Duplicate pre-check skipped due to network:", err);
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!validateStep2()) return;
      setCurrentStep(3);
    } else if (currentStep === 3) {
      setCurrentStep(4); // Review step
    }
  };

  const handlePrev = () => {
    setErrorMsg(null);
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  // Final Submission
  const handleSubmit = async () => {
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const result = await createFamilyAction(formData, bypassWarnings);

      if (!result.success) {
        if (result.error === "EXACT_DUPLICATE_FOUND" && result.duplicateInfo) {
          setDuplicateData(result.duplicateInfo);
          setCurrentStep(1);
        } else if (result.error === "POSSIBLE_MEMBER_DUPLICATES" && result.warnings) {
          setMemberWarnings(result.warnings);
          setErrorMsg("Potential duplicate members detected. Review warnings below and confirm to proceed.");
        } else {
          setErrorMsg(result.error || "Failed to register family. Please verify information.");
        }
        setSubmitting(false);
        return;
      }

      // Success!
      setSuccessResult({
        familyId: result.familyId!,
        id: result.id!,
        headMemberId: result.headMemberId!,
        memberIds: result.memberIds || [],
      });
      setCurrentStep(5);
    } catch (err: any) {
      setErrorMsg(err?.message || "An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      headName: "",
      headAge: 40,
      headGender: "MALE",
      mobile: "",
      address: "",
      area: "",
      sanghId: userSanghId || (sanghs.length > 0 ? sanghs[0].id : ""),
      headPathshalaStatus: "UNKNOWN",
      headPathshalaInterest: "UNKNOWN",
      headPreferredDay: "NO_PREFERENCE",
      headPreferredTime: "NO_PREFERENCE",
      headPreferredWeekdays: "",
      headTransportPreference: "BY_SELF",
      headNoInterestReason: "",
      members: [],
    });
    setDuplicateData(null);
    setMemberWarnings(null);
    setBypassWarnings(false);
    setSuccessResult(null);
    setCurrentStep(1);
  };

  const selectedSangh = sanghs.find((s) => s.id === formData.sanghId);

  // =========================================================================
  // STEP 5: SUCCESS SCREEN (Section 28)
  // =========================================================================
  if (currentStep === 5 && successResult) {
    return (
      <div className="card-clean p-4 p-md-5 text-center shadow-elevated border-success">
        <div className="rounded-circle bg-success text-white d-inline-flex p-3 fs-1 mb-3">
          <i className="bi bi-check-lg"></i>
        </div>

        <h2 className="h3 fw-bold text-dark mb-1">Family Registered Successfully!</h2>
        <p className="text-muted mb-4">
          All records have been atomically committed to PostgreSQL and queued for reporting.
        </p>

        {/* Generated Family ID */}
        <div className="card bg-light border-0 p-3 mb-4 d-inline-block w-100 max-w-md mx-auto">
          <small className="text-muted text-uppercase fw-semibold d-block">Generated Family ID</small>
          <span className="display-6 fw-bold text-primary font-monospace">{successResult.familyId}</span>
        </div>

        {/* Generated Member IDs */}
        <div className="mb-4 text-start max-w-md mx-auto">
          <h6 className="fw-bold text-dark mb-2">Generated Sangh Member IDs:</h6>
          <div className="list-group shadow-sm">
            {successResult.memberIds.map((mid, idx) => (
              <div key={mid} className="list-group-item d-flex justify-content-between align-items-center py-2">
                <div>
                  <span className="badge bg-light text-secondary border me-2">#{idx + 1}</span>
                  <span className="fw-semibold text-dark">
                    {idx === 0 ? `${formData.headName} (Head)` : formData.members[idx - 1]?.name}
                  </span>
                </div>
                <span className="badge-sangh font-monospace fs-6">{mid}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="d-flex flex-column flex-sm-row justify-content-center gap-3 pt-2">
          <Link href={`/families/${successResult.id}`} className="btn btn-jain-primary px-4 py-2">
            <i className="bi bi-eye-fill me-2"></i> View Family Details
          </Link>
          <button onClick={resetForm} className="btn btn-outline-secondary px-4 py-2">
            <i className="bi bi-person-plus-fill me-2"></i> Add Another Family
          </button>
          <Link href="/dashboard" className="btn btn-light px-4 py-2">
            <i className="bi bi-speedometer2 me-2"></i> Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card-clean p-3 p-md-4 shadow-card">
      {/* Stepper Progress Bar */}
      <nav aria-label="Registration Progress" className="mb-4">
        <div className="form-step-indicator">
          <div className={`form-step-item ${currentStep === 1 ? "form-step-active" : currentStep > 1 ? "form-step-completed" : ""}`}>
            <div className="form-step-circle">1</div>
            <span className="form-step-label">Family Details</span>
          </div>
          <div className={`form-step-item ${currentStep === 2 ? "form-step-active" : currentStep > 2 ? "form-step-completed" : ""}`}>
            <div className="form-step-circle">2</div>
            <span className="form-step-label">Members</span>
          </div>
          <div className={`form-step-item ${currentStep === 3 ? "form-step-active" : currentStep > 3 ? "form-step-completed" : ""}`}>
            <div className="form-step-circle">3</div>
            <span className="form-step-label">Pathshala</span>
          </div>
          <div className={`form-step-item ${currentStep === 4 ? "form-step-active" : ""}`}>
            <div className="form-step-circle">4</div>
            <span className="form-step-label">Review</span>
          </div>
        </div>
      </nav>

      {/* Exact Duplicate Warning Banner (Section 16) */}
      {duplicateData && (
        <div className="alert alert-danger py-3 px-3 mb-4 shadow-sm" role="alert">
          <div className="d-flex align-items-start gap-2">
            <i className="bi bi-exclamation-octagon-fill fs-4 mt-1"></i>
            <div>
              <h6 className="fw-bold mb-1">Possible Existing Family Found!</h6>
              <p className="small mb-2">
                A family with mobile number <strong>{formData.mobile}</strong> is already registered in{" "}
                <strong>{duplicateData.sanghName}</strong>.
              </p>
              <div className="bg-white p-2 rounded border small text-dark mb-2">
                <div><strong>Existing Family ID:</strong> {duplicateData.familyId}</div>
                <div><strong>Head of Family:</strong> {duplicateData.headName}</div>
                <div><strong>Area:</strong> {duplicateData.area}</div>
              </div>
              <Link href={`/families/${duplicateData.id}`} className="btn btn-danger btn-sm">
                <i className="bi bi-box-arrow-up-right me-1"></i> Open Existing Family Record
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* General Error Message */}
      {errorMsg && (
        <div className="alert alert-danger py-2 px-3 small mb-4 d-flex align-items-center gap-2" role="alert">
          <i className="bi bi-exclamation-triangle-fill"></i>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* =====================================================================
          STEP 1: FAMILY DETAILS (Section 14)
          ===================================================================== */}
      {currentStep === 1 && (
        <div className="step-container">
          <h4 className="fw-bold text-dark mb-1">Section 1: Family Information</h4>
          <p className="text-muted small mb-4">
            Enter the primary household information and select the corresponding Sangh.
          </p>

          <div className="row g-3">
            {/* Sangh Dropdown - Exactly the six Sanghs */}
            <div className="col-12 col-md-6">
              <label htmlFor="family-sangh" className="form-label fw-semibold text-dark">
                Sangh <span className="text-danger">*</span>
              </label>
              <select
                id="family-sangh"
                className="form-select"
                value={formData.sanghId}
                onChange={(e) => setFormData({ ...formData, sanghId: e.target.value })}
                required
              >
                {sanghs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.prefix})
                  </option>
                ))}
              </select>
            </div>

            {/* Mobile Number */}
            <div className="col-12 col-md-6">
              <label htmlFor="family-mobile" className="form-label fw-semibold text-dark">
                Mobile Number <span className="text-danger">*</span>
              </label>
              <input
                type="tel"
                id="family-mobile"
                inputMode="numeric"
                autoComplete="tel"
                className="form-control"
                placeholder="e.g. 9822012345"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                required
              />
              <div className="form-text">Primary contact for Sangh communications.</div>
            </div>

            {/* Head of Family Name */}
            <div className="col-12 col-md-8">
              <label htmlFor="head-name" className="form-label fw-semibold text-dark">
                Head of Family Name <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                id="head-name"
                className="form-control"
                placeholder="Full name of family head"
                value={formData.headName}
                onChange={(e) => setFormData({ ...formData, headName: e.target.value })}
                required
              />
            </div>

            {/* Head Age */}
            <div className="col-6 col-md-2">
              <label htmlFor="head-age" className="form-label fw-semibold text-dark">
                Age <span className="text-danger">*</span>
              </label>
              <input
                type="number"
                id="head-age"
                inputMode="numeric"
                min="1"
                max="120"
                className="form-control"
                value={formData.headAge}
                onChange={(e) => setFormData({ ...formData, headAge: parseInt(e.target.value) || 0 })}
                required
              />
            </div>

            {/* Head Gender */}
            <div className="col-6 col-md-2">
              <label htmlFor="head-gender" className="form-label fw-semibold text-dark">
                Gender
              </label>
              <select
                id="head-gender"
                className="form-select"
                value={formData.headGender}
                onChange={(e) => setFormData({ ...formData, headGender: e.target.value as any })}
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
                <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
              </select>
            </div>

            {/* Area / Locality */}
            <div className="col-12 col-md-6">
              <label htmlFor="family-area" className="form-label fw-semibold text-dark">
                Area / Locality <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                id="family-area"
                className="form-control"
                placeholder="e.g. Salisbury Park, Bibwewadi, NIBM Road"
                value={formData.area}
                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                required
              />
            </div>

            {/* Full Address */}
            <div className="col-12 col-md-6">
              <label htmlFor="family-address" className="form-label fw-semibold text-dark">
                Flat / Building / Street Address <span className="text-danger">*</span>
              </label>
              <textarea
                id="family-address"
                rows={2}
                autoComplete="street-address"
                className="form-control"
                placeholder="Detailed residential address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required
              />
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          STEP 2: FAMILY MEMBERS (Section 14 & 15)
          ===================================================================== */}
      {currentStep === 2 && (
        <div className="step-container">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h4 className="fw-bold text-dark mb-0">Section 2: Additional Family Members</h4>
              <p className="text-muted small mb-0">
                Head ({formData.headName}, Age {formData.headAge}) is already recorded as Member #1.
              </p>
            </div>
            <button
              type="button"
              onClick={addMember}
              className="btn btn-jain-outline btn-sm d-flex align-items-center gap-1 shadow-sm"
              id="add-member-btn"
            >
              <i className="bi bi-person-plus"></i>
              <span>Add Member</span>
            </button>
          </div>

          {formData.members.length === 0 ? (
            <div className="text-center py-5 border border-dashed rounded-3 bg-light mb-4">
              <i className="bi bi-people text-muted display-5 d-block mb-2"></i>
              <h6 className="fw-bold text-dark mb-1">No additional members added yet</h6>
              <p className="text-muted small mb-3">
                Click below to add spouse, children, parents, or other family members.
              </p>
              <button
                type="button"
                onClick={addMember}
                className="btn btn-jain-primary btn-sm px-4"
              >
                <i className="bi bi-plus-lg me-1"></i> Add First Family Member
              </button>
            </div>
          ) : (
            <div className="d-flex flex-column gap-3 mb-4">
              {formData.members.map((member, idx) => {
                const isChild = member.age < 18;
                return (
                  <div key={idx} className="card p-3 border rounded-3 bg-light shadow-sm">
                    <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                      <span className="badge bg-secondary-subtle text-secondary font-monospace">
                        Member #{idx + 2} {isChild && <span className="badge bg-warning text-dark ms-1">Child (&lt;18)</span>}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeMember(idx)}
                        className="btn btn-outline-danger btn-sm py-0 px-2"
                        title="Remove member"
                        aria-label={`Remove member ${idx + 2}`}
                      >
                        <i className="bi bi-trash"></i> Remove
                      </button>
                    </div>

                    <div className="row g-2">
                      <div className="col-12 col-sm-6 col-md-4">
                        <label className="form-label small fw-semibold text-dark mb-1">
                          Full Name <span className="text-danger">*</span>
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Member name"
                          value={member.name}
                          onChange={(e) => updateMember(idx, "name", e.target.value)}
                          required
                        />
                      </div>

                      <div className="col-4 col-sm-3 col-md-2">
                        <label className="form-label small fw-semibold text-dark mb-1">
                          Age <span className="text-danger">*</span>
                        </label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          max="120"
                          className="form-control form-control-sm"
                          value={member.age}
                          onChange={(e) => updateMember(idx, "age", parseInt(e.target.value) || 0)}
                          required
                        />
                      </div>

                      <div className="col-8 col-sm-3 col-md-3">
                        <label className="form-label small fw-semibold text-dark mb-1">Gender</label>
                        <select
                          className="form-select form-select-sm"
                          value={member.gender}
                          onChange={(e) => updateMember(idx, "gender", e.target.value as any)}
                        >
                          <option value="MALE">Male</option>
                          <option value="FEMALE">Female</option>
                          <option value="OTHER">Other</option>
                          <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                        </select>
                      </div>

                      <div className="col-12 col-md-3">
                        <label className="form-label small fw-semibold text-dark mb-1">
                          Relationship to Head
                        </label>
                        <select
                          className="form-select form-select-sm"
                          value={member.relationship}
                          onChange={(e) => updateMember(idx, "relationship", e.target.value as any)}
                        >
                          <option value="SPOUSE">Spouse</option>
                          <option value="SON">Son</option>
                          <option value="DAUGHTER">Daughter</option>
                          <option value="FATHER">Father</option>
                          <option value="MOTHER">Mother</option>
                          <option value="BROTHER">Brother</option>
                          <option value="SISTER">Sister</option>
                          <option value="GRANDFATHER">Grandfather</option>
                          <option value="GRANDMOTHER">Grandmother</option>
                          <option value="GRANDCHILD">Grandchild</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={addMember}
                className="btn btn-outline-secondary btn-sm align-self-start"
              >
                <i className="bi bi-plus-lg me-1"></i> Add Another Member
              </button>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          STEP 3: PATHSHALA INFORMATION (Section 15)
          ===================================================================== */}
      {currentStep === 3 && (
        <div className="step-container">
          <h4 className="fw-bold text-dark mb-1">Section 3: Pathshala Information</h4>
          <p className="text-muted small mb-4">
            Collect Pathshala attendance and preferences. Special emphasis on children under 18 years old.
          </p>

          {/* Head Pathshala Status */}
          <div className="card p-3 border rounded-3 mb-3 bg-white">
            <h6 className="fw-bold text-dark mb-2">
              Head of Family: {formData.headName} ({formData.headAge} yrs)
            </h6>
            <div className="row g-2">
              <div className="col-6 col-md-3">
                <label className="form-label small text-muted mb-1">Pathshala Status</label>
                <select
                  className="form-select form-select-sm"
                  value={formData.headPathshalaStatus}
                  onChange={(e) => setFormData({ ...formData, headPathshalaStatus: e.target.value as any })}
                >
                  <option value="UNKNOWN">Unknown</option>
                  <option value="YES">Yes (Attending)</option>
                  <option value="NO">No (Not Attending)</option>
                  <option value="PREVIOUSLY_ATTENDED">Previously Attended</option>
                </select>
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small text-muted mb-1">Interest</label>
                <select
                  className="form-select form-select-sm"
                  value={formData.headPathshalaInterest}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setFormData({
                      ...formData,
                      headPathshalaInterest: val,
                      headTransportPreference: val === "YES" ? (formData.headTransportPreference || "PICK_AND_DROP") : formData.headTransportPreference,
                    });
                  }}
                >
                  <option value="UNKNOWN">Unknown</option>
                  <option value="YES">Yes</option>
                  <option value="MAYBE">Maybe</option>
                  <option value="NO">No</option>
                </select>
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small text-muted mb-1">Preferred Day</label>
                <select
                  className="form-select form-select-sm"
                  value={formData.headPreferredDay}
                  onChange={(e) => setFormData({ ...formData, headPreferredDay: e.target.value as any })}
                >
                  <option value="NO_PREFERENCE">No Preference</option>
                  <option value="SUNDAY">Sunday</option>
                  <option value="SATURDAY">Saturday</option>
                  <option value="WEEKDAY">Weekday</option>
                </select>
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small text-muted mb-1">Preferred Time</label>
                <select
                  className="form-select form-select-sm"
                  value={formData.headPreferredTime}
                  onChange={(e) => setFormData({ ...formData, headPreferredTime: e.target.value as any })}
                >
                  <option value="NO_PREFERENCE">No Preference</option>
                  <option value="MORNING">Morning</option>
                  <option value="AFTERNOON">Afternoon</option>
                  <option value="EVENING">Evening</option>
                </select>
              </div>
            </div>

            {/* Conditional: Preferred Weekdays Checkboxes (if Interest is YES and Preferred Day is WEEKDAY) */}
            {formData.headPathshalaInterest === "YES" && formData.headPreferredDay === "WEEKDAY" && (
              <div className="mt-3 p-3 bg-light border border-primary-subtle rounded-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <label className="form-label small fw-semibold text-primary-emphasis mb-0">
                    <i className="bi bi-calendar-check me-1"></i>
                    Select Preferred Weekdays (सप्ताह के कौन से दिन पाठशाला जा सकते हैं?)
                  </label>
                  <div className="btn-group btn-group-sm">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm py-0 px-2"
                      style={{ fontSize: "0.75rem" }}
                      onClick={() =>
                        setFormData({
                          ...formData,
                          headPreferredWeekdays: "Monday, Tuesday, Wednesday, Thursday, Friday",
                        })
                      }
                    >
                      All (Mon–Fri)
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm py-0 px-2"
                      style={{ fontSize: "0.75rem" }}
                      onClick={() =>
                        setFormData({
                          ...formData,
                          headPreferredWeekdays: "",
                        })
                      }
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="d-flex flex-wrap gap-2 pt-1">
                  {WEEKDAYS.map((day) => {
                    const isChecked = (formData.headPreferredWeekdays || "")
                      .split(",")
                      .map((d) => d.trim())
                      .includes(day.id);
                    return (
                      <label
                        key={day.id}
                        className={`btn btn-sm d-flex align-items-center gap-1 border ${
                          isChecked
                            ? "btn-primary text-white border-primary fw-semibold shadow-sm"
                            : "btn-light text-dark border-secondary-subtle"
                        }`}
                        style={{ cursor: "pointer" }}
                      >
                        <input
                          type="checkbox"
                          className="form-check-input me-1 my-0"
                          checked={isChecked}
                          onChange={() =>
                            setFormData({
                              ...formData,
                              headPreferredWeekdays: toggleWeekdaySelection(
                                formData.headPreferredWeekdays,
                                day.id
                              ),
                            })
                          }
                        />
                        <span>{day.label}</span>
                        <span className={isChecked ? "text-white-50 small ms-1" : "text-muted small ms-1"}>
                          ({day.hindi})
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Conditional: Pick & Drop (if YES) */}
            {formData.headPathshalaInterest === "YES" && (
              <div className="mt-3 p-3 bg-light border border-success-subtle rounded-3">
                <label className="form-label small fw-semibold text-success-emphasis mb-2 d-block">
                  <i className="bi bi-bus-front me-1"></i>
                  Conveyance Preference (पिक-एंड-ड्रॉप सेवा या स्वयं द्वारा?) <span className="text-danger">*</span>
                </label>
                <div className="d-flex flex-wrap gap-4">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="head-transport"
                      id="head-transport-pick"
                      value="PICK_AND_DROP"
                      checked={formData.headTransportPreference === "PICK_AND_DROP"}
                      onChange={() => setFormData({ ...formData, headTransportPreference: "PICK_AND_DROP" })}
                    />
                    <label className="form-check-label small fw-medium text-dark" htmlFor="head-transport-pick">
                      🚐 Want Pick &amp; Drop Service (रिक्शा / वैन सेवा चाहिए)
                    </label>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="head-transport"
                      id="head-transport-self"
                      value="BY_SELF"
                      checked={formData.headTransportPreference === "BY_SELF"}
                      onChange={() => setFormData({ ...formData, headTransportPreference: "BY_SELF" })}
                    />
                    <label className="form-check-label small fw-medium text-dark" htmlFor="head-transport-self">
                      🚶 By Self (स्वयं द्वारा - Parents / Self)
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Conditional: Reason Comment Box (if NO) */}
            {formData.headPathshalaInterest === "NO" && (
              <div className="mt-3 p-3 bg-light border border-danger-subtle rounded-3">
                <label className="form-label small fw-semibold text-danger-emphasis mb-1 d-block">
                  <i className="bi bi-chat-square-text me-1"></i>
                  Reason for not attending Pathshala? (पाठशाला में रुचि न होने का कारण)
                </label>
                <textarea
                  className="form-control form-control-sm bg-white"
                  rows={2}
                  placeholder="Enter reason e.g. Timing clash, distance, classes elsewhere, etc. (कारण दर्ज करें)"
                  value={formData.headNoInterestReason || ""}
                  onChange={(e) => setFormData({ ...formData, headNoInterestReason: e.target.value })}
                />
              </div>
            )}
          </div>

          {/* Additional Members Pathshala Fields */}
          {formData.members.map((member, idx) => {
            const isChild = member.age < 18;
            return (
              <div
                key={idx}
                className={`card p-3 border rounded-3 mb-3 ${isChild ? "border-warning-subtle bg-amber-50" : "bg-white"}`}
                style={isChild ? { backgroundColor: "#fffef9" } : {}}
              >
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="fw-bold text-dark mb-0">
                    {member.name || `Member #${idx + 2}`} ({member.age} yrs, {member.relationship})
                  </h6>
                  {isChild && (
                    <span className="badge bg-warning text-dark">
                      <i className="bi bi-star-fill me-1"></i> Child Target
                    </span>
                  )}
                </div>

                <div className="row g-2">
                  <div className="col-6 col-md-3">
                    <label className="form-label small text-muted mb-1">Pathshala Status</label>
                    <select
                      className="form-select form-select-sm"
                      value={member.pathshalaStatus}
                      onChange={(e) => updateMember(idx, "pathshalaStatus", e.target.value as any)}
                    >
                      <option value="UNKNOWN">Unknown</option>
                      <option value="YES">Yes (Attending)</option>
                      <option value="NO">No (Not Attending)</option>
                      <option value="PREVIOUSLY_ATTENDED">Previously Attended</option>
                    </select>
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label small text-muted mb-1">Interest</label>
                    <select
                      className="form-select form-select-sm"
                      value={member.pathshalaInterest}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        updateMember(idx, "pathshalaInterest", val);
                        if (val === "YES" && !member.transportPreference) {
                          updateMember(idx, "transportPreference", "PICK_AND_DROP");
                        }
                      }}
                    >
                      <option value="UNKNOWN">Unknown</option>
                      <option value="YES">Yes</option>
                      <option value="MAYBE">Maybe</option>
                      <option value="NO">No</option>
                    </select>
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label small text-muted mb-1">Preferred Day</label>
                    <select
                      className="form-select form-select-sm"
                      value={member.preferredDay}
                      onChange={(e) => updateMember(idx, "preferredDay", e.target.value as any)}
                    >
                      <option value="NO_PREFERENCE">No Preference</option>
                      <option value="SUNDAY">Sunday</option>
                      <option value="SATURDAY">Saturday</option>
                      <option value="WEEKDAY">Weekday</option>
                    </select>
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label small text-muted mb-1">Preferred Time</label>
                    <select
                      className="form-select form-select-sm"
                      value={member.preferredTime}
                      onChange={(e) => updateMember(idx, "preferredTime", e.target.value as any)}
                    >
                      <option value="NO_PREFERENCE">No Preference</option>
                      <option value="MORNING">Morning</option>
                      <option value="AFTERNOON">Afternoon</option>
                      <option value="EVENING">Evening</option>
                    </select>
                  </div>
                </div>

                {/* Conditional: Preferred Weekdays Checkboxes (if Interest is YES and Preferred Day is WEEKDAY) */}
                {member.pathshalaInterest === "YES" && member.preferredDay === "WEEKDAY" && (
                  <div className="mt-3 p-3 bg-light border border-primary-subtle rounded-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <label className="form-label small fw-semibold text-primary-emphasis mb-0">
                        <i className="bi bi-calendar-check me-1"></i>
                        Select Preferred Weekdays (सप्ताह के कौन से दिन पाठशाला जा सकते हैं?)
                      </label>
                      <div className="btn-group btn-group-sm">
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm py-0 px-2"
                          style={{ fontSize: "0.75rem" }}
                          onClick={() =>
                            updateMember(
                              idx,
                              "preferredWeekdays",
                              "Monday, Tuesday, Wednesday, Thursday, Friday"
                            )
                          }
                        >
                          All (Mon–Fri)
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm py-0 px-2"
                          style={{ fontSize: "0.75rem" }}
                          onClick={() =>
                            updateMember(idx, "preferredWeekdays", "")
                          }
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <div className="d-flex flex-wrap gap-2 pt-1">
                      {WEEKDAYS.map((day) => {
                        const isChecked = (member.preferredWeekdays || "")
                          .split(",")
                          .map((d) => d.trim())
                          .includes(day.id);
                        return (
                          <label
                            key={day.id}
                            className={`btn btn-sm d-flex align-items-center gap-1 border ${
                              isChecked
                                ? "btn-primary text-white border-primary fw-semibold shadow-sm"
                                : "btn-light text-dark border-secondary-subtle"
                            }`}
                            style={{ cursor: "pointer" }}
                          >
                            <input
                              type="checkbox"
                              className="form-check-input me-1 my-0"
                              checked={isChecked}
                              onChange={() =>
                                updateMember(
                                  idx,
                                  "preferredWeekdays",
                                  toggleWeekdaySelection(member.preferredWeekdays, day.id)
                                )
                              }
                            />
                            <span>{day.label}</span>
                            <span className={isChecked ? "text-white-50 small ms-1" : "text-muted small ms-1"}>
                              ({day.hindi})
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Conditional: Pick & Drop (if YES) */}
                {member.pathshalaInterest === "YES" && (
                  <div className="mt-3 p-3 bg-light border border-success-subtle rounded-3">
                    <label className="form-label small fw-semibold text-success-emphasis mb-2 d-block">
                      <i className="bi bi-bus-front me-1"></i>
                      Conveyance Preference (पिक-एंड-ड्रॉप सेवा या स्वयं द्वारा?) <span className="text-danger">*</span>
                    </label>
                    <div className="d-flex flex-wrap gap-4">
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name={`member-${idx}-transport`}
                          id={`member-${idx}-transport-pick`}
                          value="PICK_AND_DROP"
                          checked={member.transportPreference === "PICK_AND_DROP"}
                          onChange={() => updateMember(idx, "transportPreference", "PICK_AND_DROP")}
                        />
                        <label className="form-check-label small fw-medium text-dark" htmlFor={`member-${idx}-transport-pick`}>
                          🚐 Want Pick &amp; Drop Service (रिक्शा / वैन सेवा चाहिए)
                        </label>
                      </div>
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name={`member-${idx}-transport`}
                          id={`member-${idx}-transport-self`}
                          value="BY_SELF"
                          checked={member.transportPreference === "BY_SELF"}
                          onChange={() => updateMember(idx, "transportPreference", "BY_SELF")}
                        />
                        <label className="form-check-label small fw-medium text-dark" htmlFor={`member-${idx}-transport-self`}>
                          🚶 By Self (स्वयं द्वारा - Parents / Self)
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Conditional: Reason Comment Box (if NO) */}
                {member.pathshalaInterest === "NO" && (
                  <div className="mt-3 p-3 bg-light border border-danger-subtle rounded-3">
                    <label className="form-label small fw-semibold text-danger-emphasis mb-1 d-block">
                      <i className="bi bi-chat-square-text me-1"></i>
                      Reason for not attending Pathshala? (पाठशाला में रुचि न होने का कारण)
                    </label>
                    <textarea
                      className="form-control form-control-sm bg-white"
                      rows={2}
                      placeholder="Enter reason e.g. Timing clash, distance, classes elsewhere, etc. (कारण दर्ज करें)"
                      value={member.noInterestReason || ""}
                      onChange={(e) => updateMember(idx, "noInterestReason", e.target.value)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* =====================================================================
          STEP 4: REVIEW BEFORE SUBMIT (Section 36)
          ===================================================================== */}
      {currentStep === 4 && (
        <div className="step-container">
          <h4 className="fw-bold text-dark mb-1">Review & Confirm Family Survey</h4>
          <p className="text-muted small mb-4">
            Please carefully review all entered family details before final submission.
          </p>

          {/* Member Duplicate Warnings (if triggered by server) */}
          {memberWarnings && memberWarnings.length > 0 && (
            <div className="alert alert-warning py-3 px-3 mb-4 shadow-sm" role="alert">
              <h6 className="fw-bold text-dark mb-2">
                <i className="bi bi-exclamation-triangle-fill text-warning me-2"></i>
                Potential Duplicate Member Warnings
              </h6>
              <ul className="mb-3 ps-3 small text-secondary">
                {memberWarnings.map((w, i) => (
                  <li key={i}>{w.warning}</li>
                ))}
              </ul>
              <div className="form-check">
                <input
                  type="checkbox"
                  id="confirm-bypass"
                  className="form-check-input"
                  checked={bypassWarnings}
                  onChange={(e) => setBypassWarnings(e.target.checked)}
                />
                <label htmlFor="confirm-bypass" className="form-check-label fw-semibold text-dark small">
                  I have verified these are legitimate distinct members and confirm submission.
                </label>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          <div className="card p-3 border rounded-3 mb-3 bg-light">
            <h6 className="fw-bold text-dark border-bottom pb-2 mb-2">Household Information</h6>
            <div className="row g-2 small">
              <div className="col-6 col-md-4">
                <span className="text-muted d-block">Sangh:</span>
                <strong>{selectedSangh?.name} ({selectedSangh?.prefix})</strong>
              </div>
              <div className="col-6 col-md-4">
                <span className="text-muted d-block">Head of Family:</span>
                <strong>{formData.headName} ({formData.headAge} yrs, {formData.headGender})</strong>
              </div>
              <div className="col-6 col-md-4">
                <span className="text-muted d-block">Mobile Number:</span>
                <strong>{formData.mobile}</strong>
              </div>
              <div className="col-6 col-md-4">
                <span className="text-muted d-block">Area / Locality:</span>
                <strong>{formData.area}</strong>
              </div>
              <div className="col-12 col-md-8">
                <span className="text-muted d-block">Address:</span>
                <span>{formData.address}</span>
              </div>
            </div>
          </div>

          <div className="card p-3 border rounded-3 mb-4">
            <h6 className="fw-bold text-dark border-bottom pb-2 mb-2">
              All Members ({1 + formData.members.length} Total)
            </h6>
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Age</th>
                    <th>Relationship</th>
                    <th>Pathshala Status</th>
                    <th>Interest</th>
                    <th>Conveyance / Note</th>
                    <th>Preferred Schedule</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>1</strong></td>
                    <td className="fw-bold">{formData.headName} <span className="badge bg-secondary">Head</span></td>
                    <td>{formData.headAge}</td>
                    <td>Head</td>
                    <td><span className="badge bg-light text-dark border">{formData.headPathshalaStatus}</span></td>
                    <td><span className="badge bg-light text-dark border">{formData.headPathshalaInterest}</span></td>
                    <td>
                      {formData.headPathshalaInterest === "YES" && (
                        <span className="badge bg-success-subtle text-success border border-success-subtle">
                          {formData.headTransportPreference === "PICK_AND_DROP" ? "🚐 Pick & Drop" : "🚶 By Self"}
                        </span>
                      )}
                      {formData.headPathshalaInterest === "NO" && (
                        <span className="small text-danger" title={formData.headNoInterestReason || ""}>
                          {formData.headNoInterestReason ? `Reason: ${formData.headNoInterestReason}` : "No reason provided"}
                        </span>
                      )}
                      {formData.headPathshalaInterest !== "YES" && formData.headPathshalaInterest !== "NO" && "—"}
                    </td>
                    <td>
                      {formData.headPreferredDay === "WEEKDAY" && formData.headPreferredWeekdays ? (
                        <div>
                          <div className="fw-semibold">Weekday</div>
                          <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                            {formData.headPreferredWeekdays}
                          </span>
                          <div className="text-muted small mt-1">{formData.headPreferredTime}</div>
                        </div>
                      ) : (
                        `${formData.headPreferredDay}, ${formData.headPreferredTime}`
                      )}
                    </td>
                  </tr>
                  {formData.members.map((m, idx) => (
                    <tr key={idx}>
                      <td>{idx + 2}</td>
                      <td className="fw-semibold">{m.name}</td>
                      <td>
                        {m.age} {m.age < 18 && <span className="badge bg-warning text-dark ms-1">Child</span>}
                      </td>
                      <td>{m.relationship}</td>
                      <td><span className="badge bg-light text-dark border">{m.pathshalaStatus}</span></td>
                      <td><span className="badge bg-light text-dark border">{m.pathshalaInterest}</span></td>
                      <td>
                        {m.pathshalaInterest === "YES" && (
                          <span className="badge bg-success-subtle text-success border border-success-subtle">
                            {m.transportPreference === "PICK_AND_DROP" ? "🚐 Pick & Drop" : "🚶 By Self"}
                          </span>
                        )}
                        {m.pathshalaInterest === "NO" && (
                          <span className="small text-danger" title={m.noInterestReason || ""}>
                            {m.noInterestReason ? `Reason: ${m.noInterestReason}` : "No reason provided"}
                          </span>
                        )}
                        {m.pathshalaInterest !== "YES" && m.pathshalaInterest !== "NO" && "—"}
                      </td>
                      <td>
                        {m.preferredDay === "WEEKDAY" && m.preferredWeekdays ? (
                          <div>
                            <div className="fw-semibold">Weekday</div>
                            <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                              {m.preferredWeekdays}
                            </span>
                            <div className="text-muted small mt-1">{m.preferredTime}</div>
                          </div>
                        ) : (
                          `${m.preferredDay}, ${m.preferredTime}`
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Navigation & Submit Buttons */}
      <div className="d-flex justify-content-between align-items-center pt-3 border-top mt-4">
        {currentStep > 1 ? (
          <button
            type="button"
            onClick={handlePrev}
            disabled={submitting}
            className="btn btn-outline-secondary px-3 px-sm-4"
          >
            <i className="bi bi-arrow-left me-1"></i> Back
          </button>
        ) : (
          <Link href="/dashboard" className="btn btn-light px-3">
            Cancel
          </Link>
        )}

        {currentStep < 4 ? (
          <button
            type="button"
            onClick={handleNext}
            className="btn btn-jain-primary px-4 py-2"
          >
            Next Step <i className="bi bi-arrow-right ms-1"></i>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || (Boolean(memberWarnings && memberWarnings.length > 0) && !bypassWarnings)}
            className="btn btn-success px-4 py-2 fw-semibold shadow-sm"
            id="confirm-submit-family-btn"
          >
            {submitting ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Saving in PostgreSQL...
              </>
            ) : (
              <>
                <i className="bi bi-check2-circle me-1"></i> Confirm &amp; Save Family
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
