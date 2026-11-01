import { useCallback, useEffect, useRef, useState } from "react";
import { Image, Linking, Pressable, StyleSheet, Text } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";

import { EXERCISE_CATEGORIES, type Exercise, type ExerciseCategory } from "@/api";
import { AuthTextField } from "@/components/auth/auth-text-field";
import { fighter } from "@/i18n/fighter";
import { getExercise, listExercises } from "@/screens/fighter/api";
import { mapFighterError } from "@/screens/fighter/errors";
import { EmptyCopy, FighterScreen, GlassCard, SectionLabel, StatusLine } from "@/screens/fighter/screen";
import { useFighterId } from "@/screens/fighter/use-fighter-id";
import { useLoad } from "@/screens/fighter/use-load";
import { radius, spacing, type, useThemePreference } from "@/theme";
import { FilterSelect } from "@/components/filter-sheet";
import { SkeletonFooter, SkeletonRows } from "@/components/loading";

const PAGE_SIZE = 20;

function categoryLabel(value: ExerciseCategory): string {
  return fighter.exerciseCategory[value] ?? value;
}

export function FighterExerciseLibraryScreen() {
  const { colors } = useThemePreference();
  const router = useRouter();
  const { canFetch, isDemo } = useFighterId();
  const [category, setCategory] = useState<ExerciseCategory | null>(null);
  const [search, setSearch] = useState("");
  const [muscle, setMuscle] = useState("");
  const [query, setQuery] = useState({ search: "", muscle: "" });
  const [rows, setRows] = useState<Exercise[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const seqRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setQuery({ search: search.trim(), muscle: muscle.trim() }), 350);
    return () => clearTimeout(timer);
  }, [search, muscle]);

  const fetchPage = useCallback(
    (nextPage: number, mode: "initial" | "refresh" = "initial") => {
      if (!canFetch) return;
      const seq = ++seqRef.current;
      if (mode === "initial") setLoading(true);
      setError("");
      return listExercises({
        page: nextPage,
        limit: PAGE_SIZE,
        ...(category ? { category } : {}),
        ...(query.search ? { search: query.search } : {}),
        ...(query.muscle ? { targetMuscle: query.muscle } : {}),
      })
        .then((result) => {
          if (seq !== seqRef.current) return;
          setRows((prev) => (nextPage === 1 ? result.data : [...prev, ...result.data]));
          setPage(nextPage);
          setHasNext(result.hasNextPage);
        })
        .catch((cause: unknown) => {
          if (seq !== seqRef.current) return;
          if (mode === "refresh") throw cause;
          if (nextPage === 1) setRows([]);
          setError(mapFighterError(cause));
        })
        .finally(() => {
          if (seq === seqRef.current) setLoading(false);
        });
    },
    [canFetch, category, query],
  );

  useEffect(() => {
    void fetchPage(1);
  }, [fetchPage]);

  const emptyText = isDemo || !canFetch ? fighter.common.demoHint : fighter.exercises.empty;

  return (
    <FighterScreen title={fighter.exercises.libraryTitle} onBack keyboard refreshing={loading && page === 1} onRefresh={() => fetchPage(1, "refresh")}>
      <GlassCard>
        <AuthTextField
          label={fighter.exercises.search}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          maxLength={100}
        />
        <AuthTextField
          label={fighter.exercises.targetMuscle}
          value={muscle}
          onChangeText={setMuscle}
          placeholder={fighter.exercises.targetMuscleHint}
          autoCapitalize="none"
          maxLength={100}
        />
        <FilterSelect
          label="Nhóm bài tập"
          options={[{ value: "" as const, label: fighter.tap.filterAll }, ...EXERCISE_CATEGORIES.map((value) => ({ value, label: categoryLabel(value) }))]}
          value={category ?? ""}
          allValue=""
          onChange={(next) => setCategory(next === "" ? null : next)}
        />
      </GlassCard>
      <StatusLine message={error} onRetry={() => void fetchPage(1)} />
      <GlassCard>
        {rows.length > 0 ? (
          rows.map((row) => (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              onPress={() => router.push(`/giao-an/bai-tap/${row.id}` as Href)}
              style={styles.row}
            >
              <Text style={[type.body, { color: colors.ink }]}>{row.name}</Text>
              <Text style={[type.caption, styles.meta, { color: colors.inkMuted }]}>
                {categoryLabel(row.category)}
                {row.targetMuscleGroups.length ? ` · ${row.targetMuscleGroups.join(", ")}` : ""}
              </Text>
            </Pressable>
          ))
        ) : loading ? (
          <SkeletonRows rows={4} />
        ) : (
          <EmptyCopy text={emptyText} />
        )}
        <SkeletonFooter active={loading && rows.length > 0} />
        {hasNext && !loading ? (
          <Pressable accessibilityRole="button" onPress={() => void fetchPage(page + 1)} style={styles.row}>
            <Text style={[type.link, { color: colors.lotus }]}>{fighter.exercises.loadMore}</Text>
          </Pressable>
        ) : null}
      </GlassCard>
    </FighterScreen>
  );
}

