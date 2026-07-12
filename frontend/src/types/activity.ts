import type { ActivityCategory, ActivityTone } from "./schedule";

/** 操作履歴へ追加する業務イベントです。 */
export type ActivityInput = {
  category: ActivityCategory;
  detail: string;
  projectId?: string;
  taskId?: string;
  title: string;
  tone?: ActivityTone;
};
