"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createFamilyAction, checkMobileAvailabilityAction } from "@/lib/actions/family-actions";
import {
  FamilyFormValues,
  MemberInput,
  calculateAgeFromDob,
} from "@/lib/validation/family";

export type FormLanguage = "en" | "hi" | "gu";

export const FORM_TRANSLATIONS = {
  en: {
    step1Title: "Section 1: Family Information",
    step1Desc: "Enter the primary household information and select the corresponding Sangh.",
    step2Title: "Section 2: Additional Household Members",
    step2Desc: "Add all other living family members residing in this household.",
    step3Title: "Review & Confirm Family Survey",
    step3Desc: "Please carefully review all entered family details before final submission.",
    step1Tab: "Family Details",
    step2Tab: "Members",
    step3Tab: "Review & Submit",
    sangh: "Sangh",
    mobile: "Mobile Number",
    mobileHint: "Primary contact for Sangh communications.",
    checkingMobile: "Checking existing records...",
    email: "Head Email ID",
    emailHint: "Required for notifications, surveys, and record updates.",
    headName: "Head of Family Name",
    dob: "Date of Birth",
    age: "Age",
    gender: "Gender",
    area: "Area / Locality",
    lane: "Lane / Gali / Road",
    address: "Flat / Building / Street Address",
    bloodGroup: "Blood Group",
    sect: "Jain Sect / Sampradaya",
    selectSect: "Select Sect",
    otherSectLabel: "Specify Other Sect",
    otherSectPlaceholder: "e.g. Shrimad Rajchandra, Kanji Swami, etc.",
    residenceLocation: "Current Location",
    nativePlace: "Native Village / Mul Gaam (મૂળ ગામ / मूल वतन)",
    nativePlacePlaceholder: "e.g. Patan, Palanpur, Sirohi, Kutch, Jamnagar",
    nativePlaceHint: "Ancestral hometown for community directory & associations.",
    occupation: "Occupation",
    selectOccupation: "Select Occupation",
    occService: "Service (Job)",
    occBusiness: "Business",
    occRetired: "Retired",
    occHousewife: "Housewife",
    occStudent: "Student",
    occOther: "Other",
    relationship: "Relationship",
    addMemberBtn: "Add Another Member",
    next: "Continue",
    back: "Back",
    submit: "Submit Survey Record",
    householdInfo: "Household Information",
    allMembers: "All Members",
    mobileDuplicate: "This mobile number is already registered under:",
  },
  hi: {
    step1Title: "भाग 1: परिवार की सामान्य जानकारी",
    step1Desc: "परिवार की मुख्य जानकारी दर्ज करें और संबंधित संघ चुनें।",
    step2Title: "भाग 2: परिवार के अन्य सदस्य",
    step2Desc: "घर में रहने वाले अन्य सभी सदस्यों का विवरण जोड़ें।",
    step3Title: "समीक्षा एवं पुष्टि (Review)",
    step3Desc: "अंतिम सबमिशन से पहले दर्ज की गई जानकारी की जांच कर लें।",
    step1Tab: "परिवार विवरण",
    step2Tab: "सदस्य",
    step3Tab: "समीक्षा एवं सबमिट",
    sangh: "संघ",
    mobile: "मोबाइल नंबर",
    mobileHint: "संघ के संपर्क और सूचनाओं के लिए मुख्य मोबाइल नंबर।",
    checkingMobile: "मौजूदा रिकॉर्ड की जाँच हो रही है...",
    email: "प्रमुख का ईमेल आईडी",
    emailHint: "महत्वपूर्ण सूचनाओं और ऑनलाइन अपडेट के लिए आवश्यक।",
    headName: "परिवार प्रमुख का पूरा नाम",
    dob: "जन्म तिथि",
    age: "उम्र",
    gender: "लिंग",
    area: "क्षेत्र / इलाका",
    lane: "गली / लेन / मार्ग",
    address: "मकान / बिल्डिंग / गली का पूरा पता",
    bloodGroup: "रक्त समूह (ब्लड ग्रुप)",
    sect: "जैन सम्प्रदाय / फिरका",
    selectSect: "सम्प्रदाय चुनें",
    otherSectLabel: "अन्य सम्प्रदाय का नाम",
    otherSectPlaceholder: "उदा. श्रीमद् राजचंद्र, कांजी स्वामी, आदि",
    residenceLocation: "वर्तमान निवास स्थान",
    nativePlace: "मूल वतन / गाँव (મૂળ ગામ)",
    nativePlacePlaceholder: "उदा. पाटन, पालनपुर, सिरोही, कच्छ, जामनगर",
    nativePlaceHint: "सामुदायिक निर्देशिका और वतन संगठन के लिए पैतृक गाँव।",
    occupation: "व्यवसाय / पेशा (Occupation)",
    selectOccupation: "व्यवसाय चुनें",
    occService: "नौकरी (Service)",
    occBusiness: "व्यापार / धंधा (Business)",
    occRetired: "सेवानिवृत्त (Retired)",
    occHousewife: "गृहिणी (Housewife)",
    occStudent: "विद्यार्थी (Student)",
    occOther: "अन्य (Other)",
    relationship: "प्रमुख से संबंध",
    addMemberBtn: "अन्य सदस्य जोड़ें",
    next: "आगे बढ़ें",
    back: "पीछे",
    submit: "सर्वेक्षण सबमिट करें",
    householdInfo: "परिवार की जानकारी",
    allMembers: "कुल सदस्य",
    mobileDuplicate: "यह मोबाइल नंबर पहले से इस परिवार में पंजीकृत है:",
  },
  gu: {
    step1Title: "વિભાગ 1: કુટુંબની પ્રાથમિક વિગતો",
    step1Desc: "કુટુંબની મુખ્ય માહિતી દાખલ કરો અને સંબંધિત સંઘ પસંદ કરો.",
    step2Title: "વિભાગ 2: ઘરના અન્ય સભ્યો",
    step2Desc: "આ ઘરમાં રહેતા અન્ય તમામ સભ્યોની વિગતો ઉમેરો.",
    step3Title: "ચકાસણી અને પુષ્ટિ (Review)",
    step3Desc: "અંતિમ સબમિશન પહેલાં ભરેલી વિગતો ધ્યાનપૂર્વક ચકાસી લો.",
    step1Tab: "કુટુંબ વિગતો",
    step2Tab: "સભ્યો",
    step3Tab: "ચકાસણી & સબમિટ",
    sangh: "સંઘ",
    mobile: "મોબાઈલ નંબર",
    mobileHint: "સંઘ સાથેના સંપર્ક માટેનો મુખ્ય નંબર.",
    checkingMobile: "રેકોર્ડ ચકાસી રહ્યા છીએ...",
    email: "વડાનું ઇમેઇલ આઇડી",
    emailHint: "સંઘની સૂચનાઓ અને રેકોર્ડ અપડેટ માટે જરૂરી.",
    headName: "કુટુંબના વડાનું પૂરું નામ",
    dob: "જન્મ તારીખ",
    age: "ઉંમર",
    gender: "જાતિ",
    area: "વિસ્તાર / સોસાયટી",
    lane: "શેરી / ગલી / માર્ગ",
    address: "ફ્લેટ / મકાન / શેરીનું સરનામું",
    bloodGroup: "બ્લડ ગ્રુપ",
    sect: "જૈન સંપ્રદાય / ફિરકો",
    selectSect: "સંપ્રદાય પસંદ કરો",
    otherSectLabel: "અન્ય સંપ્રદાયનું નામ",
    otherSectPlaceholder: "દા.ત. શ્રીમદ્ રાજચંદ્ર, કાનજી સ્વામી, વગેરે",
    residenceLocation: "હાલનું રહેઠાણ",
    nativePlace: "મૂળ ગામ / વતન",
    nativePlacePlaceholder: "દા.ત. પાટણ, પાલનપુર, સિરોહી, કચ્છ, જામનગર",
    nativePlaceHint: "સમાજ ડિરેક્ટરી અને વતન મંડળ માટે મૂળ વતન.",
    occupation: "વ્યવસાય / કામકાજ (Occupation)",
    selectOccupation: "વ્યવસાય પસંદ કરો",
    occService: "નોકરી (Service)",
    occBusiness: "વેપાર / ધંધો (Business)",
    occRetired: "નિવૃત્ત (Retired)",
    occHousewife: "ગૃહિણી (Housewife)",
    occStudent: "વિદ્યાર્થી (Student)",
    occOther: "અન્ય (Other)",
    relationship: "સંબંધ",
    addMemberBtn: "બીજા સભ્ય ઉમેરો",
    next: "આગળ વધો",
    back: "પાછા જાઓ",
    submit: "સર્વે દાખલ કરો (Submit)",
    householdInfo: "કુટુંબ માહિતી",
    allMembers: "કુલ સભ્યો",
    mobileDuplicate: "આ મોબાઇલ નંબર પહેલેથી આ કુટુંબ હેઠળ નોંધાયેલ છે:",
  },
};

