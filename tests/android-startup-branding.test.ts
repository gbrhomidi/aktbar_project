import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

describe("Android startup and branding contract", () => {
  it("uses the Arabic app name in Expo and Android resources", () => {
    expect(read("app.config.ts")).toContain('appName: "المراقبة الذكية"');
    expect(read("android/app/src/main/res/values/strings.xml")).toContain(
      '<string name="app_name">المراقبة الذكية</string>',
    );
    expect(read("android/settings.gradle")).toContain("rootProject.name = 'المراقبة الذكية'");
  });

  it("hides the native splash after the React root mounts", () => {
    expect(read("app/_layout.tsx")).toContain('import * as SplashScreen from "expo-splash-screen";');
    expect(read("app/_layout.tsx")).toContain("void SplashScreen.hideAsync();");
  });

  it("builds a non-debuggable standalone variant with an embedded bundle", () => {
    const gradle = read("android/app/build.gradle");
    expect(gradle).toContain("standalone {");
    expect(gradle).toContain("debuggable false");
    expect(gradle).toContain("matchingFallbacks = ['release']");

    const workflow = read(".github/workflows/android-apk.yml");
    expect(workflow).toContain("default: standalone");
    expect(workflow).toContain("standalone) ./gradlew :app:assembleStandalone --no-daemon");
    expect(workflow).toContain("keytool -genkeypair -v");
  });
});
