import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { recordWeight } from "@/api/bouts";
import { Icon } from "@/components/icon";
import { showAppToast } from "@/components/toast/app-toast";
import { fighterBout as t } from "@/i18n/fighter-bout";
import { fighterHref } from "@/navigation/role-href";
import { ActionButton, CardSkeleton, ConnectionBanner, OverWeightText, SPEC, TEXT, useDelayedFlag } from "@/screens/fighter/bout-states";
import { FighterScreen } from "@/screens/fighter/screen";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { setSelectedBoutId } from "@/screens/fighter/selected-bout";
import { useBouts } from "@/screens/fighter/use-active-bout";
import { useFighterId } from "@/screens/fighter/use-fighter-id";
import { weighInErrorMessage } from "@/screens/fighter/weigh-in-error";
import { formatKg, parseWeightInput, type WeightParseResult } from "@/utils/weight-input";
import { vnShortDate } from "@/utils/vn-date";

function parseIssue(result: WeightParseResult): string {
  if (result.ok) return "";
  if (result.reason === "empty") return t.weigh.errorEmpty;
  if (result.reason === "format") return t.weigh.errorFormat;
  return t.weigh.errorRange;
}

export function FighterWeighInScreen() {
  const colors = useFighterPalette();
  const router = useRouter();
  const params = useLocalSearchParams<{ bout?: string }>();
  const { fighterId, canFetch } = useFighterId();
  const { data, error, loading, reload, refresh } = useBouts(params.bout ?? null);
  const [text, setText] = useState("");
  const [issue, setIssue] = useState("");
  const [focused, setFocused] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const active = data?.active ?? null;
  const track = data?.track ?? null;

  // Không có trận đang hoạt động → về trang chủ.
  useEffect(() => {
    if (data && !active) router.replace(fighterHref.home);
  }, [data, active, router]);

  const onSave = async () => {
    if (savingRef.current || !active) return;
    const parsed = parseWeightInput(text);
    if (!parsed.ok) {
      setIssue(parseIssue(parsed));
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setIssue("");
    try {
      await recordWeight({ fighterId: canFetch ? fighterId : null, boutId: active.id, weightKg: parsed.kg });
      showAppToast(t.weigh.saved(formatKg(parsed.kg)), "success");
      // Quay về trang trận (đóng màn ghi cân); trang trận tự tải lại khi được focus.
      setSelectedBoutId(active.id);
      router.dismissTo(fighterHref.bouts);
    } catch (cause: unknown) {
      const message = weighInErrorMessage(cause);
      setIssue(message);
      showAppToast(message, "error");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  // Vượt hạng cân: báo ngay dưới ô nhập (biểu tượng + chữ), không chặn việc lưu.
  const typed = parseWeightInput(text);
  const overBy = active && track && typed.ok ? Math.round((typed.kg - track.limitKg) * 10) / 10 : 0;
  const overShown = !issue && overBy > 0 && !!track;
  const message = issue || (overShown ? "over" : "");
  const borderColor = message ? colors.danger : focused ? colors.ring : colors.line;
  const lastKg = track?.latestKg;
  const showSkeleton = useDelayedFlag(loading && !data && !error);

  const footer = (
    <View style={[styles.footer, { backgroundColor: colors.bg, borderTopColor: colors.line }]}>
      <ActionButton
        label={t.weigh.save}
        loadingLabel={t.weigh.saving}
        loading={saving}
        disabled={!active}
        onPress={() => void onSave()}
      />
    </View>
  );

  return (
    <FighterScreen title={t.weighInTitle} onBack keyboard specLayout refreshing={loading && !data} onRefresh={refresh} footer={footer}>
      {error ? <ConnectionBanner error={error} onRetry={reload} retrying={loading} hasData={!!data} /> : null}
      {showSkeleton ? (
        <View style={styles.stack}>
          <CardSkeleton height={WEIGH_SKELETON_HEIGHTS.context} />
          <CardSkeleton height={WEIGH_SKELETON_HEIGHTS.field} />
        </View>
      ) : null}
      {active && track ? (
        <View style={styles.stack}>
          <View style={[styles.context, { backgroundColor: colors.surface2 }]}>
            <Text style={[TEXT.cardTitle, { color: colors.ink }]}>{t.weigh.forBout(active.opponentName)}</Text>
            <Text style={[TEXT.body, { color: colors.ink }]}>
              {t.weigh.limitHint(formatKg(track.limitKg, true))}
              {lastKg != null && track.latestOn
                ? `  ·  ${t.weigh.lastTime(formatKg(lastKg), vnShortDate(track.latestOn))}`
                : ""}
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={[TEXT.bodyBold, { color: colors.ink }]}>{t.weigh.inputLabel}</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor }]}>
              <TextInput
                value={text}
                onChangeText={(next) => {
                  setText(next);
                  if (issue) setIssue("");
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onSubmitEditing={() => void onSave()}
                inputMode="decimal"
                keyboardType="decimal-pad"
                returnKeyType="done"
                placeholder={t.weigh.placeholder}
                placeholderTextColor={colors.disabledInk}
                selectionColor={colors.ring}
                accessibilityLabel={t.weigh.inputLabel}
                maxLength={7}
                style={[styles.input, { color: colors.ink }]}
              />
              <Text style={[TEXT.kg, { color: colors.ink }]}>{t.weigh.unit}</Text>
            </View>
            {message ? (
              <View accessibilityRole="alert" style={styles.issueRow}>
                <Icon name="warning" size={24} color={colors.danger} />
                {overShown && track ? (
                  <OverWeightText
                    over={formatKg(overBy)}
                    limitKg={formatKg(track.limitKg, true)}
                    className={active?.weightClassName}
                    color={colors.danger}
                  />
                ) : (
                  <Text style={[TEXT.bodyBold, styles.issue, { color: colors.danger }]}>{message}</Text>
                )}
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </FighterScreen>
  );
}

/** Skeleton đúng kích thước thẻ thật; đo ở 412 dp. */
export const WEIGH_SKELETON_HEIGHTS = { context: 88, field: 104 };

const styles = StyleSheet.create({
  stack: { gap: SPEC.gap, alignSelf: "stretch" },
  context: { borderRadius: SPEC.radius, padding: SPEC.card, gap: 8 },
  field: { gap: 8 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 2,
    borderRadius: SPEC.radius,
    paddingHorizontal: SPEC.card,
    minHeight: 72,
  },
  input: { flex: 1, minWidth: 0, ...TEXT.bigNumber, paddingVertical: 8, outlineStyle: "none" } as never,
  issueRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  issue: { flex: 1 },
  footer: { paddingHorizontal: SPEC.margin, paddingVertical: SPEC.card, borderTopWidth: StyleSheet.hairlineWidth },
});
