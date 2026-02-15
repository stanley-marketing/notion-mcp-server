import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getNotionClient, NotionClientError } from "../../client/notion-client.js";
import { registerTool } from "../tool-helper.js";
import { extractNotionId } from "../utils/notion-id.js";
import { extractCollectionSchema } from "../utils/collection-schema.js";

export function register(server: McpServer): void {
  registerTool(
    server,
    "get_collection",
    "Get a collection's schema (fields, types, select options). Accepts a URL or ID. Call this before create_item or update_item to discover the available field names and their types for setting column values.",
    {
      collection: z.string().describe("Collection identifier (URL or ID)"),
    },
    async ({ collection }) => {
      try {
        const client = getNotionClient();
        const collectionId = extractNotionId(collection);
        const database = await client.getDatabase(collectionId);
        const schema = extractCollectionSchema(database);

        return {
          content: [{ type: "text" as const, text: JSON.stringify(schema, null, 2) }],
        };
      } catch (error) {
        if (error instanceof NotionClientError) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ error: error.message, code: error.code }, null, 2),
            }],
            isError: true,
          };
        }
        throw error;
      }
    }
  );
}
