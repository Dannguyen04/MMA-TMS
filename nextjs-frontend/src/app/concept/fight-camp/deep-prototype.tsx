"use client";

import Link from "next/link";
import { useReducer, useState } from "react";
import { Activity, ArrowRight, Check, ChevronRight, ClipboardCheck, Dumbbell, Flag, HeartPulse, History, LayoutDashboard, RotateCcw, Scale, ShieldCheck, Sparkles, Stethoscope, Target, Trophy, X } from "lucide-react";
import { campReducer, conflicts, focusLabels, initialCamp, resultPercent, restrictions, roles, underTarget, unresolvedDiscomfort, type Role } from "./camp-state";
import { ArrowLabel, Empty, Panel, Pill, dateLabel } from "./camp-ui";
import TrainingWorkspace from "./training-workspace";
import { CareWorkspace, WeightWorkspace } from "./support-workspace";
import s from "./prototype.module.css";
import d from "./workspace.module.css";

type Tab = "overview" | "training" | "weight" | "medical" | "history";
const navigation = [
    { id: "overview" as const, label: "Việc cần xử lý", icon: LayoutDashboard },
    { id: "training" as const, label: "Huấn luyện chuyên môn", icon: Dumbbell },
    { id: "weight" as const, label: "Cân nặng & mục tiêu", icon: Scale },
    { id: "medical" as const, label: "Phối hợp bác sĩ", icon: HeartPulse },
    { id: "history" as const, label: "Lịch sử quyết định", icon: History },
];

