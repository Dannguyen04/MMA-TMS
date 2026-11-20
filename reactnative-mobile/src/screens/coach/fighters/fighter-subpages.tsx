import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";

import { coachApi } from "@/api/coach";
import { isApiError } from "@/api/errors";
import { listAnalysisJobs, listVideos } from "@/api/media";
import { createFighterReviewRequest, listFighterMedicalExaminations, listFighterMedicalHistory, listFighterReviewRequests } from "@/api/medical";
import type { MedicalExamination, MedicalHistoryEntry, Paginated } from "@/api/types";
import { REVIEW_REASON_MAX } from "@/components/medical/review-request-panel";
import { decisionLabel, describeSnapshot, recordTypeLabel, scopeLabel } from "@/components/medical/medical-format";
import { StaggerList } from "@/components/motion";
import { EmptyLine, RolePage } from "@/components/role-page";
import { useToastMessage } from "@/components/toast/app-toast";
import { coachFighters as t } from "@/i18n/coach-fighters";
import { medical as medicalCopy } from "@/i18n/medical";
import { videoTitle } from "@/i18n/server-text";
import { fighterName, vnDate } from "@/screens/coach/readonly/ro-format";
import { useSource } from "@/screens/coach/today/coach-today-screen";
import { CampTabs } from "@/screens/fight-camp/camp-lit";
import { Action, Field } from "@/screens/fight-camp/camp-ui";
import { RetryRow, SlipRow, type LeadTone } from "@/screens/fighter/redesign/tab-page";
import type { IconName } from "@/components/icon";
import { dmLocal } from "@/screens/fighter/health/health-model";
import { rowView, statusWord } from "@/screens/fighter/video/video-v2-model";
import { jobForVideo, trainingLabel } from "@/screens/media/video-model";
import { coachUploadHref, coachVideoHref } from "@/screens/coach/video/video-model";
import { coachFighterHref } from "./fighter-model";
import { mapApiMessage } from "@/session/map-api-message";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";

function useFighterParam() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return typeof id === "string" ? id : "";
}

/** The fighter's name under the header, so a sub-page says whose record it is. */
function WhoLine({ fighterId, line }: { fighterId: string; line?: string }) {
  const { colors: c } = useThemePreference();
  const [src] = useSource(() => coachApi.getFighter(fighterId), `who|${fighterId}`);
  return <View style={{ gap: 2 }}>
    <Text numberOfLines={1} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(24), lineHeight: lh(33), textTransform: "uppercase", color: c.ink }}>{src.state === "ok" ? fighterName(src.data) : " "}</Text>
    {line ? <Text style={{ ...readableTextStyle(14.5), color: c.ink }}>{line}</Text> : null}
  </View>;
}

function MoreLink({ onPress, busy }: { onPress: () => void; busy: boolean }) {
  const { colors: c } = useThemePreference();
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={busy} style={{ minHeight: 48, alignItems: "center", justifyContent: "center" }}>
    {busy ? <ActivityIndicator color={c.lotus}/> : <Text style={{ ...readableTextStyle(14.5, true), color: c.lotus }}>{t.showMore}</Text>}
  </Pressable>;
}

