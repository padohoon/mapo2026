'use client';
import React, { useState, useMemo } from 'react';


/* ──────────────────────────────────────────────
   마포 액션플랜 v2 · 월리포트 앵커 기반 업무 자동 배치
   - 앵커: 해당 월 월리포트 날짜 (매달 개별 변경 가능)
   - 디데이: 월리포트 기준 D±N 영업일 (마이너스 지원)
   - 반복: 매주 요일 / 매일 / 매월 특정일 / 주리포트 연동 / 수동설정
   - 공휴일 제외, 리포트는 공휴일 시 앞 영업일로 앞당김
   - 연차: 일반 업무는 전날로 이동, 리포트는 유지
   - 보기: 월간 캘린더 / 고객사별 주간, 오늘 강조·지난날 회색
────────────────────────────────────────────── */

// ---------- 날짜 유틸 ----------
const fmt = d => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};
const parse = s => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d, n) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const TODAY = fmt(new Date());
const DEFAULT_HOLIDAYS = [["2026-01-01", "신정"], ["2026-02-16", "설날 연휴"], ["2026-02-17", "설날"], ["2026-02-18", "설날 연휴"], ["2026-03-02", "삼일절 대체"], ["2026-05-05", "어린이날"], ["2026-05-25", "석가탄신일 대체"], ["2026-08-17", "광복절 대체"], ["2026-09-24", "추석 연휴"], ["2026-09-25", "추석"], ["2026-09-26", "추석 연휴"], ["2026-10-05", "개천절 대체"], ["2026-10-09", "한글날"], ["2026-12-25", "성탄절"]];

// ---------- 상품 템플릿 (실제 업무 정의 기반) ----------
// mode: d=월리포트 기준 D±N 영업일 / w=매주 요일 / daily=매일(영업일) / md=매월 특정일 / wr=주리포트 연동 / manual=수동설정
const T = (name, steps) => ({
  name,
  steps
});
const RAW_TEMPLATES = [T("정보성", [["슬라이드/분할 이미지 제작", "d", -3], ["슬라이드/분할 이미지 웹하드 업로드(작가 전달)", "d", -3], ["키워드 배분 요청", "d", -1], ["키워드 배분 확인", "d", -1], ["작가 주제 작성 요청", "d", -1], ["주제 고객사 컨펌", "d", 0], ["작가 작업 시작 요청", "d", 1], ["원고 검수 일정 배분", "d", 1], ["작가 업로드 확인", "w", [3]]]), T("스블", [["콘텐츠 카테고리 선정", "d", -5], ["키워드 배분 및 제목짓기 요청", "d", -5], ["키워드 배분 및 제목짓기 확인", "d", -5], ["스블플 원고 제작", "d", -4], ["스블플 원고 발행", "d", -4], ["발행 결과 저장", "d", -3]]), T("브블", [["슬라이드/분할 이미지 제작", "d", -3], ["슬라이드/분할 이미지 웹하드 업로드(작가 전달)", "d", -3], ["콘텐츠 카테고리 선정", "d", -2], ["키워드 배분", "d", -2], ["작가 작업 시작 안내", "d", -1], ["작가 업로드 확인", "w", [3]]]), T("메인 상노", [["노출 체크 및 보고", "md", [1]], ["콘텐츠 업데이트 확인", "d", 0], ["지출 등록", "d", 0]]), T("카페 상노", [["사진 외주 전달", "md", [1]], ["외주 원고 검수", "md", [1]], ["고객사 원고 컨펌", "md", [1]], ["외주 원고 전달 후 작업 요청", "md", [1]], ["노출 체크 및 보고", "md", [1]], ["댓글 체크", "w", [4]], ["지출 등록", "d", 0]]), T("카페바이럴", [["전후 사진 고객사 요청", "d", -10], ["시술별 수량 나누기", "d", -7], ["사진 배분 및 포토샵", "d", -7], ["키워드 배분", "d", -6], ["원고 요청", "d", -6], ["원고 검수 1차", "d", -3], ["원고 검수 2차", "d", -2], ["원고 고객사 컨펌", "d", 0], ["원고 작업 요청", "d", 2], ["지출 등록", "d", 0]]), T("카페 댓글", [["댓글 모니터링", "w", [4]], ["댓글 문구 작성", "w", [4]], ["고객사 컨펌", "w", [4]], ["외주 작업 요청", "w", [4]], ["지출 등록", "d", 0]]), T("기자단", [["고객사 사진 요청", "d", -10], ["사진 보정 및 배분", "d", -7], ["원고 작성 맡기기", "d", 0], ["유지사장님 지출 등록", "d", 0], ["원고 검수", "d", 7], ["고객사 컨펌", "d", 7], ["업로드 요청", "d", 8], ["노출 보고", "d", 9], ["리포트 시트 업데이트", "d", 9]]), T("체험단", [["단톡확인(노출/보고)", "daily"], ["모집 시술 확인", "d", -14], ["모집 요청(외주)", "d", -14], ["선정 요청", "d", 0], ["선정 후 외주 재전달", "d", 1], ["원고 검수 및 컨펌 요청", "d", 14], ["업로드 요청", "d", 15], ["리포트 시트 업데이트", "wr"], ["웹하드 사진 확인", "wr"], ["지출 등록", "d", 0]]), T("리뷰", [["원고 작성 요청", "d", -12], ["날짜 배분", "d", -6], ["사진 배분", "d", -6], ["원고 검수", "d", -5], ["고객사 컨펌 요청", "d", -5], ["외주 작업 요청", "d", 0], ["외주 지출 등록", "d", 0]]), T("건바이", [["자료 다운로드", "w", [1]], ["이미지 변경 및 원고 검수", "w", [1]], ["이미지 슬라이드 제작", "w", [1]], ["작가 자료 전달 + 업로드 요청", "w", [1]], ["업로드 확인", "w", [3]], ["노출 체크", "w", [4]], ["노출 보고", "w", [5]]]), T("다채널", [["업로드 확인", "w", [3]], ["리포트 추가", "d", 0], ["보고 및 정산 요청", "d", 0], ["지출 등록", "md", [28]]]), T("AIO", [["메인 키워드 검색 후 노출 보고", "md", [1, 15]], ["도메인 및 질의어 지출", "d", 0]]), T("SEO", [["키워드 노출 체크", "wr"], ["메인 키워드 노출 보고", "wr"], ["지출 등록", "d", 0]]), T("플레이스 상위노출", [["노출 체크", "daily"], ["지출 등록", "d", 0]]), T("플레이스 관리", [["노출 체크", "daily"], ["언더더딜 연장", "wr"], ["겟픽 충전", "wr"], ["겟픽 연장", "wr"], ["제이미 지출 요청", "wr"]]), T("당근 소식", [["고객사 이벤트 확인", "d", -2], ["카드뉴스 제작 요청", "d", 1], ["원고 및 제목 요청", "d", 1], ["원고 및 제목 검수", "d", 1], ["고객사 컨펌", "d", 2], ["외주 작업 요청", "d", 2], ["지출 등록", "d", 0]]), T("당근 동네생활", [["원고 작성 요청", "d", -12], ["원고 검수", "d", -5], ["고객사 컨펌", "d", -5], ["외주 작업 요청", "d", 0], ["노출 보고", "d", 2], ["리포트시트 업데이트", "d", 2], ["지출 등록", "d", 0]]), T("당근 후기", [["원고 작성 요청", "d", -15], ["원고 검수 및 사진 추가", "d", -5], ["고객사 컨펌", "d", -5], ["외주 작업 요청", "d", 0], ["지출 등록", "d", 0]]), T("대다모", [["전후 사진 고객사 요청", "d", -15], ["사진 배분 및 포토샵", "d", -10], ["외주 등업용 아이디 요청", "d", -10], ["고객사 아이디 등업 요청", "d", -10], ["원고 요청", "d", -8], ["원고 검수", "d", -6], ["원고 고객사 컨펌", "d", -6], ["원고 작업 요청", "d", 0], ["지출 등록", "d", 0]]), T("스레드", [["전후사진 요청 및 전달", "w", [1]], ["고객사 계정 확인", "daily"], ["지출 등록", "d", 0]]), T("숏폼", [["촬영일자 잡기", "manual"], ["협업툴 등록", "manual"], ["톡방 전달", "manual"], ["성과보고", "daily"]]), T("최블", [["디자인 확인", "d", 0], ["이미지 영상 제작", "d", 0], ["키워드 선정", "d", 0], ["인트라넷 건바이 등록", "d", 0], ["작가 작업 요청", "d", 0], ["최블 원고 8건 확인", "d", 7], ["최블 업로드", "w", [2, 4, 5]], ["노출 체크", "w", [2, 4, 5]]]), T("리포트 루틴", [["CAC 체크", "w", [4]], ["정산요청", "d", 0], ["사무보조 일정 추가", "d", -1]])];
const CHIP_PALETTE = [{
  chip: "bg-blue-100 text-blue-800 border-blue-200"
}, {
  chip: "bg-teal-100 text-teal-800 border-teal-200"
}, {
  chip: "bg-amber-100 text-amber-800 border-amber-200"
}, {
  chip: "bg-violet-100 text-violet-800 border-violet-200"
}, {
  chip: "bg-orange-100 text-orange-800 border-orange-200"
}, {
  chip: "bg-lime-100 text-lime-800 border-lime-200"
}, {
  chip: "bg-sky-100 text-sky-800 border-sky-200"
}, {
  chip: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200"
}, {
  chip: "bg-cyan-100 text-cyan-800 border-cyan-200"
}, {
  chip: "bg-stone-200 text-stone-700 border-stone-300"
}, {
  chip: "bg-emerald-100 text-emerald-800 border-emerald-200"
}, {
  chip: "bg-indigo-100 text-indigo-800 border-indigo-200"
}];
// 상품 고정 슬러그 (템플릿 순서와 무관하게 저장 키를 안정적으로 유지)
// RAW_TEMPLATES 순서와 1:1 대응. 순서를 바꾸면 이 배열도 함께 맞춰야 함.
const PRODUCT_KEYS = ["info", "sb", "bb", "main-rank", "cafe-rank", "cafe-viral", "cafe-reply", "press", "trial", "review", "gunbai", "multi", "aio", "seo", "place-rank", "place-manage", "carrot-news", "carrot-local", "carrot-review", "daedamo", "threads", "shortform", "choebl", "report-routine"];
const PRODUCTS = RAW_TEMPLATES.map((t, i) => ({
  id: PRODUCT_KEYS[i],
  name: t.name,
  color: CHIP_PALETTE[i % CHIP_PALETTE.length],
  steps: t.steps.map(([name, mode, arg]) => ({
    name,
    mode,
    arg
  }))
}));
const stepLabel = s => {
  if (s.mode === "d") return `월리포트 D${s.arg >= 0 ? "+" : ""}${s.arg}`;
  if (s.mode === "w") return `매주 ${s.arg.map(w => WEEKDAYS[w]).join("·")}`;
  if (s.mode === "daily") return "매일";
  if (s.mode === "md") return `매월 ${s.arg.join("·")}일`;
  if (s.mode === "wr") return "주리포트 연동";
  return "수동설정";
};
const MANAGERS = ["유나", "클로이", "대니", "조이", "써니", "리즈", "벨"];
const MANAGER_COLORS = {
  유나: "bg-rose-500",
  클로이: "bg-indigo-500",
  대니: "bg-emerald-600",
  조이: "bg-amber-500",
  써니: "bg-cyan-600",
  리즈: "bg-fuchsia-500",
  벨: "bg-slate-500"
};
// 담당자 추가 시 배정할 색 팔레트
const MANAGER_PALETTE = ["bg-rose-500", "bg-indigo-500", "bg-emerald-600", "bg-amber-500", "bg-cyan-600", "bg-fuchsia-500", "bg-slate-500", "bg-teal-500", "bg-orange-500", "bg-lime-600", "bg-sky-500", "bg-violet-500", "bg-pink-500"];
const DEFAULT_MANAGERS = MANAGERS.map((n) => ({ name: n, color: MANAGER_COLORS[n] }));
// 고객사 행 색 (고객사별 보기용)
const CUST_ROW = [{
  row: "bg-orange-50",
  tag: "bg-orange-200 text-orange-900"
}, {
  row: "bg-rose-50",
  tag: "bg-rose-200 text-rose-900"
}, {
  row: "bg-sky-50",
  tag: "bg-sky-200 text-sky-900"
}, {
  row: "bg-emerald-50",
  tag: "bg-emerald-200 text-emerald-900"
}, {
  row: "bg-violet-50",
  tag: "bg-violet-200 text-violet-900"
}, {
  row: "bg-yellow-50",
  tag: "bg-yellow-200 text-yellow-900"
}];
const findProd = name => PRODUCTS.find(p => p.name === name).id;
const SEED_CUSTOMERS = [{
  id: "c1",
  name: "리뉴얼의원",
  manager: "유나",
  regDate: "2026-07-01",
  products: [findProd("정보성"), findProd("카페바이럴"), findProd("체험단"), findProd("플레이스 관리"), findProd("리포트 루틴")],
  weeklyReportDay: 3,
  monthlyReportDate: 2
}, {
  id: "c2",
  name: "비아프의원",
  manager: "클로이",
  regDate: "2026-07-01",
  products: [findProd("스블"), findProd("기자단"), findProd("리뷰"), findProd("SEO"), findProd("리포트 루틴")],
  weeklyReportDay: 5,
  monthlyReportDate: 23
}];
const SEED_LEAVES = [{
  manager: "유나",
  date: "2026-07-17"
}];
const mondayOf = d => {
  const r = new Date(d);
  const dow = (r.getDay() + 6) % 7;
  return addDays(r, -dow);
};

