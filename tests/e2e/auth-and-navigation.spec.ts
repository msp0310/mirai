import { expect, test, type Page } from "@playwright/test";

/** API認証を通じてMiraiへログインします。 */
async function login(page: Page) {
  await page.goto("/");
  await expect(page).toHaveTitle("Mirai");
  await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
  await page.getByLabel("メールアドレス").fill("pm@example.com");
  await page.getByLabel("パスワード").fill("Password123!");
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page.getByRole("heading", { name: "プロジェクトポートフォリオ" })).toBeVisible();
}

test.describe("Miraiの認証とプロジェクト導線", () => {
  test("初期ロードは全件詳細ではなくサマリーと選択案件だけを取得する", async ({ page }) => {
    const requestUrls: string[] = [];
    page.on("request", (request) => requestUrls.push(request.url()));
    await login(page);

    expect(requestUrls.some((url) => url.endsWith("/api/workspace"))).toBe(false);
    expect(requestUrls.some((url) => url.endsWith("/api/workspace/summary"))).toBe(true);
    expect(
      requestUrls.filter((url) => url.includes("/api/projects/") && url.endsWith("/schedule")),
    ).toHaveLength(1);
  });

  test("ログイン後はチーム配下のプロジェクト一覧を表示する", async ({ page }) => {
    await login(page);

    await expect(page.getByRole("region", { name: "プロジェクト一覧" })).toBeVisible();
    await expect(page.locator('[aria-label="チーム選択"]')).toBeVisible();
    const projectCard = page.locator("article.portfolio-card").filter({
      hasText: "販売管理システム刷新",
    });
    await expect(projectCard).toHaveCount(1);
    await expect(projectCard.locator("header strong")).toHaveText("販売管理システム刷新");
  });

  test("プロジェクトカードからGanttへ移動し、ショートカットを開ける", async ({ page }) => {
    await login(page);

    const projectCard = page.locator("article.portfolio-card").filter({
      hasText: "販売管理システム刷新",
    });
    await expect(projectCard).toHaveCount(1);
    const ganttButton = projectCard.getByRole("button", { name: "Ganttへ" });
    await expect(ganttButton).toHaveCount(1);
    await ganttButton.click();

    await expect(page.getByRole("button", { name: "タスク追加" })).toBeVisible();
    await expect(page.locator(".task-table-row")).toHaveCount(16);
    await page.getByRole("button", { name: "ショートカット" }).click();
    await expect(page.getByRole("dialog", { name: "キーボードショートカット" })).toBeVisible();
    await expect(page.getByText("選択範囲を上下に広げる", { exact: true })).toBeVisible();
  });

  test("未取得の別案件を選ぶと詳細を遅延取得してGanttを切り替える", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: "全件", exact: true }).click();

    const projectCard = page.locator("article.portfolio-card").filter({
      hasText: "CRM連携基盤構築",
    });
    await expect(projectCard).toHaveCount(1);
    await projectCard.getByRole("button", { name: "Ganttへ" }).click();

    await expect(page.getByRole("button", { name: "タスク追加" })).toBeVisible();
    await expect(
      page.getByRole("button", {
        exact: true,
        name: "CRM連携基盤構築（全体） のタスク名を編集",
      }),
    ).toBeVisible();
  });

  test("Ganttのタスク検索とキーボード範囲選択が操作予算内で動く", async ({ page }) => {
    await login(page);
    const projectCard = page.locator("article.portfolio-card").filter({
      hasText: "販売管理システム刷新",
    });
    await projectCard.getByRole("button", { name: "Ganttへ" }).click();
    await expect(page.getByRole("button", { name: "タスク追加" })).toBeVisible();

    const search = page.getByLabel("タスク検索");
    const searchStartedAt = Date.now();
    await search.fill("API");
    await expect(page.locator(".task-table-row.search-match")).toHaveCount(1);
    expect(Date.now() - searchStartedAt).toBeLessThan(1_000);

    await search.fill("");
    const rows = page.locator(".task-table-row");
    const rowCount = await rows.count();
    expect(rowCount).toBe(16);
    const firstRow = rows.nth(0);
    await firstRow.click({ position: { x: 300, y: 14 } });
    await firstRow.press("Shift+ArrowDown");
    await expect(page.getByText("2行選択", { exact: true })).toBeVisible();
  });

  test("タスク名のインライン編集は確定時だけ反映する", async ({ page }) => {
    await login(page);
    const projectCard = page.locator("article.portfolio-card").filter({
      hasText: "販売管理システム刷新",
    });
    await projectCard.getByRole("button", { name: "Ganttへ" }).click();
    await expect(page.getByRole("button", { name: "タスク追加" })).toBeVisible();

    const titleButton = page.getByRole("button", {
      exact: true,
      name: "販売管理システム刷新（全体） のタスク名を編集",
    });
    await titleButton.dblclick();
    const titleInput = page.getByLabel("販売管理システム刷新（全体） のタスク名");
    await titleInput.fill("販売管理システム刷新（更新）");
    await titleInput.press("Enter");
    await expect(
      page.getByRole("button", {
        exact: true,
        name: "販売管理システム刷新（更新） のタスク名を編集",
      }),
    ).toBeVisible();
  });

  test("ガントバーは操作内容に応じたカーソルを表示する", async ({ page }) => {
    await login(page);
    const projectCard = page.locator("article.portfolio-card").filter({
      hasText: "販売管理システム刷新",
    });
    await projectCard.getByRole("button", { name: "Ganttへ" }).click();
    await expect(page.getByRole("button", { name: "タスク追加" })).toBeVisible();

    await expect(page.locator(".gantt-bar.draggable").first()).toHaveCSS("cursor", "grab");
    await expect(page.locator(".gantt-bar.readonly").first()).toHaveCSS("cursor", "pointer");
    await expect(page.locator(".gantt-bar.draggable .resize-handle").first()).toHaveCSS(
      "cursor",
      "ew-resize",
    );
  });

  test("タスク表示をガントと表で切り替えられる", async ({ page }) => {
    await login(page);
    const projectCard = page.locator("article.portfolio-card").filter({
      hasText: "販売管理システム刷新",
    });
    await projectCard.getByRole("button", { name: "Ganttへ" }).click();
    await expect(page.getByRole("button", { name: "タスク追加" })).toBeVisible();

    const viewModeControl = page.locator(".view-mode-control");
    await viewModeControl.getByRole("button", { name: "表" }).click();
    await expect(page.locator(".gantt-shell.table-view")).toBeVisible();
    await expect(page.getByText("期間", { exact: true })).toBeVisible();
    await expect(page.locator(".task-date-cell").first()).toBeVisible();
    await expect(page.locator(".timeline-body")).toHaveCount(0);

    await viewModeControl.getByRole("button", { name: "ガント" }).click();
    await expect(page.locator(".timeline-body")).toBeVisible();
  });
});
