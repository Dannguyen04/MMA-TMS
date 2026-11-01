import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Platform, View } from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { campApi, type CampDetail, type CampBout, type WeighResult, type Hydration, type CursorPage, type Suspension } from "@/api/fight-camp";
import { getFighter } from "@/api/fighters";
import { useSession } from "@/session/session-context";
import { useThemePreference } from "@/theme";
import { Action, Busy, CampShell, Choices, Copy, Fact, Field, Frame, Notice, SvgTitle, WeightSlip } from "./camp-ui";
import { campError, dateLabel, gate1, gateDecides, kg, liveSuspensions, readKg, requirementLabel, statusLabel } from "./camp-rules";
import { SuspensionCard } from "./camp-suspension";
import { previewBout, previewSuspension } from "./camp-preview";
import { CornerScreen, RoundScreen, AdviceScreen, ReportScreen, type RoundDraftState } from "./round-screens";
import { OpponentEditor } from "./opponent-editor";
import { pendingVi } from "@/i18n/pending-vi";
import { CampInputError } from "./camp-input-error";
import { UNKNOWN_VALUE } from "@/i18n/backend-codes";
import { boutReport } from "@/i18n/bout-report";
import { CampColumns } from "./camp-columns";
import { campText } from "@/i18n/fight-camp";

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
  return <CampShell title={campText.coachCampScreen.tranThiDau} subtitle={campText.coachCampScreen.canChinhThucChuanBi} preview={isDemo}>
    <Action label={campText.coachCampScreen.xemBanMauGiaoDien} secondary onPress={() => router.push({ pathname: "/(coach)/fight-camp/bout", params: { id: "preview", preview: "1" } } as never)}/>
    {error ? <Notice title={campText.coachCampScreen.khongTaiDuocDanhSach} danger>{error}</Notice> : null}
    {busy && !page ? <Busy/> : null}
    {!busy && !error && page?.data.length === 0 ? <Notice title={campText.coachCampScreen.chuaCoTranThiDau}>{campText.coachCampScreen.cacTranCuaVoSi}</Notice> : null}
    {page?.data.map(b => <Frame key={b.id}>
      <Copy muted>{statusLabel[b.status]} · {dateLabel(b.boutAt)}</Copy>
      <SvgTitle small>{b.eventName}</SvgTitle>
      <Copy large strong>{campText.coachCampScreen.doiThu}{b.opponentName || campText.coachCampScreen.chuaXacDinh}</Copy>
      <Fact label={campText.coachCampScreen.gioiHan} value={`${kg(b.catchweightKg ?? b.weightLimitKg)} kg`}/>
      <Action label={campText.coachCampScreen.moChiTietTran} onPress={() => router.push({ pathname: "/(coach)/fight-camp/bout", params: { id: b.id, preview: isDemo ? "1" : "0" } } as never)}/>
    </Frame>)}
    <Action label={page?.hasNextPage ? campText.coachCampScreen.taiThemTran : campText.coachCampScreen.taiLaiDanhSach} secondary pending={busy} onPress={() => void load(!!page?.hasNextPage)}/>
  </CampShell>;
}

