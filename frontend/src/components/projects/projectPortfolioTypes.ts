import type { ProjectSummary, ScheduleSnapshot } from "../../data/scheduleRepository";
import type {
  Member,
  Project,
  ScheduleTask,
  ProjectLifecycleStatus,
  Team,
} from "../../types/schedule";

export type ProjectPortfolioItem = {
  assignedMembers: Member[];
  completedCount: number;
  delayedTasks: ScheduleTask[];
  favorite: boolean;
  lifecycleStatus: ProjectLifecycleStatus;
  memberCount: number;
  nextMilestone: Pick<ScheduleTask, "start" | "status" | "title">;
  progress: number;
  project: Project;
  taskCount: number;
  team: Team | undefined;
  workDays: number | null;
};

export type ProjectPortfolioBuildInput = {
  calendarAware: boolean;
  favorite: boolean;
  snapshot: ScheduleSnapshot;
  team: Team | undefined;
};

export type ProjectPortfolioSummaryBuildInput = {
  favorite: boolean;
  summary: ProjectSummary;
  team: Team | undefined;
};
