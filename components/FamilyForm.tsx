"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createFamilyAction } from "@/lib/actions/family-actions";
import {
  FamilyFormValues,
  MemberInput,
  calculateAgeFromDob,
} from "@/lib/validation/family";

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

export default function FamilyForm({ sanghs, userSanghId }: FamilyFormProps) {
  const router = useRouter();

  // Current Step: 1 = Family Details, 2 = Members, 3 = Review, 4 = Success
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

  const todayStr = new Date().toISOString().split("T")[0];

  // Form State
  const [formData, setFormData] = useState<FamilyFormValues>({
    headName: "",
    headDateOfBirth: "",
    headAge: 40,
    headGender: "MALE",
    mobile: "",
    address: "",
    area: "",
    sanghId: userSanghId || (sanghs.length > 0 ? sanghs[0].id : ""),
    headPathshalaStatus: "UNKNOWN",
    headPreferredDay: "NO_PREFERENCE",
    headPreferredTime: "NO_PREFERENCE",
    headPreferredWeekdays: "",
    headTransportPreference: "BY_SELF",
    headWhatsappConsent: false,
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
          dateOfBirth: "",
          age: 10,
          gender: "MALE",
          relationship: "SON",
          pathshalaStatus: "UNKNOWN",
          preferredDay: "NO_PREFERENCE",
          preferredTime: "NO_PREFERENCE",
          preferredWeekdays: "",
          transportPreference: null,
          whatsappNumber: "",
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
      const member = { ...updated[index], [field]: value };

      // Automatic age calculation when DOB changes
      if (field === "dateOfBirth") {
        if (value && typeof value === "string" && value.trim()) {
          try {
            const calculated = calculateAgeFromDob(value);
            if (calculated !== null) {
              member.age = calculated;
            }
          } catch {
            // Will be caught by validator
          }
        }
      }

      updated[index] = member;
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
    if (formData.headDateOfBirth && formData.headDateOfBirth > todayStr) {
      setErrorMsg("Head of family Date of Birth cannot be in the future.");
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
      if (m.dateOfBirth && m.dateOfBirth > todayStr) {
        setErrorMsg(`Date of Birth for member #${i + 1} (${m.name}) cannot be in the future.`);
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
      setCurrentStep(3); // Review step
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
      headDateOfBirth: "",
      headAge: 40,
      headGender: "MALE",
      mobile: "",
      address: "",
      area: "",
      sanghId: userSanghId || (sanghs.length > 0 ? sanghs[0].id : ""),
      headPathshalaStatus: "UNKNOWN",
      headPreferredDay: "NO_PREFERENCE",
      headPreferredTime: "NO_PREFERENCE",
      headPreferredWeekdays: "",
      headTransportPreference: "BY_SELF",
      headWhatsappConsent: false,
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
  // STEP 5: SUCCESS SCREEN
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
          <div className={`form-step-item ${currentStep === 3 ? "form-step-active" : ""}`}>
            <div className="form-step-circle">3</div>
            <span className="form-step-label">Review &amp; Submit</span>
          </div>
        </div>
      </nav>

      {/* Exact Duplicate Warning Banner */}
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

      {/* =====================================================================
          STEP 1: FAMILY DETAILS
          ===================================================================== */}
      {currentStep === 1 && (
        <div className="step-container">
          <h4 className="fw-bold text-dark mb-1">Section 1: Family Information</h4>
          <p className="text-muted small mb-4">
            Enter the primary household information and select the corresponding Sangh.
          </p>

          <div className="row g-3">
            {/* Sangh Dropdown */}
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
            <div className="col-12 col-md-5">
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

            {/* Head Date of Birth */}
            <div className="col-12 col-sm-6 col-md-3">
              <label htmlFor="head-dob" className="form-label fw-semibold text-dark">
                Date of Birth
              </label>
              <input
                type="date"
                id="head-dob"
                max={todayStr}
                className="form-control"
                value={formData.headDateOfBirth || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    try {
                      const calcAge = calculateAgeFromDob(val);
                      if (calcAge !== null) {
                        setFormData((prev) => ({
                          ...prev,
                          headDateOfBirth: val,
                          headAge: calcAge,
                        }));
                        return;
                      }
                    } catch {}
                  }
                  setFormData((prev) => ({ ...prev, headDateOfBirth: val }));
                }}
              />
              <div className="form-text">Auto-calculates age from birth date.</div>
            </div>

            {/* Head Age */}
            <div className="col-6 col-sm-3 col-md-2">
              <label htmlFor="head-age" className="form-label fw-semibold text-dark">
                Age <span className="text-danger">*</span>
                {formData.headDateOfBirth && (
                  <span className="badge bg-success-subtle text-success ms-1 small">Auto</span>
                )}
              </label>
              <input
                type="number"
                id="head-age"
                inputMode="numeric"
                min="1"
                max="120"
                className={`form-control ${formData.headDateOfBirth ? "bg-light text-muted" : ""}`}
                value={formData.headAge}
                readOnly={Boolean(formData.headDateOfBirth)}
                title={formData.headDateOfBirth ? "Automatically calculated from Date of Birth" : "Enter age"}
                onChange={(e) => {
                  if (!formData.headDateOfBirth) {
                    setFormData({ ...formData, headAge: parseInt(e.target.value) || 0 });
                  }
                }}
                required
              />
              {formData.headDateOfBirth ? (
                <div className="form-text text-success">Calculated from DOB</div>
              ) : (
                <div className="form-text">Completed years</div>
              )}
            </div>

            {/* Head Gender */}
            <div className="col-6 col-sm-3 col-md-2">
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
          STEP 2: FAMILY MEMBERS
          ===================================================================== */}
      {currentStep === 2 && (
        <div className="step-container">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h4 className="fw-bold text-dark mb-0">Section 2: Additional Family Members</h4>
              <p className="text-muted small mb-0">
                Head ({formData.headName}, Age {formData.headAge}) is recorded as Member #1.
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
                      {/* Name */}
                      <div className="col-12 col-sm-6 col-md-3">
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

                      {/* Date of Birth */}
                      <div className="col-6 col-sm-6 col-md-3">
                        <label className="form-label small fw-semibold text-dark mb-1">
                          Date of Birth
                        </label>
                        <input
                          type="date"
                          max={todayStr}
                          className="form-control form-control-sm"
                          value={member.dateOfBirth || ""}
                          onChange={(e) => updateMember(idx, "dateOfBirth", e.target.value)}
                        />
                      </div>

                      {/* Age (Auto-calculated if DOB provided) */}
                      <div className="col-6 col-sm-4 col-md-2">
                        <label className="form-label small fw-semibold text-dark mb-1">
                          Age <span className="text-danger">*</span>
                          {member.dateOfBirth && (
                            <span className="badge bg-success-subtle text-success ms-1" style={{ fontSize: "0.65rem" }}>Auto</span>
                          )}
                        </label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          max="120"
                          className={`form-control form-control-sm ${member.dateOfBirth ? "bg-white text-muted" : ""}`}
                          value={member.age}
                          readOnly={Boolean(member.dateOfBirth)}
                          title={member.dateOfBirth ? "Automatically calculated from Date of Birth" : "Enter age"}
                          onChange={(e) => {
                            if (!member.dateOfBirth) {
                              updateMember(idx, "age", parseInt(e.target.value) || 0);
                            }
                          }}
                          required
                        />
                      </div>

                      {/* Gender */}
                      <div className="col-6 col-sm-4 col-md-2">
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

                      {/* Relationship */}
                      <div className="col-6 col-sm-4 col-md-2">
                        <label className="form-label small fw-semibold text-dark mb-1">
                          Relationship
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

                      {/* Individual WhatsApp Number (Optional) */}
                      <div className="col-12 col-sm-6 col-md-3">
                        <label className="form-label small fw-semibold text-dark mb-1">
                          <i className="bi bi-whatsapp text-success me-1"></i>WhatsApp No. <span className="text-muted fw-normal">(Optional)</span>
                        </label>
                        <input
                          type="tel"
                          inputMode="numeric"
                          maxLength={15}
                          className="form-control form-control-sm"
                          placeholder="Individual WhatsApp (optional)"
                          value={member.whatsappNumber || ""}
                          onChange={(e) => updateMember(idx, "whatsappNumber", e.target.value)}
                        />
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
          STEP 3: REVIEW BEFORE SUBMIT
          ===================================================================== */}
      {currentStep === 3 && (
        <div className="step-container">
          <h4 className="fw-bold text-dark mb-1">Review & Confirm Family Survey</h4>
          <p className="text-muted small mb-4">
            Please carefully review all entered family details before final submission.
          </p>

          {/* Member Duplicate Warnings */}
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
                {formData.headDateOfBirth && (
                  <span className="text-muted d-block small">DOB: {formData.headDateOfBirth}</span>
                )}
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
                    <th>DOB / Age</th>
                    <th>Gender</th>
                    <th>Relationship</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>1</strong></td>
                    <td className="fw-bold">{formData.headName} <span className="badge bg-secondary">Head</span></td>
                    <td>
                      <span className="fw-semibold">{formData.headAge} yrs</span>
                      {formData.headDateOfBirth && (
                        <div className="small text-muted font-monospace">{formData.headDateOfBirth}</div>
                      )}
                    </td>
                    <td>{formData.headGender}</td>
                    <td>Head</td>
                  </tr>
                  {formData.members.map((m, idx) => (
                    <tr key={idx}>
                      <td>{idx + 2}</td>
                      <td className="fw-semibold">
                        {m.name}
                        {m.whatsappNumber && (
                          <div className="small text-success fw-normal">
                            <i className="bi bi-whatsapp me-1"></i>{m.whatsappNumber}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="fw-semibold">{m.age} yrs</span>
                        {m.age < 18 && <span className="badge bg-warning text-dark ms-1">Child</span>}
                        {m.dateOfBirth && (
                          <div className="small text-muted font-monospace">{m.dateOfBirth}</div>
                        )}
                      </td>
                      <td>{m.gender}</td>
                      <td>{m.relationship}</td>
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

        {currentStep < 3 ? (
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

      {/* Validation Error Message Displayed Directly Below the Next / Submit Button */}
      {errorMsg && (
        <div
          id="registration-error-below-next"
          className="alert alert-danger py-2 px-3 mt-3 d-flex align-items-center justify-content-between gap-2 shadow-sm border-danger animate-fade-in"
          role="alert"
        >
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-exclamation-triangle-fill text-danger fs-5 flex-shrink-0"></i>
            <span className="fw-semibold text-danger-emphasis">{errorMsg}</span>
          </div>
          <button
            type="button"
            className="btn-close flex-shrink-0"
            onClick={() => setErrorMsg(null)}
            aria-label="Dismiss error"
          ></button>
        </div>
      )}

      {/* Visible Floating Popup Modal/Toast for Immediate Attention */}
      {errorMsg && (
        <div
          className="position-fixed bottom-0 start-50 translate-middle-x mb-4 p-3 z-3"
          style={{ maxWidth: "90%", width: "520px" }}
        >
          <div className="card shadow-lg border-danger border-2 bg-white">
            <div className="card-body py-2 px-3 d-flex align-items-center justify-content-between gap-2">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-exclamation-circle-fill fs-4 text-danger flex-shrink-0"></i>
                <div className="small fw-bold text-dark">{errorMsg}</div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger py-0 px-2 flex-shrink-0"
                onClick={() => setErrorMsg(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
