import { useEffect, useState, type ReactNode } from "react";
import { Swap } from "@/components/motion-kit";
import { Pressable, Text, View } from "react-native";
import { campApi, type CampDetail, type Suspension, type WeightTrack } from "@/features/fight-camp/api";
import { SlideSheet } from "@/components/ui/slide-sheet";
import { boutTabs as t } from "@/features/fight-camp/i18n/bout-tabs";
import { boutReport } from "@/features/fight-camp/i18n/bout-report";
import { campText } from "@/features/fight-camp/i18n/fight-camp";
import { UNKNOWN_VALUE } from "@/i18n/backend-codes";
import { useThemePreference } from "@/theme/index";
import { fonts, fz, lh } from "@/theme/typography";
import { readableTextStyle } from "@/theme/typography";
import { Action, CampTop, Choices, Copy, Fact, Notice, WeightPlot } from "@/shared/ui/camp-ui";
import { CampTabs, FitList } from "@/shared/ui/camp-lit";
import { dateLabel, gateDecides, kg, requirementLabel } from "@/features/fight-camp/logic/camp-rules";
import { SuspensionCard } from "@/features/fight-camp/components/camp-suspension";
import { useCampTwoColumns } from "@/shared/ui/camp-columns";

export type DetailTab = "overview" | "weight" | "papers" | "opponent";
type Gate = { missing: { code: string; label: string }[]; expiring: { code: string; label: string }[]; passed: boolean };
type Sheet = { title: string; body: ReactNode } | null;

/**
 * Bout detail as four tabs (owner 2026-11-11): Tổng quan · Cân · Hồ sơ · Đối thủ. Each tab holds what fits one phone
 * screen; longer lists show the first items and open the rest in a sheet. Actions live inside their tab.
 */
