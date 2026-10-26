import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Image, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { campApi, type CampDetail, type CampBout, type WeighResult, type Hydration, type CursorPage } from "@/api/fight-camp";
import { getFighter } from "@/api/fighters";
import { useSession } from "@/session/session-context";
import { useThemePreference } from "@/theme";
import { Action, Busy, CampShell, Choices, Copy, Fact, Field, Frame, Notice, SvgTitle, WeightSlip } from "./camp-ui";
import { campError, dateLabel, kg, readKg, statusLabel } from "./camp-rules";
import { previewBout } from "./camp-preview";
import { CornerScreen, RoundScreen, AdviceScreen, ReportScreen, type RoundDraftState } from "./round-screens";
import { OpponentEditor } from "./opponent-editor";

export function CoachCampList() {
  const router = useRouter(); const { isDemo } = useSession();
  const [page, setPage] = useState<CursorPage<CampBout> | null>(null);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  const load = useCallback(async (more = false) => {
    setBusy(true); setError("");
    try {
      const next = isDemo ? { data: [previewBout], hasNextPage: false, nextCursor: null } : await campApi.list({ limit: 20, cursor: more && page?.nextCursor ? page.nextCursor : undefined });
      if (alive.current) setPage(p => ({ ...next, data: more ? [...(p?.data ?? []), ...next.data] : next.data }));
    } catch (e) { if (alive.current) setError(campError(e)); } finally { if (alive.current) setBusy(false); }
  }, [isDemo, page?.nextCursor]);
  useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; }; }, [isDemo]);
  return <CampShell title="Trận thi đấu" subtitle="Cân chính thức, chuẩn bị góc đài và ghi hiệp." preview={isDemo}>
    <Action label="Xem bản mẫu giao diện" secondary onPress={() => router.push({ pathname: "/(coach)/fight-camp/bout", params: { id: "preview", preview: "1" } } as never)}/>
    {error ? <Notice title="Không tải được danh sách" danger>{error}</Notice> : null}
    {busy && !page ? <Busy/> : null}
    {!busy && !error && page?.data.length === 0 ? <Notice title="Chưa có trận thi đấu">Các trận của võ sĩ bạn phụ trách sẽ xuất hiện tại đây.</Notice> : null}
    {page?.data.map(b => <Frame key={b.id}>
      <Copy muted>{statusLabel[b.status]} · {dateLabel(b.boutAt)}</Copy>
      <SvgTitle small>{b.eventName}</SvgTitle>
      <Copy large strong>Đối thủ: {b.opponentName || "Chưa xác định"}</Copy>
      <Fact label="Giới hạn" value={`${kg(b.catchweightKg ?? b.weightLimitKg)} kg`}/>
      <Action label="Mở chi tiết trận" onPress={() => router.push({ pathname: "/(coach)/fight-camp/bout", params: { id: b.id, preview: isDemo ? "1" : "0" } } as never)}/>
    </Frame>)}
    <Action label={page?.hasNextPage ? "Tải thêm trận" : "Tải lại danh sách"} secondary pending={busy} onPress={() => void load(!!page?.hasNextPage)}/>
  </CampShell>;
}

