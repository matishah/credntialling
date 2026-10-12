"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { Loader2, Plus, X } from "lucide-react";
import { onboardProvider } from "@/app/actions/records";
import {
  CREDENTIAL,
  DEGREES,
  DOCUMENT_ACCEPT,
  HISTORY,
  MAX_DOCUMENT_MB,
  PROVIDER_DOCUMENTS,
  type ProviderDocCategory,
} from "@/lib/labels";
import type { CredentialType, HistoryKind } from "@/lib/db/schema";

type Opt = { id: string; name: string };

const PORTALS = ["CAQH", "PECOS", "NPPES", "AVAILITY", "OPTUM", "ePACES", "eMedNY", "NAVINET"];
const BODY_LIMIT_MB = 60; // matches serverActions.bodySizeLimit in next.config.ts

// Rows start pre-filled with what almost every credentialing file needs; empty rows are ignored on save.
const START_CREDS: CredentialType[] = ["state_license", "dea", "board_certification", "malpractice"];
const START_HISTORY: HistoryKind[] = ["education", "training", "affiliation"];
const START_DOCS = (Object.keys(PROVIDER_DOCUMENTS) as ProviderDocCategory[]).filter((k) => PROVIDER_DOCUMENTS[k].checklist);

let nextKey = 0;
const keyed = <T,>(values: T[]) => values.map((value) => ({ key: nextKey++, value }));

