import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getNotionClient, NotionClientError } from "../../client/notion-client.js";
import { registerTool } from "../tool-helper.js";
import { extractNotionId } from "../utils/notion-id.js";
import { extractCollectionSchema } from "../utils/collection-schema.js";
import { coerceFieldsToNotionProperties, normalizeItem } from "../utils/normalize-item.js";
import { markdownToBlocks } from "../utils/markdown-to-blocks.js";

export function register(server: McpServer): void {
  registerTool(
    server,
    "create_item",
    "Create an item. Provide either 'collection' or 'parent_item'.",
    {
      collection: z.string().optional().describe("Collection identifier (URL or ID)"),
      parent_item: z.string().optional().describe("Parent item identifier (URL or ID)"),
      title: z.string().describe("Item title"),
      fields: z.record(z.unknown()).optional().describe("Field values (best-effort mapping using collection schema)"),
      content: z.string().optional().describe("Optional plain-text content to add to the item"),
    },
    async ({ collection, parent_item, title, fields, content }) => {
      try {
        const client = getNotionClient();

        if (!collection && !parent_item) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ error: "Provide either 'collection' or 'parent_item'" }, null, 2),
            }],
            isError: true,
          };
        }

        const parent = collection
          ? { database_id: extractNotionId(collection) }
          : { page_id: extractNotionId(parent_item as string) };

        const properties: Record<string, unknown> = {};

        if (collection) {
          const db = await client.getDatabase(extractNotionId(collection));
          const schema = extractCollectionSchema(db);

          // set title to the first title-type field if possible, else fallback to 'title'
          const titleField = schema.fields.find((f) => f.type === "title")?.name ?? "title";
          properties[titleField] = {
            title: [{ type: "text", text: { content: title } }],
          };

          if (fields) {
            const coerced = coerceFieldsToNotionProperties(fields, schema);
            for (const [k, v] of Object.entries(coerced)) {
              properties[k] = v;
            }
          }
        } else {
          // simple page creation under parent item
          properties.title = {
            title: [{ type: "text", text: { content: title } }],
          };
        }

        const children = content ? markdownToBlocks(content) : [];

        const created = await client.createPage({
          parent,
          properties,
          children: children.length > 0 ? children : undefined,
        });

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ item: normalizeItem(created) }, null, 2),
          }],
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
