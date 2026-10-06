"use client";

import { FormEvent, useState } from "react";

type Props = {
  onCreated: () => void;
};

export default function AddVocabularyForm({
  onCreated
}: Props) {
  const [loading, setLoading] =
    useState(false);

  const [form, setForm] = useState({
    japanese: "",
    reading: "",
    meaning: "",
    exampleJapanese: "",
    exampleEnglish: "",
    jlptLevel: "N5"
  });

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);

    try {
      const response = await fetch(
        "/api/vocabulary",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify(form)
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to create vocabulary"
        );
      }

      setForm({
        japanese: "",
        reading: "",
        meaning: "",
        exampleJapanese: "",
        exampleEnglish: "",
        jlptLevel: "N5"
      });

      onCreated();
    } catch (error) {
      console.error(error);
      alert("Failed to add word");
    } finally {
      setLoading(false);
    }
  }

  function update(
    field: keyof typeof form,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border bg-white p-6"
    >
      <div>
        <h2 className="text-xl font-bold">
          Add Japanese word
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Add vocabulary you encounter while
          studying.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <input
          required
          value={form.japanese}
          onChange={(e) =>
            update("japanese", e.target.value)
          }
          placeholder="Japanese — 食べる"
          className="rounded-xl border px-4 py-3 outline-none focus:border-blue-500"
        />

        <input
          required
          value={form.reading}
          onChange={(e) =>
            update("reading", e.target.value)
          }
          placeholder="Reading — たべる"
          className="rounded-xl border px-4 py-3 outline-none focus:border-blue-500"
        />

        <input
          required
          value={form.meaning}
          onChange={(e) =>
            update("meaning", e.target.value)
          }
          placeholder="English — to eat"
          className="rounded-xl border px-4 py-3 outline-none focus:border-blue-500"
        />

        <select
          value={form.jlptLevel}
          onChange={(e) =>
            update("jlptLevel", e.target.value)
          }
          className="rounded-xl border px-4 py-3"
        >
          <option value="N5">JLPT N5</option>
          <option value="N4">JLPT N4</option>
          <option value="N3">JLPT N3</option>
          <option value="N2">JLPT N2</option>
          <option value="N1">JLPT N1</option>
        </select>
      </div>

      <input
        value={form.exampleJapanese}
        onChange={(e) =>
          update(
            "exampleJapanese",
            e.target.value
          )
        }
        placeholder="Example — ごはんを食べる。"
        className="w-full rounded-xl border px-4 py-3"
      />

      <input
        value={form.exampleEnglish}
        onChange={(e) =>
          update(
            "exampleEnglish",
            e.target.value
          )
        }
        placeholder="Example meaning — I eat rice."
        className="w-full rounded-xl border px-4 py-3"
      />

      <button
        disabled={loading}
        className="w-full rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-50"
      >
        {loading ? "Adding..." : "Add word"}
      </button>
    </form>
  );
}