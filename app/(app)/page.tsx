import Link from "next/link";
import { requireUser, can } from "@/lib/auth";
import { getToday } from "@/lib/queries";
import { CREDENTIAL } from "@/lib/labels";
import { Card, Empty, Expiry, PageHeader, Stat } from "@/components/ui";
import { EnrollmentTable } from "@/components/enrollment-table";

export const metadata = { title: "Today" };

export default async function TodayPage() {
  const user = await requireUser();
  const data = await getToday(user);
  const canEdit = can(user, "enrollments.edit");
  const overdue = data.due.filter((d) => d.nextFollowUp && d.nextFollowUp < data.today).length;
  const firstName = user.name.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`Good ${greeting()}, ${firstName}`}
        subtitle={
          data.due.length
            ? `${data.due.length} follow-up${data.due.length === 1 ? "" : "s"} need attention${overdue ? ` (${overdue} overdue)` : ""}.`
            : "You're all caught up on follow-ups."
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Due today / overdue" value={data.due.length} tone={data.due.length ? "text-red-600" : undefined} href="/enrollments?due=overdue" />
        <Stat label="Due in next 7 days" value={data.upcoming.length} href="/enrollments?due=week" />
        <Stat label="In process" value={(data.counts.in_process ?? 0) + (data.counts.not_started ?? 0) + (data.counts.waiting ?? 0)} href="/enrollments?status=open" />
        <Stat label="Participating" value={data.counts.participating ?? 0} tone="text-emerald-700" href="/enrollments?status=participating" />
        <Stat label="Ready to invoice" value={data.ready.length} tone={data.ready.length ? "text-amber-700" : undefined} href={can(user, "invoicing.manage") ? "/invoicing" : "/enrollments?invoice=ready"} />
        <Stat label="Credentials expiring ≤ 90d" value={data.expiring.length} tone={data.expiring.length ? "text-amber-700" : undefined} />
      </div>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <Card title={`Follow-ups due (${data.due.length})`} actions={<Link href="/enrollments?due=overdue" className="text-xs text-blue-700 hover:underline">Open in Enrollments</Link>}>
            <EnrollmentTable rows={data.due} snooze={canEdit} empty="No follow-ups due. Nice work." />
          </Card>
          <Card title={`Coming up this week (${data.upcoming.length})`}>
            <EnrollmentTable rows={data.upcoming} cols={{ practice: true, provider: true, followUp: true, note: true }} empty="Nothing scheduled for the next 7 days." />
          </Card>
        </div>

        <div className="grid content-start gap-6 md:grid-cols-2 2xl:grid-cols-1">
          <Card title={`Expiring credentials (${data.expiring.length})`}>
            {data.expiring.length ? (
              <ul className="scroll-area divide-y divide-zinc-100">
                {data.expiring.map((c) => (
                  <li key={c.id} className="px-4 py-2.5">
                    <Link href={`/providers/${c.providerId}`} className="text-sm font-medium hover:underline">
                      {c.providerName}
                    </Link>
                    <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-zinc-500">
                      <span>
                        {CREDENTIAL[c.type]} {c.number && <span className="font-mono">{c.number}</span>}
                      </span>
                      <Expiry date={c.expiresOn} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No licenses, DEA or certifications expiring in the next 90 days.</Empty>
            )}
          </Card>

          <Card title={`Ready to invoice (${data.ready.length})`} actions={can(user, "invoicing.manage") ? <Link href="/invoicing" className="text-xs text-blue-700 hover:underline">Invoicing</Link> : null}>
            {data.ready.length ? (
              <ul className="scroll-area divide-y divide-zinc-100">
                {data.ready.map((r) => (
                  <li key={r.id} className="px-4 py-2 text-sm">
                    <Link href={`/enrollments/${r.id}`} className="font-medium hover:underline">
                      {r.payerName}
                    </Link>
                    <span className="text-zinc-500"> – {r.providerName ?? "Group"}</span>
                    <div className="text-xs text-zinc-500">{r.practiceName}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Nothing waiting to be invoiced.</Empty>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}
