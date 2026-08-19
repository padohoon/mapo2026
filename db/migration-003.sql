-- ============================================================
-- 마이그레이션 003 · 기능 추가용 컬럼/테이블
-- 기존 컬럼은 건드리지 않고 "추가만" 합니다 → 기존 데이터 100% 안전
-- Supabase SQL Editor 에 붙여넣고 Run 하세요. (여러 번 실행해도 안전 · IF NOT EXISTS)
-- ============================================================

-- 고객사: 표시순서 + 리포트 on/off
alter table customers add column if not exists ord        int     not null default 0;      -- 일정표 표시 순서
alter table customers add column if not exists no_weekly  boolean not null default false;  -- true = 주리포트 안 만듦
alter table customers add column if not exists no_monthly boolean not null default false;  -- true = 월리포트 안 만듦

-- 개인 업무: 비고(메모) + 반복 규칙
alter table personal_tasks add column if not exists memo         text;   -- 비고
alter table personal_tasks add column if not exists repeat       text;   -- null | 'weekly' | 'monthly'
alter table personal_tasks add column if not exists repeat_until date;   -- 반복 종료일 (없으면 시작일 + 6개월)

-- 자동 업무 조정: 비고(메모)
alter table task_overrides add column if not exists memo text;

-- 상품 수량(건수) — 고객사 × 상품 단위로 몇 건 세팅해야 하는지
create table if not exists product_qty (
  key text primary key,            -- "고객사id|상품슬러그"
  qty int not null default 0
);
