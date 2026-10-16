export type Role = "coach" | "doctor" | "fighter";
export type Restriction = "none" | "contact" | "upper" | "rest";
export type TemplateId = "distance" | "counter" | "strength" | "tactics";
export type Focus = "distance" | "defense";
export type SessionResult = {
    successes: number;
    attempts: number;
    completedRounds: number;
    effort: number;
    discomfort: boolean;
    note: string;
};
export type Session = {
    id: string;
    date: string;
    time: string;
    templateId: TemplateId;
    rounds: number;
    work: number;
    rest: number;
    focus: Focus;
    target: number;
    status: "planned" | "completed";
    result?: SessionResult;
    original?: TemplateId;
    reason?: string;
};
export type Clinical = {
    restriction: Restriction;
    reviewAt: string;
    sharedNote: string;
    reason: string;
    version: number;
    assessedSessionIds: string[];
};
export type CampEvent = { id: number; actor: Role; title: string; detail: string };
export type CampState = {
    focus: Focus;
    target: number;
    sessions: Session[];
    clinical: Clinical;
    weight: {
        target: number;
        weighIn: string;
        records: { date: string; value: number; context: string }[];
        status: "draft" | "requested" | "needs-info" | "reviewed";
        question: string;
        decision: string;
        followUp: string;
    };
    reviewedResults: string[];
    events: CampEvent[];
    error: string;
    notice: string;
};
export const DEMO_TODAY = "2026-10-06";
export const roles: Record<Role, string> = { coach: "HLV Quốc Tuấn", doctor: "BS. Mai Anh", fighter: "Võ sĩ Minh Khang" };
export const restrictions: Record<Restriction, string> = {
    none: "Không có hạn chế đang áp dụng", contact: "Tạm ngừng đối kháng", upper: "Hạn chế tải thân trên", rest: "Tạm ngừng tập thể chất",
};
export const focusLabels: Record<Focus, string> = { distance: "Thoát tầm phản công sau tổ hợp đòn", defense: "Giữ tay bảo vệ khi kết thúc đòn" };
export const templates: Record<TemplateId, {
    name: string; category: string; contact: boolean; upper: boolean; physical: boolean;
    purpose: string; rationale: string; steps: { name: string; detail: string }[];
}> = {
    distance: {
        name: "Jab – cross – thoát góc", category: "Kỹ thuật", contact: false, upper: true, physical: true,
        purpose: "Thoát khỏi đường phản công sau tổ hợp hai đòn.",
        rationale: "Phù hợp điểm yếu đang theo dõi: còn đứng trong tầm đối thủ sau khi ra đòn.",
        steps: [{ name: "Chuẩn bị", detail: "HLV kiểm tra tư thế, thống nhất tín hiệu và đánh dấu vùng di chuyển." }, { name: "Bài tập chính", detail: "Jab – cross trên đích, thoát góc theo tín hiệu; HLV quan sát vị trí kết thúc." }, { name: "Kiểm tra cuối buổi", detail: "Ghi số lần đạt trên tổng số tình huống: thoát đúng vùng và giữ tư thế bảo vệ." }],
    },
    counter: {
        name: "Phòng thủ → phản đòn tình huống", category: "Đối kháng", contact: true, upper: true, physical: true,
        purpose: "Đưa kỹ năng phòng thủ vào tình huống có đối thủ.",
        rationale: "Dùng khi HLV muốn kiểm tra khả năng chuyển kỹ thuật sang đối luyện; có tiếp xúc.",
        steps: [{ name: "Thống nhất tình huống", detail: "HLV quy định vai trò, tín hiệu dừng và phạm vi đối luyện." }, { name: "Đối luyện có kiểm soát", detail: "Đối thủ đưa tín hiệu tấn công; võ sĩ chọn phương án phòng thủ và phản công." }, { name: "Đánh giá", detail: "HLV ghi nhận chất lượng phòng thủ và vị trí sau phản công." }],
    },
    strength: {
        name: "Sức mạnh thân trên", category: "Thể lực", contact: false, upper: true, physical: true,
        purpose: "Theo dõi chất lượng vận động trong giáo án thể lực do HLV phụ trách.",
        rationale: "Có tải thân trên; phải rà soát khi bác sĩ ghi hạn chế vùng này.",
        steps: [{ name: "Kiểm tra trước buổi", detail: "HLV xem trạng thái sức khỏe và kế hoạch thể lực đã thống nhất." }, { name: "Thực hiện giáo án", detail: "HLV chọn bài và tải cụ thể tại buổi tập theo đánh giá chuyên môn." }, { name: "Ghi nhận", detail: "Ghi mức hoàn thành, cảm nhận gắng sức và phản hồi khó chịu." }],
    },
    tactics: {
        name: "Đọc trận & phân tích đối thủ", category: "Chiến thuật", contact: false, upper: false, physical: false,
        purpose: "Nhận diện tình huống và lựa chọn phương án trước khi thực hành.",
        rationale: "Không có bài tập thể chất; có thể được HLV xem xét thay thế khi cần hạn chế vận động.",
        steps: [{ name: "Xem tình huống", detail: "Chọn các đoạn video có tình huống ra đòn và bị phản công." }, { name: "Phân tích lựa chọn", detail: "Võ sĩ chỉ ra thời điểm và hướng thoát phù hợp, HLV phản biện." }, { name: "Kiểm tra hiểu bài", detail: "Chấm số tình huống nhận diện đúng trên tổng tình huống đã xem." }],
    },
};

