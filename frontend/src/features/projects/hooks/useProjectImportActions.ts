import { type Dispatch, type SetStateAction, useCallback } from "react";

import {
  ProjectImportError,
  type TaskCsvImportMapping,
  createBrabioXlsxImportDraft,
  createTaskCsvImportDraft,
  parseProjectImportJson,
  validateProjectImportData,
} from "../../../data/scheduleImportExport";
import type { ScheduleSnapshot } from "../../../data/scheduleRepository";
import type { ToastInput } from "../../../hooks/useToastQueue";
import type { PendingProjectImport, PendingTaskCsvImport } from "../../../types/projectImport";
import { createPendingTaskImport } from "../lib/projectImportService";

type UseProjectImportActionsOptions = {
  closeCompetingOverlays: () => void;
  onToast: (input: ToastInput) => void;
  schedule: ScheduleSnapshot;
  setPendingProjectImport: Dispatch<SetStateAction<PendingProjectImport | null>>;
  setPendingTaskCsvImport: Dispatch<SetStateAction<PendingTaskCsvImport | null>>;
};

function getImportErrorMessage(error: unknown) {
  return error instanceof ProjectImportError || error instanceof Error
    ? error.message
    : "ファイルの内容を確認してください。";
}

/** JSON、CSV、Brabio XLSXの読込と確認用データの生成を担当します。 */
export function useProjectImportActions({
  closeCompetingOverlays,
  onToast,
  schedule,
  setPendingProjectImport,
  setPendingTaskCsvImport,
}: UseProjectImportActionsOptions) {
  const importProject = useCallback(
    async (file: File) => {
      try {
        const imported = parseProjectImportJson(await file.text());
        setPendingProjectImport({
          data: imported,
          fileName: file.name,
          validation: validateProjectImportData(imported),
        });
        setPendingTaskCsvImport(null);
        closeCompetingOverlays();
      } catch (error) {
        onToast({
          detail: getImportErrorMessage(error),
          title: "JSONを読み込めませんでした",
          tone: "warning",
        });
      }
    },
    [closeCompetingOverlays, onToast, setPendingProjectImport, setPendingTaskCsvImport],
  );

  const importTaskCsv = useCallback(
    async (file: File) => {
      try {
        const draft = createTaskCsvImportDraft(await file.text());
        setPendingTaskCsvImport(
          createPendingTaskImport({
            calendar: schedule.calendar,
            draft,
            fileName: file.name,
            members: schedule.members,
            project: schedule.project,
          }),
        );
        setPendingProjectImport(null);
        closeCompetingOverlays();
      } catch (error) {
        onToast({
          detail: getImportErrorMessage(error),
          title: "CSVを読み込めませんでした",
          tone: "warning",
        });
      }
    },
    [
      closeCompetingOverlays,
      onToast,
      schedule.calendar,
      schedule.members,
      schedule.project,
      setPendingProjectImport,
      setPendingTaskCsvImport,
    ],
  );

  const importBrabioXlsx = useCallback(
    async (file: File) => {
      try {
        const result = await createBrabioXlsxImportDraft(file);
        setPendingTaskCsvImport(
          createPendingTaskImport({
            calendar: schedule.calendar,
            draft: result.draft,
            fileName: file.name,
            members: schedule.members,
            membersToCreate: result.members,
            project: schedule.project,
            sourceKind: "brabio",
            warnings: result.warnings,
          }),
        );
        setPendingProjectImport(null);
        closeCompetingOverlays();
      } catch (error) {
        onToast({
          detail: getImportErrorMessage(error),
          title: "Brabio XLSXを読み込めませんでした",
          tone: "warning",
        });
      }
    },
    [
      closeCompetingOverlays,
      onToast,
      schedule.calendar,
      schedule.members,
      schedule.project,
      setPendingProjectImport,
      setPendingTaskCsvImport,
    ],
  );

  const updatePendingTaskCsvMapping = useCallback(
    (mapping: TaskCsvImportMapping) => {
      setPendingTaskCsvImport((current) => {
        if (!current) {
          return current;
        }
        return createPendingTaskImport({
          calendar: schedule.calendar,
          draft: { ...current.draft, mapping },
          fileName: current.fileName,
          members: schedule.members,
          membersToCreate: current.membersToCreate,
          project: schedule.project,
          sourceKind: current.sourceKind,
          warnings: current.sourceWarnings,
        });
      });
    },
    [schedule.calendar, schedule.members, schedule.project, setPendingTaskCsvImport],
  );

  return {
    importBrabioXlsx,
    importProject,
    importTaskCsv,
    updatePendingTaskCsvMapping,
  };
}
