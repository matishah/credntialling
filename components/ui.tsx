import Link from "next/link";
import type { ReactNode } from "react";
import { INVOICE, STATUS } from "@/lib/labels";
import { daysBetween, fmtDate, relDays, todayISO } from "@/lib/dates";
import type { EnrollmentStatus, InvoiceStatus } from "@/lib/db/schema";

export function StatusPill({ status }: { status: EnrollmentStatus }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${s.tone}`}>
      {s.label}
    </span>
  );
}

export function InvoicePill({ status }: { status: InvoiceStatus }) {
  const s = INVOICE[status];
  if (status === "not_billable") return <span className={s.tone}>—</span>;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${s.tone}`}>
      {s.label}
    </span>
  );
}

export function FollowUp({ date }: { date: string | null }) {
  if (!date) return <span className="text-zinc-400">—</span>;
  const n = daysBetween(todayISO(), date);
  const tone = n < 0 ? "text-red-600 font-medium" : n === 0 ? "text-amber-700 font-medium" : "text-zinc-700";
  return (
    <span className={`whitespace-nowrap ${tone}`} title={fmtDate(date)}>
      {fmtDate(date)}
      <span className="block text-xs font-normal text-zinc-400">{relDays(date)}</span>
    </span>
  );
}

export function Expiry({ date }: { date: string | null }) {
  if (!date) return <span className="text-zinc-400">—</span>;
  const n = daysBetween(todayISO(), date);
  const tone = n < 0 ? "bg-red-100 text-red-800" : n <= 30 ? "bg-red-50 text-red-700" : n <= 90 ? "bg-amber-50 text-amber-800" : "text-zinc-700";
  return (
    <span className={`rounded px-1.5 py-0.5 whitespace-nowrap ${tone}`}>
      {fmtDate(date)} <span className="text-xs opacity-70">{n < 0 ? "expired" : relDays(date)}</span>
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  crumbs,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  crumbs?: { href: string; label: string }[];
}) {
  return (
    <div className="mb-5">
      {crumbs && (
        <nav className="mb-1 flex flex-wrap items-center gap-1 text-xs text-zinc-500">
          {crumbs.map((c, i) => (
            <span key={c.href} className="flex items-center gap-1">
              {i > 0 && <span>/</span>}
              <Link href={c.href} className="hover:text-zinc-900 hover:underline">
                {c.label}
              </Link>
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">{title}</h1>
          {subtitle && <div className="mt-0.5 text-sm text-zinc-500">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Card({ title, actions, children, className = "" }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-zinc-800">{title}</h2>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-4 py-8 text-center text-sm text-zinc-500">{children}</div>;
}

export function Stat({ label, value, href, tone = "text-zinc-900" }: { label: string; value: number | string; href?: string; tone?: string }) {
  const body = (
    <div className="card px-4 py-3 transition hover:border-zinc-300">
      <div className="text-xs font-medium text-zinc-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function NoAccess() {
  return (
    <div className="card mx-auto mt-10 max-w-md p-6 text-center">
      <h1 className="text-base font-semibold">No access</h1>
      <p className="mt-1 text-sm text-zinc-500">Your role doesn&apos;t include this page. Ask an admin if you need it.</p>
    </div>
  );
}
