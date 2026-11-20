import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Platform, Pressable, View } from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { campApi, type CampDetail, type CampBout, type WeighResult, type Hydration, type CursorPage, type Suspension } from "@/features/fight-camp/api";
import { getFighter } from "@/api/fighters/fighters";
import { useSession } from "@/session/session-context";
import { useThemePreference } from "@/theme/index";
import { Action, Busy, CampShell, Choices, Copy, Fact, Field, Frame, Notice, SectionTitle, WeightSlip } from "@/shared/ui/camp-ui";
import { campError, dateLabel, gate1, gateDecides, kg, liveSuspensions, readKg, requirementLabel, statusLabel } from "@/features/fight-camp/logic/camp-rules";
import { SuspensionCard } from "@/features/fight-camp/components/camp-suspension";
import { previewBout, previewSuspension } from "@/features/fight-camp/state/camp-preview";
import { CornerScreen, RoundScreen, ReportScreen, type RoundDraftState } from "./round-screens";
import { OpponentEditor } from "@/features/fight-camp/components/opponent-editor";
import { pendingVi } from "@/i18n/common/pending-vi";
import { CampInputError } from "@/features/fight-camp/logic/camp-input-error";
import { UNKNOWN_VALUE } from "@/i18n/common/backend-codes";
import { boutReport } from "@/features/fight-camp/i18n/bout-report";
import { BoutDetailTabs, type DetailTab } from "./bout-detail-tabs";
import { boutTabs } from "@/features/fight-camp/i18n/bout-tabs";
import { readableTextStyle } from "@/theme/typography";
import { Text } from "react-native";
import { campText } from "@/features/fight-camp/i18n/fight-camp";

export function CoachCampList() {
  const router = useRouter(); const { isDemo } = useSession();
  const [page, setPage] = useState<CursorPage<CampBout> | null>(null);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  const load = useCallback(async (more = false) => {
    setBusy(true); setError("");
    try {
      const next = isDemo ? { data: [previewBout], hasNextPage: false, nextCursor: null } : await campApi.list({ limit: 20, cursor: more && page?.nextCursor ? page.nextCursor : undefined, order: "desc" });
      if (alive.current) setPage(p => ({ ...next, data: more ? [...(p?.data ?? []), ...next.data] : next.data }));
    } catch (e) { if (alive.current) setError(campError(e)); } finally { if (alive.current) setBusy(false); }
  }, [isDemo, page?.nextCursor]);
  useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; }; }, [isDemo]);
  const [showDone, setShowDone] = useState(false);
  // Live bouts need the coach now: nearest fight first. Finished and cancelled stay newest first, folded below.
  const all = page?.data ?? [];
  const live = all.filter(b => !DONE.includes(b.status)).sort((a, b) => a.boutAt.localeCompare(b.boutAt));
  const done = all.filter(b => DONE.includes(b.status));
  const open = (b: CampBout) => router.push({ pathname: "/(coach)/fight-camp/bout", params: { id: b.id, preview: isDemo ? "1" : "0" } } as never);
  return <CampShell title={campText.coachCampScreen.tranThiDau} preview={isDemo}>
    {error ? <Notice title={campText.coachCampScreen.khongTaiDuocDanhSach} danger>{error}</Notice> : null}
    {busy && !page ? <Busy/> : null}
    {!busy && !error && page?.data.length === 0 ? <Notice title={campText.coachCampScreen.chuaCoTranThiDau}>{campText.coachCampScreen.cacTranCuaVoSi}</Notice> : null}
    {page && all.length ? <View testID="camp-live" style={{ gap: 12 }}>
      <Copy strong>{campText.coachCampScreen.dangChuanBi(live.length)}</Copy>
      {live.length ? live.map(b => <BoutCard key={b.id} bout={b} onPress={() => open(b)}/>) : <Copy muted>{campText.coachCampScreen.khongCoTranDangChuanBi}</Copy>}
    </View> : null}
    {done.length ? <View style={{ gap: 12 }}>
      <Action label={campText.coachCampScreen.daXong(done.length)} secondary onPress={() => setShowDone(v => !v)}/>
      {showDone ? done.map(b => <BoutCard key={b.id} bout={b} onPress={() => open(b)}/>) : null}
    </View> : null}
    <Action label={page?.hasNextPage ? campText.coachCampScreen.taiThemTran : campText.coachCampScreen.taiLaiDanhSach} secondary pending={busy} onPress={() => void load(!!page?.hasNextPage)}/>
  </CampShell>;
}

