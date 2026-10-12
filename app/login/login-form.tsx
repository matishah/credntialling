"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { Submit } from "@/components/client";

export function LoginForm() {
  const [state, action] = useActionState(login, null);
  return (
    <form action={action} className="card space-y-4 p-5">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input" autoFocus />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Submit className="btn-primary w-full">Sign in</Submit>
    </form>
  );
}
