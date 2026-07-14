import {
  AdjustmentsHorizontalIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ClockIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  FlagIcon,
  FolderOpenIcon,
  HomeIcon,
  ListBulletIcon,
  QuestionMarkCircleIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { type ComponentType, type SVGProps, useEffect, useRef, useState } from "react";

import compassMark from "../../assets/compass-mark.png";
import type { ViewTab } from "./ViewTabs";

import * as styles from "./Sidebar.css";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type NavItem = {
  action?: "settings" | "projectSettings";
  children?: NavSubItem[];
  label: string;
  icon: IconComponent;
  tab?: ViewTab;
};

type NavSubItem = {
  label: string;
  tab: ViewTab;
};

type ProjectNavGroup = {
  items: NavItem[];
  label?: string;
};

const globalNavItems: NavItem[] = [
  { label: "案件", icon: FolderOpenIcon, tab: "Projects" },
  { label: "日報", icon: DocumentTextIcon, tab: "DailyReports" },
  {
    children: [
      { label: "個人分析", tab: "PersonalAnalytics" },
      { label: "プロジェクト分析", tab: "Analysis" },
      { label: "チーム分析", tab: "Workload" },
    ],
    label: "分析",
    icon: ChartBarIcon,
    tab: "PersonalAnalytics",
  },
];

const projectNavGroups: ProjectNavGroup[] = [
  { items: [{ label: "概要", icon: HomeIcon, tab: "Status" }] },
  {
    label: "計画",
    items: [
      { label: "ガント", icon: ListBulletIcon, tab: "Gantt" },
      { label: "マイルストーン", icon: FlagIcon, tab: "Milestones" },
    ],
  },
  {
    label: "実行",
    items: [
      { label: "課題", icon: ExclamationTriangleIcon, tab: "Issues" },
      { label: "作業時間", icon: WrenchScrewdriverIcon, tab: "WorkLogs" },
      { label: "カレンダー", icon: CalendarDaysIcon, tab: "Calendar" },
    ],
  },
  {
    label: "レポート",
    items: [
      { label: "週次報告", icon: DocumentTextIcon, tab: "WeeklyReport" },
      { label: "分析", icon: ChartBarIcon, tab: "Analysis" },
    ],
  },
  {
    label: "管理",
    items: [
      { label: "体制", icon: UserGroupIcon, tab: "Resource" },
      { label: "履歴", icon: ClockIcon, tab: "Activity" },
      {
        label: "案件設定",
        icon: AdjustmentsHorizontalIcon,
        action: "projectSettings",
      },
    ],
  },
];

const adminNavItem: NavItem = { label: "管理", icon: Cog6ToothIcon, action: "settings" };

type SidebarProps = {
  activeTab: ViewTab;
  helpOpen: boolean;
  onHelp: () => void;
  onMasterSettingsOpen: () => void;
  onNavigate: (tab: ViewTab) => void;
  onProjectSettingsOpen: () => void;
  projectName: string;
  projectNo: string;
  projectNavigationVisible: boolean;
  projectSettingsOpen: boolean;
  projectStatusLabel: string;
  settingsOpen: boolean;
  showAdminSettings: boolean;
  showProjectSettings: boolean;
};

/** 全体ナビゲーションと案件内ナビゲーションを分離して表示します。 */
export function Sidebar({
  activeTab,
  helpOpen,
  onHelp,
  onMasterSettingsOpen,
  onNavigate,
  onProjectSettingsOpen,
  projectName,
  projectNo,
  projectNavigationVisible,
  projectSettingsOpen,
  projectStatusLabel,
  settingsOpen,
  showAdminSettings,
  showProjectSettings,
}: SidebarProps) {
  const [projectNavigationCollapsed, setProjectNavigationCollapsed] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 1100px)").matches,
  );

  return (
    <div className={styles.navigationShell}>
      <aside className={styles.sidebar} aria-label="全体ナビゲーション" data-tour="sidebar">
        <div className={styles.brandMark} aria-label="Compass" title="Compass">
          <img alt="" src={compassMark} />
        </div>
        <div className={styles.navStack}>
          <GlobalNavGroup
            activeTab={activeTab}
            helpOpen={helpOpen}
            items={globalNavItems}
            onMasterSettingsOpen={onMasterSettingsOpen}
            onNavigate={onNavigate}
            onProjectSettingsOpen={onProjectSettingsOpen}
            projectContextActive={projectNavigationVisible}
            projectSettingsOpen={projectSettingsOpen}
            settingsOpen={settingsOpen}
          />
        </div>
        <div className={styles.globalFooter}>
          {showAdminSettings ? (
            <GlobalNavGroup
              activeTab={activeTab}
              helpOpen={helpOpen}
              items={[adminNavItem]}
              onMasterSettingsOpen={onMasterSettingsOpen}
              onNavigate={onNavigate}
              onProjectSettingsOpen={onProjectSettingsOpen}
              projectContextActive={false}
              projectSettingsOpen={projectSettingsOpen}
              settingsOpen={settingsOpen}
            />
          ) : null}
          <button
            aria-current={helpOpen ? "page" : undefined}
            className={helpOpen ? `${styles.helpButton} ${styles.helpButtonActive}` : styles.helpButton}
            data-tour="help"
            onClick={onHelp}
            title="ヘルプ"
            type="button"
          >
            <QuestionMarkCircleIcon />
            <span>ヘルプ</span>
          </button>
        </div>
      </aside>

      {projectNavigationVisible ? (
        <>
          <aside
            aria-label={`選択中案件 ${projectName} のメニュー`}
            className={
              projectNavigationCollapsed
                ? `${styles.projectSidebar} ${styles.projectSidebarCollapsed}`
                : styles.projectSidebar
            }
          >
            {!projectNavigationCollapsed ? (
              <>
                <header className={styles.projectHeader}>
                  <button
                    aria-label="案件メニューを折りたたむ"
                    className={styles.projectSidebarToggle}
                    onClick={() => setProjectNavigationCollapsed(true)}
                    title="案件メニューを折りたたむ"
                    type="button"
                  >
                    <ChevronDoubleLeftIcon />
                  </button>
                  <strong title={projectName}>{projectName}</strong>
                  <div className={styles.projectMeta}>
                    <span title={projectNo}>{projectNo}</span>
                    <em>{projectStatusLabel}</em>
                  </div>
                </header>
                <nav className={styles.projectNav} aria-label="案件内ナビゲーション">
                  {projectNavGroups.map((group, groupIndex) => {
                    const items = showProjectSettings
                      ? group.items
                      : group.items.filter((item) => item.action !== "projectSettings");
                    if (items.length === 0) {
                      return null;
                    }
                    return (
                      <div className={styles.projectNavGroup} key={group.label ?? groupIndex}>
                        {group.label ? <span>{group.label}</span> : null}
                        {items.map((item) => {
                          const Icon = item.icon;
                          const active =
                            !helpOpen &&
                            !settingsOpen &&
                            ((item.tab ? !projectSettingsOpen && activeTab === item.tab : false) ||
                              (item.action === "projectSettings" && projectSettingsOpen));
                          return (
                            <button
                              aria-current={active ? "page" : undefined}
                              className={
                                active
                                  ? `${styles.projectNavItem} ${styles.projectNavItemActive}`
                                  : styles.projectNavItem
                              }
                              data-tour={item.tab ? `nav-${item.tab}` : `nav-${item.action}`}
                              key={item.label}
                              onClick={() => {
                                if (item.tab) {
                                  onNavigate(item.tab);
                                } else if (item.action === "projectSettings") {
                                  onProjectSettingsOpen();
                                }
                              }}
                              title={item.label}
                              type="button"
                            >
                              <Icon />
                              <span>{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </nav>
              </>
            ) : null}
          </aside>
          {projectNavigationCollapsed ? (
            <button
              aria-label="案件メニューを展開する"
              className={styles.projectSidebarReveal}
              onClick={() => setProjectNavigationCollapsed(false)}
              title="案件メニューを展開する"
              type="button"
            >
              <ChevronDoubleRightIcon />
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

type GlobalNavGroupProps = {
  activeTab: ViewTab;
  helpOpen: boolean;
  items: NavItem[];
  onMasterSettingsOpen: () => void;
  onNavigate: (tab: ViewTab) => void;
  onProjectSettingsOpen: () => void;
  projectContextActive: boolean;
  projectSettingsOpen: boolean;
  settingsOpen: boolean;
};

function GlobalNavGroup({
  activeTab,
  helpOpen,
  items,
  onMasterSettingsOpen,
  onNavigate,
  onProjectSettingsOpen,
  projectContextActive,
  projectSettingsOpen,
  settingsOpen,
}: GlobalNavGroupProps) {
  const [expandedItemLabel, setExpandedItemLabel] = useState<string | null>(null);
  const navGroupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setExpandedItemLabel(null);
  }, [activeTab, helpOpen, projectSettingsOpen, settingsOpen]);

  useEffect(() => {
    if (expandedItemLabel === null) {
      return;
    }

    function closeSubmenuOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !navGroupRef.current?.contains(event.target)) {
        setExpandedItemLabel(null);
      }
    }

    function closeSubmenuOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setExpandedItemLabel(null);
      }
    }

    document.addEventListener("pointerdown", closeSubmenuOnOutsideClick);
    window.addEventListener("keydown", closeSubmenuOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeSubmenuOnOutsideClick);
      window.removeEventListener("keydown", closeSubmenuOnEscape);
    };
  }, [expandedItemLabel]);

  return (
    <div className={styles.navGroup} ref={navGroupRef}>
      {items.map((item) => {
        const Icon = item.icon;
        const hasActiveChild = item.children?.some((child) => child.tab === activeTab) ?? false;
        const expanded = expandedItemLabel === item.label;
        const active =
          !helpOpen &&
          ((item.tab
            ? !settingsOpen &&
              !projectSettingsOpen &&
              (activeTab === item.tab ||
                hasActiveChild ||
                (item.tab === "Projects" && projectContextActive))
            : false) ||
            (item.action === "settings" && settingsOpen));

        const navButton = (
          <button
            aria-current={active ? "page" : undefined}
            aria-expanded={item.children ? expanded : undefined}
            className={active ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem}
            data-tour={
              item.label === "分析"
                ? "nav-analysis"
                : item.tab
                  ? `nav-${item.tab}`
                  : `nav-${item.action}`
            }
            key={!item.children ? item.label : undefined}
            onClick={() => {
              if (item.children) {
                setExpandedItemLabel((current) => (current === item.label ? null : item.label));
              } else if (item.tab) {
                onNavigate(item.tab);
              } else if (item.action === "settings") {
                onMasterSettingsOpen();
              } else if (item.action === "projectSettings") {
                onProjectSettingsOpen();
              }
            }}
            title={item.label}
            type="button"
          >
            <Icon />
            <span>{item.label}</span>
          </button>
        );
        if (!item.children) {
          return navButton;
        }

        return (
          <div className={styles.navItemWithChildren} key={item.label}>
            {navButton}
            {expanded ? (
              <div className={styles.navSubmenu} aria-label={`${item.label}のサブメニュー`}>
                {item.children.map((child) => {
                  const childActive =
                    !helpOpen && !settingsOpen && !projectSettingsOpen && activeTab === child.tab;
                  return (
                    <button
                      aria-current={childActive ? "page" : undefined}
                      className={
                        childActive
                          ? `${styles.navSubItem} ${styles.navSubItemActive}`
                          : styles.navSubItem
                      }
                      key={child.tab}
                      onClick={() => {
                        setExpandedItemLabel(null);
                        onNavigate(child.tab);
                      }}
                      title={child.label}
                      type="button"
                    >
                      <span>{child.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
