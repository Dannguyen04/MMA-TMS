import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/domain/rules";
import type {
    AbnormalMovementAlert,
    AIAnalysis,
    AIJob,
    AIModel,
    AlertStatus,
    BodyRegion,
    CameraAngle,
    Detection,
    DoctorDecision,
    PipelineStage,
    Video,
    VideoTrainingType,
} from "@/lib/domain/types";
import { dayKey, formatTime } from "@/lib/format";
import { average, round, sum } from "@/lib/utils";
import {
    crossExtensionFinding,
    emphasise,
    findingContext,
    generateAnalysis,
    guardAfterLeadHookFinding,
    guardRecoveryAfter,
    guardUptimeFinding,
    headMovementFinding,
    jabRangeFinding,
    kickGuardFinding,
    kickRotationFinding,
    lowConfidenceHooksFinding,
    meanOf,
    pivotFinding,
    PRODUCTION_MODEL_VERSIONS,
    REPERTOIRES,
    resolveTuning,
    speedFadeFinding,
    strikesIn,
    withoutMoves,
    type FindingContext,
    type FindingTemplate,
    type ReviewSeed,
    type ScriptTuning,
    type WeightedCombo,
} from "./ai-generation";
import { mockFighters, mockUsers } from "./people";
import { createRandom } from "./random";
import { clampPastToday, daysAgo, fromToday } from "./time";

/**
 * Video & AI seed: uploaded footage, pipeline jobs, generated analyses, abnormal movement
 * alerts and the model registry. Follows the fighter storylines in people.ts.
 *
 * Id convention: video v-X ↔ job job-X ↔ analysis an-X. Earlier failed runs of a video that were
 * re-run successfully keep their own job row (job-X-a1); the video points at the newest job.
 */

/* ─── Models ──────────────────────────────────────────────────────────────── */

const MODEL = {
    fighterDetection: "mdl-fighter-det-2-1-0",
    poseMedium: "mdl-yolov8m-pose-1-4-0",
    poseNano: "mdl-yolov8n-pose-1-2-0",
    strike: "mdl-strike-cls-2-3-1",
    strikeRc: "mdl-strike-cls-2-4-0-rc1",
    anomaly: "mdl-move-anomaly-0-9-2-beta",
    anomalyRc: "mdl-move-anomaly-1-0-0-rc1",
} as const;

const PIPELINE_MODEL_IDS = [MODEL.fighterDetection, MODEL.poseMedium, MODEL.strike, MODEL.anomaly];

/* ─── Plan types ──────────────────────────────────────────────────────────── */

interface FailurePlan {
    code: string;
    message: string;
    stage: PipelineStage;
    progressPct: number;
    workerId: string;
    runSec: number;
    attempts: number;
}

interface AnalysisPlan {
    repertoire: WeightedCombo[];
    tuning: Partial<ScriptTuning>;
    summaryNote: string;
    findings: FindingTemplate[];
    /** Coach review of the whole analysis; null while it waits in the review queue. */
    review: { reviewerId: string; reviewedAt: string; rating: number; summary: string } | null;
}

type Outcome =
    | { status: "completed"; workerId: string; processingRatio: number; attempts: number; analysis: AnalysisPlan }
    | { status: "processing"; workerId: string; stage: PipelineStage; progressPct: number }
    | { status: "queued" }
    | { status: "failed"; failure: FailurePlan };

interface VideoPlan {
    key: string;
    fighterId: string;
    uploadedById: string;
    sessionId: string | null;
    title: string;
    trainingType: VideoTrainingType;
    cameraAngle: CameraAngle;
    resolution: "1920x1080" | "1080x1920" | "3840x2160";
    fps: 30 | 60;
    durationSec: number;
    uploadedAt: string;
    fileStyle: "camera" | "android" | "iphone";
    notes: string | null;
    /** An earlier failed run, re-run successfully `retryAfterMin` later as a new job. */
    earlierFailure?: FailurePlan & { retryAfterMin: number };
    outcome: Outcome;
}

/* ─── Review helpers ──────────────────────────────────────────────────────── */

const confirmed = (note: string | null = null): ReviewSeed => ({ decision: "confirmed", note, correctedLabel: null });
const corrected = (correctedLabel: string, note: string): ReviewSeed => ({ decision: "corrected", note, correctedLabel });
const rejected = (note: string): ReviewSeed => ({ decision: "rejected", note, correctedLabel: null });

const RAFAEL = "u-rafael-costa";
const ANNA = "u-anna-volkova";

/** Analyses generated so far, oldest first — later scripts compare against earlier footage. */
const generated = new Map<string, AIAnalysis>();

function baselineOf(key: string): FindingContext | null {
    const analysis = generated.get(key);
    return analysis ? findingContext(analysis) : null;
}

/* ─── Custom finding templates ────────────────────────────────────────────── */

function trackingGapFinding(cause: string, review: ReviewSeed | null = null): FindingTemplate {
    const lost = (ctx: FindingContext) => ctx.events.filter((e) => e.type === "tracking_lost");
    return {
        category: "movement_quality",
        impact: "improvement",
        title: "Việc theo dõi bị gián đoạn ở một số đoạn trong clip",
        description: (ctx) =>
            `Mất theo dõi ${lost(ctx).length} lần (tổng cộng ${round(sum(lost(ctx).map((e) => e.endMs - e.startMs)) / 1000, 1)} s) — ${cause}. Số liệu ở những thời điểm đó là ước tính.`,
        confidence: 0.9,
        evidence: { from: "events", types: ["tracking_lost"], limit: 5 },
        metric: (ctx) => ({ label: "Thời gian mất theo dõi", value: round(sum(lost(ctx).map((e) => e.endMs - e.startMs)) / 1000, 1), unit: "s", reference: null }),
        recommendation: "Quay từ góc trên cao ở góc sàn, cách 3–4 m, để võ sĩ luôn nằm trọn trong khung hình.",
        review,
        when: (ctx) => lost(ctx).length >= 3,
    };
}

function stanceSwitchFinding(review: ReviewSeed | null = null): FindingTemplate {
    const southpawShare = (ctx: FindingContext) => {
        const jabs = strikesIn(ctx, { type: "jab" });
        return jabs.length === 0 ? 0 : Math.round((jabs.filter((j) => j.limb === "right_arm").length / jabs.length) * 100);
    };
    return {
        category: "footwork",
        impact: "strength",
        title: "Đổi thế đứng có vẻ cân bằng",
        description: (ctx) =>
            `Khoảng ${southpawShare(ctx)}% số cú jab được tung ra từ thế southpaw, điểm thăng bằng ước tính ${ctx.metrics.footwork.balanceScore}/100.`,
        confidence: 0.77,
        evidence: { from: "detections", type: "jab", limb: "right_arm", limit: 4 },
        metric: (ctx) => ({ label: "Jab tung ra từ thế southpaw", value: southpawShare(ctx), unit: "%", reference: null }),
        recommendation: "Tiếp tục đổi thế khi đang di chuyển; thêm một cú phản đòn tay sau ngay sau mỗi lần đổi thế.",
        review,
    };
}

function teepFinding(review: ReviewSeed | null = null): FindingTemplate {
    return {
        category: "kick",
        impact: "strength",
        title: "Các cú đá có vẻ nhanh và co gối tốt",
        description: (ctx) =>
            `Các cú đá có góc co gối trung bình ${ctx.metrics.avgKickChamberDeg}° và tốc độ bàn chân đỉnh ${ctx.metrics.avgPeakSpeed.kick} m/s.`,
        confidence: 0.84,
        evidence: { from: "detections", type: "kick", rankBy: "peakSpeed", limit: 4 },
        metric: (ctx) => ({ label: "Góc co gối trung bình khi đá", value: ctx.metrics.avgKickChamberDeg, unit: "°", reference: "Thông thường 40–75°" }),
        recommendation: "Giữ độ cao co gối và thu chân nhanh hơn để đối thủ không bắt được chân.",
        review,
        when: (ctx) => ctx.metrics.strikeCounts.kick >= 3,
    };
}

/* ─── Video plans ─────────────────────────────────────────────────────────── */

/** Kick-volume bag rounds: most combinations finish with a kick. */
const LINH_KICK_ROUNDS: WeightedCombo[] = [
    { moves: ["rear_kick"], weight: 5 },
    { moves: ["teep"], weight: 4 },
    { moves: ["switch_kick"], weight: 3 },
    { moves: ["jab", "rear_kick"], weight: 4 },
    { moves: ["jab", "cross", "rear_kick"], weight: 2 },
    { moves: ["lead_hook", "rear_kick"], weight: 2 },
    { moves: ["jab", "cross"], weight: 2 },
    { moves: ["jab"], weight: 2 },
];

