import { MagnifyingGlassIcon, PlayCircleIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";

import { type HelpDocument, type HelpDocumentId, helpDocuments } from "../../../help/helpDocuments";
import { type TourId, tourScenarios } from "../../onboarding/tourScenarios";

import * as styles from "./HelpPage.css";

type HelpBlock =
  | { level: 1 | 2 | 3; text: string; type: "heading" }
  | { alt: string; src: string; type: "image" }
  | { items: string[]; type: "list" }
  | { text: string; type: "paragraph" };

type HelpPageProps = {
  availableTourIds: TourId[];
  initialDocumentId: HelpDocumentId;
  onStartTour: (tourId: TourId) => void;
};

/** 操作方法と製品の補足情報を表示するヘルプページです。 */
export function HelpPage({ availableTourIds, initialDocumentId, onStartTour }: HelpPageProps) {
  const [activeId, setActiveId] = useState<HelpDocumentId>(initialDocumentId);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setActiveId(initialDocumentId);
    setQuery("");
  }, [initialDocumentId]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredDocuments = useMemo(() => {
    if (!normalizedQuery) {
      return helpDocuments;
    }
    return helpDocuments.filter((document) =>
      [document.title, document.category, document.content]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [normalizedQuery]);
  const activeDocument =
    filteredDocuments.find((document) => document.id === activeId) ??
    filteredDocuments[0] ??
    helpDocuments[0];
  const groupedDocuments = groupByCategory(filteredDocuments);

  return (
    <section className="help-page" aria-label="ヘルプ">
      <header className="help-page-header">
        <div>
          <span>Markdown Help</span>
          <h2>ヘルプ</h2>
        </div>
        <label className="help-search">
          <MagnifyingGlassIcon />
          <input
            aria-label="ヘルプ検索"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="画面名・操作・状態で検索"
            value={query}
          />
        </label>
      </header>

      <section className={styles.tourPanel} aria-label="操作ツアー">
        <div className={styles.tourHeading}>
          <span>画面を見ながら確認</span>
          <strong>操作ツアー</strong>
        </div>
        <div className={styles.tourList}>
          {availableTourIds.map((tourId) => {
            const scenario = tourScenarios[tourId];
            return (
              <button
                className={styles.tourButton}
                key={tourId}
                onClick={() => onStartTour(tourId)}
                title={scenario.description}
                type="button"
              >
                <PlayCircleIcon />
                <span>{scenario.title}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="help-layout">
        <aside className="help-index" aria-label="ヘルプ目次">
          {groupedDocuments.map(([category, documents]) => (
            <div className="help-index-group" key={category}>
              <strong>{category}</strong>
              {documents.map((document) => (
                <button
                  className={document.id === activeDocument.id ? "active" : ""}
                  key={document.id}
                  onClick={() => setActiveId(document.id)}
                  type="button"
                >
                  {document.title}
                </button>
              ))}
            </div>
          ))}
          {filteredDocuments.length === 0 ? (
            <p className="help-index-empty">該当するヘルプはありません。</p>
          ) : null}
        </aside>

        <article className="help-article">
          {activeDocument ? (
            <MarkdownArticle content={activeDocument.content} />
          ) : (
            <p>表示できるヘルプがありません。</p>
          )}
        </article>
      </div>
    </section>
  );
}

function MarkdownArticle({ content }: { content: string }) {
  return (
    <>
      {parseMarkdownBlocks(content).map((block, index) => {
        if (block.type === "heading") {
          return renderHeading(block, `${block.type}-${index}`);
        }
        if (block.type === "image") {
          return (
            <figure className="help-image" key={`${block.type}-${index}`}>
              <img alt={block.alt} src={block.src} />
              <figcaption>{block.alt}</figcaption>
            </figure>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={`${block.type}-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{renderInlineMarkdown(item)}</li>
              ))}
            </ul>
          );
        }
        return <p key={`${block.type}-${index}`}>{renderInlineMarkdown(block.text)}</p>;
      })}
    </>
  );
}

function parseMarkdownBlocks(content: string): HelpBlock[] {
  const blocks: HelpBlock[] = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  let list: string[] = [];

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

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }

    const imageMatch = trimmed.match(/^!\[(.*)]\((.*)\)$/);
    if (imageMatch) {
      flushParagraph();
      flushList();
      blocks.push({ alt: imageMatch[1] ?? "", src: imageMatch[2] ?? "", type: "image" });
      return;
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
      return;
    }

    if (trimmed.startsWith("- ")) {
      flushParagraph();
      list.push(trimmed.slice(2));
      return;
    }

    flushList();
    paragraph.push(trimmed);
  });

  flushParagraph();
  flushList();
  return blocks;
}

function renderHeading(block: Extract<HelpBlock, { type: "heading" }>, key: string) {
  if (block.level === 1) {
    return <h1 key={key}>{renderInlineMarkdown(block.text)}</h1>;
  }
  if (block.level === 2) {
    return <h2 key={key}>{renderInlineMarkdown(block.text)}</h2>;
  }
  return <h3 key={key}>{renderInlineMarkdown(block.text)}</h3>;
}

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={`${part}-${index}`}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function groupByCategory(documents: HelpDocument[]) {
  const groups: [HelpDocument["category"], HelpDocument[]][] = [];
  documents.forEach((document) => {
    const group = groups.find(([category]) => category === document.category);
    if (group) {
      group[1].push(document);
      return;
    }
    groups.push([document.category, [document]]);
  });
  return groups;
}
