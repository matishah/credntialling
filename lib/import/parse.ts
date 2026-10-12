// Parses the department's free-form credentialing workbooks.
//
// Expected shape (per sheet, repeatable):
//   [Practice title row]                      e.g. "Sunrise Family Medicine"
//   Provider Name | x   SSN | x               label/value pairs, any columns
//   NPI | x         CAQH ID | x ...
//   Insurances | Participation | Provider ID | Effective date | Remarks | Follow | Invoice Status
//   Aetna      | Participating | 7003502    | 10/22/2025     | ...
//   [next "Provider Name" row starts another provider block]
//
// Pure module (no DB, no server-only) so it can be unit-tested from scripts.
import * as XLSX from "xlsx";
import type { CredentialType, EnrollmentStatus, InvoiceStatus } from "../db/schema";
import { parsePayerLabel } from "../payers";

export type ParsedLogin = { portal: string; username: string | null; password: string | null };
export type ParsedCredential = {
  type: CredentialType;
  number: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  raw: string;
};
export type ParsedEnrollment = {
  row: number; // 1-based sheet row, for pointing people back to the source
  payerLabel: string;
  payerName: string;
  type: "group" | "individual";
  statusRaw: string;
  status: EnrollmentStatus;
  statusNote: string | null;
  payerProviderId: string | null;
  effectiveDate: string | null;
  remarkDate: string | null;
  remark: string | null;
  nextFollowUp: string | null;
  invoiceStatus: InvoiceStatus;
  warnings: string[];
};
export type ParsedProvider = {
  name: string;
  npi: string | null;
  specialty: string | null;
  taxonomyCode: string | null;
  ssn: string | null;
  dob: string | null;
  gender: string | null;
  email: string | null;
  phone: string | null;
  homeAddress: string | null;
  caqhId: string | null;
  medicareId: string | null;
  medicaidId: string | null;
  boardCertification: string | null;
  logins: ParsedLogin[];
  credentials: ParsedCredential[];
  enrollments: ParsedEnrollment[];
};
export type ParsedPractice = {
  name: string;
  sheet: string;
  groupNpi: string | null;
  taxId: string | null;
  serviceAddress: string | null;
  billingAddress: string | null;
  phone: string | null;
  fax: string | null;
  clientSheetUrl: string | null;
  notes: string[];
  providers: ParsedProvider[];
  groupEnrollments: ParsedEnrollment[];
  warnings: string[];
};
export type ParseResult = { practices: ParsedPractice[]; warnings: string[] };

// ---------- small helpers ----------

type Cell = string | number | boolean | null;
type Grid = Cell[][];

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/adress/g, "address")
    .replace(/licence/g, "license")
    .replace(/[^a-z0-9&]+/g, " ")
    .trim();

function text(v: Cell | undefined): string {
  if (v == null) return "";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
  return String(v).replace(/\s+/g, " ").trim();
}

const iso = (y: number, m: number, d: number) => {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

/** Accepts Excel serials, 10/22/2025, 2/2/26, "07/30/2026.", 2025-10-22. Returns YYYY-MM-DD or null. */
export function parseDate(v: Cell | undefined): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    if (v > 20000 && v < 80000) {
      const d = XLSX.SSF.parse_date_code(v);
      return d ? iso(d.y, d.m, d.d) : null;
    }
    return null;
  }
  const s = String(v);
  let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    let y = +m[3];
    if (m[3].length === 2) y += 2000;
    return iso(y, +m[1], +m[2]);
  }
  return null;
}

/** All dates in a string, in order. */
function allDates(s: string): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(/\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}-\d{1,2}-\d{1,2}/g)) {
    const d = parseDate(m[0]);
    if (d) out.push(d);
  }
  return out;
}

function parseCredential(type: CredentialType, raw: string): ParsedCredential {
  const number = raw.split(/\s+/)[0] || null;
  let expiresOn: string | null = null;
  let issuedOn: string | null = null;
  const exp = raw.match(/exp\w*\.?\s*:?\s*([\d\/\-.]+)/i);
  if (exp) expiresOn = parseDate(exp[1]);
  const dates = allDates(raw);
  if (!expiresOn && dates.length) expiresOn = dates[dates.length - 1];
  if (dates.length > 1) issuedOn = dates.find((d) => d !== expiresOn) ?? null;
  return { type, number: number && /\d/.test(number) ? number : null, issuedOn, expiresOn, raw };
}

