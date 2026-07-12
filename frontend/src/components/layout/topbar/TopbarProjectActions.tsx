import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  ShareIcon,
} from "@heroicons/react/24/outline";
import { type ChangeEvent, useRef, useState } from "react";

import type { Project } from "../../../types/schedule";
import type { ExportFormat } from "./types";

type TopbarProjectActionsProps = {
  exportOpen: boolean;
  onClose: () => void;
  onExportProject: (format: ExportFormat) => void;
  onImportBrabioXlsx: (file: File) => void;
  onImportProject: (file: File) => void;
  onImportTaskCsv: (file: File) => void;
  onProjectLinkCopy: (copied: boolean) => void;
  onProjectSettingsOpen: () => void;
  onToggleExport: () => void;
  onToggleShare: () => void;
  project: Project;
  projectSettingsOpen: boolean;
  shareOpen: boolean;
};

/** プロジェクト固有の共有、入出力、設定操作を表示します。 */
export function TopbarProjectActions({
  exportOpen,
  onClose,
  onExportProject,
  onImportBrabioXlsx,
  onImportProject,
  onImportTaskCsv,
  onProjectLinkCopy,
  onProjectSettingsOpen,
  onToggleExport,
  onToggleShare,
  project,
  projectSettingsOpen,
  shareOpen,
}: TopbarProjectActionsProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const projectImportRef = useRef<HTMLInputElement>(null);
  const taskCsvImportRef = useRef<HTMLInputElement>(null);
  const brabioImportRef = useRef<HTMLInputElement>(null);
  const projectUrl =
    typeof window === "undefined"
      ? project.id
      : `${window.location.origin}${window.location.pathname}#${encodeURIComponent(project.id)}`;

  async function copyProjectLink() {
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(projectUrl);
        copied = true;
      }
    } catch {
      copied = false;
    }
    if (!copied) {
      const textarea = document.createElement("textarea");
      textarea.value = projectUrl;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      copied = document.execCommand("copy");
      textarea.remove();
    }
    setCopyStatus(copied ? "copied" : "failed");
    onProjectLinkCopy(copied);
  }

  function importFile(event: ChangeEvent<HTMLInputElement>, onImport: (file: File) => void) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) {
      onImport(file);
      onClose();
    }
  }

  function exportProject(format: ExportFormat) {
    onExportProject(format);
    onClose();
  }

  return (
    <>
      <div className="topbar-action-wrap">
        <button
          className={shareOpen ? "toolbar-button active" : "toolbar-button"}
          onClick={() => {
            setCopyStatus("idle");
            onToggleShare();
          }}
          type="button"
        >
          <ShareIcon />
          共有
        </button>
        {shareOpen ? (
          <div className="topbar-popover share-popover">
            <strong>プロジェクト共有</strong>
            <p>社内共有用のプロジェクトリンクです。</p>
            <input
              className="share-link"
              onFocus={(event) => event.currentTarget.select()}
              readOnly
              title={projectUrl}
              value={projectUrl}
            />
            <button className="primary-button full" onClick={copyProjectLink} type="button">
              {copyStatus === "copied" ? "コピー済み" : "リンクをコピー"}
            </button>
            {copyStatus === "failed" ? (
              <p className="share-error">
                コピー権限がないため、リンク欄を選択してコピーしてください。
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="topbar-action-wrap">
        <button
          className={exportOpen ? "toolbar-button active" : "toolbar-button"}
          onClick={onToggleExport}
          type="button"
        >
          <ArrowDownTrayIcon />
          入出力
          <ChevronDownIcon />
        </button>
        {exportOpen ? (
          <div className="topbar-popover export-popover">
            <strong>入出力</strong>
            <button onClick={() => projectImportRef.current?.click()} type="button">
              <ArrowUpTrayIcon />
              プロジェクトJSONを読み込み
            </button>
            <input
              ref={projectImportRef}
              accept=".json,application/json"
              hidden
              onChange={(event) => importFile(event, onImportProject)}
              type="file"
            />
            <button onClick={() => taskCsvImportRef.current?.click()} type="button">
              <ArrowUpTrayIcon />
              タスクCSVを読み込み
            </button>
            <input
              ref={taskCsvImportRef}
              accept=".csv,text/csv"
              hidden
              onChange={(event) => importFile(event, onImportTaskCsv)}
              type="file"
            />
            <button onClick={() => brabioImportRef.current?.click()} type="button">
              <ArrowUpTrayIcon />
              Brabio XLSXを読み込み
            </button>
            <input
              ref={brabioImportRef}
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              hidden
              onChange={(event) => importFile(event, onImportBrabioXlsx)}
              type="file"
            />
            <button onClick={() => exportProject("csv")} type="button">
              <DocumentTextIcon />
              タスクCSVを書き出し
            </button>
            <button onClick={() => exportProject("json")} type="button">
              <DocumentTextIcon />
              プロジェクトJSONを書き出し
            </button>
          </div>
        ) : null}
      </div>

      <button
        className={projectSettingsOpen ? "icon-button active" : "icon-button"}
        aria-label="設定"
        onClick={() => {
          onClose();
          onProjectSettingsOpen();
        }}
        title="プロジェクト設定"
        type="button"
      >
        <Cog6ToothIcon />
      </button>
    </>
  );
}
