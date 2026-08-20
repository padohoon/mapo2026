import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// Supabase/PostgREST 는 한 번의 select 가 기본 1000행에서 잘린다.
// (task_overrides 처럼 행이 1000개를 넘으면 일부가 조용히 누락됨 → 저장한 체크/이동이 리로드에서 사라져 되돌아가는 버그)
// 아래 헬퍼로 1000행씩 끝까지 페이지네이션해서 "모든" 행을 가져온다.
const PAGE = 1000;
async function selectAll(sb: any, table: string, order?: string) {
  const all: any[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = sb.from(table).select("*").range(from, from + PAGE - 1);
    if (order) q = q.order(order);
    const r = await q;
    if (r.error) return { data: null, error: r.error };
    const rows = r.data || [];
    all.push(...rows);
    if (rows.length < PAGE) break; // 마지막 페이지
  }
  return { data: all, error: null };
}

// ── GET /api/data ── 모든 원천 데이터를 앱 상태 형태(camelCase)로 반환
export async function GET() {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ configured: false });

  // 기존 6개 테이블 (반드시 존재) — 1000행 제한 없이 전부 로드
  const [c, l, h, p, to, so] = await Promise.all([
    selectAll(sb, "customers"),
    selectAll(sb, "leaves"),
    selectAll(sb, "holidays", "date"),
    selectAll(sb, "personal_tasks"),
    selectAll(sb, "task_overrides"),
    selectAll(sb, "step_overrides"),
  ]);
  const err = c.error || l.error || h.error || p.error || to.error || so.error;
  if (err) {
    return NextResponse.json({ configured: true, error: err.message }, { status: 500 });
  }

  // 새 4개 테이블 (마이그레이션 전이면 없을 수 있음 → 에러 시 빈 값으로 취급)
  const safe = async (pr: Promise<any>) => {
    try {
      const r = await pr;
      return r.error ? [] : r.data || [];
    } catch {
      return [];
    }
  };
  const [mg, sd, se, tord, pq] = await Promise.all([
    safe(selectAll(sb, "managers", "ord")),
    safe(selectAll(sb, "step_disabled")),
    safe(selectAll(sb, "step_extras")),
    safe(selectAll(sb, "task_order")),
    safe(selectAll(sb, "product_qty")),
  ]);

  // 마이그레이션 003 반영 여부 프로브: customers.ord 컬럼과 product_qty 테이블이 실제로 존재하는지 확인.
  // 프론트는 이 값으로 "새 컬럼 전송 여부"를 결정 → 마이그레이션 전에도 기존 기능이 안전하게 저장됨.
  const probe = async (q: any) => {
    try { const r = await q; return !r.error; } catch { return false; }
  };
  const [hasOrd, hasQtyTable] = await Promise.all([
    probe(sb.from("customers").select("ord").limit(1)),
    probe(sb.from("product_qty").select("key").limit(1)),
  ]);
  const migrationDone = hasOrd && hasQtyTable;

  // 날짜 값을 항상 "YYYY-MM-DD" 로 정규화 (컬럼이 timestamp/timestamptz 로 돼있어도
  // 프론트가 쓰는 날짜 문자열과 형식이 어긋나 드래그 이동이 사라지던 문제 방지)
  const ymd = (v: any) => (v == null ? v : String(v).slice(0, 10));

  const customers = (c.data || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    manager: r.manager,
    regDate: ymd(r.reg_date),
    products: r.products || [],
    weeklyReportDay: r.weekly_report_day,
    monthlyReportDate: r.monthly_report_date,
    ord: r.ord ?? 0,
    noWeekly: r.no_weekly ?? false,
    noMonthly: r.no_monthly ?? false,
    ...(r.mr_overrides && Object.keys(r.mr_overrides).length
      ? { mrOverrides: r.mr_overrides }
      : {}),
  }));
  const leaves = (l.data || []).map((r: any) => ({ manager: r.manager, date: ymd(r.date) }));
  const holidays = (h.data || []).map((r: any) => [ymd(r.date), r.name]);
  const personalTasks = (p.data || []).map((r: any) => ({
    id: r.id,
    date: ymd(r.date),
    title: r.title,
    manager: r.manager,
    customerId: r.customer_id,
    customerName: r.customer_name,
    done: r.done,
    ...(r.memo ? { memo: r.memo } : {}),
    ...(r.repeat ? { repeat: r.repeat } : {}),
    ...(r.repeat_until ? { repeatUntil: ymd(r.repeat_until) } : {}),
  }));
  const overrides: Record<string, any> = {};
  (to.data || []).forEach((r: any) => {
    const o: any = {};
    if (r.date != null) o.date = ymd(r.date);
    if (r.done != null) o.done = r.done;
    if (r.memo != null) o.memo = r.memo;
    overrides[r.task_id] = o;
  });
  const managerSteps: Record<string, any> = {};
  (so.data || []).forEach((r: any) => {
    managerSteps[r.key] = { mode: r.mode, arg: r.arg };
  });

  const managers = (mg as any[]).map((r) => ({ name: r.name, color: r.color }));
  const stepDisabled: Record<string, boolean> = {};
  (sd as any[]).forEach((r) => {
    stepDisabled[r.key] = true;
  });
  const stepExtras: Record<string, any> = {};
  (se as any[]).forEach((r) => {
    stepExtras[r.key] = r.steps || [];
  });
  const taskOrder: Record<string, number> = {};
  (tord as any[]).forEach((r) => {
    taskOrder[r.task_id] = r.ord;
  });
  const productQty: Record<string, number> = {};
  (pq as any[]).forEach((r) => {
    productQty[r.key] = r.qty;
  });

  return NextResponse.json({
    configured: true,
    migrationDone,
    customers,
    leaves,
    holidays,
    personalTasks,
    overrides,
    managerSteps,
    managers,
    stepDisabled,
    stepExtras,
    taskOrder,
    productQty,
  });
}

