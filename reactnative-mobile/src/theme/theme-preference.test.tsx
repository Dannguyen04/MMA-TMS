import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Appearance, Pressable, Text } from "react-native";

import {
  resolveScheme,
  ThemePreferenceProvider,
  useThemePreference,
} from "@/theme/theme-preference";

function Probe() {
  const { preference, resolvedScheme, setPreference } = useThemePreference();
  return (
    <>
      <Text>{`${preference}:${resolvedScheme}`}</Text>
      <Pressable accessibilityRole="button" onPress={() => setPreference("system")}>
        <Text>use-system</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => setPreference("light")}>
        <Text>use-light</Text>
      </Pressable>
    </>
  );
}

describe("resolveScheme", () => {
  it("keeps explicit light and dark regardless of Appearance", () => {
    expect(resolveScheme("light", "dark")).toBe("light");
    expect(resolveScheme("dark", "light")).toBe("dark");
  });

  it("follows Appearance when preference is system", () => {
    expect(resolveScheme("system", "dark")).toBe("dark");
    expect(resolveScheme("system", "light")).toBe("light");
    expect(resolveScheme("system", "unspecified")).toBe("light");
    expect(resolveScheme("system", null)).toBe("light");
  });
});

describe("ThemePreferenceProvider system Appearance", () => {
  const listeners: Array<(prefs: { colorScheme: string | null | undefined }) => void> = [];
  let osScheme: "light" | "dark" = "light";

  beforeEach(() => {
    listeners.length = 0;
    osScheme = "light";
    jest.spyOn(Appearance, "getColorScheme").mockImplementation(() => osScheme);
    jest.spyOn(Appearance, "setColorScheme").mockImplementation((scheme) => {
      if (scheme === "light" || scheme === "dark") osScheme = scheme;
    });
    const originalAdd = Appearance.addChangeListener.bind(Appearance);
    jest.spyOn(Appearance, "addChangeListener").mockImplementation((listener) => {
      listeners.push(listener);
      const sub = originalAdd(listener);
      return {
        remove: () => {
          sub.remove();
        },
      };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("updates resolvedScheme live when OS appearance changes in system mode", async () => {
    await render(
      <ThemePreferenceProvider>
        <Probe />
      </ThemePreferenceProvider>,
    );

    expect(await screen.findByText("system:light")).toBeTruthy();
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      osScheme = "dark";
      listeners.forEach((listener) => listener({ colorScheme: "dark" }));
    });

    expect(await screen.findByText("system:dark")).toBeTruthy();
  });

  it("unpins native scheme with unspecified and ignores OS while light is selected", async () => {
    await render(
      <ThemePreferenceProvider>
        <Probe />
      </ThemePreferenceProvider>,
    );

    fireEvent.press(await screen.findByText("use-light"));
    expect(await screen.findByText("light:light")).toBeTruthy();
    expect(Appearance.setColorScheme).toHaveBeenCalledWith("light");

    await act(async () => {
      osScheme = "dark";
      listeners.forEach((listener) => listener({ colorScheme: "dark" }));
    });
    expect(await screen.findByText("light:light")).toBeTruthy();

    fireEvent.press(await screen.findByText("use-system"));
    expect(Appearance.setColorScheme).toHaveBeenCalledWith("unspecified");
  });

  it("hydrates without calling setColorScheme when the API is missing (web)", async () => {
    Object.defineProperty(Appearance, "setColorScheme", {
      configurable: true,
      writable: true,
      value: undefined,
    });

    await render(
      <ThemePreferenceProvider>
        <Probe />
      </ThemePreferenceProvider>,
    );

    expect(await screen.findByText("system:light")).toBeTruthy();

    fireEvent.press(await screen.findByText("use-light"));
    expect(await screen.findByText("light:light")).toBeTruthy();
  });
});
