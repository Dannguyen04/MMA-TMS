import { useRef, useState } from "react";
import { Keyboard, StyleSheet, Text, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Link, useRouter } from "expo-router";

import { AuthDemoSwitch } from "@/components/auth/auth-demo-switch";
import {
  AuthVisionButton,
  AuthVisionField,
  AuthVisionShell,
} from "@/components/auth/auth-vision-shell";
import { authType, useAuthColors } from "@/components/auth/auth-vision-tokens";
import { useToastMessage } from "@/components/toast/app-toast";
import { vi } from "@/i18n/vi";
import { mapApiMessage } from "@/session/map-api-message";
import { homeHrefForGate, useSession } from "@/session/session-context";
import { isValidEmail } from "@/utils/is-valid-email";

export function LoginScreen() {
  const { signIn } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useToastMessage(formError, "error");
  const [demoOpen, setDemoOpen] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const canSubmit = email.trim().length > 0 && password.length > 0;

  const onSubmit = () => {
    if (submitting || !canSubmit) return;

    const trimmedEmail = email.trim();
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

  const c = useAuthColors();
  const canLeave = typeof router.canGoBack === "function" && router.canGoBack();

  return (
    <>
      <AuthVisionShell
        title={vi.login.title}
        onBack={canLeave ? () => router.back() : undefined}
        onWordmarkLongPress={() => {
          Keyboard.dismiss();
          setDemoOpen(true);
        }}
        action={
          <AuthVisionButton
            testID="login-submit"
            title={vi.login.submit}
            onPress={onSubmit}
            loading={submitting}
            disabled={!canSubmit}
          />
        }
        link={
          <Link href="/forgot-password" style={[authType.link, styles.forgot, { color: c.ink }]}>
            {vi.login.forgot}
          </Link>
        }
        below={
          <Text style={[authType.caption, styles.footerText, { color: c.ink }]}>
            {vi.login.noAccount}{" "}
            <Link href="/register" style={[authType.link, { color: c.accent }]}>
              {vi.login.create}
            </Link>
          </Text>
        }
      >
        <View style={styles.credentials}>
          <AuthVisionField
            label={vi.login.email}
            placeholder={vi.login.emailPlaceholder}
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
          <AuthVisionField
            ref={passwordRef}
            label={vi.login.password}
            placeholder={vi.login.passwordPlaceholder}
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setPasswordError("");
              setFormError("");
            }}
            error={passwordError}
            secureToggle
            autoCapitalize="none"
            autoComplete="password"
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={onSubmit}
          />
        </View>
      </AuthVisionShell>
      <AuthDemoSwitch open={demoOpen} onClose={() => setDemoOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  credentials: {
    gap: 12,
    width: "100%",
  },
  forgot: {
    minHeight: 44,
    textAlignVertical: "center",
    textDecorationLine: "underline",
  },
  footerText: {
    textAlign: "center",
  },
});