export function mapStatus(raw: string): { status: EnrollmentStatus; known: boolean } {
  const t = raw.toLowerCase();
  if (!t.trim()) return { status: "not_started", known: true };
  if (/non[\s-]*par/.test(t)) return { status: "denied", known: true };
  if (/panel\s*closed|closed/.test(t)) return { status: "panel_closed", known: true };
  if (/another group|other group|enrolled with/.test(t)) return { status: "other_group", known: true };
  if (/starts? after|waiting|after group|depends/.test(t)) return { status: "waiting", known: true };
  if (/particip/.test(t)) return { status: "participating", known: true };
  if (/in[\s-]*process|pending|submitted|applied|in progress/.test(t)) return { status: "in_process", known: true };
  if (/den(y|ied)|reject/.test(t)) return { status: "denied", known: true };
  if (/hold/.test(t)) return { status: "on_hold", known: true };
  if (/not started|to do|todo/.test(t)) return { status: "not_started", known: true };
  return { status: "in_process", known: false };
}

// ---------- label dictionary ----------

type Target =
  | "provider.name"
  | "provider.npi"
  | "provider.specialty"
  | "provider.ssn"
  | "provider.dob"
  | "provider.gender"
  | "provider.email"
  | "provider.homeAddress"
  | "provider.caqhId"
  | "provider.boardCertification"
  | "provider.medicareMedicaid"
  | "provider.medicareId"
  | "provider.medicaidId"
  | "phone"
  | "practice.groupNpi"
  | "practice.taxId"
  | "practice.serviceAddress"
  | "practice.billingAddress"
  | "practice.fax"
  | "cred.dea"
  | "cred.state_license"
  | "cred.malpractice"
  | "cred.board_certification"
  | "login";

const LABELS: Record<string, Target> = {
  "provider name": "provider.name",
  "provider": "provider.name",
  "npi": "provider.npi",
  "individual npi": "provider.npi",
  "provider npi": "provider.npi",
  "group npi": "practice.groupNpi",
  "tax id": "practice.taxId",
  "tin": "practice.taxId",
  "ein": "practice.taxId",
  "service address": "practice.serviceAddress",
  "billing address": "practice.billingAddress",
  "speciality": "provider.specialty",
  "specialty": "provider.specialty",
  "taxonomy": "provider.specialty",
  "dob": "provider.dob",
  "date of birth": "provider.dob",
  "home address": "provider.homeAddress",
  "ssn": "provider.ssn",
  "social security": "provider.ssn",
  "caqh id": "provider.caqhId",
  "caqh": "provider.caqhId",
  "phone number": "phone",
  "phone": "phone",
  "fax number": "practice.fax",
  "fax": "practice.fax",
  "dea": "cred.dea",
  "dea number": "cred.dea",
  "state license": "cred.state_license",
  "license": "cred.state_license",
  "medical license": "cred.state_license",
  "malpractice": "cred.malpractice",
  "email": "provider.email",
  "board certification": "provider.boardCertification",
  "gender": "provider.gender",
  "medicare & medicaid": "provider.medicareMedicaid",
  "medicare medicaid": "provider.medicareMedicaid",
  "medicare id": "provider.medicareId",
  "ptan": "provider.medicareId",
  "medicaid id": "provider.medicaidId",
};

function labelTarget(cell: string): { target: Target; portal?: string } | null {
  const n = norm(cell.replace(/:$/, ""));
  if (!n) return null;
  if (LABELS[n]) return { target: LABELS[n] };
  const login = n.match(/^(.+?)\s+(logins?|credentials?|username)$/);
  if (login) return { target: "login", portal: login[1].toUpperCase() };
  return null;
}

const isUrl = (s: string) => /^https?:\/\//i.test(s);

// ---------- sheet parsing ----------

function emptyProvider(): ParsedProvider {
  return {
    name: "",
    npi: null,
    specialty: null,
    taxonomyCode: null,
    ssn: null,
    dob: null,
    gender: null,
    email: null,
    phone: null,
    homeAddress: null,
    caqhId: null,
    medicareId: null,
    medicaidId: null,
    boardCertification: null,
    logins: [],
    credentials: [],
    enrollments: [],
  };
}

