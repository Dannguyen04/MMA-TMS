import { useState } from "react";
import { Text } from "react-native";
import * as Haptics from "expo-haptics";
import { Link, useRouter } from "expo-router";

import { forgotPassword } from "@/api/auth";
import { AuthButton } from "@/components/auth/auth-button";
import { AuthFormError } from "@/components/auth/auth-form-error";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthTextField } from "@/components/auth/auth-text-field";
import { vi } from "@/i18n/vi";
import { mapApiMessage } from "@/session/map-api-message";
import { type, useThemePreference } from "@/theme";
import { isValidEmail } from "@/utils/is-valid-email";

export function ForgotPasswordScreen() {
  const { colors } = useThemePreference();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [notice, setNotice] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = () => {
    if (submitting) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setSent(false);
      setNotice("");
      setEmailError(vi.field.required);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      setSent(false);
      setNotice("");
      setEmailError(vi.field.invalidEmail);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }

    setEmailError("");
    setNotice("");
    setSent(false);
    setSubmitting(true);
    void forgotPassword({ email: trimmedEmail })
      .then(() => {
        setSent(true);
        setNotice(vi.forgot.sent);
      })
      .catch((error: unknown) => {
        setNotice(mapApiMessage(error));
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  return (
    <AuthShell
      title={vi.forgot.title}
      subtitle={vi.forgot.subtitle}
      onBack={() => router.back()}
      backDisabled={submitting}
      backLabel={vi.forgot.back}
      footer={
        <Text style={[type.caption, { color: colors.inkMuted, textAlign: "center" }]}>
          {vi.register.haveAccount}{" "}
          <Link href="/login" style={[type.link, { color: colors.lotus }]}>
            {vi.register.toLogin}
          </Link>
        </Text>
      }
      cta={
        <AuthButton
          testID="forgot-submit"
          title={vi.forgot.submit}
          onPress={onSubmit}
          loading={submitting}
          disabled={submitting}
        />
      }
      banner={<AuthFormError message={notice} tone={sent ? "success" : "danger"} />}
    >
      <AuthTextField
        label={vi.forgot.email}
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setEmailError("");
          setNotice("");
          setSent(false);
        }}
        error={emailError}
        editable={!submitting}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="done"
        onSubmitEditing={onSubmit}
      />
    </AuthShell>
  );
}