export default function DeepPrototype() {
    const [state, dispatch] = useReducer(campReducer, undefined, initialCamp);
    const [tab, setTab] = useState<Tab>("overview");
    const [role, setRole] = useState<Role>("coach");
    const [trainingIntent, setTrainingIntent] = useState<"plan" | "builder" | "results">("plan");
    const [resetConfirm, setResetConfirm] = useState(false);
    const lowResults = underTarget(state);
    const reports = unresolvedDiscomfort(state);
    const blocked = state.sessions.filter((session) => session.status === "planned" && conflicts(session.templateId, state.clinical));
    const planned = state.sessions.filter((session) => session.status === "planned");
    const skillResults = state.sessions.filter((session) => session.status === "completed" && session.focus === state.focus && (session.templateId === "distance" || session.templateId === "counter"));
    const latestResult = skillResults[skillResults.length - 1];
    const tasks: { title: string; evidence: string; owner: string; action: string; click: () => void }[] = [];
    function openTraining(mode: "plan" | "builder" | "results") { setTrainingIntent(mode); setTab("training"); }
    function changeRole(next: Role) { setRole(next); setTab(next === "doctor" ? "medical" : "overview"); }
    if (reports.length) tasks.push({ title: "Có phản hồi khó chịu sau tập cần bác sĩ xem", evidence: `${reports.length} buổi có phản hồi chưa được đánh giá. Bác sĩ nhận được bài tập, mức hoàn thành và ghi chú cùng hồ sơ.`, owner: "BS. Mai Anh", action: "Xem phản hồi", click: () => setTab("medical") });
    if (blocked.length) tasks.push({ title: `${blocked.length} buổi tập xung đột với hạn chế y tế`, evidence: `${restrictions[state.clinical.restriction]}. Chọn phương án thay thế cho từng buổi và ghi lý do trước khi xác nhận.`, owner: "HLV Quốc Tuấn", action: "Điều chỉnh từng buổi", click: () => openTraining("plan") });
    if (lowResults.length) tasks.push({ title: `${lowResults.length} buổi chưa đạt mục tiêu kỹ thuật`, evidence: "Đủ số hiệp chưa đồng nghĩa đạt chất lượng. Xem tỷ lệ tình huống đạt và ghi chú để quyết định bài tập tiếp theo.", owner: "HLV Quốc Tuấn", action: "Phân tích kết quả", click: () => openTraining("results") });
    if (state.weight.status !== "reviewed") tasks.push({ title: state.weight.status === "needs-info" ? "Bác sĩ cần bổ sung thông tin về cân nặng" : state.weight.status === "requested" ? "Mục tiêu cân nặng đang chờ bác sĩ phản hồi" : "Mục tiêu hạng cân chưa được trao đổi chuyên môn", evidence: state.weight.decision || `Mục tiêu đang đề xuất ${state.weight.target} kg; cân chính thức ngày ${dateLabel(state.weight.weighIn)}. Cần thống nhất trước khi thay kế hoạch.`, owner: state.weight.status === "requested" ? "BS. Mai Anh" : "HLV Quốc Tuấn", action: "Xử lý mục tiêu cân nặng", click: () => setTab("weight") });

    return <div className={s.app} lang="vi">
        <aside className={s.sidebar}>
            <div className={s.brand}><div className={s.brandMark}><Activity size={25} /></div><div>FIGHT<span>CAMP</span><small>MMA TRAINING SYSTEM</small></div></div>
            <div className={s.workspaceLabel}>KHÔNG GIAN CHUYÊN MÔN</div>
            <nav aria-label="Điều hướng bản chuyên sâu">{navigation.map(({ id, label, icon: Icon }) => <button key={id} title={label} aria-label={label} aria-current={tab === id ? "page" : undefined} className={`${s.navItem} ${tab === id ? s.navActive : ""}`} onClick={() => setTab(id)}><Icon size={19} /><span>{label}</span>{id === "overview" && tasks.length > 0 && <i />}</button>)}</nav>
            <div className={s.campSidebar}><span className={s.eyebrow}>ROAD TO VICTORY</span><div><Flag size={16} /> Tuần 3 / 6</div><p>Kỹ thuật → tình huống thi đấu</p><div className={s.progressTrack}><i style={{ width: "50%" }} /></div><small>Ngày mô phỏng <span>06/10/2026</span></small></div>
            <div className={s.sidebarBottom}><div className={s.demoNote}><Sparkles size={18} /><p><strong>Thử một quy trình trọn vẹn</strong><span>Mỗi kết quả tạo bước xử lý tiếp theo, có người phụ trách.</span></p></div><div className={s.user}><span className={s.avatar}>{role === "coach" ? "QT" : "MA"}</span><div><strong>{roles[role]}</strong><small>{role === "coach" ? "Huấn luyện viên trưởng" : "Bác sĩ thể thao"}</small></div></div></div>
        </aside>
        <div className={s.main}>
            <header className={s.topbar}><div className={s.breadcrumb}>MMA TP. Hồ Chí Minh <ChevronRight size={14} /><strong>Fight camp · Chuyên sâu</strong></div><div className={s.roleSwitch}><span>Thử vai trò</span><button aria-pressed={role === "coach"} className={role === "coach" ? s.roleActive : ""} onClick={() => changeRole("coach")}><Dumbbell size={15} />HLV</button><button aria-pressed={role === "doctor"} className={role === "doctor" ? s.roleActive : ""} onClick={() => changeRole("doctor")}><Stethoscope size={15} />Bác sĩ</button></div></header>
            <main className={s.content}>
                <div className={s.pageHeading}><div className={d.intro}><span className={s.eyebrow}>KHÔNG CHỈ TẬP ĐỦ. CẦN BIẾT TẬP CÓ HIỆU QUẢ.</span><h1>{tab === "overview" ? "Hôm nay, kế hoạch cần thay đổi gì?" : tab === "training" ? "Từ điểm yếu đến một giáo án có lý do." : tab === "medical" ? "Kết luận y tế đi vào từng buổi tập." : tab === "weight" ? "Cân nặng có bối cảnh và người xử lý." : "Mỗi thay đổi đều có căn cứ."}</h1><p>{tab === "training" ? "Thiết kế bài, đo chất lượng thực hiện và điều chỉnh dựa trên bằng chứng." : "Võ sĩ Nguyễn Minh Khang · Một chiến dịch, nhiều vòng đánh giá và điều chỉnh."}</p></div><div className={d.topActions}>{tab !== "training" && role === "coach" && <button className={s.primaryButton} onClick={() => openTraining("builder")}><Target size={16} />Thiết kế giáo án</button>}<button className={s.outlineButton} onClick={() => setResetConfirm(true)}><RotateCcw size={15} />Đặt lại demo</button></div></div>
                {resetConfirm && <div className={d.warning}>Đặt lại sẽ xóa các thao tác thử trong phiên này.<div className={s.buttonRow}><button className={s.outlineButton} onClick={() => { dispatch({ type: "reset" }); setResetConfirm(false); setTab("overview"); }}>Đặt lại dữ liệu mẫu</button><button className={s.textButton} onClick={() => setResetConfirm(false)}>Tiếp tục phiên hiện tại</button></div></div>}
                <section className={s.hero}><div className={s.heroMain}><div className={s.heroTags}><span>CHIẾN DỊCH 6 TUẦN</span><span><i /> TUẦN 3 · ĐANG THEO DÕI</span></div><h2>NGUYỄN MINH KHANG</h2><p>Ưu tiên: {focusLabels[state.focus]}</p><div className={s.heroBottom}><span><Trophy size={16} /> Thi đấu 31/10/2026</span><span><ShieldCheck size={16} /> {restrictions[state.clinical.restriction]}</span></div></div><div className={s.countdown}><span>TIÊU CHÍ KỸ THUẬT</span><strong>{state.target}<small>% đạt</small></strong><div>Do HLV xác nhận · Đo theo từng buổi</div></div></section>
                <div className={d.process} aria-label="Vòng lặp huấn luyện">{[
                    { label: "Xác định điểm yếu", click: () => openTraining("builder"), active: tab === "training" && trainingIntent === "builder" },
                    { label: "Thiết kế & thực hiện", click: () => openTraining("plan"), active: tab === "training" && trainingIntent === "plan" },
                    { label: "Đo kết quả", click: () => openTraining("results"), active: tab === "training" && trainingIntent === "results" },
                    { label: "Phối hợp chuyên môn", click: () => setTab("medical"), active: tab === "medical" || tab === "weight" },
                    { label: "Điều chỉnh & kiểm tra lại", click: () => openTraining("results"), active: tab === "history" },
                ].map((step, index) => <button key={step.label} className={step.active ? d.processActive : ""} onClick={step.click}><span>{index + 1}</span>{step.label}</button>)}</div>
                <div className={s.tabs} aria-label="Các khu vực làm việc">{navigation.map(({ id, label }) => <button className={tab === id ? s.tabActive : ""} aria-current={tab === id ? "page" : undefined} key={id} onClick={() => setTab(id)}>{id === "training" ? "Huấn luyện" : id === "weight" ? "Cân nặng" : id === "medical" ? "Y tế" : id === "history" ? "Lịch sử" : label}{id === "overview" && tasks.length > 0 && <span className={s.tabCount}>{tasks.length}</span>}</button>)}</div>
                {(state.error || state.notice) && <div className={`${d.notice} ${state.error ? d.error : ""}`} role={state.error ? "alert" : "status"}><Check size={18} /><span>{state.error || state.notice}</span>{!state.error && tab !== "overview" && <button className={s.textButton} onClick={() => setTab("overview")}>Xem việc tiếp theo</button>}<button className={s.closeButton} aria-label="Đóng thông báo" onClick={() => dispatch({ type: "dismiss" })}><X size={17} /></button></div>}

                {tab === "overview" && <>
                    <div className={d.threeStats}><div className={d.stat}><span>KẾT QUẢ KỸ THUẬT GẦN NHẤT</span><strong>{latestResult ? resultPercent(latestResult) : "—"}<small> % tình huống đạt</small></strong><p>{latestResult ? `${latestResult.result!.completedRounds}/${latestResult.rounds} hiệp hoàn thành · Mục tiêu buổi đó ${latestResult.target}%` : "Chưa có kết quả cùng mục tiêu"}</p></div><div className={d.stat}><span>KẾ HOẠCH CHƯA THỰC HIỆN</span><strong>{planned.length}<small> buổi</small></strong><p>{blocked.length ? `${blocked.length} buổi cần xử lý xung đột y tế` : "Không có xung đột với hạn chế hiện tại"}</p></div><div className={d.stat}><span>VIỆC CẦN NGƯỜI PHỤ TRÁCH XỬ LÝ</span><strong>{tasks.length}<small> vấn đề</small></strong><p>Kết quả kỹ thuật · Thể trạng · Phối hợp</p></div></div>
                    <div className={d.grid}><Panel eyebrow="ƯU TIÊN THEO VẤN ĐỀ THỰC TẾ" title="Đội ngũ cần hành động" action={<ClipboardCheck size={20} />}>{tasks.length ? tasks.map((task) => <div className={d.task} key={task.title}><span className={d.taskIcon}><Flag size={16} /></span><div><h3>{task.title}</h3><p>{task.evidence}</p><footer><span>Phụ trách: {task.owner}</span><button className={s.textButton} onClick={task.click}><ArrowLabel>{task.action}</ArrowLabel></button></footer></div></div>) : <Empty>Các việc hiện tại đã được xử lý. Kết quả mới có thể tạo việc cần rà soát tiếp theo.</Empty>}</Panel>
                    <div className={d.stack}><section className={d.scenario}><Sparkles size={22} /><h2>Thử vòng lặp huấn luyện.</h2><p>Tình huống mẫu: võ sĩ tập đủ hiệp nhưng 2 buổi liên tiếp chưa đạt tiêu chí thoát tầm phản công.</p><ol><li>Xem kết quả 50% → 60%, đối chiếu mục tiêu 80%.</li><li>Chọn buổi 06/10, đổi bài hoặc giảm số hiệp và ghi lý do.</li><li>Ghi kết quả mới: số lượt đạt / tổng lượt kiểm tra.</li><li>Xem biểu đồ thay đổi và việc cần làm tiếp theo.</li><li>Nếu có khó chịu, thử bác sĩ đánh giá rồi quay về HLV.</li></ol><button className={s.outlineButton} onClick={() => openTraining("results")}>Bắt đầu từ kết quả <ArrowRight size={16} /></button></section><Panel eyebrow="KẾT QUẢ CÓ NGỮ CẢNH" title="Vấn đề không nằm ở số buổi"><div className={d.callout}><strong>05/10 · Tập đủ 4/4 hiệp, chỉ đạt 6/10 tình huống</strong>HLV ghi nhận: kỹ năng chưa ổn định khi tăng tốc. Thêm buổi tập mà không đổi cách tập chưa giải quyết được điểm yếu này.</div><p className={d.inlineText}>Trong bản này, kết quả chưa đạt tạo việc cho HLV; phản hồi khó chịu tạo việc cho bác sĩ; hạn chế y tế làm nổi bật buổi tập cần thay đổi.</p></Panel></div></div>
                </>}
                {tab === "training" && <TrainingWorkspace key={trainingIntent} initialMode={trainingIntent} state={state} dispatch={dispatch} role={role} />}
                {tab === "weight" && <WeightWorkspace state={state} dispatch={dispatch} role={role} />}
                {tab === "medical" && <CareWorkspace state={state} dispatch={dispatch} role={role} />}
                {tab === "history" && <Panel eyebrow="TRƯỚC / SAU · NGƯỜI XÁC NHẬN · LÝ DO" title="Lịch sử quyết định trong chiến dịch" action={<Pill>{state.events.length} sự kiện</Pill>}><div className={d.logList}>{state.events.map((event) => <article className={d.logItem} key={event.id}><span>#{event.id}</span><div><h3>{event.title}</h3><p>{event.detail}</p><small>{roles[event.actor]} · Phiên mô phỏng</small></div></article>)}</div></Panel>}
                <footer className={s.footer}><span><Activity size={14} /> Bản thử nghiệm nghiệp vụ · Dữ liệu trong phiên, tải lại sẽ đặt lại.</span><Link href="/concept/fight-camp?version=1">Xem lại bản giao diện đầu tiên</Link></footer>
            </main>
        </div>
    </div>;
}
