import { questions, questionsByCarousel } from "./questions";

export const QUESTIONS_PER_SCREEN = 3;
export const carousels = questionsByCarousel();

export function screenQuestions(screenIndex: number) {
  return carousels[screenIndex] ?? [];
}

export function isScreenComplete(
  screenIndex: number,
  answers: Record<string, string>
): boolean {
  return screenQuestions(screenIndex).every((q) => answers[q.id] !== undefined);
}

/** Cumulative answer string from q1 onward, e.g. "abb" after 3 answers. */
export function allAnswersString(
  answers: Record<string, string>
): string {
  const chars: string[] = [];
  for (const q of questions) {
    const a = answers[q.id];
    if (!a) break;
    chars.push(a.toLowerCase());
  }
  return chars.join("");
}

export function questionScreenIndex(questionId: string): number {
  const q = questions.find((item) => item.id === questionId);
  return q ? q.carousel - 1 : -1;
}
