import type {
  ProjectImportData,
  ProjectImportValidation,
  TaskCsvImportData,
  TaskCsvImportDraft,
} from "../../../data/scheduleImportExport";
import type { Member } from "../../../types/schedule";

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

export type TaskCsvImportOptions = {
  expandProjectRange: boolean;
};