const VIDEO_PLANS: VideoPlan[] = [
    {
        key: "minh-pads-2d",
        fighterId: "f-minh-tran",
        uploadedById: RAFAEL,
        sessionId: "s-minh-pads-2d",
        title: "Đấm đích — 8 hiệp, tập trung đòn móc",
        trainingType: "pad_work",
        cameraAngle: "diagonal",
        resolution: "1920x1080",
        fps: 60,
        durationSec: 192,
        uploadedAt: daysAgo(2, 19, 12),
        fileStyle: "camera",
        notes: "Trích đoạn 8 hiệp × 3 phút, rút gọn còn 3:12. Chú ý tay phải sau các cú móc tay trước.",
        outcome: {
            status: "completed",
            workerId: "gpu-worker-02",
            processingRatio: 0.94,
            attempts: 1,
            analysis: {
                repertoire: emphasise(REPERTOIRES.muay_thai, "lead_hook", 1.6),
                tuning: {
                    roundLengthSec: 24,
                    restSec: [1.3, 2.7],
                    kickSpeedFactor: 1.02,
                    hookConfusionRate: 0.2,
                    guardDropRates: { lead_hook: 0.45, rear_kick: 0.12 },
                    guardRecoveryMs: [380, 640],
                    restGuardLapse: 0.14,
                    headMovesPerMin: 6.5,
                    pivotRate: 0.2,
                    hookElbowDeg: [96, 124],
                    stanceWidthRatio: 1.31,
                    balanceScore: 84,
                },
                summaryNote: "Việc theo dõi ổn định, chỉ đôi lúc bị người cầm đích che khuất; một số cú hook được phân loại với độ tin cậy thấp và đã được đánh dấu để xem lại.",
                findings: [
                    guardAfterLeadHookFinding("left_arm", { confidence: 0.82 }),
                    {
                        category: "hook",
                        impact: "improvement",
                        title: "Cú móc tay trước có thể bị lộ ý đồ do khuỷu tay mở sớm",
                        description: (ctx) => {
                            const widest = [...strikesIn(ctx, { type: "hook", limb: "left_arm" })].sort((a, b) => b.jointAngleDeg - a.jointAngleDeg).slice(0, 4);
                            return `Ở những cú móc tay trước rộng nhất, khuỷu tay mở tới khoảng ${meanOf(widest, "jointAngleDeg", 0)}° trước khi cú đấm xoay vào, điều này có thể làm lộ đòn sớm. Góc quay chéo của camera hạn chế độ chính xác của phép đo này.`;
                        },
                        confidence: 0.57,
                        evidence: { from: "detections", type: "hook", limb: "left_arm", rankBy: "jointAngleDeg", limit: 4 },
                        metric: (ctx) => ({
                            label: "Góc khuỷu tay trung bình khi móc tay trước",
                            value: meanOf(strikesIn(ctx, { type: "hook", limb: "left_arm" }), "jointAngleDeg"),
                            unit: "°",
                            reference: "Khoảng thông thường 85–115°",
                        }),
                        recommendation: "Cùng xem lại các đoạn clip này; nếu đúng, hãy rút ngắn cú móc bằng cách giữ khuỷu tay thẳng hàng với nắm đấm ở nửa đầu quỹ đạo.",
                        review: null,
                    },
                    crossExtensionFinding({ confidence: 0.88 }),
                    lowConfidenceHooksFinding({ confidence: 0.52 }),
                    kickRotationFinding("right_leg", { confidence: 0.81, reference: "Kỷ lục cá nhân 12.9 m/s" }),
                    speedFadeFinding({ confidence: 0.66 }),
                    headMovementFinding("improvement", { confidence: 0.74 }),
                ],
                review: null,
            },
        },
    },
    {
        key: "minh-bag-today",
        fighterId: "f-minh-tran",
        uploadedById: "u-minh-tran",
        sessionId: "s-minh-bag-today",
        title: "Bao cát — các hiệp tập lực buổi sáng",
        trainingType: "heavy_bag",
        cameraAngle: "side",
        resolution: "1920x1080",
        fps: 60,
        durationSec: 240,
        uploadedAt: fromToday(0, 8, 14),
        fileStyle: "camera",
        notes: null,
        outcome: { status: "processing", workerId: "gpu-worker-03", stage: "pose_estimation", progressPct: 46 },
    },
    {
        key: "minh-shadow-9d",
        fighterId: "f-minh-tran",
        uploadedById: "u-minh-tran",
        sessionId: null,
        title: "Đánh bóng — kiểm tra bộ chân buổi tối",
        trainingType: "shadow_boxing",
        cameraAngle: "front",
        resolution: "1080x1920",
        fps: 30,
        durationSec: 150,
        uploadedAt: daysAgo(9, 20, 5),
        fileStyle: "android",
        notes: "Tập thêm vài hiệp ở nhà. Giữa buổi có bài đổi bước.",
        outcome: {
            status: "completed",
            workerId: "gpu-worker-01",
            processingRatio: 0.71,
            attempts: 1,
            analysis: {
                repertoire: REPERTOIRES.muay_thai,
                tuning: { guardDropRates: { lead_hook: 0.4 }, hookElbowDeg: [88, 108], headMovesPerMin: 8, hookConfusionRate: 0.14, stanceWidthRatio: 1.12, pivotRate: 0.45 },
                summaryNote: "Video điện thoại quay chính diện cho điểm khớp rõ ràng; các cú hook ra đòn chéo góc có độ tin cậy thấp nhất.",
                findings: [
                    guardAfterLeadHookFinding("left_arm", { review: confirmed("Đúng như khi tập đích — găng phải bị trôi sau cú móc.") }),
                    crossExtensionFinding({ review: confirmed() }),
                    headMovementFinding("improvement", {
                        review: corrected("Di chuyển đầu đủ cho bài đánh bóng", "Bài tập tập trung vào bộ chân; tần suất này ổn cho các hiệp tập một mình."),
                    }),
                    lowConfidenceHooksFinding({ review: confirmed("Đã kiểm tra từng cú — xem phần sửa ở các lần phát hiện.") }),
                    {
                        category: "footwork",
                        impact: "concern",
                        title: "Thế đứng có thể bị hẹp lại khi ra đòn phối hợp",
                        description: (ctx) =>
                            `Độ rộng thế đứng ước tính trung bình ${ctx.metrics.footwork.stanceWidthRatio}× độ rộng vai, thấp hơn khoảng thông thường 1.2–1.4× của Muay Thai.`,
                        confidence: 0.63,
                        evidence: { from: "events", types: ["step_in", "step_out"], limit: 4 },
                        metric: (ctx) => ({ label: "Độ rộng thế đứng", value: ctx.metrics.footwork.stanceWidthRatio, unit: "× độ rộng vai", reference: "Thông thường 1.2–1.4×" }),
                        recommendation: "Kiểm tra độ rộng thế đứng trước gương giữa các hiệp; hai bàn chân rộng hơn vai một chút.",
                        review: rejected("Thế đứng hẹp là có chủ đích — đây là bài đổi bước."),
                    },
                    pivotFinding("strength", { review: confirmed() }),
                ],
                review: {
                    reviewerId: RAFAEL,
                    reviewedAt: daysAgo(8, 10, 20),
                    rating: 4,
                    summary: "Buổi tập gọn gàng. Thế thủ sau cú móc tay trước vẫn là ưu tiên — đã xác nhận các lần hạ tay. Cross và bộ chân trông sắc nét.",
                },
            },
        },
    },
    {
        key: "minh-sparring-16d",
        fighterId: "f-minh-tran",
        uploadedById: RAFAEL,
        sessionId: "s-minh-sparring-16d",
        title: "Đấu tập — các hiệp kỹ thuật",
        trainingType: "sparring",
        cameraAngle: "diagonal",
        resolution: "1920x1080",
        fps: 60,
        durationSec: 270,
        uploadedAt: daysAgo(16, 20, 40),
        fileStyle: "camera",
        notes: "4 × 3 phút ở mức 60–70%. Bạn tập đeo găng xanh.",
        outcome: {
            status: "completed",
            workerId: "gpu-worker-02",
            processingRatio: 1.12,
            attempts: 1,
            analysis: {
                repertoire: REPERTOIRES.muay_thai,
                tuning: {
                    confidenceShift: -0.04,
                    guardDropRates: { lead_hook: 0.5 },
                    hookConfusionRate: 0.22,
                    lowConfidenceRate: 0.08,
                    trackingLosses: 7,
                    trackingQuality: 0.83,
                    hookElbowDeg: [90, 112],
                    restSec: [2.0, 4.6],
                },
                summaryNote: "Có hai võ sĩ trong khung hình nên việc bạn tập che khuất làm giảm chất lượng theo dõi, và một số lần phát hiện có độ tin cậy thấp.",
                findings: [
                    guardAfterLeadHookFinding("left_arm", { confidence: 0.7, review: confirmed("Bạn tập đã hai lần phản đòn tay phải trúng từ chỗ hở này.") }),
                    lowConfidenceHooksFinding({
                        confidence: 0.48,
                        review: corrected("Lẫn cả hook và cross", "Khoảng một nửa là cú cross ra đòn chéo góc — đã sửa từng cú."),
                    }),
                    jabRangeFinding({ confidence: 0.72, review: confirmed() }),
                    headMovementFinding("improvement", { review: confirmed() }),
                    trackingGapFinding("chủ yếu khi bạn tập bước vào giữa Minh và camera", confirmed("Đã ghi nhận — sẽ chuyển camera sang cột góc sàn.")),
                    kickRotationFinding("right_leg", { confidence: 0.7, review: confirmed() }),
                ],
                review: {
                    reviewerId: RAFAEL,
                    reviewedAt: daysAgo(15, 9, 30),
                    rating: 3,
                    summary: "Áp lực tốt ở hiệp 1–2. Thế thủ sau cú móc là vấn đề lặp lại; một số nhãn hook của AI thực ra là cross — đã sửa.",
                },
            },
        },
    },
    {
        key: "kenji-bag-9d",
        fighterId: "f-kenji-morita",
        uploadedById: RAFAEL,
        sessionId: "s-kenji-bag-9d",
        title: "Bao cát — bài tập tốc độ và đổi thế",
        trainingType: "heavy_bag",
        cameraAngle: "side",
        resolution: "1920x1080",
        fps: 60,
        durationSec: 180,
        uploadedAt: daysAgo(9, 18, 32),
        fileStyle: "camera",
        notes: null,
        earlierFailure: {
            code: "WORKER_TIMEOUT",
            message: "Worker vượt giới hạn 300 s tại khung hình 8,412",
            stage: "pose_estimation",
            progressPct: 52,
            workerId: "gpu-worker-04",
            runSec: 300,
            attempts: 1,
            retryAfterMin: 38,
        },
        outcome: {
            status: "completed",
            workerId: "gpu-worker-02",
            processingRatio: 0.88,
            attempts: 1,
            analysis: {
                repertoire: emphasise(REPERTOIRES.karate, "teep", 1.5),
                tuning: { handSpeedFactor: 1.02, kickSpeedFactor: 1.03, headMovesPerMin: 3, southpawShare: 0.2, balanceScore: 89 },
                summaryNote: "Camera quay ngang cho thấy rõ cơ học vai và hông; các lần phát hiện cú đá có độ tin cậy cao nhất.",
                findings: [
                    {
                        category: "cross",
                        impact: "concern",
                        title: "Vai phải có vẻ nhô lên ở điểm cuối cú cross",
                        description:
                            "Ở các cú cross thế thuận, vai phải có vẻ nhấc lên phía tai khi duỗi hết tay thay vì giữ ngang, xuất hiện nhiều hơn ở các hiệp cuối.",
                        confidence: 0.8,
                        evidence: { from: "detections", type: "cross", limb: "right_arm", rankBy: "jointAngleDeg", limit: 5 },
                        metric: (ctx) => ({
                            label: "Độ duỗi trung bình cú cross tay phải",
                            value: meanOf(strikesIn(ctx, { type: "cross", limb: "right_arm" }), "jointAngleDeg"),
                            unit: "°",
                            reference: "Mục tiêu 155–175°",
                        }),
                        recommendation: "Trao đổi với bác sĩ thể thao trước khi tăng tải cho cú cross; trong lúc đó giữ vai sau thả lỏng và ngang bằng khi đánh bóng.",
                        review: confirmed("Thấy rõ khi xem lại. Đã báo Dr. Thu Lê; giới hạn cường độ cho đến khi khám."),
                    },
                    teepFinding(confirmed()),
                    stanceSwitchFinding(confirmed()),
                    lowConfidenceHooksFinding({ review: corrected("Uraken (đấm mu nắm tay)", "Hai cú trong số này là đấm mu nắm tay trong bài karate, không phải hook.") }),
                    guardUptimeFinding("strength", { review: confirmed() }),
                    speedFadeFinding({ review: rejected("Các hiệp cuối được chủ ý tập kỹ thuật ở nhịp chậm hơn.") }),
                ],
                review: {
                    reviewerId: RAFAEL,
                    reviewedAt: daysAgo(8, 9, 0),
                    rating: 4,
                    summary: "Buổi tập tốt. Đồng ý với cảnh báo vai ở cú cross — đã chuyển cho Dr. Thu Lê và giới hạn cường độ cho đến khi khám.",
                },
            },
        },
    },
    {
        key: "lucas-shadow-4d",
        fighterId: "f-lucas-ferreira",
        uploadedById: "u-lucas-ferreira",
        sessionId: null,
        title: "Đánh bóng phục hồi — di chuyển nhẹ, không đá",
        trainingType: "shadow_boxing",
        cameraAngle: "front",
        resolution: "1080x1920",
        fps: 30,
        durationSec: 120,
        uploadedAt: daysAgo(4, 11, 20),
        fileStyle: "iphone",
        notes: "Các hiệp nhẹ theo kế hoạch phục hồi, RPE khoảng 5. Không đá.",
        outcome: {
            status: "completed",
            workerId: "gpu-worker-03",
            processingRatio: 0.66,
            attempts: 1,
            analysis: {
                repertoire: withoutMoves(REPERTOIRES.grappler, ["rear_kick"]),
                tuning: {
                    handSpeedFactor: 0.84,
                    restSec: [2.4, 4.4],
                    headMovesPerMin: 5,
                    pivotRate: 0.15,
                    stanceWidthRatio: 1.18,
                    balanceScore: 76,
                    trackingLosses: 0,
                },
                summaryNote: "Video đủ sáng, võ sĩ ở trong khung hình suốt clip; không phát hiện cú đá nào.",
                findings: [
                    {
                        category: "footwork",
                        impact: "concern",
                        title: "Sải bước có thể ngắn hơn khi bước từ chân trái",
                        description:
                            "Các bước vào và lùi ra có vẻ ngắn hơn ở bên trái, và độ duỗi hông có vẻ giảm so với các video trước. Hãy đối chiếu với kế hoạch phục hồi trước khi thay đổi bài tập bộ chân.",
                        confidence: 0.74,
                        evidence: { from: "events", types: ["step_in", "step_out"], limit: 5 },
                        metric: (ctx) => {
                            const baseline = baselineOf("lucas-sparring-35d");
                            const perMin = (c: FindingContext) => round(c.metrics.footwork.distanceM / (c.durationMs / 60_000), 1);
                            return {
                                label: "Quãng di chuyển chân mỗi phút",
                                value: perMin(ctx),
                                unit: "m/min",
                                reference: baseline ? `Đấu tập trước chấn thương: ${perMin(baseline)} m/min` : null,
                            };
                        },
                        recommendation: "Gửi clip cho chuyên viên vật lý trị liệu; giữ bước chân ngắn và có kiểm soát cho đến mốc phục hồi tiếp theo.",
                        review: null,
                    },
                    {
                        category: "movement_quality",
                        impact: "strength",
                        title: "Khối lượng đòn được giữ ở cường độ nhẹ, có kiểm soát",
                        description: (ctx) =>
                            `Tốc độ đấm trung bình ${meanOf(ctx.detections, "peakSpeed")} m/s với ${ctx.metrics.strikesPerMin} đòn/phút, không phát hiện cú đá nào.`,
                        confidence: 0.83,
                        evidence: { from: "combinations", limit: 3 },
                        metric: (ctx) => {
                            const baseline = baselineOf("lucas-sparring-35d");
                            return {
                                label: "Số đòn mỗi phút",
                                value: ctx.metrics.strikesPerMin,
                                unit: "/min",
                                reference: baseline ? `Đấu tập trước chấn thương: ${baseline.metrics.strikesPerMin}/min` : null,
                            };
                        },
                        recommendation: "Giữ cường độ này cho đến khi giấy phép tập luyện cho phép tăng; quay cùng bài tập mỗi tuần để so sánh.",
                        review: null,
                    },
                    crossExtensionFinding({ confidence: 0.8 }),
                    guardUptimeFinding("strength"),
                    headMovementFinding("improvement"),
                ],
                review: null,
            },
        },
    },
    {
        key: "marcus-bag-11d",
        fighterId: "f-marcus-hale",
        uploadedById: RAFAEL,
        sessionId: "s-marcus-bag-11d",
        title: "Bao cát — các hiệp tập lực (dừng ở hiệp 4)",
        trainingType: "heavy_bag",
        cameraAngle: "side",
        resolution: "1920x1080",
        fps: 60,
        durationSec: 226,
        uploadedAt: daysAgo(11, 19, 10),
        fileStyle: "camera",
        notes: "Buổi tập dừng ở hiệp 4 sau khi Marcus đau tay phải ở một cú cross.",
        outcome: {
            status: "completed",
            workerId: "gpu-worker-01",
            processingRatio: 0.97,
            attempts: 2,
            analysis: {
                repertoire: REPERTOIRES.kickboxing,
                tuning: {
                    handSpeedFactor: 1.05,
                    kickSpeedFactor: 1.02,
                    guardDropRates: { lead_hook: 0.1 },
                    incident: { kind: "rear_hand_impact", atSec: 204 },
                },
                summaryNote: "Các đòn tay sau dừng lại sau một cú cross ở hiệp cuối, từ đó đến hết clip chỉ còn đòn tay trước.",
                findings: [
                    {
                        category: "movement_quality",
                        impact: "concern",
                        title: "Đòn tay sau dừng đột ngột ở cuối clip",
                        description:
                            "Sau một cú cross ở hiệp cuối, tay phải được rút về và giữ thấp, từ đó đến hết clip chỉ còn đòn tay trước. Hãy xem lại thời điểm này cùng võ sĩ.",
                        confidence: 0.78,
                        evidence: { from: "events", types: ["guard_drop"], detail: "rút về", limit: 1 },
                        metric: (ctx) => {
                            const moment = ctx.events.find((e) => e.type === "guard_drop" && e.detail.includes("rút về"));
                            const rightHand = strikesIn(ctx, { limb: "right_arm" });
                            const after = moment ? rightHand.filter((d) => d.startMs > moment.startMs).length : 0;
                            return { label: "Đòn tay phải sau thời điểm đó", value: after, unit: "đòn", reference: `${rightHand.length - after} đòn trước đó trong clip` };
                        },
                        recommendation: "Trao đổi với võ sĩ và bác sĩ thể thao trước khi tập bao tiếp với tay sau.",
                        review: confirmed("Chấn thương tay — đã dừng buổi tập. Đã báo Dr. Thu Lê."),
                    },
                    {
                        category: "cross",
                        impact: "strength",
                        title: "Tốc độ cú cross có vẻ cao trước hiệp cuối",
                        description: (ctx) =>
                            `Trước hiệp cuối, các cú cross có tốc độ tay đỉnh trung bình ${meanOf(strikesIn(ctx, { type: "cross", window: [0, 0.85] }), "peakSpeed")} m/s.`,
                        confidence: 0.86,
                        evidence: { from: "detections", type: "cross", window: [0, 0.85], rankBy: "peakSpeed", limit: 4 },
                        metric: (ctx) => {
                            const baseline = baselineOf("marcus-pads-22d");
                            return {
                                label: "Tốc độ trung bình cú cross",
                                value: meanOf(strikesIn(ctx, { type: "cross", window: [0, 0.85] }), "peakSpeed"),
                                unit: "m/s",
                                reference: baseline ? `Buổi đấm đích 22 ngày trước: ${baseline.metrics.avgPeakSpeed.cross} m/s` : null,
                            };
                        },
                        recommendation: "Khi được cho phép tập lại, xây dựng lại lực tay sau từ từ và kiểm tra băng tay trước mỗi buổi tập bao.",
                        review: confirmed(),
                    },
                    kickRotationFinding("right_leg", { review: confirmed() }),
                    headMovementFinding("improvement", { review: rejected("Các hiệp tập lực không tập trung vào di chuyển đầu.") }),
                    lowConfidenceHooksFinding({ review: confirmed() }),
                ],
                review: {
                    reviewerId: RAFAEL,
                    reviewedAt: daysAgo(10, 8, 45),
                    rating: 3,
                    summary: "Lực đánh rất tốt cho đến khi chấn thương tay ở hiệp 4 — đã dừng buổi tập. Đã xác nhận cảnh báo của AI; Dr. Thu Lê đã nắm chi tiết.",
                },
            },
        },
    },
    {
        key: "diego-sparring-6d",
        fighterId: "f-diego-alvarez",
        uploadedById: RAFAEL,
        sessionId: "s-diego-sparring-6d",
        title: "Đấu tập — các hiệp MMA (dừng ở hiệp 3)",
        trainingType: "sparring",
        cameraAngle: "diagonal",
        resolution: "1920x1080",
        fps: 60,
        durationSec: 204,
        uploadedAt: daysAgo(6, 19, 45),
        fileStyle: "camera",
        notes: "HLV dừng hiệp 3 sau một pha trao đổi đòn nặng.",
        outcome: {
            status: "completed",
            workerId: "gpu-worker-02",
            processingRatio: 1.18,
            attempts: 1,
            analysis: {
                repertoire: REPERTOIRES.grappler,
                tuning: {
                    roundLengthSec: 80,
                    restSec: [2.4, 5.2],
                    handSpeedFactor: 0.97,
                    confidenceShift: -0.15,
                    hookConfusionRate: 0.3,
                    lowConfidenceRate: 0.26,
                    trackingLosses: 9,
                    trackingQuality: 0.76,
                    headMovesPerMin: 7,
                    balanceScore: 78,
                    incident: { kind: "unsteady_after_exchange", atSec: 176 },
                },
                summaryNote: "Bạn tập thường xuyên che khuất làm giảm độ tin cậy chung, nên cần thận trọng khi đọc các lần phát hiện và số liệu.",
                findings: [
                    {
                        category: "movement_quality",
                        impact: "concern",
                        title: "Thế thủ có vẻ hồi chậm sau một pha trao đổi đòn ở cuối clip",
                        description: (ctx) =>
                            `Sau một pha trao đổi đòn ở hiệp cuối, thế thủ mất khoảng ${guardRecoveryAfter(ctx, "trao đổi đòn")} ms để trở về, và các bước sau đó có vẻ không vững với trụ chân hẹp hơn.`,
                        confidence: 0.61,
                        evidence: { from: "events", types: ["guard_drop", "lateral_step"], window: [0.84, 1], limit: 5 },
                        metric: (ctx) => {
                            const earlier = ctx.events.filter((e) => e.type === "guard_drop" && e.endMs < ctx.durationMs * 0.84);
                            return {
                                label: "Thời gian hồi thế thủ sau pha trao đổi đòn",
                                value: guardRecoveryAfter(ctx, "trao đổi đòn"),
                                unit: "ms",
                                reference: `Trước đó trong clip: ${Math.round(average(earlier.map((e) => e.endMs - e.startMs)))} ms`,
                            };
                        },
                        recommendation: "Xem lại thời điểm này cùng đội HLV và đội y tế trước buổi tập có va chạm tiếp theo.",
                        review: null,
                    },
                    trackingGapFinding("chủ yếu khi bạn tập bước vào giữa Diego và camera"),
                    {
                        category: "footwork",
                        impact: "concern",
                        title: "Thế đứng có thể hẹp lại sau pha trao đổi đòn",
                        description: (ctx) =>
                            `Điểm thăng bằng ước tính ${ctx.metrics.footwork.balanceScore}/100, với ${ctx.events.filter((e) => e.detail.startsWith("Bước ngang không vững")).length} bước ngang không vững ở đoạn cuối clip.`,
                        confidence: 0.58,
                        evidence: { from: "events", types: ["lateral_step"], detail: "Bước ngang không vững", limit: 4 },
                        metric: (ctx) => {
                            const baseline = baselineOf("diego-bag-42d");
                            return {
                                label: "Điểm thăng bằng",
                                value: ctx.metrics.footwork.balanceScore,
                                unit: "/100",
                                reference: baseline ? `Buổi tập bao 42 ngày trước: ${baseline.metrics.footwork.balanceScore}/100` : null,
                            };
                        },
                        recommendation: "Trao đổi về clip này với đội HLV và đội y tế trước khi lên kế hoạch đấu tập tiếp.",
                        review: null,
                    },
                    jabRangeFinding({ confidence: 0.63 }),
                    lowConfidenceHooksFinding({ confidence: 0.47 }),
                ],
                review: null,
            },
        },
    },
    {
        key: "aigerim-pads-3d",
        fighterId: "f-aigerim-sadykova",
        uploadedById: RAFAEL,
        sessionId: "s-aigerim-pads-3d",
        title: "Đấm đích — phòng thủ và phản đòn",
        trainingType: "pad_work",
        cameraAngle: "front",
        resolution: "1920x1080",
        fps: 60,
        durationSec: 210,
        uploadedAt: daysAgo(3, 18, 5),
        fileStyle: "camera",
        notes: "Các hiệp lách đầu – phản đòn cho chiến thuật gặp Hoshino.",
        outcome: {
            status: "completed",
            workerId: "gpu-worker-03",
            processingRatio: 0.9,
            attempts: 1,
            analysis: {
                repertoire: REPERTOIRES.boxing,
                tuning: {
                    roundLengthSec: 70,
                    restSec: [1.5, 3.0],
                    handSpeedFactor: 0.92,
                    headMovesPerMin: 16,
                    restGuardLapse: 0.06,
                    pivotRate: 0.5,
                    stanceWidthRatio: 1.24,
                    balanceScore: 91,
                },
                summaryNote: "Việc theo dõi ổn định và các pha di chuyển đầu được phát hiện với độ tin cậy cao.",
                findings: [
                    headMovementFinding("strength", { confidence: 0.9 }),
                    {
                        category: "head_movement",
                        impact: "strength",
                        title: "Phản đòn có vẻ theo sau cú lách đầu nhanh",
                        description: (ctx) =>
                            `${countersOffHeadMovement(ctx)} trên ${ctx.combinations.length} đòn phối hợp bắt đầu trong vòng một giây sau một lần lách đầu hoặc luồn người.`,
                        confidence: 0.81,
                        evidence: { from: "events", types: ["slip", "roll"], limit: 4 },
                        metric: (ctx) => ({ label: "Đòn phối hợp sau di chuyển đầu", value: countersOffHeadMovement(ctx), unit: "đòn phối hợp", reference: `Tổng cộng ${ctx.combinations.length} đòn phối hợp` }),
                        recommendation: "Giữ phản đòn sát ngay sau cú lách đầu; thêm phản đòn thứ hai sau cú đầu tiên để kéo dài pha trao đổi.",
                        review: null,
                    },
                    guardUptimeFinding("strength"),
                    pivotFinding("strength"),
                    jabRangeFinding(),
                    lowConfidenceHooksFinding({ confidence: 0.55 }),
                ],
                review: null,
            },
        },
    },
    {
        key: "linh-bag-5d",
        fighterId: "f-linh-pham",
        uploadedById: "u-linh-pham",
        sessionId: "s-linh-bag-5d",
        title: "Bao cát — các hiệp đá khối lượng lớn",
        trainingType: "heavy_bag",
        cameraAngle: "side",
        resolution: "1920x1080",
        fps: 30,
        durationSec: 180,
        uploadedAt: daysAgo(5, 18, 40),
        fileStyle: "android",
        notes: null,
        outcome: {
            status: "completed",
            workerId: "gpu-worker-01",
            processingRatio: 0.74,
            attempts: 1,
            analysis: {
                repertoire: LINH_KICK_ROUNDS,
                tuning: { handSpeedFactor: 0.84, kickSpeedFactor: 1.03, guardDropRates: { rear_kick: 0.35 } },
                summaryNote: "Các lần phát hiện cú đá luôn có độ tin cậy cao; đòn đấm chỉ chiếm một phần nhỏ khối lượng đòn.",
                findings: [
                    kickRotationFinding("left_leg", { confidence: 0.88, reference: "TB đội hạng ruồi 10.9 m/s", review: confirmed("Cú đá tốt nhất nhóm nghiệp dư.") }),
                    {
                        category: "combination",
                        impact: "improvement",
                        title: "Tay có vẻ chưa theo kịp chân",
                        description: (ctx) => {
                            const punches = ctx.detections.filter((d) => d.type !== "kick");
                            return `Đòn đấm chiếm ${Math.round((punches.length / ctx.detections.length) * 100)}% số đòn với tốc độ trung bình ${meanOf(punches, "peakSpeed")} m/s, trong khi cú đá trung bình ${ctx.metrics.avgPeakSpeed.kick} m/s.`;
                        },
                        confidence: 0.79,
                        evidence: { from: "combinations", labelPrefix: "Jab", limit: 4 },
                        metric: (ctx) => ({
                            label: "Tỷ lệ đòn đấm trong tổng số đòn",
                            value: Math.round((ctx.detections.filter((d) => d.type !== "kick").length / ctx.detections.length) * 100),
                            unit: "%",
                            reference: "TB đội kickboxing 68%",
                        }),
                        recommendation: "Thêm hai hiệp bao chỉ dùng tay mỗi buổi và tăng khối lượng jab–cross trước các cú đá.",
                        review: confirmed("Đồng ý — thêm các hiệp boxing từ tuần này."),
                    },
                    kickGuardFinding("left_leg", { review: corrected("Vung tay trong mức bình thường", "Tay đối trọng tự nhiên khi đá — chỉ là vấn đề ở cự ly gần.") }),
                    {
                        category: "movement_quality",
                        impact: "concern",
                        title: "Gối có thể đổ vào trong khi tiếp đất sau một số cú đá",
                        description:
                            "Ở vài lần tiếp đất sau cú đá chân sau, gối trái có vẻ đổ vào trong khi bàn chân trở về thế đứng. Góc quay ngang hạn chế độ chính xác của nhận định này.",
                        confidence: 0.58,
                        evidence: { from: "detections", type: "kick", limb: "left_leg", rankBy: "peakSpeed", limit: 3 },
                        metric: (ctx) => ({ label: "Cú đá có thể đổ gối vào trong", value: 3, unit: "cú đá", reference: `Tổng cộng ${strikesIn(ctx, { type: "kick", limb: "left_leg" }).length} cú đá chân sau` }),
                        recommendation: "Tham khảo đánh giá của bác sĩ thể thao về quan sát chuyển động tương ứng trước khi thay đổi kỹ thuật.",
                        review: rejected("Dr. Thu Lê đã xem cảnh báo tương ứng — nằm trong cơ học tiếp đất bình thường."),
                    },
                    teepFinding(confirmed()),
                    speedFadeFinding({ review: confirmed() }),
                ],
                review: {
                    reviewerId: RAFAEL,
                    reviewedAt: daysAgo(4, 9, 10),
                    rating: 4,
                    summary: "Cú đá là điểm nổi bật — cả tốc độ lẫn độ xoay đều rất tốt. Tay cần thêm khối lượng; sẽ thêm các hiệp boxing. Cảnh báo gối đã được Dr. Thu Lê xem và bỏ qua.",
                },
            },
        },
    },
    {
        key: "emma-sparring-1d",
        fighterId: "f-emma-lindqvist",
        uploadedById: RAFAEL,
        sessionId: "s-emma-sparring-1d",
        title: "Đấu tập — các hiệp kickboxing",
        trainingType: "sparring",
        cameraAngle: "diagonal",
        resolution: "1920x1080",
        fps: 60,
        durationSec: 300,
        uploadedAt: daysAgo(1, 21, 40),
        fileStyle: "camera",
        notes: null,
        outcome: { status: "queued" },
    },
    {
        key: "sofia-pads-8d",
        fighterId: "f-sofia-kowalski",
        uploadedById: ANNA,
        sessionId: "s-sofia-pads-8d",
        title: "Đấm đích — ra đòn áp sát vào clinch",
        trainingType: "pad_work",
        cameraAngle: "front",
        resolution: "1920x1080",
        fps: 30,
        durationSec: 165,
        uploadedAt: daysAgo(8, 12, 5),
        fileStyle: "camera",
        notes: "Tải lại vì tệp đầu tiên bị ngắt giữa chừng khi truyền.",
        earlierFailure: {
            code: "CORRUPT_CONTAINER",
            message: "Không tìm thấy moov atom — tệp tải lên có vẻ bị cắt cụt",
            stage: "decoding",
            progressPct: 3,
            workerId: "gpu-worker-03",
            runSec: 6,
            attempts: 1,
            retryAfterMin: 24,
        },
        outcome: {
            status: "completed",
            workerId: "gpu-worker-03",
            processingRatio: 0.69,
            attempts: 1,
            analysis: {
                repertoire: REPERTOIRES.grappler,
                tuning: { roundLengthSec: 55, restSec: [1.8, 3.8], handSpeedFactor: 0.88, headMovesPerMin: 5, straightExtensionShift: -12, stanceWidthRatio: 1.34, balanceScore: 90 },
                summaryNote: "Video quay chính diện giữ võ sĩ trong khung hình; người cầm đích đôi lúc che khuất khi áp sát.",
                findings: [
                    jabRangeFinding({ review: confirmed("Jab là cách cô ấy vào clinch — đúng như bài tập.") }),
                    {
                        category: "footwork",
                        impact: "strength",
                        title: "Bước vào có vẻ bám sát cú jab",
                        description: (ctx) => `Phát hiện ${ctx.events.filter((e) => e.type === "step_in").length} lần bước vào cự ly, phần lớn ngay trước một đòn phối hợp.`,
                        confidence: 0.8,
                        evidence: { from: "events", types: ["step_in"], limit: 4 },
                        metric: (ctx) => ({ label: "Bước vào cự ly", value: ctx.events.filter((e) => e.type === "step_in").length, unit: "bước", reference: null }),
                        recommendation: "Kết thúc mỗi lần áp sát bằng luồn tay dưới nách hoặc khóa gáy để đòn đánh dẫn thẳng vào clinch.",
                        review: confirmed(),
                    },
                    {
                        category: "cross",
                        impact: "improvement",
                        title: "Cú cross có thể chưa duỗi hết tay",
                        description: (ctx) => `Các cú đấm thẳng có độ duỗi khuỷu tay trung bình ${ctx.metrics.avgPunchExtensionDeg}°, thấp hơn mục tiêu thường thấy 155–175°.`,
                        confidence: 0.71,
                        evidence: { from: "detections", type: "cross", rankBy: "jointAngleDeg", rank: "lowest", limit: 4 },
                        metric: (ctx) => ({ label: "Độ duỗi trung bình của đòn đấm thẳng", value: ctx.metrics.avgPunchExtensionDeg, unit: "°", reference: "Mục tiêu 155–175°" }),
                        recommendation: "Nếu tầm với quan trọng trong chiến thuật, hãy thêm các lượt cross cự ly xa trên đích.",
                        review: corrected("Cross ngắn có chủ đích", "Cô ấy dùng cú cross để thu hẹp khoảng cách vào clinch, không phải để trúng đòn khi duỗi hết tay."),
                    },
                    guardUptimeFinding("strength", { review: confirmed() }),
                    headMovementFinding("improvement", { review: rejected("Không phải trọng tâm chiến thuật của cô ấy trong đợt tập này.") }),
                ],
                review: {
                    reviewerId: ANNA,
                    reviewedAt: daysAgo(7, 9, 40),
                    rating: 4,
                    summary: "Áp sát tốt từ cú jab cho lối đánh clinch. Cross ngắn là có chủ đích. Buổi tập trước trận chắc chắn.",
                },
            },
        },
    },
    {
        key: "hoang-shadow-7d",
        fighterId: "f-hoang-long",
        uploadedById: "u-hoang-long",
        sessionId: "s-hoang-shadow-7d",
        title: "Đánh bóng — buổi tập sáng sớm",
        trainingType: "shadow_boxing",
        cameraAngle: "front",
        resolution: "1080x1920",
        fps: 30,
        durationSec: 150,
        uploadedAt: daysAgo(7, 8, 30),
        fileStyle: "android",
        notes: "Quay trước khi bật đèn phòng tập.",
        earlierFailure: {
            code: "GPU_WORKER_LOST",
            message: "Mất heartbeat từ gpu-worker-04 trong bước theo dõi (node bị thu hồi)",
            stage: "tracking",
            progressPct: 31,
            workerId: "gpu-worker-04",
            runSec: 71,
            attempts: 1,
            retryAfterMin: 12,
        },
        outcome: {
            status: "completed",
            workerId: "gpu-worker-01",
            processingRatio: 0.82,
            attempts: 1,
            analysis: {
                repertoire: REPERTOIRES.karate,
                tuning: {
                    handSpeedFactor: 0.95,
                    kickSpeedFactor: 0.97,
                    confidenceShift: -0.31,
                    lowConfidenceRate: 0.1,
                    hookConfusionRate: 0.25,
                    trackingLosses: 5,
                    trackingLossDetail: "Thiếu sáng — không ước tính được điểm khớp",
                    trackingQuality: 0.8,
                    rearHipRotationFactor: 0.74,
                },
                summaryNote: "Ánh sáng yếu làm giảm chất lượng điểm khớp, nên độ tin cậy chung thấp và phần lớn kết quả cần được xem lại trước khi sử dụng.",
                findings: [
                    {
                        category: "movement_quality",
                        impact: "concern",
                        title: "Đòn tay sau có vẻ xoay ít hơn so với các video trước",
                        description: (ctx) => {
                            const baseline = baselineOf("hoang-pads-30d");
                            const current = meanOf(strikesIn(ctx, { type: "cross" }), "hipRotationDeg");
                            const earlier = baseline ? meanOf(strikesIn(baseline, { type: "cross" }), "hipRotationDeg") : null;
                            return `Các cú cross có độ xoay hông trung bình ${current}°${earlier === null ? "" : `, so với ${earlier}° trong buổi đấm đích quay 30 ngày trước`}. Ánh sáng yếu làm giảm độ chính xác của ước tính này.`;
                        },
                        confidence: 0.62,
                        evidence: { from: "detections", type: "cross", rankBy: "hipRotationDeg", rank: "lowest", limit: 4 },
                        metric: (ctx) => {
                            const baseline = baselineOf("hoang-pads-30d");
                            return {
                                label: "Độ xoay hông khi ra cross",
                                value: meanOf(strikesIn(ctx, { type: "cross" }), "hipRotationDeg"),
                                unit: "°",
                                reference: baseline ? `Buổi đấm đích 30 ngày trước: ${meanOf(strikesIn(baseline, { type: "cross" }), "hipRotationDeg")}°` : null,
                            };
                        },
                        recommendation: "So sánh với một video đủ sáng trước khi kết luận, và báo cho bác sĩ thể thao nếu thấy căng lưng.",
                        review: null,
                    },
                    {
                        category: "movement_quality",
                        impact: "improvement",
                        title: "Ánh sáng yếu làm giảm độ tin cậy phát hiện",
                        description: (ctx) => {
                            const low = ctx.detections.filter((d) => (d.confidence !== null && d.confidence < LOW_CONFIDENCE_THRESHOLD)).length;
                            return `Độ tin cậy phát hiện trung bình là ${Math.round(meanOf(ctx.detections, "confidence", 2) * 100)}%, và ${low} trên ${ctx.detections.length} đòn nằm dưới ngưỡng xem lại 60%.`;
                        },
                        confidence: 0.93,
                        evidence: { from: "detections", lowConfidence: true, limit: 5 },
                        metric: (ctx) => ({
                            label: "Đòn có độ tin cậy dưới 60%",
                            value: Math.round((ctx.detections.filter((d) => (d.confidence !== null && d.confidence < LOW_CONFIDENCE_THRESHOLD)).length / ctx.detections.length) * 100),
                            unit: "%",
                            reference: "Đánh bóng thông thường: dưới 5%",
                        }),
                        recommendation: "Quay lại khi đã bật đèn phòng tập, đặt camera ngang ngực và cách 3–4 m.",
                        review: null,
                    },
                    trackingGapFinding("ở góc tối nhất của phòng"),
                    kickRotationFinding("right_leg", { confidence: 0.56 }),
                    lowConfidenceHooksFinding({ confidence: 0.45 }),
                    headMovementFinding("improvement", { confidence: 0.58 }),
                ],
                review: null,
            },
        },
    },
    {
        key: "tariq-shadow-2d",
        fighterId: "f-tariq-haddad",
        uploadedById: "u-tariq-haddad",
        sessionId: null,
        title: "Đánh bóng — bộ chân sau phục hồi gối",
        trainingType: "shadow_boxing",
        cameraAngle: "front",
        resolution: "1080x1920",
        fps: 30,
        durationSec: 95,
        uploadedAt: daysAgo(2, 10, 15),
        fileStyle: "iphone",
        notes: "Điện thoại dựng trên ghế băng.",
        outcome: {
            status: "failed",
            failure: {
                code: "NO_FIGHTER_DETECTED",
                message: "Chỉ phát hiện võ sĩ ở 11% số khung hình lấy mẫu (tối thiểu 60%) — người tập nằm ngoài khung hình gần như suốt clip.",
                stage: "fighter_detection",
                progressPct: 18,
                workerId: "gpu-worker-02",
                runSec: 24,
                attempts: 1,
            },
        },
    },
    {
        key: "bao-shadow-3d",
        fighterId: "f-bao-nguyen",
        uploadedById: "u-bao-nguyen",
        sessionId: null,
        title: "Video đánh bóng đầu tiên",
        trainingType: "shadow_boxing",
        cameraAngle: "diagonal",
        resolution: "1920x1080",
        fps: 60,
        durationSec: 140,
        uploadedAt: daysAgo(3, 20, 50),
        fileStyle: "iphone",
        notes: null,
        outcome: {
            status: "failed",
            failure: {
                code: "UNSUPPORTED_CODEC",
                message: "Bộ giải mã không hỗ trợ video HEVC Main 10 (10-bit). Hãy xuất lại sang H.264 (8-bit) rồi tải lên lại.",
                stage: "decoding",
                progressPct: 2,
                workerId: "gpu-worker-04",
                runSec: 4,
                attempts: 2,
            },
        },
    },
    /* Older completed & reviewed footage */
    {
        key: "emma-bag-12d",
        fighterId: "f-emma-lindqvist",
        uploadedById: RAFAEL,
        sessionId: null,
        title: "Bao cát — quay thử 4K",
        trainingType: "heavy_bag",
        cameraAngle: "diagonal",
        resolution: "3840x2160",
        fps: 60,
        durationSec: 150,
        uploadedAt: daysAgo(12, 17, 50),
        fileStyle: "camera",
        notes: "Thử camera 4K mới.",
        earlierFailure: {
            code: "OUT_OF_MEMORY",
            message: "CUDA hết bộ nhớ: cần cấp phát 2.34 GiB (GPU 0; tổng 23.99 GiB) trong batch pose cho đầu vào 3840x2160 @ 60 fps",
            stage: "pose_estimation",
            progressPct: 44,
            workerId: "gpu-worker-01",
            runSec: 96,
            attempts: 1,
            retryAfterMin: 55,
        },
        outcome: {
            status: "completed",
            workerId: "gpu-worker-03",
            processingRatio: 1.2,
            attempts: 1,
            analysis: {
                repertoire: REPERTOIRES.kickboxing,
                tuning: { handSpeedFactor: 1.04 * 0.92, kickSpeedFactor: 1.06 * 0.92, restGuardLapse: 0.08, balanceScore: 90, trackingQuality: 0.96 },
                summaryNote: "Video độ phân giải cao cho điểm khớp rất ổn định suốt clip.",
                findings: [
                    kickRotationFinding("left_leg", { review: confirmed() }),
                    crossExtensionFinding({ review: confirmed() }),
                    guardUptimeFinding("strength", { review: confirmed() }),
                    headMovementFinding("improvement", { review: rejected("Các hiệp bao tập trung vào lực — bài tập không nhằm vào di chuyển đầu.") }),
                    lowConfidenceHooksFinding({ review: confirmed() }),
                ],
                review: { reviewerId: RAFAEL, reviewedAt: daysAgo(11, 9, 15), rating: 5, summary: "Buổi tập xuất sắc — tốc độ được giữ đến cuối. Không có gì lớn cần sửa." },
            },
        },
    },
    {
        key: "aigerim-shadow-13d",
        fighterId: "f-aigerim-sadykova",
        uploadedById: "u-aigerim-sadykova",
        sessionId: null,
        title: "Đánh bóng — các hiệp lách đầu và xoay chân",
        trainingType: "shadow_boxing",
        cameraAngle: "front",
        resolution: "1080x1920",
        fps: 30,
        durationSec: 120,
        uploadedAt: daysAgo(13, 19, 20),
        fileStyle: "iphone",
        notes: null,
        outcome: {
            status: "completed",
            workerId: "gpu-worker-02",
            processingRatio: 0.63,
            attempts: 1,
            analysis: {
                repertoire: REPERTOIRES.boxing,
                tuning: { handSpeedFactor: 0.9, headMovesPerMin: 15, pivotRate: 0.45, restGuardLapse: 0.06, balanceScore: 92 },
                summaryNote: "Video chính diện rõ nét; di chuyển đầu và xoay chân được phát hiện với độ tin cậy cao.",
                findings: [
                    headMovementFinding("strength", { review: confirmed("Tốt nhất đội.") }),
                    pivotFinding("strength", { review: confirmed() }),
                    jabRangeFinding({ review: confirmed() }),
                    guardUptimeFinding("strength", { review: confirmed() }),
                    crossExtensionFinding({ review: corrected("Duỗi tay tốt, ngắn lại khi mệt", "Độ duỗi giảm một chút ở phút cuối — nên theo dõi.") }),
                ],
                review: { reviewerId: RAFAEL, reviewedAt: daysAgo(12, 10, 0), rating: 5, summary: "Di chuyển đầu vẫn xuất sắc như mọi khi. Giữ vững." },
            },
        },
    },
    {
        key: "tariq-bag-13d",
        fighterId: "f-tariq-haddad",
        uploadedById: RAFAEL,
        sessionId: null,
        title: "Bao cát — các hiệp boxing có kiểm soát",
        trainingType: "heavy_bag",
        cameraAngle: "side",
        resolution: "1920x1080",
        fps: 60,
        durationSec: 180,
        uploadedAt: daysAgo(13, 16, 45),
        fileStyle: "camera",
        notes: "Không đá, hạn chế xoay chân — giai đoạn gối trở lại tập luyện.",
        outcome: {
            status: "completed",
            workerId: "gpu-worker-01",
            processingRatio: 0.86,
            attempts: 1,
            analysis: {
                repertoire: REPERTOIRES.boxing,
                tuning: { handSpeedFactor: 0.9, pivotRate: 0.12, guardDropRates: { lead_hook: 0.3 }, stanceWidthRatio: 1.36, balanceScore: 82 },
                summaryNote: "Video quay ngang cho thấy rõ cơ học đòn đấm; không phát hiện cú đá nào.",
                findings: [
                    jabRangeFinding({ review: confirmed() }),
                    guardAfterLeadHookFinding("left_arm", { review: confirmed() }),
                    pivotFinding("improvement", { review: corrected("Xoay chân bị hạn chế theo kế hoạch phục hồi", "Giai đoạn gối trở lại tập luyện — chúng tôi chủ động hạn chế xoay chân.") }),
                    crossExtensionFinding({ review: confirmed() }),
                    speedFadeFinding({ review: rejected("Giảm cường độ theo kế hoạch — hiệp cuối là hiệp kỹ thuật.") }),
                ],
                review: { reviewerId: RAFAEL, reviewedAt: daysAgo(12, 11, 5), rating: 4, summary: "Lực đánh có kiểm soát tốt, bộ chân giữ an toàn cho gối. Jab rất tốt. Chú ý thế thủ khi móc." },
            },
        },
    },
    {
        key: "linh-pads-18d",
        fighterId: "f-linh-pham",
        uploadedById: RAFAEL,
        sessionId: null,
        title: "Đấm đích — đòn phối hợp có đá",
        trainingType: "pad_work",
        cameraAngle: "diagonal",
        resolution: "1920x1080",
        fps: 60,
        durationSec: 200,
        uploadedAt: daysAgo(18, 18, 20),
        fileStyle: "camera",
        notes: null,
        outcome: {
            status: "completed",
            workerId: "gpu-worker-02",
            processingRatio: 0.92,
            attempts: 2,
            analysis: {
                repertoire: emphasise(REPERTOIRES.kickboxing, "rear_kick", 1.6),
                tuning: { handSpeedFactor: 0.85, kickSpeedFactor: 1.02, guardDropRates: { jab: 0.15, cross: 0.18, rear_kick: 0.45 }, restGuardLapse: 0.32 },
                summaryNote: "Các lần phát hiện cú đá có độ tin cậy cao; người cầm đích đôi lúc che khuất tay.",
                findings: [
                    kickRotationFinding("left_leg", { review: confirmed() }),
                    kickGuardFinding("left_leg", { review: confirmed() }),
                    guardUptimeFinding("concern", { review: confirmed("Tay thu về chậm sau các cú đấm thẳng.") }),
                    crossExtensionFinding({ review: corrected("Độ duỗi cross đạt yêu cầu", "Tầm với ổn; vấn đề là tốc độ tay.") }),
                    headMovementFinding("improvement", { review: confirmed() }),
                ],
                review: { reviewerId: RAFAEL, reviewedAt: daysAgo(17, 9, 0), rating: 4, summary: "Cú đá sắc bén. Tay vẫn chậm trở về thế thủ." },
            },
        },
    },
    {
        key: "kenji-shadow-20d",
        fighterId: "f-kenji-morita",
        uploadedById: "u-kenji-morita",
        sessionId: null,
        title: "Đánh bóng — bộ chân karate",
        trainingType: "shadow_boxing",
        cameraAngle: "front",
        resolution: "1920x1080",
        fps: 30,
        durationSec: 140,
        uploadedAt: daysAgo(20, 7, 50),
        fileStyle: "android",
        notes: null,
        outcome: {
            status: "completed",
            workerId: "gpu-worker-03",
            processingRatio: 0.7,
            attempts: 1,
            analysis: {
                repertoire: REPERTOIRES.karate,
                tuning: { southpawShare: 0.35, handSpeedFactor: 1.02, kickSpeedFactor: 1.04, headMovesPerMin: 7, balanceScore: 90 },
                summaryNote: "Video rõ nét, theo dõi ổn định; các lần đổi thế đứng được theo dõi chính xác.",
                findings: [
                    stanceSwitchFinding(confirmed()),
                    teepFinding(confirmed()),
                    crossExtensionFinding({ review: confirmed() }),
                    guardUptimeFinding("strength", { review: confirmed() }),
                    headMovementFinding("improvement", { review: rejected("Kiểm soát cự ly kiểu karate thay vì lách đầu.") }),
                ],
                review: { reviewerId: RAFAEL, reviewedAt: daysAgo(19, 10, 15), rating: 4, summary: "Bộ chân và đổi thế sắc nét. Chưa thấy gì bất thường ở vai vào thời điểm này." },
            },
        },
    },
    {
        key: "emma-pads-20d",
        fighterId: "f-emma-lindqvist",
        uploadedById: RAFAEL,
        sessionId: null,
        title: "Đấm đích — mở đòn đá thế southpaw",
        trainingType: "pad_work",
        cameraAngle: "diagonal",
        resolution: "1920x1080",
        fps: 60,
        durationSec: 180,
        uploadedAt: daysAgo(20, 17, 30),
        fileStyle: "camera",
        notes: null,
        outcome: {
            status: "completed",
            workerId: "gpu-worker-01",
            processingRatio: 0.85,
            attempts: 1,
            analysis: {
                repertoire: REPERTOIRES.kickboxing,
                tuning: { handSpeedFactor: 1.03 * 0.92, kickSpeedFactor: 1.05 * 0.92, guardDropRates: { lead_hook: 0.33 }, hookConfusionRate: 0.12 },
                summaryNote: "Việc theo dõi ổn định; một vài cú hook ra đòn ngang qua camera được phân loại với độ tin cậy thấp.",
                findings: [
                    guardAfterLeadHookFinding("right_arm", { review: confirmed() }),
                    kickRotationFinding("left_leg", { review: confirmed() }),
                    jabRangeFinding({ review: confirmed() }),
                    crossExtensionFinding({ review: confirmed() }),
                    lowConfidenceHooksFinding({ review: corrected("Lẫn cả hook và cross", "Có vài cú là cross — đã sửa trên các lần phát hiện.") }),
                    headMovementFinding("improvement", { review: confirmed("Lách đầu cả sau cú đá, không chỉ sau đòn đấm.") }),
                ],
                review: { reviewerId: RAFAEL, reviewedAt: daysAgo(19, 9, 0), rating: 4, summary: "Ra đòn gọn gàng. Siết thế thủ thêm một chút khi móc tay trước." },
            },
        },
    },
    {
        key: "marcus-pads-22d",
        fighterId: "f-marcus-hale",
        uploadedById: RAFAEL,
        sessionId: null,
        title: "Đấm đích — đòn phối hợp tập lực",
        trainingType: "pad_work",
        cameraAngle: "front",
        resolution: "1920x1080",
        fps: 60,
        durationSec: 210,
        uploadedAt: daysAgo(22, 16, 40),
        fileStyle: "camera",
        notes: null,
        outcome: {
            status: "completed",
            workerId: "gpu-worker-02",
            processingRatio: 0.9,
            attempts: 1,
            analysis: {
                repertoire: REPERTOIRES.kickboxing,
                tuning: { handSpeedFactor: 1.05, kickSpeedFactor: 1.02, guardDropRates: { rear_kick: 0.32 }, stanceWidthRatio: 1.32 },
                summaryNote: "Video quay chính diện cho thấy rõ độ duỗi đòn đấm; các cú đá hướng về camera có độ tin cậy thấp hơn một chút.",
                findings: [
                    crossExtensionFinding({ review: confirmed() }),
                    kickRotationFinding("right_leg", { review: confirmed() }),
                    kickGuardFinding("right_leg", { review: corrected("Vung tay chấp nhận được", "Tay đối trọng — chỉ là vấn đề khi đứng sát cự ly đánh.") }),
                    speedFadeFinding({ review: confirmed() }),
                    headMovementFinding("improvement", { review: confirmed() }),
                ],
                review: {
                    reviewerId: RAFAEL,
                    reviewedAt: daysAgo(21, 9, 30),
                    rating: 4,
                    summary: "Tay nặng và nhịp đá tốt. Tay sau là vũ khí của anh ấy — giữ cổ tay thẳng khi chạm đòn.",
                },
            },
        },
    },
    {
        key: "sofia-shadow-26d",
        fighterId: "f-sofia-kowalski",
        uploadedById: "u-sofia-kowalski",
        sessionId: null,
        title: "Đánh bóng — bài kết thúc thể lực",
        trainingType: "shadow_boxing",
        cameraAngle: "front",
        resolution: "1080x1920",
        fps: 30,
        durationSec: 110,
        uploadedAt: daysAgo(26, 19, 0),
        fileStyle: "android",
        notes: null,
        outcome: {
            status: "completed",
            workerId: "gpu-worker-03",
            processingRatio: 0.64,
            attempts: 1,
            analysis: {
                repertoire: REPERTOIRES.grappler,
                tuning: { handSpeedFactor: 0.87, straightExtensionShift: -10, guardDropRates: { cross: 0.3, jab: 0.2 }, restGuardLapse: 0.3 },
                summaryNote: "Việc theo dõi ổn định; số lần hạ thế thủ tăng ở nửa sau clip.",
                findings: [
                    jabRangeFinding({ review: confirmed() }),
                    guardUptimeFinding("concern", { review: confirmed("Mệt ở nửa sau — thế thủ bị hạ xuống.") }),
                    headMovementFinding("improvement", { review: rejected("Không phải trọng tâm của bài kết thúc này.") }),
                    speedFadeFinding({ review: confirmed() }),
                ],
                review: { reviewerId: ANNA, reviewedAt: daysAgo(25, 10, 0), rating: 3, summary: "Đòn đánh chỉ là công cụ hỗ trợ với cô ấy — áp sát ổn, thế thủ lỏng khi mệt." },
            },
        },
    },
    {
        key: "hoang-pads-30d",
        fighterId: "f-hoang-long",
        uploadedById: ANNA,
        sessionId: null,
        title: "Đấm đích — đòn chân và tay Vovinam",
        trainingType: "pad_work",
        cameraAngle: "diagonal",
        resolution: "1920x1080",
        fps: 30,
        durationSec: 160,
        uploadedAt: daysAgo(30, 17, 20),
        fileStyle: "camera",
        notes: null,
        outcome: {
            status: "completed",
            workerId: "gpu-worker-01",
            processingRatio: 0.72,
            attempts: 1,
            analysis: {
                repertoire: REPERTOIRES.karate,
                tuning: { handSpeedFactor: 0.95, kickSpeedFactor: 0.98, trackingQuality: 0.94 },
                summaryNote: "Video đủ sáng, theo dõi ổn định suốt clip.",
                findings: [
                    kickRotationFinding("right_leg", { review: confirmed() }),
                    crossExtensionFinding({ review: confirmed() }),
                    teepFinding(confirmed()),
                    headMovementFinding("improvement", { review: confirmed() }),
                    guardUptimeFinding("strength", { review: confirmed() }),
                ],
                review: { reviewerId: ANNA, reviewedAt: daysAgo(29, 9, 45), rating: 4, summary: "Cú đá và độ xoay tốt. Buổi tập ổn." },
            },
        },
    },
    {
        key: "lucas-sparring-35d",
        fighterId: "f-lucas-ferreira",
        uploadedById: ANNA,
        sessionId: null,
        title: "Đấu tập — các hiệp MMA",
        trainingType: "sparring",
        cameraAngle: "diagonal",
        resolution: "1920x1080",
        fps: 60,
        durationSec: 240,
        uploadedAt: daysAgo(35, 18, 30),
        fileStyle: "camera",
        notes: null,
        outcome: {
            status: "completed",
            workerId: "gpu-worker-02",
            processingRatio: 1.1,
            attempts: 1,
            analysis: {
                repertoire: REPERTOIRES.grappler,
                tuning: { handSpeedFactor: 0.95, trackingLosses: 8, trackingQuality: 0.8, confidenceShift: -0.03, restGuardLapse: 0.3, hookConfusionRate: 0.35 },
                summaryNote: "Các pha clinch gây che khuất nhiều lần nên một số lần phát hiện có độ tin cậy thấp.",
                findings: [
                    jabRangeFinding({ review: confirmed() }),
                    trackingGapFinding("chủ yếu trong các pha clinch", confirmed("Các pha clinch — đúng như dự kiến.")),
                    lowConfidenceHooksFinding({ review: corrected("Chủ yếu là cross", "Phần lớn là cú cross tung ra khi tách khỏi clinch.") }),
                    guardUptimeFinding("concern", { review: confirmed() }),
                    kickRotationFinding("left_leg", { review: confirmed() }),
                ],
                review: { reviewerId: ANNA, reviewedAt: daysAgo(34, 10, 0), rating: 3, summary: "Đòn đánh ổn so với trình độ; cậu ấy nên lao vào ôm chân sớm hơn. Việc theo dõi bị mất mỗi khi vào clinch." },
            },
        },
    },
    {
        key: "diego-bag-42d",
        fighterId: "f-diego-alvarez",
        uploadedById: RAFAEL,
        sessionId: null,
        title: "Bao cát — boxing cơ bản",
        trainingType: "heavy_bag",
        cameraAngle: "side",
        resolution: "1920x1080",
        fps: 60,
        durationSec: 180,
        uploadedAt: daysAgo(42, 16, 10),
        fileStyle: "camera",
        notes: null,
        outcome: {
            status: "completed",
            workerId: "gpu-worker-03",
            processingRatio: 0.88,
            attempts: 1,
            analysis: {
                repertoire: REPERTOIRES.grappler,
                tuning: { handSpeedFactor: 0.97, hookElbowDeg: [98, 122], guardDropRates: { lead_hook: 0.3 }, pivotRate: 0.05, balanceScore: 88 },
                summaryNote: "Video quay ngang cho thấy rõ cơ học đòn đấm, theo dõi ổn định.",
                findings: [
                    guardAfterLeadHookFinding("left_arm", { review: confirmed() }),
                    pivotFinding("improvement", { review: confirmed() }),
                    crossExtensionFinding({ review: confirmed() }),
                    jabRangeFinding({ review: corrected("Ít dùng jab", "Buổi này cậu ấy chủ yếu mở đòn bằng cross.") }),
                    headMovementFinding("improvement", { review: confirmed("Cần đưa đầu ra khỏi đường đòn sau khi đấm.") }),
                ],
                review: { reviewerId: RAFAEL, reviewedAt: daysAgo(41, 9, 0), rating: 3, summary: "Tập chăm chỉ với nền tảng vật. Cú móc còn rộng — tiếp tục tập cho gọn." },
            },
        },
    },
];

