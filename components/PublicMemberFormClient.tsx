"use client";

import React, { useState, useEffect } from "react";
import Logo from "@/components/Logo";
import {
  requestMemberAccessAction,
  checkMemberAccessStatusAction,
  getApprovedFamilyDataAction,
  saveFamilyMemberInterestsAction,
} from "@/lib/actions/member-access-actions";
import {
  MEMBER_INTERESTS,
  INTEREST_CATEGORIES,
  InterestCategory,
  InterestOption,
} from "@/lib/constants/interests";

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

// Multi-language dictionary (English & Hindi)
const translations = {
  en: {
    portalTitle: "Jin Sanskar Setu",
    portalSubtitle: "Official Community Census & Member Interests Portal",
    verifyTitle: "Family Verification Portal",
    verifyDesc: "Enter your registered mobile number to access your family survey",
    registeredMobile: "Registered Mobile Number",
    mobileHindiTag: "(पंजीकृत मोबाइल नंबर)",
    mobileHelp: "The primary number provided during family census registration.",
    mobilePlaceholder: "Enter 10-digit mobile number",
    secureNote: "Strictly secure. Requests require volunteer approval.",
    proceedBtn: "Proceed to Verify Family",
    checkingRecord: "Checking Record...",
    waitingTitle: "Waiting for Volunteer Validation",
    waitingSubtitle: "स्वयंसेवक द्वारा सत्यापन की प्रतीक्षा",
    registeredMobileLabel: "Registered Mobile:",
    verificationStatus: "Verification Status:",
    awaitingApproval: "Awaiting Approval",
    waitingNote: "A notification has been sent to the Sangh Volunteer Dashboard. As soon as the volunteer validates and approves your request, this page will automatically proceed to show your family members and interests form. No OTP is required!",
    cancelBtn: "Cancel / Change Number",
    unsuccessfulTitle: "Verification Unsuccessful",
    tryAgainBtn: "Try Again With Another Number",
    verifiedFamily: "Verified Family Record",
    familyId: "Family ID",
    sangh: "Sangh",
    area: "Area",
    membersTotal: "Total Members",
    stepTitle: "Step-by-Step Selection",
    selectMember: "Select Member",
    memberOf: "of",
    clear: "Clear",
    selected: "Selected",
    memberInstructions: "Choose community activities & services this member is interested in. Tap any option to select or unselect:",
    prevMember: "Previous Member",
    nextMember: "Next Member",
    allReviewed: "All Members Reviewed",
    readyTitle: "Ready to Submit All Family Preferences?",
    totalActivities: "Total activities selected across all family members",
    submitBtn: "Submit & Save All Family Interests",
    savingBtn: "Saving Family Interests...",
    thankYouTitle: "Thank You! (धन्यवाद!)",
    thankYouDefault: "आपकी और आपके परिवार की रुचियाँ सफलतापूर्वक दर्ज कर ली गई हैं।",
    thankYouDesc: "The interest preferences for your family have been recorded in Jin Sanskar Setu single source of truth.",
    recordedSummary: "Recorded Family Interests Summary:",
    noneSelected: "None selected",
    editAgainBtn: "Edit Again",
    doneExitBtn: "Done / Exit",
    firstMember: "First member (Head)",
    ageYears: "yrs",
  },
  hi: {
    portalTitle: "जिन संस्कार सेतु",
    portalSubtitle: "अधिकृत समाज जनगणना एवं परिवार सेवा रुचि पोर्टल",
    verifyTitle: "परिवार सत्यापन पोर्टल",
    verifyDesc: "अपने परिवार का सर्वेक्षण देखने के लिए पंजीकृत मोबाइल नंबर दर्ज करें",
    registeredMobile: "पंजीकृत मोबाइल नंबर",
    mobileHindiTag: "",
    mobileHelp: "परिवार जनगणना पंजीकरण के समय दिया गया मुख्य मोबाइल नंबर।",
    mobilePlaceholder: "10 अंकों का मोबाइल नंबर दर्ज करें",
    secureNote: "पूर्णतः सुरक्षित। अनुरोध स्वयंसेवक अनुमोदन के बाद खुलता है।",
    proceedBtn: "परिवार सत्यापन के लिए आगे बढ़ें",
    checkingRecord: "रिकॉर्ड जांचा जा रहा है...",
    waitingTitle: "स्वयंसेवक द्वारा सत्यापन की प्रतीक्षा",
    waitingSubtitle: "सत्यापन प्रक्रियाधीन है",
    registeredMobileLabel: "पंजीकृत मोबाइल:",
    verificationStatus: "सत्यापन स्थिति:",
    awaitingApproval: "अनुमोदन की प्रतीक्षा",
    waitingNote: "संघ स्वयंसेवक डैशबोर्ड पर सूचना भेज दी गई है। जैसे ही स्वयंसेवक आपके अनुरोध को सत्यापित करेंगे, यह पेज स्वतः आपके परिवार के सदस्यों की सूची और रुचि फॉर्म पर आगे बढ़ जाएगा। किसी OTP की आवश्यकता नहीं है!",
    cancelBtn: "रद्द करें / नंबर बदलें",
    unsuccessfulTitle: "सत्यापन असफल रहा",
    tryAgainBtn: "अन्य नंबर से पुनः प्रयास करें",
    verifiedFamily: "सत्यापित परिवार रिकॉर्ड",
    familyId: "परिवार क्रमांक (ID)",
    sangh: "संघ",
    area: "क्षेत्र",
    membersTotal: "कुल सदस्य",
    stepTitle: "क्रमशः सदस्य चयन",
    selectMember: "सदस्य चुनें",
    memberOf: "का",
    clear: "हटाएं",
    selected: "चयनित",
    memberInstructions: "इस सदस्य के लिए सेवा व गतिविधियों का चयन करें। चुनने या हटाने के लिए विकल्प पर टैप करें:",
    prevMember: "पिछला सदस्य",
    nextMember: "अगला सदस्य",
    allReviewed: "सभी सदस्यों की समीक्षा पूर्ण",
    readyTitle: "क्या आप सभी सदस्यों की रुचियां सहेजने के लिए तैयार हैं?",
    totalActivities: "परिवार के सभी सदस्यों द्वारा चयनित कुल गतिविधियां",
    submitBtn: "सभी सदस्यों की सेवा रुचि सहेजें",
    savingBtn: "रुचियां सहेजी जा रही हैं...",
    thankYouTitle: "जय जिनेन्द्र! धन्यवाद!",
    thankYouDefault: "आपकी और आपके परिवार की रुचियाँ सफलतापूर्वक दर्ज कर ली गई हैं।",
    thankYouDesc: "आपके परिवार की सेवा रुचियां जिन संस्कार सेतु डेटाबेस में सुरक्षित दर्ज हो गई हैं।",
    recordedSummary: "दर्ज की गई परिवार सेवा रुचियों का विवरण:",
    noneSelected: "कोई चयन नहीं",
    editAgainBtn: "पुनः संपादन करें",
    doneExitBtn: "पूर्ण / बाहर निकलें",
    firstMember: "प्रथम सदस्य (मुखिया)",
    ageYears: "वर्ष",
  },
};

