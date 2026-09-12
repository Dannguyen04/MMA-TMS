"use client";

import React from "react";
import { AnalysisResult, PunchData, KickData, TechniqueFinding } from "./types";

interface ActionSummaryHeaderProps {
    result: AnalysisResult;
    punches: PunchData[];
    kicks: KickData[];
    findings: TechniqueFinding[];
}

export const ActionSummaryHeader: React.FC<ActionSummaryHeaderProps> = ({
    result,
    punches,
    kicks,
}) => {
    const primaryAction =
        result.summary.primaryAction ||
        (punches.length > kicks.length
            ? "punch"
            : kicks.length > punches.length
              ? "kick"
              : "mixed");

    return (
        <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800 shadow-lg">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold flex items-center gap-2">
                    <span>📊 Tổng kết Đánh giá</span>
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase font-semibold">
                    {primaryAction === "punch"
                        ? "🥊 Boxing / Đấm"
                        : primaryAction === "kick"
                          ? "🥋 Kicking / Đá"
                          : "MMA / Hỗn hợp"}
                </span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-gray-950/50 p-2 rounded-xl border border-gray-800">
                    <div className="text-xl font-bold text-white">
                        {result.summary.totalPunches ?? punches.length}
                    </div>
                    <div className="text-gray-500 text-[11px] mt-0.5">
                        Cú đấm
                    </div>
                </div>
                <div className="bg-gray-950/50 p-2 rounded-xl border border-gray-800">
                    <div className="text-xl font-bold text-white">
                        {result.summary.totalKicks ?? kicks.length}
                    </div>
                    <div className="text-gray-500 text-[11px] mt-0.5">
                        Cú đá
                    </div>
                </div>
                <div className="bg-gray-950/50 p-2 rounded-xl border border-gray-800">
                    <div className="text-xl font-bold text-yellow-400">
                        {result.summary.avgScore}
                    </div>
                    <div className="text-gray-500 text-[11px] mt-0.5">
                        Điểm TB
                    </div>
                </div>
                <div className="bg-gray-950/50 p-2 rounded-xl border border-gray-800">
                    <div className="text-xl font-bold text-green-400">
                        {result.summary.bestScore}
                    </div>
                    <div className="text-gray-500 text-[11px] mt-0.5">
                        Tốt nhất
                    </div>
                </div>
            </div>
        </div>
    );
};
