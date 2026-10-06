"use client";

type Props = {
  onStart: (minutes: number) => void;
};

export default function SessionSetup({
  onStart
}: Props) {
  return (
    <div className="mx-auto max-w-2xl py-16">
      <div className="rounded-3xl border bg-white p-10 text-center shadow-sm">
        <div className="text-5xl">
          🇯🇵
        </div>

        <h1 className="mt-5 text-3xl font-bold">
          Japanese practice
        </h1>

        <p className="mt-3 text-slate-600">
          You will see Japanese words and type their
          English meanings.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <button
            onClick={() => onStart(15)}
            className="rounded-2xl border p-6 text-left hover:border-blue-500 hover:bg-blue-50"
          >
            <div className="text-2xl font-bold">
              15 min
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Quick daily practice
            </p>
          </button>

          <button
            onClick={() => onStart(30)}
            className="rounded-2xl border p-6 text-left hover:border-blue-500 hover:bg-blue-50"
          >
            <div className="text-2xl font-bold">
              30 min
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Full vocabulary session
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}