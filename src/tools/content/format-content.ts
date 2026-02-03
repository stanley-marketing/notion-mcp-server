import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { markdownToBlocks } from "../utils/markdown-to-blocks.js";
import { registerTool } from "../tool-helper.js";

export function register(server: McpServer): void {
  registerTool(
    server,
    "format_content",
    "Convert markdown text to Notion block objects. Returns the block JSON array that Notion API accepts. Useful for previewing how content will look before writing it.",
    {
      markdown: z.string().describe("Markdown text to convert to Notion blocks"),
    },
    async ({ markdown }) => {
      const blocks = markdownToBlocks(markdown);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { blocks, block_count: blocks.length },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
