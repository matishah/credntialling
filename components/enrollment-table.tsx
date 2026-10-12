import Link from "next/link";
import { snoozeFollowUp, setInvoiceStatus } from "@/app/actions/enrollments";
import { ActionButton, CopyButton } from "./client";
import { Empty, FollowUp, InvoicePill, StatusPill } from "./ui";
import { fmtDate } from "@/lib/dates";
import type { EnrollmentRow } from "@/lib/queries";

type Cols = {
  practice?: boolean;
  provider?: boolean;
  payerId?: boolean;
  effective?: boolean;
  followUp?: boolean;
  invoice?: boolean;
  note?: boolean;
  assignee?: boolean;
};

export function EnrollmentTable({
  rows,
  cols = { practice: true, provider: true, payerId: true, followUp: true, note: true },
  snooze = false,
  invoiceActions = false,
  tall = false,
  empty = "Nothing here.",
}: {
  rows: EnrollmentRow[];
  cols?: Cols;
  snooze?: boolean;
  invoiceActions?: boolean;
  /** Fill the screen height (for pages that are mostly this table). */
  tall?: boolean;
  empty?: string;
}) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  return (
    <div className={`scroll-area ${tall ? "scroll-area-tall" : ""}`}>
      <table className="table">
        <thead>
          <tr>
            <th>Payer</th>
            {cols.provider && <th>Provider</th>}
            {cols.practice && <th>Practice</th>}
            <th>Status</th>
            {cols.payerId && <th>Payer ID</th>}
            {cols.effective && <th>Effective</th>}
            {cols.followUp && <th>Follow-up</th>}
            {cols.invoice && <th>Invoice</th>}
            {cols.assignee && <th>Assigned</th>}
            {cols.note && <th className="w-1/4">Last activity</th>}
            {(snooze || invoiceActions) && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="min-w-32 font-medium">
                <Link href={`/enrollments/${r.id}`} className="text-blue-700 hover:underline">
                  {r.payerName}
                </Link>
                {r.type === "group" && <span className="ml-1.5 rounded bg-zinc-100 px-1 text-[10px] font-semibold whitespace-nowrap text-zinc-500 uppercase">group</span>}
              </td>
              {cols.provider && (
                <td className="min-w-24">
                  {r.providerId ? (
                    <Link href={`/providers/${r.providerId}`} className="hover:underline">
                      {r.providerName}
                    </Link>
                  ) : (
                    <span className="text-zinc-400">Group</span>
                  )}
                </td>
              )}
              {cols.practice && (
                <td className="min-w-28">
                  <Link href={`/practices/${r.practiceId}`} className="hover:underline">
                    {r.practiceName}
                  </Link>
                </td>
              )}
              <td>
                <StatusPill status={r.status} />
                {r.statusNote && (
                  <div className="mt-0.5 max-w-56 truncate text-xs text-zinc-500" title={r.statusNote}>
                    {r.statusNote}
                  </div>
                )}
              </td>
              {cols.payerId && (
                <td className="font-mono text-xs whitespace-nowrap">
                  {r.payerProviderId ? (
                    <span className="inline-flex items-center gap-0.5">
                      {r.payerProviderId}
                      <CopyButton value={r.payerProviderId} label="payer ID" />
                    </span>
                  ) : (
                    <span className="text-zinc-300">—</span>
                  )}
                </td>
              )}
              {cols.effective && <td className="whitespace-nowrap">{fmtDate(r.effectiveDate)}</td>}
              {cols.followUp && (
                <td>
                  <FollowUp date={r.nextFollowUp} />
                </td>
              )}
              {cols.invoice && (
                <td>
                  <InvoicePill status={r.invoiceStatus} />
                </td>
              )}
              {cols.assignee && <td className="whitespace-nowrap text-zinc-600">{r.assignedToName ?? <span className="text-zinc-300">—</span>}</td>}
              {cols.note && (
                <td className="text-xs text-zinc-600">
                  <span className="line-clamp-2" title={r.lastNote ?? undefined}>
                    {r.lastNote ?? <span className="text-zinc-300">—</span>}
                  </span>
                </td>
              )}
              {(snooze || invoiceActions) && (
                <td className="text-right whitespace-nowrap">
                  {snooze && (
                    <span className="inline-flex gap-1">
                      <ActionButton className="btn-ghost px-2 py-1 text-xs" title="Push follow-up 7 days" run={snoozeFollowUp.bind(null, r.id, 7)}>
                        +7d
                      </ActionButton>
                      <ActionButton className="btn-ghost px-2 py-1 text-xs" title="Push follow-up 14 days" run={snoozeFollowUp.bind(null, r.id, 14)}>
                        +14d
                      </ActionButton>
                      <Link href={`/enrollments/${r.id}`} className="btn-secondary px-2 py-1 text-xs">
                        Log
                      </Link>
                    </span>
                  )}
                  {invoiceActions && r.invoiceStatus === "ready" && (
                    <ActionButton className="btn-secondary px-2 py-1 text-xs" run={setInvoiceStatus.bind(null, r.id, "invoiced")}>
                      Mark invoiced
                    </ActionButton>
                  )}
                  {invoiceActions && r.invoiceStatus === "invoiced" && (
                    <ActionButton className="btn-secondary px-2 py-1 text-xs" run={setInvoiceStatus.bind(null, r.id, "paid")}>
                      Mark paid
                    </ActionButton>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
