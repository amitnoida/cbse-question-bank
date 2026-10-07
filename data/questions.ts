export type Question = {
  id: number;
  className: string;
  subject: string;
  chapter: string;
  difficulty: "Easy" | "Medium" | "Hard";
  question: string;
  options: string[];
  answer: string;
  explanation: string;
};

export const questions: Question[] = [
  {
    id: 1,
    className: "Class 10",
    subject: "Mathematics",
    chapter: "Real Numbers",
    difficulty: "Medium",
    question:
      "If HCF of two numbers is 12 and their LCM is 420, what is the product of the two numbers?",
    options: ["5040", "432", "35", "408"],
    answer: "5040",
    explanation:
      "For two positive integers, HCF × LCM = product of the numbers. So, 12 × 420 = 5040.",
  },
  {
    id: 3,
    className: "Class 10",
    subject: "Mathematics",
    chapter: "Polynomials",
    difficulty: "Easy",
    question:
      "If one zero of the polynomial x² - 5x + 6 is 2, what is the other zero?",
    options: ["1", "2", "3", "4"],
    answer: "3",
    explanation:
      "The polynomial factors as (x - 2)(x - 3). Since one zero is 2, the other zero is 3.",
  },
  {
    id: 4,
    className: "Class 10",
    subject: "Science",
    chapter: "Chemical Reactions and Equations",
    difficulty: "Easy",
    question:
      "Which type of reaction occurs when two or more substances combine to form a single product?",
    options: [
      "Decomposition reaction",
      "Combination reaction",
      "Displacement reaction",
      "Double displacement reaction",
    ],
    answer: "Combination reaction",
    explanation:
      "A combination reaction is one in which two or more substances combine to form a single product.",
  },
  {
    id: 7,
    className: "Class 9",
    subject: "Mathematics",
    chapter: "Number Systems",
    difficulty: "Easy",
    question: "Which of the following is an irrational number?",
    options: ["0.25", "3/4", "√2", "2"],
    answer: "√2",
    explanation:
      "√2 is irrational because it cannot be expressed as a ratio of two integers and its decimal expansion is non-terminating and non-repeating.",
  },
];
