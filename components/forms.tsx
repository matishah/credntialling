"use client";

import type { ReactNode } from "react";
import { ActionForm, Submit } from "./client";
import { savePractice, saveProvider, saveLogin, saveCredential, savePayer, saveHistory } from "@/app/actions/records";
import { createEnrollment, logActivity, updateEnrollment } from "@/app/actions/enrollments";
import { uploadDocuments } from "@/app/actions/documents";
import {
  ACTIVITY_KINDS,
  CREDENTIAL,
  DEGREES,
  DOCUMENT_ACCEPT,
  HISTORY,
  MAX_DOCUMENT_MB,
  PRACTICE_DOCUMENTS,
  PROVIDER_DOCUMENTS,
  STATUS,
  STATUS_ORDER,
} from "@/lib/labels";
import { addDays, todayISO } from "@/lib/dates";
import type { CredentialType, EnrollmentStatus, HistoryKind } from "@/lib/db/schema";

function F({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

type Opt = { id: string; name: string };

// ---------- practice ----------

export type PracticeDefaults = {
  id?: string;
  name?: string;
  groupNpi?: string | null;
  taxId?: string | null;
  serviceAddress?: string | null;
  billingAddress?: string | null;
  phone?: string | null;
  fax?: string | null;
  email?: string | null;
  clientSheetUrl?: string | null;
  notes?: string | null;
};

export function PracticeForm({ d = {} }: { d?: PracticeDefaults }) {
  return (
    <ActionForm action={savePractice} className="grid gap-3 sm:grid-cols-2">
      {d.id && <input type="hidden" name="id" value={d.id} />}
      <F label="Practice name *" className="sm:col-span-2">
        <input name="name" required defaultValue={d.name} className="input" />
      </F>
      <F label="Group NPI">
        <input name="groupNpi" defaultValue={d.groupNpi ?? ""} className="input font-mono" inputMode="numeric" />
      </F>
      <F label="Tax ID (TIN)">
        <input name="taxId" defaultValue={d.taxId ?? ""} className="input font-mono" />
      </F>
      <F label="Service address" className="sm:col-span-2">
        <input name="serviceAddress" defaultValue={d.serviceAddress ?? ""} className="input" />
      </F>
      <F label="Billing address" className="sm:col-span-2">
        <input name="billingAddress" defaultValue={d.billingAddress ?? ""} className="input" />
      </F>
      <F label="Phone">
        <input name="phone" defaultValue={d.phone ?? ""} className="input" />
      </F>
      <F label="Fax">
        <input name="fax" defaultValue={d.fax ?? ""} className="input" />
      </F>
      <F label="Email">
        <input name="email" type="email" defaultValue={d.email ?? ""} className="input" />
      </F>
      <F label="Client sheet link">
        <input name="clientSheetUrl" type="url" defaultValue={d.clientSheetUrl ?? ""} className="input" />
      </F>
      <F label="Notes" className="sm:col-span-2">
        <textarea name="notes" rows={3} defaultValue={d.notes ?? ""} className="input" />
      </F>
      <div className="sm:col-span-2">
        <Submit>{d.id ? "Save practice" : "Create practice"}</Submit>
      </div>
    </ActionForm>
  );
}

// ---------- provider ----------

export type ProviderDefaults = {
  id?: string;
  name?: string;
  npi?: string | null;
  specialty?: string | null;
  taxonomyCode?: string | null;
  dob?: string | null;
  gender?: string | null;
  email?: string | null;
  phone?: string | null;
  homeAddress?: string | null;
  caqhId?: string | null;
  medicareId?: string | null;
  medicaidId?: string | null;
  boardCertification?: string | null;
  degree?: string | null;
  otherNames?: string | null;
  placeOfBirth?: string | null;
  citizenship?: string | null;
  languages?: string | null;
  pecosId?: string | null;
  notes?: string | null;
};

export function ProviderForm({ d = {}, practiceId, canSeeSensitive }: { d?: ProviderDefaults; practiceId?: string; canSeeSensitive: boolean }) {
  return (
    <ActionForm action={saveProvider} className="grid gap-3 sm:grid-cols-3">
      {d.id && <input type="hidden" name="id" value={d.id} />}
      {practiceId && <input type="hidden" name="practiceId" value={practiceId} />}
      <F label="Full name *" className="sm:col-span-2">
        <input name="name" required defaultValue={d.name} className="input" />
      </F>
      <F label="Degree">
        <input name="degree" list="degrees" defaultValue={d.degree ?? ""} className="input" />
        <datalist id="degrees">
          {DEGREES.map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
      </F>
      <F label="Other names used">
        <input name="otherNames" defaultValue={d.otherNames ?? ""} className="input" />
      </F>
      <F label="Individual NPI">
        <input name="npi" defaultValue={d.npi ?? ""} className="input font-mono" inputMode="numeric" />
      </F>
      <F label="PECOS ID">
        <input name="pecosId" defaultValue={d.pecosId ?? ""} className="input font-mono" />
      </F>
      <F label="Specialty" className="sm:col-span-2">
        <input name="specialty" defaultValue={d.specialty ?? ""} className="input" />
      </F>
      <F label="Taxonomy code">
        <input name="taxonomyCode" defaultValue={d.taxonomyCode ?? ""} className="input font-mono" />
      </F>
      <F label="CAQH ID">
        <input name="caqhId" defaultValue={d.caqhId ?? ""} className="input font-mono" />
      </F>
      <F label="Medicare PTAN">
        <input name="medicareId" defaultValue={d.medicareId ?? ""} className="input font-mono" />
      </F>
      <F label="Medicaid ID">
        <input name="medicaidId" defaultValue={d.medicaidId ?? ""} className="input font-mono" />
      </F>
      {canSeeSensitive && (
        <>
          <F label={d.id ? "SSN (leave blank to keep)" : "SSN"}>
            <input name="ssn" autoComplete="off" className="input font-mono" placeholder="•••-••-••••" />
          </F>
          <F label="Date of birth">
            <input name="dob" type="date" defaultValue={d.dob ?? ""} className="input" />
          </F>
        </>
      )}
      <F label="Gender">
        <input name="gender" defaultValue={d.gender ?? ""} className="input" />
      </F>
      <F label="Email">
        <input name="email" type="email" defaultValue={d.email ?? ""} className="input" />
      </F>
      <F label="Phone">
        <input name="phone" defaultValue={d.phone ?? ""} className="input" />
      </F>
      <F label="Board certification">
        <input name="boardCertification" defaultValue={d.boardCertification ?? ""} className="input" />
      </F>
      <F label="Place of birth">
        <input name="placeOfBirth" defaultValue={d.placeOfBirth ?? ""} className="input" />
      </F>
      <F label="Citizenship">
        <input name="citizenship" defaultValue={d.citizenship ?? ""} className="input" />
      </F>
      <F label="Languages">
        <input name="languages" defaultValue={d.languages ?? ""} className="input" />
      </F>
      {canSeeSensitive && (
        <F label="Home address" className="sm:col-span-3">
          <input name="homeAddress" defaultValue={d.homeAddress ?? ""} className="input" />
        </F>
      )}
      <F label="Notes" className="sm:col-span-3">
        <textarea name="notes" rows={2} defaultValue={d.notes ?? ""} className="input" />
      </F>
      <div className="sm:col-span-3">
        <Submit>{d.id ? "Save provider" : "Add provider"}</Submit>
      </div>
    </ActionForm>
  );
}

// ---------- enrollments ----------

export function NewEnrollmentForm({ practiceId, providers, payers }: { practiceId: string; providers: Opt[]; payers: Opt[] }) {
  return (
    <ActionForm action={createEnrollment} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="practiceId" value={practiceId} />
      <F label="Provider">
        <select name="providerId" className="input min-w-48">
          <option value="">Group (practice-level)</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </F>
      <F label="Payer">
        <select name="payerId" required className="input min-w-48">
          <option value="">Choose…</option>
          {payers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </F>
      <Submit>Start enrollment</Submit>
    </ActionForm>
  );
}

/** The everyday form: what happened + when to check again, in one submit. */
export function LogActivityForm({ enrollmentId, status }: { enrollmentId: string; status: EnrollmentStatus }) {
  const today = todayISO();
  return (
    <ActionForm action={logActivity} resetOnSuccess className="space-y-3">
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <div className="flex flex-wrap gap-2">
        {ACTIVITY_KINDS.map((k, i) => (
          <label key={k.value} className="cursor-pointer">
            <input type="radio" name="kind" value={k.value} defaultChecked={i === 0} className="peer sr-only" />
            <span className="inline-block rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600 peer-checked:border-blue-600 peer-checked:bg-blue-600 peer-checked:text-white">
              {k.label}
            </span>
          </label>
        ))}
      </div>
      <textarea name="note" required rows={3} placeholder="e.g. Spoke to Maria, application under review, call back in 2 weeks" className="input" />
      <div className="grid gap-3 sm:grid-cols-4">
        <F label="Reference #">
          <input name="refNumber" className="input font-mono" placeholder="Call ref / ticket" />
        </F>
        <F label="Date">
          <input name="occurredOn" type="date" defaultValue={today} className="input" />
        </F>
        <F label="Next follow-up">
          <input name="nextFollowUp" type="date" defaultValue={addDays(today, 14)} className="input" />
        </F>
        <F label="Change status">
          <select name="status" defaultValue="" className="input">
            <option value="">Keep: {STATUS[status].label}</option>
            {STATUS_ORDER.filter((s) => s !== status).map((s) => (
              <option key={s} value={s}>
                {STATUS[s].label}
              </option>
            ))}
          </select>
        </F>
      </div>
      <Submit>Save activity</Submit>
    </ActionForm>
  );
}

export function EditEnrollmentForm({
  e,
  users,
}: {
  e: {
    id: string;
    status: EnrollmentStatus;
    statusNote: string | null;
    payerProviderId: string | null;
    effectiveDate: string | null;
    submittedOn: string | null;
    nextFollowUp: string | null;
    assignedToId: string | null;
  };
  users: Opt[];
}) {
  return (
    <ActionForm action={updateEnrollment} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="enrollmentId" value={e.id} />
      <F label="Status">
        <select name="status" defaultValue={e.status} className="input">
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS[s].label}
            </option>
          ))}
        </select>
      </F>
      <F label="Assigned to">
        <select name="assignedToId" defaultValue={e.assignedToId ?? ""} className="input">
          <option value="">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </F>
      <F label="Payer provider ID">
        <input name="payerProviderId" defaultValue={e.payerProviderId ?? ""} className="input font-mono" />
      </F>
      <F label="Effective date">
        <input name="effectiveDate" type="date" defaultValue={e.effectiveDate ?? ""} className="input" />
      </F>
      <F label="Submitted on">
        <input name="submittedOn" type="date" defaultValue={e.submittedOn ?? ""} className="input" />
      </F>
      <F label="Next follow-up">
        <input name="nextFollowUp" type="date" defaultValue={e.nextFollowUp ?? ""} className="input" />
      </F>
      <F label="Status note" className="sm:col-span-2">
        <input name="statusNote" defaultValue={e.statusNote ?? ""} className="input" placeholder="e.g. Panel closed outside NY – recheck 01/2027" />
      </F>
      <div className="sm:col-span-2">
        <Submit>Save details</Submit>
      </div>
    </ActionForm>
  );
}

