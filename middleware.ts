import { NextResponse, NextRequest } from "next/server";

export default function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const isAuthRoute = url.pathname.startsWith("/api/auth/") || url.pathname === "/signin";
  const isPublicApi = url.pathname.startsWith("/api/webhooks/") || url.pathname.startsWith("/api/tiendanube/") || url.pathname.startsWith("/api/process-parser");

  if (isAuthRoute || isPublicApi) {
    return NextResponse.next();
  }

  const token = req.cookies.get("octos_session")?.value;
  if (!token) {
    url.pathname = "/signin";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)"],
};