export function OnboardProviderForm({
  practices,
  practiceId,
  canSeeSensitive,
  canEditLogins,
  canUploadDocs,
}: {
  practices: Opt[];
  practiceId?: string;
  canSeeSensitive: boolean;
  canEditLogins: boolean;
  canUploadDocs: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [creds, setCreds] = useState(() => keyed(START_CREDS));
  const [history, setHistory] = useState(() => keyed(START_HISTORY));
  const [logins, setLogins] = useState(() => keyed(["CAQH", "PECOS", "NPPES"]));
  const [docs, setDocs] = useState(() => keyed<string>(START_DOCS));
  const [uploadMb, setUploadMb] = useState(0);

  const measureUploads = () => {
    const files = [...(formRef.current?.querySelectorAll<HTMLInputElement>('input[type="file"]') ?? [])].flatMap((i) => [...(i.files ?? [])]);
    setUploadMb(files.reduce((n, f) => n + f.size, 0) / 1024 / 1024);
  };

  return (
    <form
      ref={formRef}
      // Submitted by hand so a server-side error doesn't wipe a half-filled form (React resets forms after an action).
      onSubmit={(e) => {
        e.preventDefault();
        if (uploadMb > BODY_LIMIT_MB) {
          setError(`Files add up to ${uploadMb.toFixed(0)} MB. Upload at most ${BODY_LIMIT_MB} MB here and add the rest from the provider page.`);
          return;
        }
        const fd = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          const res = await onboardProvider(null, fd);
          if (res?.error) setError(res.error);
        });
      }}
      className="space-y-6 pb-24"
    >
      <Section n={1} title="Practice and basics">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <F label="Practice *" className="sm:col-span-2">
            <select name="practiceId" required defaultValue={practiceId ?? ""} className="input">
              <option value="" disabled>
                Choose the practice they&apos;re joining…
              </option>
              {practices.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </F>
          <F label="Full legal name *" className="sm:col-span-2">
            <input name="name" required className="input" placeholder="e.g. Anita R. Patel" />
          </F>
          <F label="Degree">
            <input name="degree" list="degrees" className="input" placeholder="MD, DO, NP…" />
            <datalist id="degrees">
              {DEGREES.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </F>
          <F label="Other names used" hint="Maiden or previous names">
            <input name="otherNames" className="input" />
          </F>
          <F label="Specialty" className="sm:col-span-2">
            <input name="specialty" className="input" placeholder="e.g. Internal Medicine" />
          </F>
          <F label="Individual NPI">
            <input name="npi" inputMode="numeric" pattern="\d{10}" title="10 digits" className="input font-mono" />
          </F>
          <F label="Taxonomy code">
            <input name="taxonomyCode" className="input font-mono" placeholder="207R00000X" />
          </F>
          <F label="Gender">
            <input name="gender" className="input" />
          </F>
          <F label="Languages spoken">
            <input name="languages" className="input" placeholder="English, Spanish" />
          </F>
        </div>
      </Section>

      <Section n={2} title="Personal details" note={canSeeSensitive ? "SSN is encrypted when saved and hidden on screen afterwards." : undefined}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {canSeeSensitive ? (
            <>
              <F label="SSN">
                <input name="ssn" autoComplete="off" className="input font-mono" placeholder="•••-••-••••" />
              </F>
              <F label="Date of birth">
                <input name="dob" type="date" className="input" />
              </F>
            </>
          ) : (
            <p className="text-sm text-zinc-500 sm:col-span-2">Your role can&apos;t enter SSN or date of birth. A manager can add them later.</p>
          )}
          <F label="Place of birth">
            <input name="placeOfBirth" className="input" placeholder="City, state / country" />
          </F>
          <F label="Citizenship">
            <input name="citizenship" className="input" placeholder="US citizen, green card…" />
          </F>
          <F label="Email">
            <input name="email" type="email" className="input" />
          </F>
          <F label="Phone">
            <input name="phone" type="tel" className="input" />
          </F>
          {canSeeSensitive && (
            <F label="Home address" className="sm:col-span-2">
              <input name="homeAddress" className="input" />
            </F>
          )}
        </div>
      </Section>

      <Section n={3} title="Enrollment IDs">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <F label="CAQH ID">
            <input name="caqhId" className="input font-mono" />
          </F>
          <F label="PECOS ID" hint="Medicare enrollment I-number">
            <input name="pecosId" className="input font-mono" />
          </F>
          <F label="Medicare PTAN">
            <input name="medicareId" className="input font-mono" />
          </F>
          <F label="Medicaid ID">
            <input name="medicaidId" className="input font-mono" />
          </F>
        </div>
      </Section>

      <Section n={4} title="Licenses, DEA, board certification & malpractice" note="Leave a row blank to skip it. Expiry dates feed the Today page.">
        <Rows header={["Type", "Number / policy #", "State", "Board / carrier", "Coverage", "Issued", "Expires"]} cols="sm:grid-cols-[1.3fr_1fr_.5fr_1.2fr_1fr_1fr_1fr_auto]">
          {creds.map((row) => (
            <Row key={row.key} cols="sm:grid-cols-[1.3fr_1fr_.5fr_1.2fr_1fr_1fr_1fr_auto]" onRemove={() => setCreds((r) => r.filter((x) => x.key !== row.key))}>
              <select name="cred_type" defaultValue={row.value} aria-label="Type" className="input">
                {(Object.keys(CREDENTIAL) as CredentialType[]).map((t) => (
                  <option key={t} value={t}>
                    {CREDENTIAL[t]}
                  </option>
                ))}
              </select>
              <input name="cred_number" aria-label="Number" className="input font-mono" />
              <input name="cred_state" aria-label="State" maxLength={2} placeholder="NY" className="input uppercase" />
              <input name="cred_issuer" aria-label="Board or carrier" className="input" placeholder={row.value === "malpractice" ? "e.g. MLMIC" : ""} />
              <input name="cred_coverage" aria-label="Coverage" className="input" placeholder={row.value === "malpractice" ? "$1M / $3M" : ""} />
              <input name="cred_issued" type="date" aria-label="Issued" className="input" />
              <input name="cred_expires" type="date" aria-label="Expires" className="input" />
            </Row>
          ))}
        </Rows>
        <AddRow onClick={() => setCreds((r) => [...r, ...keyed<CredentialType>(["state_license"])])}>Add license or certificate</AddRow>
      </Section>

      <Section n={5} title="Education, training & hospital affiliations">
        <Rows header={["Kind", "School / program / hospital", "Degree / specialty / privileges", "City, state", "From", "To"]} cols="sm:grid-cols-[1.2fr_1.6fr_1.4fr_1fr_1fr_1fr_auto]">
          {history.map((row) => (
            <Row key={row.key} cols="sm:grid-cols-[1.2fr_1.6fr_1.4fr_1fr_1fr_1fr_auto]" onRemove={() => setHistory((r) => r.filter((x) => x.key !== row.key))}>
              <select name="hist_kind" defaultValue={row.value} aria-label="Kind" className="input">
                {(Object.keys(HISTORY) as HistoryKind[]).map((k) => (
                  <option key={k} value={k}>
                    {HISTORY[k].label}
                  </option>
                ))}
              </select>
              <input name="hist_institution" aria-label="Institution" className="input" placeholder={HISTORY[row.value].institution} />
              <input name="hist_detail" aria-label="Detail" className="input" placeholder={HISTORY[row.value].detail} />
              <input name="hist_location" aria-label="Location" className="input" />
              <input name="hist_start" type="date" aria-label="From" className="input" />
              <input name="hist_end" type="date" aria-label="To" className="input" />
            </Row>
          ))}
        </Rows>
        <AddRow onClick={() => setHistory((r) => [...r, ...keyed<HistoryKind>(["work"])])}>Add entry</AddRow>
      </Section>

      {canEditLogins && (
        <Section n={6} title="Portal logins" note="Passwords are encrypted. Revealing one later is recorded in the audit log.">
          <Rows header={["Portal", "Username", "Password", "Login URL"]} cols="sm:grid-cols-[1fr_1.2fr_1.2fr_1.6fr_auto]">
            {logins.map((row) => (
              <Row key={row.key} cols="sm:grid-cols-[1fr_1.2fr_1.2fr_1.6fr_auto]" onRemove={() => setLogins((r) => r.filter((x) => x.key !== row.key))}>
                <input name="login_portal" list="portals" defaultValue={row.value} aria-label="Portal" className="input" />
                <input name="login_username" autoComplete="off" aria-label="Username" className="input font-mono" />
                <input name="login_password" type="password" autoComplete="new-password" aria-label="Password" className="input" />
                <input name="login_url" type="url" aria-label="Login URL" className="input" placeholder="https://…" />
              </Row>
            ))}
          </Rows>
          <datalist id="portals">
            {PORTALS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          <AddRow onClick={() => setLogins((r) => [...r, ...keyed([""])])}>Add login</AddRow>
        </Section>
      )}

      {canUploadDocs && (
        <Section
          n={7}
          title="Documents"
          note={`PDF, image, Word or Excel, up to ${MAX_DOCUMENT_MB} MB each. Files are encrypted when stored.`}
        >
          <Rows header={["Document", "File", "Expires (if any)"]} cols="sm:grid-cols-[1.4fr_2fr_1fr_auto]">
            {docs.map((row) => (
              <Row key={row.key} cols="sm:grid-cols-[1.4fr_2fr_1fr_auto]" onRemove={() => setDocs((r) => r.filter((x) => x.key !== row.key))}>
                <select name="doc_category" defaultValue={row.value} aria-label="Document" className="input">
                  {(Object.keys(PROVIDER_DOCUMENTS) as ProviderDocCategory[]).map((k) => (
                    <option key={k} value={k}>
                      {PROVIDER_DOCUMENTS[k].label}
                    </option>
                  ))}
                </select>
                <input
                  name="doc_file"
                  type="file"
                  accept={DOCUMENT_ACCEPT}
                  aria-label="File"
                  onChange={measureUploads}
                  className="input py-1 text-xs file:mr-2 file:rounded file:border-0 file:bg-zinc-100 file:px-2 file:py-1 file:text-xs file:font-medium"
                />
                <input name="doc_expires" type="date" aria-label="Expires" className="input" />
              </Row>
            ))}
          </Rows>
          <AddRow onClick={() => setDocs((r) => [...r, ...keyed(["other"])])}>Add document</AddRow>
        </Section>
      )}

      <Section n={canUploadDocs ? 8 : canEditLogins ? 7 : 6} title="Notes">
        <textarea name="notes" rows={3} className="input" placeholder="Anything the team should know: start date, preferred contact, special instructions…" />
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 backdrop-blur md:left-56">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-end gap-3 px-4 py-3 md:px-6">
          {error && <p className="mr-auto text-sm text-red-600">{error}</p>}
          {uploadMb > 0 && !error && <p className="mr-auto text-xs text-zinc-500">{uploadMb.toFixed(1)} MB of files attached</p>}
          <Link href="/providers" className="btn-ghost">
            Cancel
          </Link>
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Save provider
          </button>
        </div>
      </div>
    </form>
  );
}

function Section({ n, title, note, children }: { n: number; title: string; note?: string; children: ReactNode }) {
  return (
    <section className="card">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-zinc-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-900">
          <span className="mr-2 text-zinc-400 tabular-nums">{n}.</span>
          {title}
        </h2>
        {note && <p className="text-xs text-zinc-500">{note}</p>}
      </header>
      <div className="space-y-3 p-4">{children}</div>
    </section>
  );
}

function F({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">
        {label}
        {hint && <span className="ml-1 font-normal text-zinc-400">· {hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Rows({ header, cols, children }: { header: string[]; cols: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className={`hidden gap-2 sm:grid ${cols}`}>
        {header.map((h) => (
          <span key={h} className="label mb-0">
            {h}
          </span>
        ))}
      </div>
      {children}
    </div>
  );
}

function Row({ cols, onRemove, children }: { cols: string; onRemove: () => void; children: ReactNode }) {
  return (
    <div className={`grid gap-2 rounded-md border border-zinc-100 p-2 sm:rounded-none sm:border-0 sm:p-0 ${cols}`}>
      {children}
      <button type="button" onClick={onRemove} title="Remove row" className="btn-ghost justify-self-end p-1.5">
        <X className="size-4" />
      </button>
    </div>
  );
}

function AddRow({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="btn-ghost px-2 py-1 text-xs">
      <Plus className="size-3.5" /> {children}
    </button>
  );
}
