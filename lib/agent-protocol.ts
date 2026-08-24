export const TELEGRAM_COMMANDS = ["/start", "/status", "/photo", "/audio", "/video", "/live", "/stop", "/emergency"] as const;

export function normalizeTelegramCommand(input: string): string {
  return input.trim().toLowerCase().replace(/@[^\s]+$/, "");
}

export function isAuthorizedTelegramSender(chatId: string, configuredChatId: string, userId: string, allowedUserIds: string): boolean {
  if (chatId.trim() !== configuredChatId.trim()) return false;
  const allowed = allowedUserIds.split(",").map((id) => id.trim()).filter(Boolean);
  return allowed.length === 0 || allowed.includes(userId.trim());
}

export function isTelegramSettingsReady(token: string, chatId: string): boolean {
  return token.includes(":") && chatId.trim().length > 0;
}
