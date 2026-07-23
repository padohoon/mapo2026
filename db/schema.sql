-- ============================================================
-- 마포 액션플랜 · Supabase(Postgres) 스키마
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run 하면 됩니다.
-- 서버(route handler)가 service_role 키로만 접근하므로 RLS 정책은 불필요합니다.
-- (service_role 은 RLS 를 우회하며, 브라우저에는 anon 키조차 노출하지 않습니다)
-- ============================================================

-- 고객사 (원천 입력)
create table if not exists customers (
  id                   text primary key,
  name                 text not null,
  manager              text not null,
  reg_date             date not null,
  weekly_report_day    int  not null default 3,   -- 0=일 ~ 6=토
  monthly_report_date  int  not null default 5,   -- 월리포트 앵커 날짜
  products             text[] not null default '{}',  -- 상품 슬러그 배열
  mr_overrides         jsonb  not null default '{}'::jsonb  -- { "2026-07": 2 } 월별 월리포트 변경
);

-- 연차
create table if not exists leaves (
  id       bigint generated always as identity primary key,
  manager  text not null,
  date     date not null
);

-- 공휴일 (영업일 제외 계산에 사용)
create table if not exists holidays (
  date  date primary key,
  name  text not null
);

-- 직접 추가한 개인 업무
create table if not exists personal_tasks (
  id             text primary key,
  date           date not null,
  title          text not null,
  manager        text,
  customer_id    text,
  customer_name  text,
  done           boolean not null default false
);

-- 자동 생성 업무의 개인별 조정 (드래그로 옮긴 날짜 / 완료여부)
create table if not exists task_overrides (
  task_id  text primary key,   -- generateTasks 가 만드는 결정적 id
  date     date,               -- 옮긴 날짜 (없으면 기본 배치일)
  done     boolean             -- 완료여부
);

-- 담당자 개별설정 (상품 업무의 방식/값 덮어쓰기)
create table if not exists step_overrides (
  key   text primary key,      -- "고객사id|상품슬러그|스텝index"
  mode  text not null,         -- d | w | daily | md | wr
  arg   jsonb                  -- 숫자 또는 배열
);

-- 담당자 (추가/삭제 가능)
create table if not exists managers (
  name  text primary key,
  color text not null,
  ord   int  not null default 0
);

-- 고객사별 제외 세부업무
create table if not exists step_disabled (
  key text primary key
);

-- 고객사별 추가 세부업무
create table if not exists step_extras (
  key   text primary key,
  steps jsonb not null default '[]'::jsonb
);

-- 당일 업무 정렬 순서
create table if not exists task_order (
  task_id text primary key,
  ord     int not null default 0
);
