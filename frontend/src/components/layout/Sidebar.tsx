import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import {
  AdjustmentsHorizontalIcon,
  ChartBarIcon,
  CalendarDaysIcon,
  ClockIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  FlagIcon,
  FolderOpenIcon,
  HomeIcon,
  ListBulletIcon,
  QuestionMarkCircleIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
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

const globalNavItems: NavItem[] = [{ label: "案件一覧", icon: FolderOpenIcon, tab: "Projects" }];

const projectNavItems: NavItem[] = [
  { label: "概要", icon: HomeIcon, tab: "Status" },
  {
    children: [
      { label: "プロジェクト分析", tab: "Analysis" },
      { label: "週次報告", tab: "WeeklyReport" },
    ],
    label: "分析",
    icon: ChartBarIcon,
    tab: "Analysis",
  },
  { label: "ガント", icon: ListBulletIcon, tab: "Gantt" },
  { label: "課題", icon: ExclamationTriangleIcon, tab: "Issues" },
  { label: "作業時間", icon: WrenchScrewdriverIcon, tab: "WorkLogs" },
  { label: "体制", icon: UserGroupIcon, tab: "Resource" },
  { label: "カレンダー", icon: CalendarDaysIcon, tab: "Calendar" },
  { label: "マイルストーン", icon: FlagIcon, tab: "Milestones" },
  { label: "履歴", icon: ClockIcon, tab: "Activity" },
  { label: "案件設定", icon: AdjustmentsHorizontalIcon, action: "projectSettings" },
];

const adminNavItems: NavItem[] = [{ label: "管理設定", icon: Cog6ToothIcon, action: "settings" }];

type SidebarProps = {
  activeTab: ViewTab;
  helpOpen: boolean;
  onHelp: () => void;
  onMasterSettingsOpen: () => void;
  onNavigate: (tab: ViewTab) => void;
  onProjectSettingsOpen: () => void;
  projectNavigationVisible: boolean;
  projectName: string;
  projectSettingsOpen: boolean;
  settingsOpen: boolean;
};

/** 全体ナビゲーションと、案件選択時だけ表示するプロジェクト操作を管理します。 */
export function Sidebar({
  activeTab,
  helpOpen,
  onHelp,
  onMasterSettingsOpen,
  onNavigate,
  onProjectSettingsOpen,
  projectName,
  projectNavigationVisible,
  projectSettingsOpen,
  settingsOpen,
}: SidebarProps) {
  return (
    <aside className={styles.sidebar} aria-label="メインナビゲーション">
      <div className={styles.navStack}>
        <NavGroup
          activeTab={activeTab}
          helpOpen={helpOpen}
          items={globalNavItems}
          onMasterSettingsOpen={onMasterSettingsOpen}
          onNavigate={onNavigate}
          onProjectSettingsOpen={onProjectSettingsOpen}
          projectSettingsOpen={projectSettingsOpen}
          settingsOpen={settingsOpen}
        />
        {projectNavigationVisible ? (
          <NavGroup
            activeTab={activeTab}
            ariaLabel={`選択中案件 ${projectName} のメニュー`}
            helpOpen={helpOpen}
            items={projectNavItems}
            label="案件内"
            onMasterSettingsOpen={onMasterSettingsOpen}
            onNavigate={onNavigate}
            onProjectSettingsOpen={onProjectSettingsOpen}
            projectSettingsOpen={projectSettingsOpen}
            settingsOpen={settingsOpen}
          />
        ) : null}
        <NavGroup
          activeTab={activeTab}
          helpOpen={helpOpen}
          items={adminNavItems}
          onMasterSettingsOpen={onMasterSettingsOpen}
          onNavigate={onNavigate}
          onProjectSettingsOpen={onProjectSettingsOpen}
          projectSettingsOpen={projectSettingsOpen}
          settingsOpen={settingsOpen}
        />
      </div>
      <button
        aria-current={helpOpen ? "page" : undefined}
        className={helpOpen ? `${styles.helpButton} ${styles.helpButtonActive}` : styles.helpButton}
        onClick={onHelp}
        title="ヘルプ"
        type="button"
      >
        <QuestionMarkCircleIcon />
      </button>
    </aside>
  );
}

type NavGroupProps = {
  activeTab: ViewTab;
  ariaLabel?: string;
  helpOpen: boolean;
  items: NavItem[];
  label?: string;
  onMasterSettingsOpen: () => void;
  onNavigate: (tab: ViewTab) => void;
  onProjectSettingsOpen: () => void;
  projectSettingsOpen: boolean;
  settingsOpen: boolean;
};

function NavGroup({
  activeTab,
  ariaLabel,
  helpOpen,
  items,
  label,
  onMasterSettingsOpen,
  onNavigate,
  onProjectSettingsOpen,
  projectSettingsOpen,
  settingsOpen,
}: NavGroupProps) {
  const [expandedItemLabel, setExpandedItemLabel] = useState<string | null>(
    activeTab === "Analysis" || activeTab === "WeeklyReport" ? "分析" : null,
  );

  useEffect(() => {
    if (activeTab === "Analysis" || activeTab === "WeeklyReport") {
      setExpandedItemLabel("分析");
    }
  }, [activeTab]);

  return (
    <div className={styles.navGroup} aria-label={ariaLabel}>
      {label ? <span className={styles.navGroupLabel}>{label}</span> : null}
      {items.map((item) => {
        const Icon = item.icon;
        const hasActiveChild = item.children?.some((child) => child.tab === activeTab) ?? false;
        const expanded = expandedItemLabel === item.label;
        const active =
          !helpOpen &&
          ((item.tab
            ? !settingsOpen &&
              !projectSettingsOpen &&
              (activeTab === item.tab || hasActiveChild)
            : false) ||
            (item.action === "settings" && settingsOpen) ||
            (item.action === "projectSettings" && projectSettingsOpen));

        const navButton = (
          <button
            aria-current={active ? "page" : undefined}
            aria-expanded={item.children ? expanded : undefined}
            className={active ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem}
            key={!item.children ? item.label : undefined}
              onClick={() => {
                if (item.children) {
                  setExpandedItemLabel((current) => (current === item.label ? null : item.label));
                  return;
                }
                if (item.tab) onNavigate(item.tab);
              if (item.action === "settings") onMasterSettingsOpen();
              if (item.action === "projectSettings") onProjectSettingsOpen();
            }}
            title={item.label}
            type="button"
          >
            <Icon />
            <span>{item.label}</span>
          </button>
        );
        if (!item.children) return navButton;

        return (
          <div className={styles.navItemWithChildren} key={item.label}>
            {navButton}
            {expanded ? (
              <div className={styles.navSubmenu} aria-label={`${item.label}のサブメニュー`}>
                {item.children.map((child) => {
                  const childActive = !helpOpen && !settingsOpen && !projectSettingsOpen && activeTab === child.tab;
                  return (
                    <button
                      aria-current={childActive ? "page" : undefined}
                      className={childActive ? `${styles.navSubItem} ${styles.navSubItemActive}` : styles.navSubItem}
                      key={child.tab}
                      onClick={() => {
                        setExpandedItemLabel(item.label);
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
