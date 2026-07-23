import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// ── GET /api/data ── 모든 원천 데이터를 앱 상태 형태(camelCase)로 반환
export async function GET() {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ configured: false });

  // 기존 6개 테이블 (반드시 존재)
  const [c, l, h, p, to, so] = await Promise.all([
    sb.from("customers").select("*"),
    sb.from("leaves").select("*"),
    sb.from("holidays").select("*").order("date"),
    sb.from("personal_tasks").select("*"),
    sb.from("task_overrides").select("*"),
    sb.from("step_overrides").select("*"),
  ]);
  const err = c.error || l.error || h.error || p.error || to.error || so.error;
  if (err) {
    return NextResponse.json({ configured: true, error: err.message }, { status: 500 });
  }

  // 새 4개 테이블 (마이그레이션 전이면 없을 수 있음 → 에러 시 빈 값으로 취급)
  const safe = async (fn: any) => {
    try {
      const r = await fn;
      return r.error ? [] : r.data || [];
    } catch {
      return [];
    }
  };
  const [mg, sd, se, tord] = await Promise.all([
    safe(sb.from("managers").select("*").order("ord")),
    safe(sb.from("step_disabled").select("*")),
    safe(sb.from("step_extras").select("*")),
    safe(sb.from("task_order").select("*")),
  ]);

  const customers = (c.data || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    manager: r.manager,
    regDate: r.reg_date,
    products: r.products || [],
    weeklyReportDay: r.weekly_report_day,
    monthlyReportDate: r.monthly_report_date,
    ...(r.mr_overrides && Object.keys(r.mr_overrides).length
      ? { mrOverrides: r.mr_overrides }
      : {}),
  }));
  const leaves = (l.data || []).map((r: any) => ({ manager: r.manager, date: r.date }));
  const holidays = (h.data || []).map((r: any) => [r.date, r.name]);
  const personalTasks = (p.data || []).map((r: any) => ({
    id: r.id,
    date: r.date,
    title: r.title,
    manager: r.manager,
    customerId: r.customer_id,
    customerName: r.customer_name,
    done: r.done,
  }));
  const overrides: Record<string, any> = {};
  (to.data || []).forEach((r: any) => {
    const o: any = {};
    if (r.date != null) o.date = r.date;
    if (r.done != null) o.done = r.done;
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

  return NextResponse.json({
    configured: true,
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
  });
}

// ── PUT /api/data ── 전체 문서를 받아 각 테이블을 통째로 교체(스냅샷 저장)
export async function PUT(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ ok: false, configured: false });

  const doc = await req.json();

  const customers = (doc.customers || []).map((x: any) => ({
    id: x.id,
    name: x.name,
    manager: x.manager,
    reg_date: x.regDate,
    weekly_report_day: x.weeklyReportDay,
    monthly_report_date: x.monthlyReportDate,
    products: x.products || [],
    mr_overrides: x.mrOverrides || {},
  }));
  const leaves = (doc.leaves || []).map((x: any) => ({ manager: x.manager, date: x.date }));
  const holidays = (doc.holidays || []).map((t: any) => ({ date: t[0], name: t[1] }));
  const personalTasks = (doc.personalTasks || []).map((x: any) => ({
    id: x.id,
    date: x.date,
    title: x.title,
    manager: x.manager,
    customer_id: x.customerId ?? null,
    customer_name: x.customerName ?? null,
    done: !!x.done,
  }));
  const taskOverrides = Object.entries(doc.overrides || {})
    .map(([task_id, v]: [string, any]) => ({
      task_id,
      date: v?.date ?? null,
      done: v?.done ?? null,
    }))
    .filter((r) => r.date != null || r.done != null);
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

  // 기존 테이블: 오류 시 실패(hard)
  const core: Array<[string, any[], string]> = [
    ["customers", customers, "id"],
    ["leaves", leaves, "id"],
    ["holidays", holidays, "date"],
    ["personal_tasks", personalTasks, "id"],
    ["task_overrides", taskOverrides, "task_id"],
    ["step_overrides", stepOverrides, "key"],
  ];
  for (const [table, rows, pk] of core) {
    const del = await sb.from(table).delete().not(pk, "is", null);
    if (del.error) {
      return NextResponse.json({ ok: false, error: `${table}: ${del.error.message}` }, { status: 500 });
    }
    if (rows.length) {
      const ins = await sb.from(table).insert(rows);
      if (ins.error) {
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
