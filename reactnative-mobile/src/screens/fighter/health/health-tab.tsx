import { useState } from "react";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { getFighterMedical, listFighterReviewRequests } from "@/api/medical/medical";
import type { MedicalDossier, MedicalReviewRequest } from "@/api/types";
import { scopeState, type EligibilityScope } from "@/components/medical/eligibility-model";
import { formatMedicalDay, injuryStatusLabel } from "@/components/medical/medical-format";
import { BODY_MODEL_CREDIT } from "@/components/body3d/model";
import { Icon } from "@/components/icon";
import { FadeInView } from "@/components/motion";
import { Swap } from "@/components/motion-kit";
import { dateKey } from "@/components/schedule/week-model";
import { SlideSheet } from "@/components/ui/slide-sheet";
import { fighterBody } from "@/i18n/fighter-body";
import { fighterHealth as t } from "@/i18n/fighter-health";
import { useSource, type Source } from "@/screens/coach/today/coach-today-screen";
import { CampTabs } from "@/shared/ui/camp-lit";
import { suspensionHeadline, suspensionReasonLabel } from "@/features/fight-camp/logic/camp-rules";
import { Action, Frame } from "@/shared/ui/camp-ui";
import { useFighterSuspensions } from "@/features/fight-camp/components/fighter-suspension";
import { reasonLine } from "./medical-lines";
import { FighterTabPage, RetryRow, SlipRow } from "@/screens/fighter/redesign/tab-page";
import { planWeek } from "@/screens/fighter/plans/plans-model";
import { useFighterId } from "@/screens/fighter/use-fighter-id";
import { motion } from "@/theme/motion";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";
import { bodyMarks, clearanceRows, dmLocal, examLine, hmLocal, injuryTitle, limitLines, suspensionToday, verdict, type Cell, type Tone } from "./health-model";
import { RequestSheet } from "./request-sheet";
import { BodyLegend } from "./body-map";
import { BodyModel } from "./body-3d";

type Tab = "records" | "requests";
const HISTORY = "/suc-khoe/lich-su" as Href;
const SUSPENSIONS = "/tran/dinh-chi" as Href;
const injuryHref = (id: string) => `/suc-khoe/chan-thuong/${id}` as Href;
const REQUESTS_PAGE = 20;

/**
 * Fighter Cơ thể (redesign step 10): the verdict spotlight (can I train today, why, the two scopes, the request), then
 * tabs Hồ sơ · Yêu cầu khám. One request sheet replaces the two older request paths.
 */
export function FighterHealthTab() {
  const router = useRouter();
  const { fighterId, canFetch } = useFighterId();
  const key = `${canFetch}-${fighterId}`;
  const [tab, setTab] = useState<Tab>("records");
  const [asking, setAsking] = useState(false);
  const [limitsOf, setLimitsOf] = useState<EligibilityScope | null>(null);
  const [requestLimit, setRequestLimit] = useState(REQUESTS_PAGE);
  const [dossier, reloadDossier, refreshDossier] = useSource<MedicalDossier | null>(
    () => canFetch && fighterId ? getFighterMedical(fighterId) : Promise.resolve(null), key);
  const [requests, reloadRequests, refreshRequests] = useSource(
    () => canFetch && fighterId ? listFighterReviewRequests(fighterId, { page: 1, limit: requestLimit }) : Promise.resolve(null), `${key}-${requestLimit}`);
  const suspensions = useFighterSuspensions(canFetch);
  const suspension = suspensionToday(suspensions.items);

  const d = dossier.state === "ok" ? dossier.data : null;
  const open = d?.openReviewRequests ?? [];
  const pending = open.length > 0;
  const ask = () => setAsking(true);
  const afterSent = () => { void refreshDossier(); void refreshRequests(); };

  return <FighterTabPage testID="fighter-health" title={t.title} right={<InfoButton/>}
    onRefresh={() => Promise.all([refreshDossier(), refreshRequests(), suspensions.reload()])}>
    <FadeInView index={0}>
      <Spotlight dossier={dossier} suspension={suspension} onRetry={reloadDossier} onRequest={ask} onCell={setLimitsOf}/>
    </FadeInView>
    <FadeInView index={1}><View style={{ marginHorizontal: -22 }}>
      <CampTabs alertLabel={t.tabAlert} value={tab} onChange={setTab} tabs={[
        { key: "records", label: t.tabs.records },
        { key: "requests", label: pending ? t.tabs.requestsCount(open.length) : t.tabs.requests, alert: pending },
      ]}/>
    </View></FadeInView>
    <Swap swapKey={tab} testID={`health-tab-${tab}`}>
      {tab === "records"
        ? <Records dossier={d} failed={dossier.state === "error"} suspension={suspension} suspensionsFailed={suspensions.error} onRetrySuspensions={() => void suspensions.reload()}
            go={href => router.push(href)}/>
        : <Requests src={requests} canAsk={false} onAsk={ask} onRetry={reloadRequests} onMore={() => setRequestLimit(n => n + REQUESTS_PAGE)}/>}
    </Swap>
    {d ? <LimitsSheet dossier={d} scope={limitsOf} suspended={!!suspension}
      onClose={() => setLimitsOf(null)}
      onRequest={() => { setLimitsOf(null); setTimeout(ask, motion.base + 60); }}/> : null}
    {fighterId ? <RequestSheet fighterId={fighterId} visible={asking} onClose={() => setAsking(false)} onSent={afterSent}/> : null}
  </FighterTabPage>;
}

