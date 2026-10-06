import type { VocabularyStatus } from "@/app/generated/prisma/client";

type VocabularyForReview = {
  id: string;
  status: VocabularyStatus;
  correctCount: number;
  wrongCount: number;
  streak: number;
  nextReviewAt: Date;
};

function getPriority(word: VocabularyForReview): number {
  const now = Date.now();

  let priority = 1;

  // New words should appear frequently.
  if (word.status === "NEW") {
    priority += 8;
  }

  // Learning words.
  if (word.status === "LEARNING") {
    priority += 6;
  }

  // Familiar words.
  if (word.status === "FAMILIAR") {
    priority += 3;
  }

  // Mastered words get the lowest priority.
  if (word.status === "MASTERED") {
    priority += 1;
  }

  // Due words get a strong boost.
  if (word.nextReviewAt.getTime() <= now) {
    priority += 8;
  }

  // Frequently wrong words get another boost.
  priority += Math.min(word.wrongCount * 2, 10);

  // Long streak reduces priority.
  priority -= Math.min(word.streak * 0.5, 4);

  return Math.max(priority, 1);
}

export function selectReviewWords<T extends VocabularyForReview>(
  words: T[],
  count: number
): T[] {
  const remaining = [...words];
  const selected: T[] = [];

  while (remaining.length > 0 && selected.length < count) {
    const weighted = remaining.map((word) => ({
      word,
      weight: getPriority(word)
    }));

    const totalWeight = weighted.reduce(
      (sum, item) => sum + item.weight,
      0
    );

    let random = Math.random() * totalWeight;

    let selectedIndex = 0;

    for (let i = 0; i < weighted.length; i++) {
      random -= weighted[i].weight;

      if (random <= 0) {
        selectedIndex = i;
        break;
      }
    }

    selected.push(weighted[selectedIndex].word);

    remaining.splice(selectedIndex, 1);
  }

  return selected;
}

export function calculateNextReview(
  result: "CORRECT" | "WRONG" | "ALMOST",
  currentInterval: number,
  currentStreak: number
) {
  if (result === "WRONG") {
    return {
      intervalDays: 0,
      streak: 0,
      nextReviewAt: new Date(Date.now() + 30 * 60 * 1000)
    };
  }

  if (result === "ALMOST") {
    const interval = Math.max(1, Math.floor(currentInterval * 0.5));

    return {
      intervalDays: interval,
      streak: Math.max(0, currentStreak),
      nextReviewAt: new Date(
        Date.now() + interval * 24 * 60 * 60 * 1000
      )
    };
  }

  const nextStreak = currentStreak + 1;

  const intervals = [
    1,
    2,
    4,
    7,
    14,
    30,
    60
  ];

  const index = Math.min(nextStreak - 1, intervals.length - 1);

  const intervalDays = intervals[index];

  return {
    intervalDays,
    streak: nextStreak,
    nextReviewAt: new Date(
      Date.now() + intervalDays * 24 * 60 * 60 * 1000
    )
  };
}