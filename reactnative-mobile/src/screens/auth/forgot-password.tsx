import { useState } from "react";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

import { forgotPassword } from "@/api/auth";
import { AuthVisionButton, AuthVisionField, AuthVisionShell } from "@/components/auth/auth-vision-shell";
import { useToastMessage } from "@/components/toast/app-toast";
import { vi } from "@/i18n/vi";
import { mapApiMessage } from "@/session/map-api-message";
import { isValidEmail } from "@/utils/is-valid-email";

export function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [notice, setNotice] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  useToastMessage(notice, sent ? "success" : "error");
  const canSubmit = email.trim().length > 0 && !submitting;

  const onSubmit = () => {
    if (!canSubmit) return;

    const trimmedEmail = email.trim();
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
    <AuthVisionShell
      title={vi.forgot.title}
      subtitle={vi.forgot.subtitle}
      onBack={() => router.replace("/login")}
      backDisabled={submitting}
      backLabel={vi.forgot.back}
      action={
        <AuthVisionButton
          testID="forgot-submit"
          title={vi.forgot.submit}
          onPress={onSubmit}
          loading={submitting}
          disabled={!canSubmit}
        />
      }
    >
      <AuthVisionField
        label={vi.forgot.email}
        placeholder={vi.login.emailPlaceholder}
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
    </AuthVisionShell>
  );
}
