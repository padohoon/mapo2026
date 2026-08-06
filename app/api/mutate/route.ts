import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// ── POST /api/mutate ── 행 단위 부분 변경(동시 편집 안전). body: { ops: [{table, op, row?, match?}] }
export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ ok: false, configured: false });
  const body = await req.json().catch(() => ({}));
  const ops = Array.isArray(body.ops) ? body.ops : [];
  // 한 op 이 실패해도 나머지는 계속 처리하고, 실패 목록을 모아서 반환한다.
  // (앞 op 하나가 실패해서 뒤 op 들이 통째로 누락되던 문제 방지)
  const errors: string[] = [];
  for (const o of ops) {
    try {
      if (o.op === "upsert") {
        const r = await sb.from(o.table).upsert(o.row); // PK 충돌 시 갱신 → 재전송 안전
        if (r.error) errors.push(`${o.table}: ${r.error.message}`);
      } else if (o.op === "insert") {
        // 재전송 안전: 동일 행(모든 컬럼 일치)이 이미 있으면 건너뛴다 → 연차 중복 삽입 방지
        let sel: any = sb.from(o.table).select("*", { count: "exact", head: true });
        for (const k of Object.keys(o.row || {})) sel = sel.eq(k, o.row[k]);
        const exists = await sel;
        if (!exists.error && (exists.count || 0) > 0) continue; // 이미 존재 → skip
        const r = await sb.from(o.table).insert(o.row);
        if (r.error) errors.push(`${o.table}: ${r.error.message}`);
      } else if (o.op === "delete") {
        let q: any = sb.from(o.table).delete();
        const m = o.match || {};
        for (const k of Object.keys(m)) q = q.eq(k, m[k]);
        const r = await q; // 대상이 없어도 오류 아님 → 재전송 안전
        if (r.error) errors.push(`${o.table}: ${r.error.message}`);
      }
    } catch (e: any) {
      errors.push(String(e?.message || e));
    }
  }
  if (errors.length) return NextResponse.json({ ok: false, errors }, { status: 500 });
  return NextResponse.json({ ok: true });
}
