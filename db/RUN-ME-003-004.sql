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
-- ============================================================
-- 마이그레이션 004 · 전송량(egress) 절감용 변경감지 테이블
-- 기존 테이블은 건드리지 않고 "추가만" 합니다 → 기존 데이터 100% 안전
-- Supabase SQL Editor 에 붙여넣고 Run 하세요. (여러 번 실행해도 안전)
--
-- 배경: 4초 폴링이 매번 전 테이블(약 0.6MB)을 다시 읽어 하루 12GB 이상을
--       전송했고, 결국 요금제 쿼터를 초과해 서비스가 402 로 중단됐다.
--       아래 한 줄짜리 테이블에 "마지막 변경 시각"만 기록해두면,
--       폴링은 이 값(수십 바이트)만 확인하고 실제 변경이 있을 때만
--       전체 스냅샷을 받는다 → 평상시 폴링 비용이 약 1/6000 로 줄어든다.
-- ============================================================

create table if not exists data_version (
  id int  primary key,              -- 항상 1 (단일 행)
  v  bigint not null default 0      -- 마지막 쓰기 시각(ms). 값이 바뀌면 "누군가 수정함"
);

-- 단일 행 보장 (이미 있으면 그대로 둠)
insert into data_version (id, v) values (1, 0) on conflict (id) do nothing;
