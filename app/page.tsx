"use client";

import { useMemo, useState } from "react";
import { questions, type Question } from "../data/questions";

const classes = ["All Classes", "Class 9", "Class 10"];

const subjects = [
  "All Subjects",
  "Mathematics",
  "Science",
  "English",
];

const questionTypes = [
  "All Types",
  "MCQ",
  "Short Answer",
];

const difficulties = [
  "All Levels",
  "Easy",
  "Medium",
  "Hard",
];

export default function Home() {
  const [selectedClass, setSelectedClass] =
    useState("All Classes");

  const [selectedSubject, setSelectedSubject] =
    useState("All Subjects");

  const [selectedChapter, setSelectedChapter] =
    useState("All Chapters");

  const [selectedType, setSelectedType] =
    useState("All Types");

  const [selectedDifficulty, setSelectedDifficulty] =
    useState("All Levels");

  const [searchTerm, setSearchTerm] = useState("");

  const [selectedOptions, setSelectedOptions] =
    useState<Record<number, string>>({});

  const [checkedAnswers, setCheckedAnswers] =
    useState<Record<number, boolean>>({});

  const [showAnswers, setShowAnswers] =
    useState<Record<number, boolean>>({});

  const [writtenAnswers, setWrittenAnswers] =
    useState<Record<number, string>>({});

  const [writtenChecked, setWrittenChecked] =
    useState<Record<number, boolean>>({});

  // Practice Test states
  const [practiceMode, setPracticeMode] =
    useState(false);

  const [practiceCount, setPracticeCount] =
    useState(5);

  const [practiceQuestions, setPracticeQuestions] =
    useState<Question[]>([]);

  const [practiceIndex, setPracticeIndex] =
    useState(0);

  const [practiceAnswers, setPracticeAnswers] =
    useState<Record<number, string>>({});

  const [practiceSubmitted, setPracticeSubmitted] =
    useState(false);

  const chapters = useMemo(() => {
    if (selectedSubject === "Mathematics") {
      return [
        "All Chapters",
        "Real Numbers",
        "Polynomials",
        "Number Systems",
      ];
    }

    if (selectedSubject === "Science") {
      return [
        "All Chapters",
        "Chemical Reactions and Equations",
        "Matter in Our Surroundings",
      ];
    }

    if (selectedSubject === "English") {
      return [
        "All Chapters",
        "Reading Skills",
      ];
    }

    return ["All Chapters"];
  }, [selectedSubject]);

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const matchesClass =
        selectedClass === "All Classes" ||
        q.className === selectedClass;

      const matchesSubject =
        selectedSubject === "All Subjects" ||
        q.subject === selectedSubject;

      const matchesChapter =
        selectedChapter === "All Chapters" ||
        q.chapter === selectedChapter;

      const matchesType =
        selectedType === "All Types" ||
        q.type === selectedType;

      const matchesDifficulty =
        selectedDifficulty === "All Levels" ||
        q.difficulty === selectedDifficulty;

      const matchesSearch =
        q.question
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

      return (
        matchesClass &&
        matchesSubject &&
        matchesChapter &&
        matchesType &&
        matchesDifficulty &&
        matchesSearch
      );
    });
  }, [
    selectedClass,
    selectedSubject,
    selectedChapter,
    selectedType,
    selectedDifficulty,
    searchTerm,
  ]);

  const availableMCQs = filteredQuestions.filter(
    (q) => q.type === "MCQ"
  );

  function handleSubjectChange(value: string) {
    setSelectedSubject(value);
    setSelectedChapter("All Chapters");
  }

  function handleOptionChange(
    questionId: number,
    option: string
  ) {
    setSelectedOptions((prev) => ({
      ...prev,
      [questionId]: option,
    }));

    setCheckedAnswers((prev) => ({
      ...prev,
      [questionId]: false,
    }));
  }

  function checkAnswer(question: Question) {
    setCheckedAnswers((prev) => ({
      ...prev,
      [question.id]:
        selectedOptions[question.id] === question.answer,
    }));
  }

  function toggleAnswer(questionId: number) {
    setShowAnswers((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  }

  function checkWrittenAnswer(question: Question) {
    const answer =
      writtenAnswers[question.id]?.trim();

    setWrittenChecked((prev) => ({
      ...prev,
      [question.id]: Boolean(answer),
    }));
  }

  function clearFilters() {
    setSelectedClass("All Classes");
    setSelectedSubject("All Subjects");
    setSelectedChapter("All Chapters");
    setSelectedType("All Types");
    setSelectedDifficulty("All Levels");
    setSearchTerm("");
  }

  function startPracticeTest() {
    const mcqs = [...availableMCQs];

    for (let i = mcqs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [mcqs[i], mcqs[j]] = [mcqs[j], mcqs[i]];
    }

    const selectedQuestions = mcqs.slice(
      0,
      Math.min(practiceCount, mcqs.length)
    );

    setPracticeQuestions(selectedQuestions);
    setPracticeIndex(0);
    setPracticeAnswers({});
    setPracticeSubmitted(false);
    setPracticeMode(true);
  }

  function handlePracticeAnswer(
    questionId: number,
    answer: string
  ) {
    setPracticeAnswers((prev) => ({
      ...prev,
      [questionId]: answer,
    }));
  }

  function submitPracticeTest() {
    setPracticeSubmitted(true);
  }

  function exitPracticeTest() {
    setPracticeMode(false);
    setPracticeSubmitted(false);
    setPracticeQuestions([]);
    setPracticeAnswers({});
    setPracticeIndex(0);
  }

  const practiceScore = practiceQuestions.filter(
    (q) =>
      practiceAnswers[q.id] === q.answer
  ).length;

  const practicePercentage =
    practiceQuestions.length > 0
      ? Math.round(
          (practiceScore /
            practiceQuestions.length) *
            100
        )
      : 0;

  if (practiceMode) {
    if (practiceSubmitted) {
      return (
        <main className="min-h-screen bg-gray-50">
          <header className="border-b bg-white">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
              <h1 className="text-xl font-bold text-gray-900">
                CBSE Question Bank
              </h1>

              <button
                onClick={exitPracticeTest}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
              >
                Back to Questions
              </button>
            </div>
          </header>

          <section className="mx-auto max-w-4xl px-6 py-10">
            <div className="rounded-2xl bg-white p-8 shadow-sm">
              <h2 className="text-3xl font-bold text-gray-900">
                Practice Test Result
              </h2>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-gray-50 p-5">
                  <p className="text-sm text-gray-500">
                    Total Questions
                  </p>
                  <p className="mt-1 text-3xl font-bold">
                    {practiceQuestions.length}
                  </p>
                </div>

                <div className="rounded-xl bg-gray-50 p-5">
                  <p className="text-sm text-gray-500">
                    Correct
                  </p>
                  <p className="mt-1 text-3xl font-bold text-green-600">
                    {practiceScore}
                  </p>
                </div>

                <div className="rounded-xl bg-gray-50 p-5">
                  <p className="text-sm text-gray-500">
                    Percentage
                  </p>
                  <p className="mt-1 text-3xl font-bold">
                    {practicePercentage}%
                  </p>
                </div>
              </div>

              <div className="mt-8 space-y-4">
                {practiceQuestions.map(
                  (question, index) => {
                    const userAnswer =
                      practiceAnswers[question.id];

                    const isCorrect =
                      userAnswer === question.answer;

                    return (
                      <div
                        key={question.id}
                        className="rounded-xl border p-5"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium">
                            Q{index + 1}
                          </span>

                          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs">
                            {question.difficulty}
                          </span>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              isCorrect
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {isCorrect
                              ? "Correct"
                              : "Incorrect"}
                          </span>
                        </div>

                        <p className="mt-3 font-medium text-gray-900">
                          {question.question}
                        </p>

                        <p className="mt-3 text-sm text-gray-600">
                          Your answer:{" "}
                          <span className="font-medium">
                            {userAnswer || "Not answered"}
                          </span>
                        </p>

                        <p className="mt-1 text-sm text-gray-600">
                          Correct answer:{" "}
                          <span className="font-medium text-green-700">
                            {question.answer}
                          </span>
                        </p>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          </section>
        </main>
      );
    }

    const currentQuestion =
      practiceQuestions[practiceIndex];

    if (!currentQuestion) {
      return null;
    }

    return (
      <main className="min-h-screen bg-gray-50">
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <h1 className="text-xl font-bold text-gray-900">
              CBSE Question Bank
            </h1>

            <button
              onClick={exitPracticeTest}
              className="rounded-lg border px-4 py-2 text-sm font-medium"
            >
              Exit Test
            </button>
          </div>
        </header>

        <section className="mx-auto max-w-3xl px-6 py-10">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Practice Test
              </p>

              <h2 className="text-xl font-bold">
                Question {practiceIndex + 1} of{" "}
                {practiceQuestions.length}
              </h2>
            </div>

            <span className="rounded-full bg-gray-100 px-3 py-1 text-sm">
              {currentQuestion.difficulty}
            </span>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-lg font-semibold text-gray-900">
              {currentQuestion.question}
            </p>

            <div className="mt-6 space-y-3">
              {currentQuestion.options?.map(
                (option) => {
                  const selected =
                    practiceAnswers[
                      currentQuestion.id
                    ] === option;

                  return (
                    <button
                      key={option}
                      onClick={() =>
                        handlePracticeAnswer(
                          currentQuestion.id,
                          option
                        )
                      }
                      className={`w-full rounded-xl border p-4 text-left transition ${
                        selected
                          ? "border-gray-900 bg-gray-100"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {option}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button
              disabled={practiceIndex === 0}
              onClick={() =>
                setPracticeIndex(
                  (prev) => prev - 1
                )
              }
              className="rounded-lg border px-5 py-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            {practiceIndex <
            practiceQuestions.length - 1 ? (
              <button
                onClick={() =>
                  setPracticeIndex(
                    (prev) => prev + 1
                  )
                }
                className="rounded-lg bg-gray-900 px-5 py-2 text-white"
              >
                Next
              </button>
            ) : (
              <button
                onClick={submitPracticeTest}
                className="rounded-lg bg-green-600 px-5 py-2 text-white"
              >
                Submit Test
              </button>
            )}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold text-gray-900">
            CBSE Question Bank
          </h1>

          <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white">
            Login
          </button>
        </div>
      </header>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              CBSE Preparation
            </p>

            <h2 className="mt-3 text-4xl font-bold tracking-tight text-gray-900">
              Practice questions for better exam preparation
            </h2>

            <p className="mt-4 text-lg text-gray-600">
              Find questions by class, subject, chapter,
              type and difficulty level.
            </p>

            <div className="mt-7 flex gap-3">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) =>
                  setSearchTerm(e.target.value)
                }
                placeholder="Search questions..."
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-gray-900"
              />

              <button
                onClick={() =>
                  document
                    .getElementById("questions")
                    ?.scrollIntoView({
                      behavior: "smooth",
                    })
                }
                className="rounded-xl bg-gray-900 px-6 py-3 font-medium text-white"
              >
                Search
              </button>
            </div>
          </div>
        </div>
      </section>

      <section
        id="questions"
        className="mx-auto max-w-6xl px-6 py-10"
      >
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                Find Questions
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Use filters to find the right questions.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <select
                value={selectedClass}
                onChange={(e) =>
                  setSelectedClass(e.target.value)
                }
                className="rounded-xl border border-gray-300 bg-white px-4 py-3"
              >
                {classes.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>

              <select
                value={selectedSubject}
                onChange={(e) =>
                  handleSubjectChange(
                    e.target.value
                  )
                }
                className="rounded-xl border border-gray-300 bg-white px-4 py-3"
              >
                {subjects.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>

              <select
                value={selectedChapter}
                onChange={(e) =>
                  setSelectedChapter(
                    e.target.value
                  )
                }
                className="rounded-xl border border-gray-300 bg-white px-4 py-3"
              >
                {chapters.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>

              <select
                value={selectedType}
                onChange={(e) =>
                  setSelectedType(e.target.value)
                }
                className="rounded-xl border border-gray-300 bg-white px-4 py-3"
              >
                {questionTypes.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>

              <select
                value={selectedDifficulty}
                onChange={(e) =>
                  setSelectedDifficulty(
                    e.target.value
                  )
                }
                className="rounded-xl border border-gray-300 bg-white px-4 py-3"
              >
                {difficulties.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={clearFilters}
                className="rounded-lg border px-4 py-2 text-sm font-medium"
              >
                Clear Filters
              </button>

              <span className="text-sm text-gray-500">
                {filteredQuestions.length} questions found
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                Practice Test
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Test yourself using the current filters.
              </p>

              <p className="mt-2 text-sm font-medium text-gray-700">
                Available MCQs: {availableMCQs.length}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={practiceCount}
                onChange={(e) =>
                  setPracticeCount(
                    Number(e.target.value)
                  )
                }
                className="rounded-lg border px-3 py-2"
              >
                <option value={3}>3 Questions</option>
                <option value={5}>5 Questions</option>
                <option value={10}>10 Questions</option>
              </select>

              <button
                onClick={startPracticeTest}
                disabled={availableMCQs.length === 0}
                className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Start Practice Test
              </button>
            </div>
          </div>

          {availableMCQs.length > 0 &&
            availableMCQs.length < practiceCount && (
              <p className="mt-3 text-sm text-amber-600">
                Only {availableMCQs.length} MCQ
                {availableMCQs.length !== 1
                  ? "s"
                  : ""}{" "}
                are available with the current filters.
                The test will use all available MCQs.
              </p>
            )}
        </div>

        <div className="mt-6 space-y-5">
          {filteredQuestions.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
              <h3 className="text-lg font-semibold">
                No questions found
              </h3>

              <p className="mt-2 text-sm text-gray-500">
                Try changing the filters or search term.
              </p>
            </div>
          ) : (
            filteredQuestions.map((question) => (
              <div
                key={question.id}
                className="rounded-2xl bg-white p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium">
                    {question.className}
                  </span>

                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium">
                    {question.subject}
                  </span>

                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium">
                    {question.chapter}
                  </span>

                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium">
                    {question.type}
                  </span>

                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium">
                    {question.difficulty}
                  </span>
                </div>

                <h3 className="mt-4 text-lg font-semibold text-gray-900">
                  {question.question}
                </h3>

                {question.type === "MCQ" &&
                  question.options && (
                    <div className="mt-5 space-y-3">
                      {question.options.map(
                        (option) => {
                          const selected =
                            selectedOptions[
                              question.id
                            ] === option;

                          const checked =
                            checkedAnswers[
                              question.id
                            ];

                          const isCorrect =
                            option ===
                            question.answer;

                          let optionClass =
                            "border-gray-200 hover:bg-gray-50";

                          if (
                            checked &&
                            selected &&
                            isCorrect
                          ) {
                            optionClass =
                              "border-green-500 bg-green-50";
                          } else if (
                            checked &&
                            selected &&
                            !isCorrect
                          ) {
                            optionClass =
                              "border-red-500 bg-red-50";
                          } else if (selected) {
                            optionClass =
                              "border-gray-900 bg-gray-100";
                          }

                          return (
                            <button
                              key={option}
                              onClick={() =>
                                handleOptionChange(
                                  question.id,
                                  option
                                )
                              }
                              className={`w-full rounded-xl border p-4 text-left transition ${optionClass}`}
                            >
                              {option}
                            </button>
                          );
                        }
                      )}

                      <div className="flex flex-wrap gap-3 pt-2">
                        <button
                          onClick={() =>
                            checkAnswer(question)
                          }
                          disabled={
                            !selectedOptions[
                              question.id
                            ]
                          }
                          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Check Answer
                        </button>

                        <button
                          onClick={() =>
                            toggleAnswer(
                              question.id
                            )
                          }
                          className="rounded-lg border px-4 py-2 text-sm font-medium"
                        >
                          {showAnswers[
                            question.id
                          ]
                            ? "Hide Answer"
                            : "Show Answer"}
                        </button>
                      </div>

                      {checkedAnswers[
                        question.id
                      ] && (
                        <p
                          className={`mt-3 text-sm font-medium ${
                            selectedOptions[
                              question.id
                            ] === question.answer
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {selectedOptions[
                            question.id
                          ] === question.answer
                            ? "Correct Answer!"
                            : "Incorrect Answer"}
                        </p>
                      )}

                      {showAnswers[
                        question.id
                      ] && (
                        <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm">
                          <span className="font-semibold">
                            Correct Answer:
                          </span>{" "}
                          {question.answer}
                        </div>
                      )}
                    </div>
                  )}

                {question.type ===
                  "Short Answer" && (
                  <div className="mt-5">
                    <textarea
                      value={
                        writtenAnswers[
                          question.id
                        ] || ""
                      }
                      onChange={(e) =>
                        setWrittenAnswers(
                          (prev) => ({
                            ...prev,
                            [question.id]:
                              e.target.value,
                          })
                        )
                      }
                      placeholder="Write your answer here..."
                      rows={5}
                      className="w-full rounded-xl border border-gray-300 p-4 outline-none focus:border-gray-900"
                    />

                    <div className="mt-3 flex flex-wrap gap-3">
                      <button
                        onClick={() =>
                          checkWrittenAnswer(
                            question
                          )
                        }
                        disabled={
                          !writtenAnswers[
                            question.id
                          ]?.trim()
                        }
                        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Check Answer
                      </button>

                      <button
                        onClick={() =>
                          toggleAnswer(
                            question.id
                          )
                        }
                        className="rounded-lg border px-4 py-2 text-sm font-medium"
                      >
                        {showAnswers[
                          question.id
                        ]
                          ? "Hide Model Answer"
                          : "Show Model Answer"}
                      </button>
                    </div>

                    {writtenChecked[
                      question.id
                    ] && (
                      <p className="mt-3 text-sm font-medium text-green-600">
                        Answer submitted successfully. Compare your answer with the model answer.
                      </p>
                    )}

                    {showAnswers[
                      question.id
                    ] && (
                      <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm leading-6">
                        <span className="font-semibold">
                          Model Answer:
                        </span>{" "}
                        {question.answer}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}