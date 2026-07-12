import { todayKey } from "../../features/gantt/components/constants";
import { GanttWorkbench } from "../../features/gantt/components/GanttWorkbench";
import { initialFilters } from "../appState";
import type { AppWorkbenchController } from "../AppWorkbench";
import {
  ActivityPanel,
  AnalysisPanel,
  CalendarPanel,
  MilestonePanel,
  ProjectIssuePanel,
  ResourcePanel,
  SummaryStrip,
  WeeklyReportPanel,
  WorkLogPanel,
} from "../workbenchLazyViews";

type WorkbenchProjectViewsProps = {
  controller: AppWorkbenchController;
};

/** 選択案件のGanttと補助ビューを同じ案件コンテキストへ接続します。 */
export function WorkbenchProjectViews({ controller }: WorkbenchProjectViewsProps) {
  const {
    activeActivityEntries,
    activeFilterCount,
    activeIssues,
    activeTab,
    activeTeam,
    activeTeamReviewSchedules,
    activeWorkLogs,
    addProjectAttachment,
    calendarAware,
    canEditPlan,
    captureBaseline,
    changeTab,
    clearTaskSelection,
    collapsedIds,
    columnVisibility,
    configChangeReview,
    createProjectIssue,
    createProjectWorkLog,
    currentUser,
    deleteProjectAttachment,
    deleteProjectWorkLog,
    displayedResourceRows,
    displayedResourceWeeks,
    filterOpen,
    filters,
    ganttColumns,
    ganttDisplayMode,
    hasUnsavedChanges,
    healthReport,
    openHealthIssue,
    openTaskInspector,
    projectMembers,
    requestSaveDraft,
    resourceDisplaySettings,
    resourceRows,
    resourceScope,
    scale,
    schedule,
    selectTask,
    selectTaskFromSecondaryView,
    selectTaskRange,
    selectedTaskId,
    selectedTaskIds,
    setCalendarAware,
    setColumnVisibility,
    setFilterOpen,
    setFilters,
    setGanttDisplayMode,
    setResourceDisplaySettings,
    setResourceScope,
    setScale,
    setShowCreateSheet,
    setShowShortcutHelp,
    setTimeUnit,
    setTodaySignal,
    showMainProjectViews,
    stats,
    taskActions,
    taskChangeReview,
    taskClipboard,
    taskStartFocusSignal,
    taskTitleEditRequest,
    tasks,
    timeline,
    timeUnit,
    todaySignal,
    toggleCollapsed,
    updateCalendar,
    updateProjectIssue,
    updateProjectWorkLog,
    updateStatusFilter,
    visibleRows,
  } = controller;

  if (!showMainProjectViews) {
    return null;
  }

  return (
    <>
      {activeTab === "Gantt" ? (
        <GanttWorkbench
          activeFilterCount={activeFilterCount}
          calendar={schedule.calendar}
          calendarAware={calendarAware}
          canEditPlan={canEditPlan}
          canPasteTask={taskClipboard !== null}
          collapsedIds={collapsedIds}
          columnVisibility={columnVisibility}
          displayMode={ganttDisplayMode}
          filterOpen={filterOpen}
          filters={filters}
          members={projectMembers}
          months={ganttColumns.primary}
          onAssigneeChange={(assigneeId) => setFilters((current) => ({ ...current, assigneeId }))}
          onBulkAssigneeChange={taskActions.bulkUpdateSelectedAssignee}
          onBulkDateShift={taskActions.shiftSelectedTasksByDays}
          onBulkStatusChange={taskActions.bulkUpdateSelectedStatus}
          onCalendarAwareChange={setCalendarAware}
          onClearSelection={clearTaskSelection}
          onColumnVisibilityChange={setColumnVisibility}
          onCopyTask={taskActions.copySelectedTask}
          onCreateTask={() => setShowCreateSheet(true)}
          onDeleteTask={taskActions.deleteSelectedTasks}
          onDisplayModeChange={setGanttDisplayMode}
          onDuplicateTask={taskActions.duplicateSelectedTask}
          onFilterOpenChange={setFilterOpen}
          onFilterReset={() => setFilters(initialFilters)}
          onIndentTasks={taskActions.indentSelectedTasks}
          onMoveTask={taskActions.moveTask}
          onOpenTaskInspector={openTaskInspector}
          onOutdentTasks={taskActions.outdentSelectedTasks}
          onPasteTask={taskActions.pasteCopiedTask}
          onReorderTasks={taskActions.moveSelectedTaskWithinSiblings}
          onReorderTasksToTarget={taskActions.moveSelectedTasksToSiblingPosition}
          onReparentTasksByDrag={taskActions.moveSelectedTasksToParentPosition}
          onResizeTask={taskActions.resizeTask}
          onScaleChange={setScale}
          onSelectTask={selectTask}
          onSelectTaskRange={selectTaskRange}
          onShortcutHelp={() => setShowShortcutHelp(true)}
          onStatusToggle={updateStatusFilter}
          onTimeUnitChange={setTimeUnit}
          onToday={() => setTodaySignal((value) => value + 1)}
          onToggleCollapsed={toggleCollapsed}
          onUpdateTask={taskActions.updateTask}
          projectRangeEnd={schedule.project.rangeEnd}
          projectRangeStart={schedule.project.rangeStart}
          rows={visibleRows}
          scale={scale}
          selectedTaskCount={selectedTaskIds.size}
          selectedTaskId={selectedTaskId}
          selectedTaskIds={selectedTaskIds}
          tasks={tasks}
          taskStartFocusSignal={taskStartFocusSignal}
          taskTitleEditRequest={taskTitleEditRequest}
          timeline={timeline}
          timeUnit={timeUnit}
          todaySignal={todaySignal}
          weeks={ganttColumns.secondary}
        />
      ) : null}
      {activeTab === "Status" ? (
        <SummaryStrip
          calendar={schedule.calendar}
          calendarAware={calendarAware}
          healthReport={healthReport}
          members={projectMembers}
          onCaptureBaseline={captureBaseline}
          onOpenHealthIssue={openHealthIssue}
          onSelectTask={selectTaskFromSecondaryView}
          project={schedule.project}
          resourceRows={resourceRows}
          stats={stats}
          tasks={tasks}
        />
      ) : null}
      {activeTab === "Analysis" ? (
        <AnalysisPanel
          calendar={schedule.calendar}
          calendarAware={calendarAware}
          changeLogs={schedule.changeLogs ?? []}
          onCaptureBaseline={captureBaseline}
          onSelectTask={selectTaskFromSecondaryView}
          project={schedule.project}
          tasks={tasks}
        />
      ) : null}
      {activeTab === "WeeklyReport" ? (
        <WeeklyReportPanel
          issues={activeIssues}
          members={projectMembers}
          onOpenIssues={() => changeTab("Issues")}
          onSelectTask={selectTaskFromSecondaryView}
          project={schedule.project}
          tasks={tasks}
          todayKey={todayKey}
          workLogs={schedule.workLogs ?? []}
        />
      ) : null}
      {activeTab === "Issues" ? (
        <ProjectIssuePanel
          attachments={schedule.attachments ?? []}
          currentUser={currentUser}
          issues={activeIssues}
          members={projectMembers}
          onAttachmentAdded={addProjectAttachment}
          onAttachmentDeleted={deleteProjectAttachment}
          onCreateIssue={createProjectIssue}
          onSelectTask={selectTaskFromSecondaryView}
          onUpdateIssue={updateProjectIssue}
          project={schedule.project}
          tasks={tasks}
        />
      ) : null}
      {activeTab === "WorkLogs" ? (
        <WorkLogPanel
          attachments={schedule.attachments ?? []}
          currentUser={currentUser}
          issues={activeIssues}
          members={projectMembers}
          onAttachmentAdded={addProjectAttachment}
          onAttachmentDeleted={deleteProjectAttachment}
          onCreateWorkLog={createProjectWorkLog}
          onDeleteWorkLog={deleteProjectWorkLog}
          onSelectTask={selectTaskFromSecondaryView}
          onUpdateWorkLog={updateProjectWorkLog}
          project={schedule.project}
          tasks={tasks}
          workLogs={activeWorkLogs}
        />
      ) : null}
      {activeTab === "Resource" ? (
        <ResourcePanel
          displaySettings={resourceDisplaySettings}
          onDisplaySettingsChange={setResourceDisplaySettings}
          onMoveTask={taskActions.moveTask}
          onScopeChange={setResourceScope}
          onSelectTask={selectTaskFromSecondaryView}
          onShareTask={taskActions.shareTaskWithMember}
          resourceRows={displayedResourceRows}
          scope={resourceScope}
          scopeDescription={
            resourceScope === "team"
              ? `${activeTeam?.name ?? "選択チーム"} / ${activeTeamReviewSchedules.length}案件を横断`
              : `${schedule.project.workspace} / メンバー別週キャパシティ基準`
          }
          scopeLabel={resourceScope === "team" ? "チーム横断" : "このプロジェクト"}
          weeks={displayedResourceWeeks}
        />
      ) : null}
      {activeTab === "Calendar" ? (
        <CalendarPanel
          calendar={schedule.calendar}
          onCalendarChange={updateCalendar}
          onSelectTask={selectTaskFromSecondaryView}
          project={schedule.project}
          tasks={tasks}
        />
      ) : null}
      {activeTab === "Milestones" ? (
        <MilestonePanel
          members={projectMembers}
          onCreateMilestone={taskActions.createMilestone}
          onSelectTask={selectTaskFromSecondaryView}
          onUpdateTask={taskActions.updateTask}
          project={schedule.project}
          tasks={tasks}
        />
      ) : null}
      {activeTab === "Activity" ? (
        <ActivityPanel
          changeReview={taskChangeReview}
          configReview={configChangeReview}
          entries={activeActivityEntries}
          hasUnsavedChanges={hasUnsavedChanges}
          onSaveDraft={requestSaveDraft}
          onSelectTask={selectTaskFromSecondaryView}
          project={schedule.project}
        />
      ) : null}
    </>
  );
}