/** Combinations that start within a second of a slip or roll ending. */
function countersOffHeadMovement(ctx: FindingContext): number {
    const moves = ctx.events.filter((e) => e.type === "slip" || e.type === "roll");
    return ctx.combinations.filter((c) => moves.some((m) => c.startMs - m.endMs >= 0 && c.startMs - m.endMs <= 1000)).length;
}

/* ─── Building videos, jobs and analyses ──────────────────────────────────── */

const TYPE_SLUG: Record<VideoTrainingType, string> = { shadow_boxing: "shadow", pad_work: "padwork", heavy_bag: "bag", sparring: "sparring" };
const CAMERA_NUMBER: Record<CameraAngle, number> = { front: 1, diagonal: 2, side: 3 };

const addSeconds = (iso: string, seconds: number) => new Date(Date.parse(iso) + seconds * 1000).toISOString();

/**
 * Plans and pipeline timings are computed from authored times; stored records map the ones
 * that fall on today before the mock anchor (see time.ts), which keeps their order.
 */
const pastOrNull = (iso: string | null) => (iso === null ? null : clampPastToday(iso));

function pastJob(job: AIJob): AIJob {
    return { ...job, queuedAt: clampPastToday(job.queuedAt), startedAt: pastOrNull(job.startedAt), finishedAt: pastOrNull(job.finishedAt) };
}

