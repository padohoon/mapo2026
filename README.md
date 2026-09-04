# 마포 액션플랜

월리포트 날짜(앵커) 기준으로 마케팅 대행 업무를 자동 배치하는 일정 관리 앱.

## 스택
- Next.js 14 (App Router) + React 18
- Tailwind CSS 3.4 + 애플 스타일 리스킨(`app/globals.css`)
- (예정) Supabase(Postgres) · 팀 공용 비밀번호 인증 · Vercel 배포

## 개발
```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # 프로덕션 빌드 검증
```

## 구조
```
app/
  layout.tsx         # 루트 레이아웃 (globals.css)
  page.tsx           # MapoApp을 ssr:false로 동적 로드
  globals.css        # Tailwind + 애플 리스킨
components/
  MapoApp.jsx        # 메인 앱 (기존 mapo.html 로직 이식, 현재 인메모리 상태)
mapo.html            # 원본 프로토타입 (참고용 보존)
```

## 진행 현황 (로드맵)
- [x] **1단계** Next.js 스캐폴딩 + 기존 로직 이식 (인메모리 동작)
- [x] **2·3단계(코드)** Supabase 스키마 + 연결/자동저장 코드 완성 — Supabase 값만 넣으면 작동
- [ ] **연결** Supabase 프로젝트 생성 → 스키마 실행 → `.env.local` 설정 (아래)
- [x] **4단계** 팀 공용 비밀번호 인증(`middleware.ts` + `/login`)
- [x] **5단계** Vercel 배포 (GitHub `padohoon/mapo2026` 연결 · `git push` 시 자동 재배포)

## 배포 / 운영
- **저장소**: github.com/padohoon/mapo2026 (main 브랜치)
- **호스팅**: Vercel (Next.js 자동 감지). `git push` 하면 자동 재배포.
- **Vercel 환경변수 3개 필수**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_PASSWORD`
  - ⚠️ `APP_PASSWORD` 미설정 시 사이트가 무인증 공개됨
- 코드 수정 → 커밋 → 푸시 → 자동 배포. 환경변수 변경 시엔 Vercel 대시보드에서 수정 후 재배포.

## 인증 (팀 공용 비밀번호)
- `APP_PASSWORD` 환경변수로 켜짐/꺼짐. **설정하면** 모든 경로가 로그인 게이트로 보호됨. 없으면 인증 비활성(로컬 개발용).
- `/login` 에서 비밀번호 입력 → 검증 후 **httpOnly 서명 쿠키**(SHA-256, 30일) 발급 → `middleware.ts` 가 전 경로 검사.
- 로그아웃: 헤더 우측 "로그아웃" (`/api/logout` 쿠키 삭제).
- ⚠️ 배포 전 `APP_PASSWORD` 를 **본인 비밀번호로 변경**하세요 (로컬 `.env.local` + Vercel 환경변수 양쪽).

## ⚠️ 전송량(egress) 설계 — 폴링을 되돌리지 마세요

2026-09-04, Supabase egress 쿼터 초과(7.97/5GB)로 프로젝트가 정지되어 앱이 시드 화면으로
초기화된 것처럼 보이는 장애가 있었습니다. 원인은 **4초 폴링이 매번 전 테이블 스냅샷(약 0.6MB)을
다시 읽던 것** — 탭 1개당 하루 12.6GB, 4탭 기준 하루 54GB.

현재 구조는 이렇습니다:

- 쓰기가 일어나면 서버가 `data_version.v` 에 시각을 기록 (`lib/version.ts`)
- 폴링은 `GET /api/version` (**19 bytes**) 으로 먼저 확인 → 값이 그대로면 아무것도 받지 않음
- 값이 바뀐 경우에만 `GET /api/data` (약 0.5MB) 로 전체 스냅샷을 받음
- `/api/mutate` 가 새 `v` 를 돌려줘 자기 변경으로는 재조회하지 않음
- 2분 이상 유휴 시 폴링 주기 4초 → 16초

**폴링에서 `/api/version` 확인 단계를 빼면 곧바로 하루 수십 GB 규모로 돌아갑니다.**

## Supabase 연결 방법
1. [supabase.com](https://supabase.com) → **New project** 생성 (Region: `Northeast Asia (Seoul)` 권장)
2. **SQL Editor** 에 `db/schema.sql` 내용을 붙여넣고 **Run** (테이블 생성)
   그다음 **마이그레이션을 번호 순서대로 전부** 실행하세요. 전부 `if not exists` 라 재실행해도 안전합니다.

   | 파일 | 내용 | 안 하면 |
   |---|---|---|
   | `db/migration-002.sql` | 담당자·스텝 편집·업무 순서 | 담당자 관리/스텝 편집 저장 안 됨 |
   | `db/migration-003.sql` | 리포트 on/off, 개인업무 메모·반복, 상품 수량, 표시순서 | **에러 없이 조용히 저장만 안 됨** |
   | `db/migration-004.sql` | 변경감지(`data_version`) | 폴링이 매번 전체 스냅샷을 받아 전송량 폭증 |
   | `db/migration-005.sql` | 기존 테이블 RLS 켜기 | anon 키 유출 시 테이블이 통째로 열림 |

   > ⚠️ 003 은 반영되지 않아도 앱이 에러를 내지 않고 해당 기능만 조용히 저장을 건너뜁니다.
   > 실제로 2026-08-19 ~ 09-04 동안 미반영 상태로 방치됐습니다.
   > 화면 상단에 "마이그레이션 필요" 배너가 뜨면 밀린 마이그레이션이 있다는 뜻입니다.
3. **Project Settings → API** 에서 값 확인:
   - `Project URL`
   - `service_role` key (Reveal 후 복사 · 비밀키)
4. 프로젝트 루트에 `.env.local` 생성 (`.env.local.example` 참고):
   ```
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```
5. `npm run dev` 재시작 → 최초 실행 시 시드 데이터가 자동으로 DB에 채워지고,
   이후 모든 변경(고객사/연차/공휴일/개인업무/이동/완료/개별설정)이 자동 저장됩니다.

> 환경변수가 없으면 앱은 예전처럼 인메모리(새로고침 시 초기화)로 동작합니다.

## 데이터 저장 방식
- **원천만 저장**: `customers · leaves · holidays · personal_tasks · task_overrides(이동/완료) · step_overrides(개별설정)`
- 캘린더 배치는 DB 원천으로부터 **브라우저에서 계산**(`generateTasks` 로직). DB엔 계산 결과를 넣지 않음.
- 저장 방식은 **스냅샷 자동저장**: 변경 발생 → 0.7초 디바운스 → 전체 문서를 `PUT /api/data` 로 저장(각 테이블 통째 교체).
- ⚠️ **동시 편집 주의(v1)**: 여러 명이 동시에 수정하면 마지막 저장이 이깁니다(last-write-wins).
  소규모 내부용엔 충분하며, 필요 시 행 단위 저장으로 고도화 가능.
- `service_role` 키는 **서버(route handler)에서만** 사용 — 브라우저에 노출되지 않습니다.
