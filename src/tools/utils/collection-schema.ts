type NotionDatabase = {
  id?: string;
  title?: { plain_text?: string }[];
  properties?: Record<string, unknown>;
};

type NotionDatabaseProperty = {
  id?: string;
  name?: string;
  type?: string;
  [key: string]: unknown;
};

export type CollectionField = {
  name: string;
  type: string;
  options?: string[];
};

export type CollectionSchema = {
  id: string;
  name?: string;
  fields: CollectionField[];
};

export function extractCollectionSchema(database: unknown): CollectionSchema {
  const db = database as NotionDatabase;
  const id = db.id ?? "";
  const name = db.title?.map((t) => t.plain_text ?? "").join("") || undefined;

  const fields: CollectionField[] = [];
  const properties = db.properties ?? {};
  for (const [propName, propValue] of Object.entries(properties)) {
    const property = propValue as NotionDatabaseProperty;
    const type = property.type ?? "unknown";

    const field: CollectionField = { name: propName, type };

    // For select/multi_select, surface options as strings
    if (type === "select") {
      const select = property.select as { options?: { name?: string }[] } | undefined;
      field.options = (select?.options ?? []).map((o) => o.name ?? "").filter(Boolean);
    }

    if (type === "multi_select") {
      const multi = property.multi_select as { options?: { name?: string }[] } | undefined;
      field.options = (multi?.options ?? []).map((o) => o.name ?? "").filter(Boolean);
    }

    if (type === "status") {
      const status = property.status as { options?: { name?: string }[] } | undefined;
      field.options = (status?.options ?? []).map((o) => o.name ?? "").filter(Boolean);
    }

    fields.push(field);
  }

  return { id, name, fields };
}
