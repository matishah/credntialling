import { ExternalLink } from "lucide-react";
import { sql } from "drizzle-orm";
import { requireUser, can } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { Disclosure } from "@/components/client";
import { PayerForm } from "@/components/forms";

export const metadata = { title: "Payers" };

export default async function PayersPage() {
  const user = await requireUser();
  const canEdit = can(user, "payers.edit");
  const payers = await db
    .select({
      id: schema.payers.id,
      name: schema.payers.name,
      portalUrl: schema.payers.portalUrl,
      phone: schema.payers.phone,
      turnaroundDays: schema.payers.turnaroundDays,
      requirements: schema.payers.requirements,
      notes: schema.payers.notes,
      // actual average days from submission to approval, from our own data
      avgDays: sql<number | null>`(select round(avg(e.effective_date - e.submitted_on))::int from enrollments e where e.payer_id = ${schema.payers.id} and e.submitted_on is not null and e.effective_date is not null)`,
      open: sql<number>`(select count(*)::int from enrollments e where e.payer_id = ${schema.payers.id} and e.status in ('not_started','in_process','waiting','on_hold'))`,
      closed: sql<number>`(select count(*)::int from enrollments e where e.payer_id = ${schema.payers.id} and e.status = 'panel_closed')`,
    })
    .from(schema.payers)
    .orderBy(schema.payers.name);

  return (
    <>
      <PageHeader
        title="Payer directory"
        subtitle="Portal links, phone numbers and requirements in one place, so nobody re-researches a payer."
        actions={
          canEdit && (
            <Disclosure label="Add payer" className="btn-primary">
              <Card className="p-4">
                <PayerForm />
              </Card>
            </Disclosure>
          )
        }
      />
      <Card>
        <div className="scroll-area scroll-area-tall divide-y divide-zinc-100">
          {payers.map((p) => (
            <div key={p.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium">{p.name}</span>
                  {p.portalUrl && (
                    <a href={p.portalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline">
                      <ExternalLink className="size-3" /> Portal
                    </a>
                  )}
                  {p.phone && <span className="text-xs text-zinc-600">{p.phone}</span>}
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <span>{p.open} open</span>
                  {p.closed > 0 && <span className="text-rose-600">{p.closed} panel closed</span>}
                  {(p.avgDays ?? p.turnaroundDays) != null && <span>~{p.avgDays ?? p.turnaroundDays} days to approve{p.avgDays != null ? " (actual)" : ""}</span>}
                </div>
              </div>
              {(p.requirements || p.notes) && (
                <div className="mt-1 space-y-0.5 text-sm text-zinc-600">
                  {p.requirements && <p className="whitespace-pre-line">{p.requirements}</p>}
                  {p.notes && <p className="text-xs whitespace-pre-line text-zinc-500">{p.notes}</p>}
                </div>
              )}
              {canEdit && (
                <div className="mt-2">
                  <Disclosure label="Edit" className="btn-ghost px-2 py-0.5 text-xs">
                    <PayerForm d={p} />
                  </Disclosure>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