export function initialCamp(): CampState {
    return {
        focus: "distance", target: 80,
        sessions: [
            { id: "s1", date: "2026-10-03", time: "16:00", templateId: "distance", rounds: 4, work: 3, rest: 1, focus: "distance", target: 80, status: "completed", result: { successes: 5, attempts: 10, completedRounds: 4, effort: 6, discomfort: false, note: "Còn dừng lại sau tổ hợp đòn." } },
            { id: "s2", date: "2026-10-05", time: "16:00", templateId: "distance", rounds: 4, work: 3, rest: 1, focus: "distance", target: 80, status: "completed", result: { successes: 6, attempts: 10, completedRounds: 4, effort: 7, discomfort: false, note: "Có tiến bộ khi được nhắc; chưa ổn định khi tăng tốc." } },
            { id: "s3", date: "2026-10-06", time: "16:00", templateId: "counter", rounds: 4, work: 3, rest: 1, focus: "distance", target: 80, status: "planned" },
            { id: "s4", date: "2026-10-07", time: "07:00", templateId: "strength", rounds: 4, work: 3, rest: 1, focus: "defense", target: 80, status: "planned" },
            { id: "s5", date: "2026-10-08", time: "16:00", templateId: "distance", rounds: 4, work: 3, rest: 1, focus: "distance", target: 80, status: "planned" },
        ],
        clinical: { restriction: "none", reviewAt: "", sharedNote: "", reason: "", version: 0, assessedSessionIds: [] },
        weight: {
            target: 70, weighIn: "2026-10-30", status: "draft", question: "", decision: "", followUp: "",
            records: [{ date: "2026-09-22", value: 73.2, context: "Buổi sáng" }, { date: "2026-09-25", value: 72.8, context: "Buổi sáng" }, { date: "2026-09-28", value: 73, context: "Buổi sáng" }, { date: "2026-10-01", value: 72.5, context: "Buổi sáng" }, { date: "2026-10-04", value: 72.3, context: "Buổi sáng" }, { date: "2026-10-06", value: 72.1, context: "Buổi sáng" }],
        },
        reviewedResults: [],
        events: [{ id: 1, actor: "coach", title: "Đặt mục tiêu kỹ thuật cho chiến dịch", detail: "Thoát tầm phản công · Tiêu chí HLV: 80% tình huống đạt." }],
        error: "", notice: "",
    };
}
export function conflicts(templateId: TemplateId, clinical: Clinical): boolean {
    const template = templates[templateId];
    return clinical.restriction === "contact" ? template.contact : clinical.restriction === "upper" ? template.upper : clinical.restriction === "rest" ? template.physical : false;
}
export function resultPercent(session: Session): number | null {
    return session.result ? Math.round(session.result.successes / session.result.attempts * 100) : null;
}
export function evaluationLabel(session: Pick<Session, "templateId" | "focus">): string {
    return session.templateId === "tactics" ? "Nhận diện đúng phương án qua tình huống video" : session.templateId === "strength" ? "Thực hiện đúng tiêu chí vận động HLV đã giao" : focusLabels[session.focus];
}
export function sessionMinutes(session: Pick<Session, "rounds" | "work" | "rest">): number {
    return session.rounds * session.work + Math.max(0, session.rounds - 1) * session.rest;
}
export function unresolvedDiscomfort(state: CampState): Session[] {
    return state.sessions.filter((session) => session.result?.discomfort && !state.clinical.assessedSessionIds.includes(session.id));
}
export function underTarget(state: CampState): Session[] {
    return state.sessions.filter((session) => session.focus === state.focus && (session.templateId === "distance" || session.templateId === "counter") && session.result && resultPercent(session)! < session.target && !state.reviewedResults.includes(session.id));
}
function addEvent(state: CampState, actor: Role, title: string, detail: string): CampState {
    return { ...state, error: "", notice: title, events: [{ id: (state.events[0]?.id ?? 0) + 1, actor, title, detail }, ...state.events] };
}
function validDate(value: string) { return /^2026-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value; }
function fail(state: CampState, error: string): CampState { return { ...state, error, notice: "" }; }
function isCoach(actor: Role) { return actor === "coach"; }
export type Action =
    | { type: "reset" }
    | { type: "dismiss" }
    | { type: "goal"; actor: Role; focus: Focus; target: number }
    | { type: "add-session"; actor: Role; session: Omit<Session, "id" | "status" | "result"> }
    | { type: "result"; actor: Role; id: string; result: SessionResult }
    | { type: "adjust"; actor: Role; id: string; templateId: TemplateId; reason: string; rounds: number }
    | { type: "review-results"; actor: Role; reason: string }
    | { type: "clinical"; actor: Role; restriction: Restriction; reviewAt: string; sharedNote: string; reason: string; confirmed: boolean }
    | { type: "weight-record"; actor: Role; date: string; value: number; context: string }
    | { type: "weight-request"; actor: Role; target: number; question: string }
    | { type: "weight-decision"; actor: Role; status: "needs-info" | "reviewed"; reason: string; followUp: string };