type Screen = "detail" | "weigh" | "decision" | "catch" | "cancel" | "corner" | "rounds" | "advice" | "opponent" | "report";
const titles: Record<Screen, string> = { detail: campText.coachCampScreen.chiTietTran, weigh: campText.coachCampScreen.canChinhThuc, decision: campText.coachCampScreen.ketQuaCan, catch: campText.coachCampScreen.thoaThuan(pendingVi.catchweight), cancel: campText.coachCampScreen.xacNhanHuyTran, corner: campText.coachCampScreen.theGocDai, rounds: campText.coachCampScreen.ghiChuVaGhiHiep, advice: campText.coachCampScreen.loiDanGiuaHiep, opponent: campText.coachCampScreen.phanTichDoiThu, report: campText.coachCampScreen.baoCaoTran };
export function CoachCampBout() {
  const params = useLocalSearchParams<{ id: string; preview?: string }>(); const router = useRouter(); const { isDemo } = useSession();
  const preview = params.preview === "1" || isDemo;
  const [bout, setBout] = useState<CampDetail | null>(null); const [name, setName] = useState("");
  const [view, setView] = useState<Screen>("detail"); const [history, setHistory] = useState<Screen[]>([]);
  const [roundDraftState, setRoundDraftState] = useState<RoundDraftState>({ round: 0, values: {} });
  useEffect(() => { setRoundDraftState({ round: 0, values: {} }); }, [params.id, preview]);
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
          const failed = weightKg > limit || hydration === "FAILED";
          const next: WeighResult = preview ? { ...bout, officialWeightKg: weightKg, hydrationCheck: hydration, madeWeight: weightKg <= limit, status: failed ? "FIGHT_WEEK" : "WEIGHED_IN", weighIn: { outcome: failed ? "FAILED" : "PASSED", reason: weightKg > limit ? "OVER_LIMIT" : hydration === "FAILED" ? "HYDRATION_FAILED" : null, overByKg: weightKg > limit ? weightKg - limit : null, overByPct: null, options: failed ? ["CATCHWEIGHT", "CANCEL"] : [] } } : await campApi.weigh(bout.id, { weightKg, hydrationCheck: hydration, ...(notes.trim() ? { notes: notes.trim() } : {}) });
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
  // Phase 5 E: bout detail in two columns from 900 (bout, weight loss, actions | gate, suspensions, requirements).
  const detail = bout ? {
    info: <>
      <Frame><Copy color={c.lotus} strong>{statusLabel[bout.status]}</Copy><Copy large strong>{name || campText.coachCampScreen.voSi}</Copy><Copy muted>{campText.coachCampScreen.dauVoi}</Copy><Copy large strong>{bout.opponentName || campText.coachCampScreen.doiThuChuaXacDinh}</Copy><Fact label={campText.coachCampScreen.canChinhThuc2} value={dateLabel(bout.weighInAt)}/><Fact label={campText.coachCampScreen.thiDau} value={dateLabel(bout.boutAt)}/><Fact label={campText.coachCampScreen.diaDiem} value={bout.venue || campText.coachCampScreen.chuaXacDinh2}/><Fact label={campText.coachCampScreen.gioiHan2} value={`${kg(limit)} kg`}/><Fact label={campText.coachCampScreen.soHiep} value={bout.scheduledRounds == null ? campText.coachCampScreen.chuaDat : String(bout.scheduledRounds)}/></Frame>
    </>,
    gate: <>
      {gateBlocked && gate ? <Notice title={campText.coachCampScreen.chuaDuHoSoDe} danger>
        {[gate.missing.length ? campText.coachCampScreen.conThieu(gate.missing.map(i => i.label).join(", ")) : "", gate.expiring.length ? campText.coachCampScreen.hetHanTruocNgayThi(gate.expiring.map(i => i.label).join(", ")) : ""].filter(Boolean).join(" ")} {campText.coachCampScreen.mucBatBuocPhaiDuoc}</Notice> : null}
    </>,
    suspension: <>
      {liveSusp.length ? <View style={{ gap: 12 }}>
        <Notice title={campText.coachCampScreen.voSiDangCoDinh} danger>{campText.coachCampScreen.buoiTapThuocLoaiBi}</Notice>
        {liveSusp.map(s => <SuspensionCard key={s.id} s={s}/>)}
      </View> : null}
      {suspensionError ? <Notice title={campText.coachCampScreen.chuaTaiDuocTrangThai} danger>{suspensionError}</Notice> : null}
    </>,
    acute: <>
      {acute ? <Notice title={campText.coachCampScreen.giamCanCapTocVuot} danger>{campText.coachCampScreen.giam}{kg(bout.acuteLoss?.lossPct)}{campText.coachCampScreen.nguongTheoBoLuatLa}{kg(bout.acuteLoss?.limitPct)}%.</Notice> : null}
    </>,
    actions: <>
      {bout.status === "FIGHT_WEEK" ? <Action label={campText.coachCampScreen.ghiCanChinhThuc2} onPress={() => go("weigh")}/> : null}
      {bout.status === "COMPLETED" ? <Action label={boutReport.openReport} onPress={() => go("report")}/> : null}
      {privateReady ? <><Action label={campText.coachCampScreen.moTheGocDai} secondary={bout.status === "COMPLETED"} onPress={() => go("corner")}/><Action label={campText.coachCampScreen.ghiChuVaGhiHiep2} secondary onPress={() => go("rounds")}/></> : <Copy muted>{campText.coachCampScreen.theGocDaiVaGhi}</Copy>}
      <Action label={campText.coachCampScreen.phanTichDoiThu2} secondary onPress={() => go("opponent")}/>
    </>,
    requirements: <>
      <SvgTitle small>{campText.coachCampScreen.hoSoThiDau}</SvgTitle>
      {bout.requirements.length ? bout.requirements.map(r => <Fact key={r.code} label={r.label} danger={gateDecides(bout.status) && blocking.has(r.code)} value={requirementLabel[r.status] ?? UNKNOWN_VALUE}/>) : <Copy muted>{campText.coachCampScreen.chuaCoMucHoSo}</Copy>}
    </>,
  } : null;
  return <CampShell columns={view === "detail" || view === "rounds" || view === "report"} title={titles[view]} compactTitle={view === "rounds"} subtitle={bout ? `${name || campText.coachCampScreen.voSi2} · ${bout.eventName}` : undefined} onBack={back} preview={preview} footer={footer}>
    {loading ? <Busy/> : null}
    {error ? <><Notice title={campText.coachCampScreen.chuaThucHienDuoc} danger>{error}</Notice>{!bout ? <Action label={campText.coachCampScreen.thuTaiLai} onPress={() => void load()}/> : null}</> : null}
    {success ? <Notice title={success} success/> : null}
    {bout && !loading ? <>
      {preview && view === "detail" ? <Choices label={campText.coachCampScreen.trangThaiMauDeXem} value={bout.status} options={[{ value: "FIGHT_WEEK", label: campText.coachCampScreen.tuanThiDau }, { value: "WEIGHED_IN", label: campText.coachCampScreen.daCan }, { value: "COMPLETED", label: campText.coachCampScreen.ketThuc }]} onChange={s => setBout({ ...bout, status: s })}/> : null}
      {view === "detail" && detail ? <CampColumns left={<>{detail.info}{detail.acute}{detail.actions}</>} right={<>{detail.gate}{detail.suspension}{detail.requirements}</>}>
        {detail.info}{detail.gate}{detail.suspension}{detail.acute}{detail.actions}{detail.requirements}
      </CampColumns> : null}
      {view === "weigh" ? <>
        <WeightSlip value={weight} onChange={setWeight} limit={kg(limit)} disabled={pending}/>
        <Choices<Hydration> label={campText.coachCampScreen.kiemTraNuoc} value={hydration} onChange={setHydration} disabled={pending} options={[{ value: "NOT_APPLICABLE", label: campText.coachCampScreen.khongApDung }, { value: "PASSED", label: campText.coachCampScreen.dat }, { value: "FAILED", label: campText.coachCampScreen.khongDat }]}/>
        <Field label={campText.coachCampScreen.ghiChuTuyChon} value={notes} onChangeText={setNotes} multiline maxLength={500} editable={!pending} helper={campText.coachCampScreen.t500KyTu(notes.length)}/>
        {acute ? <Notice title={campText.coachCampScreen.giamCanCapTocVuot2} danger>{campText.coachCampScreen.kiemTraCanhBaoTruoc}</Notice> : null}
      </> : null}
      {view === "decision" && result ? <>
        <Frame tone={result.weighIn.outcome === "PASSED" ? "success" : "danger"}><Copy muted>{campText.coachCampScreen.canChinhThuc3}</Copy><Copy large strong>{kg(result.officialWeightKg)} {campText.coachCampScreen.kg}</Copy><Copy strong color={result.weighIn.outcome === "PASSED" ? c.success : c.danger}>{result.weighIn.outcome === "PASSED" ? campText.coachCampScreen.datCanChinhThuc : result.weighIn.reason === "HYDRATION_FAILED" ? campText.coachCampScreen.kiemTraNuocKhongDat : campText.coachCampScreen.vuotKg(kg(result.weighIn.overByKg), result.weighIn.overByPct != null ? ` (${kg(result.weighIn.overByPct)}%)` : "")}</Copy><Fact label={campText.coachCampScreen.gioiHan3} value={`${kg(result.catchweightKg ?? result.weightLimitKg)} kg`}/><Fact label={campText.coachCampScreen.trangThaiTran} value={statusLabel[result.status]}/></Frame>
        {result.acuteLoss?.status === "EXCEEDED" ? <Notice title={campText.coachCampScreen.giamCanCapTocVuot3} danger>{campText.coachCampScreen.giam2}{kg(result.acuteLoss.lossPct)}{campText.coachCampScreen.nguongTheoBoLuatLa2}{kg(result.acuteLoss.limitPct)}%.</Notice> : null}
        {result.weighIn.outcome === "PASSED" ? <Action label={campText.coachCampScreen.veChiTietTran} onPress={() => clearToDetail(result, campText.coachCampScreen.daGhiCanChinhThuc)}/> : <>
          <Copy large strong>{campText.coachCampScreen.hlvMuonXuLyThe}</Copy>
          <Copy muted>{campText.coachCampScreen.tranVanOTuanThi}</Copy>
          {result.weighIn.options.includes("CATCHWEIGHT") ? <Action label={campText.coachCampScreen.thoaThuan2(pendingVi.catchweight)} onPress={() => go("catch")}/> : null}
          {result.weighIn.options.includes("CANCEL") ? <Action label={campText.coachCampScreen.huyTran} secondary danger onPress={() => go("cancel")}/> : null}
        </>}
      </> : null}
      {view === "catch" ? <>
        <Notice title={campText.coachCampScreen.gioiHanDaThoaThuan}>{campText.coachCampScreen.khongThapHonSoCan}{kg(bout.officialWeightKg)} {campText.coachCampScreen.kg2}</Notice>
        <WeightSlip label={campText.coachCampScreen.gioiHanMoi(pendingVi.catchweight)} value={catchKg} onChange={setCatchKg} limit={kg(limit)} disabled={pending}/>
        <Field label={campText.coachCampScreen.ghiChuThoaThuanTuy} value={catchNote} onChangeText={setCatchNote} multiline maxLength={500} editable={!pending}/>
      </> : null}
      {view === "cancel" ? <>
        <Frame tone="danger"><Copy large strong>{name}</Copy><Copy>{bout.eventName} · {bout.opponentName}</Copy><Copy>{campText.coachCampScreen.tranSeChuyenSangTrang}</Copy></Frame>
        <Field label={campText.coachCampScreen.lyDoHuyTran} value={reason} onChangeText={setReason} multiline maxLength={500} editable={!pending} helper={campText.coachCampScreen.tu3Den500Ky}/>
      </> : null}
      {view === "corner" ? <CornerScreen bout={bout} name={name} preview={preview} onRounds={() => go("rounds")}/> : null}
      {view === "rounds" ? <RoundScreen bout={bout} preview={preview} onAdvice={() => go("advice")} onReport={() => go("report")} draftState={roundDraftState} onDraftStateChange={setRoundDraftState}/> : null}
      {view === "advice" ? <AdviceScreen bout={bout} preview={preview}/> : null}
      {view === "opponent" ? <OpponentEditor bout={bout} preview={preview} onSaved={(analysis, missing) => setBout({ ...bout, opponentAnalysis: analysis, tacticsWithoutSessions: missing })}/> : null}
      {view === "report" ? <ReportScreen bout={bout} preview={preview} onRounds={() => go("rounds")}/> : null}
    </> : null}
  </CampShell>;
}
