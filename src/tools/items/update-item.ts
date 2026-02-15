import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getNotionClient, NotionClientError } from "../../client/notion-client.js";
import { registerTool } from "../tool-helper.js";
import { extractNotionId } from "../utils/notion-id.js";
import { extractCollectionSchema } from "../utils/collection-schema.js";
import { coerceFieldsToNotionProperties, normalizeItem } from "../utils/normalize-item.js";
import { markdownToBlocks, markdownToBlocksBatched } from "../utils/markdown-to-blocks.js";

export function register(server: McpServer): void {
  registerTool(
    server,
    "update_item",
    "Update an item by URL or ID. Updates title/fields, and optionally appends or replaces content. To update column values in a database item, pass them in the 'fields' parameter as simple key-value pairs (e.g., {\"Status\": \"Done\", \"Priority\": \"High\"}). Call get_collection first to discover available field names and types.",
    {
      item: z.string().describe("Item identifier (URL or ID)"),
      title: z.string().optional().describe("New title (if applicable)"),
      fields: z.record(z.unknown()).optional().describe("Column values to update as field_name -> value pairs. Call get_collection first to see available field names and types. Values are auto-coerced: strings for rich_text/select/status, numbers for number, booleans for checkbox, arrays of strings for multi_select (e.g. [\"Tag1\", \"Tag2\"]), {\"start\": \"2024-01-15\"} for date, user IDs for people."),
      append_content: z.string().optional().describe("Plain-text/markdown content to append"),
      replace_content: z.string().optional().describe("Plain-text/markdown content that replaces the entire page body"),
    },
    async ({ item, title, fields, append_content, replace_content }) => {
      try {
        if (replace_content && append_content) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Cannot use both 'replace_content' and 'append_content'. Use one or the other." }, null, 2) }],
            isError: true,
          };
        }

        const client = getNotionClient();
        const itemId = extractNotionId(item);

        const current = await client.getPage(itemId);
        const normalized = normalizeItem(current);
        const collectionId = normalized.collection_id;

        const updateParams: { properties?: Record<string, unknown> } = {};

        if (collectionId) {
          const db = await client.getDatabase(collectionId);
          const schema = extractCollectionSchema(db);

          const props: Record<string, unknown> = {};
          const titleField = schema.fields.find((f) => f.type === "title")?.name;
          if (title && titleField) {
            props[titleField] = {
              title: [{ type: "text", text: { content: title } }],
            };
          }

          if (fields) {
            const coerced = coerceFieldsToNotionProperties(fields, schema);
            for (const [k, v] of Object.entries(coerced)) {
              props[k] = v;
            }
          }

          if (Object.keys(props).length > 0) {
            updateParams.properties = props;
          }
        } else {
          // plain page: only title supported
          if (title) {
            updateParams.properties = {
              title: { title: [{ type: "text", text: { content: title } }] },
            };
          }
        }

        const updated = Object.keys(updateParams).length > 0
          ? await client.updatePage(itemId, updateParams)
          : current;

        if (replace_content !== undefined) {
          const blockIds: string[] = [];
          let cursor: string | undefined;
          for (let i = 0; i < 20; i++) {
            const response = await client.getBlockChildren(itemId, cursor);
            const data = response as { results?: { id?: string }[]; has_more?: boolean; next_cursor?: string | null };
            for (const block of data.results ?? []) {
              if (block.id) blockIds.push(block.id);
            }
            if (!data.has_more) break;
            cursor = data.next_cursor ?? undefined;
            if (!cursor) break;
          }

          for (const id of blockIds) {
            await client.deleteBlock(id);
          }

          const batches = markdownToBlocksBatched(replace_content);
          for (const batch of batches) {
            await client.appendBlockChildren(itemId, batch);
          }
        }

        if (append_content) {
          const batches = markdownToBlocksBatched(append_content);
          for (const batch of batches) {
            await client.appendBlockChildren(itemId, batch);
          }
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ item: normalizeItem(updated) }, null, 2),
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
