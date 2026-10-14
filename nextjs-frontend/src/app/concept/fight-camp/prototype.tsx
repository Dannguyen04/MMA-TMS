"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import {
    Activity, ArrowDownRight, ArrowLeft, ArrowRight, CalendarDays, Check,
    CheckCheck, ChevronRight, Dumbbell, Flag, HeartPulse, LayoutDashboard,
    ListChecks, Plus, RotateCcw, Scale, ShieldCheck, Sparkles, Stethoscope,
    Target, Trophy, Users, X,
} from "lucide-react";
import s from "./prototype.module.css";

type Tab = "overview" | "training" | "weight" | "medical";
type Role = "coach" | "doctor";
type Restriction = "contact" | "upper" | "rest";
type Review = { restriction: Restriction; date: string; note: string; version: number };
type Session = { day: string; date: string; time: string; name: string; kind: string; duration: number; contact: boolean; upper: boolean; done?: boolean };
const initialSessions: Session[] = [
    { day: "THỨ 2", date: "05", time: "07:00", name: "Di chuyển & kiểm soát khoảng cách", kind: "Kỹ thuật", duration: 60, contact: false, upper: false, done: true },
    { day: "THỨ 3", date: "06", time: "16:00", name: "Sparring tình huống", kind: "Đối kháng", duration: 75, contact: true, upper: true },
    { day: "THỨ 4", date: "07", time: "07:00", name: "Sức mạnh thân trên", kind: "Thể lực", duration: 60, contact: false, upper: true },
    { day: "THỨ 5", date: "08", time: "16:00", name: "Chiến thuật & phân tích đối thủ", kind: "Chiến thuật", duration: 45, contact: false, upper: false },
    { day: "THỨ 6", date: "09", time: "07:00", name: "Tổ hợp đòn trên đích", kind: "Kỹ thuật", duration: 60, contact: false, upper: true },
];
const templates = [
    { id: "distance", name: "Kiểm soát khoảng cách", tag: "Kỹ thuật · Trung cấp", goal: "Ra vào tầm đánh và giữ vị trí sau tổ hợp đòn.", detail: "Khởi động → di chuyển theo tín hiệu → tình huống có kiểm soát → nhận xét.", criteria: "HLV đánh giá vị trí chân và khả năng giữ khoảng cách sau mỗi lượt.", contact: false, upper: false },
    { id: "counter", name: "Phòng thủ & phản đòn", tag: "Đối kháng · Nâng cao", goal: "Nhận diện thời điểm phản công trong tình huống đối luyện.", detail: "Ôn kỹ thuật → bài tập theo cặp → sparring tình huống → xem lại video.", criteria: "HLV đánh giá lựa chọn thời điểm, kiểm soát lực và chất lượng phòng thủ.", contact: true, upper: true },
    { id: "tactics", name: "Đọc trận & phân tích đối thủ", tag: "Chiến thuật · Mọi trình độ", goal: "Nhận diện thói quen đối thủ và xây dựng phương án cho từng hiệp.", detail: "Xem video → đánh dấu tình huống → thảo luận phương án → tổng kết.", criteria: "Võ sĩ trình bày được phương án và tình huống cần đổi chiến thuật.", contact: false, upper: false },
];
const restrictionNames: Record<Restriction, string> = { contact: "Tạm ngừng đối kháng", upper: "Hạn chế tải thân trên", rest: "Tạm ngừng tập thể chất" };
const navItems = [
    { id: "overview" as const, label: "Tổng quan", icon: LayoutDashboard },
    { id: "training" as const, label: "Kế hoạch huấn luyện", icon: Dumbbell },
    { id: "weight" as const, label: "Quản lý cân nặng", icon: Scale },
    { id: "medical" as const, label: "Phối hợp y tế", icon: HeartPulse },
];
function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "green" | "amber" | "blue" }) {
    return <span className={`${s.badge} ${s[tone]}`}>{children}</span>;
}
function conflicts(session: Pick<Session, "contact" | "upper" | "kind">, review: Review | null) {
    if (!review) return false;
    return review.restriction === "contact" ? session.contact : review.restriction === "upper" ? session.upper : session.kind !== "Chiến thuật";
}

