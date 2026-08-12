export type QuestionOptionKey = "a" | "b" | "c" | "d";

export interface Question {
  id: string;
  carousel: number;
  text: string;
  options: Record<QuestionOptionKey, string>;
}

export const questions: Question[] = [
  // Carousel 1
  {
    id: "q1",
    carousel: 1,
    text: "You're assigned a group project, but one member consistently misses meetings and doesn't respond to messages. The deadline is in five days. What's the most productive first step?",
    options: {
      a: "Complain to the professor immediately without talking to the member",
      b: "Reach out directly to understand the issue and redistribute tasks if needed",
      c: "Exclude them from the project silently",
      d: "Do all their work without saying anything",
    },
  },
  {
    id: "q2",
    carousel: 1,
    text: "A vending machine accepts only exact change. You have three coins; exactly one is not valid for the machine, but you don't know which. You try one coin and it fails. What's the most efficient next step?",
    options: {
      a: "Try the same coin again",
      b: "Try a different one of the remaining two coins",
      c: "Give up and assume all coins are invalid",
      d: "Shake the machine",
    },
  },
  {
    id: "q3",
    carousel: 1,
    text: "You're choosing between two internships: one pays more but offers no mentorship, and one pays less but has a structured mentorship program in your field of interest. You're early in your career. Which factor should most reasonably drive your decision?",
    options: {
      a: "Pay alone",
      b: "Long-term skill development and mentorship, given your career stage",
      c: "Which company has a nicer office",
      d: "Whichever offer came first",
    },
  },
  {
    id: "q4",
    carousel: 1,
    text: 'A friend says, "Cloud storage means my files are stored in the actual sky." What is the best correction?',
    options: {
      a: "They're partially right — data does travel through the air",
      b: "Cloud storage refers to data stored on remote servers accessed via the internet, not literally in the sky",
      c: "Cloud storage doesn't exist; it's just marketing",
      d: "All cloud storage is stored on your own device",
    },
  },

  // Carousel 2
  {
    id: "q5",
    carousel: 2,
    text: "A project manager notices that every time Team A misses a deadline, Team B's workload increases the following week. Team B has never missed a deadline. What is the most reasonable conclusion?",
    options: {
      a: "Team B is more skilled than Team A",
      b: "Team A's delays are creating downstream pressure on Team B",
      c: "Team B should be given Team A's tasks permanently",
      d: "There is no relationship between the two teams' performance",
    },
  },
  {
    id: "q6",
    carousel: 2,
    text: "You have two job offers: one with a higher salary but a 90-minute daily commute, and one with a slightly lower salary but remote flexibility twice a week. You value long-term career growth most. Which factor should weigh heaviest?",
    options: {
      a: "Salary difference alone",
      b: "Which role offers better learning opportunities and growth potential",
      c: "Which office has a better cafeteria",
      d: "The commute time alone",
    },
  },
  {
    id: "q7",
    carousel: 2,
    text: "A student has four assignments due this week, each requiring different amounts of effort and worth different grade percentages. What is the most effective first step in managing this workload?",
    options: {
      a: "Start with the assignment due last",
      b: "Prioritize based on a combination of deadline urgency and grade weight",
      c: "Do all assignments simultaneously",
      d: "Skip the lowest-weighted assignment entirely",
    },
  },
  {
    id: "q8",
    carousel: 2,
    text: "A spam filter correctly flags 95 out of 100 actual spam emails, but also wrongly flags 20 out of 500 genuine emails as spam. What does this scenario best illustrate?",
    options: {
      a: "The trade-off between catching spam and wrongly blocking genuine mail",
      b: "A permanent flaw that cannot be improved",
      c: "That the filter should be removed entirely",
      d: "That spam email no longer exists",
    },
  },

  // Carousel 3
  {
    id: "q9",
    carousel: 3,
    text: "A retail company trains a model to predict customer churn and achieves 98% accuracy, but only 2% of customers actually churn. What should the team investigate first?",
    options: {
      a: "Whether the model is using too many features",
      b: "Whether accuracy is a misleading metric given how few customers actually churn",
      c: "Whether the model needs more training epochs",
      d: "Whether the data needs to be normalized",
    },
  },
  {
    id: "q10",
    carousel: 3,
    text: "An AI-based résumé screening tool consistently ranks candidates from one particular university lower, despite similar qualifications. What is the most likely underlying cause?",
    options: {
      a: "The model architecture is too simple",
      b: "Historical bias present in the training data",
      c: "Insufficient computing power",
      d: "The model is overfitting to test data",
    },
  },
  {
    id: "q11",
    carousel: 3,
    text: "A team deploying a facial recognition system for campus attendance finds it performs less accurately for certain groups of students. What is the most responsible immediate action?",
    options: {
      a: "Deploy it anyway since overall accuracy is high",
      b: "Pause deployment, investigate the source of the disparity, and improve the training data",
      c: "Only use it for students it recognizes well",
      d: "Add a disclaimer and continue deployment unchanged",
    },
  },
  {
    id: "q12",
    carousel: 3,
    text: "A startup wants to use a large language model to power customer support, but budget and response speed are major constraints. What is the most practical first step?",
    options: {
      a: "Train a foundation model from scratch",
      b: "Use or fine-tune a smaller pretrained model with careful prompt design",
      c: "Manually write rule-based responses for every possible query",
      d: "Wait until cheaper hardware becomes available",
    },
  },

  // Carousel 4
  {
    id: "q13",
    carousel: 4,
    text: 'A company claims its new chatbot "understands" language the way humans do. Which statement best evaluates this claim?',
    options: {
      a: "Chatbots cannot process language in any meaningful way",
      b: "The system predicts statistically likely responses from patterns in data, without genuine comprehension",
      c: "Chatbots use only fixed, hand-written rules",
      d: "All chatbots have identical capabilities",
    },
  },
  {
    id: "q14",
    carousel: 4,
    text: "A self-driving car's object detection performs very well in clear weather but noticeably worse in heavy rain. Before wider deployment, what should the team prioritize?",
    options: {
      a: "Ignore the drop since average performance is still high",
      b: "Collect more diverse weather data and test edge cases before deployment",
      c: "Deploy only in regions that never get rain",
      d: "Permanently reduce the car's speed in all conditions",
    },
  },
  {
    id: "q15",
    carousel: 4,
    text: 'A fitness app reports that users who log in daily lose more weight on average than those who log in weekly, and markets this as "daily logging causes weight loss." What is the strongest critique of this claim?',
    options: {
      a: "The claim is accurate and well-supported",
      b: "More motivated users may both log in daily and be more consistent with healthy habits — motivation could explain both outcomes",
      c: "Weight loss cannot be tracked by apps",
      d: "The sample size must be too small to matter",
    },
  },
  {
    id: "q16",
    carousel: 4,
    text: "A restaurant is losing customers during lunch hours due to slow service, but hiring more staff isn't in the budget. What is the most practical approach to explore first?",
    options: {
      a: "Close during lunch hours",
      b: "Analyze the current workflow to identify and fix specific bottlenecks before adding cost",
      c: "Raise prices to offset the customer loss",
      d: "Ignore the issue since dinner sales are strong",
    },
  },

  // Carousel 5
  {
    id: "q17",
    carousel: 5,
    text: "A company is deciding between expanding into a new market with high growth potential but high uncertainty, or strengthening its position in an existing, stable market. What should primarily guide this decision?",
    options: {
      a: "Always choose the option with higher potential growth",
      b: "The company's risk tolerance, available resources, and strategic priorities",
      c: "Whatever competitors did last year",
      d: "Whichever option requires less paperwork",
    },
  },
  {
    id: "q18",
    carousel: 5,
    text: "In a small office, the person who arrives earliest always leaves latest, and the person who leaves earliest never arrives first. Priya arrives second and leaves third. What can be validly inferred about Priya?",
    options: {
      a: "She is neither the first to arrive nor the first to leave",
      b: "She works the most hours in the office",
      c: "She is definitely the last to leave",
      d: "Nothing can be inferred from this information",
    },
  },
  {
    id: "q19",
    carousel: 5,
    text: "A student has an offer to study abroad for a semester, but it overlaps with a major internship opportunity at home. Both have long-term value but for different reasons. What is the most sound way to decide?",
    options: {
      a: "Choose randomly since both are equally valuable",
      b: "Clarify personal priorities and long-term goals, then weigh how each option supports them",
      c: "Choose based on which option friends are also doing",
      d: "Pick based on which requires less paperwork",
    },
  },
  {
    id: "q20",
    carousel: 5,
    text: "A student uses an AI tool to summarize research papers for a literature review but doesn't cross-check the summaries against the original sources, and later finds several inaccuracies. What lesson does this best illustrate?",
    options: {
      a: "AI tools should never be used for academic work",
      b: "AI-generated content should be verified against original sources before being relied upon",
      c: "The inaccuracies are entirely the AI tool's fault",
      d: "Literature reviews don't require accuracy",
    },
  },

  // Carousel 6
  {
    id: "q21",
    carousel: 6,
    text: "A logistics company is considering using drones for last-mile delivery in a dense urban area. Before full rollout, what is the most important factor to pilot-test?",
    options: {
      a: "The drone's paint color",
      b: "Regulatory compliance, safety around people, and reliability under variable real-world conditions",
      c: "Whether competitors already use drones",
      d: "How fast the drones can be manufactured",
    },
  },
  {
    id: "q22",
    carousel: 6,
    text: 'A survey shows 80% of employees are "satisfied" with remote work, but the survey had only a 20% response rate. What is the most important limitation to consider?',
    options: {
      a: "80% is a high number, so the result is trustworthy as-is",
      b: "The low response rate may mean the results aren't representative of all employees",
      c: "Remote work surveys are always biased",
      d: "The survey should have asked different questions",
    },
  },
  {
    id: "q23",
    carousel: 6,
    text: "A hospital is considering an AI diagnostic tool that is highly accurate but cannot explain its reasoning to doctors. What is the most important factor to weigh before adoption?",
    options: {
      a: "The tool's accuracy score alone",
      b: "The trade-off between accuracy and the need for explainability in high-stakes medical decisions",
      c: "How much the software costs",
      d: "Whether competing hospitals use similar tools",
    },
  },
  {
    id: "q24",
    carousel: 6,
    text: "Five vendors bid on a contract. The lowest bidder is disqualified for missing a certification. Among the rest, the second-lowest bidder has the best safety record, while the third-lowest has the fastest delivery time. The company values cost, safety, and speed roughly equally. What best reflects sound decision-making here?",
    options: {
      a: "Automatically pick the second-lowest bidder",
      b: "Weigh all relevant criteria systematically (e.g., a scoring matrix) rather than deciding on one factor alone",
      c: "Choose the disqualified lowest bidder anyway since price matters most",
      d: "Ask each vendor to lower their price further",
    },
  },

  // Carousel 7
  {
    id: "q25",
    carousel: 7,
    text: "A startup must choose between Option A (70% chance of moderate profit) and Option B (30% chance of very high profit, 70% chance of a loss the company cannot survive). What should primarily guide the decision?",
    options: {
      a: "Always choose the option with the highest potential payoff",
      b: "Factor in risk tolerance and survivability, not just probability or payoff size alone",
      c: "Choose based on which option sounds more exciting",
      d: "Split resources evenly between both options",
    },
  },
  {
    id: "q26",
    carousel: 7,
    text: "A university reports a 95% graduate employment rate, but further investigation shows this figure only counts students who responded to a post-graduation survey, and just 40% of graduates responded. What is the most reasonable interpretation?",
    options: {
      a: "95% accurately reflects all graduates",
      b: "The reported rate may be skewed, since non-respondents (who may be unemployed) aren't reflected in the figure",
      c: "The survey should be scrapped entirely since it has any non-response",
      d: "Employment rates are irrelevant to prospective students",
    },
  },
  {
    id: "q27",
    carousel: 7,
    text: "A company discovers that a highly profitable product feature is unintentionally encouraging excessive, habit-forming use among teenage users. Removing it would significantly hurt revenue. What is the most sound approach?",
    options: {
      a: "Keep the feature unchanged since it's legal and profitable",
      b: "Weigh the ethical responsibility to users alongside business impact, and explore redesigns that reduce harm without eliminating all value",
      c: "Remove the entire product without further analysis",
      d: "Ignore the issue since users chose to use the product",
    },
  },
  {
    id: "q28",
    carousel: 7,
    text: 'A company\'s hiring data shows candidates who took longer to respond to a job offer had higher first-year performance ratings. An analyst concludes "slow responders make better employees" and recommends prioritizing them in future hiring. What is the key flaw in this reasoning?',
    options: {
      a: "The conclusion is valid and should be implemented immediately",
      b: "Response time may correlate with unrelated factors (e.g., having other offers to weigh), so it shouldn't be used as a hiring criterion without further evidence",
      c: "Performance ratings are inherently unreliable and should be discarded",
      d: "Fast responders should be excluded from hiring entirely",
    },
  },
];

const QUESTIONS_PER_SCREEN = 3;
for (let i = 0; i < questions.length; i++) {
  questions[i].carousel = Math.floor(i / QUESTIONS_PER_SCREEN) + 1;
}

export const TOTAL_CAROUSELS = Math.ceil(questions.length / QUESTIONS_PER_SCREEN);

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
