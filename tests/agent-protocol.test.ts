import { describe, expect, it } from "vitest";
import { isAuthorizedTelegramSender, isTelegramSettingsReady, normalizeTelegramCommand, TELEGRAM_COMMANDS } from "../lib/agent-protocol";

describe("Telegram agent protocol", () => {
  it("normalizes group commands addressed to the bot", () => {
    expect(normalizeTelegramCommand(" /photo@akeer14_bot ")).toBe("/photo");
  });

  it("keeps the reference command contract available", () => {
    expect(TELEGRAM_COMMANDS).toContain("/emergency");
    expect(TELEGRAM_COMMANDS).toContain("/live");
  });

  it("authorizes the configured negative group chat and only allowed users", () => {
    expect(isAuthorizedTelegramSender("-100123", "-100123", "88", "88, 99")).toBe(true);
    expect(isAuthorizedTelegramSender("-100123", "-100123", "77", "88, 99")).toBe(false);
    expect(isAuthorizedTelegramSender("42", "-100123", "88", "88")).toBe(false);
  });

  it("requires a token-shaped value and target chat before starting", () => {
    expect(isTelegramSettingsReady("123:token", "-1001")).toBe(true);
    expect(isTelegramSettingsReady("token", "-1001")).toBe(false);
    expect(isTelegramSettingsReady("123:token", "")).toBe(false);
  });
});
