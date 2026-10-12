import type { ReactNode } from "react";
import type { CurrentUser } from "@/lib/auth";
import { CommandPalette } from "./command-palette";
import { Sidebar } from "./sidebar";

/** Page frame for signed-in screens: fixed sidebar, sticky search bar, and a content column that never scrolls sideways. */
export function AppShell({ user, children }: { user: CurrentUser; children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <Sidebar user={user} />
      <div className="flex min-h-screen min-w-0 flex-col md:pl-56">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-zinc-200 bg-white/90 px-4 py-2.5 backdrop-blur md:px-6">
          <CommandPalette />
        </header>
        <main className="mx-auto w-full max-w-[1600px] min-w-0 flex-1 px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
