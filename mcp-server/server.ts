
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import "dotenv/config";

const app = express();
app.use(express.json());

const PORT = Number(process.env.MCP_PORT ?? 8787);

function createMcpServer() {
  const server = new McpServer({
    name: "nihonkotoba",
    version: "1.0.0",
  });

  server.tool(
    "add_vocabulary",
    "Add a Japanese vocabulary entry to the user's Nihonkotoba vocabulary database.",
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
        const apiUrl = process.env.NIHONKOTOBA_API_URL;
        console.log(process.env)

        if (!apiUrl) {
          throw new Error("Nihonkotoba API configuration is missing.");
        }

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
                ...vocabulary,
                explanation: vocabulary.explanation ?? ""
            })
        });

        const result = await response.json().catch(() => null);

        if (!response.ok) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  success: false,
                  status: response.status,
                  error: result ?? "Vocabulary API request failed",
                }),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result),
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text:
                error instanceof Error
                  ? error.message
                  : "Unknown error occurred",
            },
          ],
        };
      }
    }
  );

  return server;
}

// Optional protection for the remote MCP endpoint.
// Leave MCP_ACCESS_TOKEN unset for private local testing.
// Configure it before exposing the MCP port publicly.
app.post("/mcp", async (req, res) => {
  const accessToken = process.env.MCP_ACCESS_TOKEN;

  if (accessToken) {
    const authorization = req.headers.authorization;

    if (authorization !== `Bearer ${accessToken}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  const server = createMcpServer();

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP request failed:", error);

    if (!res.headersSent) {
      res.status(500).json({ error: "MCP server error" });
    }
  }
});

app.get("/", (_req, res) => {
  res.json({
    name: "Nihonkotoba MCP Server",
    status: "running",
    endpoint: "/mcp",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Nihonkotoba MCP server running on port ${PORT}`);
});