// ---------- 메인 앱 ----------
function App({ initialData, onPersist }) {
  const [customers, setCustomers] = useState(initialData.customers);
  const [leaves, setLeaves] = useState(initialData.leaves);
  const [holidays, setHolidays] = useState(initialData.holidays);
  const [viewYM, setViewYM] = useState(() => {
    const t = new Date();
    return {
      y: t.getFullYear(),
      m: t.getMonth()
    };
  });
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [viewMode, setViewMode] = useState("month"); // month | byCustomer
  const [managerFilter, setManagerFilter] = useState("전체");
  const [customerFilter, setCustomerFilter] = useState("전체");
  const [overrides, setOverrides] = useState(initialData.overrides);
  const [selected, setSelected] = useState(null);
  const [dayOpen, setDayOpen] = useState(null); // 날짜 상세 목록
  const [panel, setPanel] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  // 고객사별 업무 오버라이드: { "c1|p7|2": {mode:"d", arg:5} 또는 {mode:"w", arg:[3]} }
  // 없으면 상품 기본 스텝을 따름. 방식(mode)과 값(arg) 모두 고객사별로 덮어쓸 수 있음
  const [managerSteps, setManagerSteps] = useState(initialData.managerSteps);
  const [settingsCustomer, setSettingsCustomer] = useState(null); // 업무 설정 탭에서 선택된 고객사 id
  const [settingsProd, setSettingsProd] = useState(null); // 편집 중인 상품 id
  // 사용자가 직접 추가하는 개인 업무: { id, date, title, manager, done }
  const [personalTasks, setPersonalTasks] = useState(initialData.personalTasks);
  const [addTaskDate, setAddTaskDate] = useState(null); // 개인업무 추가 대상 날짜
  const [managers, setManagers] = useState(initialData.managers); // [{name,color}]
  const [stepDisabled, setStepDisabled] = useState(initialData.stepDisabled); // { "cid|pid|si": true }
  const [stepExtras, setStepExtras] = useState(initialData.stepExtras); // { "cid|pid": [{name,mode,arg}] }
  const [taskOrder, setTaskOrder] = useState(initialData.taskOrder); // { taskId: number }

  const managerNames = managers.map((m) => m.name);
  const colorOf = (name) => (managers.find((m) => m.name === name) || {}).color || "bg-slate-500";

  // ── DB 자동저장: 상태가 바뀌면 디바운스 후 전체 문서를 서버에 스냅샷 저장 ──
  const _firstSave = React.useRef(true);
  const _pending = React.useRef(null); // 아직 저장 안 된 최신 문서
  const [saving, setSaving] = useState(false);
  React.useEffect(() => {
    if (_firstSave.current) {
      _firstSave.current = false;
      return;
    }
    if (!onPersist) return; // Supabase 미설정 시 인메모리로만 동작
    const doc = { customers, leaves, holidays, overrides, managerSteps, personalTasks, managers, stepDisabled, stepExtras, taskOrder };
    _pending.current = doc;
    const h = setTimeout(async () => {
      const d = _pending.current;
      if (!d) return;
      _pending.current = null;
      setSaving(true);
      await onPersist(d);
      setSaving(false);
    }, 500);
    return () => clearTimeout(h);
  }, [customers, leaves, holidays, overrides, managerSteps, personalTasks, managers, stepDisabled, stepExtras, taskOrder, onPersist]);
  // 새로고침/이탈 시 아직 저장 안 된 변경을 즉시 전송(keepalive) → 빨리 새로고침해도 유실 방지
  React.useEffect(() => {
    const flush = () => {
      if (_pending.current && onPersist) {
        onPersist(_pending.current, true);
        _pending.current = null;
      }
    };
    window.addEventListener("beforeunload", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, [onPersist]);

  const holidayMap = useMemo(() => {
    const m = new Map();
    holidays.forEach(([d, n]) => m.set(d, n));
    return m;
  }, [holidays]);
  const isBiz = d => d.getDay() !== 0 && d.getDay() !== 6 && !holidayMap.has(fmt(d));
  const nextBiz = d => {
    let r = new Date(d);
    while (!isBiz(r)) r = addDays(r, 1);
    return r;
  };
  const prevBiz = d => {
    let r = new Date(d);
    while (!isBiz(r)) r = addDays(r, -1);
    return r;
  };
  const addBiz = (start, n) => {
    let r = new Date(start);
    while (n > 0) {
      r = addDays(r, 1);
      if (isBiz(r)) n--;
    }
    return r;
  };
  const subBiz = (start, n) => {
    let r = new Date(start);
    while (n > 0) {
      r = addDays(r, -1);
      if (isBiz(r)) n--;
    }
    return r;
  };
  const leaveSet = useMemo(() => new Set(leaves.map(l => `${l.manager}|${l.date}`)), [leaves]);
  const isOnLeave = (mg, ds) => leaveSet.has(`${mg}|${ds}`);
  const prevBizNotLeave = (d, mg) => {
    let r = prevBiz(d);
    while (isOnLeave(mg, fmt(r))) r = prevBiz(addDays(r, -1));
    return r;
  };
  // 일반 업무 공통 보정: 휴일 → 다음 영업일, 연차 → 전날(앞 영업일)
  const placeGeneral = (d, mg) => {
    let date = d,
      shifted = null;
    if (!isBiz(date)) {
      date = nextBiz(date);
      shifted = "휴일로 이동";
    }
    if (isOnLeave(mg, fmt(date))) {
      date = prevBizNotLeave(addDays(date, -1), mg);
      shifted = "연차 전날로 이동";
    }
    return {
      date,
      shifted
    };
  };

  // ---------- 업무 자동 생성 ----------
  const tasks = useMemo(() => {
    const out = [];
    const keys = new Set();
    const addMonth = (yy, mm) => {
      const d = new Date(yy, mm, 1);
      keys.add(`${d.getFullYear()}-${d.getMonth()}`);
    };
    [-1, 0, 1].forEach(k => addMonth(viewYM.y, viewYM.m + k));
    [-1, 0, 1].forEach(k => addMonth(weekStart.getFullYear(), weekStart.getMonth() + k));
    const months = [...keys].map(s => s.split("-").map(Number));
    customers.forEach(c => {
      const reg = parse(c.regDate);
      months.forEach(([yy, mm]) => {
        const dim = new Date(yy, mm + 1, 0).getDate();
        const ymKey = `${yy}-${String(mm + 1).padStart(2, "0")}`;
        const cycleKey = `${yy}-${mm}`;

        // ① 월리포트 배치일 (앵커) — 매달 개별 설정 가능 · 휴일이면 앞당김
        const mrDate = c.mrOverrides && c.mrOverrides[ymKey] || c.monthlyReportDate;
        const mrTarget = new Date(yy, mm, Math.min(mrDate, dim));
        let mrPlaced = null;
        if (mrTarget >= reg) {
          let date = mrTarget,
            shifted = null;
          if (!isBiz(mrTarget)) {
            const pulled = prevBiz(addDays(mrTarget, -1));
            if (pulled >= reg) {
              date = pulled;
              shifted = "휴일 → 앞 영업일로 앞당김";
            } else {
              date = nextBiz(mrTarget);
              shifted = "휴일로 이동";
            }
          }
          mrPlaced = date;
          out.push({
            id: `${c.id}|mr|${cycleKey}`,
            customer: c,
            product: null,
            step: "월리포트",
            baseDate: fmt(date),
            shifted,
            isReport: true,
            onLeaveDay: isOnLeave(c.manager, fmt(date)),
            mode: `${mm + 1}월분: ${mrDate}일 기준 (연차여도 유지 · 매달 변경 가능)`
          });
        }

        // ② 주리포트 배치일 목록 — 휴일이면 앞당김 · 연차여도 유지
        const wrDates = [];
        for (let dd = 1; dd <= dim; dd++) {
          const d = new Date(yy, mm, dd);
          if (d < reg || d.getDay() !== c.weeklyReportDay) continue;
          let date = d,
            shifted = null;
          if (!isBiz(d)) {
            const pulled = prevBiz(addDays(d, -1));
            if (pulled >= reg) {
              date = pulled;
              shifted = "휴일 → 앞 영업일로 앞당김";
            } else {
              date = nextBiz(d);
              shifted = "휴일로 이동";
            }
          }
          wrDates.push(date);
          out.push({
            id: `${c.id}|wr|${fmt(d)}`,
            customer: c,
            product: null,
            step: "주리포트",
            baseDate: fmt(date),
            shifted,
            isReport: true,
            onLeaveDay: isOnLeave(c.manager, fmt(date)),
            mode: `매주 ${WEEKDAYS[c.weeklyReportDay]}요일 (연차여도 유지)`
          });
        }

        // ③ 상품별 업무
        c.products.forEach(pid => {
          const prod = PRODUCTS.find(p => p.id === pid);
          if (!prod) return;
          // 기본 스텝 + 고객사별 추가 업무(extras). extras 는 기본 스텝 뒤 인덱스로 이어붙임
          const extras = stepExtras[`${c.id}|${pid}`] || [];
          const baseLen = prod.steps.length;
          const allSteps = extras.length ? [...prod.steps, ...extras] : prod.steps;
          allSteps.forEach((s0, si) => {
            // 고객사별로 제외한 기본 업무는 건너뜀
            if (si < baseLen && stepDisabled[`${c.id}|${pid}|${si}`]) return;
            const push = (date, shifted, idSuffix, modeText) => out.push({
              id: `${c.id}|${pid}|${si}|${idSuffix}`,
              customer: c,
              product: prod,
              step: s0.name,
              baseDate: fmt(date),
              shifted,
              isReport: false,
              mode: modeText
            });

            // 고객사별 오버라이드 적용: 방식(mode)과 값(arg)을 통째로 덮어씀
            const ovKey = `${c.id}|${pid}|${si}`;
            const ov = managerSteps[ovKey];
            const customized = !!ov;
            const s = ov ? {
              name: s0.name,
              mode: ov.mode,
              arg: ov.arg
            } : s0;
            const tag = customized ? ` (${c.name} 개별설정)` : "";
            if (s.mode === "d") {
              if (!mrPlaced) return;
              const effArg = s.arg;
              const base = effArg >= 0 ? addBiz(mrPlaced, effArg) : subBiz(mrPlaced, -effArg);
              const {
                date,
                shifted
              } = placeGeneral(base, c.manager);
              if (date < reg) return;
              push(date, customized ? shifted || "담당자 개별설정 적용" : shifted, cycleKey, `월리포트 D${effArg >= 0 ? "+" : ""}${effArg} 영업일${tag}`);
            } else if (s.mode === "w") {
              const wd = Array.isArray(s.arg) ? s.arg : [s.arg];
              for (let dd = 1; dd <= dim; dd++) {
                const d = new Date(yy, mm, dd);
                if (d < reg || !wd.includes(d.getDay())) continue;
                const {
                  date,
                  shifted
                } = placeGeneral(d, c.manager);
                push(date, customized ? shifted || "담당자 개별설정 적용" : shifted, `w${fmt(d)}`, `매주 ${wd.map(w => WEEKDAYS[w]).join("·")}요일 반복${tag}`);
              }
            } else if (s.mode === "daily") {
              for (let dd = 1; dd <= dim; dd++) {
                const d = new Date(yy, mm, dd);
                if (d < reg || !isBiz(d)) continue;
                if (isOnLeave(c.manager, fmt(d))) continue; // 매일 업무는 연차일 생략
                push(d, null, `dl${fmt(d)}`, `매일 (영업일)${tag}`);
              }
            } else if (s.mode === "md") {
              const days = Array.isArray(s.arg) ? s.arg : [s.arg];
              days.forEach(mdDay => {
                const d = new Date(yy, mm, Math.min(mdDay, dim));
                if (d < reg) return;
                const {
                  date,
                  shifted
                } = placeGeneral(d, c.manager);
                push(date, shifted, `md${mdDay}|${cycleKey}`, `매월 ${mdDay}일${tag}`);
              });
            } else if (s.mode === "wr") {
              wrDates.forEach(wd => {
                let date = wd,
                  shifted = null;
                if (isOnLeave(c.manager, fmt(date))) {
                  date = prevBizNotLeave(addDays(date, -1), c.manager);
                  shifted = "연차 전날로 이동";
                }
                push(date, shifted, `wr${fmt(wd)}`, `주리포트 연동${tag}`);
              });
            }
            // manual: 자동 생성하지 않음 (수동설정)
          });
        });
      });
    });
    return out;
  }, [customers, viewYM, weekStart, holidayMap, leaveSet, managerSteps, stepDisabled, stepExtras]);
  const finalTasks = useMemo(() => {
    const auto = tasks.map(t => {
      const ov = overrides[t.id] || {};
      return {
        ...t,
        date: ov.date || t.baseDate,
        done: !!ov.done,
        edited: !!ov.date
      };
    });
    // 개인 업무를 태스크 형태로 변환 (고객사 없이 담당자만 있을 수 있음)
    const personal = personalTasks.map(pt => {
      const ov = overrides[pt.id] || {};
      return {
        id: pt.id,
        personal: true,
        product: null,
        isReport: false,
        step: pt.title,
        customer: {
          id: pt.customerId || "__personal__",
          name: pt.customerName || "개인업무",
          manager: pt.manager
        },
        baseDate: pt.date,
        date: ov.date || pt.date,
        done: ov.done !== undefined ? !!ov.done : !!pt.done,
        edited: !!ov.date,
        shifted: null,
        mode: "직접 추가한 업무"
      };
    });
    return [...auto, ...personal];
  }, [tasks, overrides, personalTasks]);
  const passFilter = t => (managerFilter === "전체" || t.customer.manager === managerFilter) && (customerFilter === "전체" || t.customer.id === customerFilter || t.personal);
  const byDate = useMemo(() => {
    const map = new Map();
    finalTasks.forEach(t => {
      if (!passFilter(t)) return;
      if (!map.has(t.date)) map.set(t.date, []);
      map.get(t.date).push(t);
    });
    map.forEach(arr => arr.sort((a, b) => {
      // ① 완료(체크)된 업무는 그날 맨 아래로
      if (!!a.done !== !!b.done) return a.done ? 1 : -1;
      // ② 사용자가 지정한 당일 순서(taskOrder)가 있으면 그 순서
      const ao = taskOrder[a.id], bo = taskOrder[b.id];
      if (ao != null && bo != null) return ao - bo;
      if (ao != null) return -1;
      if (bo != null) return 1;
      // ③ 기본: 리포트 먼저, 그다음 자동 업무, 개인 업무는 맨 뒤
      const rank = x => x.isReport ? 0 : x.personal ? 2 : 1;
      return rank(a) - rank(b) || a.customer.name.localeCompare(b.customer.name);
    }));
    return map;
  }, [finalTasks, managerFilter, customerFilter, taskOrder]);
  const {
    y,
    m
  } = viewYM;
  const startPad = new Date(y, m, 1).getDay();
  const dim = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(new Date(y, m, d));
  const moveMonth = k => {
    const d = new Date(y, m + k, 1);
    setViewYM({
      y: d.getFullYear(),
      m: d.getMonth()
    });
    setSelected(null);
  };
  const weekDays = Array.from({
    length: 7
  }, (_, i) => addDays(weekStart, i));
  const visibleCustomers = customers.filter(c => (managerFilter === "전체" || c.manager === managerFilter) && (customerFilter === "전체" || c.id === customerFilter));
  const toggleDone = (t, val) => setOverrides(o => ({
    ...o,
    [t.id]: {
      ...o[t.id],
      done: val
    }
  }));
  // 당일 업무 순서 이동 (dir: -1 위로 / +1 아래로). 그날 전체에 순번을 부여
  const reorderDay = (ds, id, dir) => {
    const arr = (byDate.get(ds) || []).slice();
    const i = arr.findIndex(t => t.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
    setTaskOrder(o => {
      const n = { ...o };
      arr.forEach((t, k) => { n[t.id] = k; });
      return n;
    });
  };
  const Chip = ({
    t,
    compact
  }) => /*#__PURE__*/React.createElement("div", {
    draggable: true,
    onDragStart: e => {
      e.dataTransfer.setData("text/plain", t.id);
      e.dataTransfer.effectAllowed = "move";
    },
    onClick: () => setSelected(t),
    className: `w-full text-left text-xs px-1 py-px rounded border flex items-center gap-1 cursor-grab active:cursor-grabbing
        ${t.isReport ? "bg-pink-100 text-pink-800 border-pink-200 font-semibold" : t.personal ? "bg-neutral-200 text-neutral-800 border-neutral-300" : t.product.color.chip}
        ${t.done ? "opacity-40" : ""} ${t.edited || t.shifted ? "border-dashed" : ""}`
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: t.done,
    onClick: e => e.stopPropagation(),
    onChange: e => toggleDone(t, e.target.checked),
    className: "w-3 h-3 shrink-0 cursor-pointer"
  }), /*#__PURE__*/React.createElement("span", {
    className: `truncate ${t.done ? "line-through" : ""}`
  }, t.isReport ? "📊 " : t.personal ? "👤 " : "", compact ? "" : `${t.customer.name.slice(0, 5)}·`, t.product ? /*#__PURE__*/React.createElement("b", {
    className: "font-semibold"
  }, t.product.name) : null, t.product ? " · " : "", t.step, t.isReport && t.onLeaveDay ? " (연차중)" : ""));
  const dropHandlers = ds => ({
    onDragOver: e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragOver !== ds) setDragOver(ds);
    },
    onDragLeave: () => setDragOver(v => v === ds ? null : v),
    onDrop: e => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/plain");
      if (id) setOverrides(o => ({
        ...o,
        [id]: {
          ...o[id],
          date: ds
        }
      }));
      setDragOver(null);
    }
  });
  const dateNumCls = (ds, dow) => ds === TODAY ? "bg-rose-500 text-white rounded-full px-1" : ds < TODAY ? "text-neutral-400" : dow === 0 ? "text-rose-600" : dow === 6 ? "text-sky-600" : "text-neutral-700";
  return /*#__PURE__*/React.createElement("div", {
    className: "min-h-screen bg-neutral-50 text-neutral-900",
    style: {
      fontFamily: "'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif"
    }
  }, /*#__PURE__*/React.createElement("header", {
    className: "bg-white border-b border-neutral-200 px-8 py-4 flex items-center justify-between sticky top-0 z-30"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-9 h-9 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-lg"
  }, "마"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    className: "font-bold text-lg leading-tight"
  }, "마포 액션플랜"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-neutral-500"
  }, "월리포트 날짜(앵커) 기준으로 업무가 자동 배치됩니다 · 오늘 ", TODAY))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex rounded-lg border border-neutral-300 overflow-hidden text-sm"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setViewMode("month"),
    className: `px-3 py-2 ${viewMode === "month" ? "bg-neutral-900 text-white" : "bg-white hover:bg-neutral-100"}`
  }, "월간 캘린더"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setViewMode("byCustomer"),
    className: `px-3 py-2 ${viewMode === "byCustomer" ? "bg-neutral-900 text-white" : "bg-white hover:bg-neutral-100"}`
  }, "고객사별 주간"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setViewMode("settings"),
    className: `px-3 py-2 ${viewMode === "settings" ? "bg-neutral-900 text-white" : "bg-white hover:bg-neutral-100"}`
  }, "업무 설정")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setPanel("holiday"),
    className: "text-sm px-3 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-100"
  }, "공휴일"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setPanel("leave"),
    className: "text-sm px-3 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-100"
  }, "연차 관리"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setPanel("managers"),
    className: "text-sm px-3 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-100"
  }, "담당자"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setAddTaskDate(TODAY),
    className: "text-sm px-3 py-2 rounded-lg border border-emerald-700 text-emerald-700 font-semibold hover:bg-emerald-50"
  }, "+ 일정 추가"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setPanel("tasks"),
    className: "text-sm px-3 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-100"
  }, "일정 관리"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setPanel("register"),
    className: "text-sm px-4 py-2 rounded-lg bg-emerald-700 text-white font-semibold hover:bg-emerald-800"
  }, "+ 고객사 등록"), /*#__PURE__*/React.createElement("span", {
    className: `text-xs self-center transition-opacity ${saving ? "text-emerald-600 opacity-100" : "text-neutral-300 opacity-100"}`
  }, saving ? "저장 중…" : "저장됨"), /*#__PURE__*/React.createElement("a", {
    href: "/api/logout",
    className: "text-sm px-3 py-2 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
  }, "로그아웃"))),/*#__PURE__*/React.createElement("div", {
    className: "flex"
  }, /*#__PURE__*/React.createElement("aside", {
    className: "w-64 shrink-0 border-r border-neutral-200 bg-white min-h-screen p-4"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-xs font-semibold text-neutral-500 mb-2"
  }, "담당자 필터"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-1 mb-4"
  }, ["전체", ...managerNames].map(mg => /*#__PURE__*/React.createElement("button", {
    key: mg,
    onClick: () => setManagerFilter(mg),
    className: `text-xs px-2 py-1 rounded-full border ${managerFilter === mg ? "bg-neutral-900 text-white border-neutral-900" : "border-neutral-300 hover:bg-neutral-100"}`
  }, mg))), /*#__PURE__*/React.createElement("p", {
    className: "text-xs font-semibold text-neutral-500 mb-2"
  }, "고객사 필터"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-1 mb-4"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setCustomerFilter("전체"),
    className: `text-xs px-2 py-1 rounded-full border ${customerFilter === "전체" ? "bg-neutral-900 text-white border-neutral-900" : "border-neutral-300 hover:bg-neutral-100"}`
  }, "전체"), customers.map((c, i) => /*#__PURE__*/React.createElement("button", {
    key: c.id,
    onClick: () => setCustomerFilter(c.id),
    className: `text-xs px-2 py-1 rounded-full border ${customerFilter === c.id ? "bg-neutral-900 text-white border-neutral-900" : `${CUST_ROW[i % CUST_ROW.length].tag} border-transparent`}`
  }, c.name))), /*#__PURE__*/React.createElement("p", {
    className: "text-xs font-semibold text-neutral-500 mb-2"
  }, "고객사 (", customers.length, ")"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-2"
  }, customers.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: c.id,
    className: `border border-neutral-200 rounded-lg p-3 ${CUST_ROW[i % CUST_ROW.length].row}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-semibold text-sm"
  }, c.name), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-1"
  }, /*#__PURE__*/React.createElement("span", {
    className: `text-xs text-white px-2 py-px rounded-full ${colorOf(c.manager)}`
  }, c.manager), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      if (window.confirm(`'${c.name}' 고객사를 삭제할까요?\n이 고객사의 자동 배치 업무가 모두 사라집니다. (되돌릴 수 없음)`)) {
        setCustomers(cs => cs.filter(x => x.id !== c.id));
        if (customerFilter === c.id) setCustomerFilter("전체");
        if (settingsCustomer === c.id) setSettingsCustomer(null);
      }
    },
    title: "고객사 삭제",
    className: "text-neutral-400 hover:text-rose-600 text-sm leading-none px-1"
  }, "✕"))), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-neutral-500 mt-1"
  }, "등록 ", c.regDate, " · 주리포트 ", WEEKDAYS[c.weeklyReportDay], "요일"), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-1 mt-1"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-neutral-600 font-semibold"
  }, m + 1, "월 월리포트:"), /*#__PURE__*/React.createElement("select", {
    value: c.mrOverrides && c.mrOverrides[`${y}-${String(m + 1).padStart(2, "0")}`] || c.monthlyReportDate,
    onChange: e => {
      const val = Number(e.target.value);
      const key = `${y}-${String(m + 1).padStart(2, "0")}`;
      setCustomers(cs => cs.map(x => x.id === c.id ? {
        ...x,
        mrOverrides: {
          ...(x.mrOverrides || {}),
          [key]: val
        }
      } : x));
    },
    className: "text-xs border border-neutral-300 rounded px-1 py-px bg-white"
  }, Array.from({
    length: 28
  }, (_, k) => k + 1).map(dd => /*#__PURE__*/React.createElement("option", {
    key: dd,
    value: dd
  }, dd, "일"))), /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-neutral-400"
  }, "(이달만)")), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-1 mt-2"
  }, c.products.map(pid => {
    const p = PRODUCTS.find(x => x.id === pid);
    const customized = p.steps.some((s, si) => managerSteps[`${c.id}|${pid}|${si}`] !== undefined);
    return /*#__PURE__*/React.createElement("span", {
      key: pid,
      className: `text-xs px-1 rounded border ${p.color.chip} ${customized ? "ring-2 ring-emerald-500" : ""}`
    }, p.name, customized ? " ✎" : "");
  })), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-neutral-400 mt-1"
  }, "✎ = 담당자 개별설정됨 · 조정은 상단 \"업무 설정\" 탭에서")))), /*#__PURE__*/React.createElement("div", {
    className: "mt-6 border-t border-neutral-200 pt-4 text-xs text-neutral-500 space-y-1"
  }, /*#__PURE__*/React.createElement("p", {
    className: "font-semibold text-neutral-600"
  }, "자동 배치 규칙"), /*#__PURE__*/React.createElement("p", null, "· 앵커 = 그 달 ", /*#__PURE__*/React.createElement("b", null, "월리포트 날짜"), " (매달 변경 가능)"), /*#__PURE__*/React.createElement("p", null, "· 디데이 업무: 월리포트 기준 ", /*#__PURE__*/React.createElement("b", null, "D±N 영업일")), /*#__PURE__*/React.createElement("p", null, "· 반복: 매주 요일 / 매일 / 매월 특정일 / 주리포트 연동"), /*#__PURE__*/React.createElement("p", null, "· 주말·공휴일 제외 계산"), /*#__PURE__*/React.createElement("p", null, "· 연차일 일반 업무 → ", /*#__PURE__*/React.createElement("b", null, "전날로 이동")), /*#__PURE__*/React.createElement("p", null, "· ", /*#__PURE__*/React.createElement("b", null, "리포트는 연차여도 유지"), ", 공휴일이면 ", /*#__PURE__*/React.createElement("b", null, "앞당김")), /*#__PURE__*/React.createElement("p", null, "· 오늘 = 빨간 표시 / 지난날 = 회색"), /*#__PURE__*/React.createElement("p", null, "· 체크박스 완료 줄긋기 · 칩 드래그로 날짜 이동"))), /*#__PURE__*/React.createElement("main", {
    className: "flex-1 p-6 overflow-x-auto"
  }, viewMode === "month" ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => moveMonth(-1),
    className: "w-8 h-8 rounded-lg border border-neutral-300 hover:bg-neutral-100"
  }, "←"), /*#__PURE__*/React.createElement("h2", {
    className: "text-xl font-bold"
  }, y, "년 ", m + 1, "월"), /*#__PURE__*/React.createElement("button", {
    onClick: () => moveMonth(1),
    className: "w-8 h-8 rounded-lg border border-neutral-300 hover:bg-neutral-100"
  }, "→")), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3 text-xs text-neutral-500"
  }, /*#__PURE__*/React.createElement("span", {
    className: "flex items-center gap-1"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-3 h-3 rounded bg-pink-500 inline-block"
  }), "리포트"), /*#__PURE__*/React.createElement("span", {
    className: "flex items-center gap-1"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-3 h-3 rounded bg-rose-500 inline-block"
  }), "오늘"), /*#__PURE__*/React.createElement("span", {
    className: "flex items-center gap-1"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-3 h-3 rounded bg-neutral-300 inline-block"
  }), "지난날"), /*#__PURE__*/React.createElement("span", {
    className: "font-semibold text-neutral-600"
  }, "✋ 드래그로 날짜 이동"))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-7 gap-px bg-neutral-100 rounded-2xl overflow-hidden border border-neutral-200 shadow-xl"
  }, WEEKDAYS.map((w, i) => /*#__PURE__*/React.createElement("div", {
    key: w,
    className: `bg-white text-center text-xs font-semibold py-3 ${i === 0 ? "text-rose-500" : i === 6 ? "text-sky-500" : "text-neutral-400"}`
  }, w)), cells.map((d, i) => {
    if (!d) return /*#__PURE__*/React.createElement("div", {
      key: `pad${i}`,
      className: "bg-neutral-50 min-h-32"
    });
    const ds = fmt(d);
    const hol = holidayMap.get(ds);
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const past = ds < TODAY,
      today = ds === TODAY;
    const dayLeaves = leaves.filter(l => l.date === ds && (managerFilter === "전체" || l.manager === managerFilter));
    const dayTasks = byDate.get(ds) || [];
    const shown = dayTasks; // 제한 없이 전부 표시 (셀이 개수만큼 늘어남)
    return /*#__PURE__*/React.createElement("div", {
      key: ds,
      ...dropHandlers(ds),
      className: `group min-h-32 p-1 transition-colors
                        ${dragOver === ds ? "bg-emerald-50 ring-2 ring-inset ring-emerald-500" : today ? "bg-white ring-2 ring-inset ring-rose-400" : past ? "bg-neutral-100" : weekend || hol ? "bg-neutral-50" : "bg-white"}`
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-between px-1"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => setDayOpen(ds),
      title: "당일 업무 순서 변경 / 전체 보기",
      className: `text-xs font-semibold cursor-pointer hover:underline ${hol && !today && !past ? "text-rose-600" : dateNumCls(ds, d.getDay())}`
    }, d.getDate(), /*#__PURE__*/React.createElement("span", {
      className: "font-normal ml-px opacity-70"
    }, "(", WEEKDAYS[d.getDay()], ")")), today && /*#__PURE__*/React.createElement("span", {
      className: "text-xs font-bold text-rose-500"
    }, "오늘"), hol && !today && /*#__PURE__*/React.createElement("span", {
      className: `text-xs truncate ${past ? "text-neutral-400" : "text-rose-500"}`
    }, hol)), dayLeaves.map(l => /*#__PURE__*/React.createElement("div", {
      key: l.manager,
      className: "text-xs mt-px px-1 rounded bg-neutral-200 text-neutral-600 truncate"
    }, "🌴 ", l.manager, " 연차")), /*#__PURE__*/React.createElement("div", {
      className: `mt-1 space-y-px ${past ? "opacity-60" : ""}`
    }, shown.map(t => /*#__PURE__*/React.createElement(Chip, {
      key: t.id,
      t: t
    }))), /*#__PURE__*/React.createElement("button", {
      onClick: () => setAddTaskDate(ds),
      className: "w-full mt-px text-xs text-neutral-400 hover:text-emerald-700 hover:bg-emerald-50 rounded px-1 py-px text-left opacity-0 group-hover:opacity-100 transition-opacity"
    }, "+ 개인업무"));
  }))) : viewMode === "byCustomer" ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setWeekStart(w => addDays(w, -7)),
    className: "w-8 h-8 rounded-lg border border-neutral-300 hover:bg-neutral-100"
  }, "←"), /*#__PURE__*/React.createElement("h2", {
    className: "text-xl font-bold"
  }, fmt(weekDays[0]).slice(5), " ~ ", fmt(weekDays[6]).slice(5), " 주간 · 고객사별"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setWeekStart(w => addDays(w, 7)),
    className: "w-8 h-8 rounded-lg border border-neutral-300 hover:bg-neutral-100"
  }, "→"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setWeekStart(mondayOf(new Date())),
    className: "text-xs px-2 py-1 rounded-lg border border-neutral-300 hover:bg-neutral-100"
  }, "이번 주")), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-neutral-500"
  }, "행 = 고객사 · 열 = 요일 · 체크로 완료 · 드래그로 날짜 이동")), /*#__PURE__*/React.createElement("table", {
    className: "w-full border-collapse bg-white rounded-2xl overflow-hidden border border-neutral-200 shadow-xl text-xs"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "bg-neutral-50 text-neutral-500 text-left px-3 py-3 w-32 font-semibold"
  }, "고객사"), weekDays.map(d => {
    const ds = fmt(d);
    const hol = holidayMap.get(ds);
    const today = ds === TODAY,
      past = ds < TODAY;
    return /*#__PURE__*/React.createElement("th", {
      key: ds,
      className: `px-2 py-2 text-center font-semibold
                          ${today ? "bg-rose-500 text-white" : past ? "bg-neutral-100 text-neutral-400" : "bg-neutral-50 " + (d.getDay() === 0 ? "text-rose-500" : d.getDay() === 6 ? "text-sky-500" : "text-neutral-500")}`
    }, d.getMonth() + 1, "/", d.getDate(), " (", WEEKDAYS[d.getDay()], ")", today ? " 오늘" : "", hol ? ` ${hol}` : "");
  }))), /*#__PURE__*/React.createElement("tbody", null, visibleCustomers.map(c => {
    const idx = customers.findIndex(x => x.id === c.id);
    const pal = CUST_ROW[idx % CUST_ROW.length];
    return /*#__PURE__*/React.createElement("tr", {
      key: c.id,
      className: "border-t border-neutral-200 align-top"
    }, /*#__PURE__*/React.createElement("td", {
      className: `px-2 py-2 font-semibold ${pal.tag}`
    }, c.name, /*#__PURE__*/React.createElement("span", {
      className: "block font-normal text-neutral-600"
    }, c.manager, " 담당")), weekDays.map(d => {
      const ds = fmt(d);
      const past = ds < TODAY,
        today = ds === TODAY;
      const cellTasks = (byDate.get(ds) || []).filter(t => t.customer.id === c.id);
      const onLeave = isOnLeave(c.manager, ds);
      return /*#__PURE__*/React.createElement("td", {
        key: ds,
        ...dropHandlers(ds),
        className: `group px-1 py-1 border-l border-neutral-100 min-w-32 align-top
                                ${dragOver === ds ? "bg-emerald-50" : today ? "bg-rose-50" : past ? "bg-neutral-100 opacity-70" : pal.row}`
      }, onLeave && /*#__PURE__*/React.createElement("div", {
        className: "text-xs text-neutral-500 mb-px"
      }, "🌴 연차"), /*#__PURE__*/React.createElement("div", {
        className: "space-y-px"
      }, cellTasks.map(t => /*#__PURE__*/React.createElement(Chip, {
        key: t.id,
        t: t,
        compact: true
      }))), /*#__PURE__*/React.createElement("button", {
        onClick: () => setAddTaskDate({
          date: ds,
          customerId: c.id,
          customerName: c.name,
          manager: c.manager
        }),
        className: "w-full mt-px text-xs text-neutral-400 hover:text-emerald-700 rounded px-1 text-left opacity-0 group-hover:opacity-100 transition-opacity"
      }, "+ 업무"));
    }));
  })))) :
  /*#__PURE__*/
  /* ===== 업무 설정 탭 (고객사 × 상품) ===== */
  React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-4"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "text-xl font-bold"
  }, "업무 설정 · 고객사별 개인화"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-neutral-500"
  }, "고객사를 고르고 상품을 펼쳐 각 업무의 방식(디데이/반복요일 등)과 값을 개별 조정")), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 mb-4 flex-wrap"
  }, customers.map((c, i) => /*#__PURE__*/React.createElement("button", {
    key: c.id,
    onClick: () => {
      setSettingsCustomer(c.id);
      setSettingsProd(null);
    },
    className: `px-3 py-2 rounded-lg text-sm border ${settingsCustomer === c.id ? "bg-neutral-900 text-white border-neutral-900" : `${CUST_ROW[i % CUST_ROW.length].tag} border-transparent hover:opacity-80`}`
  }, c.name, " ", /*#__PURE__*/React.createElement("span", {
    className: "opacity-70"
  }, "· ", c.manager)))), (() => {
    const c = customers.find(x => x.id === settingsCustomer);
    if (!c) return /*#__PURE__*/React.createElement("p", {
      className: "text-sm text-neutral-400"
    }, "위에서 고객사를 선택하세요.");
    const prodIds = c.products;
    return /*#__PURE__*/React.createElement("div", {
      className: "grid grid-cols-12 gap-4"
    }, /*#__PURE__*/React.createElement("div", {
      className: "col-span-4 space-y-1"
    }, /*#__PURE__*/React.createElement("p", {
      className: "text-xs font-semibold text-neutral-500 mb-1"
    }, c.name, " 계약 상품 (", prodIds.length, "개) · 담당 ", c.manager), prodIds.map(pid => {
      const p = PRODUCTS.find(x => x.id === pid);
      const custCount = p.steps.filter((_, si) => managerSteps[`${c.id}|${pid}|${si}`]).length;
      return /*#__PURE__*/React.createElement("button", {
        key: pid,
        onClick: () => setSettingsProd(pid),
        className: `w-full text-left border rounded-lg px-3 py-2 ${settingsProd === pid ? "border-emerald-600 bg-emerald-50" : "border-neutral-200 hover:bg-neutral-50"}`
      }, /*#__PURE__*/React.createElement("div", {
        className: "flex items-center justify-between"
      }, /*#__PURE__*/React.createElement("span", {
        className: `text-sm font-semibold px-1 rounded border ${p.color.chip}`
      }, p.name), custCount > 0 && /*#__PURE__*/React.createElement("span", {
        className: "text-xs text-emerald-700 font-semibold"
      }, "✎ ", custCount, "개 조정")), /*#__PURE__*/React.createElement("p", {
        className: "text-xs text-neutral-500 mt-1"
      }, p.steps.length, "개 업무"));
    }), /*#__PURE__*/React.createElement("div", {
      className: "mt-3 pt-3 border-t border-neutral-200"
    }, /*#__PURE__*/React.createElement("p", {
      className: "text-xs font-semibold text-neutral-500 mb-1"
    }, "상품 추가 / 삭제 (이 고객사)"), /*#__PURE__*/React.createElement("div", {
      className: "flex flex-wrap gap-1"
    }, PRODUCTS.map(pp => {
      const on = c.products.includes(pp.id);
      return /*#__PURE__*/React.createElement("button", {
        key: pp.id,
        onClick: () => {
          setCustomers(cs => cs.map(x => x.id === c.id ? { ...x, products: on ? x.products.filter(id => id !== pp.id) : [...x.products, pp.id] } : x));
          if (on && settingsProd === pp.id) setSettingsProd(null);
        },
        className: `text-xs px-2 py-1 rounded-full border ${on ? "bg-emerald-700 text-white border-emerald-700" : "border-neutral-300 text-neutral-600 hover:bg-neutral-100"}`
      }, on ? "✓ " : "＋ ", pp.name);
    })))), /*#__PURE__*/React.createElement("div", {
      className: "col-span-8"
    }, !settingsProd || !prodIds.includes(settingsProd) ? /*#__PURE__*/React.createElement("div", {
      className: "border border-dashed border-neutral-300 rounded-xl p-8 text-center text-neutral-400 text-sm"
    }, "왼쪽에서 상품을 선택하면 업무별 설정이 나타납니다.") : (() => {
      const p = PRODUCTS.find(x => x.id === settingsProd);
      return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
        className: "flex items-center justify-between mb-3"
      }, /*#__PURE__*/React.createElement("h3", {
        className: "font-bold text-lg"
      }, c.name, " · ", p.name), /*#__PURE__*/React.createElement("button", {
        onClick: () => setManagerSteps(o => {
          const n = {
            ...o
          };
          p.steps.forEach((_, si) => delete n[`${c.id}|${settingsProd}|${si}`]);
          return n;
        }),
        className: "text-xs text-neutral-500 underline"
      }, "이 상품 전체 기본값으로")), /*#__PURE__*/React.createElement("div", {
        className: "space-y-2"
      }, p.steps.map((s0, si) => {
        const dkey = `${c.id}|${settingsProd}|${si}`;
        const disabled = !!stepDisabled[dkey];
        const toggleDisable = () => setStepDisabled(o => {
          const n = { ...o };
          if (disabled) delete n[dkey];else n[dkey] = true;
          return n;
        });
        if (disabled) return /*#__PURE__*/React.createElement("div", {
          key: si,
          className: "flex items-center justify-between border border-dashed border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-400 bg-neutral-50"
        }, /*#__PURE__*/React.createElement("span", {
          className: "line-through"
        }, s0.name, " · 제외됨"), /*#__PURE__*/React.createElement("button", {
          onClick: toggleDisable,
          className: "text-xs text-emerald-700 font-semibold shrink-0"
        }, "다시 포함"));
        if (s0.mode === "manual") return /*#__PURE__*/React.createElement("div", {
          key: si,
          className: "flex items-center justify-between border border-neutral-200 rounded-lg px-3 py-2 bg-neutral-50 text-sm text-neutral-500"
        }, /*#__PURE__*/React.createElement("span", null, s0.name, " · 수동설정 (자동 배치 안 함)"), /*#__PURE__*/React.createElement("button", {
          onClick: toggleDisable,
          className: "text-xs text-neutral-400 hover:text-rose-600 shrink-0"
        }, "제외"));
        return /*#__PURE__*/React.createElement("div", {
          key: si,
          className: "flex items-stretch gap-2"
        }, /*#__PURE__*/React.createElement("div", {
          className: "flex-1 min-w-0"
        }, /*#__PURE__*/React.createElement(StepEditor, {
          ownerId: c.id,
          pid: settingsProd,
          si: si,
          baseStep: s0,
          override: managerSteps[dkey],
          setStep: (key, val) => setManagerSteps(o => {
            const n = { ...o };
            if (val === null) delete n[key];else n[key] = val;
            return n;
          })
        })), /*#__PURE__*/React.createElement("button", {
          onClick: toggleDisable,
          title: "이 업무를 이 고객사에서 제외",
          className: "shrink-0 self-center text-xs font-semibold px-3 py-1.5 rounded-lg border border-neutral-300 text-neutral-600 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50"
        }, "제외"));
      }), (stepExtras[`${c.id}|${settingsProd}`] || []).map((es, ei) => /*#__PURE__*/React.createElement("div", {
        key: "x" + ei,
        className: "flex items-center justify-between border border-emerald-300 rounded-lg px-3 py-2 text-sm bg-emerald-50"
      }, /*#__PURE__*/React.createElement("span", null, "＋ ", /*#__PURE__*/React.createElement("b", null, es.name), " · ", stepLabel(es), " (추가 업무)"), /*#__PURE__*/React.createElement("button", {
        onClick: () => setStepExtras(o => {
          const key = `${c.id}|${settingsProd}`;
          const arr = (o[key] || []).filter((_, k) => k !== ei);
          const n = { ...o };
          if (arr.length) n[key] = arr;else delete n[key];
          return n;
        }),
        className: "text-xs text-rose-500 hover:text-rose-700 shrink-0"
      }, "삭제"))), /*#__PURE__*/React.createElement(AddStepRow, {
        onAdd: step => setStepExtras(o => {
          const key = `${c.id}|${settingsProd}`;
          return { ...o, [key]: [...(o[key] || []), step] };
        })
      })), /*#__PURE__*/React.createElement("div", {
        className: "bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 mt-3"
      }, "여기서 바꾼 설정은 ", /*#__PURE__*/React.createElement("b", null, c.name), "의 ", /*#__PURE__*/React.createElement("b", null, p.name), " 업무에만 적용됩니다. 같은 상품이라도 다른 고객사는 각자의 설정(또는 기본 템플릿)을 그대로 사용해요."));
    })()));
  })()))), selected && /*#__PURE__*/React.createElement(TaskDetail, {
    task: finalTasks.find(t => t.id === selected.id) || selected,
    onClose: () => setSelected(null),
    onChange: patch => setOverrides(o => ({
      ...o,
      [selected.id]: {
        ...o[selected.id],
        ...patch
      }
    })),
    onReset: () => setOverrides(o => {
      const n = {
        ...o
      };
      delete n[selected.id];
      return n;
    }),
    onDelete: selected.personal ? () => {
      setPersonalTasks(p => p.filter(x => x.id !== selected.id));
      setOverrides(o => {
        const n = {
          ...o
        };
        delete n[selected.id];
        return n;
      });
      setSelected(null);
    } : null
  }), dayOpen && /*#__PURE__*/React.createElement(Overlay, {
    title: `${dayOpen} 전체 업무 (${(byDate.get(dayOpen) || []).length}건)`,
    onClose: () => setDayOpen(null)
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-neutral-500 mb-2"
  }, "▲▼ 로 당일 업무 순서를 바꿀 수 있어요. 완료(체크)한 업무는 자동으로 맨 아래로 내려갑니다."), /*#__PURE__*/React.createElement("div", {
    className: "space-y-1"
  }, (byDate.get(dayOpen) || []).map((t, ti, ttarr) => /*#__PURE__*/React.createElement("div", {
    key: t.id,
    className: "flex items-center gap-2 border border-neutral-200 rounded-lg px-2 py-1 text-sm"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col leading-none shrink-0"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => reorderDay(dayOpen, t.id, -1),
    disabled: ti === 0,
    className: "text-neutral-400 hover:text-neutral-800 disabled:opacity-20 text-xs"
  }, "▲"), /*#__PURE__*/React.createElement("button", {
    onClick: () => reorderDay(dayOpen, t.id, 1),
    disabled: ti === ttarr.length - 1,
    className: "text-neutral-400 hover:text-neutral-800 disabled:opacity-20 text-xs"
  }, "▼")), /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: t.done,
    onChange: e => toggleDone(t, e.target.checked),
    className: "w-4 h-4 cursor-pointer"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setSelected(t);
      setDayOpen(null);
    },
    className: `text-left flex-1 truncate ${t.done ? "line-through opacity-40" : ""}`
  }, t.isReport ? "📊 " : "", /*#__PURE__*/React.createElement("b", null, t.customer.name), " · ", t.product ? `${t.product.name} · ` : "", t.step), /*#__PURE__*/React.createElement("span", {
    className: `text-xs text-white px-2 py-px rounded-full ${colorOf(t.customer.manager)}`
  }, t.customer.manager))))), addTaskDate && /*#__PURE__*/React.createElement(AddTaskPanel, {
    target: addTaskDate,
    managers: managerNames,
    onClose: () => setAddTaskDate(null),
    onSave: pt => {
      setPersonalTasks(p => [...p, pt]);
      setAddTaskDate(null);
    }
  }), panel === "register" && /*#__PURE__*/React.createElement(RegisterPanel, {
    managerNames: managerNames,
    onClose: () => setPanel(null),
    onSave: c => {
      setCustomers(cs => [...cs, c]);
      setPanel(null);
    }
  }), panel === "managers" && /*#__PURE__*/React.createElement(ManagersPanel, {
    managers: managers,
    setManagers: setManagers,
    customers: customers,
    onClose: () => setPanel(null)
  }), panel === "leave" && /*#__PURE__*/React.createElement(LeavePanel, {
    managerNames: managerNames,
    leaves: leaves,
    setLeaves: setLeaves,
    onClose: () => setPanel(null)
  }), panel === "holiday" && /*#__PURE__*/React.createElement(HolidayPanel, {
    holidays: holidays,
    setHolidays: setHolidays,
    onClose: () => setPanel(null)
  }), panel === "tasks" && /*#__PURE__*/React.createElement(TaskManagePanel, {
    personalTasks: personalTasks,
    setPersonalTasks: setPersonalTasks,
    onAdd: () => {
      setPanel(null);
      setAddTaskDate(TODAY);
    },
    onClose: () => setPanel(null)
  }));
}

// 담당자별 업무 방식(mode)+값(arg)을 편집하는 행 컴포넌트
const MODE_LABEL = {
  d: "디데이(D±N)",
  w: "반복 요일",
  daily: "매일",
  md: "매월 특정일",
  wr: "주리포트 연동",
  manual: "수동설정"
};
// 고객사별 "추가 업무" 입력 행
function AddStepRow({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [mode, setMode] = useState("d");
  const [arg, setArg] = useState(0);
  const [wdays, setWdays] = useState([1]);
  const [mdays, setMdays] = useState("1");
  const submit = () => {
    const nm = name.trim();
    if (!nm) return;
    let a;
    if (mode === "d") a = Number(arg) || 0;else if (mode === "w") a = wdays.length ? wdays : [1];else if (mode === "md") a = mdays.split(",").map(x => parseInt(x.trim(), 10)).filter(x => x >= 1 && x <= 31);else a = undefined;
    onAdd({ name: nm, mode, arg: a });
    setName("");
    setMode("d");
    setArg(0);
    setWdays([1]);
    setMdays("1");
    setOpen(false);
  };
  if (!open) return /*#__PURE__*/React.createElement("button", {
    onClick: () => setOpen(true),
    className: "w-full border border-dashed border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-50"
  }, "＋ 이 상품에 업무 추가");
  return /*#__PURE__*/React.createElement("div", {
    className: "border border-emerald-300 rounded-lg p-3 space-y-2 bg-emerald-50"
  }, /*#__PURE__*/React.createElement("input", {
    value: name,
    onChange: e => setName(e.target.value),
    autoFocus: true,
    placeholder: "업무 이름 (예: 별도 리포트)",
    className: "w-full border border-neutral-300 rounded px-2 py-1 text-sm"
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 flex-wrap"
  }, /*#__PURE__*/React.createElement("select", {
    value: mode,
    onChange: e => setMode(e.target.value),
    className: "text-xs border border-neutral-300 rounded px-2 py-1 bg-white"
  }, /*#__PURE__*/React.createElement("option", { value: "d" }, "디데이(D±N)"), /*#__PURE__*/React.createElement("option", { value: "w" }, "반복 요일"), /*#__PURE__*/React.createElement("option", { value: "daily" }, "매일"), /*#__PURE__*/React.createElement("option", { value: "md" }, "매월 특정일"), /*#__PURE__*/React.createElement("option", { value: "wr" }, "주리포트 연동")), mode === "d" && /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: arg,
    onChange: e => setArg(e.target.value),
    className: "w-16 border border-neutral-300 rounded px-2 py-1 text-sm text-center"
  }), mode === "w" && /*#__PURE__*/React.createElement("div", {
    className: "flex gap-1"
  }, [1, 2, 3, 4, 5].map(w => /*#__PURE__*/React.createElement("button", {
    key: w,
    onClick: () => setWdays(cur => cur.includes(w) ? cur.filter(x => x !== w) : [...cur, w].sort()),
    className: `w-6 h-6 rounded text-xs border ${wdays.includes(w) ? "bg-neutral-900 text-white border-neutral-900" : "bg-white border-neutral-300"}`
  }, WEEKDAYS[w]))), mode === "md" && /*#__PURE__*/React.createElement("input", {
    value: mdays,
    onChange: e => setMdays(e.target.value),
    placeholder: "예: 1,15",
    className: "w-20 border border-neutral-300 rounded px-2 py-1 text-sm"
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: submit,
    disabled: !name.trim(),
    className: "px-3 py-1 rounded bg-emerald-700 text-white text-xs font-semibold disabled:opacity-40 hover:bg-emerald-800"
  }, "추가"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setOpen(false),
    className: "px-3 py-1 rounded border border-neutral-300 text-xs"
  }, "취소")));
}
function StepEditor({
  ownerId,
  pid,
  si,
  baseStep,
  override,
  setStep
}) {
  const key = `${ownerId}|${pid}|${si}`;
  const isCustom = !!override;
  const eff = override || baseStep; // 현재 유효 방식/값
  const mode = eff.mode;
  const applyMode = newMode => {
    // 방식 전환 시 기본 인자 채워주기
    let arg;
    if (newMode === "d") arg = typeof baseStep.arg === "number" ? baseStep.arg : 0;else if (newMode === "w") arg = Array.isArray(baseStep.arg) ? baseStep.arg : [1];else if (newMode === "md") arg = Array.isArray(baseStep.arg) ? baseStep.arg : [1];else arg = undefined;
    setStep(key, {
      mode: newMode,
      arg
    });
  };
  const setArg = arg => setStep(key, {
    mode,
    arg
  });
  const reset = () => setStep(key, null);
  const toggleWeekday = w => {
    const cur = Array.isArray(eff.arg) ? eff.arg : [];
    setArg(cur.includes(w) ? cur.filter(x => x !== w) : [...cur, w].sort());
  };
  return /*#__PURE__*/React.createElement("div", {
    className: `border rounded-lg px-3 py-2 ${isCustom ? "border-emerald-500 bg-emerald-50" : "border-neutral-200 bg-white"}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "flex-1 min-w-0 truncate text-sm font-medium"
  }, baseStep.name), /*#__PURE__*/React.createElement("span", {
    className: "shrink-0 text-xs text-neutral-400"
  }, "기본: ", MODE_LABEL[baseStep.mode], baseStep.mode === "d" ? ` ${baseStep.arg >= 0 ? "+" : ""}${baseStep.arg}` : "", baseStep.mode === "w" ? ` (${baseStep.arg.map(w => WEEKDAYS[w]).join("·")})` : "", baseStep.mode === "md" ? ` (${baseStep.arg.join("·")}일)` : ""), isCustom && /*#__PURE__*/React.createElement("button", {
    onClick: reset,
    className: "text-xs text-neutral-400 hover:text-rose-600",
    title: "기본값으로"
  }, "↩")), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap items-center gap-2 mt-2"
  }, /*#__PURE__*/React.createElement("select", {
    value: mode,
    onChange: e => applyMode(e.target.value),
    className: "text-xs border border-neutral-300 rounded px-2 py-1 bg-white"
  }, /*#__PURE__*/React.createElement("option", {
    value: "d"
  }, "디데이 (D±N)"), /*#__PURE__*/React.createElement("option", {
    value: "w"
  }, "반복 요일"), /*#__PURE__*/React.createElement("option", {
    value: "daily"
  }, "매일"), /*#__PURE__*/React.createElement("option", {
    value: "md"
  }, "매월 특정일"), /*#__PURE__*/React.createElement("option", {
    value: "wr"
  }, "주리포트 연동")), mode === "d" && /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-1"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-semibold"
  }, "월리포트 기준 D"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: typeof eff.arg === "number" ? eff.arg : 0,
    onChange: e => setArg(Number(e.target.value)),
    className: "w-16 border border-neutral-300 rounded px-2 py-1 text-sm text-center"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-neutral-400"
  }, "영업일")), mode === "w" && /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-1"
  }, [1, 2, 3, 4, 5].map(w => {
    const on = Array.isArray(eff.arg) && eff.arg.includes(w);
    return /*#__PURE__*/React.createElement("button", {
      key: w,
      onClick: () => toggleWeekday(w),
      className: `w-7 h-7 rounded text-xs font-semibold border ${on ? "bg-neutral-900 text-white border-neutral-900" : "bg-white border-neutral-300 hover:bg-neutral-100"}`
    }, WEEKDAYS[w]);
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-neutral-400 ml-1"
  }, "요일 선택")), mode === "md" && /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-1"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs"
  }, "매월"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: (Array.isArray(eff.arg) ? eff.arg : []).join(","),
    onChange: e => setArg(e.target.value.split(",").map(x => parseInt(x.trim(), 10)).filter(x => x >= 1 && x <= 31)),
    placeholder: "예: 1,15",
    className: "w-24 border border-neutral-300 rounded px-2 py-1 text-sm text-center"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-neutral-400"
  }, "일 (쉼표 구분)")), mode === "daily" && /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-neutral-500"
  }, "매 영업일마다 자동 생성"), mode === "wr" && /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-neutral-500"
  }, "주리포트 날짜에 함께 배치")));
}
function TaskDetail({
  task,
  onClose,
  onChange,
  onReset,
  onDelete
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed bottom-4 right-4 w-80 bg-white rounded-xl shadow-xl border border-neutral-200 p-4 z-40"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-start justify-between"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-neutral-500"
  }, task.personal ? "👤 개인업무" : task.customer.name, " · 담당 ", task.customer.manager), /*#__PURE__*/React.createElement("h3", {
    className: "font-bold"
  }, task.isReport ? "📊 " : "", task.product ? `${task.product.name} · ` : "", task.step)), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "text-neutral-400 hover:text-neutral-700"
  }, "✕")), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-neutral-500 mt-2"
  }, "배치 규칙: ", task.mode), task.shifted && /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-amber-600 mt-1"
  }, "⚠ ", task.shifted, " (자동 조정됨)"), task.isReport && task.onLeaveDay && /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-pink-600 mt-1"
  }, "담당자 연차일이지만 리포트는 유지됩니다."), /*#__PURE__*/React.createElement("div", {
    className: "mt-3 space-y-2"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs font-semibold text-neutral-600"
  }, "날짜 직접 수정 (개인별 조정)", /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: task.date,
    onChange: e => onChange({
      date: e.target.value
    }),
    className: "mt-1 w-full border border-neutral-300 rounded-lg px-2 py-1 text-sm"
  })), /*#__PURE__*/React.createElement("label", {
    className: "flex items-center gap-2 text-sm"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: task.done,
    onChange: e => onChange({
      done: e.target.checked
    })
  }), " 완료 처리"), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, task.edited || task.done ? /*#__PURE__*/React.createElement("button", {
    onClick: onReset,
    className: "text-xs text-neutral-500 underline"
  }, "자동 배치 상태로 되돌리기") : /*#__PURE__*/React.createElement("span", null), onDelete && /*#__PURE__*/React.createElement("button", {
    onClick: onDelete,
    className: "text-xs text-rose-600 hover:underline font-semibold"
  }, "개인업무 삭제"))));
}
function AddTaskPanel({
  target,
  managers,
  onClose,
  onSave
}) {
  // target: 문자열(날짜) 또는 {date, customerId, customerName, manager}
  const isObj = typeof target === "object";
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(isObj ? target.date : target);
  const [manager, setManager] = useState(isObj ? target.manager : managers[0]);
  return /*#__PURE__*/React.createElement(Overlay, {
    title: `개인업무 추가 · ${date}`,
    onClose: onClose
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-neutral-500 mb-3"
  }, "자동 배치되는 상품 업무 외에, 이 날짜에 직접 업무를 추가합니다.", isObj ? ` (${target.customerName} 행에 표시)` : " 캘린더에 개인업무로 표시돼요."), /*#__PURE__*/React.createElement("div", {
    className: "space-y-3"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-semibold text-neutral-600"
  }, "날짜"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: date,
    onChange: e => setDate(e.target.value),
    className: "mt-1 w-full border border-neutral-300 rounded-lg px-3 py-2 bg-white"
  })), /*#__PURE__*/React.createElement("label", {
    className: "block text-sm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-semibold text-neutral-600"
  }, "업무 내용"), /*#__PURE__*/React.createElement("input", {
    value: title,
    onChange: e => setTitle(e.target.value),
    autoFocus: true,
    placeholder: "예: 원장님 미팅 / 급한 원고 수정",
    className: "mt-1 w-full border border-neutral-300 rounded-lg px-3 py-2"
  })), !isObj && /*#__PURE__*/React.createElement("label", {
    className: "block text-sm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-semibold text-neutral-600"
  }, "담당자"), /*#__PURE__*/React.createElement("select", {
    value: manager,
    onChange: e => setManager(e.target.value),
    className: "mt-1 w-full border border-neutral-300 rounded-lg px-3 py-2 bg-white"
  }, managers.map(mg => /*#__PURE__*/React.createElement("option", {
    key: mg
  }, mg)))), /*#__PURE__*/React.createElement("button", {
    disabled: !title.trim(),
    onClick: () => onSave({
      id: `pt${Date.now()}`,
      date,
      title: title.trim(),
      manager,
      customerId: isObj ? target.customerId : null,
      customerName: isObj ? target.customerName : null,
      done: false
    }),
    className: "w-full py-3 rounded-lg bg-emerald-700 text-white font-bold disabled:opacity-40 hover:bg-emerald-800"
  }, "추가")));
}
function RegisterPanel({
  managerNames,
  onClose,
  onSave
}) {
  const MG = managerNames && managerNames.length ? managerNames : MANAGERS;
  const [name, setName] = useState("");
  const [manager, setManager] = useState(MG[0]);
  const [regDate, setRegDate] = useState(TODAY);
  const [products, setProducts] = useState([]);
  const [weeklyReportDay, setWeeklyReportDay] = useState(3);
  const [monthlyReportDate, setMonthlyReportDate] = useState(5);
  const toggle = pid => setProducts(p => p.includes(pid) ? p.filter(x => x !== pid) : [...p, pid]);
  const stepCount = products.reduce((a, pid) => a + PRODUCTS.find(x => x.id === pid).steps.filter(s => s.mode !== "manual").length, 0);
  return /*#__PURE__*/React.createElement(Overlay, {
    onClose: onClose,
    title: "고객사 등록 · 일정 자동 생성"
  }, /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-3"
  }, /*#__PURE__*/React.createElement("label", {
    className: "text-sm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-semibold text-neutral-600"
  }, "고객사명"), /*#__PURE__*/React.createElement("input", {
    value: name,
    onChange: e => setName(e.target.value),
    placeholder: "예: 다함약국",
    className: "mt-1 w-full border border-neutral-300 rounded-lg px-3 py-2"
  })), /*#__PURE__*/React.createElement("label", {
    className: "text-sm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-semibold text-neutral-600"
  }, "담당자"), /*#__PURE__*/React.createElement("select", {
    value: manager,
    onChange: e => setManager(e.target.value),
    className: "mt-1 w-full border border-neutral-300 rounded-lg px-3 py-2 bg-white"
  }, MG.map(mg => /*#__PURE__*/React.createElement("option", {
    key: mg
  }, mg)))), /*#__PURE__*/React.createElement("label", {
    className: "text-sm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-semibold text-neutral-600"
  }, "등록일 (이 날짜 이후부터 생성)"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: regDate,
    onChange: e => setRegDate(e.target.value),
    className: "mt-1 w-full border border-neutral-300 rounded-lg px-3 py-2"
  })), /*#__PURE__*/React.createElement("label", {
    className: "text-sm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-semibold text-neutral-600"
  }, "월리포트 날짜 (앵커 · 매달 변경 가능)"), /*#__PURE__*/React.createElement("select", {
    value: monthlyReportDate,
    onChange: e => setMonthlyReportDate(Number(e.target.value)),
    className: "mt-1 w-full border border-neutral-300 rounded-lg px-3 py-2 bg-white"
  }, Array.from({
    length: 28
  }, (_, i) => i + 1).map(d => /*#__PURE__*/React.createElement("option", {
    key: d,
    value: d
  }, "매월 ", d, "일")))), /*#__PURE__*/React.createElement("label", {
    className: "text-sm col-span-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-semibold text-neutral-600"
  }, "주리포트 요일 (고객사별 개별 설정)"), /*#__PURE__*/React.createElement("select", {
    value: weeklyReportDay,
    onChange: e => setWeeklyReportDay(Number(e.target.value)),
    className: "mt-1 w-full border border-neutral-300 rounded-lg px-3 py-2 bg-white"
  }, [1, 2, 3, 4, 5].map(w => /*#__PURE__*/React.createElement("option", {
    key: w,
    value: w
  }, "매주 ", WEEKDAYS[w], "요일"))))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    className: "text-xs font-semibold text-neutral-600 mb-2"
  }, "계약 상품 선택 (", PRODUCTS.length, "종 · 디데이는 월리포트 기준)"), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1"
  }, PRODUCTS.map(p => /*#__PURE__*/React.createElement("button", {
    key: p.id,
    onClick: () => toggle(p.id),
    className: `text-left border rounded-lg p-2 text-sm ${products.includes(p.id) ? "border-emerald-600 bg-emerald-50" : "border-neutral-200 hover:bg-neutral-50"}`
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-semibold"
  }, p.name), /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-neutral-500 block mt-px"
  }, p.steps.length, "개 업무 · ", stepLabel(p.steps[0]), p.steps.length > 1 ? ` 외` : ""))))), /*#__PURE__*/React.createElement("div", {
    className: "bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-900"
  }, "상품 ", products.length, "종 · 세부 업무 ", stepCount, "개가 월리포트 날짜를 기준으로 ", manager, " 캘린더에 자동 배치됩니다 (수동설정 업무 제외 · 공휴일/연차 자동 반영)."), /*#__PURE__*/React.createElement("button", {
    disabled: !name || products.length === 0,
    onClick: () => onSave({
      id: `c${Date.now()}`,
      name,
      manager,
      regDate,
      products,
      weeklyReportDay,
      monthlyReportDate
    }),
    className: "w-full py-3 rounded-lg bg-emerald-700 text-white font-bold disabled:opacity-40 hover:bg-emerald-800"
  }, "등록하고 일정 자동 생성")));
}
function LeavePanel({
  managerNames,
  leaves,
  setLeaves,
  onClose
}) {
  const MG = managerNames && managerNames.length ? managerNames : MANAGERS;
  const [manager, setManager] = useState(MG[0]);
  const [date, setDate] = useState(TODAY);
  return /*#__PURE__*/React.createElement(Overlay, {
    onClose: onClose,
    title: "연차 관리"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-neutral-500 mb-3"
  }, "연차 등록 시 해당 날짜의 일반 업무는 전날(앞 영업일)로 자동 이동합니다. 리포트는 그대로 유지됩니다."), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 mb-4"
  }, /*#__PURE__*/React.createElement("select", {
    value: manager,
    onChange: e => setManager(e.target.value),
    className: "border border-neutral-300 rounded-lg px-3 py-2 bg-white text-sm"
  }, MG.map(mg => /*#__PURE__*/React.createElement("option", {
    key: mg
  }, mg))), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: date,
    onChange: e => setDate(e.target.value),
    className: "border border-neutral-300 rounded-lg px-3 py-2 text-sm flex-1"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => setLeaves(l => [...l, {
      manager,
      date
    }]),
    className: "px-4 py-2 rounded-lg bg-neutral-900 text-white text-sm font-semibold"
  }, "추가")), /*#__PURE__*/React.createElement("div", {
    className: "space-y-1"
  }, leaves.length === 0 && /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-neutral-400"
  }, "등록된 연차가 없습니다."), leaves.map((l, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "flex items-center justify-between border border-neutral-200 rounded-lg px-3 py-2 text-sm"
  }, /*#__PURE__*/React.createElement("span", null, "🌴 ", l.manager, " · ", l.date), /*#__PURE__*/React.createElement("button", {
    onClick: () => setLeaves(ls => ls.filter((_, j) => j !== i)),
    className: "text-neutral-400 hover:text-rose-600"
  }, "삭제")))));
}
function HolidayPanel({
  holidays,
  setHolidays,
  onClose
}) {
  const [date, setDate] = useState(TODAY);
  const [label, setLabel] = useState("");
  return /*#__PURE__*/React.createElement(Overlay, {
    onClose: onClose,
    title: "공휴일 목록 (제외 계산에 사용)"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 mb-4"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: date,
    onChange: e => setDate(e.target.value),
    className: "border border-neutral-300 rounded-lg px-3 py-2 text-sm"
  }), /*#__PURE__*/React.createElement("input", {
    value: label,
    onChange: e => setLabel(e.target.value),
    placeholder: "이름 (예: 임시공휴일)",
    className: "border border-neutral-300 rounded-lg px-3 py-2 text-sm flex-1"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => label && setHolidays(h => [...h, [date, label]].sort((a, b) => a[0].localeCompare(b[0]))),
    className: "px-4 py-2 rounded-lg bg-neutral-900 text-white text-sm font-semibold"
  }, "추가")), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-1"
  }, holidays.map(([d, n], i) => /*#__PURE__*/React.createElement("div", {
    key: d + i,
    className: "flex items-center justify-between border border-neutral-200 rounded-lg px-3 py-1 text-sm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-rose-600"
  }, d), /*#__PURE__*/React.createElement("span", {
    className: "text-neutral-600 flex-1 ml-2"
  }, n), /*#__PURE__*/React.createElement("button", {
    onClick: () => setHolidays(hs => hs.filter((_, j) => j !== i)),
    className: "text-neutral-400 hover:text-rose-600 text-xs"
  }, "✕")))));
}
// 직접 추가한 개인업무(일정) 목록 보기 · 삭제
function TaskManagePanel({
  personalTasks,
  setPersonalTasks,
  onAdd,
  onClose
}) {
  const sorted = [...personalTasks].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  const remove = id => setPersonalTasks(p => p.filter(x => x.id !== id));
  return /*#__PURE__*/React.createElement(Overlay, {
    title: `일정 관리 · 직접 추가한 업무 ${personalTasks.length}건`,
    onClose: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-3"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-neutral-500"
  }, "상단 '+ 일정 추가'로 등록한 업무를 한눈에 보고 삭제할 수 있어요."), /*#__PURE__*/React.createElement("button", {
    onClick: onAdd,
    className: "shrink-0 text-sm px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-semibold hover:bg-emerald-800"
  }, "+ 새 일정")), sorted.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "text-center text-sm text-neutral-400 py-10"
  }, "직접 추가한 업무가 없습니다.") : /*#__PURE__*/React.createElement("div", {
    className: "space-y-2"
  }, sorted.map(pt => /*#__PURE__*/React.createElement("div", {
    key: pt.id,
    className: "flex items-center gap-3 border border-neutral-200 rounded-lg px-3 py-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-semibold text-neutral-700 w-24 shrink-0"
  }, pt.date, /*#__PURE__*/React.createElement("span", {
    className: "ml-1 text-neutral-400"
  }, "(", WEEKDAYS[parse(pt.date).getDay()], ")")), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 min-w-0"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm truncate"
  }, pt.title), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-neutral-400 truncate"
  }, pt.customerName ? `${pt.customerName} · ` : "", pt.manager)), /*#__PURE__*/React.createElement("button", {
    onClick: () => remove(pt.id),
    className: "shrink-0 text-xs text-rose-500 hover:text-rose-700 hover:underline"
  }, "삭제")))));
}
// 담당자 추가/삭제 패널
function ManagersPanel({
  managers,
  setManagers,
  customers,
  onClose
}) {
  const [name, setName] = useState("");
  const countFor = n => customers.filter(c => c.manager === n).length;
  const add = () => {
    const nm = name.trim();
    if (!nm || managers.some(m => m.name === nm)) return;
    const color = MANAGER_PALETTE[managers.length % MANAGER_PALETTE.length];
    setManagers(ms => [...ms, { name: nm, color }]);
    setName("");
  };
  const remove = n => {
    const cnt = countFor(n);
    const msg = cnt > 0 ? `'${n}' 담당자를 삭제할까요?\n담당 고객사 ${cnt}곳이 있습니다. (고객사는 유지되지만 담당자 표시가 회색이 됩니다)` : `'${n}' 담당자를 삭제할까요?`;
    if (window.confirm(msg)) setManagers(ms => ms.filter(m => m.name !== n));
  };
  return /*#__PURE__*/React.createElement(Overlay, {
    title: "담당자 관리",
    onClose: onClose
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-neutral-500 mb-3"
  }, "담당자를 추가/삭제합니다. 퇴사자는 삭제하세요. (삭제해도 기존 고객사·업무 데이터는 유지됩니다)"), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 mb-4"
  }, /*#__PURE__*/React.createElement("input", {
    value: name,
    onChange: e => setName(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter") add();
    },
    placeholder: "새 담당자 이름",
    className: "flex-1 border border-neutral-300 rounded-lg px-3 py-2 text-sm"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: add,
    disabled: !name.trim(),
    className: "px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-semibold disabled:opacity-40 hover:bg-emerald-800"
  }, "추가")), /*#__PURE__*/React.createElement("div", {
    className: "space-y-1"
  }, managers.length === 0 && /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-neutral-400"
  }, "담당자가 없습니다."), managers.map(m => /*#__PURE__*/React.createElement("div", {
    key: m.name,
    className: "flex items-center justify-between border border-neutral-200 rounded-lg px-3 py-2 text-sm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: `w-3 h-3 rounded-full inline-block ${m.color}`
  }), /*#__PURE__*/React.createElement("span", {
    className: "font-semibold"
  }, m.name), /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-neutral-400"
  }, "담당 ", countFor(m.name), "곳")), /*#__PURE__*/React.createElement("button", {
    onClick: () => remove(m.name),
    className: "text-neutral-400 hover:text-rose-600 text-xs"
  }, "삭제")))));
}
function Overlay({
  title,
  children,
  onClose
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-full overflow-y-auto p-6",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-4"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "font-bold text-lg"
  }, title), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "text-neutral-400 hover:text-neutral-700"
  }, "✕")), children));
}

