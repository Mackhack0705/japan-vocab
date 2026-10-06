import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const vocabulary = await prisma.vocabulary.findMany({
      orderBy: {
        createdAt: "desc"
      }
    });

    return NextResponse.json(vocabulary);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to load vocabulary" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      japanese,
      reading,
      meaning,
      exampleJapanese,
      exampleEnglish,
      jlptLevel,
      tags
    } = body;

    if (!japanese || !reading || !meaning) {
      return NextResponse.json(
        {
          error:
            "Japanese, reading and meaning are required"
        },
        { status: 400 }
      );
    }

    const vocabulary = await prisma.vocabulary.create({
      data: {
        japanese,
        reading,
        meaning,
        exampleJapanese: exampleJapanese || null,
        exampleEnglish: exampleEnglish || null,
        jlptLevel: jlptLevel || null,
        tags: Array.isArray(tags) ? tags : []
      }
    });

    return NextResponse.json(vocabulary, {
      status: 201
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to create vocabulary" },
      { status: 500 }
    );
  }
}