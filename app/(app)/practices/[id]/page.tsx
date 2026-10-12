import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, UserPlus } from "lucide-react";
import { requireUser, can } from "@/lib/auth";
import { getPractice, listPayers } from "@/lib/queries";
import { STATUS } from "@/lib/labels";
import { Card, Empty, PageHeader, StatusPill } from "@/components/ui";
import { CopyField, Disclosure } from "@/components/client";
import { NewEnrollmentForm, PracticeForm } from "@/components/forms";
import { EnrollmentTable } from "@/components/enrollment-table";
import { LoginsCard } from "@/components/logins-card";
import { DocumentsCard, practiceDocsMissing } from "@/components/provider-file";

export default async function PracticePage(props: PageProps<"/practices/[id]">) {
  const { id } = await props.params;
  const user = await requireUser();
  const data = await getPractice(user, id);
  if (!data) notFound();
  const { practice, providers, enrollments, logins, documents } = data;
  const missingDocs = practiceDocsMissing(documents);
  const payers = await listPayers();

  const group = enrollments.filter((e) => e.type === "group");
  const individual = enrollments.filter((e) => e.type === "individual");
  const matrixPayers = [...new Set(individual.map((e) => e.payerName))].sort();
  const cell = new Map(individual.map((e) => [`${e.providerId}|${e.payerName}`, e]));
  const par = enrollments.filter((e) => e.status === "participating").length;
  const canEditPractice = can(user, "practices.edit");

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/practices", label: "Practices" }]}
        title={practice.name}
        subtitle={`${providers.length} provider${providers.length === 1 ? "" : "s"} · ${par}/${enrollments.length} enrollments participating`}
        actions={
          practice.clientSheetUrl && (
            <a href={practice.clientSheetUrl} target="_blank" rel="noreferrer" className="btn-secondary">
              <ExternalLink className="size-4" /> Client sheet
            </a>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <Card title="Group information">
            <dl className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <CopyField label="Group NPI" value={practice.groupNpi} mono />
              <CopyField label="Tax ID" value={practice.taxId} mono />
              <CopyField label="Phone" value={practice.phone} />
              <CopyField label="Fax" value={practice.fax} />
              <CopyField label="Email" value={practice.email} />
              <div className="sm:col-span-2 lg:col-span-3 grid gap-3 sm:grid-cols-2">
                <CopyField label="Service address" value={practice.serviceAddress} />
                <CopyField label="Billing address" value={practice.billingAddress} />
              </div>
            </dl>
            {practice.notes && <p className="border-t border-zinc-100 px-4 py-3 text-sm whitespace-pre-line text-zinc-600">{practice.notes}</p>}
            {canEditPractice && (
              <div className="border-t border-zinc-100 px-4 py-3">
                <Disclosure label="Edit practice" className="btn-ghost px-2 py-1 text-xs">
                  <PracticeForm d={practice} />
                </Disclosure>
              </div>
            )}
          </Card>

          <Card title={`Providers (${providers.length})`}>
            {providers.length ? (
              <div className="scroll-area">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>NPI</th>
                      <th>Specialty</th>
                      <th className="text-right">Participating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {providers.map((p) => (
                      <tr key={p.id}>
                        <td className="font-medium">
                          <Link href={`/providers/${p.id}`} className="text-blue-700 hover:underline">
                            {p.name}
                          </Link>
                        </td>
                        <td className="font-mono text-xs">{p.npi}</td>
                        <td className="max-w-64 truncate text-zinc-600" title={p.specialty ?? undefined}>
                          {p.specialty}
                        </td>
                        <td className="text-right tabular-nums">
                          {p.participating}/{p.total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>No providers yet.</Empty>
            )}
            {canEditPractice && (
              <div className="border-t border-zinc-100 px-4 py-3">
                <Link href={`/providers/new?practiceId=${practice.id}`} className="btn-ghost px-2 py-1 text-xs">
                  <UserPlus className="size-3.5" /> Onboard provider
                </Link>
              </div>
            )}
          </Card>

          {providers.length > 0 && matrixPayers.length > 0 && (
            <Card title="Payer × provider overview">
              <div className="scroll-area">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="left-0 z-20">Payer</th>
                      {providers.map((p) => (
                        <th key={p.id} className="whitespace-nowrap normal-case">
                          {p.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixPayers.map((payer) => (
                      <tr key={payer}>
                        <td className="sticky left-0 z-[5] bg-white font-medium whitespace-nowrap">{payer}</td>
                        {providers.map((p) => {
                          const e = cell.get(`${p.id}|${payer}`);
                          return (
                            <td key={p.id}>
                              {e ? (
                                <Link href={`/enrollments/${e.id}`} title={e.statusNote ?? STATUS[e.status].label}>
                                  <StatusPill status={e.status} />
                                </Link>
                              ) : (
                                <span className="text-xs text-zinc-300">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Card title={`Group enrollments (${group.length})`}>
            <EnrollmentTable
              rows={group}
              cols={{
                payerId: true,
                effective: true,
                followUp: true,
                invoice: true,
                note: true,
              }}
              empty="No group-level enrollments."
            />
          </Card>

          <Card title={`Individual enrollments (${individual.length})`}>
            <EnrollmentTable
              rows={individual}
              cols={{
                provider: true,
                payerId: true,
                effective: true,
                followUp: true,
                invoice: true,
                note: true,
              }}
              empty="No individual enrollments yet."
            />
          </Card>

          {can(user, "enrollments.edit") && (
            <Card title="Start a new enrollment">
              <div className="p-4">
                <NewEnrollmentForm practiceId={practice.id} providers={providers.map((p) => ({ id: p.id, name: p.name }))} payers={payers} />
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <DocumentsCard
            docs={documents}
            owner="practice"
            practiceId={practice.id}
            canView={can(user, "sensitive.view")}
            canManage={can(user, "documents.manage")}
          />
          {missingDocs.length > 0 && <p className="-mt-4 px-1 text-xs text-amber-700">Missing group documents: {missingDocs.join(", ")}</p>}
          <LoginsCard logins={logins} canView={can(user, "logins.view")} canEdit={can(user, "logins.edit")} practiceId={practice.id} />
        </div>
      </div>
    </>
  );
}
