import * as Haptics from "expo-haptics";

import { Link, useRouter } from "expo-router";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {

  BackHandler,

  Keyboard,

  StyleSheet,

  Text,

  TextInput,

  View,

} from "react-native";



import { register as registerAccount } from "@/api/auth";

import { persistSession } from "@/api/tokens";

import { toFighterRegisterBody } from "@/auth/fighter-register-body";

import {

  applyRegisterFieldErrors,

  type RegisterStep,

  validateRegisterStep,

  validateRegisterStep1,

  validateRegisterStep2,

} from "@/auth/register-steps";

import { AuthButton } from "@/components/auth/auth-button";

import { AuthDateField } from "@/components/auth/auth-date-field";

import { AuthFormError } from "@/components/auth/auth-form-error";

import { AuthSection } from "@/components/auth/auth-section";

import { AuthSelectField } from "@/components/auth/auth-select-field";

import { AuthShell } from "@/components/auth/auth-shell";

import { AuthStepPager } from "@/components/auth/auth-step-pager";

import { AuthStepRail } from "@/components/auth/auth-step-rail";

import { AuthTextField } from "@/components/auth/auth-text-field";

import { WEIGHT_CLASSES, type WeightClass } from "@/constants/weight-classes";

import { vi } from "@/i18n/vi";

import { mapApiMessage } from "@/session/map-api-message";

import { homeHrefForGate, useSession } from "@/session/session-context";

import { spacing, type, useThemePreference } from "@/theme";



const RAIL_LABELS: [string, string] = [vi.register.stepRail1, vi.register.stepRail2];



