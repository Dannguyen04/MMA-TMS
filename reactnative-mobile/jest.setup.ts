declare global {
  // eslint-disable-next-line no-var
  var __authRouter: { replace: jest.Mock; back: jest.Mock } | undefined;
  var __authParams: Record<string, string | string[] | undefined> | undefined;
}

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

jest.mock(
  "expo-asset",
  () => ({
    Asset: { fromModule: () => ({ downloadAsync: jest.fn() }) },
  }),
  { virtual: true },
);

jest.mock("expo-font", () => ({
  isLoaded: () => true,
  loadAsync: jest.fn(),
  useFonts: () => [true],
}));

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return new Proxy(
    {},
    {
      get: (_target: unknown, name: string) => {
        function Icon(props: { name?: string }) {
          return React.createElement(Text, props, String(props.name ?? name));
        }
        return Icon;
      },
    },
  );
});

// Lottie: native view không chạy trong jest → View rỗng.
jest.mock("lottie-react-native", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { __esModule: true, default: (props: object) => React.createElement(View, props) };
});

jest.mock("react-native-toast-message", () => {
  const React = require("react");
  const { View } = require("react-native");
  function Toast(props: object) {
    return React.createElement(View, props);
  }
  Toast.show = jest.fn();
  Toast.hide = jest.fn();
  return {
    __esModule: true,
    default: Toast,
    BaseToast: (props: object) => React.createElement(View, props),
  };
});

jest.mock("react-native-worklets", () => ({
  createSerializable: (value: unknown) => value,
}));

jest.mock("react-native-reanimated", () => {
  const { View, Text } = require("react-native");
  const identity = (value: unknown) => value;
  return {
    __esModule: true,
    default: {
      View,
      Text,
      createAnimatedComponent: (component: unknown) => component,
    },
    FadeIn: { duration: () => ({}) },
    FadeInLeft: { duration: () => ({}) },
    FadeInRight: { duration: () => ({}) },
    FadeOut: { duration: () => ({}) },
    FadeOutLeft: { duration: () => ({}) },
    FadeOutRight: { duration: () => ({}) },
    useReducedMotion: () => false,
    useSharedValue: (value: number) => ({ value }),
    makeMutable: (value: number) => ({ value }),
    useAnimatedStyle: () => ({}),
    useAnimatedProps: () => ({}),
    withTiming: identity,
    withRepeat: identity,
    withSequence: (...args: unknown[]) => args[0],
    cancelAnimation: jest.fn(),
    interpolate: (_v: number, _input: number[], output: number[]) => output[0] ?? 0,
    Easing: {
      bezier: () => undefined,
      linear: undefined,
      inOut: () => undefined,
      out: () => undefined,
      in: () => undefined,
      sin: undefined,
      cubic: undefined,
      quad: undefined,
    },
    View,
    Text,
    createAnimatedComponent: (component: unknown) => component,
  };
});

jest.mock("@/theme", () => {
  const React = require("react");
  const actual = jest.requireActual("@/theme") as typeof import("@/theme");
  return {
    ...actual,
    ThemePreferenceProvider: ({ children }: { children: React.ReactNode }) => children,
    useThemePreference: () => ({
      preference: "light",
      setPreference: jest.fn(),
      resolvedScheme: "light",
      colors: actual.palettes.light,
    }),
    useColors: () => ({
      scheme: "light" as const,
      variant: "light" as const,
      colors: actual.palettes.light,
      semantic: {
        background: actual.palettes.light.bg,
        surface: actual.palettes.light.surface,
        surfaceMuted: actual.palettes.light.surfaceMuted,
        textPrimary: actual.palettes.light.ink,
        textSecondary: actual.palettes.light.inkMuted,
        textTertiary: actual.palettes.light.inkSubtle,
        accent: actual.palettes.light.cta,
        onAccent: actual.palettes.light.onCta,
        link: actual.palettes.light.lotus,
        border: actual.palettes.light.line,
        controlBorder: actual.palettes.light.controlBorder,
        focusRing: actual.palettes.light.ring,
        danger: actual.palettes.light.danger,
        dangerSurface: actual.palettes.light.dangerSoft,
        success: actual.palettes.light.success,
        successSurface: actual.palettes.light.successSoft,
        disabledSurface: actual.palettes.light.disabledFill,
        disabledText: actual.palettes.light.disabledInk,
        brandCage: actual.palettes.light.cage,
      },
    }),
    useTypography: () => ({
      family: "ibmPlexSans",
      fontScale: 1,
      osFontScale: 1,
      faces: {
        regular: "System",
        medium: "System",
        semibold: "System",
        bold: "System",
      },
      sizeFactor: 1,
      lineHeight: 1.35,
      letterSpacingEm: 0,
      bold: false,
    }),
  };
});

jest.mock("expo-router", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    Link: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement(Text, { ...props, accessibilityRole: "link" }, children),
    useRouter: () => globalThis.__authRouter ?? { replace: jest.fn(), back: jest.fn() },
    useLocalSearchParams: () => globalThis.__authParams ?? {},
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(() => effect(), [effect]);
    },
  };
});
