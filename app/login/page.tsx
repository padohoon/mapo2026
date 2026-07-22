"use client";

import { useState } from "react";

export default function LoginPage() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) {
        const next =
          new URLSearchParams(window.location.search).get("next") || "/";
        window.location.href = next;
      } else {
        const j = await res.json().catch(() => ({}));
        setErr(j.error || "로그인에 실패했습니다.");
        setLoading(false);
      }
    } catch {
      setErr("연결에 실패했습니다.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-neutral-200 p-8"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold text-lg">
            마
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">마포 액션플랜</h1>
            <p className="text-xs text-neutral-500">팀 전용 · 비밀번호 입력</p>
          </div>
        </div>

        <label className="block text-sm">
          <span className="text-xs font-semibold text-neutral-600">비밀번호</span>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoFocus
            placeholder="팀 공용 비밀번호"
            className="mt-1 w-full border border-neutral-300 rounded-lg px-3 py-2"
          />
        </label>

        {err && <p className="text-xs text-rose-600 mt-2">{err}</p>}

        <button
          type="submit"
          disabled={loading || !pw}
          className="mt-5 w-full py-3 rounded-lg bg-emerald-700 text-white font-bold disabled:opacity-40 hover:bg-emerald-800"
        >
          {loading ? "확인 중…" : "로그인"}
        </button>
      </form>
    </div>
  );
}
