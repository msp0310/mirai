import { Suspense } from "react";

import { ToastViewport } from "../../components/ui/ToastViewport";
import { OnboardingTour } from "../../features/onboarding/components/OnboardingTour";
import { tourScenarios } from "../../features/onboarding/tourScenarios";
import type { AppWorkbenchController } from "../AppWorkbench";
import {
  BrabioTaskImportSheet,
  CreateTaskSheet,
  ProjectCreateSheet,
  ProjectImportSheet,
  ResetDraftDialog,
  SaveReviewDialog,
  ShortcutHelpSheet,
  TaskCsvImportSheet,
  TaskInspector,
} from "../workbenchLazyViews";

type WorkbenchOverlaysProps = {
  controller: AppWorkbenchController;
};

/** 現在の業務画面に重なる一時UIと通知を一か所で管理します。 */
export function WorkbenchOverlays({ controller }: WorkbenchOverlaysProps) {
  const {
    activeTab,
    activeTeam,
    activeTourId,
    addProjectAttachment,
    applyPendingProjectImport,
    applyPendingTaskCsvImport,
    calendarAware,
    closeTaskInspector,
    closeTour,
    configChangeReview,
    createProject,
    currentDraftRef,
    deleteProjectAttachment,
    dismissToast,
    importExistingProject,
    lastSavedAt,
    localDraftChangeSummary,
    nextProjectIndex,
    pendingProjectImport,
    pendingTaskCsvImport,
    projectMembers,
    recordActivity,
    resetDraft,
    saveDraft,
    saveScopeLabel,
    schedule,
    selectTaskFromSecondaryView,
    setPendingProjectImport,
    setPendingTaskCsvImport,
    setShowCreateSheet,
    setShowProjectCreateSheet,
    setShowResetConfirm,
    setShowSaveReview,
    setShowShortcutHelp,
    showCreateSheet,
    showMainProjectViews,
    showProjectCreateSheet,
    showResetConfirm,
    showSaveReview,
    showShortcutHelp,
    syncStatus,
    taskActions,
    taskChangeReview,
    taskFocusRequest,
    taskInspectorTask,
    tasks,
    toasts,
    updatePendingTaskCsvMapping,
    workspaceConfigChangeReview,
    workspaceTaskChangeReview,
    hasUnsavedChanges,
  } = controller;

  return (
    <>
      <Suspense fallback={null}>
        {showMainProjectViews && activeTab === "Gantt" ? (
          <TaskInspector
            attachments={schedule.attachments ?? []}
            calendar={schedule.calendar}
            calendarAware={calendarAware}
            canComment={schedule.access?.canComment ?? false}
            focusRequest={taskFocusRequest}
            members={projectMembers}
            onAttachmentAdded={addProjectAttachment}
            onAttachmentDeleted={deleteProjectAttachment}
            onClose={closeTaskInspector}
            onMoveTask={taskActions.moveTask}
            onResizeTask={taskActions.resizeTask}
            onSetTaskDates={taskActions.setTaskDates}
            onTaskActivity={(taskId, title, detail, tone = "info") =>
              recordActivity({ category: "task", detail, taskId, title, tone })
            }
            onUpdateTask={taskActions.updateTask}
            projectId={schedule.project.id}
            task={taskInspectorTask}
            tasks={tasks}
          />
        ) : null}
        {showProjectCreateSheet ? (
          <ProjectCreateSheet
            defaultStartDate={schedule.project.rangeStart}
            nextProjectIndex={nextProjectIndex}
            onClose={() => setShowProjectCreateSheet(false)}
            onCreateProject={createProject}
            team={activeTeam}
          />
        ) : null}
        {pendingProjectImport ? (
          <ProjectImportSheet
            existingProject={importExistingProject}
            fileName={pendingProjectImport.fileName}
            imported={pendingProjectImport.data}
            onClose={() => setPendingProjectImport(null)}
            onImport={applyPendingProjectImport}
            validation={pendingProjectImport.validation}
          />
        ) : null}
        {pendingTaskCsvImport?.sourceKind === "brabio" ? (
          <BrabioTaskImportSheet
            fileName={pendingTaskCsvImport.fileName}
            imported={pendingTaskCsvImport.data}
            members={[...schedule.members, ...pendingTaskCsvImport.membersToCreate]}
            membersToCreate={pendingTaskCsvImport.membersToCreate}
            onClose={() => setPendingTaskCsvImport(null)}
            onImport={applyPendingTaskCsvImport}
            project={schedule.project}
            sourceRows={pendingTaskCsvImport.draft.sourceRows}
            validation={pendingTaskCsvImport.validation}
          />
        ) : pendingTaskCsvImport ? (
          <TaskCsvImportSheet
            draft={pendingTaskCsvImport.draft}
            fileName={pendingTaskCsvImport.fileName}
            imported={pendingTaskCsvImport.data}
            members={[...schedule.members, ...pendingTaskCsvImport.membersToCreate]}
            membersToCreate={pendingTaskCsvImport.membersToCreate}
            onClose={() => setPendingTaskCsvImport(null)}
            onImport={applyPendingTaskCsvImport}
            onMappingChange={updatePendingTaskCsvMapping}
            project={schedule.project}
            validation={pendingTaskCsvImport.validation}
          />
        ) : null}
        {showMainProjectViews && activeTab === "Gantt" && showCreateSheet ? (
          <CreateTaskSheet
            members={projectMembers}
            onClose={() => setShowCreateSheet(false)}
            onCreateTask={taskActions.createTask}
            tasks={tasks}
          />
        ) : null}
        {showShortcutHelp ? <ShortcutHelpSheet onClose={() => setShowShortcutHelp(false)} /> : null}
        {showSaveReview ? (
          <SaveReviewDialog
            configReview={configChangeReview}
            onClose={() => setShowSaveReview(false)}
            onConfirm={(changeReason) => saveDraft(currentDraftRef.current, changeReason)}
            onSelectTask={selectTaskFromSecondaryView}
            project={schedule.project}
            review={taskChangeReview}
            scopeLabel={saveScopeLabel}
          />
        ) : null}
        {showResetConfirm ? (
          <ResetDraftDialog
            apiDetail={syncStatus.detail}
            apiTitle={syncStatus.title}
            configReview={workspaceConfigChangeReview}
            hasUnsavedChanges={hasUnsavedChanges}
            lastSavedAt={lastSavedAt}
            localDraftChangeSummary={localDraftChangeSummary}
            onClose={() => setShowResetConfirm(false)}
            onConfirm={resetDraft}
            project={schedule.project}
            review={workspaceTaskChangeReview}
          />
        ) : null}
      </Suspense>
      <ToastViewport onDismiss={dismissToast} toasts={toasts} />
      {activeTourId ? (
        <OnboardingTour
          onClose={() => closeTour(activeTourId)}
          scenario={tourScenarios[activeTourId]}
        />
      ) : null}
    </>
  );
}