type Screen = "detail" | "weigh" | "decision" | "catch" | "cancel" | "corner" | "rounds" | "advice" | "opponent" | "report";
const titles: Record<Screen, string> = { detail: "Chi tiết trận", weigh: "Cân chính thức", decision: "Kết quả cân", catch: "Thoả thuận catchweight", cancel: "Xác nhận huỷ trận", corner: "Thẻ góc đài", rounds: "Ghi chú và ghi hiệp", advice: "Lời dặn giữa hiệp", opponent: "Phân tích đối thủ", report: "Báo cáo trận" };
export function CoachCampBout() {
  const params = useLocalSearchParams<{ id: string; preview?: string }>(); const router = useRouter(); const { isDemo } = useSession();
  const preview = params.preview === "1" || isDemo;
  const [bout, setBout] = useState<CampDetail | null>(null); const [name, setName] = useState("");
  const [view, setView] = useState<Screen>("detail"); const [history, setHistory] = useState<Screen[]>([]);
  const [roundDraftState, setRoundDraftState] = useState<RoundDraftState>({ round: 1, values: {} });
  useEffect(() => { setRoundDraftState({ round: 1, values: {} }); }, [params.id, preview]);
  const [loading, setLoading] = useState(true); const [pending, setPending] = useState(false);
  const lock = useRef(false); const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  const [weight, setWeight] = useState(""); const [hydration, setHydration] = useState<Hydration>("NOT_APPLICABLE"); const [notes, setNotes] = useState("");
  const [result, setResult] = useState<WeighResult | null>(null); const [catchKg, setCatchKg] = useState(""); const [catchNote, setCatchNote] = useState(""); const [reason, setReason] = useState("Không đạt cân");
  const { colors: c } = useThemePreference();
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const b = preview ? structuredClone(previewBout) : await campApi.detail(params.id);
      setBout(b);
      if (preview) setName("Nguyễn Thành Long");
      else { const f = await getFighter(b.fighterId); setName(`${f.firstName} ${f.lastName}`.trim()); }
    } catch (e) { setError(campError(e)); } finally { setLoading(false); }
  }, [params.id, preview]);
  useEffect(() => { void load(); }, [load]);
  const go = (next: Screen) => { setHistory(h => [...h, view]); setView(next); setError(""); setSuccess(""); };
  const back = useCallback(() => {
    if (lock.current) return;
    if (history.length) { setView(history[history.length - 1]); setHistory(h => h.slice(0, -1)); setError(""); setSuccess(""); }
    else router.back();
  }, [history, router]);
  useEffect(() => { const sub = BackHandler.addEventListener("hardwareBackPress", () => { back(); return true; }); return () => sub.remove(); }, [back]);
  async function mutate(work: () => Promise<void>) {
    if (lock.current) return; lock.current = true; setPending(true); setError(""); setSuccess("");
    try { await work(); } catch (e) { setError(campError(e)); } finally { lock.current = false; setPending(false); }
  }
  const limit = bout ? bout.catchweightKg ?? bout.weightLimitKg : 0;
  const clearToDetail = (b: CampDetail, message: string) => { setBout(b); setView("detail"); setHistory([]); setSuccess(message); };
  const acute = bout?.acuteLoss?.status === "EXCEEDED";
  const privateReady = bout?.status === "WEIGHED_IN" || bout?.status === "COMPLETED";
  return <CampShell title={titles[view]} subtitle={bout ? `${name || "Võ sĩ"} · ${bout.eventName}` : undefined} onBack={back} preview={preview}>
    {loading ? <Busy/> : null}
    {error ? <><Notice title="Chưa thực hiện được" danger>{error}</Notice>{!bout ? <Action label="Thử tải lại" onPress={() => void load()}/> : null}</> : null}
    {success ? <Notice title={success} success/> : null}
    {bout && !loading ? <>
      {preview && view === "detail" ? <Choices label="Trạng thái mẫu để xem giao diện" value={bout.status} options={[{ value: "FIGHT_WEEK", label: "Tuần thi đấu" }, { value: "WEIGHED_IN", label: "Đã cân" }, { value: "COMPLETED", label: "Kết thúc" }]} onChange={s => setBout({ ...bout, status: s })}/> : null}
      {view === "detail" ? <>
        <Frame><Copy color={c.lotus} strong>{statusLabel[bout.status]}</Copy><Copy large strong>{name || "Võ sĩ"}</Copy><Copy muted>Đấu với</Copy><Copy large strong>{bout.opponentName || "Đối thủ chưa xác định"}</Copy><Fact label="Cân chính thức" value={dateLabel(bout.weighInAt)}/><Fact label="Thi đấu" value={dateLabel(bout.boutAt)}/><Fact label="Địa điểm" value={bout.venue || "Chưa xác định"}/><Fact label="Giới hạn" value={`${kg(limit)} kg`}/><Fact label="Số hiệp" value={bout.scheduledRounds == null ? "Chưa đặt" : String(bout.scheduledRounds)}/></Frame>
        {acute ? <Notice title="Giảm cân cấp tốc vượt ngưỡng" danger>Giảm {kg(bout.acuteLoss?.lossPct)}%; ngưỡng theo bộ luật là {kg(bout.acuteLoss?.limitPct)}%.</Notice> : null}
        {bout.status === "FIGHT_WEEK" ? <Action label="Ghi cân chính thức" onPress={() => go("weigh")}/> : null}
        {privateReady ? <><Action label="Mở thẻ góc đài" onPress={() => go("corner")}/><Action label="Ghi chú và ghi hiệp" secondary onPress={() => go("rounds")}/></> : <Copy muted>Thẻ góc đài và ghi hiệp mở sau khi cân chính thức đạt hoặc hoàn tất catchweight.</Copy>}
        <Action label="Phân tích đối thủ" secondary onPress={() => go("opponent")}/>
        {bout.status === "COMPLETED" ? <Action label="Xem báo cáo trận" secondary onPress={() => go("report")}/> : null}
        <SvgTitle small>Hồ sơ thi đấu</SvgTitle>
        {bout.requirements.length ? bout.requirements.map(r => <Fact key={r.code} label={r.label} value={({ CONFIRMED: "Đã xác nhận", PROVIDED: "Đã cung cấp", MISSING: "Còn thiếu", REJECTED: "Chưa hợp lệ", EXPIRED: "Hết hạn" } as Record<string, string>)[r.status] ?? r.status}/>) : <Copy muted>Chưa có mục hồ sơ.</Copy>}
      </> : null}
      {view === "weigh" ? <>
        <WeightSlip value={weight} onChange={setWeight} limit={kg(limit)} disabled={pending}/>
        <Choices<Hydration> label="Kiểm tra nước" value={hydration} onChange={setHydration} disabled={pending} options={[{ value: "NOT_APPLICABLE", label: "Không áp dụng" }, { value: "PASSED", label: "Đạt" }, { value: "FAILED", label: "Không đạt" }]}/>
        <Field label="Ghi chú (tuỳ chọn)" value={notes} onChangeText={setNotes} multiline maxLength={500} editable={!pending} helper={`${notes.length}/500 ký tự`}/>
        {acute ? <Notice title="Giảm cân cấp tốc vượt ngưỡng" danger>Kiểm tra cảnh báo trước khi tiếp tục ghi cân.</Notice> : null}
        <Action label="Ghi cân chính thức" pending={pending} onPress={() => void mutate(async () => {
          const weightKg = readKg(weight);
          const failed = weightKg > limit || hydration === "FAILED";
          const next: WeighResult = preview ? { ...bout, officialWeightKg: weightKg, hydrationCheck: hydration, madeWeight: weightKg <= limit, status: failed ? "FIGHT_WEEK" : "WEIGHED_IN", weighIn: { outcome: failed ? "FAILED" : "PASSED", reason: weightKg > limit ? "OVER_LIMIT" : hydration === "FAILED" ? "HYDRATION_FAILED" : null, overByKg: weightKg > limit ? weightKg - limit : null, overByPct: null, options: failed ? ["CATCHWEIGHT", "CANCEL"] : [] } } : await campApi.weigh(bout.id, { weightKg, hydrationCheck: hydration, ...(notes.trim() ? { notes: notes.trim() } : {}) });
          setBout(next); setResult(next); setCatchKg(kg(next.officialWeightKg)); setHistory(["detail"]); setView("decision");
        })}/>
      </> : null}
      {view === "decision" && result ? <>
        <Frame tone={result.weighIn.outcome === "PASSED" ? "success" : "danger"}><Copy muted>Cân chính thức</Copy><Copy large strong>{kg(result.officialWeightKg)} kg</Copy><Copy strong>{result.weighIn.outcome === "PASSED" ? "Đạt cân chính thức" : result.weighIn.reason === "HYDRATION_FAILED" ? "Kiểm tra nước không đạt" : `Vượt ${kg(result.weighIn.overByKg)} kg`}</Copy><Copy muted>{statusLabel[result.status]}</Copy></Frame>
        {result.acuteLoss?.status === "EXCEEDED" ? <Notice title="Giảm cân cấp tốc vượt ngưỡng" danger/> : null}
        {result.weighIn.outcome === "PASSED" ? <Action label="Về chi tiết trận" onPress={() => clearToDetail(result, "Đã ghi cân chính thức")}/> : <>
          <Copy large strong>HLV muốn xử lý thế nào?</Copy>
          {result.weighIn.options.includes("CATCHWEIGHT") ? <Action label="Thoả thuận catchweight" onPress={() => go("catch")}/> : null}
          {result.weighIn.options.includes("CANCEL") ? <Action label="Huỷ trận" secondary danger onPress={() => go("cancel")}/> : null}
        </>}
      </> : null}
      {view === "catch" ? <>
        <Notice title="Giới hạn đã thoả thuận">Không thấp hơn số cân chính thức {kg(bout.officialWeightKg)} kg.</Notice>
        <WeightSlip label="Giới hạn catchweight mới" value={catchKg} onChange={setCatchKg} limit={kg(limit)} disabled={pending}/>
        <Field label="Ghi chú thoả thuận (tuỳ chọn)" value={catchNote} onChangeText={setCatchNote} multiline maxLength={500} editable={!pending}/>
        <Action label="Xác nhận catchweight" pending={pending} onPress={() => void mutate(async () => {
          const n = readKg(catchKg); if (bout.officialWeightKg == null || n < bout.officialWeightKg) throw new Error("Giới hạn mới không được thấp hơn số cân chính thức.");
          const b = preview ? { ...bout, catchweightKg: n, status: "WEIGHED_IN" as const } : await campApi.catchweight(bout.id, { catchweightKg: n, ...(catchNote.trim() ? { note: catchNote.trim() } : {}) }); clearToDetail(b, "Đã xác nhận catchweight");
        })}/>
      </> : null}
      {view === "cancel" ? <>
        <Frame tone="danger"><Copy large strong>{name}</Copy><Copy>{bout.eventName} · {bout.opponentName}</Copy><Copy>Trận sẽ chuyển sang trạng thái đã huỷ sau khi xác nhận.</Copy></Frame>
        <Field label="Lý do huỷ trận" value={reason} onChangeText={setReason} multiline maxLength={500} editable={!pending} helper="Từ 3 đến 500 ký tự"/>
        <Action label="Xác nhận huỷ trận" danger pending={pending} onPress={() => void mutate(async () => { if (reason.trim().length < 3) throw new Error("Lý do huỷ cần ít nhất 3 ký tự."); const b = preview ? { ...bout, status: "CANCELLED" as const } : await campApi.cancel(bout.id, reason.trim()); clearToDetail(b, "Đã huỷ trận"); })}/>
        <Action label="Giữ trận, quay lại" secondary disabled={pending} onPress={back}/>
      </> : null}
      {view === "corner" ? <CornerScreen bout={bout} name={name} preview={preview} onRounds={() => go("rounds")}/> : null}
      {view === "rounds" ? <RoundScreen bout={bout} preview={preview} onAdvice={() => go("advice")} draftState={roundDraftState} onDraftStateChange={setRoundDraftState}/> : null}
      {view === "advice" ? <AdviceScreen bout={bout} preview={preview}/> : null}
      {view === "opponent" ? <OpponentEditor bout={bout} preview={preview} onSaved={(analysis, missing) => setBout({ ...bout, opponentAnalysis: analysis, tacticsWithoutSessions: missing })}/> : null}
      {view === "report" ? <ReportScreen bout={bout} preview={preview}/> : null}
    </> : null}
  </CampShell>;
}
