import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const nativeDir = resolve(process.cwd(), "android/app/src/main/java/space/manus/akeer14/mobile/agent/t20260824151421");
const source = readFileSync(resolve(nativeDir, "TelegramAgentService.kt"), "utf8");
const clientSource = readFileSync(resolve(nativeDir, "TelegramBotClient.kt"), "utf8");
const moduleSource = readFileSync(resolve(nativeDir, "TelegramAgentModule.kt"), "utf8");
const configSource = readFileSync(resolve(nativeDir, "AgentConfigStore.kt"), "utf8");
const gmailSource = readFileSync(resolve(nativeDir, "GmailEvidenceSender.kt"), "utf8");
const healthSource = readFileSync(resolve(nativeDir, "DeviceHealthMonitor.kt"), "utf8");
const compressorSource = readFileSync(resolve(nativeDir, "VideoEvidenceCompressor.kt"), "utf8");
const logSource = readFileSync(resolve(nativeDir, "DeliveryLogStore.kt"), "utf8");
const manifestSource = readFileSync(resolve(process.cwd(), "android/app/src/main/AndroidManifest.xml"), "utf8");
const uiSource = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

describe("Android Telegram agent callback contract", () => {
  it("contains the core akeer14 media and system callback routes", () => {
    ["capture_photo", "record_audio", "record_video", "start_live_stream", "start_motion_detection", "start_sound_detection", "stop_all_systems", "system_report", "emergency_panel", "shutdown_system"].forEach((callback) => expect(source).toContain(`\"${callback}\"`));
  });

  it("contains advanced camera and detection routes", () => {
    ["show_advanced_settings", "toggle_camera", "toggle_flash_setting", "toggle_compression", "toggle_auto_delete", "storage_management", "detection_actions_menu", "motion_toggle_", "sound_toggle_", "set_zoom"].forEach((callback) => expect(source).toContain(callback));
  });

  it("uses long polling and preserves pending Telegram updates", () => {
    expect(source).toContain("deleteWebhook()");
    expect(source).toContain("getUpdates(offset)");
    expect(clientSource).toContain("drop_pending_updates\" to \"false\"");
  });

  it("serializes evidence work through a queue and stages preparation before delivery", () => {
    expect(source).toContain("Channel<EvidenceTask>(Channel.UNLIMITED)");
    expect(source).toContain("for (task in commandQueue) processEvidence(task)");
    expect(source).toContain("val rawFile = task.work()");
    expect(source).toContain("EvidenceProcessor.prepare(");
    expect(source).toContain("compressVideos = config.videoCompressionEnabled");
    expect(source).toContain("client.sendEvidence");
    expect(source).toContain("GmailEvidenceSender().sendEvidence");
  });

  it("keeps Gmail settings encrypted and exposes direct tests", () => {
    ["gmailHost", "gmailUsername", "gmailAppPassword", "gmailRecipient"].forEach((key) => expect(configSource).toContain(`\"${key}\"`));
    ["fun saveConfig", "fun testTelegram", "fun testGmail", "fun runHardwareTest"].forEach((method) => expect(moduleSource).toContain(method));
    expect(gmailSource).toContain("transport.connect");
    expect(gmailSource).toContain("Transport.send");
  });

  it("monitors health with explicitly configured SMS thresholds", () => {
    ["smsAlertsEnabled", "smsAlertPhone", "smsOnInternetLoss", "smsOnLowBattery", "smsBatteryThreshold", "videoSafetyBatteryThreshold", "keepServiceAlive"].forEach((key) => expect(configSource).toContain(`\"${key}\"`));
    expect(source).toContain("Service.START_STICKY");
    expect(source).toContain("startHealthMonitoring()");
    expect(source).toContain("health.batteryPercent !in 0..config.smsBatteryThreshold");
    expect(source).toContain("health.batteryPercent in 0..config.videoSafetyBatteryThreshold");
    expect(source).toContain("camera.stopVideoRecording()");
    expect(healthSource).toContain("NET_CAPABILITY_VALIDATED");
    expect(healthSource).toContain("MIN_ALERT_INTERVAL_MILLIS");
    expect(manifestSource).toContain("android.permission.SEND_SMS");
  });

  it("exposes runtime settings in Telegram and keeps only credentials and log management in the app", () => {
    ["showMediaSettings", "showAlertSettings", "toggle_video_compression", "set_video_compression_height", "set_sms_threshold", "set_video_safety_threshold"].forEach((route) => expect(source).toContain(route));
    expect(uiSource).toContain('section === "telegram"');
    expect(uiSource).toContain('section === "history"');
    expect(uiSource).toContain("exportDeliveryLog");
    expect(uiSource).not.toContain('["camera", "الكاميرا"');
    expect(uiSource).not.toContain('["alerts", "التنبيهات"');
  });

  it("compresses MP4 only when the local export is valid and smaller, then records deliveries", () => {
    ["videoCompressionEnabled", "videoCompressionHeight"].forEach((key) => expect(configSource).toContain(key));
    expect(compressorSource).toContain("Presentation.createForHeight");
    expect(compressorSource).toContain("MimeTypes.VIDEO_H264");
    expect(compressorSource).toContain("output.length() < source.length()");
    expect(logSource).toContain("MAX_ENTRIES");
    expect(moduleSource).toContain("fun getDeliveryLog");
    expect(moduleSource).toContain("fun clearDeliveryLog");
    expect(clientSource).toContain("onDelivery?.invoke");
  });
});
