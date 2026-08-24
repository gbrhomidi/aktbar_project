import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const servicePath = resolve(process.cwd(), "android/app/src/main/java/space/manus/akeer14/mobile/agent/t20260824151421/TelegramAgentService.kt");
const source = readFileSync(servicePath, "utf8");
const clientPath = resolve(process.cwd(), "android/app/src/main/java/space/manus/akeer14/mobile/agent/t20260824151421/TelegramBotClient.kt");
const clientSource = readFileSync(clientPath, "utf8");

describe("Android Telegram agent callback contract", () => {
  it("contains the core akeer14 media and system callback routes", () => {
    [
      "capture_photo",
      "record_audio",
      "record_video",
      "start_live_stream",
      "start_motion_detection",
      "start_sound_detection",
      "stop_all_systems",
      "system_report",
      "emergency_panel",
      "shutdown_system",
    ].forEach((callback) => expect(source).toContain(`\"${callback}\"`));
  });

  it("contains the advanced-camera and detection canvas routes", () => {
    [
      "show_advanced_settings",
      "toggle_camera",
      "toggle_flash_setting",
      "toggle_compression",
      "toggle_auto_delete",
      "storage_management",
      "detection_actions_menu",
      "motion_toggle_",
      "sound_toggle_",
      "set_zoom",
    ].forEach((callback) => expect(source).toContain(callback));
  });

  it("uses long polling and clears a webhook without dropping pending updates", () => {
    expect(source).toContain("deleteWebhook()")
    expect(source).toContain("getUpdates(offset)")
    expect(clientSource).toContain("drop_pending_updates\" to \"false\"")
  });
});