/** Page-by-page list for rows without an `id` (history entries). A failure keeps loaded rows. */
function usePages<T>(key: string, fetch: (page: number) => Promise<Paginated<T>>) {
  const [rows, setRows] = useState<T[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [hasNext, setHasNext] = useState(false);
  const [more, setMore] = useState(false);
  const page = useRef(1); const seq = useRef(0);
  const fetchRef = useRef(fetch); fetchRef.current = fetch;
  const load = useCallback((p: number, quiet = false) => {
    const id = ++seq.current;
    if (p === 1 && !quiet) setState("loading");
    if (p > 1) setMore(true);
    return fetchRef.current(p).then(r => {
      if (id !== seq.current) return;
      setRows(prev => p === 1 ? r.data : [...prev, ...r.data]); setHasNext(r.hasNextPage); page.current = p; setState("ok");
    }, () => { if (id === seq.current && p === 1) setState(s => quiet && s === "ok" ? s : "error"); }).finally(() => { if (id === seq.current) setMore(false); });
  }, []);
  useEffect(() => { void load(1); }, [load, key]);
  return { rows, state, hasNext, more, reload: () => void load(1), refresh: () => load(1, true), loadMore: () => void load(page.current + 1) };
}

/** An entry opens in place to show its facts, one per line (no extra page). */
/** A record's mark: ! injury or not-eligible exam, ✓ clearance, eligible exam or handled request, × revoked clearance, a clock otherwise. */
function recordMark(entry: MedicalHistoryEntry): { lead?: string; icon?: IconName; tone: LeadTone } {
  const s = entry.snapshot as Record<string, unknown>;
  const pick = (a: string, b: string) => (typeof s[a] === "string" ? s[a] : typeof s[b] === "string" ? s[b] : "") as string;
  if (entry.recordType === "INJURY") return { lead: "!", tone: "warn" };
  if (entry.recordType === "MEDICAL_EXAMINATION") {
    const d = pick("decision", "decision");
    return d === "NOT_ELIGIBLE" ? { lead: "!", tone: "warn" } : d.startsWith("ELIGIBLE") ? { lead: "✓", tone: "ok" } : { icon: "history", tone: "dim" };
  }
  if (entry.recordType === "MEDICAL_CLEARANCE") return pick("status", "status") === "REVOKED" ? { lead: "×", tone: "warn" } : { lead: "✓", tone: "ok" };
  if (entry.recordType === "MEDICAL_REVIEW_REQUEST" && pick("status", "status") === "RESOLVED") return { lead: "✓", tone: "ok" };
  return { icon: "history", tone: "dim" };
}

function HistoryEntryRow({ entry, last }: { entry: MedicalHistoryEntry; last: boolean }) {
  const { colors: c } = useThemePreference();
  const [open, setOpen] = useState(false);
  const view = describeSnapshot(entry);
  const title = view.title || recordTypeLabel(entry.recordType);
  // Owner rule: no internal codes on screen, so the revision number stays out; the first detail says what it was.
  const first = view.lines[0]?.value.split("\n")[0];
  const line = [vnDate(entry.recordedAt), first].filter(Boolean).join(" · ");
  const mark = recordMark(entry);
  return <View>
    <SlipRow lead={mark.lead} icon={mark.icon} leadTone={mark.tone} title={title} line={line} a11y={`${title}, ${line}`} last={last && !open} onPress={view.lines.length ? () => setOpen(o => !o) : undefined}/>
    {open ? <View style={{ paddingLeft: 64, paddingBottom: 10, gap: 4, ...(last ? { borderBottomColor: c.line, borderBottomWidth: 1 } : null) }}>
      {view.lines.map(l => <Text key={l.label} style={{ ...readableTextStyle(14), color: c.ink }}><Text style={{ ...readableTextStyle(14, true), color: c.ink }}>{l.label}: </Text>{l.value}</Text>)}
    </View> : null}
  </View>;
}

function ExamRow({ exam, last }: { exam: MedicalExamination; last: boolean }) {
  const no = exam.decision === "NOT_ELIGIBLE";
  const ok = exam.decision.startsWith("ELIGIBLE");
  const title = `${medicalCopy.examsTab} ${scopeLabel(exam.scope).toLowerCase()}`;
  const date = vnDate(exam.examinedAt);
  return <SlipRow lead={no ? "!" : "✓"} leadTone={no ? "warn" : ok ? "ok" : undefined} title={title} word={decisionLabel(exam.decision)} wordTone={no ? "warn" : ok ? "ok" : undefined}
    line={exam.validUntil ? `${date} · ${t.until(vnDate(exam.validUntil))}` : date} a11y={`${title}, ${decisionLabel(exam.decision)}, ${date}`} last={last}/>;
}

/** Lịch sử y tế (redesign step 16): Bản ghi and Kết luận khám as in-page tabs, one row per entry. */
export function CoachMedicalHistoryScreen() {
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const fighterId = useFighterParam();
  const [tab, setTab] = useState<"records" | "exams">("records");
  const records = usePages(`h|${fighterId}`, p => listFighterMedicalHistory(fighterId, { page: p, limit: 20 }));
  const exams = usePages(`e|${fighterId}`, p => listFighterMedicalExaminations(fighterId, { page: p, limit: 20 }));
  const active = tab === "records" ? records : exams;
  return <RolePage testID="coach-medical-history" title={t.history} onBack={() => (router.canGoBack() ? router.back() : router.replace(coachFighterHref(fighterId)))} onRefresh={() => Promise.all([records.refresh(), exams.refresh()])}>
    <WhoLine fighterId={fighterId}/>
    <CampTabs tabs={[{ key: "records", label: t.historyTabs.records }, { key: "exams", label: t.historyTabs.exams }]} value={tab} onChange={setTab} alertLabel={t.alert}/>
    {active.state === "loading" ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 32 }}/> : null}
    {active.state === "error" ? <RetryRow message={t.historyFailed} retry={t.retry} onRetry={active.reload}/> : null}
    {active.state === "ok" && !active.rows.length ? <EmptyLine title={tab === "records" ? t.historyEmpty : t.examsEmpty}/> : null}
    {active.state === "ok" && active.rows.length ? <StaggerList key={tab} testID={`history-${tab}`}>
      {tab === "records"
        ? records.rows.map((e, k) => <HistoryEntryRow key={`${e.recordType}:${e.recordId}:${e.revision}`} entry={e} last={k === records.rows.length - 1}/>)
        : exams.rows.map((e, k) => <ExamRow key={e.id} exam={e} last={k === exams.rows.length - 1}/>)}
    </StaggerList> : null}
    {active.hasNext ? <MoreLink onPress={active.loadMore} busy={active.more}/> : null}
  </RolePage>;
}

const unknownOutcome = (e: unknown) => !isApiError(e) || e.status === 0 || e.status >= 500;

/**
 * Yêu cầu khám (redesign step 16): the coach's one write on a fighter. The reason, the lit button pinned in the
 * footer (lights up once there is a reason), then the requests already sent, newest first.
 */
