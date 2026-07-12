import { EyeIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import { useState } from "react";

import { MarkdownPreview } from "../../../components/common/MarkdownPreview";

import * as styles from "./DailyReportPage.css";

type DailyReportMarkdownFieldProps = {
  label: string;
  onChange: (value: string) => void;
  readOnly: boolean;
  value: string;
};

/** 日報で共通利用するMarkdown編集・プレビュー欄です。 */
export function DailyReportMarkdownField({
  label,
  onChange,
  readOnly,
  value,
}: DailyReportMarkdownFieldProps) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  return (
    <section className={styles.markdownField}>
      <header className={styles.markdownHeader}>
        <strong>{label}</strong>
        <div className={styles.modeSwitch}>
          <button
            className={mode === "edit" ? styles.modeActive : ""}
            onClick={() => setMode("edit")}
            type="button"
          >
            <PencilSquareIcon />
            編集
          </button>
          <button
            className={mode === "preview" ? styles.modeActive : ""}
            onClick={() => setMode("preview")}
            type="button"
          >
            <EyeIcon />
            プレビュー
          </button>
        </div>
      </header>
      {mode === "edit" ? (
        <textarea
          aria-label={label}
          disabled={readOnly}
          onChange={(event) => onChange(event.target.value)}
          placeholder={`${label}をMarkdownで入力`}
          value={value}
        />
      ) : (
        <div className={styles.preview}>
          <MarkdownPreview content={value || "_未入力_"} />
        </div>
      )}
    </section>
  );
}