export function BoutDetailTabs({ bout, preview, tab, onTab, liveSusp, suspensionError, gate, gateBlocked, blocking, onGo, onPreviewStatus }: {
  bout: CampDetail; preview: boolean; tab: DetailTab; onTab: (t: DetailTab) => void;
  liveSusp: Suspension[]; suspensionError: string; gate: Gate | null; gateBlocked: boolean; blocking: Set<string>;
  onGo: (view: "weigh" | "corner" | "rounds" | "report" | "opponent" | "cancel") => void;
  onPreviewStatus: (s: CampDetail["status"]) => void;
}) {
  const { colors: c } = useThemePreference();
  const wide = useCampTwoColumns();
  const [sheet, setSheet] = useState<Sheet>(null);
  const limit = bout.catchweightKg ?? bout.weightLimitKg;
  const final = bout.status === "COMPLETED" || bout.status === "CANCELLED";
  const papersOpen = gateDecides(bout.status) ? gateBlocked : !!gate && !gate.passed;
  const cols = (left: ReactNode, right: ReactNode) => wide
    ? <View style={{ flexDirection: "row", gap: 26, alignItems: "flex-start" }}><View style={{ flex: 1, gap: 16 }}>{left}</View><View style={{ flex: 1, gap: 16 }}>{right}</View></View>
    : <View style={{ gap: 16 }}>{left}{right}</View>;

  const overview = () => {
    const facts = <View>
      <Fact label={campText.coachCampScreen.canChinhThuc2} value={dateLabel(bout.weighInAt)}/>
      <Fact label={campText.coachCampScreen.thiDau} value={dateLabel(bout.boutAt)}/>
      <Fact label={campText.coachCampScreen.diaDiem} value={bout.venue || campText.coachCampScreen.chuaXacDinh2}/>
      <Fact label={campText.coachCampScreen.gioiHan2} value={`${kg(limit)} kg`}/>
      <Fact label={campText.coachCampScreen.soHiep} value={bout.scheduledRounds == null ? campText.coachCampScreen.chuaDat : String(bout.scheduledRounds)}/>
    </View>;
    const fullSusp = <View style={{ gap: 12 }}>
      <Notice title={campText.coachCampScreen.voSiDangCoDinh} danger>{campText.coachCampScreen.buoiTapThuocLoaiBi}</Notice>
      {liveSusp.map(s => <SuspensionCard key={s.id} s={s}/>)}
    </View>;
    // Phone: one red row (until when) that opens the full suspension cards in a sheet, so Tổng quan fits one screen.
    const lastEnd = liveSusp.reduce((d, s) => s.endsOn > d ? s.endsOn : d, "");
    const awaiting = liveSusp.some(s => s.status === "AWAITING_CLEARANCE" || (s.requiresClearance && !s.clearedAt));
    const susp = <>
      {liveSusp.length ? wide ? fullSusp : <Pressable testID="suspension-row" accessibilityRole="button" accessibilityHint={t.openDetails} onPress={() => setSheet({ title: t.allSuspensions, body: fullSusp })}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, paddingHorizontal: 14, paddingVertical: 10, borderLeftWidth: 3, borderLeftColor: c.danger, backgroundColor: c.dangerSoft, opacity: pressed ? 0.8 : 1 })}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...readableTextStyle(14.5, true), color: c.danger }}>{t.suspendedUntil(dateLabel(lastEnd))}</Text>
          {awaiting ? <Text style={{ ...readableTextStyle(13.5), color: c.ink }}>{t.awaitingClearance}</Text> : null}
        </View>
        <Text style={{ fontFamily: fonts.display, fontSize: fz(16), color: c.lotus }}>{t.view}</Text>
      </Pressable> : null}
      {suspensionError ? <Notice title={campText.coachCampScreen.chuaTaiDuocTrangThai} danger>{suspensionError}</Notice> : null}
    </>;
    const privateReady = bout.status === "WEIGHED_IN" || bout.status === "COMPLETED";
    const actions = <View style={{ gap: 10 }}>
      {bout.status === "COMPLETED" ? <Action label={boutReport.openReport} onPress={() => onGo("report")}/> : null}
      {bout.status === "WEIGHED_IN" ? <Action label={campText.coachCampScreen.moTheGocDai} onPress={() => onGo("corner")}/> : null}
      {privateReady ? <Action label={campText.coachCampScreen.ghiChuVaGhiHiep2} secondary onPress={() => onGo("rounds")}/> : null}
      {!privateReady && !final ? <><Action label={campText.coachCampScreen.moTheGocDai} disabled onPress={() => undefined}/><Copy muted>{campText.coachCampScreen.theGocDaiVaGhi}</Copy></> : null}
      {!final ? <QuietLink label={t.cancel} onPress={() => onGo("cancel")}/> : null}
    </View>;
    const demo = preview ? <Choices label={campText.coachCampScreen.trangThaiMauDeXem} value={bout.status} options={[{ value: "FIGHT_WEEK", label: campText.coachCampScreen.tuanThiDau }, { value: "WEIGHED_IN", label: campText.coachCampScreen.daCan }, { value: "COMPLETED", label: campText.coachCampScreen.ketThuc }]} onChange={onPreviewStatus}/> : null;
    return cols(<>{demo}{facts}</>, <>{susp}{actions}</>);
  };

  const weight = () => <WeightTab bout={bout} limit={limit} cols={cols} onWeigh={() => onGo("weigh")}/>;

  const papers = () => {
    const notice = papersOpen && gate ? <Notice title={campText.coachCampScreen.chuaDuHoSoDe} danger>{[
      gate.missing.length ? campText.coachCampScreen.conThieu(gate.missing.map(i => i.label).join(", ")) : "",
      gate.expiring.length ? campText.coachCampScreen.hetHanTruocNgayThi(gate.expiring.map(i => i.label).join(", ")) : "",
      campText.coachCampScreen.mucBatBuocPhaiDuoc,
    ].filter(Boolean).join(" ")}</Notice> : null;
    const row = (r: CampDetail["requirements"][number]) => <Fact key={r.code} label={r.label} danger={blocking.has(r.code)} value={requirementLabel[r.status] ?? UNKNOWN_VALUE}/>;
    const list = bout.requirements.length
      ? <View><FitList items={bout.requirements} max={wide ? 8 : 5} moreLabel={t.more} render={row} onMore={() => setSheet({ title: t.allPapers, body: <View>{bout.requirements.map(row)}</View> })}/></View>
      : <Copy muted>{campText.coachCampScreen.chuaCoMucHoSo}</Copy>;
    return cols(notice, list);
  };

  const opponent = () => {
    const a = bout.opponentAnalysis; const p = a.profile ?? {};
    const tactics = a.tactics ?? []; const obs = a.observations ?? [];
    const missing = new Set(bout.tacticsWithoutSessions);
    const tacticRow = (x: (typeof tactics)[number]) => <Row key={x.id} text={x.text} right={missing.has(x.id) ? t.untrained : t.trained} tone={missing.has(x.id) ? "danger" : "success"}/>;
    const obsRow = (x: (typeof obs)[number]) => <Row key={x.id} text={x.text}/>;
    const record = <View style={{ flexDirection: "row", gap: 18, flexWrap: "wrap" }}>
      <Stat n={p.wins} label={t.record.wins}/><Stat n={p.losses} label={t.record.losses}/><Stat n={p.draws} label={t.record.draws}/>
      {p.stance || p.style ? <View><Text style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(22), lineHeight: lh(34), color: c.ink }}>{p.stance ? t.stance[p.stance] : ""}</Text><Text style={{ ...readableTextStyle(12.5), color: c.inkMuted }}>{p.style ? t.style[p.style] : ""}</Text></View> : null}
    </View>;
    const tac = tactics.length ? <View><Heading>{t.tacticsCount(tactics.length)}</Heading>
      <FitList items={tactics} max={wide ? 5 : 3} moreLabel={t.more} render={tacticRow} onMore={() => setSheet({ title: t.allTactics, body: <View>{tactics.map(tacticRow)}</View> })}/></View> : null;
    const ob = obs.length ? <View><Heading>{t.observationsCount(obs.length)}</Heading>
      <FitList items={obs} max={wide ? 4 : 2} moreLabel={t.more} render={obsRow} onMore={() => setSheet({ title: t.allObservations, body: <View>{obs.map(obsRow)}</View> })}/></View> : null;
    const empty = !tactics.length && !obs.length ? <Copy>{t.noAnalysis}</Copy> : null;
    return cols(<>{record}{tac}{empty}</>, <>{ob}<Action label={campText.coachCampScreen.phanTichDoiThu2} secondary onPress={() => onGo("opponent")}/></>);
  };

  return <>
    <CampTop>
      <CampTabs<DetailTab> alertLabel={t.needsAttention} value={tab} onChange={onTab} tabs={[
        { key: "overview", label: t.detail.overview, alert: liveSusp.length > 0 },
        { key: "weight", label: t.detail.weight, alert: bout.acuteLoss?.status === "EXCEEDED" },
        { key: "papers", label: t.detail.papers, alert: papersOpen },
        { key: "opponent", label: t.detail.opponent, alert: bout.tacticsWithoutSessions.length > 0 },
      ]}/>
    </CampTop>
    {/* Tabs are peers: the new tab's content fades in (no slide). */}
    <Swap swapKey={tab} testID={`detail-tab-${tab}`}>
      {tab === "overview" ? overview() : tab === "weight" ? weight() : tab === "papers" ? papers() : opponent()}
    </Swap>
    <SlideSheet visible={sheet !== null} onClose={() => setSheet(null)} title={sheet?.title ?? ""}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>{sheet?.body}</View>
    </SlideSheet>
  </>;
}

