import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

import "dotenv/config";

const connectionString =
  process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not defined"
  );
}

const adapter = new PrismaPg({
  connectionString
});

const prisma = new PrismaClient({
  adapter
});

const words = [
  {
    japanese: "食べる",
    reading: "たべる",
    meaning: "to eat",
    exampleJapanese: "ごはんを食べる。",
    exampleEnglish: "I eat rice.",
    jlptLevel: "N5"
  },

  {
    japanese: "飲む",
    reading: "のむ",
    meaning: "to drink",
    exampleJapanese: "水を飲む。",
    exampleEnglish: "I drink water.",
    jlptLevel: "N5"
  },

  {
    japanese: "見る",
    reading: "みる",
    meaning: "to see / to watch",
    exampleJapanese: "テレビを見る。",
    exampleEnglish: "I watch TV.",
    jlptLevel: "N5"
  },

  {
    japanese: "窓",
    reading: "まど",
    meaning: "window",
    exampleJapanese: "窓を開ける。",
    exampleEnglish: "Open the window.",
    jlptLevel: "N5"
  },

  {
    japanese: "電車",
    reading: "でんしゃ",
    meaning: "train",
    exampleJapanese: "電車に乗る。",
    exampleEnglish: "Ride the train.",
    jlptLevel: "N5"
  },

  {
    japanese: "学校",
    reading: "がっこう",
    meaning: "school",
    exampleJapanese: "学校へ行く。",
    exampleEnglish: "I go to school.",
    jlptLevel: "N5"
  },

  {
    japanese: "先生",
    reading: "せんせい",
    meaning: "teacher",
    exampleJapanese: "先生に聞く。",
    exampleEnglish: "Ask the teacher.",
    jlptLevel: "N5"
  },

  {
    japanese: "友達",
    reading: "ともだち",
    meaning: "friend",
    exampleJapanese: "友達と話す。",
    exampleEnglish: "Talk with a friend.",
    jlptLevel: "N5"
  }
];

async function main() {
  for (const word of words) {
    await prisma.vocabulary.upsert({
      where: {
        id: `${word.japanese}-${word.reading}`
      },
      update: {},
      create: {
        id: `${word.japanese}-${word.reading}`,
        ...word
      }
    });
  }

  console.log(
    `Seeded ${words.length} vocabulary words.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });