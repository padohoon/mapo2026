import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { readVersion } from "@/lib/version";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// ── GET /api/version ── "마지막 변경 시각"만 반환하는 초경량 엔드포인트.
// 폴링은 우선 이걸 호출하고, 값이 그대로면 전체 스냅샷을 받지 않는다.
// 응답이 수십 바이트라 4초 폴링을 유지해도 전송량이 문제되지 않는다.
//
// v === null 이면 마이그레이션 004 미반영 → 클라이언트는 기존처럼 전체 조회로 폴백.
export async function GET() {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ v: null });
  return NextResponse.json({ v: await readVersion(sb) });
}
