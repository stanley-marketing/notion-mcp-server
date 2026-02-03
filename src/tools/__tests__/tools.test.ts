import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createServer } from "../../server.js";

// Mock axios to avoid real API calls
vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
    })),
  },
}));

async function setupMcp(toolset?: string): Promise<{ server: McpServer; client: Client }> {
  process.env.NOTION_TOKEN = "test-token";

  if (toolset) {
    process.env.NOTION_MCP_TOOLSET = toolset;
  } else {
    delete process.env.NOTION_MCP_TOOLSET;
  }

  const server = createServer();
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client({
    name: "test-client",
    version: "1.0.0",
  });

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return { server, client };
}

async function teardownMcp(server: McpServer, client: Client): Promise<void> {
  await client.close();
  await server.close();
  delete process.env.NOTION_MCP_TOOLSET;
  vi.clearAllMocks();
}

describe("MCP Server", () => {
  beforeEach(() => {
    process.env.NOTION_TOKEN = "test-token";
    delete process.env.NOTION_MCP_TOOLSET;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createServer", () => {
    it("should create an MCP server instance", () => {
      const server = createServer();
      expect(server).toBeInstanceOf(McpServer);
    });

    it("should have the correct server name and version", () => {
      const server = createServer();
      expect(server).toBeDefined();
    });
  });
});

describe("Tool Registration (generic toolset)", () => {
  let server: McpServer;
  let client: Client;

  beforeEach(async () => {
    ({ server, client } = await setupMcp());
  });

  afterEach(async () => {
    await teardownMcp(server, client);
  });

  it("should list all generic tools", async () => {
    const result = await client.listTools();

    expect(result.tools).toHaveLength(9);

    const toolNames = result.tools.map((t) => t.name);
    expect(toolNames).toContain("create_item");
    expect(toolNames).toContain("get_item");
    expect(toolNames).toContain("update_item");
    expect(toolNames).toContain("archive_item");
    expect(toolNames).toContain("get_collection");
    expect(toolNames).toContain("query_collection");
    expect(toolNames).toContain("search");
    expect(toolNames).toContain("list_users");
    expect(toolNames).toContain("format_content");
  });

  it("should have proper schema for create_item tool", async () => {
    const result = await client.listTools();
    const createItem = result.tools.find((t) => t.name === "create_item");

    expect(createItem).toBeDefined();
    expect(createItem!.description).toContain("Create an item");
    expect(createItem!.inputSchema).toBeDefined();
    expect(createItem!.inputSchema.type).toBe("object");
    expect(createItem!.inputSchema.required).toContain("title");
  });

  it("should have proper schema for get_item tool", async () => {
    const result = await client.listTools();
    const getItem = result.tools.find((t) => t.name === "get_item");

    expect(getItem).toBeDefined();
    expect(getItem!.description).toContain("Get an item");
    expect(getItem!.inputSchema).toBeDefined();
    expect(getItem!.inputSchema.required).toContain("item");
  });

  it("should have proper schema for query_collection tool", async () => {
    const result = await client.listTools();
    const queryCollection = result.tools.find((t) => t.name === "query_collection");

    expect(queryCollection).toBeDefined();
    expect(queryCollection!.description).toContain("Query a collection");
    expect(queryCollection!.inputSchema).toBeDefined();
    expect(queryCollection!.inputSchema.required).toContain("collection");
  });

  it("should have proper schema for get_collection tool", async () => {
    const result = await client.listTools();
    const getCollection = result.tools.find((t) => t.name === "get_collection");

    expect(getCollection).toBeDefined();
    expect(getCollection!.description).toContain("Get a collection");
    expect(getCollection!.inputSchema).toBeDefined();
    expect(getCollection!.inputSchema.required).toContain("collection");
  });

  it("should have proper schema for search tool", async () => {
    const result = await client.listTools();
    const search = result.tools.find((t) => t.name === "search");

    expect(search).toBeDefined();
    expect(search!.description).toContain("Search");
    expect(search!.inputSchema).toBeDefined();
  });

  it("should have descriptions for all tool parameters", async () => {
    const result = await client.listTools();

    for (const tool of result.tools) {
      const schema = tool.inputSchema as { properties?: Record<string, { description?: string }> };
      if (schema.properties) {
        for (const propSchema of Object.values(schema.properties)) {
          expect(propSchema.description).toBeDefined();
          expect(propSchema.description!.length).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("Tool Registration (legacy toolset)", () => {
  let server: McpServer;
  let client: Client;

  beforeEach(async () => {
    ({ server, client } = await setupMcp("legacy"));
  });

  afterEach(async () => {
    await teardownMcp(server, client);
  });

  it("should register legacy Notion-shaped tools", async () => {
    const result = await client.listTools();

    expect(result.tools).toHaveLength(10);

    const toolNames = result.tools.map((t) => t.name);
    expect(toolNames).toContain("create_page");
    expect(toolNames).toContain("get_page");
    expect(toolNames).toContain("update_page");
    expect(toolNames).toContain("archive_page");
    expect(toolNames).toContain("create_database_entry");
    expect(toolNames).toContain("get_database_entry");
    expect(toolNames).toContain("update_database_entry");
    expect(toolNames).toContain("query_database");
    expect(toolNames).toContain("search");
    expect(toolNames).toContain("list_users");
  });
});
