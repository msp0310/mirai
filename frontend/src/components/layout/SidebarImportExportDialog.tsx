import { ArrowDownTrayIcon, ArrowUpTrayIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { type ChangeEvent, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import type { ExportFormat } from "./topbar/types";

import * as styles from "./Sidebar.css";

type SidebarImportExportDialogProps = {
  onClose: () => void;
  onExportProject: (format: ExportFormat) => void;
  onImportBrabioXlsx: (file: File) => void;
  onImportProject: (file: File) => void;
  onImportTaskCsv: (file: File) => void;
};

/** 案件データの読み込みと書き出しを選択するダイアログです。 */
export function SidebarImportExportDialog({
  onClose,
  onExportProject,
  onImportBrabioXlsx,
  onImportProject,
  onImportTaskCsv,
}: SidebarImportExportDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const projectImportRef = useRef<HTMLInputElement>(null);
  const taskCsvImportRef = useRef<HTMLInputElement>(null);
  const brabioImportRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

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

  return createPortal(
    <div
      className={styles.importExportOverlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <section
        aria-label="入出力"
        aria-modal="true"
        className={styles.importExportDialog}
        role="dialog"
      >
        <header className={styles.importExportHeader}>
          <div>
            <strong>入出力</strong>
            <span>案件データの読み込み・書き出しを行います。</span>
          </div>
          <button
            ref={closeButtonRef}
            aria-label="閉じる"
            className={styles.importExportClose}
            onClick={onClose}
            type="button"
          >
            <XMarkIcon />
          </button>
        </header>

        <section className={styles.importExportSection} aria-label="読み込み">
          <strong>読み込み</strong>
          <div className={styles.importExportActions}>
            <ActionButton
              detail="案件・タスク・要員をまとめて読み込み"
              label="案件JSON"
              onClick={() => projectImportRef.current?.click()}
              type="import"
            />
            <input
              ref={projectImportRef}
              accept=".json,application/json"
              hidden
              onChange={(event) => importFile(event, onImportProject)}
              type="file"
            />
            <ActionButton
              detail="タスク一覧をCSVから読み込み"
              label="タスクCSV"
              onClick={() => taskCsvImportRef.current?.click()}
              type="import"
            />
            <input
              ref={taskCsvImportRef}
              accept=".csv,text/csv"
              hidden
              onChange={(event) => importFile(event, onImportTaskCsv)}
              type="file"
            />
            <ActionButton
              detail="BrabioのExcelファイルを読み込み"
              label="Brabio XLSX"
              onClick={() => brabioImportRef.current?.click()}
              type="import"
            />
            <input
              ref={brabioImportRef}
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              hidden
              onChange={(event) => importFile(event, onImportBrabioXlsx)}
              type="file"
            />
          </div>
        </section>

        <section className={styles.importExportSection} aria-label="書き出し">
          <strong>書き出し</strong>
          <div className={styles.importExportActions}>
            <ActionButton
              detail="タスク一覧をCSV形式で保存"
              label="タスクCSV"
              onClick={() => exportProject("csv")}
              type="export"
            />
            <ActionButton
              detail="案件データ一式をJSON形式で保存"
              label="案件JSON"
              onClick={() => exportProject("json")}
              type="export"
            />
          </div>
        </section>
      </section>
    </div>,
    document.body,
  );
}

type ActionButtonProps = {
  detail: string;
  label: string;
  onClick: () => void;
  type: "export" | "import";
};

function ActionButton({ detail, label, onClick, type }: ActionButtonProps) {
  const Icon = type === "import" ? ArrowUpTrayIcon : ArrowDownTrayIcon;
  return (
    <button className={styles.importExportAction} onClick={onClick} type="button">
      <Icon />
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
    </button>
  );
}
