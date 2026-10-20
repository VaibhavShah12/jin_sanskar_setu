export interface InterestOption {
  key: string;
  label: string;
  hindiLabel: string;
}

export const MEMBER_INTERESTS: InterestOption[] = [
  { key: "VIHAR_SEVA", label: "Vihar Seva", hindiLabel: "विहार सेवा" },
  { key: "PATHSHALA", label: "Pathshala", hindiLabel: "पाठशाला" },
  { key: "GAHULI_RANGOLI", label: "Gahuli/Rangoli", hindiLabel: "गहुली / रंगोली" },
  { key: "SHUDDHIKARAN", label: "Shuddhikaran", hindiLabel: "शुद्धीकरण" },
  {
    key: "SUGURU_VAIYYAVACH",
    label: "Suguru Vaiyyavach (Medicines, equipment, etc.)",
    hindiLabel: "सुगुरु वैयावच्च (औषधि, उपकरण आदि)",
  },
];

export function getInterestLabel(key: string): string {
  const match = MEMBER_INTERESTS.find((i) => i.key === key || i.label.toLowerCase() === key.toLowerCase());
  return match ? `${match.label} (${match.hindiLabel})` : key;
}