function findHeaderRow(grid: Grid, from: number, to: number): number {
  for (let r = from; r < to; r++) {
    if ((grid[r] ?? []).some((c) => /^particip/i.test(text(c)))) return r;
  }
  return -1;
}

function parseTable(grid: Grid, header: number, end: number, warnings: string[]): ParsedEnrollment[] {
  const h = (grid[header] ?? []).map((c) => text(c).toLowerCase());
  const col = (re: RegExp, fallback = -1) => {
    const i = h.findIndex((x) => re.test(x));
    return i === -1 ? fallback : i;
  };
  const cPayer = col(/ur?ance|payer|plan|carrier/, 0);
  const cPart = col(/^particip/);
  const cId = col(/provider\s*id|pin|ptan|\bid\b/);
  const cEff = col(/effective/);
  const cRem = col(/remark|note|comment/);
  const cFol = col(/follow/);
  const cInv = col(/invoice/);
  const today = new Date().toISOString().slice(0, 10);

  const out: ParsedEnrollment[] = [];
  for (let r = header + 1; r < end; r++) {
    const row = grid[r] ?? [];
    const payerLabel = text(row[cPayer]);
    if (!payerLabel || labelTarget(payerLabel)) continue;
    // a row with only a payer cell and nothing else is usually a stray caption ("Ambetter ID:")
    if (/:$/.test(payerLabel)) continue;

    const w: string[] = [];
    const { name, type } = parsePayerLabel(payerLabel);
    const statusRaw = cPart >= 0 ? text(row[cPart]) : "";
    const { status, known } = mapStatus(statusRaw);
    if (!known) w.push(`Unrecognised status "${statusRaw}" – imported as In process`);
    const simple = /^(participating|in[\s-]*process|not started|denied|pending)$/i.test(statusRaw);

    const effRaw = cEff >= 0 ? row[cEff] : null;
    const effectiveDate = parseDate(effRaw ?? null);
    if (text(effRaw ?? null) && !effectiveDate) w.push(`Effective date "${text(effRaw ?? null)}" not understood`);

    const remark = cRem >= 0 ? text(row[cRem]) || null : null;
    const remarkDate = remark ? parseDate(remark.slice(0, 12)) : null;

    const folRaw = cFol >= 0 ? row[cFol] : null;
    let nextFollowUp = parseDate(folRaw ?? null);
    const folText = text(folRaw ?? null);
    if (folText && !nextFollowUp) w.push(`Follow-up "${folText}" is not a date`);
    const open = status === "in_process" || status === "waiting" || status === "not_started";
    let staleFollowUp: string | null = null;
    if ((status === "participating" || status === "denied") && nextFollowUp) {
      // finished enrollments shouldn't sit in the follow-up queue; keep the date in history
      staleFollowUp = nextFollowUp;
      nextFollowUp = null;
    }
    if (open && !nextFollowUp) {
      nextFollowUp = today;
      w.push("No follow-up date – scheduled for today");
    }

    const invRaw = cInv >= 0 ? text(row[cInv]).toLowerCase() : "";
    const invoiceStatus: InvoiceStatus = /paid/.test(invRaw)
      ? "paid"
      : /invoic|billed/.test(invRaw)
        ? "invoiced"
        : status === "participating"
          ? "ready"
          : "not_billable";

    const pid = cId >= 0 ? text(row[cId]) : "";
    out.push({
      row: r + 1,
      payerLabel,
      payerName: name,
      type,
      statusRaw,
      status,
      statusNote: statusRaw && !simple ? statusRaw : null,
      payerProviderId: pid || null,
      effectiveDate,
      remarkDate,
      remark: staleFollowUp ? [remark, `Sheet follow-up date: ${staleFollowUp}`].filter(Boolean).join(" · ") : remark,
      nextFollowUp,
      invoiceStatus,
      warnings: w,
    });
  }
  if (cPart === -1) warnings.push(`Row ${header + 1}: no "Participation" column found`);
  return out;
}

/**
 * Practice title directly above a provider block (blank rows skipped): a row whose only
 * content is one plain text cell. Anything else above means "same practice as before".
 */
