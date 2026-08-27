import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

describe("dark mode contract", () => {
  it("persists the selected scheme and synchronizes Android root background", () => {
    const provider = read("lib/theme-provider.tsx");
    expect(provider).toContain('COLOR_SCHEME_STORAGE_KEY = "akeer14.agent.color-scheme.v1"');
    expect(provider).toContain("AsyncStorage.setItem(COLOR_SCHEME_STORAGE_KEY, scheme)");
    expect(provider).toContain("AsyncStorage.getItem(COLOR_SCHEME_STORAGE_KEY)");
    expect(provider).toContain("SystemUI.setBackgroundColorAsync(SchemeColors[scheme].background)");
  });

  it("derives the agent UI from a light or dark palette instead of fixed screen styles", () => {
    const screen = read("app/(tabs)/index.tsx");
    expect(screen).toContain("function createAgentStyles(scheme: ColorScheme)");
    expect(screen).toContain('const light = scheme === "light"');
    expect(screen).toContain("const palette = light");
    expect(screen).toContain("AgentStylesContext.Provider value={styles}");
    expect(screen).toContain("backgroundColor: palette.canvas");
    expect(screen).toContain("color: palette.text");
  });
});