function userName(userId: string): string {
    return mockUsers.find((u) => u.id === userId)?.name ?? "Người dùng không xác định";
}

function fighterOf(fighterId: string) {
    const fighter = mockFighters.find((f) => f.id === fighterId);
    if (!fighter) throw new Error(`Unknown fighter in AI seed: ${fighterId}`);
    return fighter;
}

function fileNameFor(plan: VideoPlan, second: number): string {
    const recordedAt = addSeconds(plan.uploadedAt, -35 * 60);
    const date = dayKey(recordedAt);
    const compactDate = date.replace(/-/g, "");
    const clock = `${formatTime(recordedAt).replace(":", "")}${String(second).padStart(2, "0")}`;
    if (plan.fileStyle === "android") return `PXL_${compactDate}_${clock}.mp4`;
    if (plan.fileStyle === "iphone") return `IMG_${compactDate}_${clock}.MOV`;
    const firstName = plan.key.split("-")[0];
    return `${date}_${firstName}_${TYPE_SLUG[plan.trainingType]}_cam${CAMERA_NUMBER[plan.cameraAngle]}.mp4`;
}

function megabytesPerMinute(plan: VideoPlan, rng: ReturnType<typeof createRandom>): number {
    if (plan.resolution === "3840x2160") return rng.float(150, 175, 1);
    if (plan.fps === 60) return rng.float(45, 60, 1);
    return rng.float(24, 32, 1);
}

