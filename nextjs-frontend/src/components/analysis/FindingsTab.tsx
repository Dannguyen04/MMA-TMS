"use client";

import React from "react";
import { TechniqueFinding } from "./types";

interface FindingsTabProps {
    findings: TechniqueFinding[];
    jumpToTime: (timeMs: number) => void;
}

const SEVERITY_STYLES: Record<string, string> = {
    positive: "border-emerald-500/40 bg-emerald-950/20 text-emerald-400",
    info: "border-blue-500/40 bg-blue-950/20 text-blue-400",
    warning: "border-amber-500/40 bg-amber-950/20 text-amber-400",
    critical: "border-rose-500/40 bg-rose-950/20 text-rose-400",
};

const SEVERITY_BADGES: Record<string, string> = {
    positive: "🟢 KHEN NGỢI (EXCELLENT)",
    info: "🔵 THÔNG TIN (INFO)",
    warning: "⚠️ LƯU Ý KỸ THUẬT (WARNING)",
    critical: "🔴 LỖI NGUY HIỂM (CRITICAL)",
};

export const FindingsTab: React.FC<FindingsTabProps> = ({
    findings,
    jumpToTime,
}) => {
    if (findings.length === 0) {
        return (
            <div className="text-center py-10 text-gray-500 text-sm bg-gray-900/50 rounded-xl border border-gray-800">
                Chưa có nhận xét kỹ thuật nào cho video này.
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {findings.map((finding, idx) => {
                const severityStyles =
                    SEVERITY_STYLES[finding.severity] ||
                    "border-gray-700 bg-gray-900 text-gray-300";
                const severityBadge =
                    SEVERITY_BADGES[finding.severity] || "INFO";

                return (
                    <div
                        key={idx}
                        onClick={() => jumpToTime(finding.timeMs)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.01] ${severityStyles}`}
                    >
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-bold tracking-wider uppercase">
                                {severityBadge}
                            </span>
                            <span className="text-xs text-gray-400 hover:text-white">
                                {(finding.timeMs / 1000).toFixed(2)}s (Frame{" "}
                                {finding.frameIdx})
                            </span>
                        </div>
                        <h4 className="text-sm font-bold text-white mb-1">
                            {finding.title}
                        </h4>
                        <p className="text-xs text-gray-300 leading-relaxed mb-2.5">
                            {finding.description}
                        </p>

                        {finding.recommendation && (
                            <div className="bg-black/40 rounded-lg p-2.5 border border-white/5 text-xs text-gray-200">
                                <span className="font-semibold text-amber-300 block mb-0.5">
                                    💡 Lời khuyên HLV (AI Coach Recommendation):
                                </span>
                                {finding.recommendation}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
