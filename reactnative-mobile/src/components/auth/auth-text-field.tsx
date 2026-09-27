import { MaterialCommunityIcons } from "@expo/vector-icons";
import { forwardRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, type TextInputProps } from "react-native";

import { AuthUnderlineField } from "@/components/auth/auth-underline-field";
import { useAuthChrome } from "@/components/auth/auth-shell";
import { vi } from "@/i18n/vi";
import { spacing, type, useThemePreference } from "@/theme";

type AuthTextFieldProps = TextInputProps & {
  label: string;
  error?: string;
  helper?: string;
  helperPersistent?: boolean;
  secureToggle?: boolean;
};

export const AuthTextField = forwardRef<TextInput, AuthTextFieldProps>(
  function AuthTextField(
    {
      label,
      error,
      helper,
      helperPersistent,
      secureToggle,
      secureTextEntry,
      onFocus,
      onBlur,
      placeholder,
      value,
      defaultValue,
      ...props
    },
    ref,
  ) {
    const { colors } = useThemePreference();
    const chrome = useAuthChrome();
    const [focused, setFocused] = useState(false);
    const [hidden, setHidden] = useState(true);
    const isSecure = secureToggle ? hidden : secureTextEntry;
    const filled = String(value ?? defaultValue ?? "").length > 0;
    const invalidState = { invalid: Boolean(error) };

    return (
      <AuthUnderlineField
        label={label}
        error={error}
        helper={helper}
        helperPersistent={helperPersistent}
        focused={focused}
        filled={filled}
        accessory={
          secureToggle ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={hidden ? vi.a11y.showPassword : vi.a11y.hidePassword}
              hitSlop={8}
              onPress={() => setHidden((current) => !current)}
              style={styles.eye}
            >
              <MaterialCommunityIcons
                name={hidden ? "eye-outline" : "eye-off-outline"}
                size={22}
                color={colors.inkMuted}
              />
            </Pressable>
          ) : null
        }
        accessibilityLabel={error ? `${label}. ${error}` : label}
      >
        <TextInput
          ref={ref}
          {...props}
          value={value}
          defaultValue={defaultValue}
          secureTextEntry={isSecure}
          placeholder={focused || filled ? placeholder : undefined}
          placeholderTextColor={colors.inkSubtle}
          accessibilityState={invalidState}
          accessibilityLabel={error ? `${label}. ${error}` : label}
          onFocus={(event) => {
            setFocused(true);
            chrome?.setInputFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            chrome?.setInputFocused(false);
            onBlur?.(event);
          }}
          style={[
            styles.input,
            type.body,
            { color: colors.ink },
            props.multiline
              ? { minHeight: 88, textAlignVertical: "top", paddingTop: spacing.md }
              : null,
          ]}
        />
      </AuthUnderlineField>
    );
  },
);

const styles = StyleSheet.create({
  input: {
    width: "100%",
    minHeight: 44,
    paddingVertical: spacing.xs,
    paddingHorizontal: 0,
    margin: 0,
  },
  eye: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
