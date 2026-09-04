-- ============================================================
-- 마이그레이션 005 · 기존 테이블에 RLS(행 수준 보안) 켜기
-- Supabase SQL Editor 에 붙여넣고 Run 하세요. (여러 번 실행해도 안전)
--
-- 이 앱은 서버 route handler 가 service_role 키로만 접근하고,
-- service_role 은 RLS 를 우회합니다. 브라우저에는 anon 키를 아예 노출하지 않습니다.
-- → RLS 를 켜도 앱 동작에는 영향이 없고, 혹시라도 anon 키가 유출됐을 때
--   테이블이 통째로 열리는 것만 막아줍니다. 정책(policy)은 만들 필요가 없습니다.
--   (정책이 하나도 없는 상태 = anon/authenticated 접근 0, service_role 은 전체 접근)
--
-- ⚠️ 나중에 브라우저에서 anon 키로 직접 Supabase 를 호출하는 기능을 추가한다면,
--    그때는 이 테이블들에 맞는 policy 를 따로 만들어야 합니다.
-- ============================================================

alter table customers      enable row level security;
alter table leaves         enable row level security;
alter table holidays       enable row level security;
alter table personal_tasks enable row level security;
alter table task_overrides enable row level security;
alter table step_overrides enable row level security;
alter table managers       enable row level security;
alter table step_disabled  enable row level security;
alter table step_extras    enable row level security;
alter table task_order     enable row level security;
alter table product_qty    enable row level security;
