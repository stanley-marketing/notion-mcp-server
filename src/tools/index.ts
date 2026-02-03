import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Generic tools (default)
import { register as registerGetCollection } from "./collections/get-collection.js";
import { register as registerQueryCollection } from "./collections/query-collection.js";
import { register as registerArchiveItem } from "./items/archive-item.js";
import { register as registerCreateItem } from "./items/create-item.js";
import { register as registerGetItem } from "./items/get-item.js";
import { register as registerUpdateItem } from "./items/update-item.js";
import { register as registerFormatContent } from "./content/format-content.js";

// Legacy Notion-shaped tools (opt-in)
import { register as registerCreatePage } from "./pages/create-page.js";
import { register as registerGetPage } from "./pages/get-page.js";
import { register as registerUpdatePage } from "./pages/update-page.js";
import { register as registerArchivePage } from "./pages/archive-page.js";
import { register as registerCreateDatabaseEntry } from "./database-entries/create-entry.js";
import { register as registerGetDatabaseEntry } from "./database-entries/get-entry.js";
import { register as registerUpdateDatabaseEntry } from "./database-entries/update-entry.js";
import { register as registerQueryDatabase } from "./database-entries/query-database.js";

// Shared
import { register as registerSearch } from "./search/search.js";
import { register as registerListUsers } from "./users/list-users.js";

const genericTools = [
  registerGetCollection,
  registerQueryCollection,
  registerCreateItem,
  registerGetItem,
  registerUpdateItem,
  registerArchiveItem,
  registerFormatContent,
  registerSearch,
  registerListUsers,
];

const legacyTools = [
  registerCreatePage,
  registerGetPage,
  registerUpdatePage,
  registerArchivePage,
  registerCreateDatabaseEntry,
  registerGetDatabaseEntry,
  registerUpdateDatabaseEntry,
  registerQueryDatabase,
  registerSearch,
  registerListUsers,
];

export function registerTools(server: McpServer): void {
  const toolset = (process.env.NOTION_MCP_TOOLSET ?? "generic").toLowerCase();

  const toolsToRegister = toolset === "legacy" ? legacyTools : genericTools;

  // "both" mode for debugging: register everything (avoid duplicate shared tools)
  const sharedTools = [registerSearch, registerListUsers];
  const finalTools = toolset === "both"
    ? [...genericTools.filter((t) => !sharedTools.includes(t)), ...legacyTools.filter((t) => !sharedTools.includes(t)), ...sharedTools]
    : toolsToRegister;

  for (const register of finalTools) {
    register(server);
  }
}
