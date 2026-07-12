import { useState } from "react";

import type { Project } from "../../../../types/schedule";

type ProjectArchiveSettingsProps = {
  disabled: boolean;
  onArchive: (projectId: string) => void;
  project: Project;
};

/** 案件アーカイブの影響説明と二段階確認を提供します。 */
export function ProjectArchiveSettings({
  disabled,
  onArchive,
  project,
}: ProjectArchiveSettingsProps) {
  const [confirming, setConfirming] = useState(false);
  return (
    <section className="settings-card archive-card">
      <div className="settings-card-heading">
        <strong>プロジェクト整理</strong>
        <span>{disabled ? "最後の有効案件" : "アーカイブ"}</span>
      </div>
      <p>
        完了・保留になった案件を通常のチーム選択から外します。
        データは残り、プロジェクト検索から復元できます。
      </p>
      {confirming ? (
        <div className="archive-confirm">
          <strong>{project.workspace} をアーカイブしますか？</strong>
          <span>次の有効プロジェクトへ移動します。</span>
          <div>
            <button className="subtle-action" onClick={() => setConfirming(false)} type="button">
              キャンセル
            </button>
            <button
              className="primary-button danger"
              onClick={() => onArchive(project.id)}
              type="button"
            >
              アーカイブして移動
            </button>
          </div>
        </div>
      ) : (
        <button
          className="subtle-action danger"
          disabled={disabled}
          onClick={() => setConfirming(true)}
          type="button"
        >
          アーカイブ
        </button>
      )}
    </section>
  );
}
