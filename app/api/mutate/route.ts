import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { bumpVersion } from "@/lib/version";

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
  //
  // ⚠️ 스키마 미반영(마이그레이션 전) 오류는 "소프트"로 취급한다.
  //    새 컬럼/테이블(memo, ord, product_qty 등)이 아직 없을 때, 그 op 하나 때문에 전체 배치가 500 이 되면
  //    클라이언트가 동기화 지점을 전진시키지 못해 "저장이 계속 실패한 것처럼" 되고, 이미 성공한 완료체크마저
  //    재전송 루프에 갇힌다. 이런 오류는 무시하고 나머지(핵심 데이터)는 정상 저장·확정되게 한다.
  const isSchemaMissing = (msg: string) => {
    const m = (msg || "").toLowerCase();
    return m.includes("schema cache") || m.includes("does not exist") || m.includes("could not find") || m.includes("column");
  };
  const errors: string[] = [];
  const softErrors: string[] = [];
  const note = (table: string, msg: string) => {
    if (isSchemaMissing(msg)) softErrors.push(`${table}: ${msg}`);
    else errors.push(`${table}: ${msg}`);
  };
  for (const o of ops) {
    try {
      if (o.op === "upsert") {
        const r = await sb.from(o.table).upsert(o.row); // PK 충돌 시 갱신 → 재전송 안전
        if (r.error) note(o.table, r.error.message);
      } else if (o.op === "insert") {
        // 재전송 안전: 동일 행(모든 컬럼 일치)이 이미 있으면 건너뛴다 → 연차 중복 삽입 방지
        let sel: any = sb.from(o.table).select("*", { count: "exact", head: true });
        for (const k of Object.keys(o.row || {})) sel = sel.eq(k, o.row[k]);
        const exists = await sel;
        if (!exists.error && (exists.count || 0) > 0) continue; // 이미 존재 → skip
        const r = await sb.from(o.table).insert(o.row);
        if (r.error) note(o.table, r.error.message);
      } else if (o.op === "delete") {
        let q: any = sb.from(o.table).delete();
        const m = o.match || {};
        for (const k of Object.keys(m)) q = q.eq(k, m[k]);
        const r = await q; // 대상이 없어도 오류 아님 → 재전송 안전
        if (r.error) note(o.table, r.error.message);
      }
    } catch (e: any) {
      note(o.table, String(e?.message || e));
    }
  }
  // 변경이 실제로 반영됐으면 "마지막 변경 시각"을 갱신 → 다른 탭의 폴링이 이걸 보고 전체 스냅샷을 받는다.
  // (ops 가 있었는데 하드 오류가 없으면 무언가 바뀐 것으로 본다)
  const v = ops.length && !errors.length ? await bumpVersion(sb) : null;

  // 하드 오류가 있을 때만 실패 처리. 스키마 미반영(소프트)만 있으면 ok:true 로 확정시켜 동기화가 멈추지 않게 한다.
  if (errors.length) return NextResponse.json({ ok: false, errors, softErrors }, { status: 500 });
  // v 를 돌려주면 호출한 탭은 "내가 만든 변경"으로 스스로를 다시 불러오지 않아도 된다(불필요한 0.6MB 재조회 방지).
  return NextResponse.json({ ok: true, ...(v != null ? { v } : {}), ...(softErrors.length ? { softErrors } : {}) });
}
