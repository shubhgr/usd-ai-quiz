export const TAB_SWITCH_LIMIT = 5;

export type TabSwitchWarning = {
  title: string;
  body: string;
};

export function isTabBlocked(count: number | null | undefined): boolean {
  return (Number(count) || 0) >= TAB_SWITCH_LIMIT;
}

/** Progressive warnings for tab switches 1–4 (5th triggers block). */
export function tabSwitchWarning(count: number): TabSwitchWarning | null {
  switch (count) {
    case 1:
      return {
        title: "Don't switch tabs",
        body: "You've left the challenge page once. Please return to the challenge and stay on this page until you submit.",
      };
    case 2:
      return {
        title: "Please stay on the challenge page",
        body: "You've switched tabs 2 times. Further tab switching may result in disqualification.",
      };
    case 3:
      return {
        title: "Final warning",
        body: "You've switched tabs 3 times. Any further tab switching may result in disqualification.",
      };
    case 4:
      return {
        title: "You will be disqualified",
        body: "You've left the challenge page 4 times. Any further tab switching will result in disqualification from the AI Grand Prix.",
      };
    default:
      return null;
  }
}

export function tabBlockMessage(email?: string): string {
  const who = email?.trim() ? email.trim().toLowerCase() : "This email";
  return `${who} is blocked because you switched tabs too many times during the quiz.`;
}
