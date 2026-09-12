import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
          🥋 Martial Arts Tracker
        </h1>
        <p className="text-gray-400 text-lg">
          Phân tích kỹ thuật võ thuật bằng AI
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
        {/* Live Mode */}
        <Link
          href="/live"
          className="group relative flex flex-col items-center p-8 rounded-2xl border border-green-500/30 bg-green-500/5 hover:bg-green-500/10 hover:border-green-500/60 transition-all duration-200"
        >
          <span className="text-5xl mb-4">📸</span>
          <h2 className="text-xl font-bold text-white mb-2">Live Camera</h2>
          <p className="text-gray-400 text-sm text-center">
            Phân tích realtime qua Webcam với MediaPipe AI
          </p>
          <span className="mt-4 px-4 py-1.5 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30">
            Phase 1 · Instant
          </span>
        </Link>

        {/* Upload Mode */}
        <Link
          href="/analysis"
          className="group relative flex flex-col items-center p-8 rounded-2xl border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/60 transition-all duration-200"
        >
          <span className="text-5xl mb-4">🎬</span>
          <h2 className="text-xl font-bold text-white mb-2">Upload Video</h2>
          <p className="text-gray-400 text-sm text-center">
            Phân tích chuyên sâu với YOLOv8-Pose AI
          </p>
          <span className="mt-4 px-4 py-1.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
            Phase 2+3 · High Accuracy
          </span>
        </Link>
      </div>

      <p className="mt-12 text-gray-600 text-xs">
        Martial Arts Tracker — Powered by MediaPipe &amp; YOLOv8
      </p>
    </main>
  );
}