function failedJob(id: string, plan: VideoPlan, failure: FailurePlan, queuedAt: string, waitSec: number): AIJob {
    const startedAt = addSeconds(queuedAt, waitSec);
    return {
        id,
        videoId: `v-${plan.key}`,
        fighterId: plan.fighterId,
        status: "failed",
        stage: failure.stage,
        progressPct: failure.progressPct,
        modelIds: PIPELINE_MODEL_IDS,
        workerId: failure.workerId,
        attempts: failure.attempts,
        queuedAt,
        startedAt,
        finishedAt: addSeconds(startedAt, failure.runSec),
        durationSec: failure.runSec,
        avgConfidence: null,
        lowConfidence: false,
        errorCode: failure.code,
        errorMessage: failure.message,
    };
}

function buildSeed(): { videos: Video[]; jobs: AIJob[]; analyses: AIAnalysis[] } {
    const videos: Video[] = [];
    const jobs: AIJob[] = [];
    const analyses: AIAnalysis[] = [];

    const chronological = [...VIDEO_PLANS].sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
    for (const plan of chronological) {
        const rng = createRandom(`video:${plan.key}`);
        const fighter = fighterOf(plan.fighterId);
        const videoId = `v-${plan.key}`;
        const jobId = `job-${plan.key}`;
        const outcome = plan.outcome;

        let queuedAt = addSeconds(plan.uploadedAt, rng.int(3, 9));
        if (plan.earlierFailure) {
            const earlier = failedJob(`${jobId}-a1`, plan, plan.earlierFailure, queuedAt, rng.int(8, 40));
            jobs.push(pastJob(earlier));
            queuedAt = addSeconds(earlier.finishedAt ?? queuedAt, plan.earlierFailure.retryAfterMin * 60);
        }
        const waitSec = rng.int(8, 75);

        let job: AIJob;
        let analysisId: string | null = null;
        if (outcome.status === "completed") {
            const startedAt = addSeconds(queuedAt, waitSec);
            const durationSec = Math.round(plan.durationSec * outcome.processingRatio);
            const finishedAt = addSeconds(startedAt, durationSec);
            const plannedReview = outcome.analysis.review;
            const analysis = generateAnalysis({
                analysisId: `an-${plan.key}`,
                videoId,
                jobId,
                fighterId: plan.fighterId,
                trainingType: plan.trainingType,
                stance: fighter.stance,
                durationSec: plan.durationSec,
                fps: plan.fps,
                processedAt: clampPastToday(finishedAt),
                models: PRODUCTION_MODEL_VERSIONS,
                seed: `an-${plan.key}`,
                tuning: resolveTuning(plan.trainingType, outcome.analysis.repertoire, outcome.analysis.tuning),
                summaryNote: outcome.analysis.summaryNote,
                findings: outcome.analysis.findings,
                reviewer: plannedReview
                    ? { id: plannedReview.reviewerId, name: userName(plannedReview.reviewerId), reviewedAt: clampPastToday(plannedReview.reviewedAt) }
                    : null,
                coachReview: plannedReview ? { rating: plannedReview.rating, summary: plannedReview.summary } : null,
            });
            generated.set(plan.key, analysis);
            analyses.push(analysis);
            analysisId = analysis.id;
            job = {
                id: jobId,
                videoId,
                fighterId: plan.fighterId,
                status: "completed",
                stage: "done",
                progressPct: 100,
                modelIds: PIPELINE_MODEL_IDS,
                workerId: outcome.workerId,
                attempts: outcome.attempts,
                queuedAt,
                startedAt,
                finishedAt,
                durationSec,
                avgConfidence: analysis.overallConfidence,
                lowConfidence: (analysis.overallConfidence !== null && analysis.overallConfidence < LOW_CONFIDENCE_THRESHOLD),
                errorCode: null,
                errorMessage: null,
            };
        } else if (outcome.status === "processing") {
            job = {
                id: jobId,
                videoId,
                fighterId: plan.fighterId,
                status: "processing",
                stage: outcome.stage,
                progressPct: outcome.progressPct,
                modelIds: PIPELINE_MODEL_IDS,
                workerId: outcome.workerId,
                attempts: 1,
                queuedAt,
                startedAt: addSeconds(queuedAt, waitSec),
                finishedAt: null,
                durationSec: null,
                avgConfidence: null,
                lowConfidence: false,
                errorCode: null,
                errorMessage: null,
            };
        } else if (outcome.status === "queued") {
            job = {
                id: jobId,
                videoId,
                fighterId: plan.fighterId,
                status: "queued",
                stage: "queued",
                progressPct: 0,
                modelIds: PIPELINE_MODEL_IDS,
                workerId: null,
                attempts: 1,
                queuedAt,
                startedAt: null,
                finishedAt: null,
                durationSec: null,
                avgConfidence: null,
                lowConfidence: false,
                errorCode: null,
                errorMessage: null,
            };
        } else {
            job = failedJob(jobId, plan, outcome.failure, queuedAt, waitSec);
        }
        jobs.push(pastJob(job));

        videos.push({
            id: videoId,
            fighterId: plan.fighterId,
            uploadedById: plan.uploadedById,
            sessionId: plan.sessionId,
            title: plan.title,
            trainingType: plan.trainingType,
            cameraAngle: plan.cameraAngle,
            fileName: fileNameFor(plan, rng.int(0, 59)),
            fileSizeMb: round((megabytesPerMinute(plan, rng) * plan.durationSec) / 60, 1),
            durationSec: plan.durationSec,
            resolution: plan.resolution,
            fps: plan.fps,
            uploadedAt: clampPastToday(plan.uploadedAt),
            status: outcome.status,
            jobId,
            analysisId,
            sourceUrl: null,
            notes: plan.notes,
        });
    }

    const newestFirst = <T>(items: T[], date: (item: T) => string) => items.sort((a, b) => date(b).localeCompare(date(a)));
    return {
        videos: newestFirst(videos, (v) => v.uploadedAt),
        jobs: newestFirst(jobs, (j) => j.queuedAt),
        analyses: newestFirst(analyses, (a) => a.processedAt),
    };
}

