import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Optimistic gate (docs/business-rules.md → Sign-in & access). Pages and server actions
// still check on the server via src/lib/dal.ts; this just sends people to the right place
// and returns a real 403 status for /admin/*.
export const proxy = auth((req) => {
  const { pathname, search } = req.nextUrl;
  const user = req.auth?.user;

  if (pathname === "/signin") {
    return user ? NextResponse.redirect(new URL("/", req.url)) : NextResponse.next();
  }

  if (!user) {
    const signin = new URL("/signin", req.url);
    signin.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(signin);
  }

  if (pathname.startsWith("/admin") && user.role !== "ORGANIZER") {
    return NextResponse.rewrite(new URL("/no-access", req.url), { status: 403 });
  }

  return NextResponse.next();
});

export const config = {
  // Everything except API routes (they check auth themselves) and static assets.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"],
};