const useToneColor = () => {
  const { colors: c } = useThemePreference();
  return (tone: Tone) => tone === "ok" ? c.success : tone === "no" ? c.danger : c.lotus;
};

function Spotlight({ dossier, suspension, onRetry, onRequest, onCell }: {
  dossier: Source<MedicalDossier | null>; suspension: ReturnType<typeof suspensionToday>; onRetry: () => void; onRequest: () => void; onCell: (s: EligibilityScope) => void;
}) {
  const { colors: c } = useThemePreference();
  const color = useToneColor();
  if (dossier.state === "loading") return <Frame pad={18}><ActivityIndicator color={c.lotus} style={{ paddingVertical: 40 }}/></Frame>;
  if (dossier.state === "error") return <Frame pad={18}><View testID="health-failed" style={{ gap: 12 }}>
    <Text style={{ ...readableTextStyle(16, true), color: c.ink }}>{t.failed}</Text>
    <Action label={t.retry} secondary onPress={onRetry}/>
  </View></Frame>;
  const d = dossier.data;
  if (!d) return <Frame pad={18}><Text testID="health-empty" style={{ fontFamily: fonts.display, fontSize: fz(24), lineHeight: lh(33), letterSpacing: 0.4, textTransform: "uppercase", color: c.ink }}>{t.empty}</Text></Frame>;

  const v = verdict(d, suspension);
  const marks = bodyMarks(d, suspension);
  const open = d.openReviewRequests[0];
  return <View testID="health-verdict" style={{ gap: 4 }}>
    <View accessible accessibilityRole="header" accessibilityLabel={v.word} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}/>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
      <BodyModel marks={marks}/>
      <View style={{ flex: 1, minWidth: 0, gap: 10 }}>
        <ScopeLine scope="training" cell={v.training} onPress={() => onCell("training")}/>
        <ScopeLine scope="competition" cell={v.competition} onPress={() => onCell("competition")}/>
        <View style={{ gap: 2 }}>{v.lines.map((line, i) => <Text key={line} style={{ ...readableTextStyle(14, i === 0), color: c.ink }}>{line}</Text>)}</View>
        <BodyLegend marks={marks}/>
      </View>
    </View>
    {open ? <View testID="health-waiting" accessible accessibilityLabel={`${t.waiting}, ${t.sentOn(dmLocal(open.requestedAt))}`}
      style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, borderBottomColor: c.line, borderBottomWidth: 1 }}>
      <Icon name="history" size={20} color={c.lotus}/>
      <Text numberOfLines={1} style={{ ...readableTextStyle(15, true), color: c.ink }}>{t.waiting}</Text>
      <Text numberOfLines={1} style={{ ...readableTextStyle(14), color: c.inkMuted, marginLeft: "auto" }}>{t.sentOn(dmLocal(open.requestedAt))}</Text>
    </View> : <Pressable testID="health-ask" accessibilityRole="button" accessibilityLabel={t.request} onPress={onRequest}
      style={({ pressed }) => ({ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, borderBottomColor: c.line, borderBottomWidth: 1, opacity: pressed ? 0.7 : 1 })}>
      <Icon name="injury" size={20} color={c.lotus}/>
      <Text numberOfLines={1} style={{ ...readableTextStyle(15, true), color: c.lotus, flex: 1 }}>{t.request}</Text>
      <Icon name="chevron" size={18} color={c.lotus}/>
    </Pressable>}
  </View>;
}