const seed = buildSeed();

export const mockVideos: Video[] = seed.videos;
export const mockAIJobs: AIJob[] = seed.jobs;
export const mockAIAnalyses: AIAnalysis[] = seed.analyses;

/* ─── Abnormal movement alerts ────────────────────────────────────────────── */

interface AlertPlan {
    id: string;
    key: string;
    bodyRegion: BodyRegion;
    pattern: string;
    description: string;
    confidence: number;
    metric: (analysis: AIAnalysis) => AbnormalMovementAlert["metric"];
    timestampsMs: (analysis: AIAnalysis) => number[];
    status: AlertStatus;
    review: { reviewerId: string; reviewedAt: string; note: string } | null;
    linkedInjuryId: string | null;
}

function analysisOf(key: string): AIAnalysis {
    const analysis = generated.get(key);
    if (!analysis) throw new Error(`Alert references a missing analysis: ${key}`);
    return analysis;
}

function ranked(detections: Detection[], field: "jointAngleDeg" | "hipRotationDeg" | "peakSpeed", count: number, order: "highest" | "lowest" = "highest"): Detection[] {
    return [...detections]
        .sort((a, b) => (order === "highest" ? b[field] - a[field] : a[field] - b[field]))
        .slice(0, count)
        .sort((a, b) => a.peakMs - b.peakMs);
}

