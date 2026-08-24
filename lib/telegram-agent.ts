import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules, Platform } from "react-native";

export type AgentSettings = {
  botToken: string;
  chatId: string;
  allowedUserIds: string;
  cameraFacing: "back" | "front";
  flashEnabled: boolean;
  compressionEnabled: boolean;
  autoDeleteEvidence: boolean;
  videoQuality: "sd" | "hd" | "fhd";
  audioQuality: "low" | "medium" | "high";
  zoomRatio: number;
  motionEnabled: boolean;
  soundEnabled: boolean;
  motionSensitivity: "low" | "medium" | "high";
  soundSensitivity: "low" | "medium" | "high";
  motionPhoto: boolean;
  motionVideo: boolean;
  motionAudio: boolean;
  soundPhoto: boolean;
  soundVideo: boolean;
  soundAudio: boolean;
  detectionVideoDuration: number;
  detectionAudioDuration: number;
};

export type AgentStatus = {
  running: boolean;
  phase: string;
  message: string;
  updatedAt: string;
  lastError: string;
};

const SETTINGS_KEY = "akeer14.agent.settings.v1";

export const defaultSettings: AgentSettings = {
  botToken: "",
  chatId: "",
  allowedUserIds: "",
  cameraFacing: "back",
  flashEnabled: false,
  compressionEnabled: true,
  autoDeleteEvidence: true,
  videoQuality: "hd",
  audioQuality: "medium",
  zoomRatio: 1,
  motionEnabled: false,
  soundEnabled: false,
  motionSensitivity: "medium",
  soundSensitivity: "medium",
  motionPhoto: true,
  motionVideo: false,
  motionAudio: false,
  soundPhoto: false,
  soundVideo: false,
  soundAudio: true,
  detectionVideoDuration: 15,
  detectionAudioDuration: 10,
};

const unavailableStatus: AgentStatus = {
  running: false,
  phase: "غير متاح",
  message: "خدمة Android الأصلية لا تعمل في معاينة الويب.",
  updatedAt: "",
  lastError: "",
};

type NativeTelegramAgent = {
  start(settings: AgentSettings): Promise<AgentStatus>;
  stop(): Promise<AgentStatus>;
  getStatus(): Promise<AgentStatus>;
  hasStoredConfig(): Promise<boolean>;
  clearSecrets(): Promise<boolean>;
};

function nativeAgent(): NativeTelegramAgent {
  const agent = NativeModules.TelegramAgent as NativeTelegramAgent | undefined;
  if (Platform.OS === "web" || !agent) {
    throw new Error("هذه العملية تتطلب APK Android مخصصًا؛ لا تعمل في Expo Go أو معاينة الويب.");
  }
  return agent;
}

export async function loadSettings(): Promise<AgentSettings> {
  const value = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!value) return defaultSettings;
  try {
    return { ...defaultSettings, ...(JSON.parse(value) as Partial<AgentSettings>) };
  } catch {
    return defaultSettings;
  }
}

export async function persistSettings(settings: AgentSettings): Promise<void> {
  const { botToken: _token, ...nonSecret } = settings;
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(nonSecret));
}

export async function startAgent(settings: AgentSettings): Promise<AgentStatus> {
  return nativeAgent().start(settings);
}

export async function stopAgent(): Promise<AgentStatus> {
  return nativeAgent().stop();
}

export async function getAgentStatus(): Promise<AgentStatus> {
  if (Platform.OS === "web" || !NativeModules.TelegramAgent) return unavailableStatus;
  return nativeAgent().getStatus();
}

export async function hasStoredAgentConfig(): Promise<boolean> {
  if (Platform.OS === "web" || !NativeModules.TelegramAgent) return false;
  return nativeAgent().hasStoredConfig();
}

export async function clearAgentSecrets(): Promise<void> {
  await nativeAgent().clearSecrets();
}
