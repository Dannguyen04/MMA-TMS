"use client";

import React, { useRef, useEffect, useState } from "react";
import { AnalysisResult, FrameData } from "./types";

interface VideoCanvasPlayerProps {
    videoUrl: string;
    result: AnalysisResult;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    currentFrame: FrameData | null;
    setCurrentFrame: (f: FrameData | null) => void;
}

export const VideoCanvasPlayer: React.FC<VideoCanvasPlayerProps> = ({
    videoUrl,
    result,
    videoRef,
    currentFrame,
    setCurrentFrame,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef = useRef<number>(0);
    const [showSkeleton, setShowSkeleton] = useState(true);
    const [playbackRate, setPlaybackRate] = useState(1);

    const handleLoadedMetadata = () => {
        if (videoRef.current && canvasRef.current) {
            const v = videoRef.current;
            if (v.videoWidth && v.videoHeight) {
                canvasRef.current.width = v.videoWidth;
                canvasRef.current.height = v.videoHeight;
            }
        }
    };

    const stepFrame = (frames: number) => {
        if (!videoRef.current) return;
        videoRef.current.pause();
        const fps = result?.meta?.fps || 30;
        videoRef.current.currentTime = Math.max(
            0,
            Math.min(
                videoRef.current.duration || 0,
                videoRef.current.currentTime + frames / fps,
            ),
        );
    };

    const setSpeed = (speed: number) => {
        if (!videoRef.current) return;
        videoRef.current.playbackRate = speed;
        setPlaybackRate(speed);
    };

    // Sync canvas overlay với video playback
    useEffect(() => {
        if (!result || !videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d")!;

        const drawOverlay = () => {
            if (
                video.videoWidth &&
                (canvas.width !== video.videoWidth ||
                    canvas.height !== video.videoHeight)
            ) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const timeMs = video.currentTime * 1000;
            if (result.frames && result.frames.length > 0) {
                const frame = result.frames.reduce((best, f) =>
                    Math.abs(f.timeMs - timeMs) < Math.abs(best.timeMs - timeMs)
                        ? f
                        : best,
                );
                setCurrentFrame(frame);

                if (
                    showSkeleton &&
                    frame &&
                    frame.landmarks &&
                    frame.landmarks.length > 0
                ) {
                    const w = canvas.width;
                    const h = canvas.height;
                    const scale = Math.max(w, h) / 1000;

                    const standardConnections = [
                        [5, 6], // Vai
                        [5, 11],
                        [6, 12],
                        [11, 12], // Thân
                        [11, 13],
                        [13, 15], // Chân trái
                        [12, 14],
                        [14, 16], // Chân phải
                    ];

                    const armConnections = [
                        { pair: [5, 7], arm: "left" },
                        { pair: [7, 9], arm: "left" },
                        { pair: [6, 8], arm: "right" },
                        { pair: [8, 10], arm: "right" },
                    ];

                    // Vẽ thân & chân
                    ctx.strokeStyle = "rgba(0, 255, 120, 0.85)";
                    ctx.lineWidth = Math.max(2, Math.round(3.5 * scale));

                    for (const [a, b] of standardConnections) {
                        const pa = frame.landmarks[a];
                        const pb = frame.landmarks[b];
                        if (pa && pb && pa.conf > 0.25 && pb.conf > 0.25) {
                            ctx.beginPath();
                            ctx.moveTo(pa.x * w, pa.y * h);
                            ctx.lineTo(pb.x * w, pb.y * h);
                            ctx.stroke();
                        }
                    }

                    // Vẽ tay (Highlight rực rỡ cánh tay đang tung đòn đấm)
                    const isPunching =
                        frame.punchState && frame.punchState !== "guard";
                    for (const {
                        pair: [a, b],
                        arm,
                    } of armConnections) {
                        const pa = frame.landmarks[a];
                        const pb = frame.landmarks[b];
                        if (pa && pb && pa.conf > 0.25 && pb.conf > 0.25) {
                            ctx.beginPath();
                            ctx.moveTo(pa.x * w, pa.y * h);
                            ctx.lineTo(pb.x * w, pb.y * h);

                            if (isPunching && frame.activeArm === arm) {
                                ctx.strokeStyle = "#FF3366";
                                ctx.lineWidth = Math.max(
                                    3,
                                    Math.round(5.5 * scale),
                                );
                                ctx.shadowColor = "#FF3366";
                                ctx.shadowBlur = 10;
                                ctx.stroke();
                                ctx.shadowBlur = 0;
                            } else {
                                ctx.strokeStyle = "rgba(0, 255, 120, 0.85)";
                                ctx.lineWidth = Math.max(
                                    2,
                                    Math.round(3.5 * scale),
                                );
                                ctx.stroke();
                            }
                        }
                    }

                    // Vẽ các khớp nối (Joint dots)
                    const dotRadius = Math.max(3, Math.round(5 * scale));
                    for (const lm of frame.landmarks) {
                        if (lm && lm.conf > 0.25) {
                            ctx.beginPath();
                            ctx.arc(
                                lm.x * w,
                                lm.y * h,
                                dotRadius,
                                0,
                                Math.PI * 2,
                            );
                            ctx.fillStyle = "#FF2266";
                            ctx.fill();
                            ctx.strokeStyle = "#FFFFFF";
                            ctx.lineWidth = Math.max(
                                1,
                                Math.round(1.5 * scale),
                            );
                            ctx.stroke();
                        }
                    }

                    // Góc cùi chỏ khi đấm
                    if (
                        isPunching &&
                        frame.activeArm &&
                        frame.activeArm !== "none"
                    ) {
                        const elbowIdx = frame.activeArm === "right" ? 8 : 7;
                        const elbow = frame.landmarks[elbowIdx];
                        const elbowAngle =
                            frame.activeArm === "right"
                                ? frame.elbowAngleRight || 0
                                : frame.elbowAngleLeft || 0;

                        if (elbow && elbow.conf > 0.25 && elbowAngle > 0) {
                            const ex = elbow.x * w;
                            const ey = elbow.y * h;
                            const arcRadius = Math.max(
                                22,
                                Math.round(36 * scale),
                            );
                            const angleColor =
                                elbowAngle >= 155
                                    ? "#00FF88"
                                    : elbowAngle >= 140
                                      ? "#FFD700"
                                      : "#FF6B35";

                            ctx.beginPath();
                            ctx.arc(
                                ex,
                                ey,
                                arcRadius,
                                0,
                                (elbowAngle * Math.PI) / 180,
                            );
                            ctx.strokeStyle = angleColor;
                            ctx.lineWidth = Math.max(
                                2,
                                Math.round(3.5 * scale),
                            );
                            ctx.stroke();

                            const fontSize = Math.max(
                                14,
                                Math.round(22 * scale),
                            );
                            ctx.font = `bold ${fontSize}px Arial, sans-serif`;
                            ctx.strokeStyle = "rgba(0,0,0,0.95)";
                            ctx.lineWidth = Math.max(2, Math.round(4 * scale));
                            const text = `🥊 ${elbowAngle}°`;
                            ctx.strokeText(text, ex + arcRadius + 6, ey + 6);
                            ctx.fillStyle = angleColor;
                            ctx.fillText(text, ex + arcRadius + 6, ey + 6);
                        }
                    }

                    // Góc gối khi đá
                    if (
                        frame.kickState &&
                        frame.kickState !== "idle" &&
                        frame.kneeAngle > 0
                    ) {
                        const kneeIdx = frame.activeLeg === "left" ? 13 : 14;
                        const knee = frame.landmarks[kneeIdx];
                        if (knee && knee.conf > 0.25) {
                            const kx = knee.x * w;
                            const ky = knee.y * h;
                            const color =
                                frame.kneeAngle < 80
                                    ? "#00FF88"
                                    : frame.kneeAngle < 130
                                      ? "#FFD700"
                                      : "#FF4444";
                            const arcRadius = Math.max(
                                20,
                                Math.round(35 * scale),
                            );

                            ctx.beginPath();
                            ctx.arc(
                                kx,
                                ky,
                                arcRadius,
                                0,
                                (frame.kneeAngle * Math.PI) / 180,
                            );
                            ctx.strokeStyle = color;
                            ctx.lineWidth = Math.max(2, Math.round(3 * scale));
                            ctx.stroke();

                            const fontSize = Math.max(
                                14,
                                Math.round(22 * scale),
                            );
                            ctx.font = `bold ${fontSize}px Arial, sans-serif`;
                            ctx.strokeStyle = "rgba(0,0,0,0.9)";
                            ctx.lineWidth = Math.max(
                                2,
                                Math.round(3.5 * scale),
                            );
                            ctx.strokeText(
                                `${frame.kneeAngle}°`,
                                kx + arcRadius + 6,
                                ky + 6,
                            );
                            ctx.fillStyle = color;
                            ctx.fillText(
                                `${frame.kneeAngle}°`,
                                kx + arcRadius + 6,
                                ky + 6,
                            );
                        }
                    }
                }
            }

            animRef.current = requestAnimationFrame(drawOverlay);
        };

        animRef.current = requestAnimationFrame(drawOverlay);
        return () => cancelAnimationFrame(animRef.current);
    }, [result, showSkeleton, setCurrentFrame, videoRef]);

    // Trạng thái đòn hiện tại
    const isPunching =
        currentFrame?.punchState && currentFrame.punchState !== "guard";
    const isKicking =
        currentFrame?.kickState && currentFrame.kickState !== "idle";

    const badgeStateLabel = isPunching
        ? `🥊 ${currentFrame?.punchStateLabel || "Ra đòn đấm"}`
        : isKicking
          ? `🥋 ${currentFrame?.kickStateLabel || "Ra đòn đá"}`
          : "🛡️ Thế thủ (Guard)";

    const badgeColor = isPunching
        ? "#FF3366"
        : isKicking
          ? "#FFD700"
          : "#00CFFF";

    return (
        <div className="space-y-4">
            {/* Khung Video + Canvas Overlay */}
            <div className="relative rounded-2xl overflow-hidden bg-black border border-gray-800 shadow-2xl flex items-center justify-center min-h-[380px]">
                <video
                    ref={videoRef}
                    src={videoUrl}
                    controls
                    playsInline
                    onLoadedMetadata={handleLoadedMetadata}
                    className="w-full max-h-[72vh] object-contain mx-auto"
                    style={{ display: "block" }}
                />
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full pointer-events-none object-contain mx-auto"
                />

                {/* Badge trạng thái thời gian thực */}
                {currentFrame && (
                    <div
                        className="absolute top-4 left-4"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            backgroundColor: "rgba(0,0,0,0.85)",
                            backdropFilter: "blur(6px)",
                            border: `1.5px solid ${badgeColor}`,
                            borderRadius: 24,
                            padding: "6px 16px",
                            color: badgeColor,
                            fontWeight: "bold",
                            fontSize: "0.85rem",
                        }}
                    >
                        <span
                            style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                backgroundColor: badgeColor,
                                display: "inline-block",
                            }}
                            className="animate-pulse"
                        />
                        {badgeStateLabel}
                    </div>
                )}
            </div>

            {/* Thanh điều khiển video chuyên nghiệp */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-900 border border-gray-800 rounded-xl p-3">
                {/* Tốc độ xem */}
                <div className="flex items-center gap-1.5">
                    <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider mr-1">
                        Tốc độ:
                    </span>
                    {[0.25, 0.5, 1.0].map((rate) => (
                        <button
                            key={rate}
                            onClick={() => setSpeed(rate)}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                                playbackRate === rate
                                    ? "bg-blue-600 text-white shadow"
                                    : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
                            }`}
                        >
                            {rate}x {rate < 1 ? "(Slow)" : ""}
                        </button>
                    ))}
                </div>

                {/* Điều hướng từng khung hình */}
                <div className="flex items-center gap-1.5">
                    <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider mr-1">
                        Khung hình:
                    </span>
                    <button
                        onClick={() => stepFrame(-1)}
                        title="Lùi 1 frame"
                        className="px-2.5 py-1 rounded text-xs font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition"
                    >
                        ⏮ -1
                    </button>
                    <button
                        onClick={() => stepFrame(1)}
                        title="Tiến 1 frame"
                        className="px-2.5 py-1 rounded text-xs font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition"
                    >
                        +1 ⏭
                    </button>
                </div>

                {/* Bật/Tắt Khung xương */}
                <div>
                    <button
                        onClick={() => setShowSkeleton(!showSkeleton)}
                        className={`px-3 py-1 rounded text-xs font-medium transition flex items-center gap-1.5 ${
                            showSkeleton
                                ? "bg-green-600/20 text-green-400 border border-green-500/30"
                                : "bg-gray-800 text-gray-400 hover:text-white"
                        }`}
                    >
                        <span>
                            {showSkeleton
                                ? "👁️ Khung xương: Bật"
                                : "🙈 Khung xương: Tắt"}
                        </span>
                    </button>
                </div>
            </div>

            {/* Thẻ metrics frame hiện tại */}
            {currentFrame && (
                <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-gray-950/60 p-2.5 rounded-lg border border-gray-800/80">
                        <div className="text-gray-500 mb-1">Cùi chỏ Phải</div>
                        <div className="text-white font-mono font-bold text-sm">
                            {currentFrame.elbowAngleRight !== undefined
                                ? `${currentFrame.elbowAngleRight}°`
                                : "—"}
                        </div>
                    </div>
                    <div className="bg-gray-950/60 p-2.5 rounded-lg border border-gray-800/80">
                        <div className="text-gray-500 mb-1">Cùi chỏ Trái</div>
                        <div className="text-white font-mono font-bold text-sm">
                            {currentFrame.elbowAngleLeft !== undefined
                                ? `${currentFrame.elbowAngleLeft}°`
                                : "—"}
                        </div>
                    </div>
                    <div className="bg-gray-950/60 p-2.5 rounded-lg border border-gray-800/80">
                        <div className="text-gray-500 mb-1">Góc Gối</div>
                        <div className="text-white font-mono font-bold text-sm">
                            {currentFrame.kneeAngle}°
                        </div>
                    </div>
                    <div className="bg-gray-950/60 p-2.5 rounded-lg border border-gray-800/80">
                        <div className="text-gray-500 mb-1">Thời gian</div>
                        <div className="text-white font-mono font-bold text-sm">
                            {(currentFrame.timeMs / 1000).toFixed(2)}s
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