const leftHooks = (analysis: AIAnalysis) => strikesIn(findingContext(analysis), { type: "hook", limb: "left_arm" });

const ALERT_PLANS: AlertPlan[] = [
    {
        id: "al-minh-elbow-2d",
        key: "minh-pads-2d",
        bodyRegion: "left_elbow",
        pattern: "Khuỷu tay trước mở rộng hơn mức thường thấy khi ra cú móc",
        description:
            "Ở một số cú móc tay trước, khuỷu tay trái có vẻ mở rộng hơn so với các video đã phân tích trước đây của Minh. Đây là quan sát chuyển động để tham khảo lâm sàng; võ sĩ không ghi nhận triệu chứng nào trong ghi chú buổi tập.",
        confidence: 0.64,
        metric: (analysis) => ({
            label: "Góc khuỷu tay ở điểm cuối cú móc tay trước (các cú rộng nhất)",
            observed: meanOf(ranked(leftHooks(analysis), "jointAngleDeg", 3), "jointAngleDeg"),
            baseline: meanOf([...leftHooks(analysisOf("minh-shadow-9d")), ...leftHooks(analysisOf("minh-sparring-16d"))], "jointAngleDeg"),
            unit: "°",
        }),
        timestampsMs: (analysis) => ranked(leftHooks(analysis), "jointAngleDeg", 3).map((d) => d.peakMs),
        status: "new",
        review: null,
        linkedInjuryId: null,
    },
    {
        id: "al-kenji-shoulder-9d",
        key: "kenji-bag-9d",
        bodyRegion: "right_shoulder",
        pattern: "Vai phải nâng lệch khi ra cú cross",
        description:
            "Ở điểm cuối các cú cross tay phải, vai phải có vẻ cao hơn vai trái so với các video đánh bóng trước đây của Kenji. Hiện tượng này xuất hiện nhiều hơn ở các hiệp cuối.",
        confidence: 0.81,
        metric: () => ({ label: "Độ nâng vai phải ở điểm cuối cú cross", observed: 3.8, baseline: 1.4, unit: "cm" }),
        timestampsMs: (analysis) => ranked(strikesIn(findingContext(analysis), { type: "cross", limb: "right_arm" }), "jointAngleDeg", 4).map((d) => d.peakMs),
        status: "follow_up",
        review: {
            reviewerId: "u-thu-le",
            reviewedAt: daysAgo(8, 10, 30),
            note: "Thấy rõ vai nâng khi xem lại. Đã đặt lịch khám vai vào ngày mai; giới hạn cường độ ở RPE 8 cho đến lúc đó.",
        },
        linkedInjuryId: null,
    },
    {
        id: "al-lucas-hip-4d",
        key: "lucas-shadow-4d",
        bodyRegion: "left_hamstring",
        pattern: "Sải bước trái ngắn lại và độ duỗi hông giảm so với mức nền",
        description:
            "Các bước từ chân trái có vẻ ngắn hơn và độ duỗi hông bên đó có vẻ giảm so với video đấu tập trước chấn thương của Lucas.",
        confidence: 0.77,
        metric: () => ({ label: "Độ dài sải bước trái", observed: 81, baseline: 100, unit: "% of baseline" }),
        timestampsMs: (analysis) =>
            analysis.movementEvents
                .filter((e) => e.type === "step_in" || e.type === "step_out")
                .slice(0, 4)
                .map((e) => e.startMs),
        status: "acknowledged",
        review: {
            reviewerId: "u-samuel-brooks",
            reviewedAt: daysAgo(3, 14, 10),
            note: "Phù hợp với chấn thương căng cơ đùi sau bên trái đã biết, đang ở giai đoạn 3 phục hồi. Sải bước lệch là bình thường ở giai đoạn này; sẽ kiểm tra lại ở buổi vật lý trị liệu tới.",
        },
        linkedInjuryId: "inj-lucas-hamstring",
    },
    {
        id: "al-marcus-hand-11d",
        key: "marcus-bag-11d",
        bodyRegion: "right_hand",
        pattern: "Giảm tốc đột ngột và hạ thế thủ sau khi cú cross tay phải chạm đòn",
        description:
            "Sau khi một cú cross tay phải trúng bao ở hiệp cuối, tay phải có vẻ giảm tốc đột ngột và được giữ thấp; sau đó không còn đòn tay phải nào.",
        confidence: 0.72,
        metric: (analysis) => {
            const ctx = findingContext(analysis);
            const impact = ctx.events.find((e) => e.type === "guard_drop" && e.detail.includes("rút về"));
            const earlier = ctx.events.filter((e) => e.type === "guard_drop" && e !== impact);
            return {
                label: "Thời gian hồi thế thủ tay phải sau cú cross",
                observed: impact ? impact.endMs - impact.startMs : 0,
                baseline: earlier.length > 0 ? Math.round(average(earlier.map((e) => e.endMs - e.startMs))) : 420,
                unit: "ms",
            };
        },
        timestampsMs: (analysis) => {
            const impact = analysis.movementEvents.find((e) => e.type === "guard_drop" && e.detail.includes("rút về"));
            if (!impact) return [];
            const cross = [...analysis.detections].reverse().find((d) => d.type === "cross" && d.endMs <= impact.startMs + 100);
            return cross ? [cross.peakMs, impact.startMs] : [impact.startMs];
        },
        status: "follow_up",
        review: {
            reviewerId: "u-thu-le",
            reviewedAt: daysAgo(10, 8, 40),
            note: "Khớp với chấn thương tay phải HLV báo sau buổi tập. Đã khám và chụp phim — xem hồ sơ chấn thương.",
        },
        linkedInjuryId: "inj-marcus-hand",
    },
    {
        id: "al-diego-balance-6d",
        key: "diego-sparring-6d",
        bodyRegion: "head",
        pattern: "Thế đứng không vững và thế thủ hồi chậm sau một pha trao đổi đòn",
        description:
            "Sau một pha trao đổi đòn ở hiệp 3, thế thủ có vẻ hồi chậm hơn so với đầu clip và một số bước ngang có vẻ không vững với trụ chân hẹp dần. Việc bạn tập che khuất làm giảm độ tin cậy của quan sát này.",
        confidence: 0.61,
        metric: (analysis) => {
            const ctx = findingContext(analysis);
            const earlier = ctx.events.filter((e) => e.type === "guard_drop" && e.endMs < ctx.durationMs * 0.84);
            return {
                label: "Thời gian hồi thế thủ sau pha trao đổi đòn",
                observed: guardRecoveryAfter(ctx, "trao đổi đòn"),
                baseline: Math.round(average(earlier.map((e) => e.endMs - e.startMs))),
                unit: "ms",
            };
        },
        timestampsMs: (analysis) =>
            analysis.movementEvents
                .filter((e) => e.detail.startsWith("Chậm hồi") || e.detail.startsWith("Bước ngang không vững"))
                .slice(0, 4)
                .map((e) => e.startMs),
        status: "follow_up",
        review: {
            reviewerId: "u-thu-le",
            reviewedAt: daysAgo(6, 21, 35),
            note: "Đã xem cùng báo cáo của HLV về buổi tập. Đã hoàn tất đánh giá chấn động não; bắt đầu quy trình trở lại tập luyện theo từng bậc — xem hồ sơ chấn thương.",
        },
        linkedInjuryId: "inj-diego-concussion",
    },
    {
        id: "al-linh-knee-5d",
        key: "linh-bag-5d",
        bodyRegion: "left_knee",
        pattern: "Gối đổ vào trong khi tiếp đất sau cú đá vòng cầu",
        description: "Ở một số cú đá vòng cầu chân trái, gối trái có vẻ đổ vào trong khi bàn chân tiếp đất trở lại thế đứng.",
        confidence: 0.58,
        metric: () => ({ label: "Góc đổ gối vào trong khi tiếp đất sau cú đá", observed: 11, baseline: 7, unit: "°" }),
        timestampsMs: (analysis) => ranked(strikesIn(findingContext(analysis), { type: "kick", limb: "left_leg" }), "peakSpeed", 3).map((d) => d.endMs),
        status: "dismissed",
        review: {
            reviewerId: "u-thu-le",
            reviewedAt: daysAgo(4, 11, 0),
            note: "Đã xem từng khung hình các lần tiếp đất — trục gối nằm trong cơ học tiếp đất bình thường của cú đá này. Không cần xử lý.",
        },
        linkedInjuryId: null,
    },
    {
        id: "al-hoang-trunk-7d",
        key: "hoang-shadow-7d",
        bodyRegion: "lower_back",
        pattern: "Độ xoay thân giảm ở đòn tay sau so với mức nền",
        description:
            "Đòn tay sau có vẻ xoay thân ít hơn so với buổi đấm đích của Hoàng 30 ngày trước. Ánh sáng yếu làm giảm độ chính xác của điểm khớp, nên cần xác nhận quan sát này trên video tốt hơn.",
        confidence: 0.66,
        metric: (analysis) => ({
            label: "Độ xoay thân ở đòn tay sau",
            observed: meanOf(strikesIn(findingContext(analysis), { type: "cross" }), "hipRotationDeg"),
            baseline: meanOf(strikesIn(findingContext(analysisOf("hoang-pads-30d")), { type: "cross" }), "hipRotationDeg"),
            unit: "°",
        }),
        timestampsMs: (analysis) => ranked(strikesIn(findingContext(analysis), { type: "cross" }), "hipRotationDeg", 4, "lowest").map((d) => d.peakMs),
        status: "new",
        review: null,
        linkedInjuryId: null,
    },
];

