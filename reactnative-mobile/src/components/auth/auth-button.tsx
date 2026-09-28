import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
} from "react-native";

import { radius, type, useThemePreference } from "@/theme";

type AuthButtonProps = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  testID?: string;
};

export function AuthButton({
  title,
  onPress,
  loading,
  disabled,
  variant = "primary",
  testID,
}: AuthButtonProps) {
  const { colors } = useThemePreference();
  const inactive = disabled || loading;
  const isSecondary = variant === "secondary";

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={[
        isSecondary ? styles.secondary : styles.cta,
        isSecondary
          ? null
          : { backgroundColor: inactive ? colors.disabledFill : colors.cta },
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={
            isSecondary ? colors.lotus : inactive ? colors.disabledInk : colors.onCta
          }
        />
      ) : (
        <Text
          style={[
            type.cta,
            {
              color: isSecondary
                ? inactive
                  ? colors.disabledInk
                  : colors.lotus
                : inactive
                  ? colors.disabledInk
                  : colors.onCta,
            },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cta: {
    minHeight: 52,
    borderRadius: radius.field,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  secondary: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
});
