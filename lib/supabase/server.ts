import { createClient, SupabaseClient } from "@supabase/supabase-js";

// 서버 전용 Supabase 클라이언트.
// service_role 키는 절대 클라이언트로 노출하지 않습니다 (route handler 에서만 사용).
// 환경변수가 없으면 null 을 반환 → 앱은 인메모리(시드)로 동작합니다.
export function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Next.js App Router 는 fetch(GET)를 기본 캐싱함 → supabase-js 요청은 항상 최신값을 읽도록 no-store 강제
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, cache: "no-store" }),
    },
  });
}
