
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function createMcpServer() {
  const server = new McpServer({
    name: "nihonkotoba",
    version: "1.0.0",
  });

  server.tool(
    "add_vocabulary",
    "Add a Japanese vocabulary entry to the Nihonkotoba database.",
    {
      japanese: z.string().min(1),
      reading: z.string().min(1),
      meaning: z.string().min(1),
      explanation: z.string().optional(),
      exampleJapanese: z.string().min(1),
      exampleEnglish: z.string().min(1),
      jlptLevel: z.enum(["N5", "N4", "N3", "N2", "N1"]),
    },
    async (vocabulary) => {
      try {
        const result = await prisma.vocabulary.create({
          data: {
            japanese: vocabulary.japanese,
            reading: vocabulary.reading,
            meaning: vocabulary.meaning,
            explanation: vocabulary.explanation || null,
            exampleJapanese: vocabulary.exampleJapanese,
            exampleEnglish: vocabulary.exampleEnglish,
            jlptLevel: vocabulary.jlptLevel,
            tags: [],
          },
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                message: "Vocabulary added successfully",
                vocabulary: result,
              }),
            },
          ],
        };
      } catch (error) {
        console.error("Vocabulary insertion failed:", error);

        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Failed to save vocabulary.",
            },
          ],
        };
      }
    }
  );

  return server;
}

export async function POST(request: Request) {
  const token = process.env.MCP_ACCESS_TOKEN;

  if (!token) {
    return Response.json(
      { error: "MCP authentication is not configured" },
      { status: 500 }
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${token}`) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const server = createMcpServer();

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    return await transport.handleRequest(request);
  } catch (error) {
    console.error("MCP request failed:", error);

    return Response.json(
      { error: "MCP server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return Response.json(
    { error: "Use POST for MCP requests" },
    { status: 405 }
  );
}
