import type { MasterSettingsSection } from "../../model/masterSettings";

type MasterSettingsNavigationProps = {
  activeSection: MasterSettingsSection;
  canManageMembers: boolean;
  onChange: (section: MasterSettingsSection) => void;
};

const sections: { id: MasterSettingsSection; label: string; restricted?: boolean }[] = [
  { id: "teams", label: "チーム" },
  { id: "members", label: "メンバー", restricted: true },
  { id: "calendar", label: "カレンダー" },
  { id: "pjmgt", label: "PJMGT連携", restricted: true },
  { id: "audit", label: "監査ログ", restricted: true },
];

/** 管理設定のカテゴリ選択だけを担うナビゲーションです。 */
export function MasterSettingsNavigation({
  activeSection,
  canManageMembers,
  onChange,
}: MasterSettingsNavigationProps) {
  return (
    <nav className="settings-section-tabs" aria-label="管理設定カテゴリ" data-tour="settings-tabs">
      {sections.map((section) =>
        section.restricted && !canManageMembers ? null : (
          <button
            className={activeSection === section.id ? "active" : ""}
            data-tour={`settings-${section.id}`}
            key={section.id}
            onClick={() => onChange(section.id)}
            type="button"
          >
            {section.label}
          </button>
        ),
      )}
    </nav>
  );
}
