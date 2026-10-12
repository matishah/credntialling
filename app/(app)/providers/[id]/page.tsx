import Link from "next/link";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { requireUser, can } from "@/lib/auth";
import { getProvider } from "@/lib/queries";
import { CREDENTIAL } from "@/lib/labels";
import { fmtDate } from "@/lib/dates";
import { deleteCredential, revealSsn } from "@/app/actions/records";
import { Card, Empty, Expiry, PageHeader } from "@/components/ui";
import { ActionButton, CopyField, Disclosure, RevealField } from "@/components/client";
import { CredentialForm, ProviderForm } from "@/components/forms";
import { EnrollmentTable } from "@/components/enrollment-table";
import { LoginsCard } from "@/components/logins-card";
import { DocumentsCard, HistoryCard, OnboardingChecklist } from "@/components/provider-file";

export default async function ProviderPage(props: PageProps<"/providers/[id]">) {
  const { id } = await props.params;
  const user = await requireUser();
  const data = await getProvider(user, id);
  if (!data) notFound();
  const { provider: p, practices, enrollments, credentials, logins, history, documents } = data;
  const sensitive = can(user, "sensitive.view");
  const canEdit = can(user, "practices.edit");
  const mine = enrollments.filter((e) => e.providerId === p.id);
  const group = enrollments.filter((e) => e.type === "group");
  const par = mine.filter((e) => e.status === "participating").length;

  return (
    <>
      <PageHeader
        crumbs={[
          { href: "/providers", label: "Providers" },
          ...practices.map((pr) => ({ href: `/practices/${pr.id}`, label: pr.name })),
        ]}
        title={p.degree ? `${p.name}, ${p.degree}` : p.name}
        subtitle={[p.specialty, `${par}/${mine.length} payers participating`].filter(Boolean).join(" · ")}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <Card title="Profile">
            <dl className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <CopyField label="Individual NPI" value={p.npi} mono />
              <CopyField label="CAQH ID" value={p.caqhId} mono />
              <CopyField label="PECOS ID" value={p.pecosId} mono />
              <CopyField label="Taxonomy" value={p.taxonomyCode} mono />
              <CopyField label="Medicare PTAN" value={p.medicareId} mono />
              <CopyField label="Medicaid ID" value={p.medicaidId} mono />
              <RevealField label="SSN" masked={p.hasSsn ? `•••-••-${p.ssnLast4 ?? "••••"}` : null} allowed={sensitive} reveal={revealSsn.bind(null, p.id)} />
              {sensitive ? <CopyField label="Date of birth" value={p.dob ? fmtDate(p.dob) : null} /> : <CopyField label="Date of birth" value={p.dob ? "••/••/••••" : null} />}
              <CopyField label="Gender" value={p.gender} />
              <CopyField label="Place of birth" value={p.placeOfBirth} />
              <CopyField label="Citizenship" value={p.citizenship} />
              <CopyField label="Languages" value={p.languages} />
              {p.otherNames && <CopyField label="Other names used" value={p.otherNames} />}
              <CopyField label="Board certification" value={p.boardCertification} />
              <CopyField label="Email" value={p.email} />
              <CopyField label="Phone" value={p.phone} />
              <div className="sm:col-span-2 lg:col-span-3">
                <CopyField label="Home address" value={sensitive ? p.homeAddress : p.homeAddress ? "Hidden" : null} />
              </div>
            </dl>
            {p.notes && <p className="border-t border-zinc-100 px-4 py-3 text-sm whitespace-pre-line text-zinc-600">{p.notes}</p>}
            {canEdit && (
              <div className="border-t border-zinc-100 px-4 py-3">
                <Disclosure label="Edit provider" className="btn-ghost px-2 py-1 text-xs">
                  <ProviderForm d={{ ...p, dob: sensitive ? p.dob : null, homeAddress: sensitive ? p.homeAddress : null }} canSeeSensitive={sensitive} />
                </Disclosure>
              </div>
            )}
          </Card>

          <HistoryCard items={history} providerId={p.id} canEdit={canEdit} />

          <Card title={`Payer enrollments (${mine.length})`}>
            <EnrollmentTable
              rows={mine}
              cols={{ practice: practices.length > 1, payerId: true, effective: true, followUp: true, invoice: true, note: true }}
              empty="No enrollments for this provider yet. Start one from the practice page."
            />
          </Card>

          {group.length > 0 && (
            <Card title="Group enrollments (practice-level)">
              <EnrollmentTable rows={group} cols={{ practice: true, payerId: true, effective: true, followUp: true }} />
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <OnboardingChecklist provider={p} credentials={credentials} history={history} logins={logins} documents={documents} />

          <Card title={`Licenses & certifications (${credentials.length})`}>
            {credentials.length ? (
              <ul className="scroll-area divide-y divide-zinc-100">
                {credentials.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-2 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        {CREDENTIAL[c.type]} {c.state && <span className="text-zinc-500">({c.state})</span>}
                      </div>
                      <div className="font-mono text-xs text-zinc-500">{c.number ?? "—"}</div>
                      {(c.issuer || c.coverage) && <div className="text-xs text-zinc-500">{[c.issuer, c.coverage].filter(Boolean).join(" · ")}</div>}
                      {c.issuedOn && <div className="text-xs text-zinc-400">Issued {fmtDate(c.issuedOn)}</div>}
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <Expiry date={c.expiresOn} />
                      {canEdit && (
                        <ActionButton className="btn-ghost p-1" confirm="Delete this credential?" run={deleteCredential.bind(null, c.id)} title="Delete">
                          <Trash2 className="size-3.5" />
                        </ActionButton>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No licenses tracked yet.</Empty>
            )}
            {canEdit && (
              <div className="border-t border-zinc-100 px-4 py-3">
                <Disclosure label="Add license / DEA / certification" className="btn-ghost px-2 py-1 text-xs">
                  <CredentialForm providerId={p.id} />
                </Disclosure>
              </div>
            )}
          </Card>

          <DocumentsCard docs={documents} owner="provider" providerId={p.id} canView={sensitive} canManage={can(user, "documents.manage")} />

          <LoginsCard logins={logins} canView={can(user, "logins.view")} canEdit={can(user, "logins.edit")} providerId={p.id} />

          <Card title="Practices">
            <ul className="scroll-area divide-y divide-zinc-100">
              {practices.map((pr) => (
                <li key={pr.id} className="px-4 py-2 text-sm">
                  <Link href={`/practices/${pr.id}`} className="text-blue-700 hover:underline">
                    {pr.name}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
