/**
 * Converts markdown text to Notion block objects.
 *
 * Supported syntax:
 *   # heading_1, ## heading_2, ### heading_3 (####+ maps to heading_3)
 *   - / * bulleted_list_item, 1. numbered_list_item
 *   - [ ] / - [x] to_do, > quote, --- divider
 *   ```lang ... ``` code block (unclosed fence extends to EOF)
 *   Inline: **bold**, *italic*, _italic_, ~~strikethrough~~, `code`
 *
 * Rich text segments >2000 chars are split. Blank lines are skipped.
 */

const RICH_TEXT_MAX = 2000;
const BLOCKS_PER_BATCH = 100;

type Annotation = {
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  code?: boolean;
};

type RichTextSegment = {
  type: "text";
  text: { content: string };
  annotations?: Annotation;
};

function hasAnnotation(a: Annotation | undefined): boolean {
  if (!a) return false;
  return Boolean(a.bold || a.italic || a.strikethrough || a.code);
}

function splitSegment(seg: RichTextSegment): RichTextSegment[] {
  const content = seg.text.content;
  if (content.length <= RICH_TEXT_MAX) return [seg];

  const parts: RichTextSegment[] = [];
  for (let i = 0; i < content.length; i += RICH_TEXT_MAX) {
    const chunk = content.slice(i, i + RICH_TEXT_MAX);
    const s: RichTextSegment = { type: "text", text: { content: chunk } };
    if (hasAnnotation(seg.annotations)) {
      s.annotations = { ...seg.annotations };
    }
    parts.push(s);
  }
  return parts;
}

function parseInlineAnnotations(text: string): RichTextSegment[] {
  const segments: RichTextSegment[] = [];

  // Order matters: ** must precede * to avoid partial matches
  const pattern =
    /(\*\*(.+?)\*\*|~~(.+?)~~|`(.+?)`|\*(.+?)\*|_(.+?)_)/;

  let remaining = text;

  while (remaining.length > 0) {
    const match = pattern.exec(remaining);
    if (!match) {
      if (remaining.length > 0) {
        segments.push({ type: "text", text: { content: remaining } });
      }
      break;
    }

    if (match.index > 0) {
      segments.push({
        type: "text",
        text: { content: remaining.slice(0, match.index) },
      });
    }

    if (match[2] !== undefined) {
      segments.push({
        type: "text",
        text: { content: match[2] },
        annotations: { bold: true },
      });
    } else if (match[3] !== undefined) {
      segments.push({
        type: "text",
        text: { content: match[3] },
        annotations: { strikethrough: true },
      });
    } else if (match[4] !== undefined) {
      segments.push({
        type: "text",
        text: { content: match[4] },
        annotations: { code: true },
      });
    } else if (match[5] !== undefined) {
      segments.push({
        type: "text",
        text: { content: match[5] },
        annotations: { italic: true },
      });
    } else if (match[6] !== undefined) {
      segments.push({
        type: "text",
        text: { content: match[6] },
        annotations: { italic: true },
      });
    }

    remaining = remaining.slice(match.index + match[0].length);
  }

  const result: RichTextSegment[] = [];
  for (const seg of segments) {
    result.push(...splitSegment(seg));
  }
  return result;
}

function plainRichText(content: string): RichTextSegment[] {
  if (content.length === 0) return [{ type: "text", text: { content: "" } }];
  return splitSegment({ type: "text", text: { content } });
}

function makeBlock(type: string, payload: Record<string, unknown>): unknown {
  return { object: "block", type, [type]: payload };
}

function richTextBlock(
  type: string,
  richText: RichTextSegment[],
  extra?: Record<string, unknown>
): unknown {
  return makeBlock(type, { rich_text: richText, ...extra });
}

/** Convert a markdown string to an array of Notion block objects. */
export function markdownToBlocks(content: string): unknown[] {
  const trimmed = content.trim();
  if (!trimmed) return [];

  const lines = trimmed.split(/\r?\n/);
  const blocks: unknown[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    const fenceMatch = line.match(/^```(\w*)$/);
    if (fenceMatch) {
      const language = fenceMatch[1] || "plain text";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length) {
        if (lines[i] === "```") {
          i++;
          break;
        }
        codeLines.push(lines[i]);
        i++;
      }
      const codeContent = codeLines.join("\n");
      blocks.push(
        makeBlock("code", {
          rich_text: plainRichText(codeContent),
          language,
        })
      );
      continue;
    }

    const trimmedLine = line.trim();

    if (trimmedLine === "") {
      i++;
      continue;
    }

    if (trimmedLine === "---") {
      blocks.push(makeBlock("divider", {}));
      i++;
      continue;
    }

    const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 3);
      const headingType = `heading_${level}` as string;
      blocks.push(richTextBlock(headingType, parseInlineAnnotations(headingMatch[2])));
      i++;
      continue;
    }

    const todoMatch = trimmedLine.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/);
    if (todoMatch) {
      const checked = todoMatch[1] !== " ";
      blocks.push(
        richTextBlock("to_do", parseInlineAnnotations(todoMatch[2]), { checked })
      );
      i++;
      continue;
    }

    const bulletMatch = trimmedLine.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      blocks.push(
        richTextBlock("bulleted_list_item", parseInlineAnnotations(bulletMatch[1]))
      );
      i++;
      continue;
    }

    const numberedMatch = trimmedLine.match(/^\d+\.\s+(.+)$/);
    if (numberedMatch) {
      blocks.push(
        richTextBlock("numbered_list_item", parseInlineAnnotations(numberedMatch[1]))
      );
      i++;
      continue;
    }

    const quoteMatch = trimmedLine.match(/^>\s+(.+)$/);
    if (quoteMatch) {
      blocks.push(richTextBlock("quote", parseInlineAnnotations(quoteMatch[1])));
      i++;
      continue;
    }

    blocks.push(richTextBlock("paragraph", parseInlineAnnotations(trimmedLine)));
    i++;
  }

  return blocks;
}

/** Convert markdown to Notion blocks, split into batches of <=100 blocks each. */
export function markdownToBlocksBatched(content: string): unknown[][] {
  const blocks = markdownToBlocks(content);
  if (blocks.length === 0) return [];

  const batches: unknown[][] = [];
  for (let i = 0; i < blocks.length; i += BLOCKS_PER_BATCH) {
    batches.push(blocks.slice(i, i + BLOCKS_PER_BATCH));
  }
  return batches;
}