// ---------- logins & credentials ----------

export function LoginForm({ providerId, practiceId }: { providerId?: string; practiceId?: string }) {
  return (
    <ActionForm action={saveLogin} resetOnSuccess className="grid gap-3 sm:grid-cols-4">
      {providerId && <input type="hidden" name="providerId" value={providerId} />}
      {practiceId && <input type="hidden" name="practiceId" value={practiceId} />}
      <F label="Portal *">
        <input name="portal" required list="portals" className="input" placeholder="CAQH, PECOS, Availity…" />
        <datalist id="portals">
          {["CAQH", "PECOS", "NPPES", "AVAILITY", "OPTUM", "ePACES", "eMedNY", "NAVINET"].map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </F>
      <F label="Username">
        <input name="username" autoComplete="off" className="input" />
      </F>
      <F label="Password">
        <input name="password" type="password" autoComplete="new-password" className="input" />
      </F>
      <F label="URL">
        <input name="url" type="url" className="input" />
      </F>
      <div className="sm:col-span-4">
        <Submit>Save login</Submit>
      </div>
    </ActionForm>
  );
}

export function CredentialForm({ providerId }: { providerId: string }) {
  return (
    <ActionForm action={saveCredential} resetOnSuccess className="grid gap-3 sm:grid-cols-5">
      <input type="hidden" name="providerId" value={providerId} />
      <F label="Type *">
        <select name="type" required className="input">
          {(Object.keys(CREDENTIAL) as CredentialType[]).map((t) => (
            <option key={t} value={t}>
              {CREDENTIAL[t]}
            </option>
          ))}
        </select>
      </F>
      <F label="Number">
        <input name="number" className="input font-mono" />
      </F>
      <F label="State">
        <input name="state" className="input" maxLength={2} placeholder="NY" />
      </F>
      <F label="Issued">
        <input name="issuedOn" type="date" className="input" />
      </F>
      <F label="Expires">
        <input name="expiresOn" type="date" className="input" />
      </F>
      <F label="Board / carrier" className="sm:col-span-3">
        <input name="issuer" className="input" placeholder="e.g. NYS Education Dept, ABIM, MLMIC" />
      </F>
      <F label="Coverage (malpractice)" className="sm:col-span-2">
        <input name="coverage" className="input" placeholder="$1M / $3M" />
      </F>
      <div className="sm:col-span-5">
        <Submit>Add credential</Submit>
      </div>
    </ActionForm>
  );
}

export function HistoryForm({ providerId }: { providerId: string }) {
  return (
    <ActionForm action={saveHistory} resetOnSuccess className="grid gap-3 sm:grid-cols-6">
      <input type="hidden" name="providerId" value={providerId} />
      <F label="Kind *" className="sm:col-span-2">
        <select name="kind" required className="input">
          {(Object.keys(HISTORY) as HistoryKind[]).map((k) => (
            <option key={k} value={k}>
              {HISTORY[k].label}
            </option>
          ))}
        </select>
      </F>
      <F label="School / program / hospital / employer *" className="sm:col-span-4">
        <input name="institution" required className="input" />
      </F>
      <F label="Degree / specialty / privileges / position" className="sm:col-span-2">
        <input name="detail" className="input" />
      </F>
      <F label="City, state" className="sm:col-span-2">
        <input name="location" className="input" />
      </F>
      <F label="From">
        <input name="startDate" type="date" className="input" />
      </F>
      <F label="To">
        <input name="endDate" type="date" className="input" />
      </F>
      <div className="sm:col-span-6">
        <Submit>Add entry</Submit>
      </div>
    </ActionForm>
  );
}

// ---------- documents ----------

export function DocumentUploadForm({ owner, providerId, practiceId }: { owner: "provider" | "practice"; providerId?: string; practiceId?: string }) {
  const catalog: Record<string, { label: string }> = owner === "provider" ? PROVIDER_DOCUMENTS : PRACTICE_DOCUMENTS;
  return (
    <ActionForm action={uploadDocuments} resetOnSuccess className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto]">
      {providerId && <input type="hidden" name="providerId" value={providerId} />}
      {practiceId && <input type="hidden" name="practiceId" value={practiceId} />}
      <F label="Document">
        <select name="doc_category" className="input">
          {Object.entries(catalog).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </F>
      <F label={`File (up to ${MAX_DOCUMENT_MB} MB)`}>
        <input
          name="doc_file"
          type="file"
          required
          accept={DOCUMENT_ACCEPT}
          className="input py-1 text-xs file:mr-2 file:rounded file:border-0 file:bg-zinc-100 file:px-2 file:py-1 file:text-xs file:font-medium"
        />
      </F>
      <F label="Expires">
        <input name="doc_expires" type="date" className="input" />
      </F>
      <div className="sm:col-span-3">
        <Submit>Upload</Submit>
      </div>
    </ActionForm>
  );
}

// ---------- payers ----------

export function PayerForm({
  d = {},
}: {
  d?: { id?: string; name?: string; portalUrl?: string | null; phone?: string | null; turnaroundDays?: number | null; requirements?: string | null; notes?: string | null };
}) {
  return (
    <ActionForm action={savePayer} className="grid gap-3 sm:grid-cols-3">
      {d.id && <input type="hidden" name="id" value={d.id} />}
      <F label="Name *">
        <input name="name" required defaultValue={d.name} className="input" />
      </F>
      <F label="Provider relations phone">
        <input name="phone" defaultValue={d.phone ?? ""} className="input" />
      </F>
      <F label="Typical turnaround (days)">
        <input name="turnaroundDays" type="number" min={0} defaultValue={d.turnaroundDays ?? ""} className="input" />
      </F>
      <F label="Enrollment portal URL" className="sm:col-span-3">
        <input name="portalUrl" type="url" defaultValue={d.portalUrl ?? ""} className="input" />
      </F>
      <F label="Required documents / process" className="sm:col-span-3">
        <textarea name="requirements" rows={2} defaultValue={d.requirements ?? ""} className="input" placeholder="e.g. Request letter + W-9, CAQH must be attested, apply via Availity" />
      </F>
      <F label="Notes (panel status, contacts…)" className="sm:col-span-3">
        <textarea name="notes" rows={2} defaultValue={d.notes ?? ""} className="input" />
      </F>
      <div className="sm:col-span-3">
        <Submit>{d.id ? "Save payer" : "Add payer"}</Submit>
      </div>
    </ActionForm>
  );
}
