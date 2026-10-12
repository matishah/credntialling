import { desc, eq } from "drizzle-orm";
import { requireUser, can } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { fmtDate } from "@/lib/dates";
import { Card, NoAccess, PageHeader } from "@/components/ui";
import { ImportWizard } from "./wizard";

export const metadata = { title: "Import" };

export default async function ImportPage() {
  const user = await requireUser();
  if (!can(user, "import.run")) return <NoAccess />;
  const history = await db
    .select({
      id: schema.imports.id,
      fileName: schema.imports.fileName,
      createdAt: schema.imports.createdAt,
      summary: schema.imports.summary,
      by: schema.users.name,
    })
    .from(schema.imports)
    .leftJoin(schema.users, eq(schema.users.id, schema.imports.importedById))
    .orderBy(desc(schema.imports.createdAt))
    .limit(20);

  return (
    <>
      <PageHeader
        title="Import spreadsheets"
        subtitle="One-time move from the department's Excel / Google Sheets files. Preview first – nothing is saved until you confirm."
      />
      <ImportWizard />
      {history.length > 0 && (
        <Card title={`Previous imports (${history.length})`} className="mt-6">
          <div className="scroll-area">
            <table className="table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>When</th>
                  <th>By</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => {
                  const s = h.summary as {
                    practicesCreated?: number;
                    providersCreated?: number;
                    enrollmentsCreated?: number;
                    enrollmentsUpdated?: number;
                  } | null;
                  return (
                    <tr key={h.id}>
                      <td className="font-medium">{h.fileName}</td>
                      <td>{fmtDate(h.createdAt.toISOString())}</td>
                      <td>{h.by ?? "—"}</td>
                      <td className="text-xs text-zinc-600">
                        {s &&
                          `${s.practicesCreated ?? 0} practices, ${s.providersCreated ?? 0} providers, ${s.enrollmentsCreated ?? 0} new / ${s.enrollmentsUpdated ?? 0} updated enrollments`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