// ── 데이터 로더 래퍼 (기본 export) ──
// 마운트 시 /api/data 로 원천 데이터를 불러오고, App 에 초기값/저장함수를 주입.
// Supabase 미설정(configured:false)이면 시드 데이터로 인메모리 동작.
const SEED_DOC = {
  customers: SEED_CUSTOMERS,
  leaves: SEED_LEAVES,
  holidays: DEFAULT_HOLIDAYS,
  overrides: {},
  managerSteps: {},
  personalTasks: [],
  managers: DEFAULT_MANAGERS,
  stepDisabled: {},
  stepExtras: {},
  taskOrder: {}
};
const pickDoc = res => ({
  customers: res.customers || [],
  leaves: res.leaves || [],
  holidays: res.holidays || [],
  overrides: res.overrides || {},
  managerSteps: res.managerSteps || {},
  personalTasks: res.personalTasks || [],
  // 기존 DB(마이그레이션 전)엔 managers 가 비어있음 → 기본 담당자로 폴백
  managers: res.managers && res.managers.length ? res.managers : DEFAULT_MANAGERS,
  stepDisabled: res.stepDisabled || {},
  stepExtras: res.stepExtras || {},
  taskOrder: res.taskOrder || {}
});
function MapoApp() {
  const [state, setState] = useState({ status: "loading", data: null, configured: false });
  React.useEffect(() => {
    let alive = true;
    fetch("/api/data").then(r => r.json()).then(res => {
      if (!alive) return;
      if (res && res.configured && !res.error) {
        const empty = !res.customers || res.customers.length === 0;
        const data = empty ? SEED_DOC : pickDoc(res);
        setState({ status: "ready", data, configured: true });
        if (empty) {
          // 최초 실행: 시드 데이터를 DB에 채워넣음
          fetch("/api/data", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(SEED_DOC)
          }).catch(() => {});
        }
      } else {
        setState({ status: "ready", data: SEED_DOC, configured: false });
      }
    }).catch(() => {
      if (alive) setState({ status: "ready", data: SEED_DOC, configured: false });
    });
    return () => { alive = false; };
  }, []);
  const save = React.useCallback((doc, keepalive) => {
    return fetch("/api/data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(doc),
      keepalive: !!keepalive
    }).catch(() => {});
  }, []);
  if (state.status === "loading") {
    return /*#__PURE__*/React.createElement("div", {
      className: "min-h-screen flex items-center justify-center text-neutral-400 text-sm"
    }, "불러오는 중…");
  }
  return /*#__PURE__*/React.createElement(App, {
    initialData: state.data,
    onPersist: state.configured ? save : null
  });
}

export default MapoApp;
