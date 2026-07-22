import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, expectedToken } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const expected = await expectedToken();
  // APP_PASSWORD 미설정 → 인증 비활성(로컬 개발 편의)
  if (!expected) return NextResponse.next();

  const { pathname } = req.nextUrl;
  // 로그인 화면/엔드포인트는 통과
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/login") ||
    pathname.startsWith("/api/logout")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (token && token === expected) return NextResponse.next();

  // 미인증: API 는 401, 페이지는 /login 으로 리다이렉트
  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // 정적 자산을 제외한 모든 경로에 적용
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
