import Link from "next/link";
import { UserPlus } from "lucide-react";
import { can, requireUser } from "@/lib/auth";
import { listProviders } from "@/lib/queries";
import { Card, Empty, PageHeader } from "@/components/ui";
import { CopyButton } from "@/components/client";

export const metadata = { title: "Providers" };

export default async function ProvidersPage() {
  const user = await requireUser();
  const rows = await listProviders(user);
  return (
    <>
      <PageHeader
        title="Providers"
        subtitle={`${rows.length} provider${rows.length === 1 ? "" : "s"}`}
        actions={
          can(user, "practices.edit") && (
            <Link href="/providers/new" className="btn-primary">
              <UserPlus className="size-4" /> Onboard provider
            </Link>
          )
        }
      />
      <Card>
        {rows.length ? (
          <div className="scroll-area scroll-area-tall">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>NPI</th>
                  <th>Specialty</th>
                  <th>Practice(s)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td className="font-medium">
                      <Link href={`/providers/${p.id}`} className="text-blue-700 hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="font-mono text-xs">
                      {p.npi && (
                        <span className="inline-flex items-center">
                          {p.npi}
                          <CopyButton value={p.npi} label="NPI" />
                        </span>
                      )}
                    </td>
                    <td className="max-w-72 truncate text-zinc-600" title={p.specialty ?? undefined}>
                      {p.specialty}
                    </td>
                    <td className="text-sm">
                      {p.practices.map((pr, i) => (
                        <span key={pr.id}>
                          {i > 0 && ", "}
                          <Link href={`/practices/${pr.id}`} className="hover:underline">
                            {pr.name}
                          </Link>
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No providers yet.</Empty>
        )}
      </Card>
    </>
  );
}