export function RegisterScreen() {

  const { colors } = useThemePreference();

  const router = useRouter();

  const { applyRegisteredSession } = useSession();

  const submitLock = useRef(false);

  const [step, setStep] = useState<RegisterStep>(1);

  const [direction, setDirection] = useState<1 | -1>(1);

  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const [lastName, setLastName] = useState("");

  const [firstName, setFirstName] = useState("");

  const [email, setEmail] = useState("");

  const [dateOfBirth, setDateOfBirth] = useState("");

  const [weightClass, setWeightClass] = useState<WeightClass | "">("");

  const [password, setPassword] = useState("");

  const [confirm, setConfirm] = useState("");

  const [passwordFocused, setPasswordFocused] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formError, setFormError] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const [checkEmail, setCheckEmail] = useState(false);

  const firstNameRef = useRef<TextInput>(null);

  const passwordRef = useRef<TextInput>(null);

  const confirmRef = useRef<TextInput>(null);



  const form = {

    lastName,

    firstName,

    dateOfBirth,

    email,

    password,

    confirm,

    weightClass,

  };



  const weightOptions = useMemo(

    () =>

      WEIGHT_CLASSES.map((value) => ({

        value,

        label: vi.weightClass[value],

      })),

    [],

  );



  const railEnabled: [boolean, boolean] = [

    true,

    Object.keys(validateRegisterStep1(form)).length === 0,

  ];



  const clearError = (key: string) => {

    setFormError("");

    setErrors((prev) => ({ ...prev, [key]: "" }));

  };



  const failContinue = (next: Record<string, string>) => {

    setErrors(next);

    setFormError(applyRegisterFieldErrors(next));

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

  };



  const goTo = useCallback((next: RegisterStep, dir: 1 | -1) => {

    setDirection(dir);

    setStep(next);

    setErrors({});

    setFormError("");

  }, []);



  const tryAdvance = (next: RegisterStep) => {

    if (next === step) return;

    if (next < step) {

      goTo(next, -1);

      return;

    }

    for (let current = step; current < next; current += 1) {

      const invalid = validateRegisterStep(current as RegisterStep, form);

      if (Object.keys(invalid).length > 0) {

        failContinue(invalid);

        return;

      }

    }

    goTo(next, 1);

  };



  const onContinue = () => {

    if (step === 2) return;

    const invalid = validateRegisterStep(step, form);

    if (Object.keys(invalid).length > 0) {

      failContinue(invalid);

      return;

    }

    goTo(2, 1);

  };



  const onBackStep = useCallback(() => {

    if (submitting) return;

    if (step === 1) {

      router.back();

      return;

    }

    goTo(1, -1);

  }, [goTo, router, step, submitting]);



  useEffect(() => {

    const sub = BackHandler.addEventListener("hardwareBackPress", () => {

      if (checkEmail) return false;

      if (submitting) return true;

      if (step === 1) return false;

      goTo(1, -1);

      return true;

    });

    return () => sub.remove();

  }, [checkEmail, goTo, step, submitting]);



  const submitRegister = () => {

    if (submitting || submitLock.current) return;



    const identityErrors = validateRegisterStep1(form);

    const accountErrors = validateRegisterStep2(form);

    if (Object.keys(identityErrors).length > 0) {

      setStep(1);

      setDirection(-1);

      failContinue(identityErrors);

      return;

    }

    if (Object.keys(accountErrors).length > 0) {

      setStep(2);

      setDirection(-1);

      failContinue(accountErrors);

      return;

    }



    const registerBody = toFighterRegisterBody({

      email: email.trim(),

      password,

      firstName: firstName.trim(),

      lastName: lastName.trim(),

      dateOfBirth: dateOfBirth.trim(),

      weightClass: weightClass as WeightClass,

    });



    setErrors({});

    setFormError("");

    submitLock.current = true;

    setSubmitting(true);

    void registerAccount(registerBody)

      .then(async (result) => {

        if (result.confirmationRequired || result.session == null) {

          setCheckEmail(true);

          return;

        }

        await persistSession(result.session);

        const next = applyRegisteredSession(result.user);

        router.replace(homeHrefForGate(next));

      })

      .catch((error: unknown) => {

        setFormError(mapApiMessage(error));

      })

      .finally(() => {

        submitLock.current = false;

        setSubmitting(false);

      });

  };



  if (checkEmail) {

    return (

      <AuthShell

        title={vi.register.checkEmailTitle}

        footer={

          <Text style={[type.caption, { color: colors.inkMuted, textAlign: "center" }]}>

            <Link href="/login" style={[type.link, { color: colors.lotus }]}>

              {vi.register.toLoginAfterConfirm}

            </Link>

          </Text>

        }

        cta={

          <AuthButton title={vi.register.toLogin} onPress={() => router.replace("/login")} />

        }

        banner={<AuthFormError message={vi.register.checkEmail} tone="success" />}

      >

        {null}

      </AuthShell>

    );

  }



  const stepFields =

    step === 1 ? (

      <AuthSection>

        <AuthTextField

          label={vi.register.lastName}

          value={lastName}

          onChangeText={(value) => {

            setLastName(value);

            clearError("lastName");

          }}

          error={errors.lastName}

          autoComplete="family-name"

          textContentType="familyName"

          returnKeyType="next"

          blurOnSubmit={false}

          onSubmitEditing={() => firstNameRef.current?.focus()}

        />

        <AuthTextField

          ref={firstNameRef}

          label={vi.register.firstName}

          value={firstName}

          onChangeText={(value) => {

            setFirstName(value);

            clearError("firstName");

          }}

          error={errors.firstName}

          autoComplete="given-name"

          textContentType="givenName"

          returnKeyType="done"

          onSubmitEditing={() => Keyboard.dismiss()}

        />

        <AuthDateField

          label={vi.register.dateOfBirth}

          value={dateOfBirth}

          onChangeText={(value) => {

            setDateOfBirth(value);

            clearError("dateOfBirth");

          }}

          error={errors.dateOfBirth}

        />

        <AuthSelectField

          label={vi.register.weightClass}

          value={weightClass}

          placeholder={vi.register.weightClassPlaceholder}

          options={weightOptions}

          error={errors.weightClass}

          onChange={(value) => {

            if (!value) return;

            setWeightClass(value);

            clearError("weightClass");

          }}

        />

      </AuthSection>

    ) : (

      <AuthSection>

        <AuthTextField

          label={vi.register.email}

          value={email}

          onChangeText={(value) => {

            setEmail(value);

            clearError("email");

          }}

          error={errors.email}

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

          label={vi.register.password}

          value={password}

          onChangeText={(value) => {

            setPassword(value);

            clearError("password");

          }}

          error={errors.password}

          helper={passwordFocused ? vi.register.passwordHint : undefined}

          onFocus={() => setPasswordFocused(true)}

          onBlur={() => setPasswordFocused(false)}

          secureToggle

          autoComplete="new-password"

          textContentType="newPassword"

          returnKeyType="next"

          blurOnSubmit={false}

          onSubmitEditing={() => confirmRef.current?.focus()}

        />

        <AuthTextField

          ref={confirmRef}

          label={vi.register.confirm}

          value={confirm}

          onChangeText={(value) => {

            setConfirm(value);

            clearError("confirm");

          }}

          error={errors.confirm}

          secureToggle

          autoComplete="new-password"

          textContentType="newPassword"

          returnKeyType="done"

          onSubmitEditing={submitRegister}

        />

      </AuthSection>

    );



  return (

    <AuthShell

      title={vi.register.title}

      onBack={step > 1 ? onBackStep : undefined}

      backLabel={step > 1 ? vi.register.backStep : undefined}

      backDisabled={submitting}

      hideFooterWhenKeyboard

      onChromeChange={({ keyboardVisible: nextK }) => {

        setKeyboardVisible(nextK);

      }}

      chrome={

        <>

          <AuthStepRail

            step={step}

            labels={RAIL_LABELS}

            compact={keyboardVisible}

            enabled={railEnabled}

            onSelect={(next) => {

              if (submitting) return;

              tryAdvance(next);

            }}

          />

        </>

      }

      footer={

        <Text style={[type.caption, { color: colors.inkMuted, textAlign: "center" }]}>

          {vi.register.haveAccount}{" "}

          <Link href="/login" style={[type.link, { color: colors.lotus }]}>

            {vi.register.toLogin}

          </Link>

        </Text>

      }

      cta={

        step < 2 ? (

          <AuthButton testID="register-continue" title={vi.register.continue} onPress={onContinue} />

        ) : (

          <View style={styles.ctaStack}>

            <AuthButton

              testID="register-submit"

              title={vi.register.submit}

              onPress={submitRegister}

              loading={submitting}

              disabled={submitting}

            />

          </View>

        )

      }

      banner={<AuthFormError message={formError} />}

    >

      <AuthStepPager step={step} direction={direction}>

        {stepFields}

      </AuthStepPager>

    </AuthShell>

  );

}



const styles = StyleSheet.create({

  ctaStack: {

    gap: spacing.xs,

  },

});