export default function PublicMemberFormClient() {
  const [lang, setLang] = useState<"en" | "hi">("en");
  const t = translations[lang];

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

  // Active Member Tab for Anti-Hectic Progressive Stepper
  const [activeMemberIndex, setActiveMemberIndex] = useState(0);

  // Collapsible category state per category ID
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // Restore session if grant or request token exists in localStorage
  useEffect(() => {
    const savedGrant = localStorage.getItem("jss_member_grant_token");
    const savedRequest = localStorage.getItem("jss_member_request_token");
    const savedLang = localStorage.getItem("jss_portal_lang") as "en" | "hi";
    if (savedLang === "en" || savedLang === "hi") {
      setLang(savedLang);
    }

    if (savedGrant) {
      setGrantToken(savedGrant);
      loadFamilyProfile(savedGrant);
    } else if (savedRequest) {
      setRequestToken(savedRequest);
      checkStatus(savedRequest);
    }
  }, []);

  const handleLangChange = (newLang: "en" | "hi") => {
    setLang(newLang);
    localStorage.setItem("jss_portal_lang", newLang);
  };

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
        setActiveMemberIndex(0);
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

  // Step 1: Submit Mobile Number
  const handleSubmitMobile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanMobile = mobile.replace(/[^0-9]/g, "");
    if (cleanMobile.length < 10) {
      setErrorMsg(lang === "hi" ? "कृपया 10 अंकों का मान्य मोबाइल नंबर दर्ज करें।" : "Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);

    try {
      const res = await requestMemberAccessAction(cleanMobile);

      if (res.success && res.requestToken) {
        setRequestToken(res.requestToken);
        localStorage.setItem("jss_member_request_token", res.requestToken);
        setFormState("PENDING");
        setStatusMessage(res.message);
      } else {
        setErrorMsg((res as any).error || res.message || "Could not process request. Please check the number.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Toggle interest option for a specific member
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

  // Clear all selections for current member
  const handleClearMemberInterests = (memberId: string) => {
    setSelectedInterests((prev) => ({
      ...prev,
      [memberId]: [],
    }));
  };

  // Toggle category collapse
  const toggleCategoryCollapse = (catId: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
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
    setActiveMemberIndex(0);
    setFormState("INPUT");
  };

  // Compute total selected interests across entire family
  const totalFamilyInterestsCount = Object.values(selectedInterests).reduce(
    (acc, arr) => acc + arr.length,
    0
  );

  return (
    <div className="container py-4 py-md-5" style={{ maxWidth: "840px" }}>
      {/* Top Bar: Brand Header + Language Switcher */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex align-items-center gap-2">
          <Logo size={40} />
          <div>
            <h1 className="h5 fw-bold text-dark mb-0 lh-1">
              {lang === "hi" ? "जिन संस्कार सेतु" : "Jin Sanskar Setu"}
            </h1>
            <small className="text-muted" style={{ fontSize: "0.75rem" }}>
              {lang === "hi" ? "Jin Sanskar Setu" : "जिन संस्कार सेतु"}
            </small>
          </div>
        </div>

        {/* Language Switcher Pill Toggle */}
        <div className="btn-group btn-group-sm shadow-xs rounded-pill overflow-hidden border bg-white p-1">
          <button
            type="button"
            onClick={() => handleLangChange("en")}
            className={`btn btn-sm px-3 rounded-pill transition-all ${
              lang === "en" ? "btn-primary fw-bold text-white shadow-xs" : "btn-light text-muted border-0"
            }`}
            style={{ fontSize: "0.8rem" }}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => handleLangChange("hi")}
            className={`btn btn-sm px-3 rounded-pill transition-all ${
              lang === "hi" ? "btn-primary fw-bold text-white shadow-xs" : "btn-light text-muted border-0"
            }`}
            style={{ fontSize: "0.8rem" }}
          >
            हिन्दी
          </button>
        </div>
      </div>

      <p className="text-muted small text-center mb-4">
        {t.portalSubtitle}
      </p>

      {/* =====================================================================
          STATE 1: INPUT REGISTERED MOBILE NUMBER
          ===================================================================== */}
      {formState === "INPUT" && (
        <div className="card shadow-sm border-0 rounded-4 overflow-hidden">
          <div className="card-header bg-primary text-white py-3 px-4 text-center">
            <h3 className="h5 fw-bold mb-1">{t.verifyTitle}</h3>
            <p className="small mb-0 text-white-50">
              {t.verifyDesc}
            </p>
          </div>

          <div className="card-body p-4 p-md-5">
            <form onSubmit={handleSubmitMobile} className="max-w-md mx-auto">
              <div className="mb-4 text-center">
                <div
                  className="rounded-circle bg-primary-subtle text-primary d-inline-flex align-items-center justify-content-center mb-3"
                  style={{ width: "64px", height: "64px" }}
                >
                  <i className="bi bi-phone fs-2"></i>
                </div>
                <h4 className="h6 fw-bold text-dark mb-1">
                  {t.registeredMobile} {t.mobileHindiTag}
                </h4>
                <p className="text-muted small">
                  {t.mobileHelp}
                </p>
              </div>

              <div className="mb-4">
                <div className="input-group input-group-lg">
                  <span className="input-group-text bg-light text-muted border-end-0">
                    <i className="bi bi-telephone-fill text-primary"></i>
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    className="form-control border-start-0 ps-0"
                    placeholder={t.mobilePlaceholder}
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    maxLength={15}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-text small text-center mt-2">
                  <i className="bi bi-shield-lock me-1 text-success"></i>
                  {t.secureNote}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || mobile.replace(/[^0-9]/g, "").length < 10}
                className="btn btn-primary btn-lg w-100 py-3 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status"></span>
                    <span>{t.checkingRecord}</span>
                  </>
                ) : (
                  <>
                    <span>{t.proceedBtn}</span>
                    <i className="bi bi-arrow-right fs-5"></i>
                  </>
                )}
              </button>

              {errorMsg && (
                <div
                  className="alert alert-danger py-2 px-3 mt-3 d-flex align-items-center justify-content-between gap-2 shadow-xs"
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
          STATE 2: WAITING FOR VOLUNTEER VALIDATION
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
              {t.waitingTitle}
            </h3>
            <p className="text-primary fw-semibold mb-0">
              {t.waitingSubtitle}
            </p>
          </div>

          <div className="bg-light border rounded-3 p-3 max-w-md mx-auto mb-4 text-start">
            <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-2">
              <span className="text-muted small">{t.registeredMobileLabel}</span>
              <strong className="font-monospace text-dark">{mobile}</strong>
            </div>
            <div className="d-flex justify-content-between align-items-center">
              <span className="text-muted small">{t.verificationStatus}</span>
              <span className="badge bg-warning text-dark font-monospace">
                <i className="bi bi-clock-history me-1"></i> {t.awaitingApproval}
              </span>
            </div>
          </div>

          <p className="text-muted small mb-4 mx-auto" style={{ maxWidth: "500px" }}>
            {t.waitingNote}
          </p>

          <div className="d-flex justify-content-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="btn btn-outline-secondary btn-sm px-3"
            >
              <i className="bi bi-arrow-left me-1"></i> {t.cancelBtn}
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          STATE 3: REJECTED STATE
          ===================================================================== */}
      {formState === "REJECTED" && (
        <div className="card shadow-sm border-0 rounded-4 p-4 p-md-5 text-center bg-white">
          <div
            className="rounded-circle bg-danger-subtle text-danger d-inline-flex align-items-center justify-content-center mb-3"
            style={{ width: "70px", height: "70px" }}
          >
            <i className="bi bi-x-circle fs-1"></i>
          </div>
          <h3 className="h5 fw-bold text-dark mb-1">{t.unsuccessfulTitle}</h3>
          <p className="text-danger small mb-3">
            {rejectionReason || "The request could not be validated by the volunteer."}
          </p>
          <p className="text-muted small mb-4">
            Please make sure you entered the correct registered number or speak directly with your Sangh volunteer desk.
          </p>
          <button
            type="button"
            onClick={handleReset}
            className="btn btn-primary px-4 py-2"
          >
            {t.tryAgainBtn}
          </button>
        </div>
      )}

      {/* =====================================================================
          STATE 4: APPROVED - PROGRESSIVE MEMBER STEPPER & CATEGORIZED ACCORDION
          ===================================================================== */}
      {formState === "APPROVED" && familyData && (
        <div>
          {/* Family Header Banner */}
          <div className="card shadow-sm border-0 rounded-4 p-3 p-md-4 mb-4 bg-white border-start border-4 border-success">
            <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2">
              <div>
                <span className="badge bg-success-subtle text-success border border-success-subtle mb-1">
                  <i className="bi bi-shield-check me-1"></i> {t.verifiedFamily}
                </span>
                <h3 className="h5 fw-bold text-dark mb-0">
                  {familyData.headName}&apos;s Family
                </h3>
                <div className="text-muted small font-monospace">
                  {t.familyId}: <strong>{familyData.familyId}</strong> • {t.sangh}: {familyData.sangh.name} ({familyData.sangh.prefix})
                </div>
              </div>
              <div className="text-sm-end text-muted small">
                <div>{t.area}: <strong>{familyData.area}</strong></div>
                <div>{t.membersTotal}: <strong>{familyData.members.length} Total</strong></div>
              </div>
            </div>
          </div>

          {/* Stepper Header: Member Avatars / Tabs */}
          <div className="card shadow-sm border-0 rounded-4 p-3 bg-white mb-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div>
                <span className="badge bg-primary-subtle text-primary fw-bold text-uppercase px-2 py-1 small">
                  {t.stepTitle}
                </span>
                <h4 className="h6 fw-bold text-dark mb-0 mt-1">
                  {t.selectMember}
                </h4>
              </div>
              <div className="text-muted small">
                Member <strong>{activeMemberIndex + 1}</strong> {t.memberOf} <strong>{familyData.members.length}</strong>
              </div>
            </div>

            {/* Scrollable Horizontal Member Tabs */}
            <div className="d-flex gap-2 overflow-x-auto pb-2 pt-1" style={{ scrollbarWidth: "thin" }}>
              {familyData.members.map((member, idx) => {
                const isActive = idx === activeMemberIndex;
                const count = (selectedInterests[member.id] || []).length;

                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setActiveMemberIndex(idx)}
                    className={`btn text-start p-2 px-3 rounded-3 flex-shrink-0 transition-all ${
                      isActive
                        ? "btn-primary shadow-sm"
                        : "btn-light border text-dark hover-bg-light"
                    }`}
                    style={{ minWidth: "155px" }}
                  >
                    <div className="d-flex align-items-center justify-content-between gap-2">
                      <div className="d-flex align-items-center gap-2">
                        <span
                          className={`rounded-circle d-inline-flex align-items-center justify-content-center small fw-bold ${
                            isActive ? "bg-white text-primary" : "bg-secondary-subtle text-secondary"
                          }`}
                          style={{ width: "22px", height: "22px", fontSize: "0.75rem" }}
                        >
                          #{idx + 1}
                        </span>
                        <div className="fw-semibold text-truncate" style={{ maxWidth: "85px" }}>
                          {member.name.split(" ")[0]}
                        </div>
                      </div>
                      {count > 0 ? (
                        <span className={`badge ${isActive ? "bg-white text-primary" : "bg-success text-white"} font-monospace`}>
                          ✓ {count}
                        </span>
                      ) : (
                        <span className={`badge ${isActive ? "bg-white-50 text-white" : "bg-light text-muted border"}`}>
                          0
                        </span>
                      )}
                    </div>
                    <div className={`small ${isActive ? "text-white-50" : "text-muted"} mt-1`} style={{ fontSize: "0.75rem" }}>
                      {member.relationship} • {member.calculatedAge} {t.ageYears}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ACTIVE MEMBER CARD */}
          {(() => {
            const currentMember = familyData.members[activeMemberIndex];
            if (!currentMember) return null;
            const currentMemberInterests = selectedInterests[currentMember.id] || [];

            return (
              <div className="card shadow-sm border rounded-4 overflow-hidden bg-white mb-4">
                {/* Active Member Top Bar */}
                <div className="card-header bg-light border-bottom py-3 px-3 px-md-4 d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2">
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-primary text-white rounded-circle p-2 font-monospace">
                      #{activeMemberIndex + 1}
                    </span>
                    <div>
                      <h4 className="fw-bold fs-5 text-dark mb-0">{currentMember.name}</h4>
                      <div className="text-muted small">
                        {lang === "hi" ? "आयु" : "Age"}: <strong>{currentMember.calculatedAge} {t.ageYears}</strong> • {currentMember.relationship}
                        <span className="ms-2 font-monospace text-muted small">
                          ({currentMember.memberId})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    {currentMemberInterests.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleClearMemberInterests(currentMember.id)}
                        className="btn btn-outline-danger btn-sm py-1 px-2"
                        title={t.clear}
                      >
                        <i className="bi bi-x-circle me-1"></i> {t.clear}
                      </button>
                    )}
                    <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                      {currentMemberInterests.length} {t.selected}
                    </span>
                  </div>
                </div>

                {/* Member Body: Categorized Accordion */}
                <div className="card-body p-3 p-md-4">
                  <p className="text-muted small mb-3">
                    {t.memberInstructions}
                  </p>

                  <div className="d-flex flex-column gap-3">
                    {INTEREST_CATEGORIES.map((cat) => {
                      const isCollapsed = Boolean(collapsedCategories[cat.id]);
                      const selectedCount = cat.options.filter((opt) =>
                        currentMemberInterests.includes(opt.key)
                      ).length;

                      const displayTitle = lang === "hi" ? cat.hindiTitle : cat.title;
                      const displaySubtitle = lang === "hi" ? cat.title : cat.hindiTitle;

                      return (
                        <div
                          key={cat.id}
                          className="border rounded-3 overflow-hidden bg-white shadow-xs"
                        >
                          {/* Category Header */}
                          <button
                            type="button"
                            onClick={() => toggleCategoryCollapse(cat.id)}
                            className="w-100 p-3 bg-light border-0 d-flex justify-content-between align-items-center text-start transition-all"
                            style={{ cursor: "pointer" }}
                          >
                            <div className="d-flex align-items-center gap-2">
                              <div
                                className={`rounded-circle d-inline-flex align-items-center justify-content-center p-2 border ${cat.accentClass}`}
                                style={{ width: "34px", height: "34px" }}
                              >
                                <i className={`bi ${cat.icon} fs-6`}></i>
                              </div>
                              <div>
                                <strong className="text-dark d-block" style={{ fontSize: "0.95rem" }}>
                                  {displayTitle}
                                </strong>
                                <span className="text-primary small" style={{ fontSize: "0.8rem" }}>
                                  {displaySubtitle}
                                </span>
                              </div>
                            </div>

                            <div className="d-flex align-items-center gap-2">
                              {selectedCount > 0 && (
                                <span className="badge bg-primary text-white font-monospace">
                                  {selectedCount} {t.selected}
                                </span>
                              )}
                              <i
                                className={`bi bi-chevron-down text-muted transition-all ${
                                  isCollapsed ? "" : "rotate-180"
                                }`}
                              ></i>
                            </div>
                          </button>

                          {/* Category Options Pills */}
                          {!isCollapsed && (
                            <div className="p-3 bg-white border-top">
                              <div className="row g-2">
                                {cat.options.map((option) => {
                                  // Under 18 children must not see Swadhyay options
                                  if (
                                    currentMember.calculatedAge < 18 &&
                                    (option.key === "GROUP_SWADHYAY" || option.key.includes("SWADHYAY"))
                                  ) {
                                    return null;
                                  }

                                  const isChecked = currentMemberInterests.includes(option.key);
                                  const isAgeRestricted =
                                    option.minAge &&
                                    currentMember.calculatedAge < option.minAge;

                                  const mainOptionLabel = lang === "hi" ? option.hindiLabel : option.label;
                                  const subOptionLabel = lang === "hi" ? option.label : option.hindiLabel;

                                  return (
                                    <div key={option.key} className="col-12 col-md-6">
                                      <button
                                        type="button"
                                        disabled={Boolean(isAgeRestricted)}
                                        onClick={() =>
                                          handleToggleInterest(currentMember.id, option.key)
                                        }
                                        className={`p-2 px-3 border rounded-3 d-flex align-items-center justify-content-between text-start w-100 transition-all ${
                                          isChecked
                                            ? "border-primary bg-primary text-white shadow-xs"
                                            : isAgeRestricted
                                            ? "border-light-subtle bg-light text-muted opacity-50"
                                            : "border-light-subtle bg-white text-dark hover-bg-light"
                                        }`}
                                        style={{ cursor: isAgeRestricted ? "not-allowed" : "pointer" }}
                                      >
                                        <div className="d-flex align-items-center gap-2">
                                          <i
                                            className={`bi ${
                                              isChecked
                                                ? "bi-check-circle-fill text-white fs-5"
                                                : "bi-circle text-muted fs-5"
                                            }`}
                                          ></i>
                                          <div>
                                            <div className="fw-semibold small">
                                              {mainOptionLabel}
                                            </div>
                                            <div
                                              className={isChecked ? "text-white-50 small" : "text-muted small"}
                                              style={{ fontSize: "0.75rem" }}
                                            >
                                              {subOptionLabel}
                                            </div>
                                          </div>
                                        </div>

                                        {isAgeRestricted && (
                                          <span className="badge bg-secondary-subtle text-secondary small" style={{ fontSize: "0.7rem" }}>
                                            {option.minAge}+ {t.ageYears}
                                          </span>
                                        )}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Member Stepper Action Footer */}
                <div className="card-footer bg-light border-top p-3 d-flex flex-column flex-sm-row justify-content-between align-items-center gap-2">
                  <div>
                    {activeMemberIndex > 0 ? (
                      <button
                        type="button"
                        onClick={() => setActiveMemberIndex((prev) => prev - 1)}
                        className="btn btn-outline-secondary btn-sm px-3"
                      >
                        <i className="bi bi-arrow-left me-1"></i> {t.prevMember}
                      </button>
                    ) : (
                      <span className="text-muted small">{t.firstMember}</span>
                    )}
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    {activeMemberIndex < familyData.members.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => setActiveMemberIndex((prev) => prev + 1)}
                        className="btn btn-primary px-3 py-2 fw-semibold d-flex align-items-center gap-2 shadow-xs"
                      >
                        <span>{t.nextMember}: {familyData.members[activeMemberIndex + 1]?.name.split(" ")[0]}</span>
                        <i className="bi bi-arrow-right"></i>
                      </button>
                    ) : (
                      <span className="badge bg-success-subtle text-success p-2 px-3 border border-success-subtle">
                        <i className="bi bi-check-all me-1"></i> {t.allReviewed}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* FINAL SUBMIT / SAVE FAMILY INTERESTS BAR */}
          <div className="card shadow-sm border-0 rounded-4 p-3 p-md-4 bg-white mb-4">
            <div className="d-flex flex-column flex-sm-row justify-content-between align-items-center gap-3 mb-3">
              <div>
                <h5 className="fw-bold text-dark mb-1">
                  {t.readyTitle}
                </h5>
                <p className="text-muted small mb-0">
                  {t.totalActivities}: <strong>{totalFamilyInterestsCount}</strong> ({familyData.members.length} {lang === "hi" ? "सदस्य" : "members"}).
                </p>
              </div>
              <div className="text-success fw-bold font-monospace fs-5">
                {totalFamilyInterestsCount} {t.selected}
              </div>
            </div>

            <button
              type="button"
              disabled={savingInterests}
              onClick={handleSaveInterests}
              className="btn btn-success btn-lg w-100 py-3 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2"
            >
              {savingInterests ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status"></span>
                  <span>{t.savingBtn}</span>
                </>
              ) : (
                <>
                  <i className="bi bi-check2-circle fs-5"></i>
                  <span>{t.submitBtn}</span>
                </>
              )}
            </button>

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
          <div
            className="rounded-circle bg-success-subtle text-success d-inline-flex align-items-center justify-content-center mb-3"
            style={{ width: "80px", height: "80px" }}
          >
            <i className="bi bi-check2-all fs-1"></i>
          </div>
          <h3 className="h4 fw-bold text-dark mb-1">
            {t.thankYouTitle}
          </h3>
          <p className="text-success fw-semibold mb-3">
            {saveSuccessMsg || t.thankYouDefault}
          </p>
          <p className="text-muted small mb-4">
            {t.thankYouDesc}
          </p>

          <div className="card p-3 bg-light border rounded-3 text-start mb-4">
            <h6 className="fw-bold text-dark border-bottom pb-2 mb-2">
              {t.recordedSummary}
            </h6>
            <div className="d-flex flex-column gap-2">
              {familyData.members.map((m) => {
                const ints = selectedInterests[m.id] || [];
                return (
                  <div key={m.id} className="pb-2 border-bottom">
                    <div className="d-flex justify-content-between align-items-center">
                      <strong className="text-dark">{m.name}</strong>
                      <span className="text-muted small">{m.calculatedAge} {t.ageYears} • {m.relationship}</span>
                    </div>
                    <div className="d-flex flex-wrap gap-1 mt-1">
                      {ints.length === 0 ? (
                        <span className="badge bg-light text-muted border">{t.noneSelected}</span>
                      ) : (
                        ints.map((k) => {
                          const opt = MEMBER_INTERESTS.find((i) => i.key === k);
                          const label = lang === "hi"
                            ? (opt?.hindiLabel || opt?.label || k)
                            : (opt?.label || k);
                          return (
                            <span key={k} className="badge bg-primary-subtle text-primary border border-primary-subtle">
                              {label}
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
              <i className="bi bi-pencil me-1"></i> {t.editAgainBtn}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="btn btn-primary px-4 py-2"
            >
              {t.doneExitBtn}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
