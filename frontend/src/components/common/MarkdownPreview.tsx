type MarkdownBlock =
  | { language?: string; text: string; type: "code" }
  | { items: { checked?: boolean; text: string }[]; type: "list" }
  | { level: 1 | 2 | 3; text: string; type: "heading" }
  | { text: string; type: "paragraph" }
  | { text: string; type: "quote" };

/** 最小限のMarkdown記法をアプリの表示ルールに合わせて描画します。 */
export function MarkdownPreview({ content }: { content: string }) {
  return (
    <>
      {parseMarkdown(content).map((block, blockIndex) => {
        const key = `${block.type}-${blockIndex}`;
        if (block.type === "heading") {
          const HeadingTag = `h${block.level}` as "h1" | "h2" | "h3";
          return <HeadingTag key={key}>{renderInlineMarkdown(block.text)}</HeadingTag>;
        }
        if (block.type === "list") {
          return (
            <ul key={key}>
              {block.items.map((item, itemIndex) => (
                <li key={`${item.text}-${itemIndex}`}>
                  {item.checked == null ? null : (
                    <input checked={item.checked} readOnly type="checkbox" />
                  )}
                  <span>{renderInlineMarkdown(item.text)}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === "quote") {
          return <blockquote key={key}>{renderInlineMarkdown(block.text)}</blockquote>;
        }
        if (block.type === "code") {
          return (
            <pre key={key}>
              <code>{block.text}</code>
            </pre>
          );
        }
        return <p key={key}>{renderInlineMarkdown(block.text)}</p>;
      })}
    </>
  );
}

function parseMarkdown(content: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  let list: { checked?: boolean; text: string }[] = [];
  let codeFence: { language?: string; lines: string[] } | null = null;

  function flushParagraph() {
    if (paragraph.length === 0) {
      return;
    }
    blocks.push({ text: paragraph.join(" "), type: "paragraph" });
    paragraph = [];
  }

  function flushList() {
    if (list.length === 0) {
      return;
    }
    blocks.push({ items: list, type: "list" });
    list = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^```(\w+)?$/);

    if (codeFence) {
      if (fenceMatch) {
        blocks.push({
          language: codeFence.language,
          text: codeFence.lines.join("\n"),
          type: "code",
        });
        codeFence = null;
        continue;
      }
      codeFence.lines.push(line);
      continue;
    }

    if (fenceMatch) {
      flushParagraph();
      flushList();
      codeFence = { language: fenceMatch[1], lines: [] };
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const marker = headingMatch[1] ?? "#";
      blocks.push({
        level: marker.length as 1 | 2 | 3,
        text: headingMatch[2] ?? "",
        type: "heading",
      });
      continue;
    }

    if (trimmed.startsWith("> ")) {
      flushParagraph();
      flushList();
      blocks.push({ text: trimmed.slice(2), type: "quote" });
      continue;
    }

    const checklistMatch = trimmed.match(/^[-*]\s+\[( |x|X)]\s+(.+)$/);
    if (checklistMatch) {
      flushParagraph();
      list.push({
        checked: checklistMatch[1]?.toLowerCase() === "x",
        text: checklistMatch[2] ?? "",
      });
      continue;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      flushParagraph();
      list.push({ text: trimmed.slice(2) });
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  if (codeFence) {
    blocks.push({
      language: codeFence.language,
      text: codeFence.lines.join("\n"),
      type: "code",
    });
  }
  flushParagraph();
  flushList();
  return blocks;
}

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\[[^\]]+]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("[") && part.includes("](") && part.endsWith(")")) {
      const match = part.match(/^\[([^\]]+)]\(([^)]+)\)$/);
      const label = match?.[1] ?? part;
      const href = match?.[2] ?? "";
      if (isSafeLink(href)) {
        return (
          <a href={href} key={`${part}-${index}`} rel="noreferrer" target="_blank">
            {label}
          </a>
        );
      }
      return label;
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={`${part}-${index}`}>{part.slice(1, -1)}</code>;
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }

    return part;
  });
}

function isSafeLink(href: string) {
  return href.startsWith("https://") || href.startsWith("http://") || href.startsWith("#");
}
