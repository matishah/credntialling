import type { ComponentType } from "react";
import { Building2, CalendarCheck, FileSpreadsheet, Landmark, ListChecks, LogOut, Receipt, Shield, UserRound } from "lucide-react";
import { can, type CurrentUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { NavLink } from "./client";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
  show?: (user: CurrentUser) => boolean;
};

const NAV: NavItem[] = [
  { href: "/", label: "Today", icon: CalendarCheck, exact: true },
  { href: "/practices", label: "Practices", icon: Building2 },
  { href: "/providers", label: "Providers", icon: UserRound },
  { href: "/enrollments", label: "Enrollments", icon: ListChecks },
  { href: "/invoicing", label: "Invoicing", icon: Receipt, show: (u) => can(u, "invoicing.manage") },
  { href: "/payers", label: "Payers", icon: Landmark },
  { href: "/import", label: "Import", icon: FileSpreadsheet, show: (u) => can(u, "import.run") },
  { href: "/admin", label: "Admin", icon: Shield, show: (u) => can(u, "users.manage") || can(u, "audit.view") },
];

/** Fixed to the viewport, so it stays put however far the page scrolls. */
export function Sidebar({ user }: { user: CurrentUser }) {
  const initials = user.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col bg-zinc-950 px-3 py-4 md:flex">
      <div className="mb-6 flex items-center gap-2 px-2">
        <div className="flex size-7 items-center justify-center rounded-md bg-blue-600 text-xs font-bold text-white">CR</div>
        <span className="text-sm font-semibold text-white">Credentialing</span>
      </div>

      <nav className="-mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1">
        {NAV.filter((item) => !item.show || item.show(user)).map(({ href, label, icon: Icon, exact }) => (
          <NavLink key={href} href={href} exact={exact}>
            <Icon className="size-4" /> {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 pt-3">
        <div className="flex items-center gap-2 px-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-[11px] font-semibold text-white">{initials}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-white">{user.name}</div>
            <div className="truncate text-[11px] text-zinc-400">{user.roleName}</div>
          </div>
          <form action={logout}>
            <button title="Sign out" className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
