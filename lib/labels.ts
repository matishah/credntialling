import type { CredentialType, EnrollmentStatus, HistoryKind, InvoiceStatus } from "./db/schema";

export const STATUS: Record<EnrollmentStatus, { label: string; tone: string }> = {
  not_started: { label: "Not started", tone: "bg-zinc-100 text-zinc-700 ring-zinc-200" },
  in_process: { label: "In process", tone: "bg-blue-50 text-blue-700 ring-blue-200" },
  waiting: { label: "Waiting on group", tone: "bg-amber-50 text-amber-800 ring-amber-200" },
  participating: { label: "Participating", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  panel_closed: { label: "Panel closed", tone: "bg-rose-50 text-rose-700 ring-rose-200" },
  other_group: { label: "Other group", tone: "bg-violet-50 text-violet-700 ring-violet-200" },
  denied: { label: "Denied", tone: "bg-red-100 text-red-800 ring-red-300" },
  on_hold: { label: "On hold", tone: "bg-orange-50 text-orange-700 ring-orange-200" },
};
export const STATUS_ORDER: EnrollmentStatus[] = [
  "not_started",
  "in_process",
  "waiting",
  "participating",
  "panel_closed",
  "other_group",
  "denied",
  "on_hold",
];
export const OPEN_STATUSES: EnrollmentStatus[] = ["not_started", "in_process", "waiting", "on_hold", "panel_closed"];

export const INVOICE: Record<InvoiceStatus, { label: string; tone: string }> = {
  not_billable: { label: "—", tone: "text-zinc-400" },
  ready: { label: "Ready to invoice", tone: "bg-amber-50 text-amber-800 ring-amber-200" },
  invoiced: { label: "Invoiced", tone: "bg-sky-50 text-sky-700 ring-sky-200" },
  paid: { label: "Paid", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
};

export const CREDENTIAL: Record<CredentialType, string> = {
  state_license: "State license",
  dea: "DEA",
  board_certification: "Board certification",
  malpractice: "Malpractice insurance",
  caqh_attestation: "CAQH attestation",
  cds: "CDS / state controlled substance",
  other: "Other",
};

export const ACTIVITY_KINDS = [
  { value: "call", label: "Called payer" },
  { value: "submitted", label: "Submitted application" },
  { value: "email", label: "Email" },
  { value: "note", label: "Note" },
] as const;

export const HISTORY: Record<HistoryKind, { label: string; institution: string; detail: string }> = {
  education: { label: "Education", institution: "School", detail: "Degree" },
  training: { label: "Residency / fellowship", institution: "Program / hospital", detail: "Type & specialty" },
  affiliation: { label: "Hospital affiliation", institution: "Hospital", detail: "Privileges" },
  work: { label: "Work history", institution: "Employer", detail: "Position" },
};

// Documents a credentialing file is expected to hold. `checklist` items drive the onboarding checklist.
export const PROVIDER_DOCUMENTS = {
  cv: { label: "CV / resume", checklist: true },
  state_license: { label: "State license", checklist: true },
  dea: { label: "DEA certificate", checklist: true },
  cds: { label: "CDS / state controlled substance", checklist: false },
  board_cert: { label: "Board certificate", checklist: false },
  malpractice_coi: { label: "Malpractice certificate (COI)", checklist: true },
  diploma: { label: "Medical / nursing school diploma", checklist: true },
  training_cert: { label: "Residency / fellowship certificate", checklist: false },
  photo_id: { label: "Driver's license / photo ID", checklist: true },
  ecfmg: { label: "ECFMG certificate", checklist: false },
  caqh_attestation: { label: "CAQH attestation", checklist: false },
  signed_release: { label: "Signed release / attestation", checklist: false },
  other: { label: "Other", checklist: false },
} as const;

export const PRACTICE_DOCUMENTS = {
  w9: { label: "W-9", checklist: true },
  irs_letter: { label: "IRS letter (CP-575 / 147C)", checklist: true },
  voided_check: { label: "Voided check / bank letter", checklist: true },
  group_malpractice: { label: "Group malpractice certificate", checklist: false },
  clia: { label: "CLIA certificate", checklist: false },
  business_license: { label: "Business license / articles", checklist: false },
  lease: { label: "Office lease", checklist: false },
  other: { label: "Other", checklist: false },
} as const;

export type ProviderDocCategory = keyof typeof PROVIDER_DOCUMENTS;
export type PracticeDocCategory = keyof typeof PRACTICE_DOCUMENTS;

export function documentLabel(category: string) {
  return (
    (PROVIDER_DOCUMENTS as Record<string, { label: string }>)[category]?.label ??
    (PRACTICE_DOCUMENTS as Record<string, { label: string }>)[category]?.label ??
    category
  );
}

export const DEGREES = ["MD", "DO", "NP", "PA", "DPM", "DDS", "DMD", "OD", "DC", "PhD", "PsyD", "LCSW", "LMHC", "LMFT", "RD", "PT", "OT", "CRNA"];

// Upload rules shared by the browser (file picker) and the server (lib/documents.ts enforces them).
export const MAX_DOCUMENT_MB = 15;
export const DOCUMENT_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.heic,.tif,.tiff,.doc,.docx,.xls,.xlsx,.csv,.txt";
