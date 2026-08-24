import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";

const rawBundleId = "space.manus.akeer14.mobile.agent.t20260824151421";
const bundleId =
  rawBundleId
    .replace(/[-_]/g, ".")
    .replace(/[^a-zA-Z0-9.]/g, "")
    .replace(/\.+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .toLowerCase()
    .split(".")
    .map((segment) => (/^[a-zA-Z]/.test(segment) ? segment : `x${segment}`))
    .join(".") || "space.manus.app";

const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = `manus${timestamp}`;

const env = {
  appName: "Akeer14 Agent",
  appSlug: "akeer14-mobile-agent",
  logoUrl: "/manus-storage/akeer14-agent-icon_65f3343c.png",
  scheme: schemeFromBundleId,
  iosBundleId: bundleId,
  androidPackage: bundleId,
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: env.scheme,
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: false,
    bundleIdentifier: env.iosBundleId,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription: "يستخدم العامل الكاميرا لتنفيذ أوامر Telegram التي تشغّلها أنت.",
      NSMicrophoneUsageDescription: "يستخدم العامل الميكروفون لتنفيذ التسجيلات التي تشغّلها أنت.",
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#071C2C",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: env.androidPackage,
    permissions: [
      "INTERNET",
      "ACCESS_NETWORK_STATE",
      "CAMERA",
      "RECORD_AUDIO",
      "POST_NOTIFICATIONS",
      "FOREGROUND_SERVICE",
      "FOREGROUND_SERVICE_CAMERA",
      "FOREGROUND_SERVICE_MICROPHONE",
      "WAKE_LOCK",
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-camera",
      {
        cameraPermission: "السماح لعامل Akeer14 باستخدام الكاميرا لتنفيذ أوامر Telegram.",
        microphonePermission: "السماح لعامل Akeer14 باستخدام الميكروفون لتسجيل الصوت والفيديو.",
        recordAudioAndroid: true,
      },
    ],
    [
      "expo-audio",
      {
        microphonePermission: "السماح لعامل Akeer14 باستخدام الميكروفون لتسجيل الصوت.",
      },
    ],
    [
      "expo-secure-store",
      {
        configureAndroidBackup: false,
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#071C2C",
        dark: { backgroundColor: "#071C2C" },
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          buildArchs: ["armeabi-v7a", "arm64-v8a"],
          minSdkVersion: 26,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