/** One scope beside the figure: label, the verdict word in its tone; opens the doctor's limits. */
function ScopeLine({ scope, cell, onPress }: { scope: EligibilityScope; cell: Cell; onPress: () => void }) {
  const { colors: c } = useThemePreference();
  const color = useToneColor();
  return <Pressable testID={`health-cell-${scope}`} accessibilityRole="button" accessibilityLabel={t.cellA11y(t.scope[scope], cell.word)} onPress={onPress}
    style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 4, paddingBottom: 8, borderBottomColor: c.line, borderBottomWidth: 1, opacity: pressed ? 0.7 : 1 })}>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: fz(13), lineHeight: lh(18), letterSpacing: 1, textTransform: "uppercase", color: c.inkMuted }}>{t.scope[scope]}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(24), lineHeight: lh(33), letterSpacing: 0.3, textTransform: "uppercase", color: color(cell.tone) }}>{cell.word}</Text>
    </View>
    <Icon name="chevron" size={16} color={c.inkSubtle}/>
  </Pressable>;
}

function Records({ dossier: d, failed, suspension, suspensionsFailed, onRetrySuspensions, go }: {
  dossier: MedicalDossier | null; failed: boolean; suspension: ReturnType<typeof suspensionToday>; suspensionsFailed: boolean; onRetrySuspensions: () => void; go: (href: Href) => void;
}) {
  const today = dateKey(new Date());
  const rows: React.ReactNode[] = [];
  if (suspensionsFailed) rows.push(<RetryRow key="susp-failed" message={t.records.suspensionFailed} retry={t.retry} onRetry={onRetrySuspensions}/>);
  if (suspension) {
    const head = suspensionHeadline(suspension);
    const reason = suspensionReasonLabel[suspension.reason] ?? undefined;
    const line = [head, reason].filter(Boolean).join(" · ");
    rows.push(<SlipRow key="susp" testID="health-suspension" lead="!" leadTone="warn" title={t.records.suspension} word={head} wordTone="warn" line={reason} a11y={`${t.records.suspension}. ${line}`} onPress={() => go(SUSPENSIONS)}/>);
  }
  if (d && !failed) {
    const exam = examLine(d);
    if (exam) {
      const ok = scopeState(d, "training").level !== "notEligible";
      rows.push(<SlipRow key="exam" testID="health-exam" lead={ok ? "✓" : "!"} leadTone={ok ? "ok" : "warn"} title={t.records.exam} line={exam} a11y={`${t.records.exam}. ${exam}`}/>);
    }
    for (const r of clearanceRows(d)) {
      rows.push(r.ok
        ? <SlipRow key={`clear-${r.scope}`} testID={`health-clearance-${r.scope}`} lead="✓" leadTone="ok" title={t.records.clearance} line={r.line} a11y={`${t.records.clearance}. ${r.line}`}/>
        : <SlipRow key={`clear-${r.scope}`} testID={`health-clearance-${r.scope}`} lead="!" leadTone="warn" title={t.records.clearance} word={r.word ?? undefined} wordTone="warn" line={r.line} a11y={`${t.records.clearance}. ${r.word}, ${r.line}`}/>);
    }
    for (const i of d.activeInjuries) {
      const title = injuryTitle(i.affectedJoint, i.injuryType);
      const line = `${injuryStatusLabel(i.status)} · ${t.records.since(dmLocal(i.occurredAt))}`;
      rows.push(<SlipRow key={`inj-${i.id}`} testID={`health-injury-${i.id}`} lead="!" leadTone="warn" title={title} line={line} a11y={`${title}. ${line}`} onPress={() => go(injuryHref(i.id))}/>);
    }
    for (const p of d.activeRecoveryPlans) {
      const w = planWeek({ startDate: p.startDate, endDate: p.estimatedEndDate }, today);
      const end = p.estimatedEndDate ? dmLocal(p.estimatedEndDate) : null;
      const line = w ? t.records.recoveryLine(w.now, w.total, end) : end ? t.records.until(end) : formatMedicalDay(p.startDate);
      rows.push(<SlipRow key={`rec-${p.id}`} testID={`health-recovery-${p.id}`} lead={w ? String(w.now) : "–"} leadSub={w ? `/${w.total}` : undefined}
        title={p.title} line={line} a11y={`${p.title}. ${line}`} onPress={() => go(injuryHref(p.injuryId))}/>);
    }
  }
  rows.push(<SlipRow key="hist" testID="health-history" icon="history" title={t.records.history} line={t.records.historyLine} a11y={t.records.history} onPress={() => go(HISTORY)} last/>);
  return <View>{rows}</View>;
}

