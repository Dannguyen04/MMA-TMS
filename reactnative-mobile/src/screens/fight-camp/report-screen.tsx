import { useRef, useState } from "react";
import { View } from "react-native";
import { campApi, type CampDetail, type CampReport, type TacticOutcome } from "@/api/fight-camp";
import { isApiError } from "@/api/errors";
import { useThemePreference } from "@/theme";
import { boutReport as t } from "@/i18n/bout-report";
import { boutMethodText, boutResultText, improvementPointText, label, UNKNOWN_VALUE } from "@/i18n/backend-codes";
import { vnShortDate } from "@/utils/vn-date";
import { Action, Busy, CampIcon, Choices, Copy, Fact, Field, Frame, Notice, SvgTitle } from "./camp-ui";
import { campError, kg } from "./camp-rules";
import { useCampResource } from "./use-camp-resource";
import { readPreviewRounds } from "./preview-round-store";
import { previewReportFrom, savePreviewReview } from "./bout-report-model";
import { CampColumns } from "./camp-columns";
import { campText } from "@/i18n/fight-camp";

const NOTE_MAX = 300;
const marks: { value: TacticOutcome; label: string }[] = [{ value: "EFFECTIVE", label: campText.reportScreen.hieuQua }, { value: "INEFFECTIVE", label: campText.reportScreen.khongHieuQua }, { value: "NOT_USED", label: campText.reportScreen.chuaDung }];
type Loaded = { report: CampReport } | { notReady: true };
const pct = (n: number | null | undefined) => n == null ? UNKNOWN_VALUE : String(Math.round(n * 10) / 10).replace(".", ",");

