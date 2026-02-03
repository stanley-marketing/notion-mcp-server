import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import { NotionClient, NotionClientError, getNotionClient } from "../notion-client.js";

// Mock axios
vi.mock("axios");
const mockedAxios = vi.mocked(axios);

describe("NotionClient", () => {
  let mockAxiosInstance: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    process.env.NOTION_TOKEN = "test-token";
    
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };
    mockedAxios.create.mockReturnValue(mockAxiosInstance as unknown as ReturnType<typeof axios.create>);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.NOTION_TOKEN;
  });

  describe("constructor", () => {
    it("should throw error when NOTION_TOKEN is not set", () => {
      delete process.env.NOTION_TOKEN;
      expect(() => new NotionClient()).toThrow("NOTION_TOKEN environment variable is required");
    });

    it("should create axios client with correct config", () => {
      new NotionClient();
      
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: "https://api.notion.com",
        headers: {
          "Authorization": "Bearer test-token",
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
      });
    });
  });

  describe("getPage", () => {
    it("should fetch a page by ID", async () => {
      const mockPage = { id: "page-123", object: "page" };
      mockAxiosInstance.get.mockResolvedValue({ data: mockPage });
      
      const client = new NotionClient();
      const result = await client.getPage("page-123");
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/pages/page-123");
      expect(result).toEqual(mockPage);
    });

    it("should throw NotionClientError on API error", async () => {
      const apiError = {
        response: {
          status: 404,
          data: { message: "Page not found", code: "object_not_found" },
        },
      };
      mockAxiosInstance.get.mockRejectedValue(apiError);
      
      const client = new NotionClient();
      
      await expect(client.getPage("invalid-id")).rejects.toThrow(NotionClientError);
      await expect(client.getPage("invalid-id")).rejects.toMatchObject({
        message: "Page not found",
        status: 404,
        code: "object_not_found",
      });
    });
  });

  describe("createPage", () => {
    it("should create a page with given params", async () => {
      const mockPage = { id: "new-page-123", object: "page" };
      mockAxiosInstance.post.mockResolvedValue({ data: mockPage });
      
      const client = new NotionClient();
      const params = {
        parent: { page_id: "parent-123" },
        properties: { title: [{ text: { content: "Test Page" } }] },
      };
      
      const result = await client.createPage(params);
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith("/v1/pages", params);
      expect(result).toEqual(mockPage);
    });
  });

  describe("updatePage", () => {
    it("should update a page with given params", async () => {
      const mockPage = { id: "page-123", object: "page" };
      mockAxiosInstance.patch.mockResolvedValue({ data: mockPage });
      
      const client = new NotionClient();
      const params = { properties: { Status: { select: { name: "Done" } } } };
      
      const result = await client.updatePage("page-123", params);
      
      expect(mockAxiosInstance.patch).toHaveBeenCalledWith("/v1/pages/page-123", params);
      expect(result).toEqual(mockPage);
    });
  });

  describe("archivePage", () => {
    it("should archive a page by setting archived to true", async () => {
      const mockPage = { id: "page-123", archived: true };
      mockAxiosInstance.patch.mockResolvedValue({ data: mockPage });
      
      const client = new NotionClient();
      const result = await client.archivePage("page-123");
      
      expect(mockAxiosInstance.patch).toHaveBeenCalledWith("/v1/pages/page-123", { archived: true });
      expect(result).toEqual(mockPage);
    });
  });

  describe("getBlockChildren", () => {
    it("should fetch block children", async () => {
      const mockBlocks = { results: [{ id: "block-1" }], has_more: false };
      mockAxiosInstance.get.mockResolvedValue({ data: mockBlocks });
      
      const client = new NotionClient();
      const result = await client.getBlockChildren("block-123");
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/blocks/block-123/children", { params: {} });
      expect(result).toEqual(mockBlocks);
    });

     it("should pass start_cursor for pagination", async () => {
       const mockBlocks = { results: [], has_more: false };
       mockAxiosInstance.get.mockResolvedValue({ data: mockBlocks });
       
       const client = new NotionClient();
       await client.getBlockChildren("block-123", "cursor-abc");
       
       expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/blocks/block-123/children", {
         params: { start_cursor: "cursor-abc" },
       });
     });
   });

   describe("deleteBlock", () => {
     it("should delete a block", async () => {
       const mockDeletedBlock = { id: "block-123", archived: true, in_trash: true };
       mockAxiosInstance.delete.mockResolvedValue({ data: mockDeletedBlock });
       
       const client = new NotionClient();
       const result = await client.deleteBlock("block-123");
       
       expect(mockAxiosInstance.delete).toHaveBeenCalledWith("/v1/blocks/block-123");
       expect(result).toEqual(mockDeletedBlock);
     });

     it("should handle errors when deleting a block", async () => {
       const mockError = new Error("API Error");
       mockAxiosInstance.delete.mockRejectedValue(mockError);
       
       const client = new NotionClient();
       
       await expect(async () => {
         await client.deleteBlock("block-123");
       }).rejects.toThrow();
     });
   });

   describe("queryDatabase", () => {
    it("should query a database without params", async () => {
      const mockResults = { results: [], has_more: false };
      mockAxiosInstance.post.mockResolvedValue({ data: mockResults });
      
      const client = new NotionClient();
      const result = await client.queryDatabase("db-123");
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith("/v1/databases/db-123/query", {});
      expect(result).toEqual(mockResults);
    });

    it("should query a database with filter and sorts", async () => {
      const mockResults = { results: [{ id: "entry-1" }], has_more: false };
      mockAxiosInstance.post.mockResolvedValue({ data: mockResults });
      
      const client = new NotionClient();
      const params = {
        filter: { property: "Status", select: { equals: "Done" } },
        sorts: [{ property: "Created", direction: "descending" }],
        page_size: 50,
      };
      
      const result = await client.queryDatabase("db-123", params);
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith("/v1/databases/db-123/query", params);
      expect(result).toEqual(mockResults);
    });
  });

  describe("search", () => {
    it("should search with query", async () => {
      const mockResults = { results: [], has_more: false };
      mockAxiosInstance.post.mockResolvedValue({ data: mockResults });
      
      const client = new NotionClient();
      const params = { query: "test search" };
      
      const result = await client.search(params);
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith("/v1/search", params);
      expect(result).toEqual(mockResults);
    });

    it("should search with filter and sort", async () => {
      const mockResults = { results: [{ id: "page-1" }], has_more: false };
      mockAxiosInstance.post.mockResolvedValue({ data: mockResults });
      
      const client = new NotionClient();
      const params = {
        query: "meeting notes",
        filter: { property: "object" as const, value: "page" as const },
        sort: { direction: "descending" as const, timestamp: "last_edited_time" as const },
        page_size: 10,
      };
      
      const result = await client.search(params);
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith("/v1/search", params);
      expect(result).toEqual(mockResults);
    });
  });

  describe("error handling", () => {
    it("should handle network errors", async () => {
      const networkError = { message: "Network Error" };
      mockAxiosInstance.get.mockRejectedValue(networkError);
      
      const client = new NotionClient();
      
      await expect(client.getPage("page-123")).rejects.toThrow(NotionClientError);
      await expect(client.getPage("page-123")).rejects.toMatchObject({
        message: "Network Error",
        status: 0,
        code: "network_error",
      });
    });

    it("should handle API errors with details", async () => {
      const apiError = {
        response: {
          status: 400,
          data: {
            message: "Invalid request",
            code: "validation_error",
            details: { field: "title" },
          },
        },
      };
      mockAxiosInstance.post.mockRejectedValue(apiError);
      
      const client = new NotionClient();
      
      try {
        await client.createPage({ parent: {}, properties: {} });
      } catch (error) {
        expect(error).toBeInstanceOf(NotionClientError);
        const notionError = error as NotionClientError;
        expect(notionError.status).toBe(400);
        expect(notionError.code).toBe("validation_error");
        expect(notionError.details).toEqual({
          message: "Invalid request",
          code: "validation_error",
          details: { field: "title" },
        });
      }
    });
  });
});

describe("getNotionClient", () => {
  beforeEach(() => {
    process.env.NOTION_TOKEN = "test-token";
    
    const mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
    };
    mockedAxios.create.mockReturnValue(mockAxiosInstance as unknown as ReturnType<typeof axios.create>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return a NotionClient instance", () => {
    // Reset module to clear singleton
    vi.resetModules();
    
    const client = getNotionClient();
    expect(client).toBeInstanceOf(NotionClient);
  });
});