export function getOccupationLabel(val: string | null | undefined, t: any) {
  if (!val) return "—";
  switch (val) {
    case "SERVICE": return t.occService || "Service";
    case "BUSINESS": return t.occBusiness || "Business";
    case "RETIRED": return t.occRetired || "Retired";
    case "HOUSEWIFE": return t.occHousewife || "Housewife";
    case "STUDENT": return t.occStudent || "Student";
    case "OTHER": return t.occOther || "Other";
    default: return val;
  }
}

export function getSectLabel(sect: string | null | undefined, otherSect?: string | null) {
  if (!sect) return "—";
  switch (sect) {
    case "MURTIPUJAK": return "Murtipujak (मूर्तिपूजक / મૂર્તિપૂજક)";
    case "STHANAKWASI": return "Sthanakwasi (स्थानकवासी / સ્થાનકવાસી)";
    case "DIGAMBAR": return "Digambar (दिगंबर / દિગંબર)";
    case "TERAPANTHI": return "Terapanthi (तेरापंथी / તેરાપંથી)";
    case "OTHER": return otherSect?.trim() ? `${otherSect.trim()} (Other)` : "Other (अन्य / અન્ય)";
    default: return sect;
  }
}

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

export default function FamilyForm({ sanghs, userSanghId, userUsername }: FamilyFormProps) {
  const router = useRouter();

  // Language state: English, Hindi, Gujarati
  const [lang, setLang] = useState<FormLanguage>("en");
  const t = FORM_TRANSLATIONS[lang];

  // Current Step: 1 = Family Details, 2 = Members, 3 = Review, 4 = Success
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [duplicateData, setDuplicateData] = useState<any | null>(null);
  const [checkingMobile, setCheckingMobile] = useState(false);
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
    headWhatsappNumber: "",
    headEmail: "",
    address: "",
    lane: "",
    area: "",
    nativePlace: "",
    headBloodGroup: "",
    sect: "",
    otherSect: "",
    sanghId: userSanghId || (sanghs.length > 0 ? sanghs[0].id : ""),
    headOccupation: "",
    headPathshalaStatus: "UNKNOWN",
    headPreferredDay: "NO_PREFERENCE",
    headPreferredTime: "NO_PREFERENCE",
    headPreferredWeekdays: "",
    headTransportPreference: "BY_SELF",
    headWhatsappConsent: false,
    volunteerName: userUsername || "",
    filledByMember: "",
    members: [],
  });

  // Live debounced mobile duplicate check (if phone number is entered)
  useEffect(() => {
    const rawDigits = (formData.headWhatsappNumber || formData.mobile || "").replace(/[^0-9]/g, "");
    if (rawDigits.length >= 10) {
      setCheckingMobile(true);
      const timer = setTimeout(async () => {
        try {
          const res = await checkMobileAvailabilityAction(rawDigits);
          if (res.exists) {
            setDuplicateData({
              id: res.id,
              familyId: res.familyId,
              headName: res.headName,
              sanghName: res.sanghName,
              area: res.sanghPrefix,
            });
          } else {
            setDuplicateData(null);
          }
        } catch {
          // ignore network failure
        } finally {
          setCheckingMobile(false);
        }
      }, 350);
      return () => clearTimeout(timer);
    } else {
      setDuplicateData(null);
      setCheckingMobile(false);
    }
  }, [formData.mobile, formData.headWhatsappNumber]);

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
          maritalStatus: "UNMARRIED",
          husbandName: "",
          wifeName: "",
          wifeContact: "",
          residenceLocation: "IN_PUNE",
          bloodGroup: "",
          children: [],
          pathshalaStatus: "UNKNOWN",
          preferredDay: "NO_PREFERENCE",
          preferredTime: "NO_PREFERENCE",
          preferredWeekdays: "",
          transportPreference: null,
          whatsappNumber: "",
          occupation: "",
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

  const addChildToMember = (memberIdx: number) => {
    setFormData((prev) => {
      const updated = [...prev.members];
      const member = { ...updated[memberIdx] };
      const children = Array.isArray(member.children) ? [...member.children] : [];
      children.push({
        name: "",
        dateOfBirth: "",
        age: 5,
        gender: "MALE",
        bloodGroup: "",
      });
      member.children = children;
      updated[memberIdx] = member;
      return { ...prev, members: updated };
    });
  };

  const removeChildFromMember = (memberIdx: number, childIdx: number) => {
    setFormData((prev) => {
      const updated = [...prev.members];
      const member = { ...updated[memberIdx] };
      if (!member.children) return prev;
      member.children = member.children.filter((_, idx) => idx !== childIdx);
      updated[memberIdx] = member;
      return { ...prev, members: updated };
    });
  };

  const updateMemberChild = (memberIdx: number, childIdx: number, field: string, value: any) => {
    setFormData((prev) => {
      const updated = [...prev.members];
      const member = { ...updated[memberIdx] };
      if (!member.children) return prev;
      const children = [...member.children];
      const child = { ...children[childIdx], [field]: value };

      if (field === "dateOfBirth" && value && typeof value === "string") {
        try {
          const calc = calculateAgeFromDob(value);
          if (calc !== null) {
            child.age = calc;
          }
        } catch {}
      }

      children[childIdx] = child;
      member.children = children;
      updated[memberIdx] = member;
      return { ...prev, members: updated };
    });
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

      // If relationship is DAUGHTER_IN_LAW, auto-set gender to FEMALE and maritalStatus to MARRIED
      if (field === "relationship" && value === "DAUGHTER_IN_LAW") {
        member.gender = "FEMALE";
        member.maritalStatus = "MARRIED";
      }

      // If relationship changes away from daughter/sister, or maritalStatus becomes UNMARRIED, reset husbandName
      if (field === "relationship" && value !== "DAUGHTER" && value !== "SISTER") {
        member.husbandName = "";
      }
      if (field === "maritalStatus" && value !== "MARRIED") {
        member.husbandName = "";
      }

      // If relationship changes away from son, or maritalStatus becomes UNMARRIED, reset wife details
      if (field === "relationship" && value !== "SON") {
        member.wifeName = "";
        member.wifeContact = "";
      }
      if (field === "maritalStatus" && value !== "MARRIED" && member.relationship === "SON") {
        member.wifeName = "";
        member.wifeContact = "";
      }

      updated[index] = member;
      return { ...prev, members: updated };
    });
  };

  // Step 1 Validation: Do NOT ask for contact number in registration
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
    if (!formData.headEmail || !formData.headEmail.trim() || !formData.headEmail.includes("@") || !formData.headEmail.includes(".")) {
      setErrorMsg("Please enter a valid Email ID for Head of Family (e.g. head@example.com).");
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
    if (formData.sect === "OTHER" && (!formData.otherSect || formData.otherSect.trim().length < 2)) {
      setErrorMsg("Please specify the Sect name when selecting 'Others' (अन्य सम्प्रदाय का नाम दर्ज करना आवश्यक है).");
      return false;
    }
    return true;
  };

  // Step 2 Validation: Members, Married Daughter/Sister, and Volunteer/Form-Filler Details
  const validateStep2 = () => {
    setErrorMsg(null);
    const rawHeadPhone = formData.headWhatsappNumber || formData.mobile || "";
    const headNorm = rawHeadPhone.replace(/[^0-9]/g, "");
    const memberPhonesSeen = new Set<string>();

    for (let i = 0; i < formData.members.length; i++) {
      const m = formData.members[i];
      if (!m.name.trim() || m.name.trim().length < 2) {
        setErrorMsg(`Please enter a valid name for member #${i + 2}.`);
        return false;
      }
      if (m.dateOfBirth && m.dateOfBirth > todayStr) {
        setErrorMsg(`Date of Birth for member #${i + 2} (${m.name}) cannot be in the future.`);
        return false;
      }
      if (m.age === undefined || m.age < 0 || m.age > 120) {
        setErrorMsg(`Please enter a valid age for member #${i + 2} (${m.name || "Member"}).`);
        return false;
      }

      // Member relationships
      const isSon = m.relationship === "SON";
      const isDaughter = m.relationship === "DAUGHTER";
      const isSister = m.relationship === "SISTER";
      const isMarried = m.maritalStatus === "MARRIED";
      const mPhone = m.whatsappNumber ? m.whatsappNumber.replace(/[^0-9]/g, "") : "";

      if ((isDaughter || isSister) && isMarried) {
        const label = isDaughter ? "daughter" : "sister";
        const labelHi = isDaughter ? "पुत्री" : "बहन";

        if (!m.husbandName || m.husbandName.trim().length < 2) {
          setErrorMsg(`Member #${i + 2} (${m.name}) is a married ${label}. Husband's name is required (विवाहित ${labelHi} के लिए पति का नाम अनिवार्य है).`);
          return false;
        }

        if (!mPhone || mPhone.length < 10) {
          setErrorMsg(`Member #${i + 2} (${m.name}) is a married ${label}. Contact number is required (विवाहित ${labelHi} के लिए फ़ोन नंबर अनिवार्य है).`);
          return false;
        }

        if (headNorm && (mPhone === headNorm || mPhone.endsWith(headNorm) || headNorm.endsWith(mPhone))) {
          setErrorMsg(`Married ${label} #${i + 2} (${m.name})'s phone number cannot be the same as the family head's registered number.`);
          return false;
        }
      }

      // Married son validation
      if (m.relationship === "SON" && isMarried) {
        if (!m.wifeName || m.wifeName.trim().length < 2) {
          setErrorMsg(`Member #${i + 2} (${m.name}) is a married son. Wife's name is required (विवाहित पुत्र की पत्नी का नाम अनिवार्य है).`);
          return false;
        }
      }

      // Children validation if any children added under married son or married daughter
      if ((isSon || isDaughter) && isMarried && m.children && m.children.length > 0) {
        for (let c = 0; c < m.children.length; c++) {
          const ch = m.children[c];
          if (!ch.name || ch.name.trim().length < 2) {
            setErrorMsg(`Please enter a valid name (at least 2 letters) for child #${c + 1} of member #${i + 2} (${m.name || "Member"}).`);
            return false;
          }
          if (ch.dateOfBirth && ch.dateOfBirth > todayStr) {
            setErrorMsg(`Date of birth for child #${c + 1} (${ch.name}) of member #${i + 2} cannot be in the future.`);
            return false;
          }
          if (ch.age === undefined || ch.age < 0 || ch.age > 100) {
            setErrorMsg(`Please enter a valid age (0-100) for child #${c + 1} (${ch.name}) of member #${i + 2}.`);
            return false;
          }
        }
      }

      // Default residence location for son / daughter
      if ((m.relationship === "SON" || m.relationship === "DAUGHTER") && !m.residenceLocation) {
        m.residenceLocation = "IN_PUNE";
      }

      if (mPhone) {
        if (memberPhonesSeen.has(mPhone)) {
          setErrorMsg(`Phone number for member #${i + 2} (${m.name}) is duplicated with another family member in this form. A unique phone number is required.`);
          return false;
        }
        memberPhonesSeen.add(mPhone);
      }
    }

    // Survey metadata validation (at the last below)
    if (!formData.volunteerName || formData.volunteerName.trim().length < 2) {
      setErrorMsg("Please enter the Volunteer Name who added this family (स्वयंसेवक का नाम अनिवार्य है).");
      return false;
    }
    if (!formData.filledByMember || formData.filledByMember.trim().length < 2) {
      setErrorMsg("Please enter the name of the Family Member who filled the form (फॉर्म भरने वाले सदस्य का नाम अनिवार्य है).");
      return false;
    }

    return true;
  };

  // Handle Next
  const handleNext = async () => {
    if (currentStep === 1) {
      if (!validateStep1()) return;
      // Pre-check duplicate on step 1 only if mobile is present
      const rawMobile = formData.headWhatsappNumber || formData.mobile || "";
      if (rawMobile && rawMobile.replace(/[^0-9]/g, "").length >= 10) {
        try {
          const res = await fetch("/api/duplicate-check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mobile: rawMobile,
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
      headEmail: "",
      address: "",
      lane: "",
      area: "",
      nativePlace: "",
      headBloodGroup: "",
      sect: "",
      otherSect: "",
      sanghId: userSanghId || (sanghs.length > 0 ? sanghs[0].id : ""),
      headOccupation: "",
      headPathshalaStatus: "UNKNOWN",
      headPreferredDay: "NO_PREFERENCE",
      headPreferredTime: "NO_PREFERENCE",
      headPreferredWeekdays: "",
      headTransportPreference: "BY_SELF",
      headWhatsappConsent: false,
      volunteerName: userUsername || "",
      filledByMember: "",
      headWhatsappNumber: "",
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
        <div className="card bg-light border-0 p-3 mb-3 d-inline-block w-100 max-w-md mx-auto">
          <small className="text-muted text-uppercase fw-semibold d-block">Generated Family ID</small>
          <span className="display-6 fw-bold text-primary font-monospace">{successResult.familyId}</span>
        </div>

        {/* Registered Email Dispatch Notification */}
        {formData.headEmail && (
          <div className="alert alert-info border-info d-flex align-items-center gap-3 max-w-md mx-auto text-start py-2 px-3 mb-4 shadow-xs">
            <i className="bi bi-envelope-check-fill fs-3 text-info flex-shrink-0"></i>
            <div>
              <div className="fw-bold text-dark">Confirmation Email Sent (ईमेल पाठवला आहे)</div>
              <small className="text-muted">
                Family ID, Member IDs, and portal link have been sent directly to{" "}
                <strong>{formData.headEmail}</strong>. No QR scan is required.
              </small>
            </div>
          </div>
        )}

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
      {/* Top Header Bar with Language Switcher */}
      <div className="d-flex flex-wrap justify-content-between align-items-center pb-3 mb-3 border-bottom gap-2">
        <div>
          <span className="badge bg-light text-primary border fw-bold text-uppercase px-2 py-1">
            <i className="bi bi-shield-check me-1"></i> Jin Sanskar Setu Survey
          </span>
        </div>
        <div className="d-flex align-items-center gap-2">
          <small className="text-muted fw-semibold d-none d-sm-inline">Language / भाषा / ભાષા:</small>
          <div className="btn-group btn-group-sm p-1 bg-light rounded-pill border">
            <button
              type="button"
              onClick={() => setLang("en")}
              className={`btn btn-sm rounded-pill fw-semibold ${
                lang === "en" ? "btn-primary shadow-xs text-white" : "btn-light text-muted border-0"
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLang("hi")}
              className={`btn btn-sm rounded-pill fw-semibold ${
                lang === "hi" ? "btn-primary shadow-xs text-white" : "btn-light text-muted border-0"
              }`}
            >
              हिन्दी
            </button>
            <button
              type="button"
              onClick={() => setLang("gu")}
              className={`btn btn-sm rounded-pill fw-semibold ${
                lang === "gu" ? "btn-primary shadow-xs text-white" : "btn-light text-muted border-0"
              }`}
            >
              ગુજરાતી
            </button>
          </div>
        </div>
      </div>

      {/* Stepper Progress Bar */}
      <nav aria-label="Registration Progress" className="mb-4">
        <div className="form-step-indicator">
          <div className={`form-step-item ${currentStep === 1 ? "form-step-active" : currentStep > 1 ? "form-step-completed" : ""}`}>
            <div className="form-step-circle">1</div>
            <span className="form-step-label">{t.step1Tab}</span>
          </div>
          <div className={`form-step-item ${currentStep === 2 ? "form-step-active" : currentStep > 2 ? "form-step-completed" : ""}`}>
            <div className="form-step-circle">2</div>
            <span className="form-step-label">{t.step2Tab}</span>
          </div>
          <div className={`form-step-item ${currentStep === 3 ? "form-step-active" : ""}`}>
            <div className="form-step-circle">3</div>
            <span className="form-step-label">{t.step3Tab}</span>
          </div>
        </div>
      </nav>

      {/* Exact Duplicate Warning Banner */}
      {duplicateData && (
        <div className="alert alert-danger py-3 px-3 mb-4 shadow-sm" role="alert">
          <div className="d-flex align-items-start gap-2">
            <i className="bi bi-exclamation-octagon-fill fs-4 mt-1"></i>
            <div>
              <h6 className="fw-bold mb-1">
                {lang === "gu"
                  ? "પહેલેથી નોંધાયેલ કુટુંબ મળ્યું!"
                  : lang === "hi"
                  ? "संभावित मौजूदा परिवार मिला!"
                  : "Possible Existing Family Found!"}
              </h6>
              <p className="small mb-2">
                {lang === "gu" ? "મોબાઈલ નંબર " : lang === "hi" ? "मोबाइल नंबर " : "A family with mobile number "}
                <strong>{formData.mobile}</strong>{" "}
                {lang === "gu"
                  ? `પહેલેથી ${duplicateData.sanghName} માં નોંધાયેલ છે.`
                  : lang === "hi"
                  ? `पहले से ${duplicateData.sanghName} में पंजीकृत है।`
                  : `is already registered in ${duplicateData.sanghName}.`}
              </p>
              <div className="bg-white p-2 rounded border small text-dark mb-2">
                <div><strong>Existing Family ID:</strong> {duplicateData.familyId}</div>
                <div><strong>Head of Family:</strong> {duplicateData.headName}</div>
                <div><strong>Sangh:</strong> {duplicateData.sanghName}</div>
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
          <h4 className="fw-bold text-dark mb-1">{t.step1Title}</h4>
          <p className="text-muted small mb-4">
            {t.step1Desc}
          </p>

          <div className="row g-3">
            {/* Sangh Dropdown */}
            <div className="col-12 col-md-6">
              <label htmlFor="family-sangh" className="form-label fw-semibold text-dark">
                {t.sangh} <span className="text-danger">*</span>
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

            {/* Head Email ID */}
            <div className="col-12 col-md-6">
              <label htmlFor="head-email" className="form-label fw-semibold text-dark">
                Head Email ID (ईमेल आईडी) <span className="text-danger">*</span>
              </label>
              <input
                type="email"
                id="head-email"
                className="form-control"
                placeholder="e.g. head@example.com"
                value={formData.headEmail}
                onChange={(e) => setFormData({ ...formData, headEmail: e.target.value })}
                required
              />
              <div className="form-text">Required for survey notifications and record updates.</div>
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

            {/* Lane / Gali / Street / Road */}
            <div className="col-12 col-md-6">
              <label htmlFor="family-lane" className="form-label fw-semibold text-dark">
                <i className="bi bi-signpost-split text-primary me-1"></i>
                {t.lane} (Lane / Gali / Road / शेरी)
              </label>
              <input
                type="text"
                id="family-lane"
                className="form-control"
                placeholder="e.g. Lane No. 4, Gali No. 2, Main Street"
                value={formData.lane || ""}
                onChange={(e) => setFormData({ ...formData, lane: e.target.value })}
              />
              <div className="form-text">Lane, gali, crossroad or street name.</div>
            </div>

            {/* Full Address */}
            <div className="col-12 col-md-6">
              <label htmlFor="family-address" className="form-label fw-semibold text-dark">
                {t.address} <span className="text-danger">*</span>
              </label>
              <textarea
                id="family-address"
                rows={2}
                autoComplete="street-address"
                className="form-control"
                placeholder="Flat / House / Building & Detailed address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required
              />
            </div>

            {/* Native Place / Mul Gaam */}
            <div className="col-12 col-md-6">
              <label htmlFor="native-place" className="form-label fw-semibold text-dark">
                <i className="bi bi-house-door text-primary me-1"></i>
                {t.nativePlace}
              </label>
              <input
                type="text"
                id="native-place"
                className="form-control"
                placeholder={t.nativePlacePlaceholder}
                value={formData.nativePlace || ""}
                onChange={(e) => setFormData({ ...formData, nativePlace: e.target.value })}
              />
              <div className="form-text">{t.nativePlaceHint}</div>
            </div>

            {/* Head Occupation */}
            <div className="col-12 col-md-6">
              <label htmlFor="head-occupation" className="form-label fw-semibold text-dark">
                <i className="bi bi-briefcase text-primary me-1"></i>
                {t.occupation}
              </label>
              <select
                id="head-occupation"
                className="form-select"
                value={formData.headOccupation || ""}
                onChange={(e) => setFormData({ ...formData, headOccupation: e.target.value })}
              >
                <option value="">{t.selectOccupation}</option>
                <option value="SERVICE">{t.occService}</option>
                <option value="BUSINESS">{t.occBusiness}</option>
                <option value="RETIRED">{t.occRetired}</option>
                <option value="HOUSEWIFE">{t.occHousewife}</option>
                <option value="STUDENT">{t.occStudent}</option>
                <option value="OTHER">{t.occOther}</option>
              </select>
              <div className="form-text">Primary occupation / profession of family head.</div>
            </div>

            {/* Head Blood Group */}
            <div className="col-12 col-md-6">
              <label htmlFor="head-blood-group" className="form-label fw-semibold text-dark">
                <i className="bi bi-droplet-half text-danger me-1"></i>
                {t.bloodGroup} (रक्त समूह)
              </label>
              <select
                id="head-blood-group"
                className="form-select"
                value={formData.headBloodGroup || ""}
                onChange={(e) => setFormData({ ...formData, headBloodGroup: e.target.value })}
              >
                <option value="">Select Blood Group (ऐच्छिक)</option>
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
              <div className="form-text">Emergency medical assistance &amp; Sangh blood donor directory.</div>
            </div>

            {/* Jain Sect / Sampradaya */}
            <div className="col-12 col-md-6">
              <label htmlFor="head-sect" className="form-label fw-semibold text-dark">
                <i className="bi bi-tag text-primary me-1"></i>
                {t.sect} (फिरका / सम्प्रदाय)
              </label>
              <select
                id="head-sect"
                className="form-select"
                value={formData.sect || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    sect: val,
                    otherSect: val === "OTHER" ? prev.otherSect : "",
                  }));
                }}
              >
                <option value="">{t.selectSect || "Select Sect"}</option>
                <option value="MURTIPUJAK">Murtipujak (मूर्तिपूजक / મૂર્તિપૂજક)</option>
                <option value="STHANAKWASI">Sthanakwasi (स्थानकवासी / સ્થાનકવાસી)</option>
                <option value="DIGAMBAR">Digambar (दिगंबर / દિગંબર)</option>
                <option value="TERAPANTHI">Terapanthi (तेरापंथी / તેરાપંથી)</option>
                <option value="OTHER">Others (अन्य / અન્ય)</option>
              </select>
              <div className="form-text">Jain tradition / sect for sangh records &amp; rituals.</div>
            </div>

            {/* Other Sect (Conditional: only shown when Others is selected) */}
            {formData.sect === "OTHER" && (
              <div className="col-12 col-md-6 animate-fade-in">
                <label htmlFor="head-other-sect" className="form-label fw-semibold text-dark">
                  <i className="bi bi-pencil-square text-warning-emphasis me-1"></i>
                  {t.otherSectLabel} <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  id="head-other-sect"
                  className="form-control border-primary"
                  placeholder={t.otherSectPlaceholder || "e.g. Shrimad Rajchandra, Kanji Swami, etc."}
                  value={formData.otherSect || ""}
                  onChange={(e) => setFormData({ ...formData, otherSect: e.target.value })}
                  required
                />
                <div className="form-text text-primary">Specify your specific Jain tradition or panth.</div>
              </div>
            )}
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
              <h4 className="fw-bold text-dark mb-0">Section 2: Family Members Details</h4>
              <p className="text-muted small mb-0">
                Contact numbers can be filled by each member (not compulsory). For married daughters or sisters, husband&apos;s name and contact number are required.
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

          {/* Household Guidelines Notice */}
          <div className="alert alert-light border border-primary-subtle shadow-xs mb-3">
            <div className="d-flex align-items-start gap-2">
              <i className="bi bi-info-circle-fill text-primary fs-5 mt-1 flex-shrink-0"></i>
              <div className="small text-secondary">
                <strong className="text-dark d-block mb-1">
                  पारिवारिक प्रविष्टि नियम (Household Registry Guidelines):
                </strong>
                <ul className="mb-0 ps-3">
                  <li>
                    <strong>पुत्रवधू (Sons&apos; Wives):</strong> बेटों की पत्नियों को परिवार के सदस्य के रूप में <code>Daughter-in-law (पुत्रवधू / बहू / વહુ)</code> संबंध चुनकर जोड़ा जा सकता है।
                  </li>
                  <li>
                    <strong>दामाद (Daughters&apos; Husbands):</strong> बेटियों के पतियों (दामाद) को इस परिवार के सदस्य के रूप में जोड़ना <strong>मान्य नहीं है</strong> (विवाह पश्चात वे अपने परिवार/संघ से जुड़ते हैं); केवल विवाहित बेटी के विवरण में पति का नाम और संपर्क दर्ज किया जाता है।
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Member #1: Head of Family Contact Number (Not Compulsory) */}
          <div className="card p-3 border rounded-3 bg-white shadow-xs mb-3 border-primary-subtle">
            <div className="d-flex justify-content-between align-items-center mb-2 pb-1 border-bottom">
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-primary text-white font-monospace">Member #1</span>
                <strong className="text-dark">{formData.headName}</strong>
                <span className="badge bg-secondary-subtle text-secondary small">Head of Family • Age {formData.headAge}</span>
              </div>
              <span className="badge bg-light text-muted border">Primary Household Member</span>
            </div>
            <div className="row g-2 align-items-center">
              <div className="col-12 col-md-6">
                <label className="form-label small fw-semibold text-dark mb-1">
                  <i className="bi bi-whatsapp text-success me-1"></i>
                  Head Contact / WhatsApp Number
                  <span className="text-muted fw-normal ms-1">(Optional / Not compulsory - ऐच्छिक)</span>
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={15}
                  className="form-control form-control-sm"
                  placeholder="Head WhatsApp / phone number (optional)"
                  value={formData.headWhatsappNumber || formData.mobile || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData((prev) => ({
                      ...prev,
                      headWhatsappNumber: val,
                      mobile: val,
                    }));
                  }}
                />
                <div className="form-text small">Each member can optionally fill their own contact number.</div>
              </div>
            </div>
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
                const isSon = member.relationship === "SON";
                const isDaughter = member.relationship === "DAUGHTER";
                const isSister = member.relationship === "SISTER";
                const isDaughterInLaw = member.relationship === "DAUGHTER_IN_LAW";
                const isDaughterOrSister = isDaughter || isSister;
                const isMarried = member.maritalStatus === "MARRIED";

                return (
                  <div key={idx} className={`card p-3 border rounded-3 bg-light shadow-sm ${(isDaughterOrSister || isSon) && isMarried ? "border-primary" : ""}`}>
                    <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom flex-wrap gap-1">
                      <div>
                        <span className="badge bg-secondary-subtle text-secondary font-monospace me-1">
                          Member #{idx + 2}
                        </span>
                        {isChild && <span className="badge bg-warning text-dark ms-1">Child (&lt;18)</span>}
                        {isDaughterOrSister && isMarried && (
                          <span className="badge bg-primary-subtle text-primary border border-primary-subtle ms-1">
                            Married {isDaughter ? "Daughter" : "Sister"}
                          </span>
                        )}
                        {isSon && isMarried && (
                          <span className="badge bg-primary-subtle text-primary border border-primary-subtle ms-1">
                            Married Son
                          </span>
                        )}
                        {isDaughterInLaw && (
                          <span className="badge bg-info-subtle text-info border border-info-subtle ms-1">
                            Daughter-in-law (पुत्रवधू)
                          </span>
                        )}
                        {member.residenceLocation && (isSon || isDaughter) && (
                          <span className="badge bg-light text-secondary border ms-1">
                            {member.residenceLocation === "IN_PUNE"
                              ? "📍 In Pune"
                              : member.residenceLocation === "OUT_OF_PUNE"
                              ? "📍 Outside Pune"
                              : "✈️ Foreign"}
                          </span>
                        )}
                        {member.bloodGroup && (
                          <span className="badge bg-danger-subtle text-danger border border-danger-subtle ms-1">
                            🩸 {member.bloodGroup}
                          </span>
                        )}
                      </div>
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
                          Relationship <span className="text-danger">*</span>
                        </label>
                        <select
                          className="form-select form-select-sm"
                          value={member.relationship}
                          onChange={(e) => updateMember(idx, "relationship", e.target.value as any)}
                        >
                          <option value="SPOUSE">Spouse (पति / पत्नी)</option>
                          <option value="SON">Son (पुत्र / बेटा)</option>
                          <option value="DAUGHTER">Daughter (पुत्री / बेटी)</option>
                          <option value="DAUGHTER_IN_LAW">Daughter-in-law (पुत्रवधू / बहू / વહુ)</option>
                          <option value="FATHER">Father (पिता)</option>
                          <option value="MOTHER">Mother (माता)</option>
                          <option value="BROTHER">Brother (भाई)</option>
                          <option value="SISTER">Sister (बहन)</option>
                          <option value="GRANDFATHER">Grandfather (दादा / नाना)</option>
                          <option value="GRANDMOTHER">Grandmother (दादी / नानी)</option>
                          <option value="GRANDCHILD">Grandchild (पोता / पोती)</option>
                          <option value="OTHER">Other (अन्य)</option>
                        </select>
                      </div>

                      {/* Marital Status for Son */}
                      {isSon && (
                        <div className="col-12 col-sm-6 col-md-3">
                          <label className="form-label small fw-semibold text-dark mb-1">
                            Marital Status (विवाह स्थिति) <span className="text-danger">*</span>
                          </label>
                          <select
                            className="form-select form-select-sm fw-semibold"
                            value={member.maritalStatus || "UNMARRIED"}
                            onChange={(e) => updateMember(idx, "maritalStatus", e.target.value as any)}
                          >
                            <option value="UNMARRIED">Unmarried (अविवाहित)</option>
                            <option value="MARRIED">Married (विवाहित)</option>
                          </select>
                        </div>
                      )}

                      {/* If Son is Married: Ask Wife's Name & Contact Number */}
                      {isSon && isMarried && (
                        <>
                          <div className="col-12 col-sm-6 col-md-3">
                            <label className="form-label small fw-semibold text-dark mb-1">
                              <i className="bi bi-heart text-danger me-1"></i>
                              Wife&apos;s Name (पत्नी का नाम) <span className="text-danger">*</span>
                            </label>
                            <input
                              type="text"
                              className="form-control form-control-sm border-primary"
                              placeholder="Son's wife full name"
                              value={member.wifeName || ""}
                              onChange={(e) => updateMember(idx, "wifeName", e.target.value)}
                              required
                            />
                            <div className="form-text small text-muted">
                              Can also be registered as a member (Daughter-in-law).
                            </div>
                          </div>

                          <div className="col-12 col-sm-6 col-md-3">
                            <label className="form-label small fw-semibold text-dark mb-1">
                              <i className="bi bi-telephone text-primary me-1"></i>
                              Wife&apos;s Contact Number
                              <span className="text-muted fw-normal ms-1">(Optional)</span>
                            </label>
                            <input
                              type="tel"
                              inputMode="numeric"
                              maxLength={15}
                              className="form-control form-control-sm"
                              placeholder="Wife's contact number (optional)"
                              value={member.wifeContact || ""}
                              onChange={(e) => updateMember(idx, "wifeContact", e.target.value)}
                            />
                          </div>
                        </>
                      )}

                      {/* Marital Status for Daughter or Sister */}
                      {isDaughterOrSister && (
                        <div className="col-12 col-sm-6 col-md-3">
                          <label className="form-label small fw-semibold text-dark mb-1">
                            Marital Status (विवाह स्थिति) <span className="text-danger">*</span>
                          </label>
                          <select
                            className="form-select form-select-sm fw-semibold"
                            value={member.maritalStatus || "UNMARRIED"}
                            onChange={(e) => updateMember(idx, "maritalStatus", e.target.value as any)}
                          >
                            <option value="UNMARRIED">Unmarried (अविवाहित)</option>
                            <option value="MARRIED">Married (विवाहित)</option>
                          </select>
                        </div>
                      )}

                      {/* If Daughter or Sister is Married: Ask Husband's Name & Contact Number */}
                      {isDaughterOrSister && isMarried ? (
                        <>
                          <div className="col-12 col-sm-6 col-md-3">
                            <label className="form-label small fw-semibold text-dark mb-1">
                              <i className="bi bi-person-heart text-danger me-1"></i>
                              Husband&apos;s Name (पति का नाम) <span className="text-danger">*</span>
                            </label>
                            <input
                              type="text"
                              className="form-control form-control-sm border-primary"
                              placeholder="Husband's full name"
                              value={member.husbandName || ""}
                              onChange={(e) => updateMember(idx, "husbandName", e.target.value)}
                              required
                            />
                          </div>

                          <div className="col-12 col-sm-6 col-md-3">
                            <label className="form-label small fw-semibold text-dark mb-1">
                              <i className="bi bi-telephone-fill text-primary me-1"></i>
                              Her Contact Number <span className="text-danger">*</span>
                            </label>
                            <input
                              type="tel"
                              inputMode="numeric"
                              maxLength={15}
                              className="form-control form-control-sm border-primary"
                              placeholder="10-digit mobile number"
                              value={member.whatsappNumber || ""}
                              onChange={(e) => updateMember(idx, "whatsappNumber", e.target.value)}
                              required
                            />
                            <div className="form-text small text-primary">Required for married daughter/sister.</div>
                          </div>
                        </>
                      ) : (
                        /* Individual Phone / WhatsApp Number for other members (Not Compulsory) */
                        <div className="col-12 col-sm-6 col-md-3">
                          <label className="form-label small fw-semibold text-dark mb-1">
                            <i className="bi bi-whatsapp text-success me-1"></i>
                            Phone / WhatsApp
                            <span className="text-muted fw-normal ms-1">(Optional / Not compulsory)</span>
                          </label>
                          <input
                            type="tel"
                            inputMode="numeric"
                            maxLength={15}
                            className="form-control form-control-sm"
                            placeholder="Phone / WhatsApp (optional)"
                            value={member.whatsappNumber || ""}
                            onChange={(e) => updateMember(idx, "whatsappNumber", e.target.value)}
                          />
                        </div>
                      )}

                      {/* Current Residence Location (Son or Daughter) */}
                      {(isSon || isDaughter) && (
                        <div className="col-12 col-sm-6 col-md-3">
                          <label className="form-label small fw-semibold text-dark mb-1">
                            <i className="bi bi-geo-alt text-danger me-1"></i>
                            {t.residenceLocation} (वर्तमान निवास) <span className="text-danger">*</span>
                          </label>
                          <select
                            className="form-select form-select-sm fw-medium"
                            value={member.residenceLocation || "IN_PUNE"}
                            onChange={(e) => updateMember(idx, "residenceLocation", e.target.value)}
                          >
                            <option value="IN_PUNE">📍 In Pune (पुणे में / પુણેમાં)</option>
                            <option value="OUT_OF_PUNE">📍 Outside Pune / India (पुणे के बाहर / ભારત)</option>
                            <option value="FOREIGN">✈️ Foreign / Abroad (विदेश / વિદેશ / NRI)</option>
                          </select>
                        </div>
                      )}

                      {/* Member Blood Group */}
                      <div className="col-12 col-sm-6 col-md-3">
                        <label className="form-label small fw-semibold text-dark mb-1">
                          <i className="bi bi-droplet-half text-danger me-1"></i>
                          {t.bloodGroup} (रक्त समूह)
                        </label>
                        <select
                          className="form-select form-select-sm"
                          value={member.bloodGroup || ""}
                          onChange={(e) => updateMember(idx, "bloodGroup", e.target.value)}
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

                      {/* Member Occupation */}
                      <div className="col-12 col-sm-6 col-md-3">
                        <label className="form-label small fw-semibold text-dark mb-1">
                          <i className="bi bi-briefcase text-primary me-1"></i>
                          {t.occupation}
                        </label>
                        <select
                          className="form-select form-select-sm"
                          value={member.occupation || ""}
                          onChange={(e) => updateMember(idx, "occupation", e.target.value)}
                        >
                          <option value="">{t.selectOccupation}</option>
                          <option value="SERVICE">{t.occService}</option>
                          <option value="BUSINESS">{t.occBusiness}</option>
                          <option value="RETIRED">{t.occRetired}</option>
                          <option value="HOUSEWIFE">{t.occHousewife}</option>
                          <option value="STUDENT">{t.occStudent}</option>
                          <option value="OTHER">{t.occOther}</option>
                        </select>
                      </div>
                    </div>

                    {/* Nested Children Section for Married Son or Married Daughter */}
                    {(isSon || isDaughter) && isMarried && (
                      <div className="mt-3 p-3 bg-white border border-info-subtle rounded-3 shadow-xs">
                        <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                          <div>
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                              <span className="fw-bold text-dark d-flex align-items-center gap-1">
                                <i className="bi bi-people-fill text-info"></i>
                                Children of {member.name ? member.name : isSon ? "Son" : "Daughter"} (बच्चे / સંતાનો)
                              </span>
                              <span className="badge bg-info-subtle text-info border border-info-subtle small fw-normal">
                                Auto-mapped as Grandchild (पोता / पोती / नाती) to Family Head
                              </span>
                            </div>
                            <div className="text-muted small">
                              Enter children here; they will automatically be registered as grandchildren of the family head with their own generated Member ID.
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => addChildToMember(idx)}
                            className="btn btn-outline-info btn-sm d-flex align-items-center gap-1 shadow-xs"
                          >
                            <i className="bi bi-plus-circle"></i>
                            <span>+ Add Child (बच्चा जोड़ें)</span>
                          </button>
                        </div>

                        {(!member.children || member.children.length === 0) ? (
                          <div className="text-muted small py-2 px-3 border border-dashed rounded-2 bg-light-subtle d-flex align-items-center justify-content-between flex-wrap gap-2">
                            <span>
                              <i className="bi bi-info-circle me-1 text-info"></i>
                              No children added yet. If this {isSon ? "married son" : "married daughter"} has children, click &quot;+ Add Child&quot; to add them under the parents.
                            </span>
                            <button
                              type="button"
                              onClick={() => addChildToMember(idx)}
                              className="btn btn-link btn-sm text-info p-0 text-decoration-none fw-semibold"
                            >
                              + Add Child Now
                            </button>
                          </div>
                        ) : (
                          <div className="d-flex flex-column gap-2 mt-2">
                            {member.children.map((child, cIdx) => (
                              <div key={cIdx} className="p-3 border rounded-2 bg-light-subtle shadow-xs">
                                <div className="d-flex justify-content-between align-items-center mb-2 pb-1 border-bottom">
                                  <div className="d-flex align-items-center gap-2">
                                    <span className="badge bg-info font-monospace small">Child #{cIdx + 1}</span>
                                    <span className="small text-muted">
                                      Grandchild of {formData.headName || "Head"}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeChildFromMember(idx, cIdx)}
                                    className="btn btn-link text-danger p-0 small text-decoration-none d-flex align-items-center gap-1"
                                    title="Remove child"
                                  >
                                    <i className="bi bi-trash"></i> Remove Child
                                  </button>
                                </div>
                                <div className="row g-2">
                                  <div className="col-12 col-sm-6 col-md-3">
                                    <label className="form-label small fw-semibold text-dark mb-1">
                                      Child Full Name <span className="text-danger">*</span>
                                    </label>
                                    <input
                                      type="text"
                                      className="form-control form-control-sm"
                                      placeholder="Child's full name"
                                      value={child.name}
                                      onChange={(e) => updateMemberChild(idx, cIdx, "name", e.target.value)}
                                      required
                                    />
                                  </div>
                                  <div className="col-6 col-sm-6 col-md-3">
                                    <label className="form-label small fw-semibold text-dark mb-1">Date of Birth</label>
                                    <input
                                      type="date"
                                      max={todayStr}
                                      className="form-control form-control-sm"
                                      value={child.dateOfBirth || ""}
                                      onChange={(e) => updateMemberChild(idx, cIdx, "dateOfBirth", e.target.value)}
                                    />
                                  </div>
                                  <div className="col-6 col-sm-4 col-md-2">
                                    <label className="form-label small fw-semibold text-dark mb-1">
                                      Age <span className="text-danger">*</span>
                                      {child.dateOfBirth && (
                                        <span className="badge bg-success-subtle text-success ms-1" style={{ fontSize: "0.6rem" }}>Auto</span>
                                      )}
                                    </label>
                                    <input
                                      type="number"
                                      inputMode="numeric"
                                      min="0"
                                      max="100"
                                      className={`form-control form-control-sm ${child.dateOfBirth ? "bg-white text-muted" : ""}`}
                                      value={child.age}
                                      readOnly={Boolean(child.dateOfBirth)}
                                      title={child.dateOfBirth ? "Calculated from Date of Birth" : "Enter age"}
                                      onChange={(e) => {
                                        if (!child.dateOfBirth) {
                                          updateMemberChild(idx, cIdx, "age", parseInt(e.target.value) || 0);
                                        }
                                      }}
                                      required
                                    />
                                  </div>
                                  <div className="col-6 col-sm-4 col-md-2">
                                    <label className="form-label small fw-semibold text-dark mb-1">Gender</label>
                                    <select
                                      className="form-select form-select-sm"
                                      value={child.gender}
                                      onChange={(e) => updateMemberChild(idx, cIdx, "gender", e.target.value)}
                                    >
                                      <option value="MALE">Male (बालक)</option>
                                      <option value="FEMALE">Female (बालिका)</option>
                                      <option value="OTHER">Other</option>
                                    </select>
                                  </div>
                                  <div className="col-6 col-sm-4 col-md-2">
                                    <label className="form-label small fw-semibold text-dark mb-1">
                                      <i className="bi bi-droplet-half text-danger me-1"></i>
                                      Blood Group
                                    </label>
                                    <select
                                      className="form-select form-select-sm"
                                      value={child.bloodGroup || ""}
                                      onChange={(e) => updateMemberChild(idx, cIdx, "bloodGroup", e.target.value)}
                                    >
                                      <option value="">Select (ऐच्छिक)</option>
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
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
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

          {/* =====================================================================
              SURVEY METADATA: VOLUNTEER & FORM FILLER DETAILS (AT THE LAST BELOW)
              ===================================================================== */}
          <div className="card p-3 p-md-4 border border-2 border-primary-subtle rounded-3 bg-white shadow-sm mt-4">
            <div className="d-flex align-items-center gap-2 mb-3 pb-2 border-bottom">
              <div className="rounded-circle bg-primary-subtle text-primary p-2 fs-5">
                <i className="bi bi-clipboard2-check"></i>
              </div>
              <div>
                <h6 className="fw-bold text-dark mb-0">
                  Survey Submission &amp; Volunteer Details (सर्वेक्षण प्रविष्टि विवरण)
                </h6>
                <small className="text-muted">
                  Record who added this family and which family member provided the information.
                </small>
              </div>
            </div>

            <div className="row g-3">
              {/* Who added this family: Volunteer's Name */}
              <div className="col-12 col-md-6">
                <label htmlFor="family-volunteer-name" className="form-label fw-semibold text-dark">
                  <i className="bi bi-person-badge text-primary me-1"></i>
                  Who Added This Family (Volunteer Name / स्वयंसेवक का नाम) <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  id="family-volunteer-name"
                  className="form-control"
                  placeholder="Enter volunteer name who conducted the survey"
                  value={formData.volunteerName || ""}
                  onChange={(e) => setFormData({ ...formData, volunteerName: e.target.value })}
                  required
                />
                <div className="form-text">Name of the volunteer who surveyed / added this family.</div>
              </div>

              {/* Family member who filled names */}
              <div className="col-12 col-md-6">
                <label htmlFor="family-filled-by" className="form-label fw-semibold text-dark">
                  <i className="bi bi-person-check text-success me-1"></i>
                  Family Member Who Filled / Provided Names (विवरण देने वाले सदस्य का नाम) <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  id="family-filled-by"
                  className="form-control"
                  placeholder="e.g. Ramesh Shah (Self / Son / Daughter)"
                  value={formData.filledByMember || ""}
                  onChange={(e) => setFormData({ ...formData, filledByMember: e.target.value })}
                  required
                />
                <div className="form-text">Name of the family member who filled the form or provided details.</div>
              </div>
            </div>
          </div>
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
            <h6 className="fw-bold text-dark border-bottom pb-2 mb-2">Household &amp; Survey Submission Information</h6>
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
                <span className="text-muted d-block">Head Contact Number:</span>
                <strong>{formData.headWhatsappNumber || formData.mobile || "— (Not provided)"}</strong>
              </div>
              <div className="col-6 col-md-4">
                <span className="text-muted d-block">Head Email:</span>
                <strong>{formData.headEmail}</strong>
              </div>
              <div className="col-6 col-md-4">
                <span className="text-muted d-block">{t.area}:</span>
                <strong>{formData.area}</strong>
              </div>
              {formData.lane && (
                <div className="col-6 col-md-4">
                  <span className="text-muted d-block">{t.lane}:</span>
                  <strong>{formData.lane}</strong>
                </div>
              )}
              {formData.headBloodGroup && (
                <div className="col-6 col-md-4">
                  <span className="text-muted d-block">{t.bloodGroup}:</span>
                  <span className="badge bg-danger-subtle text-danger border border-danger-subtle">
                    🩸 {formData.headBloodGroup}
                  </span>
                </div>
              )}
              {formData.sect && (
                <div className="col-6 col-md-4">
                  <span className="text-muted d-block">{t.sect}:</span>
                  <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                    {getSectLabel(formData.sect, formData.otherSect)}
                  </span>
                </div>
              )}
              <div className="col-6 col-md-4">
                <span className="text-muted d-block">{t.nativePlace}:</span>
                <strong>{formData.nativePlace || "—"}</strong>
              </div>
              <div className="col-6 col-md-4">
                <span className="text-muted d-block">{t.occupation}:</span>
                <strong>{getOccupationLabel(formData.headOccupation, t)}</strong>
              </div>
              <div className="col-6 col-md-4">
                <span className="text-muted d-block">Added by Volunteer:</span>
                <strong className="text-primary">{formData.volunteerName || "—"}</strong>
              </div>
              <div className="col-6 col-md-4">
                <span className="text-muted d-block">Form Filled By (Member):</span>
                <strong className="text-success">{formData.filledByMember || "—"}</strong>
              </div>
              <div className="col-12">
                <span className="text-muted d-block">{t.address}:</span>
                <span>{formData.address}</span>
              </div>
            </div>
          </div>

          <div className="card p-3 border rounded-3 mb-4">
            <h6 className="fw-bold text-dark border-bottom pb-2 mb-2">
              {t.allMembers} ({1 + formData.members.reduce((acc, m) => acc + 1 + (m.children ? m.children.length : 0), 0)} Total)
            </h6>
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>DOB / Age</th>
                    <th>Gender</th>
                    <th>Relationship &amp; Marital Info</th>
                    <th>{t.occupation}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>1</strong></td>
                    <td className="fw-bold">
                      {formData.headName} <span className="badge bg-secondary ms-1">Head</span>
                      {formData.headBloodGroup && (
                        <span className="badge bg-danger-subtle text-danger border border-danger-subtle ms-1">
                          🩸 {formData.headBloodGroup}
                        </span>
                      )}
                      {(formData.headWhatsappNumber || formData.mobile) && (
                        <div className="small text-success fw-normal">
                          <i className="bi bi-whatsapp me-1"></i>{formData.headWhatsappNumber || formData.mobile}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="fw-semibold">{formData.headAge} yrs</span>
                      {formData.headDateOfBirth && (
                        <div className="small text-muted font-monospace">{formData.headDateOfBirth}</div>
                      )}
                    </td>
                    <td>{formData.headGender}</td>
                    <td>Head</td>
                    <td>
                      {formData.headOccupation ? (
                        <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                          {getOccupationLabel(formData.headOccupation, t)}
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                  {formData.members.map((m, idx) => {
                    const isSon = m.relationship === "SON";
                    const isDaughter = m.relationship === "DAUGHTER";
                    const isSister = m.relationship === "SISTER";
                    const isDaughterInLaw = m.relationship === "DAUGHTER_IN_LAW";
                    const isDaughterOrSister = isDaughter || isSister;
                    const isMarried = m.maritalStatus === "MARRIED";

                    return (
                      <React.Fragment key={idx}>
                        <tr>
                          <td>{idx + 2}</td>
                          <td className="fw-semibold">
                            {m.name}
                            {m.bloodGroup && (
                              <span className="badge bg-danger-subtle text-danger border border-danger-subtle ms-1">
                                🩸 {m.bloodGroup}
                              </span>
                            )}
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
                          <td>
                            <div>{m.relationship}</div>
                            {isDaughterInLaw && (
                              <div className="small mt-1">
                                <span className="badge bg-info-subtle text-info border border-info-subtle">
                                  Daughter-in-law (पुत्रवधू)
                                </span>
                              </div>
                            )}
                            {isSon && (
                              <div className="small mt-1">
                                {isMarried ? (
                                  <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                                    Married • Wife: {m.wifeName || "—"}
                                    {m.wifeContact ? ` (${m.wifeContact})` : ""}
                                  </span>
                                ) : (
                                  <span className="badge bg-light text-muted border">Unmarried</span>
                                )}
                              </div>
                            )}
                            {isDaughterOrSister && (
                              <div className="small mt-1">
                                {isMarried ? (
                                  <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                                    Married • Husband: {m.husbandName || "—"}
                                  </span>
                                ) : (
                                  <span className="badge bg-light text-muted border">Unmarried</span>
                                )}
                              </div>
                            )}
                            {(isSon || isDaughter) && m.residenceLocation && (
                              <div className="small text-secondary mt-1">
                                <i className="bi bi-geo-alt text-danger me-1"></i>
                                {m.residenceLocation === "IN_PUNE"
                                  ? "In Pune (पुणे में)"
                                  : m.residenceLocation === "OUT_OF_PUNE"
                                  ? "Outside Pune / India (पुणे के बाहर)"
                                  : "✈️ Foreign / Abroad (विदेश / NRI)"}
                              </div>
                            )}
                          </td>
                          <td>
                            {m.occupation ? (
                              <span className="badge bg-secondary-subtle text-dark border">
                                {getOccupationLabel(m.occupation, t)}
                              </span>
                            ) : "—"}
                          </td>
                        </tr>

                        {/* Grandchildren sub-rows under this married son or daughter */}
                        {m.children && m.children.length > 0 && m.children.map((child, cIdx) => (
                          <tr key={`child-${idx}-${cIdx}`} className="table-light">
                            <td className="text-center text-muted">
                              <i className="bi bi-arrow-return-right"></i>
                            </td>
                            <td className="ps-3 fw-medium">
                              <div className="d-flex align-items-center gap-1 flex-wrap">
                                <span>{child.name}</span>
                                <span className="badge bg-info-subtle text-info border border-info-subtle">
                                  Grandchild (पोता / पोती / नाती)
                                </span>
                                {child.bloodGroup && (
                                  <span className="badge bg-danger-subtle text-danger border border-danger-subtle">
                                    🩸 {child.bloodGroup}
                                  </span>
                                )}
                              </div>
                              <div className="small text-muted mt-1">
                                Child of {m.name} • Auto-mapped to Family Head
                              </div>
                            </td>
                            <td>
                              <span className="fw-semibold">{child.age} yrs</span>
                              <span className="badge bg-warning text-dark ms-1">Child</span>
                              {child.dateOfBirth && (
                                <div className="small text-muted font-monospace">{child.dateOfBirth}</div>
                              )}
                            </td>
                            <td>{child.gender}</td>
                            <td>
                              <span className="badge bg-secondary-subtle text-secondary font-monospace">
                                GRANDCHILD (पोता / पोती)
                              </span>
                            </td>
                            <td>
                              <span className="text-muted small">Student</span>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
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
            <i className="bi bi-arrow-left me-1"></i> {t.back}
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
            {t.next} <i className="bi bi-arrow-right ms-1"></i>
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
                Saving...
              </>
            ) : (
              <>
                <i className="bi bi-check2-circle me-1"></i> {t.submit}
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