export default function FightCampPrototype() {
    const [tab, setTab] = useState<Tab>("overview");
    const [role, setRole] = useState<Role>("coach");
    const [sessions, setSessions] = useState<Session[]>(initialSessions);
    const [review, setReview] = useState<Review | null>(null);
    const [appliedVersion, setAppliedVersion] = useState(0);
    const [restriction, setRestriction] = useState<Restriction>("contact");
    const [reviewDate, setReviewDate] = useState("2026-10-09");
    const [note, setNote] = useState("");
    const [historyConfirmed, setHistoryConfirmed] = useState(false);
    const [weights, setWeights] = useState([{ label: "22/09", value: 73.2 }, { label: "25/09", value: 72.8 }, { label: "28/09", value: 73 }, { label: "01/10", value: 72.5 }, { label: "04/10", value: 72.3 }, { label: "06/10", value: 72.1 }]);
    const [weightRequested, setWeightRequested] = useState(false);
    const [weightReviewed, setWeightReviewed] = useState(false);
    const [weightInput, setWeightInput] = useState("");
    const [selectedTemplate, setSelectedTemplate] = useState("distance");
    const [duration, setDuration] = useState("60");
    const [sessionDay, setSessionDay] = useState("07");
    const [sessionTime, setSessionTime] = useState("16:00");
    const [toast, setToast] = useState("");
    const [events, setEvents] = useState(["08:10 · Võ sĩ cập nhật cân nặng 72,1 kg", "07:45 · HLV xác nhận mục tiêu tuần 3"]);
    const planDialog = useRef<HTMLDialogElement>(null);
    const weightDialog = useRef<HTMLDialogElement>(null);
    const pendingCount = sessions.filter((session) => !session.done && conflicts(session, review)).length;
    const needsAdjustment = !!review && review.version !== appliedVersion;
    const latestWeight = weights[weights.length - 1].value;
    const nextSession = sessions.find((session) => !session.done);
    const selected = templates.find((item) => item.id === selectedTemplate)!;
    const blockedTemplate = conflicts({ ...selected, kind: selected.id === "tactics" ? "Chiến thuật" : "Kỹ thuật" }, review);

    function announce(message: string) { setToast(message); }
    function log(message: string) { setEvents((previous) => [`Vừa xong · ${message}`, ...previous].slice(0, 6)); }
    function changeRole(value: Role) { setRole(value); setTab(value === "doctor" ? "medical" : "overview"); }
    function saveReview(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setReview({ restriction, date: reviewDate, note: note.trim(), version: (review?.version ?? 0) + 1 });
        log(`BS. Mai Anh cập nhật: ${restrictionNames[restriction].toLowerCase()}`);
        announce("Đã lưu kết luận mẫu. Chuyển sang HLV để xem buổi tập cần điều chỉnh.");
    }
    function applyAdjustment() {
        if (!review) return;
        setSessions((previous) => previous.map((session) => !session.done && conflicts(session, review) ? { ...session, name: "Phân tích chiến thuật · thay buổi tập", kind: "Chiến thuật", duration: 45, contact: false, upper: false } : session));
        setAppliedVersion(review.version);
        log(`HLV xác nhận điều chỉnh ${pendingCount} buổi theo hạn chế y tế`);
        announce("Đã cập nhật lịch tập. Hạn chế y tế vẫn có hiệu lực đến khi bác sĩ đánh giá lại.");
    }
    function addPlan(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (blockedTemplate) return;
        const day = initialSessions.find((item) => item.date === sessionDay)!;
        setSessions((previous) => [...previous, { day: day.day, date: day.date, time: sessionTime, name: selected.name, kind: selected.id === "tactics" ? "Chiến thuật" : selected.contact ? "Đối kháng" : "Kỹ thuật", duration: Number(duration), contact: selected.contact, upper: selected.upper }].sort((a, b) => Number(a.date) - Number(b.date) || a.time.localeCompare(b.time)));
        planDialog.current?.close();
        setTab("training");
        log(`HLV thêm giáo án “${selected.name}” vào ngày ${sessionDay}/10`);
        announce("Đã thêm buổi tập từ giáo án mẫu vào kế hoạch tuần.");
    }
    function saveWeight(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const value = Number(weightInput);
        if (!Number.isFinite(value) || value < 30 || value > 200) return;
        setWeights((previous) => [...previous.slice(0, -1), { label: "06/10", value }]);
        setWeightInput(""); weightDialog.current?.close();
        log(`Cập nhật cân nặng ngày 06/10: ${value.toLocaleString("vi-VN")} kg`);
        announce("Đã cập nhật số đo hôm nay và biểu đồ cân nặng.");
    }
    function requestWeightReview() {
        setWeightRequested(true); setWeightReviewed(false);
        log("HLV yêu cầu bác sĩ đánh giá mục tiêu cân nặng");
        announce("Đã tạo yêu cầu mẫu. Chuyển sang vai trò bác sĩ để tiếp nhận.");
    }
    function renderSchedule(compact = false) {
        return <div className={s.schedule}>{(compact ? sessions.slice(0, 4) : sessions).map((session, index) => {
            const blocked = !session.done && conflicts(session, review);
            return <div key={`${session.date}-${index}`} className={`${s.session} ${blocked ? s.sessionWarning : ""}`}>
                <div className={`${s.dayBox} ${session.date === "06" ? s.today : ""}`}><small>{session.day}</small><strong>{session.date}</strong></div>
                <div className={s.sessionBody}><div className={s.sessionTitle}>{session.name}{session.done && <CheckCheck size={16} className={s.successIcon} />}</div><div className={s.meta}><span>{session.time}</span><span>•</span><span>{session.duration} phút</span><span>•</span><span>{session.kind}</span></div>{blocked && <span className={s.conflictText}>Cần điều chỉnh: {restrictionNames[review!.restriction].toLowerCase()}</span>}</div>
                {session.done ? <Badge tone="green">Hoàn thành</Badge> : blocked ? <Badge tone="amber">Xung đột</Badge> : <span className={s.sessionDot} />}
            </div>;
        })}</div>;
    }
    function renderWeightChart() {
        const low = Math.min(70, ...weights.map((item) => item.value)) - 0.5;
        const high = Math.max(74, ...weights.map((item) => item.value)) + 0.5;
        const y = (value: number) => 165 - ((value - low) / (high - low)) * 145;
        const points = weights.map((item, index) => `${44 + index * 82},${y(item.value)}`).join(" ");
        return <div className={s.chart}>
            <svg viewBox="0 0 500 207" role="img" aria-label={`Diễn biến cân nặng, số đo mới nhất ${latestWeight} kg, mục tiêu hạng cân 70 kg`}>
                <defs><linearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity=".15" /><stop offset="100%" stopColor="var(--primary)" stopOpacity="0" /></linearGradient></defs>
                {[high - .5, (high + low) / 2, low + .5].map((value) => <g key={value}><line x1="40" x2="465" y1={y(value)} y2={y(value)} stroke="var(--border)" strokeDasharray="3 5" /><text x="0" y={y(value) + 4}>{value.toFixed(1)}</text></g>)}
                <line x1="40" x2="465" y1={y(70)} y2={y(70)} stroke="var(--success-solid)" strokeDasharray="5 5" />
                <polygon points={`44,175 ${points} 454,175`} fill="url(#weight-fill)" />
                <polyline points={points} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinejoin="round" />
                {weights.map((item, index) => <g key={item.label}><circle cx={44 + index * 82} cy={y(item.value)} r="4.5" fill="var(--surface)" stroke="var(--primary)" strokeWidth="2.5" /><text x={44 + index * 82} y="202" textAnchor="middle">{item.label}</text><title>{`${item.label}: ${item.value} kg`}</title></g>)}
            </svg>
            <div className={s.chartLegend}><span><i />Cân nặng thực tế</span><span><i className={s.targetLegend} />Mục tiêu hạng cân: 70 kg</span></div>
        </div>;
    }
    function renderWeightCard() {
        return <section className={s.card}>
            <div className={s.cardHeading}><div><span className={s.eyebrow}>THEO DÕI THỂ TRẠNG</span><h2>Cân nặng & mục tiêu</h2></div><span className={s.iconTile}><Scale size={20} /></span></div>
            <div className={s.weightSummary}><div><strong>{latestWeight.toLocaleString("vi-VN", { minimumFractionDigits: 1 })}<small> kg</small></strong><span>Số đo ngày 06/10</span></div><div className={s.weightDifference}><ArrowDownRight size={17} />{(weights[0].value - latestWeight).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} kg so với 22/09</div></div>
            {renderWeightChart()}
            <div className={s.cardFoot}><span><span className={s.statusDot} />{weightReviewed ? "Bác sĩ đã tiếp nhận đánh giá" : weightRequested ? "Đang chờ bác sĩ đánh giá" : "Mục tiêu cần chuyên môn đánh giá"}</span><button className={s.textButton} onClick={() => setTab("weight")}>Chi tiết <ArrowRight size={15} /></button></div>
        </section>;
    }

    return <div className={s.app} lang="vi">
        <aside className={s.sidebar}>
            <div className={s.brand}><div className={s.brandMark}><Activity size={25} /></div><div>FIGHT<span>CAMP</span><small>MMA TRAINING SYSTEM</small></div></div>
            <div className={s.workspaceLabel}>KHÔNG GIAN LÀM VIỆC</div>
            <nav aria-label="Điều hướng bản thử nghiệm">{navItems.map(({ id, label, icon: Icon }) => <button key={id} aria-label={label} title={label} aria-current={tab === id ? "page" : undefined} className={`${s.navItem} ${tab === id ? s.navActive : ""}`} onClick={() => setTab(id)}><Icon size={19} /><span>{label}</span>{id === "medical" && needsAdjustment && <i />}</button>)}</nav>
            <div className={s.campSidebar}><span className={s.eyebrow}>CHIẾN DỊCH HIỆN TẠI</span><div><Flag size={17} /> Road to Victory</div><p>Võ sĩ Nguyễn Minh Khang</p><div className={s.progressTrack}><i style={{ width: "50%" }} /></div><small>Tuần 3 / 6 <span>Đang diễn ra</span></small></div>
            <div className={s.sidebarBottom}><div className={s.demoNote}><Sparkles size={18} /><p><strong>Bản trải nghiệm nghiệp vụ</strong><span>Dữ liệu mẫu · Làm mới trang để bắt đầu lại.</span></p></div><div className={s.user}><span className={s.avatar}>{role === "coach" ? "QT" : "MA"}</span><div><strong>{role === "coach" ? "Trần Quốc Tuấn" : "BS. Nguyễn Mai Anh"}</strong><small>{role === "coach" ? "Huấn luyện viên trưởng" : "Bác sĩ thể thao"}</small></div></div></div>
        </aside>

        <div className={s.main}>
            <header className={s.topbar}><div className={s.breadcrumb}>Đội tuyển MMA <ChevronRight size={14} /><strong>Fight camp</strong></div><div className={s.roleSwitch} aria-label="Chuyển vai trò thử nghiệm"><span>Góc nhìn</span><button aria-pressed={role === "coach"} className={role === "coach" ? s.roleActive : ""} onClick={() => changeRole("coach")}><Dumbbell size={15} />HLV</button><button aria-pressed={role === "doctor"} className={role === "doctor" ? s.roleActive : ""} onClick={() => changeRole("doctor")}><Stethoscope size={15} />Bác sĩ</button></div></header>
            <main className={s.content}>
                <div className={s.pageHeading}><div><div className={s.eyebrow}>THỨ BA, 06 THÁNG 10, 2026</div><h1>{tab === "overview" ? "Sẵn sàng cho trận đấu tiếp theo." : tab === "training" ? "Mỗi buổi tập, một mục tiêu." : tab === "weight" ? "Theo dõi để quyết định tốt hơn." : "Chăm sóc liền mạch. Tập luyện phù hợp."}</h1><p>{tab === "medical" ? "Kết luận từ bác sĩ trở thành thông tin hành động cho HLV." : "Kế hoạch huấn luyện, thể trạng và đội ngũ chuyên môn trong cùng một nhịp."}</p></div>{role === "coach" && <button className={s.primaryButton} onClick={() => planDialog.current?.showModal()}><Plus size={17} />Thêm buổi từ giáo án</button>}</div>

                <section className={s.hero}>
                    <div className={s.heroMain}><div className={s.heroTags}><span>FIGHT CAMP 2026</span><span><i /> ĐANG DIỄN RA</span></div><h2>NGUYỄN MINH KHANG</h2><p>Đội tuyển MMA TP. Hồ Chí Minh <span>•</span> Hạng nhẹ · 70 kg</p><div className={s.heroBottom}><span><Trophy size={17} /> LION Championship · 31/10/2026</span><span><Users size={17} /> HLV Quốc Tuấn & BS. Mai Anh</span></div></div><div className={s.countdown}><span>ĐẾN NGÀY THI ĐẤU</span><strong>25<small>ngày</small></strong><div><span>Giai đoạn 3</span> · Phát triển chuyên môn</div></div>
                </section>

                <div className={s.tabs} aria-label="Các phần của chiến dịch">{navItems.map(({ id, label }) => <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined} className={tab === id ? s.tabActive : ""}>{id === "training" ? "Kế hoạch tập" : id === "weight" ? "Cân nặng" : id === "medical" ? "Y tế & phối hợp" : label}{id === "medical" && needsAdjustment && <span className={s.tabCount}>1</span>}</button>)}</div>

                {needsAdjustment && role === "coach" && <div className={s.alert}><div className={s.alertIcon}><ShieldCheck size={21} /></div><div><strong>Cập nhật từ bác sĩ: {restrictionNames[review!.restriction].toLowerCase()}</strong><p>{pendingCount > 0 ? `${pendingCount} buổi tập chưa phù hợp với hạn chế mới. Xem phương án thay thế trước khi xác nhận.` : "Lịch hiện tại không có buổi xung đột. Hãy xác nhận đã xem cập nhật."}</p></div><button className={s.outlineButton} onClick={() => setTab("training")}>Xem điều chỉnh <ArrowRight size={16} /></button></div>}

                {tab === "overview" && <>
                    <div className={s.metrics}><div><span className={s.metricIcon}><CalendarDays size={20} /></span><div><span>Kế hoạch tuần này</span><strong>{sessions.length} <small>buổi tập</small></strong></div><Badge tone="blue">Tuần 3</Badge></div><div><span className={s.metricIcon}><Target size={20} /></span><div><span>Mục tiêu kỹ thuật</span><strong>Kiểm soát <small>khoảng cách</small></strong></div></div><div><span className={`${s.metricIcon} ${s.greenIcon}`}><ShieldCheck size={20} /></span><div><span>Phối hợp y tế</span><strong>{review ? "Có hạn chế" : "Chờ đánh giá"}</strong></div><span className={s.statusDot} /></div></div>
                    <div className={s.twoColumns}><section className={s.card}><div className={s.cardHeading}><div><span className={s.eyebrow}>05 — 11 THÁNG 10</span><h2>Tuần tập có định hướng</h2></div><button className={s.textButton} onClick={() => setTab("training")}>Toàn bộ lịch <ArrowRight size={15} /></button></div>{renderSchedule(true)}<div className={s.scheduleHint}><Target size={16} /><span>Ưu tiên tuần này: di chuyển, khoảng cách và lựa chọn thời điểm.</span></div></section>{renderWeightCard()}</div>
                    <div className={s.bottomColumns}><section className={s.card}><div className={s.cardHeading}><div><span className={s.eyebrow}>ĐIỀU CẦN LÀM TIẾP THEO</span><h2>Từ dữ liệu đến hành động</h2></div><ListChecks size={21} /></div><button className={s.actionRow} onClick={() => { setRole("doctor"); setTab("medical"); }}><span className={`${s.actionIcon} ${s.amber}`}><Stethoscope size={19} /></span><div><strong>{review ? "Xem kết luận & lịch đánh giá lại" : "Hoàn tất đánh giá trước buổi đối kháng"}</strong><p>{review ? `Tái đánh giá: ${review.date.split("-").reverse().join("/")}` : "BS. Mai Anh · Hồ sơ đã có sẵn thông tin nền"}</p></div><ChevronRight size={18} /></button><button className={s.actionRow} onClick={() => setTab("weight")}><span className={`${s.actionIcon} ${s.blue}`}><Scale size={19} /></span><div><strong>Rà soát mục tiêu hạng cân thi đấu</strong><p>{weightReviewed ? "Bác sĩ đã tiếp nhận · Chờ đánh giá chuyên môn" : "Kết nối HLV và bác sĩ để thống nhất kế hoạch"}</p></div><ChevronRight size={18} /></button></section><section className={s.card}><div className={s.cardHeading}><div><span className={s.eyebrow}>CÙNG MỘT ĐỘI NGŨ</span><h2>Nhịp hoạt động</h2></div><Activity size={20} /></div><div className={s.activityList}>{events.slice(0, 3).map((item, i) => <div key={`${item}-${i}`}><span /><p>{item}</p></div>)}</div></section></div>
                </>}

                {tab === "training" && <div className={s.trainingColumns}><section className={s.card}><div className={s.cardHeading}><div><span className={s.eyebrow}>KẾ HOẠCH TUẦN 3</span><h2>Huấn luyện theo mục tiêu</h2></div><Badge tone="blue">{sessions.length} buổi</Badge></div>{renderSchedule()}</section><div className={s.stack}>
                    {needsAdjustment ? <section className={`${s.card} ${s.adjustment}`}><Badge tone="amber">Cần HLV xác nhận</Badge><h2>Điều chỉnh theo kết luận y tế</h2><p>{restrictionNames[review!.restriction]}. Đánh giá lại ngày {review!.date.split("-").reverse().join("/")}.</p><div className={s.changePreview}><span>{pendingCount} buổi xung đột</span><ArrowDownRight size={21} /><strong>{pendingCount ? "Đề xuất chuyển sang phân tích chiến thuật" : "Không cần thay đổi lịch tập"}</strong><small>45 phút / buổi · HLV xem xét và quyết định.</small></div>{role === "coach" ? <button className={s.primaryButton} onClick={applyAdjustment}><Check size={16} />{pendingCount ? "Xác nhận điều chỉnh lịch" : "Xác nhận đã xem"}</button> : <p>HLV sẽ xem và xác nhận điều chỉnh trong góc nhìn của mình.</p>}</section> : <section className={s.card}><span className={s.iconTile}><ShieldCheck size={23} /></span><h2>{review ? "Kế hoạch đã được điều chỉnh" : "Kết nối với đội ngũ y tế"}</h2><p>{review ? "Các buổi tập đã được HLV rà soát theo hạn chế hiện tại. Tiếp tục theo dõi đến lần đánh giá lại." : "Khi bác sĩ cập nhật hạn chế, các buổi tập liên quan sẽ được đánh dấu để HLV xử lý."}</p><button className={s.textButton} onClick={() => { setRole("doctor"); setTab("medical"); }}>Thử góc nhìn bác sĩ <ArrowRight size={16} /></button></section>}
                    <section className={s.libraryCard}><Sparkles size={24} /><h2>Bắt đầu từ một giáo án.</h2><p>Mục tiêu, cấu trúc và tiêu chí đánh giá đã có sẵn. HLV chỉ cần điều chỉnh cho võ sĩ.</p>{role === "coach" && <button className={s.outlineButton} onClick={() => planDialog.current?.showModal()}>Khám phá 3 giáo án mẫu <ArrowRight size={16} /></button>}<small>Nội dung minh họa, cần chuyên gia duyệt trước khi sử dụng thực tế.</small></section>
                </div></div>}

                {tab === "weight" && <div className={s.twoColumns}>{renderWeightCard()}<section className={s.card}><span className={s.eyebrow}>MỤC TIÊU CÓ NGƯỜI PHỤ TRÁCH</span><h2>Chuẩn bị cho ngày cân chính thức</h2><div className={s.detailRows}><div><span>Hạng cân dự kiến</span><strong>70 kg</strong></div><div><span>Ngày cân chính thức</span><strong>30/10/2026</strong></div><div><span>Chênh lệch hiện tại</span><strong>{(latestWeight - 70).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} kg</strong></div><div><span>Phụ trách chuyên môn</span><strong>BS. Nguyễn Mai Anh</strong></div><div><span>Trạng thái kế hoạch</span><Badge tone={weightReviewed ? "blue" : "amber"}>{weightReviewed ? "Đã tiếp nhận đánh giá" : "Chưa được phê duyệt"}</Badge></div></div><div className={s.infoBox}><ShieldCheck size={20} /><p>Mục tiêu cân nặng cần được đội ngũ chuyên môn đánh giá trước khi lập kế hoạch. Hệ thống theo dõi số đo và phối hợp xử lý.</p></div><div className={s.buttonRow}><button className={s.primaryButton} onClick={() => weightDialog.current?.showModal()}><Plus size={16} />Cập nhật số đo</button>{role === "coach" && <button className={s.outlineButton} disabled={weightRequested} onClick={requestWeightReview}>{weightReviewed ? "Đã được tiếp nhận" : weightRequested ? "Đã gửi yêu cầu" : "Yêu cầu đánh giá"}</button>}</div></section><section className={`${s.card} ${s.fullWidth}`}><h2>Lịch sử số đo</h2><div className={s.weightHistory}>{weights.map((item) => <div key={item.label}><span>{item.label}/2026</span><strong>{item.value.toLocaleString("vi-VN")} <small>kg</small></strong></div>)}</div></section></div>}

                {tab === "medical" && <div className={s.medicalColumns}><section className={s.card}><div className={s.cardHeading}><div><span className={s.eyebrow}>HỒ SƠ TÓM TẮT</span><h2>Thông tin đã có sẵn</h2></div><Badge tone="blue">Dữ liệu mẫu</Badge></div><div className={s.patient}><span className={s.patientAvatar}>MK</span><div><strong>Nguyễn Minh Khang</strong><p>Nam · 24 tuổi · MMA · Hạng nhẹ</p></div></div><div className={s.detailRows}><div><span>Lần khám trước</span><strong>29/09/2026</strong></div><div><span>Lý do theo dõi</span><strong>Khó chịu vùng vai sau tập</strong></div><div><span>Buổi tập kế tiếp</span><strong>{nextSession ? `${nextSession.date}/10 · ${nextSession.name}` : "Chưa có lịch"}</strong></div><div><span>Cân nặng gần nhất</span><strong>{latestWeight.toLocaleString("vi-VN")} kg</strong></div></div><div className={s.infoBox}><RotateCcw size={19} /><p>Thông tin được điền từ hồ sơ trước. Bác sĩ xác nhận lại và chỉ bổ sung thay đổi trong lần khám này.</p></div>{weightRequested && <div className={s.requestCard}><Scale size={20} /><strong>HLV yêu cầu đánh giá mục tiêu cân nặng</strong><p>Hiện tại {latestWeight.toLocaleString("vi-VN")} kg · Mục tiêu 70 kg · Cân chính thức 30/10.</p>{role === "doctor" && <button className={s.outlineButton} disabled={weightReviewed} onClick={() => { setWeightReviewed(true); log("BS. Mai Anh tiếp nhận yêu cầu đánh giá cân nặng"); announce("Đã tiếp nhận. Kế hoạch vẫn chờ đánh giá và phê duyệt chuyên môn."); }}>{weightReviewed ? "Đã tiếp nhận · Chờ đánh giá" : "Tiếp nhận đánh giá"}</button>}</div>}</section>
                    {role === "doctor" ? <section className={s.card}><div className={s.cardHeading}><div><span className={s.eyebrow}>KHÁM THEO DÕI · 06/10/2026</span><h2>Ghi nhận thay đổi, giảm nhập lại</h2></div><Stethoscope size={23} /></div><form onSubmit={saveReview} className={s.medicalForm}><label className={s.checkbox}><input type="checkbox" checked={historyConfirmed} onChange={(event) => setHistoryConfirmed(event.target.checked)} required /><span>Đã kiểm tra lại thông tin nền với võ sĩ</span></label><fieldset><legend>Hạn chế cần thông báo cho HLV</legend><div className={s.restrictionOptions}>{(Object.entries(restrictionNames) as [Restriction, string][]).map(([value, label]) => <label key={value} className={restriction === value ? s.restrictionSelected : ""}><input type="radio" name="restriction" value={value} checked={restriction === value} onChange={() => setRestriction(value)} /><ShieldCheck size={17} />{label}</label>)}</div></fieldset><label className={s.field}>Ngày đánh giá lại<input type="date" required min="2026-10-07" max="2026-12-31" value={reviewDate} onChange={(event) => setReviewDate(event.target.value)} /></label><label className={s.field}>Lưu ý cho việc tổ chức tập luyện <span>(không bắt buộc)</span><textarea rows={3} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Chỉ ghi thay đổi hoặc hướng dẫn HLV cần biết…" /></label><div className={s.resultPreview}><CheckCheck size={20} /><div><strong>Sau khi lưu kết luận</strong><p>HLV nhận hạn chế · Lịch tập đánh dấu xung đột · Tạo mốc đánh giá lại.</p></div></div><button className={s.primaryButton} type="submit"><Check size={17} />{review ? "Cập nhật kết luận mẫu" : "Lưu kết luận & cập nhật cho HLV"}</button></form></section> : <section className={s.card}><span className={s.eyebrow}>THÔNG TIN DÀNH CHO HLV</span><h2>{review ? restrictionNames[review.restriction] : "Chờ kết luận từ bác sĩ"}</h2><p>{review ? `Đánh giá lại ngày ${review.date.split("-").reverse().join("/")}. ${review.note}` : "Bác sĩ xác nhận thông tin nền, chọn hạn chế và ngày đánh giá lại. HLV sẽ nhận những thông tin cần thiết để tổ chức tập luyện."}</p>{review && <Badge tone={needsAdjustment ? "amber" : "green"}>{needsAdjustment ? "Chờ HLV điều chỉnh kế hoạch" : "HLV đã rà soát kế hoạch"}</Badge>}<div className={s.buttonRow}><button className={s.outlineButton} onClick={() => changeRole("doctor")}>Thử thao tác của bác sĩ <ArrowRight size={16} /></button></div></section>}
                </div>}

                <footer className={s.footer}><span><Activity size={14} /> FIGHTCAMP · Một kế hoạch, cả đội đồng hành.</span><span>Bản thử nghiệm tương tác · Không lưu dữ liệu sau khi tải lại trang</span></footer>
            </main>
        </div>

        <dialog ref={planDialog} className={s.dialog} aria-labelledby="plan-title" onClick={(event) => { if (event.target === event.currentTarget) planDialog.current?.close(); }}><div className={s.dialogHead}><div><span className={s.eyebrow}>THƯ VIỆN GIÁO ÁN MẪU</span><h2 id="plan-title">Một buổi tập có mục tiêu rõ ràng.</h2></div><button aria-label="Đóng thư viện" className={s.closeButton} onClick={() => planDialog.current?.close()}><X size={21} /></button></div><form onSubmit={addPlan}><div className={s.templateGrid}>{templates.map((item) => <button type="button" key={item.id} aria-pressed={selectedTemplate === item.id} className={selectedTemplate === item.id ? s.templateSelected : ""} onClick={() => setSelectedTemplate(item.id)}><span>{item.tag}</span><strong>{item.name}</strong><p>{item.goal}</p>{selectedTemplate === item.id && <Check size={18} />}</button>)}</div><div className={s.templateDetail}><strong>Cấu trúc buổi tập</strong><p>{selected.detail}</p><strong>Tiêu chí đánh giá</strong><p>{selected.criteria}</p></div><div className={s.formGrid}><label className={s.field}>Ngày tập<select value={sessionDay} onChange={(event) => setSessionDay(event.target.value)}>{initialSessions.slice(1).map((item) => <option key={item.date} value={item.date}>{item.day} · {item.date}/10</option>)}</select></label><label className={s.field}>Giờ bắt đầu<input type="time" required value={sessionTime} onChange={(event) => setSessionTime(event.target.value)} /></label><label className={s.field}>Thời lượng (phút)<input type="number" min="15" max="180" step="5" required value={duration} onChange={(event) => setDuration(event.target.value)} /></label></div>{blockedTemplate && <p className={s.conflictText}>Giáo án xung đột với hạn chế hiện tại. Chọn giáo án khác để tiếp tục.</p>}<p className={s.dialogDisclaimer}>Nội dung giáo án minh họa; cần HLV chuyên môn thẩm định trước khi áp dụng thực tế.</p><div className={s.dialogActions}><button type="button" className={s.textButton} onClick={() => planDialog.current?.close()}><ArrowLeft size={15} />Quay lại</button><button className={s.primaryButton} disabled={blockedTemplate} type="submit"><Plus size={17} />Thêm vào kế hoạch tuần</button></div></form></dialog>

        <dialog ref={weightDialog} className={`${s.dialog} ${s.smallDialog}`} aria-labelledby="weight-title" onClick={(event) => { if (event.target === event.currentTarget) weightDialog.current?.close(); }}><div className={s.dialogHead}><div><span className={s.eyebrow}>SỐ ĐO NGÀY 06/10/2026</span><h2 id="weight-title">Cập nhật cân nặng hôm nay</h2></div><button className={s.closeButton} aria-label="Đóng cập nhật cân nặng" onClick={() => weightDialog.current?.close()}><X size={20} /></button></div><form onSubmit={saveWeight}><label className={s.field}>Cân nặng (kg)<input autoFocus type="number" min="30" max="200" step="0.1" required placeholder="Ví dụ: 72.1" value={weightInput} onChange={(event) => setWeightInput(event.target.value)} /></label><p className={s.dialogDisclaimer}>Số đo này thay thế bản ghi hôm nay và cập nhật biểu đồ.</p><button className={s.primaryButton} type="submit"><Check size={17} />Lưu số đo</button></form></dialog>

        {toast && <div className={s.toast} role="status"><span><Check size={18} /></span><p>{toast}</p><button className={s.closeButton} aria-label="Đóng thông báo" onClick={() => setToast("")}><X size={17} /></button></div>}
    </div>;
}
