import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser, can } from "@/lib/auth";
import { listPractices } from "@/lib/queries";
import { Card, Empty, PageHeader } from "@/components/ui";
import { CopyButton } from "@/components/client";

export const metadata = { title: "Practices" };

export default async function PracticesPage() {
  const user = await requireUser();
  const rows = await listPractices(user);

  return (
    <>
      <PageHeader
        title="Practices"
        subtitle={`${rows.length} practice${rows.length === 1 ? "" : "s"}${user.practiceIds !== null ? " assigned to you" : ""}`}
        actions={
          can(user, "practices.edit") && (
            <Link href="/practices/new" className="btn-primary">
              <Plus className="size-4" /> New practice
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
                  <th>Practice</th>
                  <th>Group NPI</th>
                  <th>Tax ID</th>
                  <th className="text-right">Providers</th>
                  <th className="w-56">Progress</th>
                  <th className="text-right">Overdue</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const pct = p.total ? Math.round((p.participating / p.total) * 100) : 0;
                  return (
                    <tr key={p.id}>
                      <td className="font-medium">
                        <Link href={`/practices/${p.id}`} className="text-blue-700 hover:underline">
                          {p.name}
                        </Link>
                      </td>
                      <td className="font-mono text-xs">
                        {p.groupNpi && (
                          <span className="inline-flex items-center">
                            {p.groupNpi}
                            <CopyButton value={p.groupNpi} label="Group NPI" />
                          </span>
                        )}
                      </td>
                      <td className="font-mono text-xs">
                        {p.taxId && (
                          <span className="inline-flex items-center">
                            {p.taxId}
                            <CopyButton value={p.taxId} label="Tax ID" />
                          </span>
                        )}
                      </td>
                      <td className="text-right tabular-nums">{p.providerCount}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-20 text-right text-xs text-zinc-500 tabular-nums">
                            {p.participating}/{p.total} par
                          </span>
                        </div>
                      </td>
                      <td className={`text-right tabular-nums ${p.overdue ? "font-semibold text-red-600" : "text-zinc-400"}`}>{p.overdue}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>
            No practices yet.{" "}
            {can(user, "import.run") && (
              <Link href="/import" className="text-blue-700 hover:underline">
                Import a spreadsheet
              </Link>
            )}
          </Empty>
        )}
      </Card>
    </>
  );
}
