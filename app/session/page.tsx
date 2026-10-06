"use client";

import { useState } from "react";
import SessionSetup from "@/components/SessionSetup";
import SessionCard from "@/components/SessionCard";

type Vocabulary = {
  id: string;
  japanese: string;
  reading: string;
  meaning: string;
  exampleJapanese: string | null;
  exampleEnglish: string | null;
};

type Stats = {
  correct: number;
  wrong: number;
  almost: number;
  total: number;
};

export default function SessionPage() {
  const [started, setStarted] =
    useState(false);

  const [minutes, setMinutes] =
    useState(15);

  const [words, setWords] =
    useState<Vocabulary[]>([]);

  const [finished, setFinished] =
    useState(false);

  const [stats, setStats] =
    useState<Stats | null>(null);

  async function startSession(
    selectedMinutes: number
  ) {
    const count =
      selectedMinutes === 15 ? 20 : 40;

    const response = await fetch(
      `/api/session?count=${count}`
    );

    const data = await response.json();

    if (!data.length) {
      alert(
        "Add some vocabulary before starting."
      );

      return;
    }

    setWords(data);
    setMinutes(selectedMinutes);
    setStarted(true);
    setFinished(false);
  }

  if (!started) {
    return (
      <SessionSetup
        onStart={startSession}
      />
    );
  }

  if (finished && stats) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <div className="rounded-3xl border bg-white p-10 text-center">
          <div className="text-5xl">
            🎉
          </div>

          <h1 className="mt-5 text-3xl font-bold">
            Session complete
          </h1>

          <div className="mt-8 grid grid-cols-3 gap-4">
            <div className="rounded-2xl bg-green-50 p-5">
              <div className="text-3xl font-bold text-green-700">
                {stats.correct}
              </div>

              <div className="text-sm text-green-700">
                Correct
              </div>
            </div>

            <div className="rounded-2xl bg-yellow-50 p-5">
              <div className="text-3xl font-bold text-yellow-700">
                {stats.almost}
              </div>

              <div className="text-sm text-yellow-700">
                Almost
              </div>
            </div>

            <div className="rounded-2xl bg-red-50 p-5">
              <div className="text-3xl font-bold text-red-700">
                {stats.wrong}
              </div>

              <div className="text-sm text-red-700">
                Wrong
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setStarted(false);
              setFinished(false);
              setStats(null);
            }}
            className="mt-8 rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white"
          >
            Practice again
          </button>
        </div>
      </div>
    );
  }

  return (
    <SessionCard
      vocabulary={words}
      durationMinutes={minutes}
      onFinish={(result) => {
        setStats(result);
        setFinished(true);
      }}
    />
  );
}