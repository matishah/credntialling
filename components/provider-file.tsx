// Cards that make up a provider's credentialing file: documents, background, and what's still missing.
import { CheckCircle2, Circle, FileText, Trash2 } from "lucide-react";
import { deleteDocument } from "@/app/actions/documents";
import { deleteHistory } from "@/app/actions/records";
import { documentLabel, HISTORY, PRACTICE_DOCUMENTS, PROVIDER_DOCUMENTS } from "@/lib/labels";
import { fmtDate } from "@/lib/dates";
import type { DocumentRow } from "@/lib/queries";
import type { CredentialType, HistoryKind } from "@/lib/db/schema";
import { ActionButton, Disclosure } from "./client";
import { DocumentUploadForm, HistoryForm } from "./forms";
import { Card, Empty, Expiry } from "./ui";

const fmtSize = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

export function DocumentsCard({
  docs,
  owner,
  providerId,
  practiceId,
  canView,
  canManage,
}: {
  docs: DocumentRow[];
  owner: "provider" | "practice";
  providerId?: string;
  practiceId?: string;
  canView: boolean;
  canManage: boolean;
}) {
  return (
    <Card title={`Documents (${docs.length})`}>
      {docs.length ? (
        <ul className="scroll-area divide-y divide-zinc-100">
          {docs.map((d) => (
            <li key={d.id} className="flex items-start gap-2 px-4 py-2.5">
              <FileText className="mt-0.5 size-4 shrink-0 text-zinc-400" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{documentLabel(d.category)}</div>
                {canView ? (
                  <a href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer" className="block truncate text-xs text-blue-700 hover:underline" title={d.fileName}>
                    {d.fileName}
                  </a>
                ) : (
                  <div className="truncate text-xs text-zinc-500" title={d.fileName}>
                    {d.fileName}
                  </div>
                )}
                <div className="text-[11px] text-zinc-400">
                  {fmtSize(d.size)} · {fmtDate(d.createdAt.toISOString())}
                  {d.uploadedBy && ` · ${d.uploadedBy}`}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1 text-xs">
                {d.expiresOn && <Expiry date={d.expiresOn} />}
                {canManage && (
                  <ActionButton className="btn-ghost p-1" confirm={`Delete ${d.fileName}?`} run={deleteDocument.bind(null, d.id)} title="Delete">
                    <Trash2 className="size-3.5" />
                  </ActionButton>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No documents uploaded yet.</Empty>
      )}
      {canManage && (
        <div className="border-t border-zinc-100 px-4 py-3">
          <Disclosure label="Upload document" className="btn-ghost px-2 py-1 text-xs">
            <DocumentUploadForm owner={owner} providerId={providerId} practiceId={practiceId} />
          </Disclosure>
        </div>
      )}
      {docs.length > 0 && (
        <p className="border-t border-zinc-100 px-4 py-2 text-[11px] text-zinc-400">
          Files are encrypted. Each open is recorded in the audit log{canView ? "" : "; your role can't open them"}.
        </p>
      )}
    </Card>
  );
}

type History = { id: string; kind: HistoryKind; institution: string; detail: string | null; location: string | null; startDate: string | null; endDate: string | null };

export function HistoryCard({ items, providerId, canEdit }: { items: History[]; providerId: string; canEdit: boolean }) {
  const year = (d: string | null) => (d ? d.slice(0, 4) : null);
  return (
    <Card title={`Education, training & affiliations (${items.length})`}>
      {items.length ? (
        <ul className="scroll-area divide-y divide-zinc-100">
          {items.map((h) => (
            <li key={h.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <div className="text-[11px] font-medium tracking-wide text-zinc-400 uppercase">{HISTORY[h.kind].label}</div>
                <div className="text-sm font-medium">{h.institution}</div>
                <div className="text-xs text-zinc-500">{[h.detail, h.location].filter(Boolean).join(" · ")}</div>
              </div>
              <div className="flex shrink-0 items-center gap-1 text-xs text-zinc-500 tabular-nums">
                {(h.startDate || h.endDate) && (
                  <span>
                    {year(h.startDate) ?? "?"}–{year(h.endDate) ?? "present"}
                  </span>
                )}
                {canEdit && (
                  <ActionButton className="btn-ghost p-1" confirm="Delete this entry?" run={deleteHistory.bind(null, h.id)} title="Delete">
                    <Trash2 className="size-3.5" />
                  </ActionButton>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No education or affiliations recorded.</Empty>
      )}
      {canEdit && (
        <div className="border-t border-zinc-100 px-4 py-3">
          <Disclosure label="Add education / training / affiliation" className="btn-ghost px-2 py-1 text-xs">
            <HistoryForm providerId={providerId} />
          </Disclosure>
        </div>
      )}
    </Card>
  );
}

type ChecklistInput = {
  provider: { npi: string | null; caqhId: string | null; hasSsn: boolean; dob: string | null; specialty: string | null };
  credentials: { type: CredentialType }[];
  history: { kind: HistoryKind }[];
  logins: { portal: string }[];
  documents: { category: string }[];
};

/** What a complete credentialing file holds; "if applicable" items never count as missing. */
export function OnboardingChecklist({ provider, credentials, history, logins, documents }: ChecklistInput) {
  const hasCred = (t: CredentialType) => credentials.some((c) => c.type === t);
  const hasDoc = (c: string) => documents.some((d) => d.category === c);
  const items: { label: string; done: boolean; optional?: boolean }[] = [
    { label: "Individual NPI", done: !!provider.npi },
    { label: "SSN & date of birth", done: provider.hasSsn && !!provider.dob },
    { label: "CAQH ID", done: !!provider.caqhId },
    { label: "CAQH login", done: logins.some((l) => l.portal === "CAQH") },
    { label: "State license", done: hasCred("state_license") },
    { label: "Malpractice insurance", done: hasCred("malpractice") },
    { label: "DEA registration", done: hasCred("dea"), optional: true },
    { label: "Board certification", done: hasCred("board_certification"), optional: true },
    { label: "Education", done: history.some((h) => h.kind === "education") },
    ...Object.entries(PROVIDER_DOCUMENTS)
      .filter(([, v]) => v.checklist)
      .map(([k, v]) => ({ label: `${v.label} on file`, done: hasDoc(k), optional: k === "dea" })),
  ];
  const required = items.filter((i) => !i.optional);
  const done = required.filter((i) => i.done).length;
  const pct = Math.round((done / required.length) * 100);

  return (
    <Card title="Onboarding checklist" actions={<span className={`text-xs font-medium tabular-nums ${done === required.length ? "text-emerald-700" : "text-amber-700"}`}>{done}/{required.length}</span>}>
      <div className="px-4 pt-3">
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
          <div className={`h-full rounded-full ${pct === 100 ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <ul className="grid gap-1 px-4 py-3 text-sm">
        {items.map((i) => (
          <li key={i.label} className="flex items-center gap-2">
            {i.done ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600" /> : <Circle className={`size-4 shrink-0 ${i.optional ? "text-zinc-300" : "text-amber-500"}`} />}
            <span className={i.done ? "text-zinc-500" : "text-zinc-800"}>
              {i.label}
              {i.optional && !i.done && <span className="text-xs text-zinc-400"> · if applicable</span>}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Practice-level equivalent: the group documents payers ask for. */
export function practiceDocsMissing(documents: { category: string }[]) {
  return Object.entries(PRACTICE_DOCUMENTS)
    .filter(([k, v]) => v.checklist && !documents.some((d) => d.category === k))
    .map(([, v]) => v.label);
}
