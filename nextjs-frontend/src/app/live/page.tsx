'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';

// Dynamic import để tránh SSR issues với browser APIs
const LiveTracker = dynamic(() => import('@/components/LiveTracker'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-gray-950">
      <p className="text-gray-400">Đang tải AI Engine...</p>
    </div>
  ),
});

export default function LivePage() {
  return (
    <div className="relative">
      <Link
        href="/"
        className="absolute top-4 left-4 z-50 px-3 py-1.5 rounded-lg bg-black/60 text-white text-sm border border-white/10 hover:bg-black/80 transition"
      >
        ← Trang chủ
      </Link>
      <LiveTracker />
    </div>
  );
}
