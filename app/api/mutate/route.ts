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
  for (const o of ops) {
    try {
      if (o.op === "upsert") {
        const r = await sb.from(o.table).upsert(o.row);
        if (r.error) return NextResponse.json({ ok: false, error: `${o.table}: ${r.error.message}` }, { status: 500 });
      } else if (o.op === "insert") {
        const r = await sb.from(o.table).insert(o.row);
        if (r.error) return NextResponse.json({ ok: false, error: `${o.table}: ${r.error.message}` }, { status: 500 });
      } else if (o.op === "delete") {
        let q: any = sb.from(o.table).delete();
        const m = o.match || {};
        for (const k of Object.keys(m)) q = q.eq(k, m[k]);
        const r = await q;
        if (r.error) return NextResponse.json({ ok: false, error: `${o.table}: ${r.error.message}` }, { status: 500 });
      }
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
