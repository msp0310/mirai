import { atom, useAtom } from "jotai";

import type { PendingProjectImport, PendingTaskCsvImport } from "../types/projectImport";

const showCreateSheetAtom = atom(false);
const showProjectCreateSheetAtom = atom(false);
const showShortcutHelpAtom = atom(false);
const showSaveReviewAtom = atom(false);
const showResetConfirmAtom = atom(false);
const pendingProjectImportAtom = atom<PendingProjectImport | null>(null);
const pendingTaskCsvImportAtom = atom<PendingTaskCsvImport | null>(null);

/** 案件画面で使うシート・ダイアログ・設定ページの状態をまとめます。 */
export function useWorkbenchOverlays() {
  const [showCreateSheet, setShowCreateSheet] = useAtom(showCreateSheetAtom);
  const [showProjectCreateSheet, setShowProjectCreateSheet] = useAtom(showProjectCreateSheetAtom);
  const [showShortcutHelp, setShowShortcutHelp] = useAtom(showShortcutHelpAtom);
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
    setShowProjectCreateSheet,
    setShowResetConfirm,
    setShowSaveReview,
    setShowShortcutHelp,
    showCreateSheet,
    showProjectCreateSheet,
    showResetConfirm,
    showSaveReview,
    showShortcutHelp,
  };
}
