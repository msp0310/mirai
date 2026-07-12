import { useState } from "react";

import type {
  ProjectImportData,
  ProjectImportValidation,
  TaskCsvImportData,
  TaskCsvImportDraft,
} from "../data/scheduleImportExport";
import type { Member } from "../types/schedule";

// 取込データの型は画面本体から切り離し、オーバーレイの状態と一緒に管理します。
export type PendingProjectImport = {
  data: ProjectImportData;
  fileName: string;
  validation: ProjectImportValidation;
};

export type PendingTaskCsvImport = {
  data: TaskCsvImportData | null;
  draft: TaskCsvImportDraft;
  fileName: string;
  membersToCreate: Member[];
  sourceKind: "brabio" | "csv";
  sourceWarnings: string[];
  validation: ProjectImportValidation;
};

/** 案件画面で使うシート・ダイアログ・設定ページの状態をまとめます。 */
export function useWorkbenchOverlays() {
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showHelpPage, setShowHelpPage] = useState(false);
  const [showProjectCreateSheet, setShowProjectCreateSheet] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [showMasterSettings, setShowMasterSettings] = useState(false);
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [showSaveReview, setShowSaveReview] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [pendingProjectImport, setPendingProjectImport] = useState<PendingProjectImport | null>(
    null,
  );
  const [pendingTaskCsvImport, setPendingTaskCsvImport] = useState<PendingTaskCsvImport | null>(
    null,
  );

  return {
    pendingProjectImport,
    pendingTaskCsvImport,
    setPendingProjectImport,
    setPendingTaskCsvImport,
    setShowCreateSheet,
    setShowHelpPage,
    setShowMasterSettings,
    setShowProjectCreateSheet,
    setShowProjectSettings,
    setShowResetConfirm,
    setShowSaveReview,
    setShowShortcutHelp,
    showCreateSheet,
    showHelpPage,
    showMasterSettings,
    showProjectCreateSheet,
    showProjectSettings,
    showResetConfirm,
    showSaveReview,
    showShortcutHelp,
  };
}
