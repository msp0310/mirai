import { atom, useAtom } from "jotai";

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

const showCreateSheetAtom = atom(false);
const showHelpPageAtom = atom(false);
const showProjectCreateSheetAtom = atom(false);
const showShortcutHelpAtom = atom(false);
const showMasterSettingsAtom = atom(false);
const showProjectSettingsAtom = atom(false);
const showSaveReviewAtom = atom(false);
const showResetConfirmAtom = atom(false);
const pendingProjectImportAtom = atom<PendingProjectImport | null>(null);
const pendingTaskCsvImportAtom = atom<PendingTaskCsvImport | null>(null);

/** 案件画面で使うシート・ダイアログ・設定ページの状態をまとめます。 */
export function useWorkbenchOverlays() {
  const [showCreateSheet, setShowCreateSheet] = useAtom(showCreateSheetAtom);
  const [showHelpPage, setShowHelpPage] = useAtom(showHelpPageAtom);
  const [showProjectCreateSheet, setShowProjectCreateSheet] = useAtom(showProjectCreateSheetAtom);
  const [showShortcutHelp, setShowShortcutHelp] = useAtom(showShortcutHelpAtom);
  const [showMasterSettings, setShowMasterSettings] = useAtom(showMasterSettingsAtom);
  const [showProjectSettings, setShowProjectSettings] = useAtom(showProjectSettingsAtom);
  const [showSaveReview, setShowSaveReview] = useAtom(showSaveReviewAtom);
  const [showResetConfirm, setShowResetConfirm] = useAtom(showResetConfirmAtom);
  const [pendingProjectImport, setPendingProjectImport] = useAtom(pendingProjectImportAtom);
  const [pendingTaskCsvImport, setPendingTaskCsvImport] = useAtom(pendingTaskCsvImportAtom);

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
