"use client";

import { useEffect, useState } from "react";
import AddVocabularyForm from "@/components/AddVocabularyForm";
import VocabularyTable from "@/components/VocabularyTable";

type Vocabulary = {
  id: string;
  japanese: string;
  reading: string;
  meaning: string;
  status: string;
  correctCount: number;
  wrongCount: number;
  streak: number;
  jlptLevel: string | null;
};

export default function VocabularyPage() {
  const [vocabulary, setVocabulary] =
    useState<Vocabulary[]>([]);

  async function loadVocabulary() {
    const response = await fetch(
      "/api/vocabulary"
    );

    const data = await response.json();

    setVocabulary(data);
  }

  useEffect(() => {
    loadVocabulary();
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          Vocabulary
        </h1>

        <p className="mt-2 text-slate-600">
          Build your personal Japanese word bank.
        </p>
      </div>

      <div className="mb-10">
        <AddVocabularyForm
          onCreated={loadVocabulary}
        />
      </div>

      <VocabularyTable
        vocabulary={vocabulary}
      />
    </div>
  );
}