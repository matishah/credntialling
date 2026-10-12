"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, FileText, Search, UserRound } from "lucide-react";
import { STATUS } from "@/lib/labels";
import type { EnrollmentStatus } from "@/lib/db/schema";

type Results = {
  practices: { id: string; name: string; groupNpi: string | null; taxId: string | null }[];
  providers: { id: string; name: string; npi: string | null; specialty: string | null }[];
  enrollments: {
    id: string;
    payerName: string;
    providerName: string | null;
    practiceName: string;
    payerProviderId: string | null;
    status: EnrollmentStatus;
  }[];
};

type Item = { href: string; icon: "practice" | "provider" | "enrollment"; title: string; sub: string };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [active, setActive] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
    else {
      setQ("");
      setResults(null);
    }
  }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal });
        if (res.ok) {
          setResults(await res.json());
          setActive(0);
        }
      } catch {}
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const items: Item[] = useMemo(() => {
    if (!results) return [];
    return [
      ...results.practices.map((p) => ({
        href: `/practices/${p.id}`,
        icon: "practice" as const,
        title: p.name,
        sub: [p.groupNpi && `Group NPI ${p.groupNpi}`, p.taxId && `TIN ${p.taxId}`].filter(Boolean).join(" · "),
      })),
      ...results.providers.map((p) => ({
        href: `/providers/${p.id}`,
        icon: "provider" as const,
        title: p.name,
        sub: [p.npi && `NPI ${p.npi}`, p.specialty].filter(Boolean).join(" · "),
      })),
      ...results.enrollments.map((e) => ({
        href: `/enrollments/${e.id}`,
        icon: "enrollment" as const,
        title: `${e.payerName} – ${e.providerName ?? "Group"}`,
        sub: [e.practiceName, e.payerProviderId && `ID ${e.payerProviderId}`, STATUS[e.status].label].filter(Boolean).join(" · "),
      })),
    ];
  }, [results]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full max-w-md items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-400 shadow-xs hover:border-zinc-300"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search practices, providers, NPI, Tax ID, payer ID…</span>
        <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1.5 text-[10px] font-medium text-zinc-500">Ctrl K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-zinc-900/30 p-4 pt-[12vh]" onClick={() => setOpen(false)}>
          <div className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-zinc-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-zinc-100 px-4">
              <Search className="size-4 text-zinc-400" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => Math.min(a + 1, items.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(a - 1, 0));
                  } else if (e.key === "Enter" && items[active]) go(items[active].href);
                }}
                placeholder="Type a name, NPI, Tax ID, CAQH or payer ID…"
                className="w-full py-3 text-sm outline-none"
              />
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-1.5">
              {q.trim().length < 2 && <p className="px-3 py-6 text-center text-sm text-zinc-400">Start typing to search everything you have access to.</p>}
              {results && items.length === 0 && <p className="px-3 py-6 text-center text-sm text-zinc-400">No matches.</p>}
              {items.map((it, i) => {
                const Icon = it.icon === "practice" ? Building2 : it.icon === "provider" ? UserRound : FileText;
                return (
                  <button
                    key={it.href}
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(it.href)}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left ${i === active ? "bg-blue-50" : ""}`}
                  >
                    <Icon className="size-4 shrink-0 text-zinc-400" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-zinc-900">{it.title}</span>
                      {it.sub && <span className="block truncate text-xs text-zinc-500">{it.sub}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