export function campReducer(state: CampState, action: Action): CampState {
    switch (action.type) {
        case "reset": return initialCamp();
        case "dismiss": return { ...state, error: "", notice: "" };
        case "goal": {
            if (!isCoach(action.actor)) return fail(state, "HLV là người xác nhận mục tiêu huấn luyện.");
            if (!Number.isFinite(action.target) || action.target < 10 || action.target > 100) return fail(state, "Tiêu chí đạt phải từ 10% đến 100%.");
            return addEvent({ ...state, focus: action.focus, target: action.target }, action.actor, "Đã cập nhật mục tiêu cho buổi tập mới", `${focusLabels[action.focus]} · ${action.target}%. Mục tiêu của buổi cũ được giữ lại để đối chiếu.`);
        }
        case "add-session": {
            if (!isCoach(action.actor)) return fail(state, "Chỉ HLV được thêm buổi tập.");
            const session = action.session;
            if (conflicts(session.templateId, state.clinical)) return fail(state, "Giáo án xung đột với hạn chế y tế đang có hiệu lực.");
            if (!validDate(session.date) || session.date < DEMO_TODAY || session.date > "2026-10-30") return fail(state, "Chọn ngày tập từ 06/10 đến trước ngày thi đấu.");
            if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(session.time)) return fail(state, "Giờ tập chưa hợp lệ.");
            if (![session.rounds, session.work, session.rest].every(Number.isFinite) || !Number.isInteger(session.rounds) || session.rounds < 1 || session.rounds > 12 || session.work < 1 || session.work > 10 || session.rest < 0 || session.rest > 5) return fail(state, "Kiểm tra lại số hiệp, thời gian thực hiện và thời gian nghỉ.");
            const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
            const start = toMinutes(session.time);
            if (start + sessionMinutes(session) > 1440) return fail(state, "Buổi tập phải kết thúc trong cùng ngày.");
            if (state.sessions.some((other) => other.date === session.date && start < toMinutes(other.time) + sessionMinutes(other) && start + sessionMinutes(session) > toMinutes(other.time))) return fail(state, "Khung giờ này trùng một buổi tập đã có. Chọn thời điểm khác.");
            const nextSession: Session = { ...session, id: `s${Math.max(...state.sessions.map((item) => Number(item.id.slice(1)))) + 1}`, status: "planned" };
            return addEvent({ ...state, sessions: [...state.sessions, nextSession].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)) }, action.actor, "Đã đưa giáo án vào lịch", `${templates[session.templateId].name} · ${session.rounds} hiệp · ${session.date} ${session.time}. Tiêu chí: ${session.target}%.`);
        }
        case "result": {
            if (!isCoach(action.actor)) return fail(state, "HLV xác nhận kết quả chuyên môn của buổi tập.");
            const session = state.sessions.find((item) => item.id === action.id);
            if (!session || session.status !== "planned") return fail(state, "Buổi tập đã có kết quả hoặc không còn tồn tại.");
            if (session.date > DEMO_TODAY) return fail(state, "Chưa đến ngày thực hiện buổi tập này.");
            if (conflicts(session.templateId, state.clinical)) return fail(state, "Buổi tập đang xung đột với hạn chế y tế. Hãy điều chỉnh trước khi ghi nhận hoàn thành.");
            const result = action.result;
            if (![result.attempts, result.successes, result.completedRounds, result.effort].every(Number.isInteger) || result.attempts < 1 || result.attempts > 100 || result.successes < 0 || result.successes > result.attempts || result.completedRounds < 0 || result.completedRounds > session.rounds || result.effort < 1 || result.effort > 10) return fail(state, "Kết quả phải hợp lệ: số lần đạt không vượt tổng lượt; số hiệp không vượt kế hoạch.");
            if (result.discomfort && !result.note.trim()) return fail(state, "Ghi vị trí hoặc tình huống khó chịu để bác sĩ có thông tin tiếp nhận.");
            return addEvent({ ...state, sessions: state.sessions.map((item) => item.id === action.id ? { ...item, status: "completed", result } : item) }, action.actor, "Đã ghi kết quả và xác định bước tiếp theo", `${templates[session.templateId].name}: ${result.successes}/${result.attempts} lượt đạt. ${result.discomfort ? "Đã tạo việc cần bác sĩ đánh giá từ phản hồi khó chịu." : "Đã đối chiếu với mục tiêu buổi tập."}`);
        }
        case "adjust": {
            if (!isCoach(action.actor)) return fail(state, "HLV cần xác nhận thay đổi giáo án.");
            const session = state.sessions.find((item) => item.id === action.id);
            if (!session || session.status !== "planned") return fail(state, "Chỉ điều chỉnh buổi tập chưa hoàn thành.");
            if (conflicts(action.templateId, state.clinical)) return fail(state, "Phương án thay thế vẫn xung đột với hạn chế y tế.");
            if (!action.reason.trim() || !Number.isInteger(action.rounds) || action.rounds < 1 || action.rounds > session.rounds) return fail(state, "Ghi lý do và chọn số hiệp không vượt buổi gốc; muốn tăng thời lượng hãy tạo buổi mới.");
            return addEvent({ ...state, sessions: state.sessions.map((item) => item.id === action.id ? { ...item, templateId: action.templateId, original: item.original ?? item.templateId, rounds: action.rounds, reason: action.reason.trim() } : item) }, action.actor, "HLV đã điều chỉnh một buổi tập", `${templates[session.templateId].name} → ${templates[action.templateId].name}; ${session.rounds} → ${action.rounds} hiệp. Lý do: ${action.reason.trim()}`);
        }
        case "review-results": {
            if (!isCoach(action.actor) || !action.reason.trim()) return fail(state, "HLV cần ghi quyết định sau khi xem kết quả.");
            const ids = underTarget(state).map((session) => session.id);
            if (!ids.length) return fail(state, "Không còn kết quả chưa đạt cần rà soát.");
            return addEvent({ ...state, reviewedResults: [...state.reviewedResults, ...ids] }, action.actor, "Đã rà soát kết quả chưa đạt", action.reason.trim());
        }
        case "clinical": {
            if (action.actor !== "doctor") return fail(state, "Chỉ bác sĩ được cập nhật kết luận y tế.");
            if (!action.confirmed || !action.reason.trim()) return fail(state, "Bác sĩ cần xác nhận đã đánh giá và ghi căn cứ kết luận.");
            if (!validDate(action.reviewAt) || action.reviewAt < DEMO_TODAY) return fail(state, "Chọn ngày theo dõi tiếp theo từ ngày mô phỏng 06/10/2026.");
            const clinical: Clinical = { restriction: action.restriction, reviewAt: action.reviewAt, sharedNote: action.sharedNote.trim(), reason: action.reason.trim(), version: state.clinical.version + 1, assessedSessionIds: [...new Set([...state.clinical.assessedSessionIds, ...unresolvedDiscomfort(state).map((item) => item.id)])] };
            return addEvent({ ...state, clinical }, action.actor, action.restriction === "none" ? "Bác sĩ xác nhận trạng thái không hạn chế" : "Bác sĩ cập nhật hạn chế tập luyện", `${restrictions[state.clinical.restriction]} → ${restrictions[action.restriction]}. Đánh giá lại ${action.reviewAt}. Lịch tập cũ không tự khôi phục.`);
        }
        case "weight-record": {
            if (!Number.isFinite(action.value) || action.value < 30 || action.value > 200 || !validDate(action.date) || action.date > DEMO_TODAY || action.date < "2026-09-01" || !action.context.trim()) return fail(state, "Nhập số đo, ngày từ 01/09 đến 06/10 và bối cảnh cân hợp lệ.");
            const previous = state.weight.records.find((record) => record.date === action.date);
            const records = [...state.weight.records.filter((record) => record.date !== action.date), { date: action.date, value: action.value, context: action.context.trim() }].sort((a, b) => a.date.localeCompare(b.date));
            return addEvent({ ...state, weight: { ...state.weight, records } }, action.actor, previous ? "Đã sửa số đo trong ngày" : "Đã bổ sung số đo cân nặng", `${action.date} · ${previous ? `${previous.value} → ` : ""}${action.value} kg · ${action.context.trim()}. Trạng thái đánh giá mục tiêu không tự thay đổi.`);
        }
        case "weight-request": {
            if (!isCoach(action.actor) || !Number.isFinite(action.target) || action.target < 30 || action.target > 200 || !action.question.trim()) return fail(state, "HLV cần nhập mục tiêu và vấn đề cần bác sĩ đánh giá.");
            if (state.weight.status === "requested") return fail(state, "Yêu cầu hiện tại đang chờ bác sĩ xử lý.");
            return addEvent({ ...state, weight: { ...state.weight, target: action.target, question: action.question.trim(), status: "requested", decision: "", followUp: "" } }, action.actor, "Đã chuyển vấn đề cân nặng cho bác sĩ", `Mục tiêu đề xuất ${action.target} kg. ${action.question.trim()}`);
        }
        case "weight-decision": {
            if (action.actor !== "doctor" || state.weight.status !== "requested") return fail(state, "Bác sĩ xử lý yêu cầu đang chờ đánh giá.");
            if (!action.reason.trim() || !validDate(action.followUp) || action.followUp < DEMO_TODAY) return fail(state, "Ghi phản hồi chuyên môn và ngày theo dõi tiếp theo.");
            return addEvent({ ...state, weight: { ...state.weight, status: action.status, decision: action.reason.trim(), followUp: action.followUp } }, action.actor, action.status === "needs-info" ? "Bác sĩ yêu cầu bổ sung thông tin cân nặng" : "Bác sĩ đã phản hồi đánh giá mục tiêu", action.reason.trim());
        }
    }
}