function Requests({ src, canAsk, onAsk, onRetry, onMore }: {
  src: Source<{ data: MedicalReviewRequest[]; hasNextPage: boolean } | null>; canAsk: boolean; onAsk: () => void; onRetry: () => void; onMore: () => void;
}) {
  const { colors: c } = useThemePreference();
  const list = src.state === "ok" && src.data ? src.data.data : [];
  return <View style={{ gap: 12 }}>
    {canAsk ? <Action label={t.request} onPress={onAsk}/> : null}
    {src.state === "loading" ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 24 }}/>
      : src.state === "error" ? <RetryRow message={t.requests.failed} retry={t.retry} onRetry={onRetry}/>
      : !list.length ? <Text testID="requests-none" style={{ fontFamily: fonts.display, fontSize: fz(20), lineHeight: lh(27), letterSpacing: 0.4, textTransform: "uppercase", color: c.ink }}>{t.requests.none}</Text>
      : <View>
        {list.map((r, i) => {
          const isOpen = r.status === "OPEN";
          const line = isOpen ? t.requests.open(`${dmLocal(r.requestedAt)} ${hmLocal(r.requestedAt)}`) : t.requests.seen(dmLocal(r.resolvedAt ?? r.requestedAt));
          return <SlipRow key={r.id} testID={`request-${r.id}`} icon={isOpen ? "history" : undefined} lead={isOpen ? undefined : "✓"} leadTone={isOpen ? undefined : "ok"}
            title={r.reason} line={line} a11y={`${r.reason}. ${line}`} last={i === list.length - 1}/>;
        })}
        {src.state === "ok" && src.data?.hasNextPage ? <Pressable accessibilityRole="button" onPress={onMore} style={({ pressed }) => ({ minHeight: 44, justifyContent: "center", alignSelf: "flex-start", opacity: pressed ? 0.7 : 1 })}>
          <Text style={{ fontFamily: fonts.display, fontSize: fz(16), letterSpacing: 0.3, color: c.lotus }}>{t.requests.more}</Text>
        </Pressable> : null}
      </View>}
  </View>;
}

