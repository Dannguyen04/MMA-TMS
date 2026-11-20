/**
 * NativeWind (react-native-css-interop 0.2) wraps every native Pressable and
 * merges its inline style by spreading it into an object. A style function,
 * `style={({ pressed }) => [...]}`, spreads to `{}`, so on Android/iOS those
 * rows and buttons lost all of their layout (no flexDirection, no borders).
 *
 * A Pressable with a style function never uses `className` in this app, so it
 * goes straight to React Native's Pressable; every other Pressable keeps the
 * NativeWind wrapper. Import once, before any screen renders.
 */
import { forwardRef, type ComponentType } from "react";
// Not React.createElement: NativeWind's Babel plugin rewrites that into its own
// interop call, which would route Pressable back to this wrapper forever.
import { jsx } from "react/jsx-runtime";
import { Platform, Pressable, type PressableProps } from "react-native";

if (Platform.OS !== "web") {
  // Registers NativeWind's wrappers now, so ours replaces theirs instead of the other way round.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("react-native-css-interop/dist/runtime/components");
  // The registry lives in the runtime api module that NativeWind's JSX wrapper reads;
  // the package root does not export it.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { interopComponents } = require("react-native-css-interop/dist/runtime/api") as {
    interopComponents?: Map<unknown, ComponentType<PressableProps>>;
  };
  const wrapped = interopComponents?.get(Pressable);
  if (!interopComponents || !wrapped) {
    if (__DEV__) console.warn("[pressable-style-fix] NativeWind Pressable wrapper not found; style functions stay broken");
  } else {
    const Fixed = forwardRef<unknown, PressableProps>(function PressableStyleFix(props, ref) {
      return jsx(typeof props.style === "function" ? Pressable : wrapped, { ...props, ref });
    });
    interopComponents.set(Pressable, Fixed as unknown as ComponentType<PressableProps>);
  }
}

export {};
