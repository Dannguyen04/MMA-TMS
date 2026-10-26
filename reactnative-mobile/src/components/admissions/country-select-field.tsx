import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { FlatList, Keyboard, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthUnderlineField } from "@/components/auth/auth-underline-field";
import { filterCountries, findCountry, type Country } from "@/constants/countries";
import { vi } from "@/i18n/vi";
import { radius, spacing, type, useThemePreference } from "@/theme";

const ROW_HEIGHT = 48;
const ROW_GAP = spacing.xs;

type CountrySelectFieldProps = {
  label: string;
  value: string;
  helper?: string;
  onChange: (code: string) => void;
};

export function CountrySelectField({ label, value, helper, onChange }: CountrySelectFieldProps) {
  const { colors } = useThemePreference();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = findCountry(value);
  const results = useMemo(() => filterCountries(query), [query]);
  const selectedIndex = selected ? results.findIndex((country) => country.code === selected.code) : -1;

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const pick = (country: Country) => {
    onChange(country.code);
    close();
  };

  return (
    <View style={styles.root}>
      <AuthUnderlineField
        label={label}
        helper={helper}
        helperPersistent
        focused={open}
        filled={Boolean(selected)}
        onPress={() => {
          Keyboard.dismiss();
          setOpen(true);
        }}
        accessibilityLabel={selected ? `${label}. ${selected.name}` : label}
        accessory={<MaterialCommunityIcons name="chevron-down" size={22} color={colors.inkMuted} />}
      >
        <View style={styles.value}>
          {selected ? (
            <>
              <Text style={styles.flag}>{selected.flag}</Text>
              <Text numberOfLines={1} style={[type.body, styles.valueText, { color: colors.ink }]}>
                {selected.name}
              </Text>
            </>
          ) : null}
        </View>
      </AuthUnderlineField>

      <Modal visible={open} animationType="fade" transparent onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                paddingBottom: Math.max(insets.bottom, spacing.md),
              },
            ]}
            onPress={() => undefined}
          >
            <Text style={[type.title, { color: colors.ink, fontSize: 22 }]}>{label}</Text>
            <View style={[styles.search, { borderColor: colors.line, backgroundColor: colors.surfaceMuted }]}>
              <MaterialCommunityIcons name="magnify" size={20} color={colors.inkMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={vi.admission.countrySearch}
                placeholderTextColor={colors.inkSubtle}
                accessibilityLabel={vi.admission.countrySearch}
                autoCorrect={false}
                autoCapitalize="none"
                style={[type.body, styles.searchInput, { color: colors.ink }]}
              />
            </View>
            <FlatList
              data={results}
              keyExtractor={(country) => country.code}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              contentContainerStyle={styles.listContent}
              initialNumToRender={20}
              initialScrollIndex={selectedIndex > 0 ? selectedIndex : undefined}
              getItemLayout={(_, index) => ({
                length: ROW_HEIGHT + ROW_GAP,
                offset: (ROW_HEIGHT + ROW_GAP) * index,
                index,
              })}
              ListEmptyComponent={
                <Text style={[type.body, styles.empty, { color: colors.inkMuted }]}>
                  {vi.admission.countryEmpty}
                </Text>
              }
              renderItem={({ item }) => {
                const active = item.code === selected?.code;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={item.name}
                    accessibilityState={{ selected: active }}
                    onPress={() => pick(item)}
                    style={[styles.option, active ? { backgroundColor: colors.surfaceMuted } : null]}
                  >
                    <Text style={styles.flag}>{item.flag}</Text>
                    <Text numberOfLines={1} style={[type.body, styles.optionName, { color: colors.ink }]}>
                      {item.name}
                    </Text>
                    <Text style={[type.caption, { color: colors.inkMuted }]}>{`+${item.callingCode}`}</Text>
                    {active ? <MaterialCommunityIcons name="check" size={20} color={colors.lotus} /> : null}
                  </Pressable>
                );
              }}
            />
            <Pressable accessibilityRole="button" onPress={close} style={styles.close}>
              <Text style={[type.link, { color: colors.lotus }]}>{vi.common.close}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
    minWidth: 0,
  },
  value: {
    minHeight: 44,
    paddingVertical: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minWidth: 0,
  },
  valueText: {
    flexShrink: 1,
    minWidth: 0,
  },
  flag: {
    fontSize: 22,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    height: "80%",
    borderTopLeftRadius: radius.panel,
    borderTopRightRadius: radius.panel,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  search: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radius.field,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 0,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: spacing.sm,
  },
  empty: {
    paddingVertical: spacing.lg,
    textAlign: "center",
  },
  option: {
    height: ROW_HEIGHT,
    marginBottom: ROW_GAP,
    borderRadius: radius.field,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  optionName: {
    flex: 1,
    minWidth: 0,
  },
  close: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
