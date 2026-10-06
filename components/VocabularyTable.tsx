"use client";

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

type Props = {
  vocabulary: Vocabulary[];
};

export default function VocabularyTable({
  vocabulary
}: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b bg-slate-50 text-sm text-slate-500">
            <tr>
              <th className="px-5 py-4">
                Japanese
              </th>

              <th className="px-5 py-4">
                Meaning
              </th>

              <th className="px-5 py-4">
                Status
              </th>

              <th className="px-5 py-4">
                Accuracy
              </th>
            </tr>
          </thead>

          <tbody>
            {vocabulary.map((word) => {
              const total =
                word.correctCount +
                word.wrongCount;

              const accuracy =
                total === 0
                  ? 0
                  : Math.round(
                      (word.correctCount /
                        total) *
                        100
                    );

              return (
                <tr
                  key={word.id}
                  className="border-b last:border-0"
                >
                  <td className="px-5 py-4">
                    <div className="text-lg font-semibold">
                      {word.japanese}
                    </div>

                    <div className="text-sm text-slate-500">
                      {word.reading}
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    {word.meaning}
                  </td>

                  <td className="px-5 py-4">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">
                      {word.status}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    {accuracy}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {vocabulary.length === 0 && (
        <div className="p-10 text-center text-slate-500">
          No vocabulary yet.
        </div>
      )}
    </div>
  );
}