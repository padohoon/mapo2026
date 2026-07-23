-- ============================================================
-- 마이그레이션 002 · 기능 추가용 새 테이블 (기존 테이블은 변경 없음 → 데이터 안전)
-- Supabase SQL Editor 에 붙여넣고 Run 하세요.
-- ============================================================

-- 담당자 (추가/삭제 가능) — 이름과 색상
create table if not exists managers (
  name  text primary key,
  color text not null,          -- 예: "bg-rose-500"
  ord   int  not null default 0
);

-- 고객사별 "안 하는 세부업무" (제외 목록)
create table if not exists step_disabled (
  key text primary key          -- "고객사id|상품슬러그|스텝index"
);

-- 고객사별 "직접 추가한 세부업무" (상품 단위 배열)
create table if not exists step_extras (
  key   text primary key,       -- "고객사id|상품슬러그"
  steps jsonb not null default '[]'::jsonb  -- [{ name, mode, arg }]
);

-- 당일 업무 정렬 순서
create table if not exists task_order (
  task_id text primary key,
  ord     int not null default 0
);
