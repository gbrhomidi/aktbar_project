import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules, Platform } from "react-native";

export type AgentSettings = {
  botToken: string;
  chatId: string;
  allowedUserIds: string;
  gmailBackupEnabled: boolean;
  gmailHost: string;
  gmailPort: number;
  gmailUsername: string;
  gmailAppPassword: string;
  gmailRecipient: string;
  smsAlertsEnabled: boolean;
  smsAlertPhone: string;
  smsOnInternetLoss: boolean;
  smsOnLowBattery: boolean;
  smsInternetLossMessage: string;
  smsLowBatteryMessage: string;
  smsBatteryThreshold: number;
  videoSafetyBatteryThreshold: number;
  keepServiceAlive: boolean;
  cameraFacing: "back" | "front";
  flashEnabled: boolean;
  compressionEnabled: boolean;
  videoCompressionEnabled: boolean;
  videoCompressionHeight: 360 | 480 | 720;
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

export type ChannelTestResult = {
  ok: boolean;
  message: string;
};

export type HardwareTestResult = {
  cameraOk: boolean;
  cameraDetail: string;
  microphoneOk: boolean;
  microphoneDetail: string;
};

export type StoredConfigResult = {
  telegramConfigured: boolean;
  gmailConfigured: boolean;
  smsConfigured: boolean;
};

export type DeviceHealth = {
  batteryPercent: number;
  charging: boolean;
  internetReachable: boolean;
  batteryOptimizationEnabled: boolean;
  smsPermissionGranted: boolean;
};

export type DeliveryLogEntry = {
  id: string;
  timestamp: string;
  channel: string;
  kind: string;
  ok: boolean;
  detail: string;
};

const SETTINGS_KEY = "akeer14.agent.settings.v1";

export const defaultSettings: AgentSettings = {
  botToken: "",
  chatId: "",
  allowedUserIds: "",
  gmailBackupEnabled: false,
  gmailHost: "smtp.gmail.com",
  gmailPort: 587,
  gmailUsername: "",
  gmailAppPassword: "",
  gmailRecipient: "",
  smsAlertsEnabled: false,
  smsAlertPhone: "",
  smsOnInternetLoss: true,
  smsOnLowBattery: true,
  smsInternetLossMessage: "Akeer14: تعذر الوصول إلى الإنترنت من الهاتف العامل. تحقق من الشبكة.",
  smsLowBatteryMessage: "Akeer14: بطارية الهاتف العامل منخفضة ({battery}%). اشحن الجهاز فورًا.",
  smsBatteryThreshold: 15,
  videoSafetyBatteryThreshold: 5,
  keepServiceAlive: true,
  cameraFacing: "back",
  flashEnabled: false,
  compressionEnabled: true,
  videoCompressionEnabled: true,
  videoCompressionHeight: 480,
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
  saveConfig(settings: AgentSettings): Promise<StoredConfigResult>;
  testTelegram(settings: AgentSettings): Promise<ChannelTestResult>;
  testGmail(settings: AgentSettings): Promise<ChannelTestResult>;
  testSms(settings: AgentSettings): Promise<ChannelTestResult>;
  runHardwareTest(): Promise<HardwareTestResult>;
  getDeviceHealth(): Promise<DeviceHealth>;
  getDeliveryLog(): Promise<DeliveryLogEntry[]>;
  clearDeliveryLog(): Promise<boolean>;
  requestBatteryOptimizationExemption(): Promise<boolean>;
  closeUi(): Promise<boolean>;
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
  const { botToken: _token, gmailAppPassword: _gmailPassword, smsAlertPhone: _smsPhone, ...nonSecret } = settings;
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(nonSecret));
}

export async function saveAgentConfig(settings: AgentSettings): Promise<StoredConfigResult | null> {
  await persistSettings(settings);
  if (Platform.OS === "web" || !NativeModules.TelegramAgent) return null;
  return nativeAgent().saveConfig(settings);
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

export async function testTelegramConnection(settings: AgentSettings): Promise<ChannelTestResult> {
  return nativeAgent().testTelegram(settings);
}

export async function testGmailConnection(settings: AgentSettings): Promise<ChannelTestResult> {
  return nativeAgent().testGmail(settings);
}

export async function testSmsAlert(settings: AgentSettings): Promise<ChannelTestResult> {
  return nativeAgent().testSms(settings);
}

export async function runNativeHardwareTest(): Promise<HardwareTestResult> {
  return nativeAgent().runHardwareTest();
}

export async function getNativeDeviceHealth(): Promise<DeviceHealth> {
  if (Platform.OS === "web" || !NativeModules.TelegramAgent) {
    return { batteryPercent: -1, charging: false, internetReachable: false, batteryOptimizationEnabled: false, smsPermissionGranted: false };
  }
  return nativeAgent().getDeviceHealth();
}

export async function getDeliveryLog(): Promise<DeliveryLogEntry[]> {
  if (Platform.OS === "web" || !NativeModules.TelegramAgent) return [];
  return nativeAgent().getDeliveryLog();
}

export async function clearDeliveryLog(): Promise<boolean> {
  return nativeAgent().clearDeliveryLog();
}

export async function requestBatteryOptimizationExemption(): Promise<boolean> {
  return nativeAgent().requestBatteryOptimizationExemption();
}

export async function closeAgentUi(): Promise<boolean> {
  return nativeAgent().closeUi();
}