const DONE: readonly CampBout["status"][] = ["COMPLETED", "CANCELLED"];
/** One bout in the list: the whole card opens it. No per-card button or vector title (one title per screen). */
function BoutCard({ bout: b, onPress }: { bout: CampBout; onPress: () => void }) {
  const { colors: c } = useThemePreference();
  const finished = DONE.includes(b.status);
  return <Pressable accessibilityRole="button" accessibilityLabel={`${b.eventName}, ${statusLabel[b.status]}, ${dateLabel(b.boutAt)}`} accessibilityHint={campText.coachCampScreen.moChiTietTran} onPress={onPress}>
    <Frame pad={16}>
      <Copy muted>{statusLabel[b.status]} · {dateLabel(b.boutAt)}</Copy>
      <Copy large strong color={finished ? c.inkMuted : undefined}>{b.eventName}</Copy>
      <Copy muted>{campText.coachCampScreen.doiThu}{b.opponentName || campText.coachCampScreen.chuaXacDinh} · {kg(b.catchweightKg ?? b.weightLimitKg)} kg</Copy>
    </Frame>
  </Pressable>;
}

type Screen = "detail" | "weigh" | "decision" | "catch" | "cancel" | "corner" | "rounds" | "opponent" | "report";
const titles: Record<Screen, string> = { detail: campText.coachCampScreen.chiTietTran, weigh: campText.coachCampScreen.canChinhThuc, decision: campText.coachCampScreen.ketQuaCan, catch: campText.coachCampScreen.thoaThuan(pendingVi.catchweight), cancel: campText.coachCampScreen.xacNhanHuyTran, corner: campText.coachCampScreen.theGocDai, rounds: campText.coachCampScreen.ghiChuVaGhiHiep, opponent: campText.coachCampScreen.phanTichDoiThu, report: campText.coachCampScreen.baoCaoTran };
function previewWeighIn(bout: CampDetail, weightKg: number, limit: number, hydration: Hydration): WeighResult {
  const failed = weightKg > limit || hydration === "FAILED";
  return {
    ...bout,
    officialWeightKg: weightKg,
    hydrationCheck: hydration,
    madeWeight: weightKg <= limit,
    status: failed ? "FIGHT_WEEK" : "WEIGHED_IN",
    weighIn: {
      outcome: failed ? "FAILED" : "PASSED",
      reason: weightKg > limit ? "OVER_LIMIT" : hydration === "FAILED" ? "HYDRATION_FAILED" : null,
      overByKg: weightKg > limit ? weightKg - limit : null,
      overByPct: null,
      options: failed ? ["CATCHWEIGHT", "CANCEL"] : [],
    },
  };
}

function weighInOutcomeText(result: WeighResult): string {
  if (result.weighIn.outcome === "PASSED") return campText.coachCampScreen.datCanChinhThuc;
  if (result.weighIn.reason === "HYDRATION_FAILED") return campText.coachCampScreen.kiemTraNuocKhongDat;
  return campText.coachCampScreen.vuotKg(kg(result.weighIn.overByKg), result.weighIn.overByPct != null ? ` (${kg(result.weighIn.overByPct)}%)` : "");
}

function WeighInDecision({ result, go, onDone }: {
  result: WeighResult;
  go: (next: Screen) => void;
  onDone: () => void;
}) {
  const { colors: c } = useThemePreference();
  const passed = result.weighIn.outcome === "PASSED";
  return <>
    <Frame tone={passed ? "success" : "danger"}>
      <Copy muted>{campText.coachCampScreen.canChinhThuc3}</Copy>
      <Copy large strong>{kg(result.officialWeightKg)} {campText.coachCampScreen.kg}</Copy>
      <Copy strong color={passed ? c.success : c.danger}>{weighInOutcomeText(result)}</Copy>
      <Fact label={campText.coachCampScreen.gioiHan3} value={`${kg(result.catchweightKg ?? result.weightLimitKg)} kg`}/>
      <Fact label={campText.coachCampScreen.trangThaiTran} value={statusLabel[result.status]}/>
    </Frame>
    {result.acuteLoss?.status === "EXCEEDED" ? <Notice title={campText.coachCampScreen.giamCanCapTocVuot3} danger>{campText.coachCampScreen.giam2}{kg(result.acuteLoss.lossPct)}{campText.coachCampScreen.nguongTheoBoLuatLa2}{kg(result.acuteLoss.limitPct)}%.</Notice> : null}
    {passed ? <Action label={campText.coachCampScreen.veChiTietTran} onPress={onDone}/> : <>
      <Copy large strong>{campText.coachCampScreen.hlvMuonXuLyThe}</Copy>
      {result.weighIn.options.includes("CATCHWEIGHT") ? <Action label={campText.coachCampScreen.thoaThuan2(pendingVi.catchweight)} onPress={() => go("catch")}/> : null}
      {result.weighIn.options.includes("CANCEL") ? <Action label={campText.coachCampScreen.huyTran} secondary danger onPress={() => go("cancel")}/> : null}
    </>}
  </>;
}

