"use client";

import { useEffect, useState } from "react";

type Vocabulary = {
  id: string;
  japanese: string;
  reading: string;
  meaning: string;
  exampleJapanese: string | null;
  exampleEnglish: string | null;
};

type Props = {
  vocabulary: Vocabulary[];
  durationMinutes: number;
  onFinish: (stats: {
    correct: number;
    wrong: number;
    almost: number;
    total: number;
  }) => void;
};

export default function SessionCard({
  vocabulary,
  durationMinutes,
  onFinish
}: Props) {
  const [index, setIndex] = useState(0);

  const [answer, setAnswer] = useState("");

  const [checked, setChecked] =
    useState(false);

  const [result, setResult] = useState<
    "CORRECT" | "WRONG" | "ALMOST" | null
  >(null);

  const [remaining, setRemaining] =
    useState(durationMinutes * 60);

  const [stats, setStats] = useState({
    correct: 0,
    wrong: 0,
    almost: 0
  });

  const current = vocabulary[index];

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          clearInterval(timer);

          onFinish({
            ...stats,
            total:
              stats.correct +
              stats.wrong +
              stats.almost
          });

          return 0;
        }

        return value - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onFinish, stats]);

  if (!current) {
    return null;
  }

  function formatTime() {
    const minutes = Math.floor(
      remaining / 60
    );

    const seconds = remaining % 60;

    return `${String(minutes).padStart(
      2,
      "0"
    )}:${String(seconds).padStart(2, "0")}`;
  }

  async function submitResult(
    selectedResult:
      | "CORRECT"
      | "WRONG"
      | "ALMOST"
  ) {
    if (checked) {
      return;
    }

    setResult(selectedResult);
    setChecked(true);

    const nextStats = {
      ...stats,
      [selectedResult.toLowerCase()]:
        stats[
          selectedResult.toLowerCase() as
            | "correct"
            | "wrong"
            | "almost"
        ] + 1
    };

    setStats(nextStats);

    await fetch("/api/session", {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify({
        vocabularyId: current.id,
        result: selectedResult
      })
    });
  }

  function nextCard() {
    if (
      index + 1 >=
      vocabulary.length
    ) {
      onFinish({
        ...stats,
        total:
          stats.correct +
          stats.wrong +
          stats.almost
      });

      return;
    }

    setIndex((value) => value + 1);
    setAnswer("");
    setChecked(false);
    setResult(null);
  }

  function checkAnswer() {
    const normalizedAnswer =
      answer
        .trim()
        .toLowerCase();

    const normalizedMeaning =
      current.meaning
        .trim()
        .toLowerCase();

    if (
      normalizedAnswer ===
      normalizedMeaning
    ) {
      submitResult("CORRECT");
    } else {
      submitResult("WRONG");
    }
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      <div className="mb-5 flex items-center justify-between">
        <span className="text-sm text-slate-500">
          {index + 1} / {vocabulary.length}
        </span>

        <span className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          {formatTime()}
        </span>
      </div>

      <div className="rounded-3xl border bg-white p-8 shadow-sm">
        <div className="text-center">
          <p className="text-sm font-medium text-blue-600">
            What does this mean?
          </p>

          <div className="mt-8 text-6xl font-bold">
            {current.japanese}
          </div>

          <div className="mt-4 text-2xl text-slate-500">
            {current.reading}
          </div>
        </div>

        {!checked && (
          <div className="mt-10">
            <input
              autoFocus
              value={answer}
              onChange={(e) =>
                setAnswer(e.target.value)
              }
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  answer.trim()
                ) {
                  checkAnswer();
                }
              }}
              placeholder="Type the English meaning..."
              className="w-full rounded-2xl border px-5 py-4 text-lg outline-none focus:border-blue-500"
            />

            <button
              disabled={!answer.trim()}
              onClick={checkAnswer}
              className="mt-4 w-full rounded-2xl bg-blue-600 px-5 py-4 font-semibold text-white disabled:opacity-40"
            >
              Check answer
            </button>
          </div>
        )}

        {checked && (
          <div className="mt-10">
            <div
              className={`rounded-2xl p-5 ${
                result === "CORRECT"
                  ? "bg-green-50 text-green-800"
                  : "bg-red-50 text-red-800"
              }`}
            >
              <div className="text-xl font-bold">
                {result === "CORRECT"
                  ? "✓ Correct!"
                  : "✕ Not quite"}
              </div>

              <div className="mt-2">
                Correct answer:
              </div>

              <div className="text-lg font-semibold">
                {current.meaning}
              </div>
            </div>

            {current.exampleJapanese && (
              <div className="mt-5 rounded-2xl bg-slate-50 p-5">
                <div className="text-lg font-semibold">
                  {current.exampleJapanese}
                </div>

                {current.exampleEnglish && (
                  <div className="mt-2 text-slate-500">
                    {current.exampleEnglish}
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={() =>
                  submitResult("ALMOST")
                }
                className="rounded-xl border px-4 py-3 font-semibold"
              >
                Almost
              </button>

              <button
                onClick={nextCard}
                className="rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}