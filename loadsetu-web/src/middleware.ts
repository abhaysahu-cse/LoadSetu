import { NextRequest, NextResponse } from "next/server";

// Routes that DON'T need authentication
const PUBLIC_ROUTES = ["/login", "/", "/api"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  // Check for token in cookie (httpOnly) OR
  // fall back to checking Authorization header for API calls
  const authCookie = request.cookies.get("accessToken");
  const authHeader = request.headers.get("Authorization");

  const isAuthenticated =
    authCookie?.value || authHeader?.startsWith("Bearer ");

  if (!isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Forward a fresh X-Request-ID so server components can log it
  const response = NextResponse.next();
  response.headers.set("X-Request-ID", crypto.randomUUID());
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
