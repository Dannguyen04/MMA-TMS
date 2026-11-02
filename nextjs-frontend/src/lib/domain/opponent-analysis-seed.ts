import type { OpponentAnalysis } from "@/lib/domain/round-advice";

/**
 * Sample opponent analysis for API-mode demos. The backend does not seed tactics;
 * the corner card and round-advice UI stay empty until this payload is saved.
 */
export const SAMPLE_OPPONENT_ANALYSIS = {
    profile: {
        wins: 6,
        losses: 2,
        draws: 0,
        stance: "SOUTHPAW" as const,
        style: "STRIKER" as const,
        heightCm: 174,
        reachCm: 176,
        source: "Băng hình giải CLB 2025",
    },
    observations: [
        {
            id: "obs-1",
            kind: "HABIT" as const,
            text: "Hạ tay phải sau khi tung đòn đá thấp chân sau",
            evidenceUrl: "https://example.com/low-kick",
            evidenceTime: "01:45",
            evidenceNote: "Lặp lại ở hiệp 1 và hiệp 2 trận bán kết 2025",
            confidence: "REPEATED" as const,
        },
        {
            id: "obs-2",
            kind: "OPENING" as const,
            text: "Di chuyển lùi thẳng về phía lồng khi bị áp sát bằng đòn tay",
            evidenceUrl: null,
            evidenceTime: null,
            evidenceNote: "Trận gặp Nguyễn Vũ (2025), hiệp 2",
            confidence: "REPEATED" as const,
        },
        {
            id: "obs-3",
            kind: "STRENGTH" as const,
            text: "Đòn móc trái phản công rất nặng ở cự ly gần khi đối phương lao vào",
            evidenceUrl: "https://example.com/hook",
            evidenceTime: "00:32",
            evidenceNote: "Thắng TKO hiệp 1 nhờ đòn phản công này",
            confidence: "ONCE" as const,
        },
        {
            id: "obs-4",
            kind: "HABIT" as const,
            text: "Nhịp thở chậm lại và đứng trụ nặng từ cuối hiệp 2",
            evidenceUrl: null,
            evidenceTime: null,
            evidenceNote: "Ghi chép góc đài tại giải mở rộng",
            confidence: "ONCE" as const,
        },
    ],
    tactics: [
        {
            id: "tac-1",
            text: "Bước chéo sang trái, phản đòn móc trái ngay khi đối thủ thu chân đá thấp",
            round: null,
            observationIds: ["obs-1"],
            sessionIds: [] as string[],
            partnerBrief: "Bạn tập đứng southpaw, đá low kick chân sau rồi hạ nhẹ tay phải",
        },
        {
            id: "tac-2",
            text: "Ép góc bằng chuỗi jab — đấm thẳng rồi cắt góc ngang, không cho lùi thẳng",
            round: 1,
            observationIds: ["obs-2"],
            sessionIds: [] as string[],
            partnerBrief: "Bạn tập lùi thẳng về lồng khi bị áp sát liên tiếp",
        },
        {
            id: "tac-3",
            text: "Giữ tay phải cao che hàm khi thoát áp sát, không đổi đòn tay cự ly ngắn",
            round: 2,
            observationIds: ["obs-3"],
            sessionIds: [] as string[],
            partnerBrief: "Bạn tập chờ đối phương vào gần rồi tung móc trái phản công",
        },
        {
            id: "tac-4",
            text: "Tăng nhịp đòn vào vùng bụng và đổi tầng vật từ giữa hiệp 2",
            round: null,
            observationIds: ["obs-4"],
            sessionIds: [] as string[],
            partnerBrief: null,
        },
    ],
} satisfies OpponentAnalysis;

export type SampleOpponentAnalysis = typeof SAMPLE_OPPONENT_ANALYSIS;

/** Demo card: first and third tactics look trained when the fighter has sessions. */
export function sampleOpponentAnalysisWithSessions(sessionIds: readonly string[]) {
    const first = sessionIds[0];
    const second = sessionIds[1] ?? sessionIds[0];
    return {
        ...SAMPLE_OPPONENT_ANALYSIS,
        tactics: SAMPLE_OPPONENT_ANALYSIS.tactics.map((tactic, index) => ({
            ...tactic,
            sessionIds: index === 0 && first ? [first] : index === 2 && second ? [second] : [],
        })),
    };
}
