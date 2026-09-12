"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, type AnalysisJob } from "@/lib/api";
import { AnalysisResult, FrameData } from "@/components/analysis/types";
import { VideoCanvasPlayer } from "@/components/analysis/VideoCanvasPlayer";
import { ActionSummaryHeader } from "@/components/analysis/ActionSummaryHeader";
import { PunchesTab } from "@/components/analysis/PunchesTab";
import { KicksTab } from "@/components/analysis/KicksTab";
import { FindingsTab } from "@/components/analysis/FindingsTab";

export default function ResultPage() {
    const { jobId } = useParams<{ jobId: string }>();
    const [job, setJob] = useState<AnalysisJob | null>(null);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [currentFrame, setCurrentFrame] = useState<FrameData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState<
        "punches" | "kicks" | "findings"
    >("punches");

    const videoRef = useRef<HTMLVideoElement>(null);

    // Load job + result JSON
    useEffect(() => {
        (async () => {
            try {
                const j = await api.getJob(jobId);
                setJob(j);
                if (j.status !== "DONE" || !j.resultUrl) {
                    setLoading(false);
                    return;
                }

                const res = await fetch(j.resultUrl);
                if (!res.ok)
                    throw new Error("Không tải được file kết quả phân tích");
                const data: AnalysisResult = await res.json();
                setResult(data);

                // Tự động chuyển tab theo hành động chính phát hiện được
                if (data.punches && data.punches.length > 0) {
                    setActiveTab("punches");
                } else if (data.kicks && data.kicks.length > 0) {
                    setActiveTab("kicks");
                } else if (data.findings && data.findings.length > 0) {
                    setActiveTab("findings");
                }

                setLoading(false);
            } catch (e: any) {
                setError(e.message || "Lỗi tải kết quả");
                setLoading(false);
            }
        })();
    }, [jobId]);

    const jumpToTime = (timeMs: number) => {
        if (!videoRef.current) return;
        videoRef.current.pause();
        videoRef.current.currentTime = Math.max(0, timeMs / 1000);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="text-gray-400 animate-pulse text-base flex items-center gap-3">
                    <span className="animate-spin text-xl">⏳</span> Đang tải dữ
                    liệu phân tích MMA-TMS...
                </div>
            </div>
        );
    }

    if (error || !job) {
        return (
            <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
                <p className="text-red-400">{error || "Không tìm thấy job"}</p>
                <Link
                    href="/analysis"
                    className="text-blue-400 hover:underline"
                >
                    ← Quay lại tải lên
                </Link>
            </div>
        );
    }

    const punches = result?.punches || [];
    const kicks = result?.kicks || [];
    const findings = result?.findings || [];

    return (
        <main className="min-h-screen bg-gray-950 p-6 text-gray-200">
            <div className="max-w-7xl mx-auto">
                {/* Header navigation & status */}
                <div className="flex items-center gap-3 mb-6">
                    <Link
                        href="/analysis"
                        className="text-gray-500 hover:text-white text-sm"
                    >
                        ← Upload Video
                    </Link>
                    <span className="text-gray-700">/</span>
                    <span className="text-white font-semibold flex items-center gap-2">
                        <span>MMA-TMS Phân tích Chuyển động</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            Insight Engine
                        </span>
                    </span>
                    <span className="ml-auto px-3 py-1 rounded-full text-xs bg-green-500/20 text-green-400 border border-green-500/30 font-medium">
                        {job.status}
                    </span>
                </div>

                {job.status !== "DONE" || !result ? (
                    <div className="text-center py-20 text-gray-400">
                        <p className="text-2xl mb-2">
                            {job.status === "PROCESSING" ? "⏳" : "❌"}
                        </p>
                        <p>Trạng thái job: {job.status}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Cột trái: Video Player + Canvas Overlay + Controls (7/12) */}
                        <div className="lg:col-span-7">
                            <VideoCanvasPlayer
                                videoUrl={job.videoUrl}
                                result={result}
                                videoRef={videoRef}
                                currentFrame={currentFrame}
                                setCurrentFrame={setCurrentFrame}
                            />
                        </div>

                        {/* Cột phải: Tổng kết + Danh sách đòn + AI Findings (5/12) */}
                        <div className="lg:col-span-5 flex flex-col gap-4">
                            {/* Thẻ tổng kết điểm & loại đòn */}
                            <ActionSummaryHeader
                                result={result}
                                punches={punches}
                                kicks={kicks}
                                findings={findings}
                            />

                            {/* Bộ chuyển đổi Tab */}
                            <div className="flex border-b border-gray-800 gap-2 pb-1 text-sm font-medium">
                                <button
                                    onClick={() => setActiveTab("punches")}
                                    className={`pb-2 px-3 transition-colors relative ${
                                        activeTab === "punches"
                                            ? "text-blue-400 border-b-2 border-blue-500 font-semibold"
                                            : "text-gray-400 hover:text-gray-200"
                                    }`}
                                >
                                    🥊 Đòn đấm ({punches.length})
                                </button>
                                <button
                                    onClick={() => setActiveTab("findings")}
                                    className={`pb-2 px-3 transition-colors relative ${
                                        activeTab === "findings"
                                            ? "text-blue-400 border-b-2 border-blue-500 font-semibold"
                                            : "text-gray-400 hover:text-gray-200"
                                    }`}
                                >
                                    💡 AI Findings ({findings.length})
                                </button>
                                <button
                                    onClick={() => setActiveTab("kicks")}
                                    className={`pb-2 px-3 transition-colors relative ${
                                        activeTab === "kicks"
                                            ? "text-blue-400 border-b-2 border-blue-500 font-semibold"
                                            : "text-gray-400 hover:text-gray-200"
                                    }`}
                                >
                                    🥋 Cú đá ({kicks.length})
                                </button>
                            </div>

                            {/* Danh sách nội dung cuộn theo tab */}
                            <div className="flex-1 max-h-[52vh] overflow-y-auto pr-1">
                                {activeTab === "punches" && (
                                    <PunchesTab
                                        punches={punches}
                                        jumpToTime={jumpToTime}
                                    />
                                )}
                                {activeTab === "findings" && (
                                    <FindingsTab
                                        findings={findings}
                                        jumpToTime={jumpToTime}
                                    />
                                )}
                                {activeTab === "kicks" && (
                                    <KicksTab
                                        kicks={kicks}
                                        jumpToTime={jumpToTime}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
