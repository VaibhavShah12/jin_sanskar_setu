export interface InterestOption {
  key: string;
  label: string;
  hindiLabel: string;
  categoryId: string;
  minAge?: number;
}

export interface InterestCategory {
  id: string;
  title: string;
  hindiTitle: string;
  icon: string;
  accentClass: string;
  options: InterestOption[];
}

export const INTEREST_CATEGORIES: InterestCategory[] = [
  {
    id: "GURU_BHAGWANT_VINANTI",
    title: "Vinanti to Guru Bhagwant",
    hindiTitle: "गुरु भगवंत विनंती / विहरण आमंत्रण",
    icon: "bi-flower1",
    accentClass: "border-warning bg-warning-subtle text-warning-emphasis",
    options: [
      {
        key: "VINANTI_PUNE",
        label: "Pune",
        hindiLabel: "पुणे",
        categoryId: "GURU_BHAGWANT_VINANTI",
        minAge: 16,
      },
      {
        key: "VINANTI_NEAR_PUNE",
        label: "Near Pune",
        hindiLabel: "पुणे के निकट",
        categoryId: "GURU_BHAGWANT_VINANTI",
        minAge: 16,
      },
      {
        key: "VINANTI_OUTSTATION",
        label: "Out Station",
        hindiLabel: "पुणे के बाहर / अन्य शहर",
        categoryId: "GURU_BHAGWANT_VINANTI",
        minAge: 16,
      },
    ],
  },
  {
    id: "VAIYAVACH",
    title: "Vaiyavach Seva",
    hindiTitle: "वैयावच्च / संत सेवा",
    icon: "bi-heart-pulse-fill",
    accentClass: "border-danger bg-danger-subtle text-danger-emphasis",
    options: [
      {
        key: "VAIYAVACH_GOCHARI",
        label: "Gochari Batana",
        hindiLabel: "गोचरी बताना / वहराना",
        categoryId: "VAIYAVACH",
        minAge: 14,
      },
      {
        key: "VAIYAVACH_VIHAR",
        label: "Vihar Seva",
        hindiLabel: "विहार सेवा (साथ चलना / व्यवस्था)",
        categoryId: "VAIYAVACH",
        minAge: 14,
      },
      {
        key: "VAIYAVACH_HOSPITAL",
        label: "Hospital Aadi Jaana",
        hindiLabel: "हॉस्पिटल आदि ले जाना / चिकित्सा सेवा",
        categoryId: "VAIYAVACH",
        minAge: 18,
      },
      {
        key: "SUGURU_VAIYYAVACH",
        label: "Medicine & Equipment",
        hindiLabel: "औषधि, उपकरण आदि वैयावच्च",
        categoryId: "VAIYAVACH",
        minAge: 16,
      },
    ],
  },
  {
    id: "MANAGEMENT_VYAVASTHA",
    title: "Management & Seva",
    hindiTitle: "व्यवस्था एवं अनुकंपा सेवा",
    icon: "bi-people-fill",
    accentClass: "border-primary bg-primary-subtle text-primary-emphasis",
    options: [
      {
        key: "MANAGEMENT_PIROSNA",
        label: "Pirosna",
        hindiLabel: "पिरोसना / भोजनशाला सेवा",
        categoryId: "MANAGEMENT_VYAVASTHA",
        minAge: 12,
      },
      {
        key: "MANAGEMENT_DHAANYA",
        label: "Dhaanya Chaanna",
        hindiLabel: "धान्य छानना / अन्न शुद्धि",
        categoryId: "MANAGEMENT_VYAVASTHA",
        minAge: 12,
      },
      {
        key: "MANAGEMENT_VARGHODA",
        label: "Varghode me Help",
        hindiLabel: "वरघोड़ा / शोभायात्रा व्यवस्था",
        categoryId: "MANAGEMENT_VYAVASTHA",
        minAge: 14,
      },
      {
        key: "MANAGEMENT_ANUKAMPA",
        label: "Food Eating Anukampa",
        hindiLabel: "साधर्मिक भोजन / अनुकंपा सेवा",
        categoryId: "MANAGEMENT_VYAVASTHA",
        minAge: 14,
      },
      {
        key: "GAHULI_RANGOLI",
        label: "Gahuli / Rangoli",
        hindiLabel: "गहुली / रंगोली",
        categoryId: "MANAGEMENT_VYAVASTHA",
      },
      {
        key: "SHUDDHIKARAN",
        label: "Shuddhikaran",
        hindiLabel: "शुद्धीकरण",
        categoryId: "MANAGEMENT_VYAVASTHA",
      },
    ],
  },
  {
    id: "PATHSHALA_SWADHYAY",
    title: "Pathshala & Swadhyay",
    hindiTitle: "पाठशाला एवं स्वाध्याय",
    icon: "bi-book-half",
    accentClass: "border-success bg-success-subtle text-success-emphasis",
    options: [
      {
        key: "PATHSHALA_TEACHER",
        label: "Pathshala Teacher (Teaching)",
        hindiLabel: "पाठशाला शिक्षक (पढ़ाने में रुचि)",
        categoryId: "PATHSHALA_SWADHYAY",
        minAge: 16,
      },
      {
        key: "PATHSHALA_STUDENT",
        label: "Pathshala Interested (Student)",
        hindiLabel: "पाठशाला छात्र (सीखने में रुचि)",
        categoryId: "PATHSHALA_SWADHYAY",
      },
      {
        key: "GROUP_SWADHYAY",
        label: "Group Swadhyay",
        hindiLabel: "ग्रुप स्वाध्याय / तत्व चर्चा",
        categoryId: "PATHSHALA_SWADHYAY",
        minAge: 18,
      },
    ],
  },
];

// Flat list of all options across all categories
export const MEMBER_INTERESTS: InterestOption[] = INTEREST_CATEGORIES.flatMap(
  (cat) => cat.options
);

// Backward-compatibility lookup helper
export function getInterestLabel(key: string): string {
  // Check direct flat list
  const match = MEMBER_INTERESTS.find(
    (i) => i.key === key || i.label.toLowerCase() === key.toLowerCase()
  );
  if (match) {
    return `${match.label} (${match.hindiLabel})`;
  }

  // Handle legacy keys
  if (key === "VIHAR_SEVA") return "Vihar Seva (विहार सेवा)";
  if (key === "PATHSHALA") return "Pathshala (पाठशाला)";

  return key;
}
