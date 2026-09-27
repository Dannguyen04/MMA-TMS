import { useRef, useState } from "react";
import { Keyboard, StyleSheet, Text, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Link, useRouter } from "expo-router";

import { AuthButton } from "@/components/auth/auth-button";
import { AuthDemoSwitch } from "@/components/auth/auth-demo-switch";
import { AuthFormError } from "@/components/auth/auth-form-error";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthTextField } from "@/components/auth/auth-text-field";
import { vi } from "@/i18n/vi";
import { mapApiMessage } from "@/session/map-api-message";
import { homeHrefForGate, useSession } from "@/session/session-context";
import { spacing, type, useThemePreference } from "@/theme";
import { isValidEmail } from "@/utils/is-valid-email";

export function LoginScreen() {
  const { colors } = useThemePreference();
  const { signIn } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const onSubmit = () => {
    if (submitting) return;

    const trimmedEmail = email.trim();
    const empty = !trimmedEmail || !password;
    if (empty) {
      setFormError(vi.login.fillRequired);
      setEmailError(trimmedEmail ? "" : vi.field.required);
      setPasswordError(password ? "" : vi.field.required);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      setPasswordError("");
      setFormError(vi.field.invalidEmail);
      setEmailError(vi.field.invalidEmail);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }

    setEmailError("");
    setPasswordError("");
    setFormError("");
    setSubmitting(true);
    void signIn({ email: trimmedEmail, password })
      .then((next) => {
        router.replace(homeHrefForGate(next));
      })
      .catch((error: unknown) => {
        setFormError(mapApiMessage(error));
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  return (
    <>
      <AuthShell
        title={vi.login.title}
        subtitle={vi.login.subtitle}
        hideFooterWhenKeyboard
        onWordmarkLongPress={() => {
          Keyboard.dismiss();
          setDemoOpen(true);
        }}
        footer={
          <View style={styles.footer}>
            <Text style={[type.caption, { color: colors.inkMuted, textAlign: "center" }]}>
              {vi.login.noAccount}{" "}
              <Link href="/register" style={[type.link, { color: colors.lotus }]}>
                {vi.login.create}
              </Link>
            </Text>
            <Link
              href="/forgot-password"
              style={[type.caption, { color: colors.inkSubtle, textAlign: "center" }]}
            >
              {vi.login.forgot}
            </Link>
          </View>
        }
        cta={
          <AuthButton
            testID="login-submit"
            title={vi.login.submit}
            onPress={onSubmit}
            loading={submitting}
            disabled={submitting}
          />
        }
        banner={<AuthFormError message={formError} />}
      >
        <AuthTextField
          label={vi.login.email}
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setEmailError("");
            setPasswordError("");
            setFormError("");
          }}
          error={emailError}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <AuthTextField
          ref={passwordRef}
          label={vi.login.password}
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setPasswordError("");
            setFormError("");
          }}
          error={passwordError}
          secureToggle
          autoComplete="password"
          textContentType="password"
          returnKeyType="done"
          onSubmitEditing={onSubmit}
        />
      </AuthShell>
      <AuthDemoSwitch open={demoOpen} onClose={() => setDemoOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  footer: {
    gap: spacing.xs,
    width: "100%",
    alignItems: "center",
    overflow: "hidden",
  },
});
