"use client";

import { useState } from "react";
import { Check, HeartPulse, Plus, Scale } from "lucide-react";
import { DEMO_TODAY, conflicts, restrictions, templates, unresolvedDiscomfort, type Restriction } from "./camp-state";
import { Effect, Empty, Hint, Panel, Pill, dateLabel, type WorkspaceProps } from "./camp-ui";
import s from "./prototype.module.css";
import d from "./workspace.module.css";

export function CareWorkspace({ state, dispatch, role }: WorkspaceProps) {
    const [restriction, setRestriction] = useState<Restriction>(state.clinical.restriction === "none" ? "contact" : state.clinical.restriction);
    const [reviewAt, setReviewAt] = useState("2026-10-09");
    const [reason, setReason] = useState("");
    const [sharedNote, setSharedNote] = useState("");
    const [confirmed, setConfirmed] = useState(false);
    const reports = unresolvedDiscomfort(state);
    const affected = state.sessions.filter((session) => session.status === "planned" && conflicts(session.templateId, { ...state.clinical, restriction }));
    return <div className={d.grid}><div className={d.stack}>
        <Panel eyebrow="ĐẦU VÀO TỪ HUẤN LUYỆN" title="Bác sĩ có sẵn bối cảnh" action={<HeartPulse size={20} />}>
            <div className={d.factGrid}><div className={d.fact}><span>Võ sĩ</span><strong>Nguyễn Minh Khang · 24 tuổi</strong></div><div className={d.fact}><span>Chiến dịch</span><strong>Thi đấu ngày 31/10/2026</strong></div><div className={d.fact}><span>Trạng thái hiện tại</span><strong>{restrictions[state.clinical.restriction]}</strong></div><div className={d.fact}><span>Mốc theo dõi</span><strong>{dateLabel(state.clinical.reviewAt)}</strong></div></div>
            <div className={d.divider} /><h3 className={d.noteHeading}>Phản hồi sau tập cần đánh giá</h3>
            {reports.length ? reports.map((session) => <div className={d.callout} key={session.id}><strong>{dateLabel(session.date)} · {templates[session.templateId].name}</strong>{session.result!.note}<p>Hoàn thành {session.result!.completedRounds}/{session.rounds} hiệp · Gắng sức tự báo {session.result!.effort}/10</p></div>) : <Empty>Chưa có phản hồi khó chịu chưa được xử lý. Thử ghi kết quả buổi 06/10 với lựa chọn có khó chịu để tạo việc cho bác sĩ.</Empty>}
            <Hint>Phản hồi sau tập là thông tin tiếp nhận, không phải chẩn đoán. HLV nhận hạn chế và lưu ý tổ chức tập luyện; căn cứ khám chi tiết chỉ hiện trong góc nhìn bác sĩ của bản mẫu.</Hint>
        </Panel>
        {state.clinical.version > 0 && <Panel eyebrow={`KẾT LUẬN PHIÊN BẢN ${state.clinical.version}`} title="Thông tin HLV cần thực hiện"><Pill tone={state.clinical.restriction === "none" ? "green" : "amber"}>{restrictions[state.clinical.restriction]}</Pill><div className={d.callout}><strong>Lưu ý tổ chức tập luyện</strong>{state.clinical.sharedNote || "Không có lưu ý bổ sung."}</div>{role === "doctor" && <div className={d.callout}><strong>Căn cứ đánh giá của bác sĩ</strong>{state.clinical.reason}</div>}<p className={d.inlineText}>Mốc đánh giá lại: {dateLabel(state.clinical.reviewAt)}. Hạn chế không tự hết hiệu lực theo ngày; cần kết luận mới từ bác sĩ.</p></Panel>}
    </div><Panel eyebrow="KẾT LUẬN → TÁC ĐỘNG LÊN LỊCH" title={state.clinical.version ? "Đánh giá lại & cập nhật hạn chế" : "Ghi kết luận sau khi đã đánh giá"}>
        {role === "doctor" ? <form className={d.form} onSubmit={(event) => { event.preventDefault(); dispatch({ type: "clinical", actor: role, restriction, reviewAt, reason, sharedNote, confirmed }); }}>
            <label className={d.checkRow}><input type="checkbox" required checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>Đã kiểm tra thông tin nền và thực hiện đánh giá trong tình huống mô phỏng</span></label>
            <label className={s.field}>Kết luận về việc tập luyện<select value={restriction} onChange={(event) => setRestriction(event.target.value as Restriction)}>{Object.entries(restrictions).map(([id, label]) => <option key={id} value={id}>{id === "none" ? "Xác nhận không còn hạn chế" : label}</option>)}</select></label>
            <label className={s.field}>Căn cứ của lần đánh giá này<textarea required rows={3} maxLength={600} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Nhập nhận định mẫu sau đánh giá; không tự sao chép kết luận lần trước." /></label>
            <label className={s.field}>Thông tin cần HLV biết<textarea rows={2} maxLength={400} value={sharedNote} onChange={(event) => setSharedNote(event.target.value)} placeholder="Giới hạn áp dụng hoặc lưu ý khi tổ chức buổi tập." /></label>
            <label className={s.field}>Ngày theo dõi / đánh giá tiếp theo<input type="date" min={DEMO_TODAY} max="2026-12-31" required value={reviewAt} onChange={(event) => setReviewAt(event.target.value)} /></label>
            <div className={d.callout}><strong>Xem trước ảnh hưởng: {affected.length} buổi cần HLV xem lại</strong>{affected.length ? affected.map((session) => <p key={session.id}>{dateLabel(session.date).slice(0, 5)} · {templates[session.templateId].name}</p>) : "Không có buổi đang lên lịch xung đột với kết luận này."}</div>
            <Effect>{restriction === "none" ? "Gỡ hạn chế đang áp dụng và ghi lịch sử. Các buổi đã điều chỉnh không tự trở về giáo án cũ; HLV tự xem xét kế hoạch tiếp theo." : "Ghi hạn chế, đánh dấu buổi xung đột và tạo việc cho HLV. Các phản hồi khó chịu hiện tại được ghi là đã được bác sĩ xem."}</Effect>
            <button className={s.primaryButton}><Check size={16} />Xác nhận kết luận mẫu</button>
        </form> : <Empty>Chuyển sang góc nhìn Bác sĩ ở thanh trên để thử tiếp nhận phản hồi, cập nhật hạn chế hoặc tái đánh giá. HLV không thể sửa kết luận y tế.</Empty>}
    </Panel></div>;
}

