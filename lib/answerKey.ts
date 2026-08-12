// Server-only answer key — must match apps-script/Code.gs CORRECT_KEY string.
export const CORRECT: Record<string, string> = {
  q1: "b",
  q2: "b",
  q3: "b",
  q4: "b",
  q5: "b",
  q6: "b",
  q7: "b",
  q8: "a",
  q9: "b",
  q10: "b",
  q11: "b",
  q12: "b",
  q13: "b",
  q14: "b",
  q15: "b",
  q16: "b",
  q17: "b",
  q18: "a",
  q19: "b",
  q20: "b",
  q21: "b",
  q22: "b",
  q23: "b",
  q24: "b",
  q25: "b",
  q26: "b",
  q27: "b",
  q28: "b",
};

export function isCorrectAnswer(questionId: string, answer: string): boolean {
  return CORRECT[questionId] === answer;
}

export function scoreFromAnswers(answers: Record<string, string>): number {
  let total = 0;
  for (const [id, correct] of Object.entries(CORRECT)) {
    if (answers[id]?.toLowerCase() === correct) total += 1;
  }
  return total;
}

export function scoreFromAnswerString(answerStr: string): number {
  const ids = Object.keys(CORRECT);
  const normalized = answerStr.trim().toLowerCase();
  let total = 0;
  const len = Math.min(normalized.length, ids.length);
  for (let i = 0; i < len; i += 1) {
    if (normalized.charAt(i) === CORRECT[ids[i]]) total += 1;
  }
  return total;
}
