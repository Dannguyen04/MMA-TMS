"use client";

import { useState } from "react";
import { ArrowRight, Check, ClipboardCheck, Plus, Target } from "lucide-react";
import { DEMO_TODAY, conflicts, evaluationLabel, focusLabels, resultPercent, restrictions, sessionMinutes, templates, underTarget, type Focus, type Session, type TemplateId } from "./camp-state";
import { Effect, Empty, Hint, Panel, Pill, dateLabel, type WorkspaceProps } from "./camp-ui";
import s from "./prototype.module.css";
import d from "./workspace.module.css";

type Mode = "plan" | "builder" | "results";
export default function TrainingWorkspace({ state, dispatch, role, initialMode = "plan" }: WorkspaceProps & { initialMode?: Mode }) {
    const [mode, setMode] = useState<Mode>(initialMode);
    const [selectedId, setSelectedId] = useState("s3");
    const [detailMode, setDetailMode] = useState<"detail" | "result" | "adjust">("detail");
    const [focus, setFocus] = useState<Focus>(state.focus);
    const [target, setTarget] = useState(String(state.target));
    const [templateId, setTemplateId] = useState<TemplateId>("distance");
    const [rounds, setRounds] = useState("4");
    const [work, setWork] = useState("3");
    const [rest, setRest] = useState("1");
    const [date, setDate] = useState("2026-10-07");
    const [time, setTime] = useState("16:00");
    const [decision, setDecision] = useState("");
    const selected = state.sessions.find((session) => session.id === selectedId) ?? state.sessions[0];
    const lowResults = underTarget(state);
    const completed = state.sessions.filter((session) => session.status === "completed");
    const skillResults = completed.filter((session) => session.focus === state.focus && (session.templateId === "distance" || session.templateId === "counter"));
    const latestSkill = skillResults[skillResults.length - 1];
    const planned = state.sessions.filter((session) => session.status === "planned");
    const unconfirmedGoal = focus !== state.focus || Number(target) !== state.target;
    const choose = (session: Session) => { setSelectedId(session.id); setDetailMode("detail"); setMode("plan"); };

    return <div>
        <div className={d.trainingHeader}><div className={d.subtabs} style={{ marginBottom: 0 }} aria-label="Không gian HLV">
            <button className={mode === "plan" ? d.selected : ""} aria-pressed={mode === "plan"} onClick={() => setMode("plan")}>Lịch & thực hiện</button>
            <button className={mode === "builder" ? d.selected : ""} aria-pressed={mode === "builder"} onClick={() => setMode("builder")}>Thiết kế giáo án</button>
            <button className={mode === "results" ? d.selected : ""} aria-pressed={mode === "results"} onClick={() => setMode("results")}>Kết quả & điều chỉnh</button>
        </div></div>

        {mode === "builder" && <div className={d.wideGrid}>
            <div className={d.stack}><Panel eyebrow="01 · XÁC ĐỊNH VẤN ĐỀ" title="Tập để sửa điều gì?" action={<Target size={21} />}>
                <div className={d.callout}><strong>Bằng chứng gần nhất cho mục tiêu hiện tại</strong>{latestSkill ? <>{dateLabel(latestSkill.date)}: đạt {latestSkill.result!.successes}/{latestSkill.result!.attempts} tình huống; hoàn thành {latestSkill.result!.completedRounds}/{latestSkill.rounds} hiệp.<p>{latestSkill.result!.note || "Không có ghi chú bổ sung."}</p></> : "Chưa có kết quả cùng mục tiêu. HLV cần đánh giá ban đầu trước khi lựa chọn bài."}</div>
                <form className={d.form} onSubmit={(event) => { event.preventDefault(); dispatch({ type: "goal", actor: role, focus, target: Number(target) }); }}>
                    <label className={s.field}>Ưu tiên chuyên môn<select value={focus} onChange={(event) => setFocus(event.target.value as Focus)}>{Object.entries(focusLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
                    <label className={s.field}>Tiêu chí đạt do HLV đặt (%)<input type="number" min="10" max="100" step="5" required value={target} onChange={(event) => setTarget(event.target.value)} /></label>
                    <Hint>Tiêu chí đánh giá kỹ thuật do HLV lựa chọn. Mục tiêu mới áp dụng cho buổi được tạo sau khi xác nhận; kết quả cũ vẫn đối chiếu với mục tiêu tại thời điểm tập.</Hint>
                    <button className={s.outlineButton} disabled={role !== "coach"}><Check size={16} />Xác nhận mục tiêu</button>
                </form>
            </Panel><Panel eyebrow="RÀNG BUỘC ĐANG ÁP DỤNG" title="Thông tin trước khi lập bài">
                <div className={s.detailRows}><div><span>Giai đoạn chiến dịch</span><strong>Tuần 3 · Chuyển kỹ thuật vào tình huống</strong></div><div><span>Hạn chế y tế</span><strong>{restrictions[state.clinical.restriction]}</strong></div><div><span>Ngày thi đấu</span><strong>31/10/2026</strong></div><div><span>Buổi chưa thực hiện</span><strong>{planned.length} buổi</strong></div></div>
                <p className={d.inlineText}>Hệ thống kiểm tra xung đột hạn chế y tế và trùng giờ trước khi thêm lịch. HLV chịu trách nhiệm chọn nội dung và khối lượng.</p>
            </Panel></div>
            <Panel eyebrow="02 · THIẾT KẾ BUỔI TẬP" title="Chọn bài, đặt liều lượng, gắn tiêu chí">
                <form className={d.form} onSubmit={(event) => { event.preventDefault(); dispatch({ type: "add-session", actor: role, session: { date, time, templateId, rounds: Number(rounds), work: Number(work), rest: Number(rest), focus: state.focus, target: state.target } }); }}>
                    <div className={d.templateChoices}>{Object.entries(templates).map(([id, item]) => <button type="button" className={id === templateId ? d.selected : ""} aria-pressed={id === templateId} key={id} onClick={() => setTemplateId(id as TemplateId)}><span>{item.category}{conflicts(id as TemplateId, state.clinical) ? " · Có hạn chế" : ""}</span><strong>{item.name}</strong><p>{item.purpose}</p>{id === templateId && <Check size={16} />}</button>)}</div>
                    <div className={d.callout}><strong>Vì sao cân nhắc bài này?</strong>{templates[templateId].rationale}{templateId === "counter" && lowResults.length >= 2 && <p>Đang có {lowResults.length} buổi chưa đạt cần xem lại. HLV nên rà soát bằng chứng trước khi tăng độ phức tạp.</p>}</div>
                    <DrillSteps templateId={templateId} />
                    <div className={d.formThree}><label className={s.field}>Số hiệp<input type="number" min="1" max="12" required value={rounds} onChange={(event) => setRounds(event.target.value)} /></label><label className={s.field}>Thực hiện / hiệp (phút)<input type="number" min="1" max="10" required value={work} onChange={(event) => setWork(event.target.value)} /></label><label className={s.field}>Nghỉ giữa hiệp (phút)<input type="number" min="0" max="5" step="0.5" required value={rest} onChange={(event) => setRest(event.target.value)} /></label></div>
                    <div className={d.factGrid}><div className={d.fact}><span>Khối lượng phần chính</span><strong>{sessionMinutes({ rounds: Number(rounds), work: Number(work), rest: Number(rest) })} phút</strong></div><div className={d.fact}><span>Tiêu chí buổi mới</span><strong>{state.target}% tình huống đạt</strong></div></div>
                    <div className={d.formRow}><label className={s.field}>Ngày thực hiện<input type="date" min={DEMO_TODAY} max="2026-10-30" required value={date} onChange={(event) => setDate(event.target.value)} /></label><label className={s.field}>Giờ bắt đầu<input type="time" required value={time} onChange={(event) => setTime(event.target.value)} /></label></div>
                    {conflicts(templateId, state.clinical) && <div className={d.warning}>Không thể thêm: {restrictions[state.clinical.restriction]}. Chọn bài phù hợp hoặc chờ kết luận mới từ bác sĩ.</div>}
                    <Effect>Buổi tập có bài cụ thể, khối lượng, tiêu chí và mốc thực hiện. Kết quả sau tập được đối chiếu với chính mục tiêu này.</Effect>
                    {unconfirmedGoal && <div className={d.warning}>Mục tiêu vừa sửa chưa được xác nhận. Bấm “Xác nhận mục tiêu” trước khi đưa giáo án vào lịch.</div>}
                    <button className={s.primaryButton} disabled={role !== "coach" || conflicts(templateId, state.clinical) || unconfirmedGoal}><Plus size={16} />Đưa giáo án vào lịch</button>
                    <p className={d.inlineText}>Mẫu minh họa cấu trúc giáo án. Nội dung và liều lượng cần HLV chuyên môn thẩm định.</p>
                </form>
            </Panel>
        </div>}

        {mode === "plan" && <div className={d.wideGrid}>
            <Panel eyebrow="03 — 08 THÁNG 10" title="Chọn buổi để làm việc" action={<Pill>{state.sessions.length} buổi</Pill>}>
                {state.sessions.map((session) => <button key={session.id} className={`${d.sessionCard} ${selected.id === session.id ? d.sessionSelected : ""}`} aria-pressed={selected.id === session.id} onClick={() => choose(session)}><div><small>{dateLabel(session.date)} · {session.time}</small><Pill tone={session.status === "completed" ? "green" : conflicts(session.templateId, state.clinical) ? "amber" : "neutral"}>{session.status === "completed" ? `${resultPercent(session)}% đạt` : conflicts(session.templateId, state.clinical) ? "Cần điều chỉnh" : "Đã lên lịch"}</Pill></div><strong>{templates[session.templateId].name}</strong><small>{session.rounds} hiệp × {session.work} phút · Nghỉ {session.rest} phút · Mục tiêu {session.target}%</small>{session.original && <span>Đã thay từ: {templates[session.original].name}</span>}</button>)}
                <button className={s.textButton} onClick={() => setMode("builder")}><Plus size={15} />Thiết kế buổi tập mới</button>
            </Panel>
            <div className={d.stack}><Panel eyebrow={`${dateLabel(selected.date)} · ${selected.time}`} title={templates[selected.templateId].name} action={<Pill>{templates[selected.templateId].category}</Pill>}>
                <div className={d.subtabs}><button className={detailMode === "detail" ? d.selected : ""} onClick={() => setDetailMode("detail")}>Giáo án chi tiết</button>{selected.status === "planned" && <><button className={detailMode === "result" ? d.selected : ""} onClick={() => setDetailMode("result")}>Ghi kết quả</button><button className={detailMode === "adjust" ? d.selected : ""} onClick={() => setDetailMode("adjust")}>Điều chỉnh</button></>}</div>
                {detailMode === "detail" && <>
                    <div className={d.factGrid}><div className={d.fact}><span>Tiêu chí quan sát buổi tập</span><strong>{evaluationLabel(selected)}</strong></div><div className={d.fact}><span>Đạt khi</span><strong>≥ {selected.target}% tình huống đạt tiêu chí</strong></div><div className={d.fact}><span>Khối lượng phần chính</span><strong>{selected.rounds} × {selected.work} phút · Nghỉ {selected.rest} phút</strong></div><div className={d.fact}><span>Tổng phần chính và nghỉ</span><strong>{sessionMinutes(selected)} phút</strong></div></div>
                    <DrillSteps templateId={selected.templateId} />
                    {selected.reason && <div className={d.callout}><strong>Lý do HLV điều chỉnh</strong>{selected.reason}</div>}
                    {selected.result ? <ResultSummary session={selected} /> : <>
                        {conflicts(selected.templateId, state.clinical) && <div className={d.warning}>{restrictions[state.clinical.restriction]}. Cần chọn phương án phù hợp trước khi ghi hoàn thành.</div>}
                        <div className={s.buttonRow}>{role === "coach" && <><button className={s.primaryButton} onClick={() => setDetailMode("result")}><ClipboardCheck size={16} />Ghi kết quả buổi tập</button><button className={s.outlineButton} onClick={() => setDetailMode("adjust")}>Xem phương án điều chỉnh</button></>}</div>
                    </>}
                </>}
                {detailMode === "result" && <ResultForm key={selected.id} session={selected} state={state} role={role} dispatch={dispatch} />}
                {detailMode === "adjust" && <AdjustmentForm key={`${selected.id}-${selected.templateId}`} session={selected} state={state} role={role} dispatch={dispatch} />}
            </Panel><Hint>Ngày mô phỏng: 06/10/2026. Chọn buổi hôm nay để thử ghi kết quả. Không thể ghi hoàn thành cho buổi trong tương lai hoặc đang xung đột với hạn chế y tế.</Hint></div>
        </div>}

        {mode === "results" && <div className={d.grid}><div className={d.stack}>
            <Panel eyebrow="03 · ĐO CHẤT LƯỢNG, KHÔNG CHỈ ĐẾM BUỔI" title="Kỹ thuật có thực sự tiến bộ?">
                <p className={d.inlineText}>{focusLabels[state.focus]}. Chỉ so sánh các buổi kỹ thuật/đối kháng cùng mục tiêu; bài chiến thuật và thể lực được xem riêng.</p>
                <div className={d.resultBars}>{skillResults.slice(-6).map((session) => <div className={d.resultBar} key={session.id}><strong>{resultPercent(session)}%</strong><div className={resultPercent(session)! >= session.target ? d.barPass : ""} style={{ height: `${resultPercent(session)}px` }} /><span>{dateLabel(session.date).slice(0, 5)}</span><small>Mục tiêu {session.target}%</small></div>)}</div>
                <div className={d.callout}><strong>{lowResults.length ? `${lowResults.length} buổi chưa đạt cần HLV rà soát` : "Không còn kết quả chưa đạt chưa được rà soát"}</strong>Tập đủ số hiệp phản ánh việc thực hiện kế hoạch. Tỷ lệ tình huống đạt phản ánh chất lượng kỹ thuật. Hai chỉ số được theo dõi riêng.</div>
                {completed.map((session) => <button className={d.sessionCard} key={session.id} onClick={() => choose(session)}><div><small>{dateLabel(session.date)} · {templates[session.templateId].category}</small><Pill tone={resultPercent(session)! >= session.target ? "green" : "amber"}>{resultPercent(session)! >= session.target ? "Đạt tiêu chí" : "Chưa đạt"}</Pill></div><strong>{templates[session.templateId].name}</strong><small>{session.result!.completedRounds}/{session.rounds} hiệp · {session.result!.successes}/{session.result!.attempts} tình huống đạt · Gắng sức tự báo {session.result!.effort}/10</small></button>)}
            </Panel>
        </div><div className={d.stack}><Panel eyebrow="04 · QUYẾT ĐỊNH DỰA TRÊN KẾT QUẢ" title="Buổi tới cần thay đổi gì?">
            <div className={d.steps}><div><span>1</span><div><strong>Xem lại nguyên nhân</strong><p>Kỹ năng chưa ổn định, bài quá phức tạp hay võ sĩ chưa hoàn thành được khối lượng? Đối chiếu ghi chú từng buổi.</p></div></div><div><span>2</span><div><strong>Chỉnh một buổi cụ thể</strong><p>Đổi bài hoặc giảm số hiệp, giữ lại mục tiêu đánh giá để có thể so sánh sau điều chỉnh.</p></div></div><div><span>3</span><div><strong>Ghi quyết định và kiểm tra lại</strong><p>Có thể giữ kế hoạch nếu HLV có căn cứ; quyết định phải có lý do và xuất hiện trong lịch sử.</p></div></div></div>
            {planned.map((session) => <button key={session.id} className={d.sessionCard} onClick={() => { setSelectedId(session.id); setDetailMode("adjust"); setMode("plan"); }}><div><strong>{dateLabel(session.date).slice(0, 5)} · {templates[session.templateId].name}</strong><ArrowRight size={16} /></div><small>{session.rounds} hiệp · {conflicts(session.templateId, state.clinical) ? "Có xung đột y tế" : "Có thể xem phương án"}</small></button>)}
            {role === "coach" && lowResults.length > 0 && <form className={d.form} onSubmit={(event) => { event.preventDefault(); dispatch({ type: "review-results", actor: role, reason: decision }); }}><label className={s.field}>Kết luận sau khi rà soát<textarea required minLength={5} rows={3} value={decision} onChange={(event) => setDecision(event.target.value)} placeholder="Ví dụ: giữ mục tiêu, giảm độ phức tạp ở buổi 08/10; kiểm tra lại 10 tình huống cuối buổi." /></label><button className={s.outlineButton}><Check size={16} />Xác nhận đã rà soát {lowResults.length} buổi</button></form>}
            {!lowResults.length && <Empty>Kết quả đã được rà soát. Buổi mới chưa đạt sẽ tạo việc cần xử lý tiếp theo.</Empty>}
        </Panel><Hint>Hệ thống nêu bằng chứng và điều kiện xung đột. Việc tăng tải, chọn bài và đánh giá mức sẵn sàng vẫn do HLV quyết định.</Hint></div></div>}
    </div>;
}

function DrillSteps({ templateId }: { templateId: TemplateId }) {
    return <div className={d.steps}>{templates[templateId].steps.map((step, index) => <div key={step.name}><span>{index + 1}</span><div><strong>{step.name}</strong><p>{step.detail}</p></div></div>)}</div>;
}
function ResultSummary({ session }: { session: Session }) {
    const result = session.result!;
    return <><div className={d.divider} /><div className={d.factGrid}><div className={d.fact}><span>Hoàn thành khối lượng</span><strong>{result.completedRounds}/{session.rounds} hiệp</strong></div><div className={d.fact}><span>Chất lượng thực tế</span><strong>{resultPercent(session)}% · Mục tiêu {session.target}%</strong></div><div className={d.fact}><span>Gắng sức tự báo</span><strong>{result.effort}/10</strong></div><div className={d.fact}><span>Phản hồi sau buổi tập</span><strong>{result.discomfort ? "Có khó chịu · Cần bác sĩ xem" : "Không ghi nhận khó chịu"}</strong></div></div><div className={d.callout}><strong>Ghi chú HLV</strong>{result.note || "Không có ghi chú thêm."}</div></>;
}
function ResultForm({ session, state, dispatch, role }: WorkspaceProps & { session: Session }) {
    const [completedRounds, setCompletedRounds] = useState(String(session.rounds));
    const [successes, setSuccesses] = useState("6");
    const [attempts, setAttempts] = useState("10");
    const [effort, setEffort] = useState("7");
    const [discomfort, setDiscomfort] = useState(false);
    const [note, setNote] = useState("");
    const blocked = conflicts(session.templateId, state.clinical) || session.date > DEMO_TODAY || role !== "coach";
    if (session.result) return <ResultSummary session={session} />;
    return <form className={d.form} onSubmit={(event) => { event.preventDefault(); dispatch({ type: "result", actor: role, id: session.id, result: { completedRounds: Number(completedRounds), successes: Number(successes), attempts: Number(attempts), effort: Number(effort), discomfort, note } }); }}>
        <div className={d.callout}><strong>Đang đánh giá: {evaluationLabel(session)}</strong>Ghi số tình huống đạt tiêu chí, không suy ra chất lượng từ việc tập đủ thời gian.</div>
        <div className={d.formThree}><label className={s.field}>Hiệp hoàn thành<input type="number" min="0" max={session.rounds} required value={completedRounds} onChange={(event) => setCompletedRounds(event.target.value)} /></label><label className={s.field}>Số tình huống đạt<input type="number" min="0" max={Number(attempts)} required value={successes} onChange={(event) => setSuccesses(event.target.value)} /></label><label className={s.field}>Tổng tình huống kiểm tra<input type="number" min="1" max="100" required value={attempts} onChange={(event) => setAttempts(event.target.value)} /></label></div>
        <label className={s.field}>Mức gắng sức võ sĩ tự báo: {effort}/10<input type="range" min="1" max="10" value={effort} onChange={(event) => setEffort(event.target.value)} /></label>
        <label className={d.checkRow}><input type="checkbox" checked={discomfort} onChange={(event) => setDiscomfort(event.target.checked)} /><span>Võ sĩ có phản hồi khó chịu hoặc đau sau buổi tập</span></label>
        <label className={s.field}>{discomfort ? "Mô tả vị trí / tình huống cần bác sĩ xem" : "Quan sát của HLV (không bắt buộc)"}<textarea rows={3} required={discomfort} maxLength={600} value={note} onChange={(event) => setNote(event.target.value)} placeholder={discomfort ? "Ví dụ dữ liệu mẫu: khó chịu vùng vai trong hiệp cuối." : "Điểm nào chưa ổn định? Có cần nhắc kỹ thuật liên tục không?"} /></label>
        <div className={d.factGrid}><div className={d.fact}><span>Tỷ lệ dự kiến</span><strong>{Number(attempts) > 0 ? Math.round(Number(successes) / Number(attempts) * 100) : 0}%</strong></div><div className={d.fact}><span>Tiêu chí cần đạt</span><strong>{session.target}%</strong></div></div>
        <Effect>{discomfort ? "Tạo việc cho bác sĩ từ phản hồi khó chịu, đồng thời cập nhật kết quả kỹ thuật. Không tự chẩn đoán hoặc tự tạo hạn chế y tế." : "Cập nhật tiến bộ; nếu chưa đạt tiêu chí, tạo việc cho HLV xem lại kế hoạch."}</Effect>
        {blocked && <div className={d.warning}>{session.date > DEMO_TODAY ? "Chưa đến ngày thực hiện. Chọn buổi 06/10 để thử luồng." : role !== "coach" ? "Cần HLV xác nhận kết quả." : "Giáo án đang xung đột với hạn chế y tế. Chuyển sang Điều chỉnh trước."}</div>}
        <button className={s.primaryButton} disabled={blocked}><Check size={16} />Lưu kết quả & xem bước tiếp theo</button>
    </form>;
}
function AdjustmentForm({ session, state, dispatch, role }: WorkspaceProps & { session: Session }) {
    const [replacement, setReplacement] = useState<TemplateId>(conflicts(session.templateId, state.clinical) ? "tactics" : "distance");
    const [rounds, setRounds] = useState(String(session.rounds));
    const [reason, setReason] = useState("");
    return <form className={d.form} onSubmit={(event) => { event.preventDefault(); dispatch({ type: "adjust", actor: role, id: session.id, templateId: replacement, rounds: Number(rounds), reason }); }}>
        <Hint>{conflicts(session.templateId, state.clinical) ? `Thông tin từ bác sĩ: ${restrictions[state.clinical.restriction]}. ${state.clinical.sharedNote}` : "HLV có thể giữ mục tiêu, chọn bài ít phức tạp hơn hoặc giảm khối lượng để kiểm tra lại chất lượng."}</Hint>
        <label className={s.field}>Phương án cho buổi này<select value={replacement} onChange={(event) => setReplacement(event.target.value as TemplateId)}>{Object.entries(templates).map(([id, template]) => <option key={id} value={id} disabled={conflicts(id as TemplateId, state.clinical)}>{template.name}{conflicts(id as TemplateId, state.clinical) ? " · Không phù hợp hạn chế" : ""}</option>)}</select></label>
        <label className={s.field}>Số hiệp sau điều chỉnh<input type="number" min="1" max={session.rounds} required value={rounds} onChange={(event) => setRounds(event.target.value)} /></label>
        <div className={d.comparison}><div><small>TRƯỚC</small><strong>{templates[session.templateId].name}<br />{session.rounds} hiệp</strong></div><ArrowRight size={20} /><div><small>SAU</small><strong>{templates[replacement].name}<br />{rounds} hiệp</strong></div></div>
        <label className={s.field}>Lý do và điểm cần kiểm tra ở buổi sau<textarea rows={3} required minLength={5} maxLength={600} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: quay lại bài trên đích vì 2 buổi chưa thoát góc ổn định. Giữ tiêu chí 80% để đánh giá lại." /></label>
        <Effect>Chỉ thay đổi buổi {dateLabel(session.date)} lúc {session.time}. Lưu bài gốc, phương án mới và lý do; các buổi khác giữ nguyên.</Effect>
        <button className={s.primaryButton} disabled={role !== "coach" || conflicts(replacement, state.clinical)}><Check size={16} />Xác nhận thay đổi buổi này</button>
    </form>;
}
