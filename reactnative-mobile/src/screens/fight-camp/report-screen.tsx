import { useRef, useState } from "react";
import { Swap } from "@/components/motion-kit";
import { Pressable, Text, View } from "react-native";
import { campApi, type CampDetail, type CampReport, type TacticOutcome } from "@/api/fight-camp";
import { isApiError } from "@/api/errors";
import { useThemePreference } from "@/theme";
import { boutReport as t } from "@/i18n/bout-report";
import { boutMethodText, boutResultText, improvementPointText, label, UNKNOWN_VALUE } from "@/i18n/backend-codes";
import { vnShortDate } from "@/utils/vn-date";
import { Action, Busy, CampIcon, CampTop, Choices, Copy, Field, Frame, Notice } from "./camp-ui";
import { CampTabs, FitList } from "./camp-lit";
import { SlideSheet } from "@/components/ui/slide-sheet";
import { boutTabs } from "@/i18n/bout-tabs";
import { fonts, fz } from "@/theme/typography";
import { readableTextStyle } from "@/theme/typography";
import { useCampTwoColumns } from "./camp-columns";
import { campError, kg } from "./camp-rules";
import { useCampResource } from "./use-camp-resource";
import { readPreviewRounds } from "./preview-round-store";
import { previewReportFrom, savePreviewReview } from "./bout-report-model";
import { campText } from "@/i18n/fight-camp";

const NOTE_MAX = 300;
const marks: { value: TacticOutcome; label: string; tone?: "good" | "bad" }[] = [{ value: "EFFECTIVE", label: campText.reportScreen.hieuQua, tone: "good" }, { value: "INEFFECTIVE", label: campText.reportScreen.khongHieuQua, tone: "bad" }, { value: "NOT_USED", label: campText.reportScreen.chuaDung }];
type Loaded = { report: CampReport } | { notReady: true };
const pct = (n: number | null | undefined) => n == null ? UNKNOWN_VALUE : String(Math.round(n * 10) / 10).replace(".", ",");

