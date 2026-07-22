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
- [ ] **5단계** Vercel 배포

## 인증 (팀 공용 비밀번호)
- `APP_PASSWORD` 환경변수로 켜짐/꺼짐. **설정하면** 모든 경로가 로그인 게이트로 보호됨. 없으면 인증 비활성(로컬 개발용).
- `/login` 에서 비밀번호 입력 → 검증 후 **httpOnly 서명 쿠키**(SHA-256, 30일) 발급 → `middleware.ts` 가 전 경로 검사.
- 로그아웃: 헤더 우측 "로그아웃" (`/api/logout` 쿠키 삭제).
- ⚠️ 배포 전 `APP_PASSWORD` 를 **본인 비밀번호로 변경**하세요 (로컬 `.env.local` + Vercel 환경변수 양쪽).

## Supabase 연결 방법
1. [supabase.com](https://supabase.com) → **New project** 생성 (Region: `Northeast Asia (Seoul)` 권장)
2. **SQL Editor** 에 `db/schema.sql` 내용을 붙여넣고 **Run** (테이블 생성)
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
