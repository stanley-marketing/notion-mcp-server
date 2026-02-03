import { describe, it, expect } from "vitest";
import {
  markdownToBlocks,
  markdownToBlocksBatched,
} from "../utils/markdown-to-blocks.js";

type AnyBlock = Record<string, unknown>;
type RichText = { type: string; text: { content: string }; annotations?: Record<string, boolean> };

function getRichText(block: AnyBlock): RichText[] {
  const type = block.type as string;
  const payload = block[type] as Record<string, unknown>;
  return payload.rich_text as RichText[];
}

function getPlainText(block: AnyBlock): string {
  return getRichText(block).map((rt) => rt.text.content).join("");
}

describe("markdownToBlocks", () => {
  describe("empty / whitespace input", () => {
    it("returns empty array for empty string", () => {
      expect(markdownToBlocks("")).toEqual([]);
    });

    it("returns empty array for whitespace-only", () => {
      expect(markdownToBlocks("   \n\n  ")).toEqual([]);
    });
  });

  describe("paragraphs", () => {
    it("converts plain text to paragraph block", () => {
      const blocks = markdownToBlocks("Hello world") as AnyBlock[];
      expect(blocks).toHaveLength(1);
      expect(blocks[0].object).toBe("block");
      expect(blocks[0].type).toBe("paragraph");
      expect(getPlainText(blocks[0])).toBe("Hello world");
    });

    it("skips blank lines between paragraphs", () => {
      const blocks = markdownToBlocks("Line one\n\nLine two") as AnyBlock[];
      expect(blocks).toHaveLength(2);
      expect(getPlainText(blocks[0])).toBe("Line one");
      expect(getPlainText(blocks[1])).toBe("Line two");
    });
  });

  describe("headings", () => {
    it("converts # to heading_1", () => {
      const blocks = markdownToBlocks("# Title") as AnyBlock[];
      expect(blocks[0].type).toBe("heading_1");
      expect(getPlainText(blocks[0])).toBe("Title");
    });

    it("converts ## to heading_2", () => {
      const blocks = markdownToBlocks("## Subtitle") as AnyBlock[];
      expect(blocks[0].type).toBe("heading_2");
      expect(getPlainText(blocks[0])).toBe("Subtitle");
    });

    it("converts ### to heading_3", () => {
      const blocks = markdownToBlocks("### Section") as AnyBlock[];
      expect(blocks[0].type).toBe("heading_3");
      expect(getPlainText(blocks[0])).toBe("Section");
    });

    it("maps #### and deeper to heading_3", () => {
      const blocks4 = markdownToBlocks("#### Deep") as AnyBlock[];
      expect(blocks4[0].type).toBe("heading_3");

      const blocks6 = markdownToBlocks("###### Very deep") as AnyBlock[];
      expect(blocks6[0].type).toBe("heading_3");
    });

    it("requires space after # (otherwise paragraph)", () => {
      const blocks = markdownToBlocks("#NoSpace") as AnyBlock[];
      expect(blocks[0].type).toBe("paragraph");
    });
  });

  describe("bulleted list", () => {
    it("converts - item to bulleted_list_item", () => {
      const blocks = markdownToBlocks("- Item one") as AnyBlock[];
      expect(blocks[0].type).toBe("bulleted_list_item");
      expect(getPlainText(blocks[0])).toBe("Item one");
    });

    it("converts * item to bulleted_list_item", () => {
      const blocks = markdownToBlocks("* Item two") as AnyBlock[];
      expect(blocks[0].type).toBe("bulleted_list_item");
      expect(getPlainText(blocks[0])).toBe("Item two");
    });
  });

  describe("numbered list", () => {
    it("converts 1. item to numbered_list_item", () => {
      const blocks = markdownToBlocks("1. First") as AnyBlock[];
      expect(blocks[0].type).toBe("numbered_list_item");
      expect(getPlainText(blocks[0])).toBe("First");
    });

    it("handles multi-digit numbers", () => {
      const blocks = markdownToBlocks("42. Answer") as AnyBlock[];
      expect(blocks[0].type).toBe("numbered_list_item");
      expect(getPlainText(blocks[0])).toBe("Answer");
    });
  });

  describe("to_do", () => {
    it("converts - [ ] to unchecked to_do", () => {
      const blocks = markdownToBlocks("- [ ] Task") as AnyBlock[];
      expect(blocks[0].type).toBe("to_do");
      expect(getPlainText(blocks[0])).toBe("Task");
      const payload = (blocks[0] as AnyBlock).to_do as Record<string, unknown>;
      expect(payload.checked).toBe(false);
    });

    it("converts - [x] to checked to_do", () => {
      const blocks = markdownToBlocks("- [x] Done") as AnyBlock[];
      const payload = (blocks[0] as AnyBlock).to_do as Record<string, unknown>;
      expect(payload.checked).toBe(true);
    });

    it("converts - [X] to checked to_do", () => {
      const blocks = markdownToBlocks("- [X] Also done") as AnyBlock[];
      const payload = (blocks[0] as AnyBlock).to_do as Record<string, unknown>;
      expect(payload.checked).toBe(true);
    });
  });

  describe("code blocks", () => {
    it("converts fenced code block with language", () => {
      const md = "```typescript\nconst x = 1;\n```";
      const blocks = markdownToBlocks(md) as AnyBlock[];
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe("code");
      const payload = blocks[0].code as Record<string, unknown>;
      expect(payload.language).toBe("typescript");
      expect((payload.rich_text as RichText[])[0].text.content).toBe("const x = 1;");
    });

    it("defaults to 'plain text' when no language specified", () => {
      const md = "```\nhello\n```";
      const blocks = markdownToBlocks(md) as AnyBlock[];
      const payload = blocks[0].code as Record<string, unknown>;
      expect(payload.language).toBe("plain text");
    });

    it("handles unclosed code fence (extends to EOF)", () => {
      const md = "```python\nprint('hi')\nmore code";
      const blocks = markdownToBlocks(md) as AnyBlock[];
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe("code");
      const payload = blocks[0].code as Record<string, unknown>;
      expect((payload.rich_text as RichText[])[0].text.content).toBe(
        "print('hi')\nmore code"
      );
    });

    it("preserves blank lines inside code blocks", () => {
      const md = "```\nline1\n\nline3\n```";
      const blocks = markdownToBlocks(md) as AnyBlock[];
      const payload = blocks[0].code as Record<string, unknown>;
      expect((payload.rich_text as RichText[])[0].text.content).toBe(
        "line1\n\nline3"
      );
    });
  });

  describe("quotes", () => {
    it("converts > text to quote block", () => {
      const blocks = markdownToBlocks("> Important note") as AnyBlock[];
      expect(blocks[0].type).toBe("quote");
      expect(getPlainText(blocks[0])).toBe("Important note");
    });
  });

  describe("dividers", () => {
    it("converts --- to divider block", () => {
      const blocks = markdownToBlocks("---") as AnyBlock[];
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe("divider");
      expect(blocks[0].object).toBe("block");
    });

    it("does not treat ---- (4 dashes) as divider", () => {
      const blocks = markdownToBlocks("----") as AnyBlock[];
      expect(blocks[0].type).toBe("paragraph");
    });
  });

  describe("inline annotations", () => {
    it("parses **bold**", () => {
      const blocks = markdownToBlocks("Hello **world**") as AnyBlock[];
      const rt = getRichText(blocks[0]);
      expect(rt).toHaveLength(2);
      expect(rt[0].text.content).toBe("Hello ");
      expect(rt[0].annotations).toBeUndefined();
      expect(rt[1].text.content).toBe("world");
      expect(rt[1].annotations?.bold).toBe(true);
    });

    it("parses *italic*", () => {
      const blocks = markdownToBlocks("*emphasis*") as AnyBlock[];
      const rt = getRichText(blocks[0]);
      expect(rt[0].text.content).toBe("emphasis");
      expect(rt[0].annotations?.italic).toBe(true);
    });

    it("parses _italic_", () => {
      const blocks = markdownToBlocks("_underscored_") as AnyBlock[];
      const rt = getRichText(blocks[0]);
      expect(rt[0].text.content).toBe("underscored");
      expect(rt[0].annotations?.italic).toBe(true);
    });

    it("parses ~~strikethrough~~", () => {
      const blocks = markdownToBlocks("~~deleted~~") as AnyBlock[];
      const rt = getRichText(blocks[0]);
      expect(rt[0].text.content).toBe("deleted");
      expect(rt[0].annotations?.strikethrough).toBe(true);
    });

    it("parses `inline code`", () => {
      const blocks = markdownToBlocks("Use `console.log`") as AnyBlock[];
      const rt = getRichText(blocks[0]);
      expect(rt).toHaveLength(2);
      expect(rt[0].text.content).toBe("Use ");
      expect(rt[1].text.content).toBe("console.log");
      expect(rt[1].annotations?.code).toBe(true);
    });

    it("handles multiple annotations in one line", () => {
      const blocks = markdownToBlocks("**bold** and *italic*") as AnyBlock[];
      const rt = getRichText(blocks[0]);
      expect(rt).toHaveLength(3);
      expect(rt[0].text.content).toBe("bold");
      expect(rt[0].annotations?.bold).toBe(true);
      expect(rt[1].text.content).toBe(" and ");
      expect(rt[2].text.content).toBe("italic");
      expect(rt[2].annotations?.italic).toBe(true);
    });

    it("applies inline annotations inside headings", () => {
      const blocks = markdownToBlocks("## A **bold** heading") as AnyBlock[];
      expect(blocks[0].type).toBe("heading_2");
      const rt = getRichText(blocks[0]);
      expect(rt).toHaveLength(3);
      expect(rt[1].text.content).toBe("bold");
      expect(rt[1].annotations?.bold).toBe(true);
    });

    it("applies inline annotations inside list items", () => {
      const blocks = markdownToBlocks("- A *styled* item") as AnyBlock[];
      const rt = getRichText(blocks[0]);
      expect(rt).toHaveLength(3);
      expect(rt[1].text.content).toBe("styled");
      expect(rt[1].annotations?.italic).toBe(true);
    });
  });

  describe("rich text >2000 char splitting", () => {
    it("splits long plain text into multiple segments", () => {
      const longText = "a".repeat(4500);
      const blocks = markdownToBlocks(longText) as AnyBlock[];
      const rt = getRichText(blocks[0]);
      expect(rt).toHaveLength(3);
      expect(rt[0].text.content.length).toBe(2000);
      expect(rt[1].text.content.length).toBe(2000);
      expect(rt[2].text.content.length).toBe(500);
    });

    it("splits long annotated text preserving annotations", () => {
      const longBold = "**" + "b".repeat(4500) + "**";
      const blocks = markdownToBlocks(longBold) as AnyBlock[];
      const rt = getRichText(blocks[0]);
      expect(rt).toHaveLength(3);
      for (const seg of rt) {
        expect(seg.annotations?.bold).toBe(true);
      }
      expect(rt[0].text.content.length).toBe(2000);
      expect(rt[1].text.content.length).toBe(2000);
      expect(rt[2].text.content.length).toBe(500);
    });

    it("splits long code block content", () => {
      const longCode = "x".repeat(5000);
      const md = "```js\n" + longCode + "\n```";
      const blocks = markdownToBlocks(md) as AnyBlock[];
      const payload = blocks[0].code as Record<string, unknown>;
      const rt = payload.rich_text as RichText[];
      expect(rt).toHaveLength(3);
      expect(rt[0].text.content.length).toBe(2000);
    });
  });

  describe("mixed content", () => {
    it("handles a realistic markdown document", () => {
      const md = [
        "# My Document",
        "",
        "Some intro text.",
        "",
        "## Section One",
        "",
        "- Item A",
        "- Item B",
        "",
        "1. Step one",
        "2. Step two",
        "",
        "- [ ] Todo unchecked",
        "- [x] Todo checked",
        "",
        "> A quote",
        "",
        "---",
        "",
        "```python",
        "print('hello')",
        "```",
        "",
        "Final paragraph with **bold** text.",
      ].join("\n");

      const blocks = markdownToBlocks(md) as AnyBlock[];
      expect(blocks).toHaveLength(13);

      expect(blocks[0].type).toBe("heading_1");
      expect(blocks[1].type).toBe("paragraph");
      expect(blocks[2].type).toBe("heading_2");
      expect(blocks[3].type).toBe("bulleted_list_item");
      expect(blocks[4].type).toBe("bulleted_list_item");
      expect(blocks[5].type).toBe("numbered_list_item");
      expect(blocks[6].type).toBe("numbered_list_item");
      expect(blocks[7].type).toBe("to_do");
      expect(blocks[8].type).toBe("to_do");
      expect(blocks[9].type).toBe("quote");
      expect(blocks[10].type).toBe("divider");
      expect(blocks[11].type).toBe("code");
      expect(blocks[12].type).toBe("paragraph");
    });
  });

  describe("block structure", () => {
    it("every block has object: 'block' and type field", () => {
      const md = "# H\n- item\n1. num\n- [ ] todo\n> quote\n---\n```\ncode\n```\nplain";
      const blocks = markdownToBlocks(md) as AnyBlock[];
      for (const block of blocks) {
        expect(block.object).toBe("block");
        expect(typeof block.type).toBe("string");
      }
    });

    it("each block has its type as a key with payload", () => {
      const blocks = markdownToBlocks("# Heading\n- Bullet") as AnyBlock[];
      expect(blocks[0]).toHaveProperty("heading_1");
      expect(blocks[1]).toHaveProperty("bulleted_list_item");
    });
  });

  describe("CRLF handling", () => {
    it("handles Windows-style line endings", () => {
      const blocks = markdownToBlocks("# Title\r\n\r\nParagraph") as AnyBlock[];
      expect(blocks).toHaveLength(2);
      expect(blocks[0].type).toBe("heading_1");
      expect(blocks[1].type).toBe("paragraph");
    });
  });
});

describe("markdownToBlocksBatched", () => {
  it("returns empty array for empty input", () => {
    expect(markdownToBlocksBatched("")).toEqual([]);
  });

  it("returns single batch for <=100 blocks", () => {
    const lines = Array.from({ length: 50 }, (_, i) => `Line ${i}`).join("\n");
    const batches = markdownToBlocksBatched(lines);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(50);
  });

  it("splits into multiple batches at 100-block boundary", () => {
    const lines = Array.from({ length: 250 }, (_, i) => `Line ${i}`).join("\n");
    const batches = markdownToBlocksBatched(lines);
    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(100);
    expect(batches[1]).toHaveLength(100);
    expect(batches[2]).toHaveLength(50);
  });

  it("exactly 100 blocks produces single batch", () => {
    const lines = Array.from({ length: 100 }, (_, i) => `Line ${i}`).join("\n");
    const batches = markdownToBlocksBatched(lines);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(100);
  });

  it("101 blocks produces two batches", () => {
    const lines = Array.from({ length: 101 }, (_, i) => `Line ${i}`).join("\n");
    const batches = markdownToBlocksBatched(lines);
    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(100);
    expect(batches[1]).toHaveLength(1);
  });
});
