import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Phone } from "lucide-react";
import { requireUser, can } from "@/lib/auth";
import { getEnrollment, listActiveUsers } from "@/lib/queries";
import { ACTIVITY_KINDS } from "@/lib/labels";
import { fmtDate, relDays } from "@/lib/dates";
import { setInvoiceStatus } from "@/app/actions/enrollments";
import { Card, Empty, FollowUp, InvoicePill, PageHeader, StatusPill } from "@/components/ui";
import { ActionButton, CopyField, Disclosure } from "@/components/client";
import { EditEnrollmentForm, LogActivityForm } from "@/components/forms";

const KIND_LABEL: Record<string, string> = {
  ...Object.fromEntries(ACTIVITY_KINDS.map((k) => [k.value, k.label])),
  status: "Status change",
  import: "From spreadsheet",
};

export default async function EnrollmentPage(props: PageProps<"/enrollments/[id]">) {
  const { id } = await props.params;
  const user = await requireUser();
  const data = await getEnrollment(user, id);
  if (!data) notFound();
  const { enrollment: e, history, dependsOn } = data;
  const canEdit = can(user, "enrollments.edit");
  const canInvoice = can(user, "invoicing.manage");
  const users = canEdit ? await listActiveUsers() : [];

  return (
    <>
      <PageHeader
        crumbs={[
          { href: `/practices/${e.practiceId}`, label: e.practiceName },
          ...(e.providerId ? [{ href: `/providers/${e.providerId}`, label: e.providerName ?? "Provider" }] : []),
        ]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {e.payerName}
            <span className="text-zinc-400">·</span>
            <span className="font-normal text-zinc-600">{e.providerName ?? "Group enrollment"}</span>
            <StatusPill status={e.status} />
          </span>
        }
        subtitle={e.statusNote}
      />

      {dependsOn && e.status === "waiting" && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          Waiting on the{" "}
          <Link href={`/enrollments/${dependsOn.id}`} className="font-medium underline">
            {dependsOn.payerName} group enrollment
          </Link>{" "}
          (currently <StatusPill status={dependsOn.status} />). This unlocks automatically when the group is approved.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          {canEdit && (
            <Card title="Log activity">
              <div className="p-4">
                <LogActivityForm enrollmentId={e.id} status={e.status} />
              </div>
            </Card>
          )}

          <Card title={`History (${history.length})`}>
            {history.length ? (
              <ol className="scroll-area relative space-y-0 px-4 py-3">
                {history.map((h) => (
                  <li key={h.id} className="relative border-l border-zinc-200 pb-4 pl-5 last:pb-1">
                    <span className={`absolute top-1.5 -left-[5px] size-2.5 rounded-full ring-2 ring-white ${h.kind === "status" ? "bg-violet-500" : h.kind === "import" ? "bg-zinc-300" : "bg-blue-500"}`} />
                    <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-zinc-500">
                      <span className="font-medium text-zinc-700">{fmtDate(h.occurredOn)}</span>
                      <span>{KIND_LABEL[h.kind] ?? h.kind}</span>
                      {h.userName && <span>· {h.userName}</span>}
                      {h.refNumber && <span className="rounded bg-zinc-100 px-1.5 font-mono text-zinc-700">Ref {h.refNumber}</span>}
                    </div>
                    <p className="mt-0.5 text-sm whitespace-pre-line text-zinc-800">{h.note}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <Empty>No activity yet.</Empty>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Details">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4">
              <CopyField label="Payer provider ID" value={e.payerProviderId} mono />
              <div>
                <dt className="text-xs text-zinc-500">Effective date</dt>
                <dd className="text-sm">{fmtDate(e.effectiveDate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Next follow-up</dt>
                <dd className="text-sm">
                  <FollowUp date={e.nextFollowUp} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Submitted</dt>
                <dd className="text-sm">
                  {fmtDate(e.submittedOn)} {e.submittedOn && <span className="text-xs text-zinc-400">{relDays(e.submittedOn)}</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Assigned to</dt>
                <dd className="text-sm">{e.assignedToName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Invoice</dt>
                <dd className="flex flex-wrap items-center gap-1 text-sm">
                  <InvoicePill status={e.invoiceStatus} />
                  {e.invoicedOn && <span className="text-xs text-zinc-400">{fmtDate(e.invoicedOn)}</span>}
                </dd>
              </div>
            </dl>
            {canInvoice && (e.invoiceStatus === "ready" || e.invoiceStatus === "invoiced") && (
              <div className="border-t border-zinc-100 px-4 py-3">
                {e.invoiceStatus === "ready" ? (
                  <ActionButton run={setInvoiceStatus.bind(null, e.id, "invoiced")}>Mark invoiced</ActionButton>
                ) : (
                  <ActionButton run={setInvoiceStatus.bind(null, e.id, "paid")}>Mark paid</ActionButton>
                )}
              </div>
            )}
            {canEdit && (
              <div className="border-t border-zinc-100 px-4 py-3">
                <Disclosure label="Edit details" className="btn-ghost px-2 py-1 text-xs">
                  <EditEnrollmentForm e={e} users={users} />
                </Disclosure>
              </div>
            )}
          </Card>

          <Card title="For the application">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4">
              {e.providerId && <CopyField label="Individual NPI" value={e.providerNpi} mono />}
              <CopyField label="Group NPI" value={e.groupNpi} mono />
              <CopyField label="Tax ID" value={e.taxId} mono />
            </dl>
          </Card>

          <Card title={e.payerName}>
            <div className="space-y-2 p-4 text-sm">
              {e.payerPortal && (
                <a href={e.payerPortal} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-blue-700 hover:underline">
                  <ExternalLink className="size-3.5" /> Enrollment portal
                </a>
              )}
              {e.payerPhone && (
                <a href={`tel:${e.payerPhone}`} className="flex items-center gap-1.5 text-zinc-700">
                  <Phone className="size-3.5" /> {e.payerPhone}
                </a>
              )}
              {e.payerRequirements && <p className="whitespace-pre-line text-zinc-600">{e.payerRequirements}</p>}
              {!e.payerPortal && !e.payerPhone && !e.payerRequirements && <p className="text-zinc-400">No payer details yet.</p>}
              <Link href="/payers" className="block text-xs text-blue-700 hover:underline">
                Edit in payer directory
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
