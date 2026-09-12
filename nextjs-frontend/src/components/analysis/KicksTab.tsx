"use client";

import React from "react";
import { KickData } from "./types";

interface KicksTabProps {
    kicks: KickData[];
    jumpToTime: (timeMs: number) => void;
}

export const KicksTab: React.FC<KicksTabProps> = ({ kicks, jumpToTime }) => {
    if (kicks.length === 0) {
        return (
            <div className="text-center py-10 text-gray-500 text-sm bg-gray-900/50 rounded-xl border border-gray-800">
                Chưa phát hiện cú đá nào trong video này.
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {kicks.map((kick, idx) => (
                <div
                    key={idx}
                    onClick={() => jumpToTime(kick.startTimeMs)}
                    className="p-3.5 rounded-xl border cursor-pointer transition-all hover:scale-[1.01] hover:border-yellow-500/50 bg-gray-900 border-gray-800"
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-white flex items-center gap-2">
                            <span>{kick.emoji}</span>
                            <span>Cú đá #{idx + 1}</span>
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-yellow-400 font-mono font-semibold">
                                {kick.score} điểm ({kick.grade})
                            </span>
                        </span>
                        <span className="text-xs text-yellow-400 hover:underline">
                            {(kick.startTimeMs / 1000).toFixed(2)}s ⏱️
                        </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs mb-2 text-gray-400">
                        <div>
                            Rút gối:{" "}
                            <span className="text-white font-mono font-semibold">
                                {kick.minChamberAngle}°
                            </span>
                        </div>
                        <div>
                            Bung chân:{" "}
                            <span className="text-white font-mono font-semibold">
                                {kick.maxExtensionAngle}°
                            </span>
                        </div>
                        <div>
                            Tốc độ:{" "}
                            <span className="text-white font-mono font-semibold">
                                {kick.peakSpeed} u/s
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1 border-t border-gray-800/60 pt-2">
                        {kick.details.map((d, j) => (
                            <div
                                key={j}
                                className="text-xs text-gray-300 flex items-center gap-1.5"
                            >
                                <span>•</span>
                                <span>{d}</span>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-800/40 text-xs">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                jumpToTime(kick.startTimeMs);
                            }}
                            className="px-2 py-1 rounded bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/40 transition font-medium"
                        >
                            Xem thời điểm ra đòn
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};
