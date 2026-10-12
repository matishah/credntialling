import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg bg-zinc-900 text-sm font-bold text-white">CR</div>
          <h1 className="text-lg font-semibold">Credentialing</h1>
          <p className="text-sm text-zinc-500">Sign in to continue</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
