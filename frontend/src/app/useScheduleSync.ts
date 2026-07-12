import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import { apiScheduleRepository } from "../data/apiScheduleRepository";
import { saveLocalScheduleDraft } from "../data/localScheduleStorage";
import type { ScheduleWorkspace } from "../data/scheduleRepository";
import { createDraftSignature } from "./appState";
import type { ApiSyncState, PersistableDraft } from "./appTypes";

type UseScheduleSyncOptions = {
  addToast: (input: {
    detail?: string;
    title: string;
    tone?: "info" | "success" | "warning";
  }) => void;
  apiSyncState: ApiSyncState;
  hasUnsavedChangesRef: MutableRefObject<boolean>;
  requestSaveDraft: () => void;
  saveOperationIdRef: MutableRefObject<number>;
  savedDraftRef: MutableRefObject<PersistableDraft>;
  setApiSyncState: Dispatch<SetStateAction<ApiSyncState>>;
  setLastSavedAt: Dispatch<SetStateAction<string | null>>;
  setSavedSignature: Dispatch<SetStateAction<string>>;
  setSavedWorkspace: Dispatch<SetStateAction<ScheduleWorkspace>>;
  setWorkspace: Dispatch<SetStateAction<ScheduleWorkspace>>;
};

/**
 * Schedule APIへの送信状態と競合時の再送を管理します。
 */
export function useScheduleSync({
  addToast,
  apiSyncState,
  hasUnsavedChangesRef,
  requestSaveDraft,
  saveOperationIdRef,
  savedDraftRef,
  setApiSyncState,
  setLastSavedAt,
  setSavedSignature,
  setSavedWorkspace,
  setWorkspace,
}: UseScheduleSyncOptions) {
  /** 指定時点の案件データをAPIへ送信し、成功した応答を保存基準にします。 */
  async function scheduleApiSync(
    draftToSync: PersistableDraft,
    changeCount: number,
    mode: "save" | "retry" = "save",
    changeReason?: string,
  ) {
    const operationId = saveOperationIdRef.current + 1;
    saveOperationIdRef.current = operationId;
    const queuedChangeCount = Math.max(changeCount, 1);
    const attemptAt = new Date().toISOString();
    setApiSyncState((current) => ({
      ...current,
      error: null,
      lastAttemptAt: attemptAt,
      queuedChangeCount,
      status: "sending",
    }));

    try {
      const result = await apiScheduleRepository.saveWorkspace(
        draftToSync.workspace,
        {
          activeProjectId: draftToSync.activeProjectId,
          activeTeamId: draftToSync.activeTeamId,
          changeReason,
          reason: "manual",
        },
        savedDraftRef.current.workspace,
      );
      if (saveOperationIdRef.current !== operationId) {
        return;
      }
      const successAt = new Date().toISOString();
      const syncedDraft = { ...draftToSync, workspace: result.workspace };
      const saved = saveLocalScheduleDraft(syncedDraft);
      savedDraftRef.current = syncedDraft;
      setWorkspace(result.workspace);
      setLastSavedAt(saved.savedAt);
      setSavedSignature(createDraftSignature(syncedDraft));
      setSavedWorkspace(result.workspace);
      setApiSyncState({
        error: null,
        lastAttemptAt: attemptAt,
        lastSuccessAt: successAt,
        queuedChangeCount: 0,
        status: "synced",
      });
      addToast({
        detail:
          mode === "retry"
            ? `${queuedChangeCount}件をAPIへ再送しました`
            : `${draftToSync.activeProjectId} を ${result.revision} として保存しました`,
        title: "API送信が完了しました",
      });
    } catch (error) {
      if (saveOperationIdRef.current !== operationId) {
        return;
      }
      const errorMessage =
        error instanceof Error ? error.message : "API送信中に不明なエラーが発生しました。";
      setApiSyncState((current) => ({
        ...current,
        error: errorMessage,
        lastAttemptAt: attemptAt,
        queuedChangeCount,
        status: "failed",
      }));
      addToast({
        detail: "変更は未保存のまま画面に保持しています。内容を確認して再送できます。",
        title: "API送信に失敗しました",
        tone: "warning",
      });
    }
  }

  /** 失敗した送信を、現在の未保存内容を失わずに再試行します。 */
  function retryApiSync() {
    if (apiSyncState.status === "sending") {
      return;
    }
    if (hasUnsavedChangesRef.current) {
      requestSaveDraft();
      return;
    }
    if (apiSyncState.status !== "failed") {
      addToast({
        detail: "再送待ちのキューはありません",
        title: "API再送は不要です",
        tone: "info",
      });
      return;
    }
    void scheduleApiSync(savedDraftRef.current, apiSyncState.queuedChangeCount, "retry");
  }

  return { retryApiSync, scheduleApiSync };
}
