import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const ignore = ["/api","/_next","/favicon.ico","/robots.txt","/sitemap.xml",
                  "/assets","/qassets","/icons","/images"];
  if (ignore.some(p => pathname.startsWith(p))) return NextResponse.next();

  if (pathname === "/" || pathname.split("/").length !== 2) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = `/r${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = { matcher: "/:path*" };
