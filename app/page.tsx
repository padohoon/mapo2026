"use client";

import dynamic from "next/dynamic";

// 앱은 브라우저 전용(모듈 로드시 new Date()/Date.now() 사용)이라 SSR 비활성화
const MapoApp = dynamic(() => import("@/components/MapoApp"), { ssr: false });

export default function Home() {
  return <MapoApp />;
}
