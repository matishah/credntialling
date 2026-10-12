"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { previewImport, runImport, type PreviewResponse } from "@/app/actions/import";
import type { ImportSummary } from "@/lib/import/commit";
import type { ParsedPractice } from "@/lib/import/parse";
import { Card, StatusPill } from "@/components/ui";

type Preview = Extract<PreviewResponse, { ok: true }>;

export function ImportWizard() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const formData = () => {
    const fd = new FormData();
    if (file) fd.set("file", file);
    return fd;
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setSummary(null);
    setError(null);
  };

  const onPreview = () =>
    start(async () => {
      setError(null);
      const res = await previewImport(formData());
      if (res.ok) setPreview(res);
      else setError(res.error);
    });

  // Re-sends the original file; the server re-parses it so unmasked data never comes back to the browser.
  const onCommit = () =>
    start(async () => {
      setError(null);
      const res = await runImport(formData());
      if (res.ok) setSummary(res.summary);
      else setError(res.error);
    });

  if (summary) return <Done summary={summary} onAgain={reset} />;

  return (
    <div className="space-y-4">
      <Card title="1. Choose a file">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <label className="btn-secondary cursor-pointer">
            <FileSpreadsheet className="size-4" />
            {file ? "Change file" : "Choose spreadsheet"}
            <input
              type="file"
              accept=".xlsx,.xlsm,.xls,.csv"
              className="sr-only"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview(null);
                setError(null);
              }}
            />
          </label>
          <span className="text-sm text-zinc-600">{file ? file.name : "Excel (.xlsx, .xls) or .csv, up to 8 MB"}</span>
          <button type="button" className="btn-primary ml-auto" disabled={!file || pending} onClick={onPreview}>
            {pending && !preview ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Preview
          </button>
        </div>
        {error && (
          <div className="mx-4 mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200 ring-inset">{error}</div>
        )}
      </Card>

      {preview && <PreviewPanel preview={preview} pending={pending} onCommit={onCommit} onCancel={reset} />}
    </div>
  );
}

function PreviewPanel({
  preview,
  pending,
  onCommit,
  onCancel,
}: {
  preview: Preview;
  pending: boolean;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const { practices, warnings } = preview.preview;
  const providerCount = practices.reduce((n, p) => n + p.providers.length, 0);
  const enrollmentCount = practices.reduce(
    (n, p) => n + p.groupEnrollments.length + p.providers.reduce((m, pr) => m + pr.enrollments.length, 0),
    0,
  );
  const allWarnings = [...warnings, ...practices.flatMap((p) => p.warnings.map((w) => `${p.name}: ${w}`))];
  const empty = practices.length === 0;

  return (
    <Card
      title={`2. Review ${preview.fileName}`}
      actions={
        <div className="flex items-center gap-2">
          <button type="button" className="btn-ghost" disabled={pending} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={pending || empty || !!preview.alreadyImported}
            onClick={onCommit}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Import
          </button>
        </div>
      }
    >
      <div className="space-y-4 p-4">
        <p className="text-sm text-zinc-700">
          Found <b>{practices.length}</b> practices, <b>{providerCount}</b> providers and <b>{enrollmentCount}</b> enrollments.
          Existing records are matched and only empty fields are filled in.
        </p>

        {preview.alreadyImported && (
          <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200 ring-inset">
            This exact file was already imported on {preview.alreadyImported}.
          </div>
        )}
        {empty && <div className="text-sm text-zinc-500">Nothing importable was found in this file.</div>}

        {allWarnings.length > 0 && (
          <details className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200 ring-inset">
            <summary className="flex cursor-pointer items-center gap-1.5 font-medium">
              <AlertTriangle className="size-4" />
              {allWarnings.length} warning{allWarnings.length === 1 ? "" : "s"}
            </summary>
            <ul className="mt-2 list-disc space-y-0.5 pl-5">
              {allWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </details>
        )}

        {practices.map((p) => (
          <PracticePreview key={`${p.sheet}:${p.name}`} practice={p} />
        ))}
      </div>
    </Card>
  );
}

function PracticePreview({ practice: p }: { practice: ParsedPractice }) {
  const rows = [
    ...p.groupEnrollments.map((e) => ({ provider: "Group", e })),
    ...p.providers.flatMap((pr) => pr.enrollments.map((e) => ({ provider: pr.name, e }))),
  ];
  return (
    <details className="rounded-md border border-zinc-200">
      <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2">
        <span className="font-medium text-zinc-900">{p.name}</span>
        <span className="text-xs text-zinc-500">
          sheet “{p.sheet}” · {p.providers.length} providers · {rows.length} enrollments
          {p.groupNpi && ` · NPI ${p.groupNpi}`}
        </span>
      </summary>
      {p.providers.length > 0 && (
        <div className="border-t border-zinc-100 px-3 py-2 text-xs text-zinc-600">
          {p.providers.map((pr) => (
            <span key={pr.name} className="mr-3 inline-block">
              {pr.name}
              {pr.npi && <span className="text-zinc-400"> · {pr.npi}</span>}
              {pr.ssn && <span className="text-zinc-400"> · SSN {pr.ssn}</span>}
            </span>
          ))}
        </div>
      )}
      {rows.length > 0 && (
        <div className="scroll-area border-t border-zinc-100">
          <table className="table">
            <thead>
              <tr>
                <th>Row</th>
                <th>Provider</th>
                <th>Payer</th>
                <th>Status</th>
                <th>Effective</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ provider, e }, i) => (
                <tr key={i}>
                  <td className="text-xs text-zinc-400 tabular-nums">{e.row}</td>
                  <td>{provider}</td>
                  <td>
                    {e.payerName}
                    {e.payerName !== e.payerLabel && <div className="text-xs text-zinc-400">{e.payerLabel}</div>}
                  </td>
                  <td>
                    <StatusPill status={e.status} />
                    {e.warnings.length > 0 && <div className="mt-0.5 text-xs text-amber-700">{e.warnings.join("; ")}</div>}
                  </td>
                  <td className="whitespace-nowrap">{e.effectiveDate ?? "—"}</td>
                  <td className="max-w-xs text-xs text-zinc-600">{e.statusNote ?? e.remark ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}

function Done({ summary: s, onAgain }: { summary: ImportSummary; onAgain: () => void }) {
  return (
    <Card>
      <div className="space-y-3 p-5">
        <div className="flex items-center gap-2 text-base font-semibold text-emerald-700">
          <CheckCircle2 className="size-5" /> Import complete
        </div>
        <ul className="space-y-0.5 text-sm text-zinc-700">
          <li>
            Practices: {s.practicesCreated} new, {s.practicesMatched} matched
          </li>
          <li>
            Providers: {s.providersCreated} new, {s.providersMatched} matched
          </li>
          <li>
            Enrollments: {s.enrollmentsCreated} new, {s.enrollmentsUpdated} updated
          </li>
          {s.payersCreated.length > 0 && <li>New payers added: {s.payersCreated.join(", ")}</li>}
        </ul>
        <div className="flex gap-2 pt-1">
          <Link href="/enrollments" className="btn-primary">
            View enrollments
          </Link>
          <button type="button" className="btn-secondary" onClick={onAgain}>
            Import another file
          </button>
        </div>
      </div>
    </Card>
  );
}
