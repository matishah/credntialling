"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, Copy, Eye, EyeOff, Loader2 } from "lucide-react";

type ActionState = { ok?: string; error?: string } | null;

// ---------- copy ----------

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      title={`Copy ${label ?? ""}`.trim()}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await navigator.clipboard.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      className="inline-flex size-6 shrink-0 items-center justify-center rounded text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
    >
      {done ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
    </button>
  );
}

/** Label + value + one-click copy. The core click-saver for filling payer portals. */
export function CopyField({ label, value, mono = false }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="group min-w-0">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="flex min-h-6 items-center gap-1">
        <span className={`truncate text-sm text-zinc-900 ${mono ? "font-mono" : ""}`} title={value ?? undefined}>
          {value || <span className="text-zinc-300">—</span>}
        </span>
        {value && <CopyButton value={value} label={label} />}
      </dd>
    </div>
  );
}

/** Masked value revealed through an audited server action. */
export function RevealField({
  label,
  masked,
  reveal,
  allowed,
}: {
  label: string;
  masked: string | null;
  reveal: () => Promise<string | null>;
  allowed: boolean;
}) {
  const [value, setValue] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="min-w-0">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="flex min-h-6 items-center gap-1">
        <span className="font-mono text-sm">{value ?? masked ?? <span className="text-zinc-300">—</span>}</span>
        {masked && allowed && (
          <button
            type="button"
            title={value ? "Hide" : "Reveal (logged)"}
            className="inline-flex size-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            onClick={() => {
              if (value) return setValue(null);
              start(async () => {
                try {
                  setValue(await reveal());
                  setTimeout(() => setValue(null), 30_000);
                } catch {
                  setError("Not allowed");
                }
              });
            }}
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : value ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        )}
        {value && <CopyButton value={value} label={label} />}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </dd>
    </div>
  );
}

// ---------- forms ----------

export function Submit({ children, className = "btn-primary" }: { children: ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

/** <form> bound to a server action with inline success / error feedback. */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  onSuccess,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const [shown, setShown] = useState<ActionState>(null);
  useEffect(() => {
    if (!state) return;
    setShown(state);
    if (state.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.();
    }
    const t = setTimeout(() => setShown(null), 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {shown?.error && <p className="mt-2 text-sm text-red-600">{shown.error}</p>}
      {shown?.ok && <p className="mt-2 text-sm text-emerald-700">{shown.ok}</p>}
    </form>
  );
}

/** Button that runs a server action (no form fields), with optional confirm. */
export function ActionButton({
  run,
  children,
  className = "btn-secondary",
  confirm,
  title,
}: {
  run: () => Promise<unknown>;
  children: ReactNode;
  className?: string;
  confirm?: string;
  title?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        title={title}
        className={className}
        disabled={pending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (confirm && !window.confirm(confirm)) return;
          setError(null);
          start(async () => {
            try {
              await run();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed");
            }
          });
        }}
      >
        {pending && <Loader2 className="size-3.5 animate-spin" />}
        {children}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </>
  );
}

/** Collapsible inline panel (used for "Edit" and "Add" forms). */
export function Disclosure({ label, children, className = "btn-secondary", open: initial = false }: { label: ReactNode; children: ReactNode; className?: string; open?: boolean }) {
  const [open, setOpen] = useState(initial);
  return (
    <div>
      <button type="button" className={className} onClick={() => setOpen((o) => !o)}>
        {label}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

export function NavLink({ href, children, exact = false }: { href: string; children: ReactNode; exact?: boolean }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition ${
        active ? "bg-white/10 font-medium text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}
