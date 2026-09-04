import type { SupabaseClient } from "@supabase/supabase-js";

// ── 데이터 변경 감지(전송량 절감) ──
// 쓰기가 일어날 때마다 data_version.v 를 "현재 시각(ms)" 로 갱신한다.
// 클라이언트 폴링은 이 값만 확인(수십 바이트)하고, 값이 바뀐 경우에만
// 전체 스냅샷(약 0.6MB)을 다시 받는다 → 평상시 폴링 egress 가 사실상 0 이 된다.
//
// 마이그레이션 004 전이면 테이블이 없다 → readVersion 은 null 을 반환하고
// 클라이언트는 "항상 전체 조회"하는 기존 동작으로 안전하게 폴백한다.

export async function readVersion(sb: SupabaseClient): Promise<number | null> {
  try {
    const r = await sb.from("data_version").select("v").eq("id", 1).maybeSingle();
    if (r.error || !r.data) return null;
    return Number((r.data as any).v) || 0;
  } catch {
    return null;
  }
}

// 쓰기 후 호출. 실패해도(테이블 없음 등) 본 작업에 영향을 주지 않도록 조용히 무시한다.
export async function bumpVersion(sb: SupabaseClient): Promise<number | null> {
  const v = Date.now();
  try {
    const r = await sb.from("data_version").upsert({ id: 1, v });
    if (r.error) return null;
    return v;
  } catch {
    return null;
  }
}
