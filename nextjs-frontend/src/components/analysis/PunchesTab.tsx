"use client";

import React from "react";
import { PunchData } from "./types";

interface PunchesTabProps {
    punches: PunchData[];
    jumpToTime: (timeMs: number) => void;
}

export const PunchesTab: React.FC<PunchesTabProps> = ({
    punches,
    jumpToTime,
}) => {
    if (punches.length === 0) {
        return (
            <div className="text-center py-10 text-gray-500 text-sm bg-gray-900/50 rounded-xl border border-gray-800">
                Chưa phát hiện đòn đấm nào trong video này.
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {punches.map((punch, idx) => (
                <div
                    key={idx}
                    onClick={() =>
                        jumpToTime(punch.impactTimeMs || punch.startTimeMs)
                    }
                    className="p-3.5 rounded-xl border cursor-pointer transition-all hover:scale-[1.01] hover:border-blue-500/50 bg-gray-900 border-gray-800"
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-white flex items-center gap-2">
                            <span>{punch.emoji}</span>
                            <span>
                                {punch.punchType} (
                                {punch.arm === "right"
                                    ? "Tay Phải"
                                    : "Tay Trái"}
                                )
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-green-400 font-mono font-semibold">
                                {punch.score} điểm
                            </span>
                        </span>
                        <span className="text-xs text-blue-400 hover:underline">
                            {(punch.impactTimeMs / 1000).toFixed(2)}s ⏱️
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs mb-2 text-gray-400">
                        <div>
                            Góc duỗi:{" "}
                            <span className="text-white font-mono font-semibold">
                                {punch.maxElbowAngle}°
                            </span>
                        </div>
                        <div>
                            Tốc độ đỉnh:{" "}
                            <span className="text-white font-mono font-semibold">
                                {punch.peakSpeed} u/s
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1 border-t border-gray-800/60 pt-2">
                        {punch.details.map((d, j) => (
                            <div
                                key={j}
                                className="text-xs text-gray-300 flex items-center gap-1.5"
                            >
                                <span>•</span>
                                <span>{d}</span>
                            </div>
                        ))}
                    </div>

                    {/* Nút thao tác nhanh */}
                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-800/40 text-xs">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                jumpToTime(punch.startTimeMs);
                            }}
                            className="px-2 py-1 rounded bg-gray-850 hover:bg-gray-800 text-gray-300 transition"
                        >
                            Xem bắt đầu
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                jumpToTime(punch.impactTimeMs);
                            }}
                            className="px-2 py-1 rounded bg-blue-600/30 text-blue-400 hover:bg-blue-600/50 transition font-medium"
                        >
                            Xem va chạm (Impact)
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};
