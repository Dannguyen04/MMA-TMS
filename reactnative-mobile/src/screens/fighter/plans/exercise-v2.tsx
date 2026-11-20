import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Linking, Pressable, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";

import { EXERCISE_CATEGORIES, type Exercise, type ExerciseCategory } from "@/api/types";
import { Icon } from "@/components/icon";
import { PressableScale } from "@/components/motion";
import { fighter } from "@/i18n/fighter";
import { fighterPlans as t } from "@/i18n/fighter-plans";
import { muscleQuery, musclesLine } from "@/i18n/server-text";
import { useSource } from "@/screens/coach/today/coach-today-screen";
import { LitFill } from "@/shared/ui/camp-lit";
import { Action, CampShell, Choices } from "@/shared/ui/camp-ui";
import { getExercise, listExercises } from "@/screens/fighter/api";
import { RetryRow } from "@/screens/fighter/redesign/tab-page";
import { useFighterId } from "@/screens/fighter/use-fighter-id";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";

const PAGE = 20;
const groupLabel = (c: ExerciseCategory) => fighter.exerciseCategory[c] ?? c;
const exerciseLine = (e: Exercise) => [groupLabel(e.category), musclesLine(e.targetMuscleGroups)].filter(Boolean).join(" · ");

/**
 * Exercise library (redesign step 9): one search field for names and muscle groups, a chip row of groups, one-line
 * rows. The API searches names only and matches a muscle exactly, so page 1 asks both and merges; "Xem thêm" pages
 * the name search.
 */