function titleAbove(grid: Grid, row: number): string | null {
  for (let r = row - 1; r >= 0; r--) {
    const cells = (grid[r] ?? []).map(text).filter(Boolean);
    if (!cells.length) continue;
    const t = cells[0];
    if (cells.length === 1 && !labelTarget(t) && !isUrl(t) && !/:$/.test(t) && t.length < 80) return t;
    return null;
  }
  return null;
}

function parseSheet(name: string, ws: XLSX.WorkSheet, warnings: string[]): ParsedPractice[] {
  const grid = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: true, defval: null, blankrows: true });
  if (!grid.length) return [];

  const starts: number[] = [];
  grid.forEach((row, r) => {
    if ((row ?? []).some((c) => labelTarget(text(c))?.target === "provider.name")) starts.push(r);
  });
  if (!starts.length) {
    if (findHeaderRow(grid, 0, grid.length) === -1) return []; // nothing that looks like credentialing data
    starts.push(0);
  }

  const practices = new Map<string, ParsedPractice>();
  let currentPractice = name;
  starts.forEach((start, i) => {
    const end = starts[i + 1] ?? grid.length;
    const practiceName = (currentPractice = titleAbove(grid, start) ?? currentPractice);
    let practice = practices.get(practiceName);
    if (!practice) {
      practice = {
        name: practiceName,
        sheet: name,
        groupNpi: null,
        taxId: null,
        serviceAddress: null,
        billingAddress: null,
        phone: null,
        fax: null,
        clientSheetUrl: null,
        notes: [],
        providers: [],
        groupEnrollments: [],
        warnings: [],
      };
      practices.set(practiceName, practice);
    }
    const p = practice;
    const header = findHeaderRow(grid, start, end);
    const infoEnd = header === -1 ? end : header;
    const prov = emptyProvider();
    let phoneSeen = 0;

    for (let r = start; r < infoEnd; r++) {
      const row = grid[r] ?? [];
      const used = new Set<number>();
      for (let c = 0; c < row.length; c++) {
        const cellText = text(row[c]);
        if (!cellText || used.has(c)) continue;
        const lt = labelTarget(cellText);
        if (!lt) continue;
        used.add(c);
        const next = text(row[c + 1]);
        const value = next && !labelTarget(next) ? next : "";
        if (value) used.add(c + 1);
        if (!value) continue;
        const raw = row[c + 1];
        switch (lt.target) {
          case "provider.name": prov.name = value; break;
          case "provider.npi": prov.npi = value.replace(/\D/g, "") || value; break;
          case "provider.specialty": {
            prov.specialty = value;
            prov.taxonomyCode = value.match(/\b\d{3}[A-Z0-9]{6}X\b/i)?.[0].toUpperCase() ?? null;
            break;
          }
          case "provider.ssn": prov.ssn = value; break;
          case "provider.dob": prov.dob = parseDate(raw ?? null); break;
          case "provider.gender": prov.gender = value; break;
          case "provider.email": prov.email = value; break;
          case "provider.homeAddress": prov.homeAddress = value; break;
          case "provider.caqhId": prov.caqhId = value; break;
          case "provider.boardCertification": {
            prov.boardCertification = value;
            if (!/^no$/i.test(value)) prov.credentials.push(parseCredential("board_certification", value));
            break;
          }
          case "provider.medicareMedicaid": {
            const [mc, md] = value.split(/\s*[&,\/]\s*/);
            prov.medicareId = mc || null;
            prov.medicaidId = md || null;
            break;
          }
          case "provider.medicareId": prov.medicareId = value; break;
          case "provider.medicaidId": prov.medicaidId = value; break;
          case "phone":
            if (phoneSeen++ === 0 && !p.phone) p.phone = value;
            else prov.phone = value;
            break;
          case "practice.groupNpi": p.groupNpi = p.groupNpi ?? value.replace(/\D/g, ""); break;
          case "practice.taxId": {
            const tin = value.replace(/\D/g, "");
            if (p.taxId && p.taxId !== tin) p.warnings.push(`Two Tax IDs found (${p.taxId} and ${tin}) – check which is the practice's`);
            else p.taxId = tin;
            break;
          }
          case "practice.serviceAddress": p.serviceAddress = p.serviceAddress ?? value; break;
          case "practice.billingAddress": p.billingAddress = p.billingAddress ?? value; break;
          case "practice.fax": p.fax = p.fax ?? value; break;
          case "cred.dea": prov.credentials.push(parseCredential("dea", value)); break;
          case "cred.state_license": prov.credentials.push(parseCredential("state_license", value)); break;
          case "cred.malpractice": prov.credentials.push(parseCredential("malpractice", value)); break;
          case "cred.board_certification": prov.credentials.push(parseCredential("board_certification", value)); break;
          case "login": {
            const parts = value.split(/\s+/);
            prov.logins.push({
              portal: lt.portal ?? "PORTAL",
              username: parts[0] ?? null,
              password: parts.length > 1 ? parts.slice(1).join(" ") : null,
            });
            break;
          }
        }
      }
      // whatever is left on the row (side notes, links, "TAX ID SUNRISE | 12-3456789")
      for (let c = 0; c < row.length; c++) {
        if (used.has(c)) continue;
        const t = text(row[c]);
        if (!t) continue;
        if (isUrl(t)) {
          p.clientSheetUrl = p.clientSheetUrl ?? t;
          continue;
        }
        if (t === p.name) continue;
        const next = text(row[c + 1]);
        if (next && !used.has(c + 1)) {
          used.add(c + 1);
          if (/^tax\s*id\b/i.test(t) && /\d{9}/.test(next.replace(/\D/g, ""))) {
            const tin = next.replace(/\D/g, "");
            if (p.taxId && p.taxId !== tin)
              p.warnings.push(`Two Tax IDs found: "Tax ID" = ${p.taxId}, "${t}" = ${tin}. Check which is the group's.`);
          }
          p.notes.push(`${t}: ${next}`);
        } else if (!p.notes.includes(t)) p.notes.push(t);
      }
    }

    const enrollments = header === -1 ? [] : parseTable(grid, header, end, p.warnings);
    // link "starts after group credentialing" rows to their group row
    for (const e of enrollments) {
      if (e.type === "group") {
        if (!p.groupEnrollments.some((g) => g.payerName === e.payerName)) p.groupEnrollments.push(e);
      } else {
        prov.enrollments.push(e);
      }
    }

    if (prov.name || prov.npi || prov.enrollments.length) {
      if (!prov.name) {
        prov.name = `Unnamed provider (row ${start + 1})`;
        p.warnings.push(`Provider block at row ${start + 1} has no name`);
      }
      if (prov.npi && !/^\d{10}$/.test(prov.npi)) p.warnings.push(`${prov.name}: NPI "${prov.npi}" is not 10 digits`);
      p.providers.push(prov);
    }
  });

  return [...practices.values()];
}

