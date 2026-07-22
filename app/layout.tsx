import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "마포 액션플랜 · 업무 자동 배치",
  description: "월리포트 날짜(앵커) 기준으로 업무가 자동 배치되는 마케팅 대행 일정 관리",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
