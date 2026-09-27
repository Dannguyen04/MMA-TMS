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
  };
});
