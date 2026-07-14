import { useEffect, useState } from "react";

import {
  getPjmgtIntegrationSettings,
  type PjmgtIntegrationSettings,
  type PjmgtSyncSummary,
  previewPjmgtSync,
  savePjmgtIntegrationSettings,
  synchronizePjmgt,
  testPjmgtConnection,
} from "../../../../data/administrationRepository";

type PjmgtIntegrationSectionProps = {
  active: boolean;
  onSyncComplete: () => void;
};

type Operation = "load" | "save" | "test" | "preview" | "sync" | null;

/** PJMGTの接続先、対象期間、同期実行を管理します。 */
export function PjmgtIntegrationSection({ active, onSyncComplete }: PjmgtIntegrationSectionProps) {
  const [settings, setSettings] = useState<PjmgtIntegrationSettings | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [excludePastProjects, setExcludePastProjects] = useState(true);
  const [summary, setSummary] = useState<PjmgtSyncSummary | null>(null);
  const [operation, setOperation] = useState<Operation>(null);
  const [notice, setNotice] = useState<{ message: string; tone: "error" | "success" } | null>(null);

  useEffect(() => {
    if (!active || settings || operation === "load") {
      return;
    }
    setOperation("load");
    void getPjmgtIntegrationSettings()
      .then((result) => {
        setSettings(result);
        setBaseUrl(result.baseUrl);
        setExcludePastProjects(result.excludePastProjects);
        setSummary(result.lastSyncSummary ?? null);
      })
      .catch((error: unknown) => setNotice({ message: errorMessage(error), tone: "error" }))
      .finally(() => setOperation(null));
  }, [active, operation, settings]);

  async function save() {
    await run("save", async () => {
      const result = await savePjmgtIntegrationSettings(baseUrl.trim(), excludePastProjects);
      setSettings(result);
      setBaseUrl(result.baseUrl);
      setSummary(null);
      setNotice({ message: "接続設定を保存しました。", tone: "success" });
    });
  }

  async function testConnection() {
    await run("test", async () => {
      const result = await testPjmgtConnection();
      setNotice({ message: result.message, tone: result.succeeded ? "success" : "error" });
      setSettings((current) => current ? {
        ...current,
        lastConnectionCheckedAt: result.checkedAt,
        lastConnectionMessage: result.message,
        lastConnectionSucceeded: result.succeeded,
      } : current);
    });
  }

  async function preview() {
    await run("preview", async () => {
      const result = await previewPjmgtSync();
      setSummary(result);
      setNotice({
        message: result.errors.length > 0 ? "同期前にエラーを修正してください。" : "同期内容を確認しました。",
        tone: result.errors.length > 0 ? "error" : "success",
      });
    });
  }

  async function sync() {
    await run("sync", async () => {
      const result = await synchronizePjmgt();
      setSummary(result.summary);
      setSettings((current) => current ? { ...current, lastSyncedAt: result.syncedAt, lastSyncSummary: result.summary } : current);
      setNotice({ message: "PJMGTのデータを同期しました。", tone: "success" });
      onSyncComplete();
    });
  }

  async function run(nextOperation: Exclude<Operation, "load" | null>, action: () => Promise<void>) {
    setOperation(nextOperation);
    setNotice(null);
    try {
      await action();
    } catch (error) {
      setNotice({ message: errorMessage(error), tone: "error" });
    } finally {
      setOperation(null);
    }
  }

  const busy = operation !== null;
  return (
    <div className="pjmgt-integration" hidden={!active}>
      <section className="settings-card integration-settings-card">
        <div className="settings-card-heading">
          <strong>PJMGT接続設定</strong>
          <span>{settings?.apiKeyConfigured ? "APIキー設定済み" : "APIキー未設定"}</span>
        </div>
        <p className="integration-description">
          PJMGTを正本として、チーム・要員・プロジェクト・月別の計画アサインをCOMPASSへ取り込みます。
        </p>
        <div className="settings-fields">
          <label>
            接続先URL
            <input
              autoComplete="url"
              disabled={busy}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="http://localhost:18080/pjmgt/api/v1"
              type="url"
              value={baseUrl}
            />
          </label>
          <label className="integration-checkbox">
            <input
              checked={excludePastProjects}
              disabled={busy}
              onChange={(event) => setExcludePastProjects(event.target.checked)}
              type="checkbox"
            />
            <span>
              <strong>過去案件を除外</strong>
              <small>完了済み、または終了日が今日より前の案件を取り込みません。</small>
            </span>
          </label>
        </div>
        <p className="integration-secret-note">
          APIキーはサーバー環境変数 <code>Pjmgt__ApiKey</code> で設定します。画面やDBには保存しません。
        </p>
        <div className="integration-actions">
          <button className="primary-button" disabled={busy || !baseUrl.trim()} onClick={() => void save()} type="button">
            {operation === "save" ? "保存中..." : "設定を保存"}
          </button>
          <button className="subtle-action" disabled={busy || !settings?.baseUrl} onClick={() => void testConnection()} type="button">
            {operation === "test" ? "接続中..." : "接続テスト"}
          </button>
        </div>
      </section>

      <section className="settings-card integration-sync-card">
        <div className="settings-card-heading">
          <strong>同期</strong>
          <span>{settings?.lastSyncedAt ? `最終同期 ${formatDate(settings.lastSyncedAt)}` : "未同期"}</span>
        </div>
        <p className="integration-description">
          削除・失注案件は常に除外します。同期対象外になった既存案件はCOMPASS上でアーカイブします。
        </p>
        <div className="integration-actions">
          <button className="subtle-action" disabled={busy || !settings?.baseUrl} onClick={() => void preview()} type="button">
            {operation === "preview" ? "確認中..." : "同期内容を確認"}
          </button>
          <button className="primary-button" disabled={busy || !summary || summary.errors.length > 0} onClick={() => void sync()} type="button">
            {operation === "sync" ? "同期中..." : "同期を実行"}
          </button>
        </div>
        {notice ? <p className={`integration-notice ${notice.tone}`}>{notice.message}</p> : null}
        {summary ? <SyncSummary summary={summary} /> : null}
      </section>
    </div>
  );
}

function SyncSummary({ summary }: { summary: PjmgtSyncSummary }) {
  const items = [
    ["チーム", summary.teamsCreated, summary.teamsUpdated],
    ["要員", summary.membersCreated, summary.membersUpdated],
    ["プロジェクト", summary.projectsCreated, summary.projectsUpdated],
  ] as const;
  return (
    <div className="integration-summary">
      <div className="integration-summary-grid">
        {items.map(([label, created, updated]) => (
          <div key={label}><span>{label}</span><strong>新規 {created} / 更新 {updated}</strong></div>
        ))}
        <div><span>アサイン</span><strong>{summary.assignmentsImported}件</strong></div>
        <div><span>除外案件</span><strong>{summary.projectsSkipped}件</strong></div>
        <div><span>アーカイブ</span><strong>{summary.projectsArchived}件</strong></div>
      </div>
      {[...summary.errors, ...summary.warnings].map((message) => (
        <p className={summary.errors.includes(message) ? "integration-issue error" : "integration-issue"} key={message}>{message}</p>
      ))}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function errorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "処理に失敗しました。";
  }
  try {
    const parsed = JSON.parse(error.message) as { detail?: string; message?: string; title?: string };
    return parsed.message ?? parsed.detail ?? parsed.title ?? error.message;
  } catch {
    return error.message;
  }
}
