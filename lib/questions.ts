export type QuestionOptionKey = "a" | "b" | "c" | "d";

export interface Question {
  id: string;
  carousel: number;
  text: string;
  options: Record<QuestionOptionKey, string>;
  correct: QuestionOptionKey;
}

export const questions: Question[] = [
  // Carousel 1 — General knowledge
  {
    id: "q1",
    carousel: 1,
    text: "What is the capital of Australia?",
    options: { a: "Sydney", b: "Canberra", c: "Melbourne", d: "Perth" },
    correct: "b",
  },
  {
    id: "q2",
    carousel: 1,
    text: "Which planet is known as the Red Planet?",
    options: { a: "Venus", b: "Jupiter", c: "Mars", d: "Saturn" },
    correct: "c",
  },
  {
    id: "q3",
    carousel: 1,
    text: "How many continents are there on Earth?",
    options: { a: "5", b: "6", c: "7", d: "8" },
    correct: "c",
  },

  // Carousel 2 — Tech basics
  {
    id: "q4",
    carousel: 2,
    text: "What does 'HTML' stand for?",
    options: {
      a: "Hyper Trainer Marking Language",
      b: "HyperText Markup Language",
      c: "Hyperlink and Text Markup Language",
      d: "Home Tool Markup Language",
    },
    correct: "b",
  },
  {
    id: "q5",
    carousel: 2,
    text: "Which company developed the JavaScript language?",
    options: { a: "Microsoft", b: "Netscape", c: "Google", d: "Apple" },
    correct: "b",
  },
  {
    id: "q6",
    carousel: 2,
    text: "What does 'API' stand for?",
    options: {
      a: "Application Programming Interface",
      b: "Advanced Program Integration",
      c: "Automated Process Input",
      d: "Application Process Index",
    },
    correct: "a",
  },

  // Carousel 3 — Math & logic
  {
    id: "q7",
    carousel: 3,
    text: "What is the value of 7 × 8?",
    options: { a: "54", b: "56", c: "58", d: "62" },
    correct: "b",
  },
  {
    id: "q8",
    carousel: 3,
    text: "What comes next in the sequence: 2, 4, 8, 16, ?",
    options: { a: "24", b: "28", c: "32", d: "30" },
    correct: "c",
  },
  {
    id: "q9",
    carousel: 3,
    text: "A triangle has how many degrees in total?",
    options: { a: "90", b: "180", c: "270", d: "360" },
    correct: "b",
  },

  // Carousel 4 — Science
  {
    id: "q10",
    carousel: 4,
    text: "What gas do plants primarily absorb from the atmosphere?",
    options: { a: "Oxygen", b: "Nitrogen", c: "Carbon dioxide", d: "Hydrogen" },
    correct: "c",
  },
  {
    id: "q11",
    carousel: 4,
    text: "What is the chemical symbol for gold?",
    options: { a: "Gd", b: "Go", c: "Au", d: "Ag" },
    correct: "c",
  },
  {
    id: "q12",
    carousel: 4,
    text: "How many bones are in the adult human body?",
    options: { a: "196", b: "206", c: "216", d: "226" },
    correct: "b",
  },

  // Carousel 5 — Current affairs / misc
  {
    id: "q13",
    carousel: 5,
    text: "Which is the largest ocean on Earth?",
    options: { a: "Atlantic", b: "Indian", c: "Arctic", d: "Pacific" },
    correct: "d",
  },
  {
    id: "q14",
    carousel: 5,
    text: "Who wrote the play 'Romeo and Juliet'?",
    options: {
      a: "Charles Dickens",
      b: "William Shakespeare",
      c: "Mark Twain",
      d: "Jane Austen",
    },
    correct: "b",
  },
  {
    id: "q15",
    carousel: 5,
    text: "What is the smallest prime number?",
    options: { a: "0", b: "1", c: "2", d: "3" },
    correct: "c",
  },
];

export const TOTAL_CAROUSELS = 5;

export function questionsByCarousel(): Question[][] {
  const groups: Question[][] = Array.from({ length: TOTAL_CAROUSELS }, () => []);
  for (const q of questions) {
    groups[q.carousel - 1].push(q);
  }
  return groups;
}

export function findQuestion(id: string): Question | undefined {
  return questions.find((q) => q.id === id);
}
