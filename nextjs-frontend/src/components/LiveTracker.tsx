"use client";

import { useEffect, useRef, useState } from "react";

// Types for MediaPipe globals loaded via CDN
declare global {
    interface Window {
        Pose: any;
        Camera: any;
        drawConnectors: any;
        drawLandmarks: any;
        POSE_CONNECTIONS: any;
    }
}

const KICK_STATES = {
    idle: "Đứng thủ",
    chambering: "Rút gối",
    extending: "Bung chân",
    recovering: "Thu chân",
};

const STATE_COLORS: Record<string, string> = {
    idle: "#888888",
    chambering: "#FFD700",
    extending: "#FF6B35",
    recovering: "#00CFFF",
};

function calculateAngle(
    a: { x: number; y: number },
    b: { x: number; y: number },
    c: { x: number; y: number },
): number {
    const radians =
        Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) angle = 360.0 - angle;
    return angle;
}

export default function LiveTracker() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [feedback, setFeedback] = useState(
        "Đứng vào khung hình và thực hiện đá vòng cầu",
    );
    const [kickState, setKickState] = useState("idle");
    const [kneeAngle, setKneeAngle] = useState(0);
    const [kickHistory, setKickHistory] = useState<
        Array<{ score: number; emoji: string }>
    >([]);

    const stateMachineRef = useRef({
        state: "idle",
        minChamberAngle: 180,
        maxExtensionAngle: 0,
        lastAnkle: null as { x: number; y: number } | null,
        lastTime: 0,
        peakSpeed: 0,
    });
    const emaRef = useRef<Record<number, { x: number; y: number; z: number }>>(
        {},
    );

    const applyEMA = (lm: any, idx: number) => {
        if (!emaRef.current[idx]) {
            emaRef.current[idx] = { x: lm.x, y: lm.y, z: lm.z };
        } else {
            const a = 0.35;
            emaRef.current[idx].x = a * lm.x + (1 - a) * emaRef.current[idx].x;
            emaRef.current[idx].y = a * lm.y + (1 - a) * emaRef.current[idx].y;
            emaRef.current[idx].z = a * lm.z + (1 - a) * emaRef.current[idx].z;
        }
        return emaRef.current[idx];
    };

    const evaluateKick = (angle: number, ankle: { x: number; y: number }) => {
        const sm = stateMachineRef.current;
        const now = Date.now();
        let speed = 0;
        if (sm.lastAnkle) {
            const dx = ankle.x - sm.lastAnkle.x;
            const dy = ankle.y - sm.lastAnkle.y;
            const dt = now - sm.lastTime || 1;
            speed = (Math.sqrt(dx * dx + dy * dy) / dt) * 1000;
        }
        sm.lastAnkle = ankle;
        sm.lastTime = now;
        if (speed > sm.peakSpeed) sm.peakSpeed = speed;

        if (sm.state === "idle" && angle < 120) {
            sm.state = "chambering";
            sm.minChamberAngle = angle;
            sm.maxExtensionAngle = 0;
            sm.peakSpeed = 0;
            setKickState("chambering");
            setFeedback("Đang rút gối...");
        }
        if (sm.state === "chambering") {
            if (angle < sm.minChamberAngle) sm.minChamberAngle = angle;
            if (angle > sm.minChamberAngle + 15 && speed > 0.4) {
                sm.state = "extending";
                setKickState("extending");
                setFeedback("Đang bung chân!");
            } else if (angle > 165) {
                sm.state = "idle";
                setKickState("idle");
            }
        }
        if (sm.state === "extending") {
            if (angle > sm.maxExtensionAngle) sm.maxExtensionAngle = angle;
            if (angle < sm.maxExtensionAngle - 15) {
                sm.state = "recovering";
                setKickState("recovering");
                let score = 100;
                const msgs: string[] = [];
                if (sm.minChamberAngle > 75) {
                    score -= 25;
                    msgs.push(`⚠️ Rút gối: ${Math.round(sm.minChamberAngle)}°`);
                } else
                    msgs.push(`✅ Rút gối: ${Math.round(sm.minChamberAngle)}°`);
                if (sm.maxExtensionAngle < 140) {
                    score -= 30;
                    msgs.push(
                        `⚠️ Bung chân: ${Math.round(sm.maxExtensionAngle)}°`,
                    );
                } else
                    msgs.push(
                        `✅ Bung chân: ${Math.round(sm.maxExtensionAngle)}°`,
                    );
                if (sm.peakSpeed < 0.8) {
                    score -= 20;
                    msgs.push("⚠️ Tốc độ chậm");
                } else msgs.push("✅ Tốc độ tốt");
                score = Math.max(0, score);
                const emoji =
                    score >= 90
                        ? "🟢"
                        : score >= 75
                          ? "🟡"
                          : score >= 55
                            ? "🟠"
                            : "🔴";
                setFeedback(`${emoji} ${score} điểm — ${msgs.join(" | ")}`);
                setKickHistory((prev) =>
                    [{ score, emoji }, ...prev].slice(0, 5),
                );
            }
        }
        if (sm.state === "recovering" && (angle > 155 || angle < 60)) {
            setTimeout(() => {
                if (stateMachineRef.current.state === "recovering") {
                    stateMachineRef.current.state = "idle";
                    setKickState("idle");
                }
            }, 2000);
        }
    };

    useEffect(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        // Tải động MediaPipe CDN scripts an toàn
        const loadScript = (src: string): Promise<void> => {
            return new Promise((resolve, reject) => {
                if (document.querySelector(`script[src="${src}"]`)) {
                    resolve();
                    return;
                }
                const s = document.createElement("script");
                s.src = src;
                s.crossOrigin = "anonymous";
                s.onload = () => resolve();
                s.onerror = reject;
                document.body.appendChild(s);
            });
        };

        Promise.all([
            loadScript(
                "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js",
            ),
            loadScript(
                "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js",
            ),
            loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js"),
        ]).catch((err) => console.error("Lỗi tải MediaPipe scripts:", err));

        let pose: any;
        let camera: any;
        let mounted = true;

        const checkReady = setInterval(() => {
            if (window.Pose && window.Camera) {
                clearInterval(checkReady);
                pose = new window.Pose({
                    locateFile: (f: string) =>
                        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}`,
                });
                pose.setOptions({
                    modelComplexity: 1,
                    smoothLandmarks: true,
                    enableSegmentation: false,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5,
                });
                pose.onResults((results: any) => {
                    if (!mounted) return;
                    const ctx = canvas.getContext("2d")!;
                    ctx.save();
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(
                        results.image,
                        0,
                        0,
                        canvas.width,
                        canvas.height,
                    );
                    if (results.poseLandmarks) {
                        window.drawConnectors(
                            ctx,
                            results.poseLandmarks,
                            window.POSE_CONNECTIONS,
                            { color: "rgba(0,255,0,0.6)", lineWidth: 3 },
                        );
                        window.drawLandmarks(ctx, results.poseLandmarks, {
                            color: "#FF3366",
                            lineWidth: 2,
                            radius: 4,
                        });
                        const hip = applyEMA(results.poseLandmarks[24], 24);
                        const knee = applyEMA(results.poseLandmarks[26], 26);
                        const ankle = applyEMA(results.poseLandmarks[28], 28);
                        const angle = calculateAngle(hip, knee, ankle);
                        setKneeAngle(Math.round(angle));
                        evaluateKick(angle, ankle);
                        // Draw angle on canvas
                        const kx = knee.x * canvas.width;
                        const ky = knee.y * canvas.height;
                        const color =
                            angle < 80
                                ? "#00FF88"
                                : angle < 130
                                  ? "#FFD700"
                                  : "#FF4444";
                        ctx.beginPath();
                        ctx.arc(kx, ky, 38, 0, (angle * Math.PI) / 180);
                        ctx.strokeStyle = color;
                        ctx.lineWidth = 4;
                        ctx.stroke();
                        ctx.font = "bold 22px Arial";
                        ctx.lineWidth = 4;
                        ctx.strokeStyle = "rgba(0,0,0,0.8)";
                        ctx.strokeText(
                            `${Math.round(angle)}°`,
                            kx + 48,
                            ky + 6,
                        );
                        ctx.fillStyle = color;
                        ctx.fillText(`${Math.round(angle)}°`, kx + 48, ky + 6);
                    }
                    ctx.restore();
                });
                camera = new window.Camera(video, {
                    onFrame: async () => {
                        if (video.readyState === 4)
                            await pose.send({ image: video });
                    },
                    width: 1280,
                    height: 720,
                });
                camera.start().then(() => {
                    if (mounted) setIsLoaded(true);
                });
            }
        }, 200);

        return () => {
            mounted = false;
            clearInterval(checkReady);
            pose?.close();
            camera?.stop();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const stateColor = STATE_COLORS[kickState] ?? "#888";
    const stateLabel =
        KICK_STATES[kickState as keyof typeof KICK_STATES] ?? kickState;

    return (
        <>
            <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeInUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

            <div className="relative w-screen h-screen flex flex-col items-center bg-[#0a0a0a] overflow-hidden font-sans">
                {!isLoaded && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0a] z-30 gap-4">
                        <div
                            style={{
                                width: 50,
                                height: 50,
                                border: "4px solid rgba(255,255,255,0.1)",
                                borderTop: "4px solid #00FF88",
                                borderRadius: "50%",
                                animation: "spin 1s linear infinite",
                            }}
                        />
                        <p className="text-gray-400">
                            Đang khởi tạo Camera &amp; AI...
                        </p>
                    </div>
                )}

                {/* Top HUD */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10">
                    <div
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            backgroundColor: "rgba(0,0,0,0.75)",
                            border: `2px solid ${stateColor}`,
                            borderRadius: 20,
                            padding: "6px 18px",
                            color: stateColor,
                            fontWeight: "bold",
                            fontSize: "0.95rem",
                            transition: "border-color 0.2s",
                        }}
                    >
                        <span
                            style={{
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                backgroundColor: stateColor,
                                display: "inline-block",
                                boxShadow: `0 0 6px ${stateColor}`,
                            }}
                        />
                        {stateLabel}
                    </div>
                </div>

                {/* Left panel: angle */}
                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-10">
                    <div
                        style={{
                            backgroundColor: "rgba(0,0,0,0.7)",
                            border: `1px solid ${kneeAngle < 80 ? "#00FF88" : kneeAngle < 130 ? "#FFD700" : "#FF4444"}`,
                            borderRadius: 12,
                            padding: "8px 14px",
                            minWidth: 90,
                            textAlign: "center",
                        }}
                    >
                        <div
                            style={{
                                color: "#888",
                                fontSize: "0.7rem",
                                marginBottom: 2,
                            }}
                        >
                            GỐI
                        </div>
                        <div
                            style={{
                                color:
                                    kneeAngle < 80
                                        ? "#00FF88"
                                        : kneeAngle < 130
                                          ? "#FFD700"
                                          : "#FF4444",
                                fontSize: "1.6rem",
                                fontWeight: "bold",
                            }}
                        >
                            {kneeAngle}°
                        </div>
                    </div>
                </div>

                {/* Right panel: history */}
                {kickHistory.length > 0 && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
                        <div
                            style={{
                                backgroundColor: "rgba(0,0,0,0.75)",
                                border: "1px solid #333",
                                borderRadius: 12,
                                padding: "10px 16px",
                                minWidth: 180,
                            }}
                        >
                            <div
                                style={{
                                    color: "#888",
                                    fontSize: "0.7rem",
                                    marginBottom: 8,
                                }}
                            >
                                LỊCH SỬ ĐÁ
                            </div>
                            {kickHistory.map((entry, i) => (
                                <div
                                    key={i}
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        padding: "3px 0",
                                        borderBottom:
                                            i < kickHistory.length - 1
                                                ? "1px solid rgba(255,255,255,0.07)"
                                                : "none",
                                    }}
                                >
                                    <span
                                        style={{
                                            color: "#aaa",
                                            fontSize: "0.8rem",
                                        }}
                                    >
                                        #{kickHistory.length - i}
                                    </span>
                                    <span>{entry.emoji}</span>
                                    <span
                                        style={{
                                            fontWeight: "bold",
                                            color:
                                                entry.score >= 90
                                                    ? "#00FF88"
                                                    : entry.score >= 75
                                                      ? "#FFD700"
                                                      : entry.score >= 55
                                                        ? "#FF6B35"
                                                        : "#FF4444",
                                        }}
                                    >
                                        {entry.score}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Feedback */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 bg-black/70 text-white px-6 py-3 rounded-full text-sm font-semibold border border-white/10 max-w-[90vw] text-center">
                    {feedback}
                </div>

                <video ref={videoRef} className="hidden" autoPlay playsInline />
                <canvas
                    ref={canvasRef}
                    width={1280}
                    height={720}
                    style={{
                        width: "100%",
                        maxWidth: 1280,
                        height: "100%",
                        objectFit: "contain",
                        transform: "scaleX(-1)",
                    }}
                />

                <div className="absolute bottom-2 right-4 text-white/20 text-xs tracking-widest">
                    MARTIAL ARTS TRACKER · MEDIAPIPE
                </div>
            </div>
        </>
    );
}
