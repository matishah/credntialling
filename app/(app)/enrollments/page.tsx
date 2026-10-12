import Link from "next/link";
import { requireUser, can } from "@/lib/auth";
import { listEnrollments, listPayers, listPractices, type EnrollmentFilters } from "@/lib/queries";
import { STATUS, STATUS_ORDER, INVOICE } from "@/lib/labels";
import { Card, PageHeader } from "@/components/ui";
import { EnrollmentTable } from "@/components/enrollment-table";
import type { EnrollmentStatus, InvoiceStatus } from "@/lib/db/schema";

export const metadata = { title: "Enrollments" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function EnrollmentsPage(props: PageProps<"/enrollments">) {
  const sp = await props.searchParams;
  const user = await requireUser();
  const filters: EnrollmentFilters = {
    q: one(sp.q),
    status: one(sp.status) as EnrollmentStatus | "open" | undefined,
    payerId: one(sp.payerId),
    practiceId: one(sp.practiceId),
    assigned: one(sp.assigned) as "me" | "none" | undefined,
    invoice: one(sp.invoice) as InvoiceStatus | undefined,
    due: one(sp.due) as "overdue" | "week" | undefined,
  };
  const [rows, payers, practices] = await Promise.all([listEnrollments(user, filters), listPayers(), listPractices(user)]);
  const active = Object.values(filters).some(Boolean);

  const quick = [
    { label: "Overdue", href: "/enrollments?due=overdue" },
    { label: "Due this week", href: "/enrollments?due=week" },
    { label: "My work", href: "/enrollments?assigned=me&status=open" },
    { label: "Unassigned", href: "/enrollments?assigned=none&status=open" },
    { label: "Panel closed", href: "/enrollments?status=panel_closed" },
    { label: "Waiting on group", href: "/enrollments?status=waiting" },
  ];

  return (
    <>
      <PageHeader title="Enrollments" subtitle={`${rows.length}${rows.length === 500 ? "+" : ""} matching`} />

      <div className="mb-3 flex flex-wrap gap-1.5">
        {quick.map((q) => (
          <Link key={q.href} href={q.href} className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 hover:border-zinc-300 hover:text-zinc-900">
            {q.label}
          </Link>
        ))}
      </div>

      <Card className="mb-4">
        <form className="flex flex-wrap items-end gap-3 p-3">
          <label className="min-w-56 flex-1">
            <span className="label">Search</span>
            <input name="q" defaultValue={filters.q} placeholder="Practice, provider, payer, payer ID…" className="input" />
          </label>
          <label>
            <span className="label">Status</span>
            <select name="status" defaultValue={filters.status ?? ""} className="input">
              <option value="">Any</option>
              <option value="open">All open</option>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS[s].label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Payer</span>
            <select name="payerId" defaultValue={filters.payerId ?? ""} className="input max-w-48">
              <option value="">Any</option>
              {payers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Practice</span>
            <select name="practiceId" defaultValue={filters.practiceId ?? ""} className="input max-w-48">
              <option value="">Any</option>
              {practices.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Assigned</span>
            <select name="assigned" defaultValue={filters.assigned ?? ""} className="input">
              <option value="">Anyone</option>
              <option value="me">Me</option>
              <option value="none">Unassigned</option>
            </select>
          </label>
          <label>
            <span className="label">Invoice</span>
            <select name="invoice" defaultValue={filters.invoice ?? ""} className="input">
              <option value="">Any</option>
              {(Object.keys(INVOICE) as InvoiceStatus[]).filter((k) => k !== "not_billable").map((k) => (
                <option key={k} value={k}>
                  {INVOICE[k].label}
                </option>
              ))}
            </select>
          </label>
          {filters.due && <input type="hidden" name="due" value={filters.due} />}
          <button className="btn-primary">Apply</button>
          {active && (
            <Link href="/enrollments" className="btn-ghost">
              Clear
            </Link>
          )}
        </form>
      </Card>

      <Card>
        <EnrollmentTable
          rows={rows}
          cols={{ practice: true, provider: true, payerId: true, followUp: true, invoice: true, assignee: true, note: true }}
          snooze={can(user, "enrollments.edit") && (filters.due !== undefined || filters.status === "open")}
          tall
          empty="No enrollments match these filters."
        />
      </Card>
    </>
  );
}