// ── PUT /api/data ── 전체 문서를 받아 각 테이블을 통째로 교체(스냅샷 저장)
export async function PUT(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ ok: false, configured: false });

  const doc = await req.json();

  // 신규 컬럼(003)은 기본값이 아닐 때만 포함 → 마이그레이션 전 스냅샷 저장도 실패하지 않음
  const customers = (doc.customers || []).map((x: any, i: number) => {
    const r: any = {
      id: x.id,
      name: x.name,
      manager: x.manager,
      reg_date: x.regDate,
      weekly_report_day: x.weeklyReportDay,
      monthly_report_date: x.monthlyReportDate,
      products: x.products || [],
      mr_overrides: x.mrOverrides || {},
    };
    if (x.ord != null && x.ord !== 0) r.ord = x.ord; else if (i > 0) r.ord = i;
    if (x.noWeekly) r.no_weekly = true;
    if (x.noMonthly) r.no_monthly = true;
    return r;
  });
  const leaves = (doc.leaves || []).map((x: any) => ({ manager: x.manager, date: x.date }));
  const holidays = (doc.holidays || []).map((t: any) => ({ date: t[0], name: t[1] }));
  const personalTasks = (doc.personalTasks || []).map((x: any) => {
    const r: any = {
      id: x.id,
      date: x.date,
      title: x.title,
      manager: x.manager,
      customer_id: x.customerId ?? null,
      customer_name: x.customerName ?? null,
      done: !!x.done,
    };
    if (x.memo != null) r.memo = x.memo;
    if (x.repeat != null) r.repeat = x.repeat;
    if (x.repeatUntil != null) r.repeat_until = x.repeatUntil;
    return r;
  });
  const taskOverrides = Object.entries(doc.overrides || {})
    .map(([task_id, v]: [string, any]) => {
      const r: any = { task_id, date: v?.date ?? null, done: v?.done ?? null };
      if (v?.memo != null) r.memo = v.memo;
      return r;
    })
    .filter((r) => r.date != null || r.done != null || r.memo != null);
  const stepOverrides = Object.entries(doc.managerSteps || {}).map(
    ([key, v]: [string, any]) => ({ key, mode: v.mode, arg: v.arg ?? null })
  );

  // 새 슬라이스
  const managers = (doc.managers || []).map((m: any, i: number) => ({
    name: m.name,
    color: m.color,
    ord: i,
  }));
  const stepDisabled = Object.entries(doc.stepDisabled || {})
    .filter(([, v]) => !!v)
    .map(([key]) => ({ key }));
  const stepExtras = Object.entries(doc.stepExtras || {})
    .filter(([, v]: [string, any]) => Array.isArray(v) && v.length > 0)
    .map(([key, v]) => ({ key, steps: v }));
  const taskOrder = Object.entries(doc.taskOrder || {}).map(
    ([task_id, ord]: [string, any]) => ({ task_id, ord })
  );
  const productQty = Object.entries(doc.productQty || {})
    .filter(([, v]: [string, any]) => Number(v) > 0)
    .map(([key, v]: [string, any]) => ({ key, qty: Number(v) }));

  // 기존 테이블: 오류 시 실패(hard)
  const core: Array<[string, any[], string]> = [
    ["customers", customers, "id"],
    ["leaves", leaves, "id"],
    ["holidays", holidays, "date"],
    ["personal_tasks", personalTasks, "id"],
    ["task_overrides", taskOverrides, "task_id"],
    ["step_overrides", stepOverrides, "key"],
  ];
  // 스키마 미반영(마이그레이션 전) 오류는 하드 실패로 보지 않는다 (신규 컬럼/테이블 없음)
  const schemaMissing = (msg: string) => {
    const m = (msg || "").toLowerCase();
    return m.includes("schema cache") || m.includes("does not exist") || m.includes("could not find") || m.includes("column");
  };
  for (const [table, rows, pk] of core) {
    const del = await sb.from(table).delete().not(pk, "is", null);
    if (del.error && !schemaMissing(del.error.message)) {
      return NextResponse.json({ ok: false, error: `${table}: ${del.error.message}` }, { status: 500 });
    }
    if (rows.length) {
      const ins = await sb.from(table).insert(rows);
      if (ins.error && !schemaMissing(ins.error.message)) {
        return NextResponse.json({ ok: false, error: `${table}: ${ins.error.message}` }, { status: 500 });
      }
    }
  }

  // 새 테이블: 마이그레이션 전이면 없을 수 있음 → 오류는 무시(soft), 나머지는 계속 저장
  const extra: Array<[string, any[], string]> = [
    ["managers", managers, "name"],
    ["step_disabled", stepDisabled, "key"],
    ["step_extras", stepExtras, "key"],
    ["task_order", taskOrder, "task_id"],
    ["product_qty", productQty, "key"],
  ];
  for (const [table, rows, pk] of extra) {
    try {
      const del = await sb.from(table).delete().not(pk, "is", null);
      if (del.error) continue;
      if (rows.length) await sb.from(table).insert(rows);
    } catch {
      // 무시
    }
  }

  return NextResponse.json({ ok: true });
}