function WeightTab({ bout, limit, cols, onWeigh }: { bout: CampDetail; limit: number; cols: (l: ReactNode, r: ReactNode) => ReactNode; onWeigh: () => void }) {
  const { colors: c } = useThemePreference();
  const [track, setTrack] = useState<WeightTrack | null>(null);
  useEffect(() => {
    let alive = true;
    campApi.weightTrack(bout.id).then(x => { if (alive) setTrack(x); }, () => undefined);
    return () => { alive = false; };
  }, [bout.id]);
  const official = bout.officialWeightKg;
  const latest = bout.weight.latestKg;
  const over = latest != null ? Math.round((latest - limit) * 10) / 10 : null;
  const bad = official != null ? bout.madeWeight === false : latest == null || (over ?? 0) > 0;
  const n = official ?? latest;
  const line1 = official != null ? t.official : t.latest;
  const line2 = official != null ? (bout.madeWeight === false ? t.missed(kg(limit)) : t.made(kg(limit)))
    : latest == null ? t.notWeighed : (over ?? 0) > 0 ? t.over(kg(over)) : t.within(kg(limit));
  const big = <View accessible accessibilityLabel={`${n == null ? t.notWeighed : `${kg(n)} ${line1}`}, ${line2}`} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
    <Text style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(64), lineHeight: lh(64), color: bad ? c.danger : c.ink }}>{n == null ? "—" : kg(n)}</Text>
    <View><Text style={{ fontFamily: fonts.displaySemi, fontSize: fz(21), lineHeight: lh(29), textTransform: "uppercase", color: bad ? c.danger : c.ink }}>{line1}</Text>
      <Text style={{ fontFamily: fonts.displaySemi, fontSize: fz(21), lineHeight: lh(29), textTransform: "uppercase", color: bad ? c.danger : c.success }}>{line2}</Text></View>
  </View>;
  const acute = bout.acuteLoss?.status === "EXCEEDED" ? <Notice title={campText.coachCampScreen.giamCanCapTocVuot} danger>{`${campText.coachCampScreen.giam}${kg(bout.acuteLoss.lossPct)}${campText.coachCampScreen.nguongTheoBoLuatLa}${kg(bout.acuteLoss.limitPct)}%.`}</Notice> : null;
  const act = bout.status === "FIGHT_WEEK" ? <Action label={campText.coachCampScreen.ghiCanChinhThuc2} onPress={onWeigh}/>
    : bout.status === "SCHEDULED" || bout.status === "CAMP" ? <Copy muted>{t.weighOpensInFightWeek}</Copy> : null;
  return <>{cols(<>{big}{track ? <WeightPlot points={track.points} reference={track.referencePath} limit={track.limitKg}/> : null}</>, <>{acute}{act}</>)}</>;
}

function QuietLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors: c } = useThemePreference();
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ minHeight: 44, justifyContent: "center", alignSelf: "flex-start", opacity: pressed ? 0.7 : 1 })}>
    <Text style={{ ...readableTextStyle(14), color: c.inkMuted, textDecorationLine: "underline" }}>{label}</Text>
  </Pressable>;
}
function Heading({ children }: { children: string }) {
  const { colors: c } = useThemePreference();
  return <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: fz(17), letterSpacing: 0.6, textTransform: "uppercase", color: c.ink, paddingBottom: 2 }}>{children}</Text>;
}
function Row({ text, right, tone }: { text: string; right?: string; tone?: "danger" | "success" }) {
  const { colors: c } = useThemePreference();
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 46, paddingVertical: 8, borderBottomColor: c.line, borderBottomWidth: 1 }}>
    <Text style={{ ...readableTextStyle(14, true), color: c.ink, flex: 1 }}>{text}</Text>
    {right ? <Text style={{ ...readableTextStyle(13, true), color: tone === "danger" ? c.danger : tone === "success" ? c.success : c.inkMuted }}>{right}</Text> : null}
  </View>;
}
function Stat({ n, label }: { n?: number; label: string }) {
  const { colors: c } = useThemePreference();
  return <View><Text style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(34), lineHeight: lh(36), color: c.ink }}>{n ?? "–"}</Text><Text style={{ ...readableTextStyle(12.5), color: c.inkMuted }}>{label}</Text></View>;
}