export function parseWorkbook(data: ArrayBuffer | Buffer): ParseResult {
  const wb = XLSX.read(data, { type: "buffer", cellDates: false });
  const warnings: string[] = [];
  const practices: ParsedPractice[] = [];
  for (const sheetName of wb.SheetNames) {
    const sheetPractices = parseSheet(sheetName, wb.Sheets[sheetName], warnings);
    for (const sp of sheetPractices) {
      // same practice spread over several tabs -> merge
      const existing = practices.find((p) => p.name.toLowerCase() === sp.name.toLowerCase());
      if (existing) {
        existing.providers.push(...sp.providers);
        for (const g of sp.groupEnrollments)
          if (!existing.groupEnrollments.some((x) => x.payerName === g.payerName)) existing.groupEnrollments.push(g);
        existing.notes.push(...sp.notes.filter((n) => !existing.notes.includes(n)));
        existing.warnings.push(...sp.warnings);
        existing.groupNpi ??= sp.groupNpi;
        existing.taxId ??= sp.taxId;
        existing.serviceAddress ??= sp.serviceAddress;
        existing.billingAddress ??= sp.billingAddress;
        existing.phone ??= sp.phone;
        existing.fax ??= sp.fax;
        existing.clientSheetUrl ??= sp.clientSheetUrl;
      } else practices.push(sp);
    }
  }
  if (!practices.length) warnings.push("No credentialing data found. Expected a 'Provider Name' row and a 'Participation' table.");
  return { practices, warnings };
}