export function ReportScreen({ bout, preview, onRounds }: { bout: CampDetail; preview: boolean; onRounds: () => void }) {
  const { colors: c } = useThemePreference();
  const state = useCampResource<Loaded>(`report:${bout.id}:${preview}`, async () => {
    if (preview) return { report: previewReportFrom(bout, readPreviewRounds(bout).rounds) };
    try { return { report: await campApi.report(bout.id) }; }
    catch (e) { if (isApiError(e) && (e.status === 409 || e.code === "BOUT_INVALID_TRANSITION")) return { notReady: true as const }; throw e; }
  });
  const [drafts, setDrafts] = useState<Record<string, { outcome?: TacticOutcome; note?: string }>>({});
  const [error, setError] = useState(""); const [success, setSuccess] = useState(false); const [pending, setPending] = useState(false); const lock = useRef(false);
  const loaded = state.data;
  if (state.loading && !loaded) return <Busy/>;
  if (!loaded) return state.error ? <><Notice title={t.loadFailed} danger>{state.error}</Notice><Action label={t.retry} secondary onPress={() => void state.reload()}/></> : null;
  if ("notReady" in loaded) return <Notice title={t.notReadyTitle}>{t.notReadyBody}</Notice>;
  const report = loaded.report;
  const rows = report.tactics.map(tac => {
    const d = drafts[tac.id];
    return { tac, outcome: d?.outcome ?? tac.review?.outcome ?? tac.outcome ?? "NOT_USED", note: d?.note ?? tac.review?.note ?? "", auto: !d && (!tac.review || tac.review.auto === true) };
  });
  const points = report.improvementPoints.map(improvementPointText).filter((s): s is string => !!s);
  const r = report.result;
  const acute = report.acuteLoss?.status === "EXCEEDED" ? report.acuteLoss : null;
  const edit = (id: string, change: { outcome?: TacticOutcome; note?: string }) => { setDrafts(p => ({ ...p, [id]: { ...p[id], ...change } })); setSuccess(false); setError(""); };
  const save = () => {
    if (lock.current) return;
    if (rows.some(x => x.note.length > NOTE_MAX)) { setError(t.fixNotes); setSuccess(false); return; }
    lock.current = true; setPending(true); setError("");
    // R5: gửi đủ mọi chiến thuật với giá trị đang hiện; HLV lưu nghĩa là xác nhận cả phần app điền sẵn.
    const input = rows.map(x => ({ tacticId: x.tac.id, outcome: x.outcome, ...(x.note.trim() ? { note: x.note.trim() } : {}) }));
    void (preview ? Promise.resolve(savePreviewReview(bout.id, input)) : campApi.review(bout.id, input))
      .then(async () => { setDrafts({}); await state.reload(); setSuccess(true); })
      .catch(e => setError(campError(e)))
      .finally(() => { lock.current = false; setPending(false); });
  };
  const resultFrame = <Frame>
      <Copy muted>{t.resultHeading}</Copy>
      <Copy large strong>{label(boutResultText, r.result)}</Copy>
      <Fact label={t.method} value={label(boutMethodText, r.method)}/>
      <Fact label={t.resultRound} value={r.resultRound == null ? UNKNOWN_VALUE : t.roundNo(r.resultRound)}/>
      <Fact label={t.knockedDown} value={r.knockedDown == null ? UNKNOWN_VALUE : r.knockedDown ? t.yes : t.no} danger={r.knockedDown === true}/>
    </Frame>;
  const pointsBlock = <>
    <SvgTitle small>{t.pointsHeading}</SvgTitle>
    {points.length ? <Frame tone="accent" pad={16}>{points.map((p, i) => <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}><View style={{ paddingTop: 1 }}><CampIcon name="arrow" color={c.lotus}/></View><View style={{ flex: 1 }}><Copy strong>{p}</Copy></View></View>)}</Frame> : <Copy muted>{t.pointsEmpty}</Copy>}
  </>;
  const tacticsBlock = <>
    <SvgTitle small>{t.tacticsHeading}</SvgTitle>
    {!report.roundsRecorded ? <>
      <Notice title={t.noRoundsTitle}>{t.noRoundsBody}</Notice>
      <Action label={t.goRounds} secondary onPress={onRounds}/>
    </> : <>
      {rows.map(({ tac, outcome, note, auto }) => {
        const long = note.length > NOTE_MAX;
        return <Frame key={tac.id}>
          <Copy large strong>{tac.text}</Copy>
          <Copy muted>{t.tacticCounts(tac.effectiveRounds, tac.ineffectiveRounds)}</Copy>
          {auto ? <Copy small strong color={c.lotus}>{t.autoFilled}</Copy> : null}
          <Choices<TacticOutcome> label={t.coachMark} value={outcome} disabled={pending} options={marks} onChange={o => edit(tac.id, { outcome: o })}/>
          <Field label={t.note} multiline editable={!pending} value={note} onChangeText={v => edit(tac.id, { note: v })} helper={t.noteCount(note.length)} error={long ? t.noteTooLong(note.length) : undefined}/>
        </Frame>;
      })}
      {error ? <Notice title={t.saveFailed} danger>{error}</Notice> : null}{success ? <Notice title={t.saved} success/> : null}
      {rows.length ? <Action label={t.save} pending={pending} onPress={save}/> : null}
    </>}
  </>;
  const restBlock = <>
    {report.observations.length ? <>
      <SvgTitle small>{t.observationsHeading}</SvgTitle>
      {report.observations.map(o => <Frame key={o.id} pad={16}><Copy>{o.text}</Copy><Copy muted strong={o.notSeenInBout}>{o.notSeenInBout ? t.notSeenOn(vnShortDate(bout.boutAt) || UNKNOWN_VALUE) : t.seenOrUnmarked}</Copy></Frame>)}
    </> : null}
    {acute ? <>
      <Notice title={t.acuteHeading} danger>{t.acuteBody(pct(acute.lossPct), pct(acute.limitPct), kg(acute.startKg), acute.startOn ? vnShortDate(acute.startOn) : "")}</Notice>
    </> : null}
  </>;
  // Phase 5 E: two columns from 900 (result and points | tactics, observations, weight loss); phone order below.
  return <CampColumns left={<>{resultFrame}{pointsBlock}</>} right={<>{tacticsBlock}{restBlock}</>}>
    {resultFrame}{pointsBlock}{tacticsBlock}{restBlock}
  </CampColumns>;
}
