/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.js", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  // Emits `--css-interop-darkMode: class dark`; "media" makes css-interop's web colorScheme.set throw.
  darkMode: "class",
  theme: {
    extend: {
      // NativeWind resolves rem as 14 on native and 16 on web; px keeps sizes identical.
      colors: {
        background: "#0B0B0D",
        surface: {
          DEFAULT: "#141417",
          elevated: "#1C1C21",
        },
        border: "#2A2A31",
        text: "#F4F4F5",
        muted: "#9A9AA5",
        primary: "#F97316",
        success: "#22C55E",
        warning: "#F59E0B",
        danger: "#EF4444",
        info: "#3B82F6",
      },
      fontSize: {
        label: ["11px", { lineHeight: "16px" }],
        caption: ["12px", { lineHeight: "16px" }],
        body: ["14px", { lineHeight: "20px" }],
        subtitle: ["16px", { lineHeight: "24px" }],
        title: ["20px", { lineHeight: "28px" }],
        display: ["28px", { lineHeight: "36px" }],
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        "2xl": "32px",
        card: "12px",
        "card-gap": "8px",
        screen: "16px",
        section: "16px",
        control: "44px",
        touch: "44px",
        row: "48px",
        "avatar-sm": "32px",
        "avatar-md": "40px",
        "avatar-lg": "56px",
      },
      borderRadius: {
        control: "8px",
        card: "12px",
      },
      maxWidth: {
        phone: "480px",
      },
    },
  },
  plugins: [],
};