/** The doctor's limits for one scope: the level, until when, why, what to do, the limits. */
function LimitsSheet({ dossier, scope, suspended, onClose, onRequest }: {
  dossier: MedicalDossier; scope: EligibilityScope | null; suspended: boolean; onClose: () => void; onRequest: () => void;
}) {
  const { colors: c } = useThemePreference();
  const color = useToneColor();
  const s = scope ?? "training";
  const state = scopeState(dossier, s);
  const tone: Tone = state.level === "eligible" ? "ok" : state.level === "restricted" ? "lim" : "no";
  const word = suspended && s === "training" && state.level !== "notEligible" ? t.cell.suspended : t.cell[state.level];
  const why = state.value.eligible ? [] : state.value.reasons.length ? [...new Set(state.value.reasons.map(reasonLine))] : [fighterBody.reasonUnknown];
  const todo = [...new Set(state.value.reasons.map(code => fighterBody.todo[code]).filter(Boolean))];
  const limits = limitLines(state);
  const until = state.clearance?.validUntil ?? state.exam?.validUntil ?? null;
  const canRequest = !dossier.openReviewRequests.length && state.level !== "eligible";
  const block = (title: string, lines: string[]) => lines.length ? <View key={title} style={{ gap: 2 }}>
    <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: fz(17), letterSpacing: 0.6, textTransform: "uppercase", color: c.ink, marginBottom: 2 }}>{title}</Text>
    {lines.map(l => <Text key={l} style={{ ...readableTextStyle(15), color: c.ink }}>{l}</Text>)}
  </View> : null;
  return <SlideSheet visible={scope !== null} onClose={onClose} title={t.scope[s]}>
    <View testID="limits-sheet" style={{ gap: 16, paddingBottom: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(28), lineHeight: lh(38), textTransform: "uppercase", color: color(word === t.cell.suspended ? "lim" : tone) }}>{word}</Text>
        {until ? <Text numberOfLines={1} style={{ ...readableTextStyle(14), color: c.ink }}>{t.limits.validUntil} {formatMedicalDay(until)}</Text> : null}
      </View>
      {block(t.limits.why, why)}
      {block(t.limits.todo, todo)}
      {block(t.limits.limits, limits)}
      {s === "training" && state.value.eligible ? <Text style={{ ...readableTextStyle(15), color: c.ink }}>{t.limits.trainingNote}</Text> : null}
      {canRequest ? <Action label={t.request} onPress={onRequest}/> : null}
    </View>
  </SlideSheet>;
}

/** The three health notes, behind the header "i". */
function InfoButton() {
  const { colors: c } = useThemePreference();
  const [open, setOpen] = useState(false);
  return <>
    <Pressable testID="health-info" accessibilityRole="button" accessibilityLabel={t.info} hitSlop={6} onPress={() => setOpen(true)}
      style={({ pressed }) => ({ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
      <Icon name="info" size={22} color={c.ink}/>
    </Pressable>
    <SlideSheet visible={open} onClose={() => setOpen(false)} title={t.info}>
      <View style={{ gap: 6, paddingBottom: 8 }}>
        {fighterBody.info.lines.map(line => <Text key={line} style={{ ...readableTextStyle(15), color: c.ink }}>{line}</Text>)}
        {/* CC BY 4.0: the 3D model needs its credit and licence wherever it is shown. */}
        <View testID="model-credit" style={{ marginTop: 10, paddingTop: 10, borderTopColor: c.line, borderTopWidth: 1, gap: 2 }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: fz(17), letterSpacing: 0.6, textTransform: "uppercase", color: c.ink }}>{t.map.creditTitle}</Text>
          <Text style={{ ...readableTextStyle(15), color: c.ink }}>{t.map.credit(BODY_MODEL_CREDIT.originalTitle, BODY_MODEL_CREDIT.author)}</Text>
          <View style={{ flexDirection: "row", gap: 18 }}>
            <Pressable accessibilityRole="link" accessibilityLabel={t.map.licenseA11y(BODY_MODEL_CREDIT.license)} onPress={() => void Linking.openURL(BODY_MODEL_CREDIT.licenseUrl)} style={{ minHeight: 44, justifyContent: "center" }}>
              <Text style={{ ...readableTextStyle(15, true), color: c.lotus, textDecorationLine: "underline" }}>{BODY_MODEL_CREDIT.license}</Text>
            </Pressable>
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(BODY_MODEL_CREDIT.source)} style={{ minHeight: 44, justifyContent: "center" }}>
              <Text style={{ ...readableTextStyle(15, true), color: c.lotus }}>{t.map.source}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SlideSheet>
  </>;
}
