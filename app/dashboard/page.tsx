import Link from "next/link";
import { prisma } from "@/lib/prisma";
import StatCard from "@/components/StatCard";

export default async function DashboardPage() {
  const [
    total,
    newWords,
    learning,
    familiar,
    mastered,
    due
  ] = await Promise.all([
    prisma.vocabulary.count(),

    prisma.vocabulary.count({
      where: {
        status: "NEW"
      }
    }),

    prisma.vocabulary.count({
      where: {
        status: "LEARNING"
      }
    }),

    prisma.vocabulary.count({
      where: {
        status: "FAMILIAR"
      }
    }),

    prisma.vocabulary.count({
      where: {
        status: "MASTERED"
      }
    }),

    prisma.vocabulary.count({
      where: {
        nextReviewAt: {
          lte: new Date()
        }
      }
    })
  ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-10">
        <p className="text-sm font-medium text-blue-600">
          日本語 Vocabulary
        </p>

        <h1 className="mt-2 text-4xl font-bold">
          Keep learning.
        </h1>

        <p className="mt-3 text-slate-600">
          Build Japanese vocabulary through active
          recall and spaced review.
        </p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total words"
          value={total}
        />

        <StatCard
          title="New"
          value={newWords}
        />

        <StatCard
          title="Learning"
          value={learning}
        />

        <StatCard
          title="Mastered"
          value={mastered}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl bg-slate-900 p-8 text-white">
          <p className="text-sm text-slate-300">
            Today's practice
          </p>

          <h2 className="mt-2 text-3xl font-bold">
            {due} words due
          </h2>

          <p className="mt-3 text-slate-300">
            Spend 15 or 30 minutes recalling Japanese
            vocabulary.
          </p>

          <Link
            href="/session"
            className="mt-6 inline-block rounded-xl bg-white px-5 py-3 font-semibold text-slate-900"
          >
            Start session
          </Link>
        </div>

        <div className="rounded-3xl border bg-white p-8">
          <p className="text-sm text-slate-500">
            Progress
          </p>

          <h2 className="mt-2 text-3xl font-bold">
            {familiar} familiar
          </h2>

          <p className="mt-3 text-slate-600">
            {learning} words still need practice.
          </p>

          <Link
            href="/vocabulary"
            className="mt-6 inline-block rounded-xl border px-5 py-3 font-semibold"
          >
            Manage vocabulary
          </Link>
        </div>
      </div>
    </div>
  );
}