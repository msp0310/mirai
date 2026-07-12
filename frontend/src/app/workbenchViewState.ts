import { atom, createStore, useAtom } from "jotai";

import type { ViewTab } from "../components/layout/ViewTabs";
import type { TourId } from "../features/onboarding/tourScenarios";
import type {
  GanttColumnVisibility,
  GanttScale,
  GanttTimeUnit,
  ResourceDisplaySettings,
  ResourceScope,
  ScheduleFilters,
} from "../types/schedule";

export type GanttDisplayMode = "gantt" | "table";
export type TaskTitleEditRequest = { requestId: number; taskId: string | null };
export type WorkbenchViewInitialState = {
  activeProjectId: string;
  activeTab: ViewTab;
  activeTeamId: string;
  calendarAware: boolean;
  collapsedIdsByProject: Record<string, string[]>;
  columnVisibility: GanttColumnVisibility;
  filterOpen: boolean;
  filters: ScheduleFilters;
  resourceDisplaySettings: ResourceDisplaySettings;
  resourceScope: ResourceScope;
  scale: GanttScale;
  timeUnit: GanttTimeUnit;
};

const activeTeamIdAtom = atom("");
const activeProjectIdAtom = atom("");
const activeTabAtom = atom<ViewTab>("Projects");
const activeTourIdAtom = atom<TourId | null>(null);
const filtersAtom = atom<ScheduleFilters>({
  assigneeId: "all",
  query: "",
  statuses: { delayed: true, done: true, inProgress: true, notStarted: true },
});
const collapsedIdsByProjectAtom = atom<Record<string, string[]>>({});
const filterOpenAtom = atom(false);
const calendarAwareAtom = atom(true);
const columnVisibilityAtom = atom<GanttColumnVisibility>({
  assignee: false,
  progress: false,
  status: true,
});
const scaleAtom = atom<GanttScale>("normal");
const resourceDisplaySettingsAtom = atom<ResourceDisplaySettings>({
  compact: false,
  showHours: true,
  showPercent: true,
  warningThreshold: 100,
});
const resourceScopeAtom = atom<ResourceScope>("project");
const timeUnitAtom = atom<GanttTimeUnit>("day");
const ganttDisplayModeAtom = atom<GanttDisplayMode>("gantt");
const todaySignalAtom = atom(0);
const taskStartFocusSignalAtom = atom(0);
const taskTitleEditRequestAtom = atom<TaskTitleEditRequest>({ requestId: 0, taskId: null });

/** ワークベンチごとに独立した画面状態ストアを生成します。 */
export function createWorkbenchViewStore(initialState: WorkbenchViewInitialState) {
  const store = createStore();
  store.set(activeTeamIdAtom, initialState.activeTeamId);
  store.set(activeProjectIdAtom, initialState.activeProjectId);
  store.set(activeTabAtom, initialState.activeTab);
  store.set(filtersAtom, initialState.filters);
  store.set(collapsedIdsByProjectAtom, initialState.collapsedIdsByProject);
  store.set(filterOpenAtom, initialState.filterOpen);
  store.set(calendarAwareAtom, initialState.calendarAware);
  store.set(columnVisibilityAtom, initialState.columnVisibility);
  store.set(scaleAtom, initialState.scale);
  store.set(resourceDisplaySettingsAtom, initialState.resourceDisplaySettings);
  store.set(resourceScopeAtom, initialState.resourceScope);
  store.set(timeUnitAtom, initialState.timeUnit);
  return store;
}

/** AppWorkbenchから画面状態をまとめて取得する移行用フックです。 */
export function useWorkbenchViewState() {
  const [activeTeamId, setActiveTeamId] = useAtom(activeTeamIdAtom);
  const [activeProjectId, setActiveProjectId] = useAtom(activeProjectIdAtom);
  const [activeTab, setActiveTab] = useAtom(activeTabAtom);
  const [activeTourId, setActiveTourId] = useAtom(activeTourIdAtom);
  const [filters, setFilters] = useAtom(filtersAtom);
  const [collapsedIdsByProject, setCollapsedIdsByProject] = useAtom(collapsedIdsByProjectAtom);
  const [filterOpen, setFilterOpen] = useAtom(filterOpenAtom);
  const [calendarAware, setCalendarAware] = useAtom(calendarAwareAtom);
  const [columnVisibility, setColumnVisibility] = useAtom(columnVisibilityAtom);
  const [scale, setScale] = useAtom(scaleAtom);
  const [resourceDisplaySettings, setResourceDisplaySettings] = useAtom(
    resourceDisplaySettingsAtom,
  );
  const [resourceScope, setResourceScope] = useAtom(resourceScopeAtom);
  const [timeUnit, setTimeUnit] = useAtom(timeUnitAtom);
  const [ganttDisplayMode, setGanttDisplayMode] = useAtom(ganttDisplayModeAtom);
  const [todaySignal, setTodaySignal] = useAtom(todaySignalAtom);
  const [taskStartFocusSignal, setTaskStartFocusSignal] = useAtom(taskStartFocusSignalAtom);
  const [taskTitleEditRequest, setTaskTitleEditRequest] = useAtom(taskTitleEditRequestAtom);

  return {
    activeProjectId,
    activeTab,
    activeTeamId,
    activeTourId,
    calendarAware,
    collapsedIdsByProject,
    columnVisibility,
    filterOpen,
    filters,
    ganttDisplayMode,
    resourceDisplaySettings,
    resourceScope,
    scale,
    setActiveProjectId,
    setActiveTab,
    setActiveTeamId,
    setActiveTourId,
    setCalendarAware,
    setCollapsedIdsByProject,
    setColumnVisibility,
    setFilterOpen,
    setFilters,
    setGanttDisplayMode,
    setResourceDisplaySettings,
    setResourceScope,
    setScale,
    setTaskStartFocusSignal,
    setTaskTitleEditRequest,
    setTimeUnit,
    setTodaySignal,
    taskStartFocusSignal,
    taskTitleEditRequest,
    timeUnit,
    todaySignal,
  };
}

/** ストア分離と初期化をテストするためのAtom参照です。 */
export const workbenchViewAtoms = {
  activeProjectId: activeProjectIdAtom,
  activeTab: activeTabAtom,
  activeTeamId: activeTeamIdAtom,
  calendarAware: calendarAwareAtom,
  filters: filtersAtom,
};