export function CoachExamRequestScreen() {
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const fighterId = useFighterParam();
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  useToastMessage(done, "success");
  const past = usePages(`r|${fighterId}`, p => listFighterReviewRequests(fighterId, { page: p, limit: 20 }));
  const text = reason.trim();
  const tooLong = text.length > REVIEW_REASON_MAX;
  const send = () => {
    if (!text || tooLong || sending) return;
    setSending(true); setError(""); setDone("");
    createFighterReviewRequest(fighterId, { reason: text }).then(() => {
      setReason(""); setDone(t.askSent); void past.refresh();
    }, (e: unknown) => {
      // A lost answer may still have created it: reload the list so the coach checks before sending again.
      if (unknownOutcome(e)) { setError(medicalCopy.reviewRecheck); void past.refresh(); return; }
      setError(mapApiMessage(e) || t.askFailed);
    }).finally(() => setSending(false));
  };
  return <RolePage testID="coach-exam-request" title={t.askTitle} onBack={() => (router.canGoBack() ? router.back() : router.replace(coachFighterHref(fighterId)))} onRefresh={past.refresh}
    footer={<Action label={sending ? t.askSending : t.askSend} pending={sending} disabled={!text || tooLong} onPress={send}/>}>
    <WhoLine fighterId={fighterId} line={t.askFor}/>
    <Field label={t.askReason} value={reason} onChangeText={v => { setReason(v); setError(""); }} placeholder={t.askPlaceholder} multiline maxLength={REVIEW_REASON_MAX + 50}
      error={tooLong ? t.askTooLong(REVIEW_REASON_MAX) : error || undefined} helper={text.length > REVIEW_REASON_MAX * 0.9 ? t.askCount(text.length, REVIEW_REASON_MAX) : undefined}/>
    {past.state === "error" ? <RetryRow message={t.askListFailed} retry={t.retry} onRetry={past.reload}/> : null}
    {past.state === "ok" && past.rows.length ? <>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: fz(18), lineHeight: lh(25), letterSpacing: 0.7, textTransform: "uppercase", color: c.ink, marginTop: 6 }}>{t.askPast}</Text>
      <StaggerList testID="exam-requests">
        {past.rows.map((r, k) => {
          const open = r.status === "OPEN";
          const word = open ? t.askOpenWord : t.askDoneWord;
          const date = vnDate(open ? r.requestedAt : r.resolvedAt ?? r.requestedAt);
          return <SlipRow key={r.id} icon={open ? "history" : undefined} lead={open ? undefined : "✓"} leadTone={open ? "dim" : "ok"} title={r.reason}
            word={word} wordTone={open ? undefined : "ok"} line={date} a11y={`${r.reason}, ${word}, ${date}`} last={k === past.rows.length - 1}/>;
        })}
      </StaggerList>
    </> : null}
    {past.hasNext ? <MoreLink onPress={past.loadMore} busy={past.more}/> : null}
  </RolePage>;
}

async function loadVideos(fighterId: string) {
  const [page, jobs] = await Promise.all([listVideos({ fighterId, limit: 50 }), listAnalysisJobs()]);
  return page.items.map(video => ({ video, job: jobForVideo(jobs, video.id) }));
}

/** Video của võ sĩ (redesign step 16): the same rows as the fighter's own Video list (step 13). */
export function CoachFighterVideosScreen() {
  const router = useRouter();
  const fighterId = useFighterParam();
  const { colors: c } = useThemePreference();
  const [src, reload, refresh] = useSource(() => loadVideos(fighterId), `v|${fighterId}`);
  const rows = src.state === "ok" ? src.data : null;
  return <RolePage testID="coach-fighter-videos" title={t.videosTitle} onBack={() => (router.canGoBack() ? router.back() : router.replace(coachFighterHref(fighterId)))} onRefresh={refresh}>
    <WhoLine fighterId={fighterId}/>
    <Action label={t.videoUpload} onPress={() => router.push(coachUploadHref(fighterId))}/>
    {src.state === "loading" ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 32 }}/> : null}
    {src.state === "error" ? <RetryRow message={t.videosFailed} retry={t.retry} onRetry={reload}/> : null}
    {rows && !rows.length ? <EmptyLine testID="fighter-videos-empty" title={t.videosEmpty}/> : null}
    {rows && rows.length ? <StaggerList testID="fighter-videos">
      {rows.map(({ video, job }, k) => {
        const v = rowView(video, job);
        const title = videoTitle(video.title);
        // Only the status word carries colour (owner, step 16 preview); the rest of the line stays ink.
        const rest = [trainingLabel(video.trainingType), dmLocal(video.createdAt)].join(" · ");
        return <SlipRow key={video.id} lead={v.lead} leadTone={v.leadTone} icon={v.kind === "wait" ? "history" : undefined} title={title}
          word={statusWord(job)} wordTone={v.lineTone} line={rest} a11y={`${title}, ${v.line}`} last={k === rows.length - 1} onPress={() => router.push(coachVideoHref(video.id, job?.id))}/>;
      })}
    </StaggerList> : null}
  </RolePage>;
}

