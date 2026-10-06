import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  calculateNextReview,
  selectReviewWords
} from "@/lib/review";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const requestedCount = Number(
      searchParams.get("count") || 20
    );

    const count = Math.min(
      Math.max(requestedCount, 1),
      50
    );

    const vocabulary = await prisma.vocabulary.findMany({
      orderBy: {
        nextReviewAt: "asc"
      }
    });

    const selected = selectReviewWords(
      vocabulary,
      count
    );

    return NextResponse.json(selected);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      vocabularyId,
      result,
      responseTime
    } = body;

    if (!vocabularyId || !result) {
      return NextResponse.json(
        { error: "Vocabulary and result are required" },
        { status: 400 }
      );
    }

    if (
      !["CORRECT", "WRONG", "ALMOST"].includes(result)
    ) {
      return NextResponse.json(
        { error: "Invalid result" },
        { status: 400 }
      );
    }

    const vocabulary =
      await prisma.vocabulary.findUnique({
        where: {
          id: vocabularyId
        }
      });

    if (!vocabulary) {
      return NextResponse.json(
        { error: "Vocabulary not found" },
        { status: 404 }
      );
    }

    const reviewResult = result as
      | "CORRECT"
      | "WRONG"
      | "ALMOST";

    const review =
      calculateNextReview(
        reviewResult,
        vocabulary.intervalDays,
        vocabulary.streak
      );

    const status =
      reviewResult === "WRONG"
        ? "LEARNING"
        : review.streak >= 5
          ? "MASTERED"
          : review.streak >= 2
            ? "FAMILIAR"
            : "LEARNING";

    const updated =
      await prisma.$transaction(async (tx) => {
        await tx.review.create({
          data: {
            vocabularyId,
            result: reviewResult,
            responseTime:
              typeof responseTime === "number"
                ? responseTime
                : null
          }
        });

        return tx.vocabulary.update({
          where: {
            id: vocabularyId
          },
          data: {
            status,
            streak: review.streak,
            intervalDays:
              review.intervalDays,
            nextReviewAt:
              review.nextReviewAt,
            lastReviewedAt: new Date(),

            correctCount:
              reviewResult === "CORRECT"
                ? {
                    increment: 1
                  }
                : undefined,

            wrongCount:
              reviewResult === "WRONG"
                ? {
                    increment: 1
                  }
                : undefined,

            almostCount:
              reviewResult === "ALMOST"
                ? {
                    increment: 1
                  }
                : undefined
          }
        });
      });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to save review" },
      { status: 500 }
    );
  }
}