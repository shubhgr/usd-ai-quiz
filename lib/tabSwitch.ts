export const TAB_SWITCH_LIMIT = 5;

export function isTabBlocked(count: number | null | undefined): boolean {
  return (Number(count) || 0) >= TAB_SWITCH_LIMIT;
}

export function tabBlockMessage(email?: string): string {
  const who = email?.trim() ? email.trim().toLowerCase() : "This email";
  return `${who} is blocked because you switched tabs too many times during the quiz.`;
}