function WeighInFields({ weight, setWeight, limit, pending, hydration, setHydration, notes, setNotes, acute }: {
  weight: string;
  setWeight: (value: string) => void;
  limit: number;
  pending: boolean;
  hydration: Hydration;
  setHydration: (value: Hydration) => void;
  notes: string;
  setNotes: (value: string) => void;
  acute: boolean;
}) {
  return <>
    <WeightSlip value={weight} onChange={setWeight} limit={kg(limit)} disabled={pending}/>
    <Choices<Hydration> label={campText.coachCampScreen.kiemTraNuoc} value={hydration} onChange={setHydration} disabled={pending} options={[{ value: "NOT_APPLICABLE", label: campText.coachCampScreen.khongApDung }, { value: "PASSED", label: campText.coachCampScreen.dat }, { value: "FAILED", label: campText.coachCampScreen.khongDat }]}/>
    <Field label={campText.coachCampScreen.ghiChuTuyChon} value={notes} onChangeText={setNotes} multiline maxLength={500} editable={!pending} helper={campText.coachCampScreen.t500KyTu(notes.length)}/>
    {acute ? <Notice title={campText.coachCampScreen.giamCanCapTocVuot2} danger>{campText.coachCampScreen.kiemTraCanhBaoTruoc}</Notice> : null}
  </>;
}

function CatchweightFields({ bout, catchKg, setCatchKg, limit, pending, catchNote, setCatchNote }: {
  bout: CampDetail;
  catchKg: string;
  setCatchKg: (value: string) => void;
  limit: number;
  pending: boolean;
  catchNote: string;
  setCatchNote: (value: string) => void;
}) {
  return <>
    <Notice title={campText.coachCampScreen.gioiHanDaThoaThuan}>{campText.coachCampScreen.khongThapHonSoCan}{kg(bout.officialWeightKg)} {campText.coachCampScreen.kg2}</Notice>
    <WeightSlip label={campText.coachCampScreen.gioiHanMoi(pendingVi.catchweight)} value={catchKg} onChange={setCatchKg} limit={kg(limit)} disabled={pending}/>
    <Field label={campText.coachCampScreen.ghiChuThoaThuanTuy} value={catchNote} onChangeText={setCatchNote} multiline maxLength={500} editable={!pending}/>
  </>;
}

function CancelBoutFields({ name, bout, reason, setReason, pending }: {
  name: string;
  bout: CampDetail;
  reason: string;
  setReason: (value: string) => void;
  pending: boolean;
}) {
  return <>
    <Frame tone="danger"><Copy large strong>{name}</Copy><Copy>{bout.eventName} · {bout.opponentName}</Copy><Copy>{campText.coachCampScreen.tranSeChuyenSangTrang}</Copy></Frame>
    <Field label={campText.coachCampScreen.lyDoHuyTran} value={reason} onChangeText={setReason} multiline maxLength={500} editable={!pending} helper={campText.coachCampScreen.tu3Den500Ky}/>
  </>;
}