function buildAlerts(): AbnormalMovementAlert[] {
    return ALERT_PLANS.map((plan) => {
        const analysis = analysisOf(plan.key);
        analysis.alertIds.push(plan.id);
        const decision: DoctorDecision | null = plan.status === "new" ? null : plan.status;
        return {
            id: plan.id,
            analysisId: analysis.id,
            videoId: analysis.videoId,
            fighterId: analysis.fighterId,
            detectedAt: analysis.processedAt,
            bodyRegion: plan.bodyRegion,
            pattern: plan.pattern,
            description: plan.description,
            confidence: plan.confidence,
            metric: plan.metric(analysis),
            timestampsMs: plan.timestampsMs(analysis),
            status: plan.status,
            doctorReview:
                plan.review && decision
                    ? {
                          decision,
                          reviewerId: plan.review.reviewerId,
                          reviewerName: userName(plan.review.reviewerId),
                          reviewedAt: clampPastToday(plan.review.reviewedAt),
                          note: plan.review.note,
                      }
                    : null,
            linkedInjuryId: plan.linkedInjuryId,
        };
    });
}

export const mockAbnormalMovementAlerts: AbnormalMovementAlert[] = buildAlerts();

/* ─── Model registry ──────────────────────────────────────────────────────── */

/** Blends historical review agreement with the reviews present in the seed. */
function agreement(historical: { count: number; pct: number }, seeded: { agreed: number; total: number }): { humanAgreementPct: number; reviewsCount: number } {
    const reviewsCount = historical.count + seeded.total;
    const agreed = (historical.count * historical.pct) / 100 + seeded.agreed;
    return { humanAgreementPct: round((agreed / reviewsCount) * 100, 1), reviewsCount };
}

const strikeReviews = mockAIAnalyses.flatMap((a) => [...a.detections.map((d) => d.review), ...a.findings.map((f) => f.review)]).filter((r) => r !== null);
const alertReviews = mockAbnormalMovementAlerts.map((a) => a.doctorReview).filter((r) => r !== null);

export const mockAIModels: AIModel[] = [
    {
        id: MODEL.fighterDetection,
        name: "fighter-det",
        task: "fighter_detection",
        version: "2.1.0",
        framework: "PyTorch 2.4 · TensorRT 10",
        status: "active",
        description:
            "Bộ phát hiện một giai đoạn, định vị võ sĩ, người cầm đích và bạn tập, đồng thời duy trì theo dõi liên tục võ sĩ đang được phân tích.",
        deployedAt: daysAgo(96, 14, 0),
        confidenceThreshold: 0.35,
        lowConfidenceThreshold: 0.6,
        avgLatencyMs: 11,
        precision: 0.97,
        recall: 0.95,
        humanAgreementPct: 97.2,
        reviewsCount: 412,
    },
    {
        id: MODEL.poseMedium,
        name: "yolov8m-pose",
        task: "pose_estimation",
        version: "1.4.0",
        framework: "Ultralytics 8.3 · TensorRT 10",
        status: "active",
        description:
            "Bản ghi mô hình tư thế minh họa cho giao diện demo. Bản ghi này không kèm checkpoint đã tinh chỉnh hay độ chính xác đo thực tế.",
        deployedAt: daysAgo(58, 10, 30),
        confidenceThreshold: 0.35,
        lowConfidenceThreshold: 0.6,
        avgLatencyMs: 24,
        precision: 0.91,
        recall: 0.89,
        humanAgreementPct: 92.6,
        reviewsCount: 655,
    },
    {
        id: MODEL.poseNano,
        name: "yolov8n-pose",
        task: "pose_estimation",
        version: "1.2.0",
        framework: "Ultralytics 8.1 · ONNX Runtime",
        status: "deprecated",
        description: "Mô hình tư thế gọn nhẹ ban đầu, đi kèm worker video đầu tiên. Chỉ giữ lại để quay về phiên bản cũ khi cần.",
        deployedAt: daysAgo(240, 9, 0),
        confidenceThreshold: 0.35,
        lowConfidenceThreshold: 0.6,
        avgLatencyMs: 9,
        precision: 0.84,
        recall: 0.8,
        humanAgreementPct: 86.1,
        reviewsCount: 1204,
    },
    {
        id: MODEL.strike,
        name: "strike-cls",
        task: "action_recognition",
        version: "2.3.1",
        framework: "PyTorch 2.4 (ST-GCN)",
        status: "active",
        description:
            "Bản ghi bộ phân loại kỹ thuật minh họa cho giao diện demo. Worker đang chạy dùng quy tắc kinh nghiệm về chuyển động; bản ghi này không đại diện cho một mạng đồ thị đã huấn luyện.",
        deployedAt: daysAgo(44, 11, 0),
        confidenceThreshold: 0.35,
        lowConfidenceThreshold: 0.6,
        avgLatencyMs: 38,
        precision: 0.9,
        recall: 0.86,
        ...agreement({ count: 1860, pct: 87.9 }, { agreed: strikeReviews.filter((r) => r.decision === "confirmed").length, total: strikeReviews.length }),
    },
    {
        id: MODEL.strikeRc,
        name: "strike-cls",
        task: "action_recognition",
        version: "2.4.0-rc1",
        framework: "PyTorch 2.4 (ST-GCN)",
        status: "staging",
        description:
            "Bản ứng viên phát hành, huấn luyện lại với 2,100 lần sửa của HLV từ bản 2.3.1. Đánh giá offline nâng recall của hook lên 0.81; đang chạy song song ở chế độ ẩn trên 10% số tác vụ.",
        deployedAt: daysAgo(6, 15, 0),
        confidenceThreshold: 0.35,
        lowConfidenceThreshold: 0.6,
        avgLatencyMs: 41,
        precision: 0.92,
        recall: 0.89,
        humanAgreementPct: 90.3,
        reviewsCount: 184,
    },
    {
        id: MODEL.anomaly,
        name: "move-anomaly",
        task: "anomaly_detection",
        version: "0.9.2-beta",
        framework: "PyTorch 2.4 (LSTM autoencoder)",
        status: "active",
        description:
            "So sánh động học khớp với video nền của chính võ sĩ để phát hiện chuyển động có thể bất thường cho bác sĩ xem xét. Bản beta: các quan sát chỉ là thông tin hỗ trợ.",
        deployedAt: daysAgo(71, 16, 0),
        confidenceThreshold: 0.35,
        lowConfidenceThreshold: 0.6,
        avgLatencyMs: 120,
        precision: 0.71,
        recall: 0.78,
        ...agreement({ count: 96, pct: 72 }, { agreed: alertReviews.filter((r) => r.decision !== "dismissed").length, total: alertReviews.length }),
    },
    {
        id: MODEL.anomalyRc,
        name: "move-anomaly",
        task: "anomaly_detection",
        version: "1.0.0-rc1",
        framework: "PyTorch 2.4 (LSTM autoencoder)",
        status: "staging",
        description: "Bổ sung mức nền bất đối xứng riêng cho từng võ sĩ và chuẩn hóa theo độ mệt; giảm cảnh báo sai khi tiếp đất sau cú đá trong thử nghiệm offline.",
        deployedAt: daysAgo(9, 13, 30),
        confidenceThreshold: 0.35,
        lowConfidenceThreshold: 0.6,
        avgLatencyMs: 135,
        precision: 0.76,
        recall: 0.8,
        humanAgreementPct: 79.5,
        reviewsCount: 38,
    },
];
