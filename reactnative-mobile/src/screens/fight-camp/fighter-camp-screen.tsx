import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { View } from "react-native";
import { campApi, type CampDetail, type Suspension } from "@/api/fight-camp";
import { createFighterMeasurement, listFighterMeasurements, supersedeFighterMeasurement } from "@/api/fighters";
import { useSession } from "@/session/session-context";
import { useThemePreference } from "@/theme";
import { Action, Busy, CampShell, Copy, Fact, Frame, Notice, SvgTitle, WeightPlot, WeightSlip } from "./camp-ui";
import { SuspensionCard } from "./camp-suspension";
import { campError, dateLabel, gate1, gateDecides, isToday, kg, readKg, requirementLabel, statusLabel } from "./camp-rules";
import { useCampResource } from "./use-camp-resource";
import { previewBout, previewSuspension, previewSuspensionCases } from "./camp-preview";
import { FighterSuspensionCard, loadAllSuspensions } from "./fighter-suspension";
import { CampInputError } from "./camp-input-error";
import { UNKNOWN_VALUE } from "@/i18n/backend-codes";
import { campText } from "@/i18n/fight-camp";

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
const weightLabels = { ON_TRACK: campText.fighterCampScreen.dangTheoLoTrinh, ABOVE_TARGET: campText.fighterCampScreen.caoHonLoTrinh, OVER_LIMIT: campText.fighterCampScreen.vuotGioiHan, NOT_WEIGHED: campText.fighterCampScreen.chuaGhiCan, NEUTRAL: campText.fighterCampScreen.daQuaCanChinhThuc };
function useFighterCamp() {
  const { user, isDemo } = useSession();
  return useCampResource(`fighter-camp:${user?.id}:${isDemo}`, async () => {
    const bout = isDemo ? previewBout : await activeBout(user?.profile?.id);
    const track = bout ? isDemo ? { ...previewBout.weight, limitKg: 60, points: [{ date: "2026-10-24", kg: 61 }, { date: "2026-10-26", kg: 60.4 }] } : await campApi.weightTrack(bout.id) : null;
    // Suspensions are read-only context: a failure here must not hide the bout or the weight.
    const suspensions = isDemo ? previewSuspensionCases.active : await loadAllSuspensions().catch(() => null);
    return { bout, track, suspensions };
  });
}
export function FighterCampScreen() {
  const state = useFighterCamp(); const router = useRouter(); const { isDemo } = useSession(); const { colors: c } = useThemePreference();
  const first = useRef(true);
  useFocusEffect(useCallback(() => { if (first.current) { first.current = false; return; } void state.reload(); }, [state.reload]));
  const bout = state.data?.bout, track = state.data?.track;
  const loggedToday = isToday(track?.latestOn);
  const gate = bout ? gate1(bout.requirements, bout.boutAt) : null;
  const gateBlocked = !!bout && !!gate && gateDecides(bout.status) && !gate.passed;
  const blocking = new Set([...(gate?.missing ?? []), ...(gate?.expiring ?? [])].map(i => i.code));
  const record = () => router.push("/(fighter)/tran/can-nang" as never);
  const over = track?.status === "OVER_LIMIT";
  return <CampShell title={campText.fighterCampScreen.tranCuaToi} subtitle={campText.fighterCampScreen.lichThiDauVaSo} preview={isDemo}>
    {state.loading && !state.data ? <Busy/> : null}
    {state.error ? <><Notice title={campText.fighterCampScreen.khongTaiDuocTran} danger>{state.error}</Notice><Action label={campText.fighterCampScreen.thuTaiLai} secondary onPress={() => void state.reload()}/></> : null}
    {state.data ? <FighterSuspensionCard items={state.data.suspensions} error={state.data.suspensions === null} onRetry={() => void state.reload()}/> : null}
    {state.data && !bout ? <><Notice title={campText.fighterCampScreen.chuaCoTranSapToi}>{campText.fighterCampScreen.banVanCoTheGhi}</Notice><Action label={campText.fighterCampScreen.ghiCanHomNay} onPress={record}/></> : null}
    {bout ? <>
      {bout.weightReminder?.active && !loggedToday ? <Notice title={campText.fighterCampScreen.ghiCanHomNay2}>{bout.weightReminder.level === "YESTERDAY_MISSING" ? campText.fighterCampScreen.homQuaChuaCoSo : campText.fighterCampScreen.canSoCanHomNay}</Notice> : null}
      {track ? <Frame tone={over ? "danger" : undefined}>
        <Copy muted>{loggedToday ? campText.fighterCampScreen.soCanHomNay : campText.fighterCampScreen.soCanGanNhat(track.latestOn ? ` · ${dateLabel(track.latestOn)}` : "")}</Copy>
        <Copy large strong>{kg(track.latestKg)} {campText.fighterCampScreen.kg}</Copy>
        <Copy strong={over} color={over ? c.danger : c.ink}>{weightLabels[track.status]}{over && track.limitKg != null ? campText.fighterCampScreen.gioiHanKg(kg(track.limitKg)) : ""}</Copy>
        {over ? <Copy>{campText.fighterCampScreen.baoHlvDeThongNhat}</Copy> : null}
        {track.status !== "NEUTRAL" && track.remainingPct != null ? <Copy muted>{campText.fighterCampScreen.con}{kg(track.remainingPct)}{campText.fighterCampScreen.deChamGioiHan}</Copy> : null}
        <WeightPlot points={track.points} reference={track.referencePath} limit={track.limitKg}/>
      </Frame> : null}
      <Action label={loggedToday ? campText.fighterCampScreen.suaCanHomNay : campText.fighterCampScreen.ghiCanHomNay3} secondary={loggedToday} onPress={record}/>
      {gateBlocked && gate ? <Notice title={campText.fighterCampScreen.hoSoThiDauChua} danger>{[gate.missing.length ? campText.fighterCampScreen.conThieu(gate.missing.map(i => i.label).join(", ")) : "", gate.expiring.length ? campText.fighterCampScreen.hetHanTruocNgayThi(gate.expiring.map(i => i.label).join(", ")) : ""].filter(Boolean).join(" ")} {campText.fighterCampScreen.tranChuaVaoDuocTuan}</Notice> : null}
      <Frame><Copy color={c.lotus} strong>{statusLabel[bout.status]}</Copy><Copy large strong>{bout.eventName}</Copy><Copy muted>{campText.fighterCampScreen.doiThu}</Copy><Copy large strong>{bout.opponentName || campText.fighterCampScreen.chuaXacDinh}</Copy><Fact label={campText.fighterCampScreen.canChinhThuc} value={dateLabel(bout.weighInAt)}/><Fact label={campText.fighterCampScreen.thiDau} value={dateLabel(bout.boutAt)}/><Fact label={campText.fighterCampScreen.diaDiem} value={bout.venue || campText.fighterCampScreen.chuaXacDinh2}/><Fact label={campText.fighterCampScreen.gioiHan} value={`${kg(bout.catchweightKg ?? bout.weightLimitKg)} kg`}/></Frame>
      <SvgTitle small>{campText.fighterCampScreen.hoSoThiDau}</SvgTitle>
      {bout.requirements.length ? bout.requirements.map(r => <Fact key={r.code} label={r.label} danger={gateDecides(bout.status) && blocking.has(r.code)} value={requirementLabel[r.status] ?? UNKNOWN_VALUE}/>) : <Copy muted>{campText.fighterCampScreen.chuaCoMucHoSo}</Copy>}
    </> : null}
    <Action label={campText.fighterCampScreen.xemTrangThaiDinhChi} secondary onPress={() => router.push("/(fighter)/tran/dinh-chi" as never)}/>
  </CampShell>;
}
/** Demo-only memory of today's self-report, so the preview behaves like one entry per day. */
let demoToday: { id: string; kg: number; on: string } | null = null;
export function FighterDailyWeightScreen() {
  const state = useFighterCamp(); const { user, isDemo } = useSession(); const router = useRouter();
  const [text, setText] = useState(""); const [pending, setPending] = useState(false); const [error, setError] = useState(""); const [saved, setSaved] = useState<"" | "created" | "updated">(""); const lock = useRef(false);
  // One self-report per academy day: if today already has an entry, saving supersedes it.
  const [today, setToday] = useState<{ id: string; kg: number } | null>(null); const [todayError, setTodayError] = useState(""); const [todayLoading, setTodayLoading] = useState(true);
  const profileId = user?.profile?.id;
  const loadToday = useCallback(async () => {
    setTodayLoading(true); setTodayError("");
    try {
      if (isDemo) { setToday(demoToday && isToday(demoToday.on) ? demoToday : null); return; }
      if (!profileId) return;
      const latest = (await listFighterMeasurements(profileId, { limit: 1 })).data[0];
      setToday(latest && isToday(latest.measuredAt) ? { id: latest.id, kg: latest.weightKg } : null);
    } catch (e) { setTodayError(campError(e)); } finally { setTodayLoading(false); }
  }, [isDemo, profileId]);
  useEffect(() => { void loadToday(); }, [loadToday]);
  useEffect(() => { if (today && !text) setText(kg(today.kg)); }, [today]);
  const bout = state.data?.bout;
  const loading = state.loading || todayLoading;
  const editing = !!today;
  const save = () => {
    if (lock.current || loading) return;
    lock.current = true; setPending(true); setError("");
    void (async () => {
      const weightKg = readKg(text);
      if (isDemo) { demoToday = { id: today?.id ?? "demo-today", kg: weightKg, on: new Date().toISOString() }; setToday(demoToday); }
      else {
        if (!profileId) throw new CampInputError(campText.fighterCampScreen.khongTimThayHoSo);
        const body = { weightKg, measurementContext: "SELF_REPORTED" as const };
        const m = today ? await supersedeFighterMeasurement(profileId, today.id, body) : await createFighterMeasurement(profileId, body);
        setToday({ id: m.id, kg: m.weightKg });
      }
      setSaved(today ? "updated" : "created");
    })().catch(e => setError(campError(e))).finally(() => { lock.current = false; setPending(false); });
  };
  const footer = saved
    ? <Action label={bout ? campText.fighterCampScreen.veTranCuaToi : campText.fighterCampScreen.veTrangChu} onPress={() => router.replace((bout ? "/(fighter)/tran" : "/") as never)}/>
    : <Action label={editing ? campText.fighterCampScreen.luuSoCanDaSua : campText.fighterCampScreen.luuCanHomNay} pending={pending} disabled={loading || !!todayError} onPress={save}/>;
  return <CampShell title={editing ? campText.fighterCampScreen.suaCanHomNay2 : campText.fighterCampScreen.ghiCanHomNay4} subtitle={dateLabel(new Date().toISOString())} preview={isDemo} footer={footer}>
    {loading ? <Busy/> : null}
    {state.error ? <><Notice title={campText.fighterCampScreen.chuaTaiDuocThongTin} danger>{state.error}</Notice><Action label={campText.fighterCampScreen.thuTaiLai2} secondary onPress={() => void state.reload()}/></> : null}
    {todayError ? <><Notice title={campText.fighterCampScreen.chuaKiemTraDuocSo} danger>{todayError} {campText.fighterCampScreen.canKiemTraTruocKhi}</Notice><Action label={campText.fighterCampScreen.thuTaiLai3} secondary onPress={() => void loadToday()}/></> : null}
    <Copy>{campText.fighterCampScreen.ghiSoCanBanVua}</Copy>
    {editing && !saved ? <Notice title={campText.fighterCampScreen.homNayDaGhiKg(kg(today.kg))}>{campText.fighterCampScreen.moiNgayChiGiuMot}</Notice> : null}
    <WeightSlip label={campText.fighterCampScreen.canNangHomNay} value={text} onChange={v => { setText(v); setSaved(""); }} limit={bout ? kg(bout.catchweightKg ?? bout.weightLimitKg) : null} disabled={pending || loading}/>
    {!bout && !state.loading && !state.error ? <Copy muted>{campText.fighterCampScreen.chuaCoTranSapToi2}</Copy> : null}
    {error ? <Notice title={campText.fighterCampScreen.chuaGhiDuocCan} danger>{error}</Notice> : null}
    {saved ? <Notice title={isDemo ? campText.fighterCampScreen.daGhiCanTrongBan : saved === "updated" ? campText.fighterCampScreen.daLuuSoCanHom : campText.fighterCampScreen.daGhiCanHomNay} success/> : null}
  </CampShell>;
}
export function FighterSuspensionsScreen() {
  const { user, isDemo } = useSession(); const [extra, setExtra] = useState<Suspension[]>([]); const [moreBusy, setMoreBusy] = useState(false); const [error, setError] = useState(""); const [cursor, setCursor] = useState<string | null>(null);
  const state = useCampResource(`suspensions:${user?.id}:${isDemo}`, async () => {
    const page = isDemo ? { data: [previewSuspension], nextCursor: null, hasNextPage: false } : await campApi.suspensions();
    setCursor(page.hasNextPage ? page.nextCursor : null); setExtra([]); return page;
  });
  return <CampShell title={campText.fighterCampScreen.trangThaiDinhChi} subtitle={campText.fighterCampScreen.thongTinTuHoSo} preview={isDemo}>
    {state.loading ? <Busy/> : null}
    {state.error || error ? <><Notice title={campText.fighterCampScreen.khongTaiDuocHoSo} danger>{state.error || error}</Notice><Action label={campText.fighterCampScreen.thuTaiLai4} secondary onPress={() => { setError(""); void state.reload(); }}/></> : null}
    {state.data && !state.data.data.length ? <Notice title={campText.fighterCampScreen.chuaCoBanGhiDinh}>{campText.fighterCampScreen.khongCoDinhChiNao}</Notice> : null}
    {[...(state.data?.data ?? []), ...extra].map(s => <SuspensionCard key={s.id} s={s}/>)}
    {cursor ? <Action label={campText.fighterCampScreen.taiThemBanGhi} secondary pending={moreBusy} onPress={() => { setMoreBusy(true); setError(""); void campApi.suspensions({ cursor }).then(p => { setExtra(items => [...items, ...p.data]); setCursor(p.hasNextPage ? p.nextCursor : null); }).catch(e => setError(campError(e))).finally(() => setMoreBusy(false)); }}/> : null}
    <Copy muted>{campText.fighterCampScreen.buoiTapCuTheCon}</Copy>
  </CampShell>;
}