export function CoachCampBout() {
  const params = useLocalSearchParams<{ id: string; preview?: string; view?: string }>(); const router = useRouter(); const { isDemo } = useSession();
  const preview = params.preview === "1" || isDemo;
  const [bout, setBout] = useState<CampDetail | null>(null); const [name, setName] = useState("");
  // Hôm nay's stage action opens straight on weigh-in or the corner card; back still lands on the bout detail.
  const entry: Screen = params.view === "weigh" || params.view === "corner" ? params.view : "detail";
  const [view, setView] = useState<Screen>(entry); const [history, setHistory] = useState<Screen[]>(entry === "detail" ? [] : ["detail"]);
  const [roundDraftState, setRoundDraftState] = useState<RoundDraftState>({ round: 0, values: {} });
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  // A different bout starts on its overview tab.
  useEffect(() => { setRoundDraftState({ round: 0, values: {} }); setDetailTab("overview"); }, [params.id, preview]);
  const [loading, setLoading] = useState(true); const [pending, setPending] = useState(false);
  const lock = useRef(false); const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  const [weight, setWeight] = useState(""); const [hydration, setHydration] = useState<Hydration>("NOT_APPLICABLE"); const [notes, setNotes] = useState("");
  const [result, setResult] = useState<WeighResult | null>(null); const [catchKg, setCatchKg] = useState(""); const [catchNote, setCatchNote] = useState(""); const [reason, setReason] = useState(campText.coachCampScreen.khongDatCan);
  const { colors: c } = useThemePreference(); const navigation = useNavigation();
  const [suspensions, setSuspensions] = useState<Suspension[] | null>(null); const [suspensionError, setSuspensionError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError(""); setSuspensionError("");
    try {
      const b = preview ? structuredClone(previewBout) : await campApi.detail(params.id);
      setBout(b);
      if (preview) { setName(campText.coachCampScreen.nguyenThanhLong); setSuspensions([previewSuspension]); }
      else {
        const [f, s] = await Promise.all([getFighter(b.fighterId), campApi.suspensions({ fighterId: b.fighterId }).then(p => p.data).catch((e: unknown) => { setSuspensionError(campError(e)); return null; })]);
        setName(`${f.firstName} ${f.lastName}`.trim()); setSuspensions(s);
      }
    } catch (e) { setError(campError(e)); } finally { setLoading(false); }
  }, [params.id, preview]);
  useEffect(() => { void load(); }, [load]);
  const go = (next: Screen) => { setHistory(h => [...h, view]); setView(next); setError(""); setSuccess(""); };
  const back = useCallback(() => {
    if (lock.current) return;
    if (history.length) { setView(history[history.length - 1]); setHistory(h => h.slice(0, -1)); setError(""); setSuccess(""); }
    else router.back();
  }, [history, router]);
  // In-bout screens (corner card, round entry, between-round advice) hide the coach tab bar: more room for the round
  // and no accidental tab taps at ringside. The back chevron still leaves.
  const inBout = view === "corner" || view === "rounds";
  useEffect(() => {
    const tabs = navigation.getParent();
    tabs?.setOptions({ tabBarStyle: inBout ? { display: "none" } : undefined });
    return () => { tabs?.setOptions({ tabBarStyle: undefined }); };
  }, [inBout, navigation]);
  useEffect(() => { if (Platform.OS === "web") return; const sub = BackHandler.addEventListener("hardwareBackPress", () => { back(); return true; }); return () => sub.remove(); }, [back]);
  // iOS edge-swipe (and any other pop) steps back one sub-view instead of leaving the bout and dropping the draft.
  const historyRef = useRef(history); historyRef.current = history;
  useEffect(() => navigation.addListener("beforeRemove", event => {
    if (lock.current) { event.preventDefault(); return; }
    if (historyRef.current.length) { event.preventDefault(); back(); }
  }), [navigation, back]);
  async function mutate(work: () => Promise<void>) {
    if (lock.current) return; lock.current = true; setPending(true); setError(""); setSuccess("");
    try { await work(); } catch (e) { setError(campError(e)); } finally { lock.current = false; setPending(false); }
  }
  const limit = bout ? bout.catchweightKg ?? bout.weightLimitKg : 0;
  const clearToDetail = (b: CampDetail, message: string) => { setBout(b); setView("detail"); setHistory([]); setSuccess(message); };
  const acute = bout?.acuteLoss?.status === "EXCEEDED";
  const privateReady = bout?.status === "WEIGHED_IN" || bout?.status === "COMPLETED";
  const gate = bout ? gate1(bout.requirements, bout.boutAt) : null;
  const gateBlocked = !!bout && !!gate && gateDecides(bout.status) && !gate.passed;
  const blocking = new Set([...(gate?.missing ?? []), ...(gate?.expiring ?? [])].map(i => i.code));
  const liveSusp = suspensions ? liveSuspensions(suspensions) : [];
  const footer = !bout || loading ? undefined
    : view === "weigh" ? <>
        <Action label={campText.coachCampScreen.ghiCanChinhThuc} pending={pending} onPress={() => void mutate(async () => {
          const weightKg = readKg(weight);
          const next: WeighResult = preview ? previewWeighIn(bout, weightKg, limit, hydration) : await campApi.weigh(bout.id, { weightKg, hydrationCheck: hydration, ...(notes.trim() ? { notes: notes.trim() } : {}) });
          setBout(next); setResult(next); setCatchKg(kg(next.officialWeightKg)); setHistory(["detail"]); setView("decision");
        })}/>
    </> : view === "catch" ? <>
        <Action label={campText.coachCampScreen.xacNhan(pendingVi.catchweight)} pending={pending} onPress={() => void mutate(async () => {
          const n = readKg(catchKg); if (bout.officialWeightKg == null || n < bout.officialWeightKg) throw new CampInputError(campText.coachCampScreen.gioiHanMoiKhongDuoc);
          const b = preview ? { ...bout, catchweightKg: n, status: "WEIGHED_IN" as const } : await campApi.catchweight(bout.id, { catchweightKg: n, ...(catchNote.trim() ? { note: catchNote.trim() } : {}) }); clearToDetail(b, campText.coachCampScreen.daXacNhan(pendingVi.catchweight));
        })}/>
    </> : view === "cancel" ? <>
        <Action label={campText.coachCampScreen.xacNhanHuyTran2} danger pending={pending} onPress={() => void mutate(async () => { if (reason.trim().length < 3) throw new CampInputError(campText.coachCampScreen.lyDoHuyCanIt); const b = preview ? { ...bout, status: "CANCELLED" as const } : await campApi.cancel(bout.id, reason.trim()); clearToDetail(b, campText.coachCampScreen.daHuyTran); })}/>
        <Action label={campText.coachCampScreen.giuTranQuayLai} secondary disabled={pending} onPress={back}/>
    </> : undefined;
  // Fixed on every bout view (owner 2026-11-11): fighter vs opponent, then status · event.
  const top = bout ? <View testID="bout-who">
    <Text style={{ ...readableTextStyle(16.5, true), color: c.ink }}>{name || campText.coachCampScreen.voSi2} <Text style={{ ...readableTextStyle(16.5), color: c.inkMuted }}>{boutTabs.vs}</Text> {bout.opponentName || boutTabs.opponentTbd}</Text>
    <Text style={{ ...readableTextStyle(13.5), color: c.inkMuted }}>{statusLabel[bout.status]} · {bout.eventName}</Text>
  </View> : undefined;
  return <CampShell columns={view === "detail" || view === "rounds" || view === "report" || view === "opponent"} title={titles[view]} top={top} onBack={back} preview={preview} footer={footer}>
    {loading ? <Busy/> : null}
    {error ? <><Notice title={campText.coachCampScreen.chuaThucHienDuoc} danger>{error}</Notice>{!bout ? <Action label={campText.coachCampScreen.thuTaiLai} onPress={() => void load()}/> : null}</> : null}
    {success ? <Notice title={success} success/> : null}
    {bout && !loading ? <>
      {view === "detail" ? <BoutDetailTabs bout={bout} preview={preview} tab={detailTab} onTab={setDetailTab} liveSusp={liveSusp} suspensionError={suspensionError}
        gate={gate} gateBlocked={gateBlocked} blocking={blocking} onGo={go} onPreviewStatus={st => setBout({ ...bout, status: st })}/> : null}
      {view === "weigh" ? <WeighInFields weight={weight} setWeight={setWeight} limit={limit} pending={pending} hydration={hydration} setHydration={setHydration} notes={notes} setNotes={setNotes} acute={acute}/> : null}
      {view === "decision" && result ? <WeighInDecision result={result} go={go} onDone={() => clearToDetail(result, campText.coachCampScreen.daGhiCanChinhThuc)}/> : null}
      {view === "catch" ? <CatchweightFields bout={bout} catchKg={catchKg} setCatchKg={setCatchKg} limit={limit} pending={pending} catchNote={catchNote} setCatchNote={setCatchNote}/> : null}
      {view === "cancel" ? <CancelBoutFields name={name} bout={bout} reason={reason} setReason={setReason} pending={pending}/> : null}
      {view === "corner" ? <CornerScreen bout={bout} name={name} preview={preview} onRounds={() => go("rounds")}/> : null}
      {view === "rounds" ? <RoundScreen bout={bout} preview={preview} onReport={() => go("report")} draftState={roundDraftState} onDraftStateChange={setRoundDraftState} onBoutChange={setBout}/> : null}
      {view === "opponent" ? <OpponentEditor bout={bout} preview={preview} onSaved={(analysis, missing) => setBout({ ...bout, opponentAnalysis: analysis, tacticsWithoutSessions: missing })}/> : null}
      {view === "report" ? <ReportScreen bout={bout} preview={preview} onRounds={() => go("rounds")}/> : null}
    </> : null}
  </CampShell>;
}
