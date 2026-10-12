import { NextResponse, type NextRequest } from "next/server";

// Optimistic gate only: bounce requests with no session cookie to /login.
// Real session + permission checks happen on the server in lib/auth.ts.
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("cred_session");
  if (!hasSession && !request.nextUrl.pathname.startsWith("/login")) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)"],
};