export function FighterExerciseLibraryV2() {
  const { colors: c } = useThemePreference();
  const router = useRouter();
  const { canFetch } = useFighterId();
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const [group, setGroup] = useState<ExerciseCategory | null>(null);
  const [rows, setRows] = useState<Exercise[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [more, setMore] = useState(false);
  const seq = useRef(0);

  useEffect(() => { const id = setTimeout(() => setQ(text.trim()), 350); return () => clearTimeout(id); }, [text]);

  const load = useCallback((next: number) => {
    if (!canFetch) { setState("ok"); return; }
    const id = ++seq.current;
    if (next === 1) setState("loading"); else setMore(true);
    const base = { page: next, limit: PAGE, ...(group ? { category: group } : {}) };
    const byName = listExercises({ ...base, ...(q ? { search: q } : {}) });
    const byMuscle = next === 1 && q ? listExercises({ ...base, targetMuscle: muscleQuery(q) }).catch(() => null) : Promise.resolve(null);
    void Promise.all([byName, byMuscle]).then(([a, b]) => {
      if (id !== seq.current) return;
      setRows(prev => {
        const merged = next === 1 ? [...a.data] : [...prev, ...a.data];
        for (const e of b?.data ?? []) if (!merged.some(x => x.id === e.id)) merged.push(e);
        return merged;
      });
      setPage(next); setHasNext(a.hasNextPage); setState("ok");
    }, () => { if (id === seq.current) { if (next === 1) { setRows([]); setState("error"); } } })
      .finally(() => { if (id === seq.current) setMore(false); });
  }, [canFetch, group, q]);
  useEffect(() => { load(1); }, [load]);

  return <CampShell title={t.libraryTitle}>
    <View style={{ gap: 12 }}>
      <View style={{ minHeight: 50 }}>
        <LitFill kind="secondary"/>
        {/* Own layer: on web the absolute fill would otherwise paint over the icon and the input. */}
        <View style={{ flex: 1, minHeight: 50, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 }}>
          <Icon name="search" size={20} color={focused ? c.lotus : c.inkMuted}/>
          {/* The square browser focus ring would cut across the diagonal corner; focus shows on the icon instead. */}
          <TextInput testID="library-search" value={text} onChangeText={setText} placeholder={t.search} placeholderTextColor={c.inkMuted} accessibilityLabel={t.search}
            autoCapitalize="none" autoCorrect={false} returnKeyType="search" maxLength={100} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            style={{ flex: 1, minWidth: 0, minHeight: 48, ...readableTextStyle(15), color: c.ink, outlineStyle: "none" } as object}/>
        </View>
      </View>
      <Choices chips label={undefined} value={group} onChange={setGroup}
        options={[{ value: null, label: t.all }, ...EXERCISE_CATEGORIES.map(x => ({ value: x as ExerciseCategory | null, label: groupLabel(x) }))]}/>
    </View>
    <View>
      {state === "loading" ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 32 }}/> : null}
      {state === "error" ? <RetryRow message={t.loadFailed} retry={t.retry} onRetry={() => load(1)}/> : null}
      {state === "ok" && !rows.length ? <Text style={{ ...readableTextStyle(15, true), color: c.ink, paddingVertical: 12 }}>{q || group ? t.noResults : t.emptyLibrary}</Text> : null}
      {state === "ok" ? rows.map((e, i) => <PressableScale key={e.id} testID={`library-${e.id}`} scaleTo={0.99} accessibilityRole="button" accessibilityLabel={`${e.name}. ${exerciseLine(e)}`}
        onPress={() => router.push(`/giao-an/bai-tap/${e.id}` as Href)}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingVertical: 8, borderTopColor: c.line, borderTopWidth: 1, ...(i === rows.length - 1 ? { borderBottomColor: c.line, borderBottomWidth: 1 } : null) }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ ...readableTextStyle(15, true), color: c.ink }}>{e.name}</Text>
          <Text numberOfLines={1} style={{ ...readableTextStyle(13.5), color: c.ink }}>{exerciseLine(e)}</Text>
        </View>
        <Icon name="chevron" size={18} color={c.inkSubtle}/>
      </PressableScale>) : null}
      {state === "ok" && hasNext ? <Pressable accessibilityRole="button" disabled={more} onPress={() => load(page + 1)} style={({ pressed }) => ({ minHeight: 48, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}>
        {more ? <ActivityIndicator color={c.lotus}/> : <Text style={{ ...readableTextStyle(15, true), color: c.lotus }}>{t.more}</Text>}
      </Pressable> : null}
    </View>
  </CampShell>;
}

/** One exercise: picture when there is one, the name, its group and muscles, the description, and the video. */
export function FighterExerciseDetailV2() {
  const { colors: c } = useThemePreference();
  const { id } = useLocalSearchParams<{ id: string }>();
  const exerciseId = typeof id === "string" ? id : "";
  const { canFetch } = useFighterId();
  const [ex, reload] = useSource<Exercise | null>(() => canFetch && exerciseId ? getExercise(exerciseId) : Promise.resolve(null), `${canFetch}-${exerciseId}`);
  const [videoError, setVideoError] = useState(false);
  const e = ex.state === "ok" ? ex.data : null;
  return <CampShell title={t.exerciseTitle}>
    {ex.state === "loading" ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 40 }}/> : null}
    {ex.state === "error" ? <RetryRow message={t.loadFailed} retry={t.retry} onRetry={reload}/> : null}
    {ex.state === "ok" && !e ? <Text style={{ ...readableTextStyle(15, true), color: c.ink }}>{t.noExercise}</Text> : null}
    {e ? <View testID="exercise-detail" style={{ gap: 16 }}>
      {e.thumbnailUrl ? <Image source={{ uri: e.thumbnailUrl }} accessibilityIgnoresInvertColors resizeMode="cover" style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: c.surfaceMuted }}/> : null}
      <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: fz(26), lineHeight: lh(36), letterSpacing: 0.4, textTransform: "uppercase", color: c.ink }}>{e.name}</Text>
      <View>
        <Row label={t.group} value={groupLabel(e.category)}/>
        {e.targetMuscleGroups.length ? <Row label={t.muscles} value={musclesLine(e.targetMuscleGroups)}/> : null}
      </View>
      {e.description ? <Text style={{ ...readableTextStyle(15), lineHeight: lh(23), color: c.ink }}>{e.description}</Text> : null}
      {videoError ? <Text accessibilityRole="alert" style={{ ...readableTextStyle(14, true), color: c.danger }}>{t.videoFailed}</Text> : null}
      {e.videoUrl ? <Action label={t.video} onPress={() => { setVideoError(false); void Linking.openURL(e.videoUrl as string).catch(() => setVideoError(true)); }}/> : null}
    </View> : null}
  </CampShell>;
}

function Row({ label, value }: { label: string; value: string }) {
  const { colors: c } = useThemePreference();
  return <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 10, borderTopColor: c.line, borderTopWidth: 1 }}>
    <Text numberOfLines={1} style={{ ...readableTextStyle(14), color: c.inkMuted }}>{label}</Text>
    <Text numberOfLines={1} style={{ ...readableTextStyle(14, true), color: c.ink, flexShrink: 1 }}>{value}</Text>
  </View>;
}
