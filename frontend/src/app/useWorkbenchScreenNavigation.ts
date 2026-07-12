import { useCallback, useState } from "react";

import type { ViewTab } from "../components/layout/ViewTabs";
import { getTourCompletionKey, type TourId } from "../features/onboarding/tourScenarios";
import type { HelpDocumentId } from "../help/helpDocuments";

type UseWorkbenchScreenNavigationOptions = {
  activeTab: ViewTab;
  clearTaskSelection: () => void;
  closeTaskInspector: () => void;
  currentUserEmail: string;
  navigateToHelp: () => unknown;
  navigateToManagementSettings: () => unknown;
  navigateToProjectSettings: () => unknown;
  setActiveTab: (tab: ViewTab) => unknown;
  setActiveTourId: (tourId: TourId | null) => void;
  setFilterOpen: (open: boolean) => void;
  setPendingProjectImport: (value: null) => void;
  setPendingTaskCsvImport: (value: null) => void;
  setShowCreateSheet: (open: boolean) => void;
  setShowProjectCreateSheet: (open: boolean) => void;
  setShowShortcutHelp: (open: boolean) => void;
  showMasterSettings: boolean;
  showProjectSettings: boolean;
};

/** タブ、設定、ヘルプ、操作ツアーの画面遷移と競合UIの終了を管理します。 */
export function useWorkbenchScreenNavigation({
  activeTab,
  clearTaskSelection,
  closeTaskInspector,
  currentUserEmail,
  navigateToHelp,
  navigateToManagementSettings,
  navigateToProjectSettings,
  setActiveTab,
  setActiveTourId,
  setFilterOpen,
  setPendingProjectImport,
  setPendingTaskCsvImport,
  setShowCreateSheet,
  setShowProjectCreateSheet,
  setShowShortcutHelp,
  showMasterSettings,
  showProjectSettings,
}: UseWorkbenchScreenNavigationOptions) {
  const [helpDocumentId, setHelpDocumentId] = useState<HelpDocumentId>(() =>
    getContextHelpDocumentId(activeTab, false, false),
  );

  const closeTransientUi = useCallback(() => {
    setPendingProjectImport(null);
    setPendingTaskCsvImport(null);
    setShowCreateSheet(false);
    setShowProjectCreateSheet(false);
    setShowShortcutHelp(false);
  }, [
    setPendingProjectImport,
    setPendingTaskCsvImport,
    setShowCreateSheet,
    setShowProjectCreateSheet,
    setShowShortcutHelp,
  ]);

  const changeTab = useCallback(
    (tab: ViewTab) => {
      void setActiveTab(tab);
      clearTaskSelection();
      closeTransientUi();
    },
    [clearTaskSelection, closeTransientUi, setActiveTab],
  );

  const openMasterSettings = useCallback(() => {
    closeTaskInspector();
    clearTaskSelection();
    setFilterOpen(false);
    closeTransientUi();
    void navigateToManagementSettings();
  }, [
    clearTaskSelection,
    closeTaskInspector,
    closeTransientUi,
    navigateToManagementSettings,
    setFilterOpen,
  ]);

  const openProjectSettings = useCallback(() => {
    closeTransientUi();
    void navigateToProjectSettings();
  }, [closeTransientUi, navigateToProjectSettings]);

  const openProjectCreateSheet = useCallback(() => {
    setPendingProjectImport(null);
    setPendingTaskCsvImport(null);
    setShowCreateSheet(false);
    setShowProjectCreateSheet(true);
  }, [
    setPendingProjectImport,
    setPendingTaskCsvImport,
    setShowCreateSheet,
    setShowProjectCreateSheet,
  ]);

  const openHelpPage = useCallback(() => {
    setHelpDocumentId(getContextHelpDocumentId(activeTab, showMasterSettings, showProjectSettings));
    closeTransientUi();
    closeTaskInspector();
    void navigateToHelp();
  }, [
    activeTab,
    closeTaskInspector,
    closeTransientUi,
    navigateToHelp,
    showMasterSettings,
    showProjectSettings,
  ]);

  const startTour = useCallback(
    (tourId: TourId) => {
      closeTaskInspector();
      if (tourId === "admin") {
        openMasterSettings();
      } else if (tourId === "basic") {
        changeTab("Projects");
      } else {
        changeTab("Gantt");
      }
      setActiveTourId(tourId);
    },
    [changeTab, closeTaskInspector, openMasterSettings, setActiveTourId],
  );

  const closeTour = useCallback(
    (tourId: TourId) => {
      try {
        window.localStorage.setItem(getTourCompletionKey(currentUserEmail, tourId), "completed");
      } catch {
        // ストレージが利用できない環境でも、現在のツアーは終了できます。
      }
      setActiveTourId(null);
    },
    [currentUserEmail, setActiveTourId],
  );

  return {
    changeTab,
    closeTransientUi,
    closeTour,
    helpDocumentId,
    openHelpPage,
    openMasterSettings,
    openProjectCreateSheet,
    openProjectSettings,
    startTour,
  };
}

const helpDocumentByView: Record<ViewTab, HelpDocumentId> = {
  Activity: "activity",
  Analysis: "analytics",
  Calendar: "calendar",
  DailyReports: "dailyReports",
  Gantt: "gantt",
  Issues: "issues",
  Milestones: "milestones",
  PersonalAnalytics: "analytics",
  Projects: "projects",
  Resource: "resource",
  Status: "status",
  WeeklyReport: "analytics",
  Workload: "analytics",
  WorkLogs: "workLogs",
};

function getContextHelpDocumentId(
  activeTab: ViewTab,
  showMasterSettings: boolean,
  showProjectSettings: boolean,
): HelpDocumentId {
  if (showMasterSettings) {
    return "adminSettings";
  }
  if (showProjectSettings) {
    return "projectSettings";
  }
  return helpDocumentByView[activeTab];
}
