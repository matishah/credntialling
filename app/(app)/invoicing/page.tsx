import { requireUser, can } from "@/lib/auth";
import { listEnrollments } from "@/lib/queries";
import { Card, NoAccess, PageHeader, Stat } from "@/components/ui";
import { EnrollmentTable } from "@/components/enrollment-table";

export const metadata = { title: "Invoicing" };

export default async function InvoicingPage() {
  const user = await requireUser();
  if (!can(user, "invoicing.manage")) return <NoAccess />;
  const [ready, invoiced] = await Promise.all([
    listEnrollments(user, { invoice: "ready" }),
    listEnrollments(user, { invoice: "invoiced" }),
  ]);

  // group ready items by practice so one invoice per client is easy
  const byPractice = new Map<string, typeof ready>();
  for (const r of ready) byPractice.set(r.practiceName, [...(byPractice.get(r.practiceName) ?? []), r]);

  return (
    <>
      <PageHeader title="Invoicing" subtitle="Enrollments become billable automatically when they turn Participating." />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Ready to invoice" value={ready.length} tone={ready.length ? "text-amber-700" : undefined} />
        <Stat label="Clients to bill" value={byPractice.size} />
        <Stat label="Invoiced, awaiting payment" value={invoiced.length} />
      </div>

      <div className="space-y-6">
        {[...byPractice.entries()].map(([practice, rows]) => (
          <Card key={practice} title={`${practice} · ${rows.length} ready`}>
            <EnrollmentTable rows={rows} cols={{ provider: true, payerId: true, effective: true }} invoiceActions />
          </Card>
        ))}
        {byPractice.size === 0 && (
          <Card title="Ready to invoice">
            <EnrollmentTable rows={[]} empty="Nothing waiting to be invoiced." />
          </Card>
        )}
        <Card title={`Invoiced, awaiting payment (${invoiced.length})`}>
          <EnrollmentTable rows={invoiced} cols={{ practice: true, provider: true, effective: true }} invoiceActions empty="No open invoices." />
        </Card>
      </div>
    </>
  );
}
