"use client";

import React, { useState, useEffect } from "react";
import Logo from "@/components/Logo";
import {
  requestMemberAccessAction,
  checkMemberAccessStatusAction,
  getApprovedFamilyDataAction,
  saveFamilyMemberInterestsAction,
} from "@/lib/actions/member-access-actions";
import { MEMBER_INTERESTS } from "@/lib/constants/interests";

interface MemberItem {
  id: string;
  memberId: string;
  name: string;
  calculatedAge: number;
  gender: string;
  relationship: string;
  interests: string[];
}

interface FamilyData {
  familyId: string;
  headName: string;
  mobile: string;
  address: string;
  area: string;
  sangh: {
    name: string;
    prefix: string;
  };
  members: MemberItem[];
}

type FormState = "INPUT" | "PENDING" | "APPROVED" | "REJECTED" | "SUCCESS";

export default function PublicMemberFormClient() {
  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>("INPUT");
  const [requestToken, setRequestToken] = useState<string | null>(null);
  const [grantToken, setGrantToken] = useState<string | null>(null);
  const [familyData, setFamilyData] = useState<FamilyData | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string>("");

  // Map of memberId -> Array of selected interest keys
  const [selectedInterests, setSelectedInterests] = useState<Record<string, string[]>>({});
  const [savingInterests, setSavingInterests] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Restore session if grant or request token exists in localStorage
  useEffect(() => {
    const savedGrant = localStorage.getItem("jss_member_grant_token");
    const savedRequest = localStorage.getItem("jss_member_request_token");

    if (savedGrant) {
      setGrantToken(savedGrant);
      loadFamilyProfile(savedGrant);
    } else if (savedRequest) {
      setRequestToken(savedRequest);
      checkStatus(savedRequest);
    }
  }, []);

  // Poll for volunteer validation while PENDING
  useEffect(() => {
    if (formState !== "PENDING" || !requestToken) return;

    const interval = setInterval(() => {
      checkStatus(requestToken);
    }, 3000);

    return () => clearInterval(interval);
  }, [formState, requestToken]);

  const loadFamilyProfile = async (grant: string) => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await getApprovedFamilyDataAction(grant);
      if (res.success && res.data) {
        const fam = res.data as FamilyData;
        setFamilyData(fam);

        // Pre-populate interest state from existing member records
        const initialMap: Record<string, string[]> = {};
        fam.members.forEach((m) => {
          initialMap[m.id] = m.interests || [];
        });
        setSelectedInterests(initialMap);

        setFormState("APPROVED");
      } else {
        localStorage.removeItem("jss_member_grant_token");
        setGrantToken(null);
        setFormState("INPUT");
        setErrorMsg(res.error || "Session expired. Please enter your registered number again.");
      }
    } catch {
      setErrorMsg("Failed to load family information. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async (token: string) => {
    try {
      const res = await checkMemberAccessStatusAction(token);
      if (res.status === "APPROVED" && res.grantToken) {
        setGrantToken(res.grantToken);
        localStorage.setItem("jss_member_grant_token", res.grantToken);
        localStorage.removeItem("jss_member_request_token");
        loadFamilyProfile(res.grantToken);
      } else if (res.status === "REJECTED") {
        setFormState("REJECTED");
        setRejectionReason(res.message || "Your request could not be validated by the volunteer.");
        localStorage.removeItem("jss_member_request_token");
      } else if (res.status === "EXPIRED" || res.status === "NOT_FOUND") {
        setFormState("INPUT");
        setErrorMsg(res.message || "Request expired. Please enter your mobile number again.");
        localStorage.removeItem("jss_member_request_token");
      } else if (res.status === "PENDING") {
        setFormState("PENDING");
        setStatusMessage(res.message || "Awaiting volunteer validation.");
      }
    } catch {
      // Keep state on network glitch
    }
  };

  // Step 1: Submit Mobile Number (NO name asked!)
  const handleSubmitMobile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanMobile = mobile.replace(/[^0-9]/g, "");
    if (cleanMobile.length < 10) {
      setErrorMsg("Please enter a valid 10-digit registered mobile number.");
      return;
    }

    setLoading(true);

    try {
      const res = await requestMemberAccessAction(cleanMobile);
      if (!res.success) {
        setErrorMsg(res.message);
      } else if (res.requestToken) {
        setRequestToken(res.requestToken);
        localStorage.setItem("jss_member_request_token", res.requestToken);
        setFormState("PENDING");
        setStatusMessage(res.message);
        checkStatus(res.requestToken);
      } else {
        setStatusMessage(res.message);
        setFormState("PENDING");
      }
    } catch {
      setErrorMsg("An unexpected network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Toggle interest checkbox for a specific member
  const handleToggleInterest = (memberId: string, interestKey: string) => {
    setSelectedInterests((prev) => {
      const currentList = prev[memberId] || [];
      const exists = currentList.includes(interestKey);
      const updated = exists
        ? currentList.filter((k) => k !== interestKey)
        : [...currentList, interestKey];
      return {
        ...prev,
        [memberId]: updated,
      };
    });
  };

  // Save interests for all members
  const handleSaveInterests = async () => {
    if (!grantToken || !familyData) return;

    setSavingInterests(true);
    setErrorMsg(null);

    try {
      const payload = familyData.members.map((m) => ({
        memberId: m.id,
        interests: selectedInterests[m.id] || [],
      }));

      const res = await saveFamilyMemberInterestsAction(grantToken, payload);
      if (res.success) {
        setSaveSuccessMsg(res.message);
        setFormState("SUCCESS");
      } else {
        setErrorMsg(res.error || res.message || "Failed to save member interests.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "An unexpected error occurred while saving.");
    } finally {
      setSavingInterests(false);
    }
  };

  const handleReset = () => {
    localStorage.removeItem("jss_member_request_token");
    localStorage.removeItem("jss_member_grant_token");
    setRequestToken(null);
    setGrantToken(null);
    setFamilyData(null);
    setMobile("");
    setErrorMsg(null);
    setFormState("INPUT");
  };

  return (
    <div className="container py-4 py-md-5" style={{ maxWidth: "780px" }}>
      {/* Brand Header */}
      <div className="text-center mb-4">
        <div className="d-inline-flex p-3 bg-white rounded-circle shadow-sm border mb-2">
          <Logo size={48} />
        </div>
        <h1 className="h3 fw-bold text-dark mb-0">Jin Sanskar Setu</h1>
        <h2 className="h6 text-primary mb-1">जिन संस्कार सेतु</h2>
        <p className="text-muted small">
          Official Community Census &amp; Member Interests Portal
        </p>
      </div>

      {/* =====================================================================
          STATE 1: INPUT REGISTERED MOBILE NUMBER (NO NAME ASKED)
          ===================================================================== */}
      {formState === "INPUT" && (
        <div className="card shadow-sm border-0 rounded-4 overflow-hidden">
          <div className="bg-primary text-white p-3 p-md-4 text-center">
            <i className="bi bi-person-check fs-1 d-block mb-1"></i>
            <h3 className="h5 fw-bold mb-1">Enter Registered Mobile Number</h3>
            <p className="small mb-0 opacity-75">
              पंजीकृत मोबाइल नंबर दर्ज करें (स्वयंसेवक द्वारा त्वरित सत्यापन)
            </p>
          </div>

          <div className="card-body p-4">
            <form onSubmit={handleSubmitMobile}>
              <div className="mb-4">
                <label htmlFor="reg-mobile" className="form-label fw-semibold text-dark">
                  10-Digit Registered Mobile Number <span className="text-danger">*</span>
                </label>
                <div className="input-group input-group-lg">
                  <span className="input-group-text bg-light text-muted fw-semibold">
                    🇮🇳 +91
                  </span>
                  <input
                    type="tel"
                    id="reg-mobile"
                    inputMode="numeric"
                    autoComplete="tel"
                    className="form-control"
                    placeholder="e.g. 9822012345"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-text mt-2">
                  <i className="bi bi-info-circle me-1 text-primary"></i>
                  Enter the phone number registered with your family survey. A notification will be sent to the volunteer desk to validate and allow you to proceed instantly without an OTP.
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-jain-primary btn-lg w-100 py-3 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status"></span>
                    <span>Checking Registration...</span>
                  </>
                ) : (
                  <>
                    <span>Proceed to Verification</span>
                    <i className="bi bi-arrow-right"></i>
                  </>
                )}
              </button>

              {/* Error Message Below the Next Button */}
              {errorMsg && (
                <div
                  className="alert alert-danger py-2 px-3 mt-3 d-flex align-items-center justify-content-between gap-2 shadow-xs border-danger"
                  role="alert"
                >
                  <div className="d-flex align-items-center gap-2">
                    <i className="bi bi-exclamation-triangle-fill text-danger fs-5 flex-shrink-0"></i>
                    <span className="small fw-semibold">{errorMsg}</span>
                  </div>
                  <button
                    type="button"
                    className="btn-close btn-sm flex-shrink-0"
                    onClick={() => setErrorMsg(null)}
                  ></button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          STATE 2: WAITING FOR VOLUNTEER VALIDATION (NO OTP)
          ===================================================================== */}
      {formState === "PENDING" && (
        <div className="card shadow-sm border-0 rounded-4 p-4 p-md-5 text-center bg-white">
          <div className="mb-4">
            <div
              className="rounded-circle bg-warning-subtle text-warning-emphasis d-inline-flex align-items-center justify-content-center mb-3"
              style={{ width: "80px", height: "80px" }}
            >
              <i className="bi bi-hourglass-split fs-1 animate-spin-slow"></i>
            </div>
            <h3 className="h4 fw-bold text-dark mb-1">
              Waiting for Volunteer Validation
            </h3>
            <p className="text-primary fw-semibold mb-0">
              स्वयंसेवक द्वारा सत्यापन की प्रतीक्षा
            </p>
          </div>

          <div className="bg-light border rounded-3 p-3 max-w-md mx-auto mb-4 text-start">
            <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-2">
              <span className="text-muted small">Registered Mobile:</span>
              <strong className="font-monospace text-dark">{mobile}</strong>
            </div>
            <div className="d-flex justify-content-between align-items-center">
              <span className="text-muted small">Verification Status:</span>
              <span className="badge bg-warning text-dark font-monospace">
                <i className="bi bi-clock-history me-1"></i> Awaiting Approval
              </span>
            </div>
          </div>

          <p className="text-muted small mb-4 mx-auto" style={{ maxWidth: "500px" }}>
            A notification has been sent to the Sangh Volunteer Dashboard. As soon as the volunteer validates and approves your request, this page will <strong>automatically proceed</strong> to show your family members and interests form. <em>No OTP is required!</em>
          </p>

          <div className="d-flex justify-content-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="btn btn-outline-secondary btn-sm px-3"
            >
              <i className="bi bi-arrow-left me-1"></i> Cancel / Change Number
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          STATE 3: REJECTED STATE
          ===================================================================== */}
      {formState === "REJECTED" && (
        <div className="card shadow-sm border-0 rounded-4 p-4 p-md-5 text-center bg-white">
          <div className="rounded-circle bg-danger-subtle text-danger d-inline-flex align-items-center justify-content-center mb-3" style={{ width: "70px", height: "70px" }}>
            <i className="bi bi-x-circle fs-1"></i>
          </div>
          <h3 className="h5 fw-bold text-dark mb-1">Verification Unsuccessful</h3>
          <p className="text-danger small mb-3">
            {rejectionReason || "The request could not be validated by the volunteer."}
          </p>
          <p className="text-muted small mb-4">
            Please make sure you entered the correct registered number or speak directly with your Sangh volunteer desk.
          </p>
          <button
            type="button"
            onClick={handleReset}
            className="btn btn-jain-primary px-4 py-2"
          >
            Try Again With Another Number
          </button>
        </div>
      )}

      {/* =====================================================================
          STATE 4: APPROVED - FETCH DATA (NAME & AGE) AND SHOW INTEREST CHECKBOXES
          ===================================================================== */}
      {formState === "APPROVED" && familyData && (
        <div>
          {/* Family Header Banner */}
          <div className="card shadow-sm border-0 rounded-4 p-3 p-md-4 mb-4 bg-white border-start border-4 border-success">
            <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2">
              <div>
                <span className="badge bg-success-subtle text-success border border-success-subtle mb-1">
                  <i className="bi bi-shield-check me-1"></i> Verified Family Record
                </span>
                <h3 className="h5 fw-bold text-dark mb-0">
                  {familyData.headName}&apos;s Family
                </h3>
                <div className="text-muted small font-monospace">
                  Family ID: <strong>{familyData.familyId}</strong> • Sangh: {familyData.sangh.name} ({familyData.sangh.prefix})
                </div>
              </div>
              <div className="text-sm-end text-muted small">
                <div>Area: <strong>{familyData.area}</strong></div>
                <div>Members: <strong>{familyData.members.length} Total</strong></div>
              </div>
            </div>
          </div>

          <div className="mb-3">
            <h4 className="h5 fw-bold text-dark mb-1">
              Select Interest for Each Family Member (आपकी रुचि)
            </h4>
            <p className="text-muted small mb-0">
              For each member below, choose the community activities and services they are interested in participating in:
            </p>
          </div>

          {/* Members Displayed One Below Another */}
          <div className="d-flex flex-column gap-3 mb-4">
            {familyData.members.map((member, idx) => {
              const currentMemberInterests = selectedInterests[member.id] || [];

              return (
                <div
                  key={member.id}
                  className="card shadow-sm border rounded-4 overflow-hidden bg-white"
                >
                  {/* Member Top Bar: Name & Age */}
                  <div className="card-header bg-light border-bottom py-3 px-3 px-md-4 d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-2">
                      <span className="badge bg-primary text-white rounded-circle p-2 font-monospace">
                        #{idx + 1}
                      </span>
                      <div>
                        <span className="fw-bold fs-6 text-dark">{member.name}</span>
                        <div className="text-muted small">
                          Age: <strong>{member.calculatedAge} yrs</strong> • Relationship:{" "}
                          <span className="badge bg-secondary-subtle text-secondary border">
                            {member.relationship}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <span className="badge bg-light text-muted border font-monospace small">
                        {member.memberId}
                      </span>
                    </div>
                  </div>

                  {/* Member Body: Question & Checkboxes */}
                  <div className="card-body p-3 p-md-4">
                    <div className="fw-semibold text-dark mb-2 d-flex align-items-center gap-2">
                      <i className="bi bi-star-fill text-warning"></i>
                      <span>Your Interest (आपकी रुचि):</span>
                    </div>

                    <div className="row g-2">
                      {MEMBER_INTERESTS.map((interest) => {
                        const isChecked = currentMemberInterests.includes(interest.key);
                        const inputId = `interest_${member.id}_${interest.key}`;

                        return (
                          <div key={interest.key} className="col-12 col-md-6">
                            <label
                              htmlFor={inputId}
                              className={`p-2 px-3 border rounded-3 d-flex align-items-center gap-2 cursor-pointer w-100 transition-all ${
                                isChecked
                                  ? "border-primary bg-primary-subtle text-primary fw-semibold"
                                  : "border-light-subtle bg-white text-dark hover-bg-light"
                              }`}
                              style={{ cursor: "pointer" }}
                            >
                              <input
                                type="checkbox"
                                id={inputId}
                                className="form-check-input mt-0 flex-shrink-0"
                                checked={isChecked}
                                onChange={() => handleToggleInterest(member.id, interest.key)}
                              />
                              <span className="small">
                                {interest.label}{" "}
                                <span className="text-muted">({interest.hindiLabel})</span>
                              </span>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Submit Button */}
          <div className="card shadow-sm border-0 rounded-4 p-3 bg-white mb-4">
            <button
              type="button"
              disabled={savingInterests}
              onClick={handleSaveInterests}
              className="btn btn-success btn-lg w-100 py-3 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2"
            >
              {savingInterests ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status"></span>
                  <span>Saving Interests...</span>
                </>
              ) : (
                <>
                  <i className="bi bi-check2-circle fs-5"></i>
                  <span>Submit &amp; Save Interests (रुचि सहेजें)</span>
                </>
              )}
            </button>

            {/* Error Message Below Submit Button */}
            {errorMsg && (
              <div
                className="alert alert-danger py-2 px-3 mt-3 d-flex align-items-center justify-content-between gap-2 shadow-xs border-danger"
                role="alert"
              >
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-exclamation-triangle-fill text-danger fs-5 flex-shrink-0"></i>
                  <span className="small fw-semibold">{errorMsg}</span>
                </div>
                <button
                  type="button"
                  className="btn-close btn-sm flex-shrink-0"
                  onClick={() => setErrorMsg(null)}
                ></button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          STATE 5: SUBMISSION CONFIRMATION
          ===================================================================== */}
      {formState === "SUCCESS" && familyData && (
        <div className="card shadow-sm border-0 rounded-4 p-4 p-md-5 text-center bg-white">
          <div className="rounded-circle bg-success-subtle text-success d-inline-flex align-items-center justify-content-center mb-3" style={{ width: "80px", height: "80px" }}>
            <i className="bi bi-check2-all fs-1"></i>
          </div>
          <h3 className="h4 fw-bold text-dark mb-1">
            धन्यवाद! (Thank You!)
          </h3>
          <p className="text-success fw-semibold mb-3">
            {saveSuccessMsg || "आपकी और आपके परिवार की रुचियाँ सफलतापूर्वक दर्ज कर ली गई हैं।"}
          </p>
          <p className="text-muted small mb-4">
            The interest preferences for <strong>{familyData.headName}&apos;s family</strong> ({familyData.sangh.name}) have been recorded in Jin Sanskar Setu single source of truth.
          </p>

          <div className="card p-3 bg-light border rounded-3 text-start mb-4">
            <h6 className="fw-bold text-dark border-bottom pb-2 mb-2">
              Recorded Family Interests Summary:
            </h6>
            <div className="d-flex flex-column gap-2">
              {familyData.members.map((m) => {
                const ints = selectedInterests[m.id] || [];
                return (
                  <div key={m.id} className="pb-2 border-bottom">
                    <div className="d-flex justify-content-between align-items-center">
                      <strong className="text-dark">{m.name}</strong>
                      <span className="text-muted small">{m.calculatedAge} yrs • {m.relationship}</span>
                    </div>
                    <div className="d-flex flex-wrap gap-1 mt-1">
                      {ints.length === 0 ? (
                        <span className="badge bg-light text-muted border">None selected</span>
                      ) : (
                        ints.map((k) => {
                          const opt = MEMBER_INTERESTS.find((i) => i.key === k);
                          return (
                            <span key={k} className="badge bg-primary-subtle text-primary border border-primary-subtle">
                              {opt?.label || k}
                            </span>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="d-flex justify-content-center gap-3">
            <button
              type="button"
              onClick={() => setFormState("APPROVED")}
              className="btn btn-outline-secondary px-4 py-2"
            >
              <i className="bi bi-pencil me-1"></i> Edit Again
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="btn btn-jain-primary px-4 py-2"
            >
              Done / Exit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
