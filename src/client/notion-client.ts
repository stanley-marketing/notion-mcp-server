import axios, { AxiosInstance, AxiosError } from "axios";

export class NotionClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "NotionClientError";
  }
}

export class NotionClient {
  private client: AxiosInstance;

  constructor() {
    const token = this.getToken();
    
    this.client = axios.create({
      baseURL: "https://api.notion.com",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
    });
  }

  private getToken(): string {
    const token = process.env.NOTION_TOKEN;
    if (!token) {
      throw new Error("NOTION_TOKEN environment variable is required");
    }
    return token;
  }

  private handleError(error: AxiosError): never {
    if (error.response) {
      const data = error.response.data as Record<string, unknown>;
      throw new NotionClientError(
        (data.message as string) || "Notion API error",
        error.response.status,
        (data.code as string) || "unknown_error",
        data
      );
    }
    throw new NotionClientError(
      error.message || "Network error",
      0,
      "network_error"
    );
  }

  // Pages
  async createPage(params: {
    parent: { database_id?: string; page_id?: string };
    properties: Record<string, unknown>;
    children?: unknown[];
    icon?: unknown;
    cover?: unknown;
  }): Promise<unknown> {
    try {
      const response = await this.client.post("/v1/pages", params);
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  async getPage(pageId: string): Promise<unknown> {
    try {
      const response = await this.client.get(`/v1/pages/${pageId}`);
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  async updatePage(
    pageId: string,
    params: {
      properties?: Record<string, unknown>;
      archived?: boolean;
      icon?: unknown;
      cover?: unknown;
    }
  ): Promise<unknown> {
    try {
      const response = await this.client.patch(`/v1/pages/${pageId}`, params);
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  async archivePage(pageId: string): Promise<unknown> {
    return this.updatePage(pageId, { archived: true });
  }

  // Blocks (for page content)
  async getBlockChildren(blockId: string, startCursor?: string): Promise<unknown> {
    try {
      const params = startCursor ? { start_cursor: startCursor } : {};
      const response = await this.client.get(`/v1/blocks/${blockId}/children`, { params });
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  async appendBlockChildren(blockId: string, children: unknown[]): Promise<unknown> {
    try {
      const response = await this.client.patch(`/v1/blocks/${blockId}/children`, { children });
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  async deleteBlock(blockId: string): Promise<unknown> {
    try {
      const response = await this.client.delete(`/v1/blocks/${blockId}`);
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  // Databases
  async queryDatabase(
    databaseId: string,
    params?: {
      filter?: unknown;
      sorts?: unknown[];
      start_cursor?: string;
      page_size?: number;
    }
  ): Promise<unknown> {
    try {
      const response = await this.client.post(`/v1/databases/${databaseId}/query`, params || {});
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  async getDatabase(databaseId: string): Promise<unknown> {
    try {
      const response = await this.client.get(`/v1/databases/${databaseId}`);
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  async getPagePropertyItem(propertyId: string, startCursor?: string): Promise<unknown> {
    try {
      const params = startCursor ? { start_cursor: startCursor } : {};
      const response = await this.client.get(`/v1/pages/properties/${propertyId}`, { params });
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  // Users
  async listUsers(params?: {
    start_cursor?: string;
    page_size?: number;
  }): Promise<unknown> {
    try {
      const response = await this.client.get("/v1/users", { params: params || {} });
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  // Search
  async search(params: {
    query?: string;
    filter?: { property: "object"; value: "page" | "database" };
    sort?: { direction: "ascending" | "descending"; timestamp: "last_edited_time" };
    start_cursor?: string;
    page_size?: number;
  }): Promise<unknown> {
    try {
      const response = await this.client.post("/v1/search", params);
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }
}

// Singleton instance
let clientInstance: NotionClient | null = null;

export function getNotionClient(): NotionClient {
  if (!clientInstance) {
    clientInstance = new NotionClient();
  }
  return clientInstance;
}
