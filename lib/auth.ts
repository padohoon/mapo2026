// 팀 공용 비밀번호 인증 유틸 (미들웨어=edge, 라우트=node 양쪽에서 사용)
// crypto.subtle / TextEncoder 는 두 런타임 모두에서 전역 제공됨.

export const AUTH_COOKIE = "mapo_auth";

// 비밀번호로부터 쿠키에 저장할 토큰(SHA-256 해시)을 만든다.
// 쿠키가 유출돼도 원 비밀번호는 노출되지 않음.
export async function tokenFor(pw: string): Promise<string> {
  const data = new TextEncoder().encode("mapo::" + pw);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// APP_PASSWORD 가 설정돼 있으면 기대 토큰을 반환, 없으면 null(=인증 비활성).
export async function expectedToken(): Promise<string | null> {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return null;
  return tokenFor(pw);
}