export function FighterExerciseDetailScreen() {
  const { colors } = useThemePreference();
  const { id } = useLocalSearchParams<{ id: string }>();
  const exerciseId = typeof id === "string" ? id : "";
  const { canFetch, isDemo } = useFighterId();
  const [linkError, setLinkError] = useState("");

  const load = useCallback(() => getExercise(exerciseId), [exerciseId]);
  const { data, error, loading, reload, refresh } = useLoad(canFetch && !!exerciseId, exerciseId, load);

  const openVideo = useCallback((url: string) => {
    setLinkError("");
    void Linking.openURL(url).catch(() => setLinkError(fighter.common.generic));
  }, []);

  return (
    <FighterScreen title={fighter.exercises.detailTitle} onBack refreshing={loading} onRefresh={refresh}>
      <StatusLine message={error || linkError} onRetry={error ? reload : undefined} />
      {data ? (
        <>
          <GlassCard>
            {data.thumbnailUrl ? (
              <Image
                source={{ uri: data.thumbnailUrl }}
                style={[styles.thumb, { backgroundColor: colors.line }]}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            ) : null}
            <Text style={[type.title, { color: colors.ink }]}>{data.name}</Text>
            <Text style={[type.body, { color: colors.inkMuted }]}>
              {fighter.exercises.category}: {categoryLabel(data.category)}
            </Text>
            {data.targetMuscleGroups.length ? (
              <Text style={[type.body, { color: colors.inkMuted }]}>
                {fighter.exercises.muscles}: {data.targetMuscleGroups.join(", ")}
              </Text>
            ) : null}
            {data.videoUrl ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => openVideo(data.videoUrl as string)}
                style={styles.row}
              >
                <Text style={[type.link, { color: colors.lotus }]}>{fighter.exercises.video}</Text>
              </Pressable>
            ) : (
              <Text style={[type.caption, styles.meta, { color: colors.inkMuted }]}>
                {fighter.exercises.noMedia}
              </Text>
            )}
          </GlassCard>
          {data.description ? (
            <>
              <SectionLabel text={fighter.exercises.description} />
              <GlassCard>
                <Text style={[type.body, { color: colors.ink }]}>{data.description}</Text>
              </GlassCard>
            </>
          ) : null}
        </>
      ) : loading || error ? null : (
        <GlassCard>
          <EmptyCopy text={isDemo || !canFetch ? fighter.common.demoHint : fighter.exercises.empty} />
        </GlassCard>
      )}
    </FighterScreen>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 44, justifyContent: "center", gap: 2 },
  meta: { lineHeight: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
  },
  thumb: { width: "100%", aspectRatio: 16 / 9, borderRadius: radius.panel },
});
