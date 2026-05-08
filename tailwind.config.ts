import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1280px" } },
    extend: {
      colors: {
        bg: { DEFAULT: "#050507", 2: "#0B0B11", 3: "#13131C", 4: "#1A1A24" },
        line: { DEFAULT: "#1F1F2E", 2: "#2A2A3A" },
        ink: { DEFAULT: "#F5F5FA", 2: "#9A9AAE", 3: "#5A5A6E" },
        brand: {
          blue: "#5B6CFF",
          "blue-2": "#7C8AFF",
          cyan: "#22D3EE",
          magenta: "#FF3D8E",
          gold: "#E8B86D",
          green: "#34D399",
          red: "#F87171",
          yellow: "#FCD34D",
        },
        // shadcn tokens (mapped to brand)
        background: "#050507",
        foreground: "#F5F5FA",
        primary: { DEFAULT: "#5B6CFF", foreground: "#FFFFFF" },
        secondary: { DEFAULT: "#13131C", foreground: "#F5F5FA" },
        muted: { DEFAULT: "#0B0B11", foreground: "#9A9AAE" },
        accent: { DEFAULT: "#22D3EE", foreground: "#050507" },
        destructive: { DEFAULT: "#F87171", foreground: "#FFFFFF" },
        border: "#1F1F2E",
        input: "#13131C",
        ring: "#5B6CFF",
        card: { DEFAULT: "#0B0B11", foreground: "#F5F5FA" },
        popover: { DEFAULT: "#13131C", foreground: "#F5F5FA" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        serif: ["var(--font-instrument-serif)", "serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      borderRadius: { lg: "14px", md: "10px", sm: "8px", xl: "22px" },
      backgroundImage: {
        grad: "linear-gradient(135deg, #5B6CFF 0%, #22D3EE 100%)",
        "grad-2": "linear-gradient(135deg, #FF3D8E 0%, #5B6CFF 100%)",
        "grad-3": "linear-gradient(135deg, #E8B86D 0%, #FF3D8E 100%)",
      },
      boxShadow: {
        glow: "0 8px 28px rgba(91,108,255,.4)",
        elev: "0 30px 80px -20px rgba(91,108,255,.25)",
      },
      keyframes: {
        in: { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        pulse: { "0%, 100%": { opacity: "1" }, "50%": { opacity: ".6" } },
      },
      animation: { in: "in .3s cubic-bezier(.2,.8,.2,1)" },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
