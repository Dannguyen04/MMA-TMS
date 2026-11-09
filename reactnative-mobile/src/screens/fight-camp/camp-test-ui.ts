/// <reference types="jest" />
/** Test-only stand-in for ./camp-ui: presentation stays out of flow tests. */
export function campUiMock() {
  const React = require("react"); const { Text, View, Pressable, TextInput } = require("react-native");
  const text = ({ children }: { children: unknown }) => React.createElement(Text, null, children);
  return {
    Copy: text, SvgTitle: text, Frame: ({ children }: { children: unknown }) => React.createElement(View, null, children),
    Busy: () => React.createElement(Text, null, "Loading"),
    Fact: ({ label, value }: { label: string; value: string }) => React.createElement(Text, null, `${label}: ${value}`),
    Notice: ({ title, children }: { title: string; children?: unknown }) => React.createElement(View, null, React.createElement(Text, null, title), children ? React.createElement(Text, null, children) : null),
    Choices: ({ label, options, onChange }: { label?: string; options: { value: unknown; label: string }[]; onChange: (v: unknown) => void }) => React.createElement(View, null, label ? React.createElement(Text, null, label) : null, ...options.map((o, i) => React.createElement(Pressable, { key: i, onPress: () => onChange(o.value) }, React.createElement(Text, null, o.label)))),
    Action: ({ label, onPress, disabled, pending }: { label: string; onPress: () => void; disabled?: boolean; pending?: boolean }) => React.createElement(Pressable, { accessibilityLabel: label, accessibilityState: { disabled: !!(disabled || pending) }, disabled: disabled || pending, onPress }, React.createElement(Text, null, label)),
    Field: ({ label, error, ...props }: { label: string; error?: string }) => error
      ? React.createElement(View, null, React.createElement(TextInput, { accessibilityLabel: label, ...props }), React.createElement(Text, null, error))
      : React.createElement(TextInput, { accessibilityLabel: label, ...props }),
    WeightSlip: ({ label = "Cân nặng chính thức", value, onChange, limit }: { label?: string; value: string; onChange: (v: string) => void; limit: string | null }) => React.createElement(View, null, React.createElement(Text, null, `Giới hạn: ${limit ?? "Chưa có giới hạn"}`), React.createElement(TextInput, { accessibilityLabel: label, value, onChangeText: onChange })),
    WeightPlot: () => null, CampIcon: () => null,
    PlanToggle: ({ label, selected, onPress, disabled }: { label: string; selected: boolean; onPress: () => void; disabled?: boolean }) => React.createElement(Pressable, { accessibilityRole: "checkbox", accessibilityLabel: label, accessibilityState: { checked: selected, disabled: !!disabled }, disabled, onPress }, React.createElement(Text, null, label)),
    CampFooter: ({ children }: { children: unknown }) => React.createElement(View, { testID: "camp-footer" }, children),
    CampShell: ({ title, children, footer }: { title: string; children: unknown; footer?: unknown }) => React.createElement(View, null, React.createElement(Text, null, title), children, footer ?? null),
  };
}
