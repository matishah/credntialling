import { ExternalLink, Trash2 } from "lucide-react";
import { deleteLogin, revealPassword } from "@/app/actions/records";
import { ActionButton, CopyField, Disclosure, RevealField } from "./client";
import { LoginForm } from "./forms";
import { Card, Empty } from "./ui";

type Login = { id: string; portal: string; username: string | null; url: string | null; hasPassword: boolean };

export function LoginsCard({
  logins,
  canView,
  canEdit,
  providerId,
  practiceId,
}: {
  logins: Login[];
  canView: boolean;
  canEdit: boolean;
  providerId?: string;
  practiceId?: string;
}) {
  return (
    <Card title={`Portal logins (${logins.length})`}>
      {logins.length ? (
        <ul className="scroll-area divide-y divide-zinc-100">
          {logins.map((l) => (
            <li key={l.id} className="grid grid-cols-[90px_1fr_1fr_auto] items-center gap-3 px-4 py-2">
              <span className="flex items-center gap-1 text-xs font-semibold text-zinc-700">
                {l.portal}
                {l.url && (
                  <a href={l.url} target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-blue-600">
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </span>
              <CopyField label="Username" value={l.username} mono />
              <RevealField label="Password" masked={l.hasPassword ? "••••••••" : null} allowed={canView} reveal={revealPassword.bind(null, l.id)} />
              {canEdit ? (
                <ActionButton className="btn-ghost p-1" confirm={`Delete the ${l.portal} login?`} run={deleteLogin.bind(null, l.id)} title="Delete">
                  <Trash2 className="size-3.5" />
                </ActionButton>
              ) : (
                <span />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No portal logins saved.</Empty>
      )}
      {canEdit && (
        <div className="border-t border-zinc-100 px-4 py-3">
          <Disclosure label="Add login" className="btn-ghost px-2 py-1 text-xs">
            <LoginForm providerId={providerId} practiceId={practiceId} />
          </Disclosure>
        </div>
      )}
      {canView && logins.some((l) => l.hasPassword) && (
        <p className="border-t border-zinc-100 px-4 py-2 text-[11px] text-zinc-400">Passwords are encrypted. Each reveal is recorded in the audit log.</p>
      )}
    </Card>
  );
}