export function ReportScreen({ bout, preview, onRounds }: { bout: CampDetail; preview: boolean; onRounds: () => void }) {
  const { colors: c } = useThemePreference();
  const state = useCampResource<Loaded>(`report:${bout.id}:${preview}`, async () => {
    if (preview) return { report: previewReportFrom(bout, readPreviewRounds(bout).rounds) };
    try { return { report: await campApi.report(bout.id) }; }
    catch (e) { if (isApiError(e) && (e.status === 409 || e.code === "BOUT_INVALID_TRANSITION")) return { notReady: true as const }; throw e; }
  });
  const wide = useCampTwoColumns();
  const [tab, setTab] = useState<"improve" | "tactics" | "observations">("improve");
  const [sheet, setSheet] = useState<"points" | "tactics" | "observations" | null>(null);
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
  // Pinned with the tabs: the result in one line (result · method · round).
  const resultLine = <Text testID="report-result" style={{ ...readableTextStyle(14, true), color: c.ink }}>
    {[label(boutResultText, r.result), label(boutMethodText, r.method), r.resultRound == null ? null : t.roundNo(r.resultRound), r.knockedDown ? t.knockedDown : null].filter(Boolean).join(" · ")}
  </Text>;
  const pointRow = (p: string, i: number) => <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10, borderBottomColor: c.line, borderBottomWidth: 1 }}>
    <View style={{ paddingTop: 1 }}><CampIcon name="arrow" color={c.lotus}/></View><View style={{ flex: 1 }}><Copy strong>{p}</Copy></View></View>;
  const acuteNotice = acute ? <Notice title={t.acuteHeading} danger>{t.acuteBody(pct(acute.lossPct), pct(acute.limitPct), kg(acute.startKg), acute.startOn ? vnShortDate(acute.startOn) : "")}</Notice> : null;
  const improve = <View style={{ gap: 14 }}>
    {points.length ? <View><FitList items={points} max={wide ? 6 : 3} moreLabel={boutTabs.more} render={pointRow} onMore={() => setSheet("points")}/></View> : <Copy>{boutTabs.noPoints}</Copy>}
    {acuteNotice}
  </View>;
  const tacticCard = ({ tac, outcome, note, auto }: (typeof rows)[number], withNote: boolean) => {
    const long = note.length > NOTE_MAX;
    return <View key={tac.id} style={{ gap: 8, paddingVertical: 10, borderBottomColor: c.line, borderBottomWidth: 1 }}>
      <Copy strong>{tac.text}</Copy>
      <Copy muted>{t.tacticCounts(tac.effectiveRounds, tac.ineffectiveRounds)}{auto ? ` · ${t.autoFilled}` : ""}</Copy>
      <Choices<TacticOutcome> chips label={undefined} value={outcome} disabled={pending} options={marks} onChange={o => edit(tac.id, { outcome: o })}/>
      {withNote ? <Field label={t.note} multiline editable={!pending} value={note} onChangeText={v => edit(tac.id, { note: v })} helper={t.noteCount(note.length)} error={long ? t.noteTooLong(note.length) : undefined}/> : null}
    </View>;
  };
  const tacticsTab = !report.roundsRecorded ? <View style={{ gap: 12 }}>
      <Notice title={t.noRoundsTitle}>{t.noRoundsBody}</Notice>
      <Action label={t.goRounds} secondary onPress={onRounds}/>
    </View> : <View style={{ gap: 12 }}>
      <View><FitList items={rows} max={wide ? 4 : 2} moreLabel={boutTabs.more} render={x => tacticCard(x, false)} onMore={() => setSheet("tactics")}/></View>
      {rows.length ? <NoteLink label={t.note} onPress={() => setSheet("tactics")}/> : null}
      {error ? <Notice title={t.saveFailed} danger>{error}</Notice> : null}{success ? <Notice title={t.saved} success/> : null}
      {rows.length ? <Action label={t.save} pending={pending} onPress={save}/> : null}
    </View>;
  const obsRow = (o: CampReport["observations"][number]) => <View key={o.id} style={{ flexDirection: "row", gap: 12, alignItems: "center", minHeight: 46, paddingVertical: 8, borderBottomColor: c.line, borderBottomWidth: 1 }}>
    <View style={{ flex: 1 }}><Copy strong>{o.text}</Copy></View>
    <Text style={{ ...readableTextStyle(13, true), color: o.notSeenInBout ? c.danger : c.inkMuted }}>{o.notSeenInBout ? t.notSeenOn(vnShortDate(bout.boutAt) || UNKNOWN_VALUE) : boutTabs.seen}</Text>
  </View>;
  const observationsTab = report.observations.length
    ? <View><FitList items={report.observations} max={wide ? 8 : 5} moreLabel={boutTabs.more} render={obsRow} onMore={() => setSheet("observations")}/></View>
    : <Copy>{boutTabs.noObservations}</Copy>;
  return <>
    <CampTop>
      {resultLine}
      <CampTabs alertLabel={boutTabs.needsAttention} value={tab} onChange={setTab} tabs={[
        { key: "improve", label: boutTabs.report.improve, alert: !!acute },
        { key: "tactics", label: boutTabs.report.tactics },
        { key: "observations", label: boutTabs.report.observations, alert: report.observations.some(o => o.notSeenInBout) },
      ]}/>
    </CampTop>
    <Swap swapKey={tab} testID={`report-tab-${tab}`}>{tab === "improve" ? improve : tab === "tactics" ? tacticsTab : observationsTab}</Swap>
    <SlideSheet visible={sheet !== null} onClose={() => setSheet(null)} title={sheet === "points" ? boutTabs.allPoints : sheet === "tactics" ? boutTabs.allReviews : boutTabs.allObservations}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 8, gap: 4 }}>
        {sheet === "points" ? points.map(pointRow) : null}
        {sheet === "tactics" ? rows.map(x => tacticCard(x, true)) : null}
        {sheet === "observations" ? report.observations.map(obsRow) : null}
      </View>
    </SlideSheet>
  </>;
}

function NoteLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors: c } = useThemePreference();
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ minHeight: 44, justifyContent: "center", alignSelf: "flex-start", opacity: pressed ? 0.7 : 1 })}>
    <Text style={{ fontFamily: fonts.display, fontSize: fz(16), color: c.lotus }}>{label}</Text>
  </Pressable>;
}