export function WeightWorkspace({ state, dispatch, role }: WorkspaceProps) {
    const [value, setValue] = useState("");
    const [date, setDate] = useState(DEMO_TODAY);
    const [context, setContext] = useState("Buổi sáng");
    const [target, setTarget] = useState(String(state.weight.target));
    const [question, setQuestion] = useState(state.weight.question);
    const [decision, setDecision] = useState("");
    const [decisionType, setDecisionType] = useState<"needs-info" | "reviewed">("needs-info");
    const [followUp, setFollowUp] = useState("2026-10-09");
    const weight = state.weight;
    const latest = weight.records[weight.records.length - 1];
    const shown = weight.records.slice(-8);
    const low = Math.min(...shown.map((item) => item.value)) - .5;
    const high = Math.max(...shown.map((item) => item.value)) + .5;
    const y = (amount: number) => 130 - ((amount - low) / (high - low)) * 110;
    const x = (index: number) => 35 + index * (420 / Math.max(1, shown.length - 1));
    const statusLabels = { draft: "Chưa gửi đánh giá", requested: "Chờ bác sĩ", "needs-info": "Cần bổ sung", reviewed: "Đã có phản hồi" };
    return <div className={d.grid}><div className={d.stack}><Panel eyebrow="THEO DÕI THỂ TRẠNG" title="Một số đo, đủ bối cảnh" action={<Scale size={20} />}>
        <div className={s.weightSummary}><div><strong>{latest.value.toLocaleString("vi-VN")}<small> kg</small></strong><span>{dateLabel(latest.date)} · {latest.context}</span></div><Pill tone="amber">Mục tiêu đề xuất {weight.target} kg</Pill></div>
        <div className={d.smallChart}><svg viewBox="0 0 490 170" role="img" aria-label={`Diễn biến cân nặng, mới nhất ${latest.value} kg`}>
            {[low, (low + high) / 2, high].map((tick) => <g key={tick}><line x1="32" x2="470" y1={y(tick)} y2={y(tick)} stroke="var(--border)" strokeDasharray="3 4" /><text x="0" y={y(tick) + 4}>{tick.toFixed(1)}</text></g>)}
            <polyline points={shown.map((item, index) => `${x(index)},${y(item.value)}`).join(" ")} fill="none" stroke="var(--primary)" strokeWidth="3" />{shown.map((item, index) => <g key={item.date}><circle cx={x(index)} cy={y(item.value)} r="4" fill="var(--surface)" stroke="var(--primary)" strokeWidth="2" /><text x={x(index)} y="161" textAnchor="middle">{dateLabel(item.date).slice(0, 5)}</text><title>{`${item.date}: ${item.value} kg`}</title></g>)}
        </svg></div>
        <form className={d.form} onSubmit={(event) => { event.preventDefault(); dispatch({ type: "weight-record", actor: role, date, value: Number(value), context }); }}><div className={d.formRow}><label className={s.field}>Cân nặng (kg)<input type="number" min="30" max="200" step="0.1" required value={value} onChange={(event) => setValue(event.target.value)} placeholder="72.1" /></label><label className={s.field}>Ngày cân<input type="date" min="2026-09-01" max={DEMO_TODAY} required value={date} onChange={(event) => setDate(event.target.value)} /></label></div><label className={s.field}>Bối cảnh cân<select value={context} onChange={(event) => setContext(event.target.value)}><option>Buổi sáng</option><option>Trước buổi tập</option><option>Sau buổi tập</option><option>Khác / chưa rõ</option></select></label><p className={d.inlineText}>Mỗi ngày có một số đo. Lưu lại cùng ngày sẽ thay số đo trước và ghi lịch sử chỉnh sửa.</p><button className={s.outlineButton}><Plus size={16} />Lưu số đo & bối cảnh</button></form>
    </Panel><Panel title="Lịch sử để đối chiếu"><div className={d.tableWrap}><table className={d.weightTable}><thead><tr><th>Ngày</th><th>Số đo</th><th>Bối cảnh</th></tr></thead><tbody>{[...weight.records].reverse().map((item) => <tr key={item.date}><td>{dateLabel(item.date)}</td><td>{item.value.toLocaleString("vi-VN")} kg</td><td>{item.context}</td></tr>)}</tbody></table></div></Panel></div>
    <div className={d.stack}><Panel eyebrow="ĐẦU VÀO CHO QUYẾT ĐỊNH HUẤN LUYỆN" title="Mục tiêu cần trao đổi chuyên môn" action={<Pill tone={weight.status === "reviewed" ? "green" : "amber"}>{statusLabels[weight.status]}</Pill>}>
        <div className={d.statusRail}>{["HLV nêu vấn đề", "Bác sĩ đánh giá", "HLV cập nhật kế hoạch"].map((label, index) => <span className={(weight.status === "draft" ? 0 : weight.status === "requested" ? 1 : 2) === index ? d.current : ""} key={label}>{index + 1}. {label}</span>)}</div>
        <Hint>Ngày cân chính thức: {dateLabel(weight.weighIn)}. Chênh lệch với mục tiêu chỉ là thông tin cần đánh giá; hệ thống không tự đưa phác đồ ép cân hoặc tự tăng tải tập.</Hint>
        {weight.question && <div className={d.callout}><strong>HLV cần hỗ trợ</strong>{weight.question}</div>}
        {weight.decision && <div className={d.callout}><strong>Phản hồi từ bác sĩ · Theo dõi {dateLabel(weight.followUp)}</strong>{weight.decision}</div>}
        <div className={d.divider} />
        {role === "coach" && weight.status !== "requested" && <form className={d.form} onSubmit={(event) => { event.preventDefault(); dispatch({ type: "weight-request", actor: role, target: Number(target), question }); }}><label className={s.field}>Hạng cân / mục tiêu đang đề xuất (kg)<input type="number" min="30" max="200" required step="0.1" value={target} onChange={(event) => setTarget(event.target.value)} /></label><label className={s.field}>{weight.status === "needs-info" ? "Thông tin bổ sung theo yêu cầu bác sĩ" : "Vấn đề cần bác sĩ đánh giá"}<textarea required rows={4} maxLength={600} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Mục tiêu thi đấu, diễn biến số đo hoặc vấn đề HLV cần thống nhất với bác sĩ…" /></label><Effect>Chuyển câu hỏi cùng lịch sử số đo cho bác sĩ. Phản hồi sẽ trở lại cùng hồ sơ để HLV xem trước khi điều chỉnh kế hoạch.</Effect><button className={s.primaryButton}>Gửi yêu cầu đánh giá mẫu</button></form>}
        {role === "coach" && weight.status === "requested" && <Empty>Đang chờ bác sĩ phản hồi. Chuyển góc nhìn Bác sĩ để thử nhánh yêu cầu bổ sung thông tin.</Empty>}
        {role === "doctor" && weight.status === "requested" && <form className={d.form} onSubmit={(event) => { event.preventDefault(); dispatch({ type: "weight-decision", actor: role, status: decisionType, reason: decision, followUp }); }}><label className={s.field}>Kết quả xử lý<select value={decisionType} onChange={(event) => setDecisionType(event.target.value as "needs-info" | "reviewed")}><option value="needs-info">Cần HLV bổ sung thông tin</option><option value="reviewed">Đã đánh giá và gửi phản hồi</option></select></label><label className={s.field}>Nội dung phản hồi<textarea required rows={4} value={decision} onChange={(event) => setDecision(event.target.value)} /></label><label className={s.field}>Ngày theo dõi tiếp theo<input type="date" min={DEMO_TODAY} required value={followUp} onChange={(event) => setFollowUp(event.target.value)} /></label><button className={s.primaryButton}><Check size={16} />Gửi phản hồi mẫu cho HLV</button></form>}
        {role === "doctor" && weight.status !== "requested" && <Empty>{weight.status === "draft" ? "HLV chưa gửi vấn đề cần đánh giá." : "Đã phản hồi. Chờ HLV xem hoặc bổ sung thông tin."}</Empty>}
    </Panel></div></div>;
}
