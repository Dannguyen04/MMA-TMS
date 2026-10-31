import { useCallback, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { campApi, type CampDetail, type Suspension } from "@/api/fight-camp";
import { createFighterMeasurement } from "@/api/fighters";
import { useSession } from "@/session/session-context";
import { useThemePreference } from "@/theme";
import { Action, Busy, CampShell, Copy, Fact, Frame, Notice, SvgTitle, WeightPlot, WeightSlip } from "./camp-ui";
import { campError, dateLabel, kg, readKg, statusLabel } from "./camp-rules";
import { useCampResource } from "./use-camp-resource";
import { previewBout } from "./camp-preview";

const activeStates = ["SCHEDULED", "CAMP", "FIGHT_WEEK", "WEIGHED_IN"];
async function activeBout(fighterId: string | undefined): Promise<CampDetail | null> {
  let cursor: string | undefined;
  do {
    const page = await campApi.list({ fighterId, cursor, limit: 50 });
    const first = page.data.find(b => activeStates.includes(b.status));
    if (first) return campApi.detail(first.id);
    cursor = page.hasNextPage ? page.nextCursor ?? undefined : undefined;
  } while (cursor);
  return null;
}
const weightLabels = { ON_TRACK: "Đang theo lộ trình", ABOVE_TARGET: "Cao hơn lộ trình", OVER_LIMIT: "Vượt giới hạn", NOT_WEIGHED: "Chưa ghi cân", NEUTRAL: "Đã qua cân chính thức" };
function useFighterCamp() {
  const { user, isDemo } = useSession();
  return useCampResource(`fighter-camp:${user?.id}:${isDemo}`, async () => {
    const bout = isDemo ? previewBout : await activeBout(user?.profile?.id);
    const track = bout ? isDemo ? { ...previewBout.weight, limitKg: 60, points: [{ date: "2026-10-24", kg: 61 }, { date: "2026-10-26", kg: 60.4 }] } : await campApi.weightTrack(bout.id) : null;
    return { bout, track };
  });
}
export function FighterCampScreen() {
  const state = useFighterCamp(); const router = useRouter(); const { isDemo } = useSession(); const { colors: c } = useThemePreference();
  const first = useRef(true);
  useFocusEffect(useCallback(() => { if (first.current) { first.current = false; return; } void state.reload(); }, [state.reload]));
  const bout = state.data?.bout, track = state.data?.track;
  const record = () => router.push("/(fighter)/tran/can-nang" as never);
  return <CampShell title="Trận của tôi" subtitle="Lịch thi đấu và số cân theo ngày." preview={isDemo}>
    {state.loading && !state.data ? <Busy/> : null}
    {state.error ? <><Notice title="Không tải được trận" danger>{state.error}</Notice><Action label="Thử tải lại" secondary onPress={() => void state.reload()}/></> : null}
    {state.data && !bout ? <><Notice title="Chưa có trận sắp tới">Bạn vẫn có thể ghi số cân hôm nay.</Notice><Action label="Ghi cân hôm nay" onPress={record}/></> : null}
    {bout ? <>
      <Frame><Copy color={c.lotus} strong>{statusLabel[bout.status]}</Copy><Copy large strong>{bout.eventName}</Copy><Copy muted>Đối thủ</Copy><Copy large strong>{bout.opponentName || "Chưa xác định"}</Copy><Fact label="Cân chính thức" value={dateLabel(bout.weighInAt)}/><Fact label="Thi đấu" value={dateLabel(bout.boutAt)}/><Fact label="Địa điểm" value={bout.venue || "Chưa xác định"}/><Fact label="Giới hạn" value={`${kg(bout.catchweightKg ?? bout.weightLimitKg)} kg`}/></Frame>
      {bout.weightReminder?.active ? <Notice title="Ghi cân hôm nay">{bout.weightReminder.level === "YESTERDAY_MISSING" ? "Hôm qua chưa có số cân. Ghi số cân hôm nay để tiếp tục theo dõi." : "Cần số cân hôm nay để cập nhật tiến độ tuần thi đấu."}</Notice> : null}
      {track ? <Frame><Copy muted>Số cân gần nhất{track.latestOn ? ` · ${dateLabel(track.latestOn)}` : ""}</Copy><Copy large strong>{kg(track.latestKg)} kg</Copy><Copy color={track.status === "OVER_LIMIT" ? c.danger : c.ink}>{weightLabels[track.status]}</Copy>{track.status !== "NEUTRAL" && track.remainingPct != null ? <Copy muted>Còn {kg(track.remainingPct)}% để chạm giới hạn</Copy> : null}<WeightPlot points={track.points} reference={track.referencePath} limit={track.limitKg}/></Frame> : null}
      <Action label="Ghi cân hôm nay" onPress={record}/>
      <SvgTitle small>Hồ sơ thi đấu</SvgTitle>
      {bout.requirements.length ? bout.requirements.map(r => <Fact key={r.code} label={r.label} value={({ CONFIRMED: "Đã xác nhận", PROVIDED: "Đã cung cấp", MISSING: "Còn thiếu", REJECTED: "Chưa hợp lệ", EXPIRED: "Hết hạn" } as Record<string, string>)[r.status] ?? r.status}/>) : <Copy muted>Chưa có mục hồ sơ thi đấu.</Copy>}
    </> : null}
    <Action label="Xem trạng thái đình chỉ" secondary onPress={() => router.push("/(fighter)/tran/dinh-chi" as never)}/>
  </CampShell>;
}
export function FighterDailyWeightScreen() {
  const state = useFighterCamp(); const { user, isDemo } = useSession(); const router = useRouter();
  const [text, setText] = useState(""); const [pending, setPending] = useState(false); const [error, setError] = useState(""); const [saved, setSaved] = useState(false); const lock = useRef(false);
  const bout = state.data?.bout;
  return <CampShell title="Ghi cân hôm nay" subtitle={dateLabel(new Date().toISOString())} preview={isDemo}>
    {state.loading ? <Busy/> : null}
    {state.error ? <Notice title="Chưa tải được thông tin trận" danger>{state.error}</Notice> : null}
    <Copy>Ghi số cân bạn vừa đo. Đây là cân tự ghi, không thay thế buổi cân chính thức của HLV.</Copy>
    <WeightSlip label="Cân nặng hôm nay" value={text} onChange={v => { setText(v); setSaved(false); }} limit={bout ? kg(bout.catchweightKg ?? bout.weightLimitKg) : "—"} disabled={pending}/>
    {!bout && !state.loading ? <Copy muted>Chưa có trận sắp tới. Số cân vẫn được lưu vào hồ sơ của bạn.</Copy> : null}
    {error ? <Notice title="Chưa ghi được cân" danger>{error}</Notice> : null}
    {saved ? <><Notice title={isDemo ? "Đã ghi cân trong bản mẫu" : "Đã ghi cân hôm nay"} success/><Action label={bout ? "Về trận của tôi" : "Về trang chủ"} onPress={() => router.replace((bout ? "/(fighter)/tran" : "/") as never)}/></> : <Action label="Lưu cân hôm nay" pending={pending} onPress={() => {
      if (lock.current) return;
      lock.current = true; setPending(true); setError("");
      void (async () => { const weightKg = readKg(text); if (!isDemo) { if (!user?.profile?.id) throw new Error("Không tìm thấy hồ sơ võ sĩ. Hãy đăng nhập lại."); await createFighterMeasurement(user.profile.id, { weightKg, measurementContext: "SELF_REPORTED" }); } setSaved(true); })().catch(e => setError(campError(e))).finally(() => { lock.current = false; setPending(false); });
    }}/>}
  </CampShell>;
}
const sessionNames: Record<string, string> = { SHADOW_BOXING: "Đánh gió", PAD_WORK: "Đánh đích", HEAVY_BAG: "Đánh bao", SPARRING: "Đối luyện", GRAPPLING: "Vật / khoá siết", STRENGTH_CONDITIONING: "Thể lực và sức mạnh", RECOVERY: "Phục hồi", PHYSICAL_THERAPY: "Vật lý trị liệu" };
const allSessionTypes = Object.keys(sessionNames);
export function FighterSuspensionsScreen() {
  const { user, isDemo } = useSession(); const [extra, setExtra] = useState<Suspension[]>([]); const [moreBusy, setMoreBusy] = useState(false); const [error, setError] = useState(""); const [cursor, setCursor] = useState<string | null>(null);
  const state = useCampResource(`suspensions:${user?.id}:${isDemo}`, async () => {
    const page = isDemo ? { data: [{ id: "sample", reason: "MANDATORY_REST", status: "ACTIVE" as const, startsOn: "2026-10-26", endsOn: "2026-11-01", blockedSessionTypes: ["SPARRING"], requiresClearance: false, clearedAt: null, clearanceNote: null }], nextCursor: null, hasNextPage: false } : await campApi.suspensions();
    setCursor(page.hasNextPage ? page.nextCursor : null); setExtra([]); return page;
  });
  return <CampShell title="Trạng thái đình chỉ" subtitle="Thông tin từ hồ sơ học viện, chỉ đọc." preview={isDemo}>
    {state.loading ? <Busy/> : null}
    {state.error || error ? <><Notice title="Không tải được hồ sơ" danger>{state.error || error}</Notice><Action label="Thử tải lại" secondary onPress={() => { setError(""); void state.reload(); }}/></> : null}
    {state.data && !state.data.data.length ? <Notice title="Chưa có bản ghi đình chỉ">Không có đình chỉ nào trong hồ sơ được trả về.</Notice> : null}
    {[...(state.data?.data ?? []), ...extra].map(s => <Frame key={s.id}>
      <Copy large strong>{({ UPCOMING: "Sắp áp dụng", ACTIVE: "Đang đình chỉ", AWAITING_CLEARANCE: "Chờ xác nhận tập lại", ENDED: "Đã kết thúc" })[s.status]}</Copy>
      <Fact label="Lý do" value={({ KO: "KO", TKO: "TKO", DQ: "Truất quyền thi đấu", MANDATORY_REST: "Nghỉ bắt buộc", MEDICAL: "Y tế", OTHER: "Khác" } as Record<string, string>)[s.reason] ?? s.reason}/>
      <Fact label="Bắt đầu" value={dateLabel(s.startsOn)}/><Fact label="Ngày hết thời hạn" value={dateLabel(s.endsOn)}/>
      {s.status === "ENDED" ? <Copy>Đình chỉ này đã kết thúc.</Copy> : <>
        <Copy strong>Loại buổi tập bị chặn theo bản ghi</Copy><Copy>{s.blockedSessionTypes.map(t => sessionNames[t] ?? t).join(", ") || "Không có"}</Copy>
        <Copy strong>Loại không bị chặn bởi bản ghi này</Copy><Copy>{allSessionTypes.filter(t => !s.blockedSessionTypes.includes(t)).map(t => sessionNames[t]).join(", ") || "Không có"}</Copy>
        <Copy muted>{s.requiresClearance && !s.clearedAt ? "Cần xác nhận cho tập lại; chưa thể chốt ngày trở lại." : `Dự kiến sau ngày ${dateLabel(s.endsOn)} nếu không có hạn chế khác.`}</Copy>
      </>}
      {s.clearanceNote ? <Copy muted>{s.clearanceNote}</Copy> : null}
    </Frame>)}
    {cursor ? <Action label="Tải thêm bản ghi" secondary pending={moreBusy} onPress={() => { setMoreBusy(true); setError(""); void campApi.suspensions(cursor).then(p => { setExtra(items => [...items, ...p.data]); setCursor(p.hasNextPage ? p.nextCursor : null); }).catch(e => setError(campError(e))).finally(() => setMoreBusy(false)); }}/> : null}
    <Copy muted>Buổi tập cụ thể còn phụ thuộc hồ sơ y tế và các đình chỉ khác.</Copy>
  </CampShell>;
}
