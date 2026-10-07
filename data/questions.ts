export type Question = {
  id: number;
  className: string;
  subject: string;
  chapter: string;
  type: "MCQ" | "Short Answer";
  difficulty: "Easy" | "Medium" | "Hard";
  question: string;
  options?: string[];
  answer: string;
};

export const questions: Question[] = [
  {
    id: 1,
    className: "Class 10",
    subject: "Mathematics",
    chapter: "Real Numbers",
    type: "MCQ",
    difficulty: "Medium",
    question:
      "If HCF of two numbers is 12 and their LCM is 420, what is the product of the two numbers?",
    options: ["5040", "432", "35", "408"],
    answer: "5040",
  },
  {
    id: 2,
    className: "Class 10",
    subject: "Mathematics",
    chapter: "Real Numbers",
    type: "Short Answer",
    difficulty: "Medium",
    question:
      "State Euclid's division lemma and explain the meaning of the terms used in it.",
    answer:
      "For positive integers a and b, there exist unique integers q and r such that a = bq + r, where 0 ≤ r < b.",
  },
  {
    id: 3,
    className: "Class 10",
    subject: "Mathematics",
    chapter: "Polynomials",
    type: "MCQ",
    difficulty: "Easy",
    question:
      "If one zero of the polynomial x² - 5x + 6 is 2, what is the other zero?",
    options: ["1", "2", "3", "4"],
    answer: "3",
  },
  {
    id: 4,
    className: "Class 10",
    subject: "Science",
    chapter: "Chemical Reactions and Equations",
    type: "MCQ",
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
  },
  {
    id: 5,
    className: "Class 10",
    subject: "Science",
    chapter: "Chemical Reactions and Equations",
    type: "Short Answer",
    difficulty: "Medium",
    question:
      "What is a chemical equation? Why should a chemical equation be balanced?",
    answer:
      "A chemical equation represents a chemical reaction using symbols and formulae. It should be balanced because the number of atoms of each element must remain the same on both sides of a chemical reaction.",
  },
  {
    id: 6,
    className: "Class 10",
    subject: "English",
    chapter: "Reading Skills",
    type: "Short Answer",
    difficulty: "Easy",
    question:
      "What is the main purpose of identifying the central idea of a passage?",
    answer:
      "The central idea helps the reader understand the main point or message that the writer wants to communicate.",
  },
  {
    id: 7,
    className: "Class 9",
    subject: "Mathematics",
    chapter: "Number Systems",
    type: "MCQ",
    difficulty: "Easy",
    question:
      "Which of the following is an irrational number?",
    options: ["0.25", "3/4", "√2", "2"],
    answer: "√2",
  },
];