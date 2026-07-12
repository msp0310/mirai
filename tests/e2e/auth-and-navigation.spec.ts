import { type APIRequestContext, type Locator, type Page, expect, test } from "@playwright/test";

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function yearMonthLabel(offset: number) {
  const value = new Date();
  value.setDate(1);
  value.setMonth(value.getMonth() + offset);
  return `${value.getFullYear()}/${value.getMonth() + 1}`;
}

async function loginApi(request: APIRequestContext) {
  const response = await request.post("/api/auth/login", {
    data: { email: "pm@example.com", password: "Password123!" },
  });
  expect(response.ok()).toBe(true);
  const state = await request.storageState();
  const csrf = state.cookies.find((cookie) => cookie.name === "mirai_csrf")?.value;
  if (!csrf) {
    throw new Error("CSRF Cookieを取得できませんでした。");
  }
  return { "X-CSRF-Token": csrf };
}

async function showSeedPlanningPeriod(workload: Locator) {
  const now = new Date();
  const seedYear = 2025;
  const delta = now.getFullYear() - seedYear;
  const buttonName = delta >= 0 ? "前の期間" : "次の期間";
  for (let index = 0; index < Math.abs(delta); index += 1) {
    await workload.getByRole("button", { name: buttonName }).click();
  }

  const start = new Date(seedYear, now.getMonth(), 1);
  const end = new Date(seedYear + 1, now.getMonth(), 0);
  const label = `${start.getFullYear()}/${start.getMonth() + 1} - ${end.getFullYear()}/${end.getMonth() + 1}`;
  await expect(workload.getByText(label)).toBeVisible();
}

/** API認証を通じてMiraiへログインします。 */
async function login(page: Page, options: { showInitialTour?: boolean } = {}) {
  if (!options.showInitialTour) {
    await page.addInitScript(() => {
      window.localStorage.setItem("mirai:onboarding:pm@example.com:basic:v1", "completed");
    });
  }
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
    await expect(projectCard).toContainText("プロジェクトNo. PJ-2025-001");

    await page
      .getByPlaceholder("プロジェクトNo.・案件名・マイルストーンで検索")
      .fill("PJ-2025-001");
    await expect(projectCard).toBeVisible();
  });

  test("端末保存には案件・タスク・活動履歴を含めない", async ({ page }) => {
    await login(page);
    await page.locator("article.portfolio-card:not(.active)").first().click();

    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem("si-schedule-manager-draft-v1")))
      .not.toBeNull();
    const localDraft = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem("si-schedule-manager-draft-v1") ?? "null"),
    );
    expect(localDraft).not.toBeNull();
    expect(localDraft).not.toHaveProperty("workspace");
    expect(localDraft).not.toHaveProperty("activityLogs");
    expect(localDraft.activeProjectId).toBeTruthy();
  });

  test("初回ログインの基本ツアーとヘルプからの再実行を利用できる", async ({ page }) => {
    await login(page, { showInitialTour: true });

    let tour = page.getByRole("dialog", { name: "基本操作: チームを選ぶ" });
    await expect(tour).toBeVisible();
    await expect(tour).toContainText("1 / 5");
    await tour.getByRole("button", { name: "次へ" }).click();
    tour = page.getByRole("dialog", { name: "基本操作: 案件を探す" });
    await expect(tour).toBeVisible();
    await tour.getByRole("button", { name: "ツアーを終了" }).click();
    await expect(tour).toHaveCount(0);

    await page.getByRole("button", { name: "ヘルプ", exact: true }).click();
    const tourLauncher = page.getByRole("region", { name: "操作ツアー" });
    await expect(tourLauncher.getByRole("button", { name: "基本操作" })).toBeVisible();
    await expect(tourLauncher.getByRole("button", { name: "管理者向け" })).toBeVisible();
    await tourLauncher.getByRole("button", { name: "基本操作" }).click();
    await expect(page.getByRole("dialog", { name: "基本操作: チームを選ぶ" })).toBeVisible();
  });

  test("権限に応じた全操作ツアーを最後まで進められる", async ({ page }) => {
    await login(page);
    const scenarios = ["基本操作", "ガント操作", "メンバー向け", "PM・PL向け", "管理者向け"];
    const mainNavigation = page.getByRole("complementary", { name: "メインナビゲーション" });

    for (const scenarioTitle of scenarios) {
      await mainNavigation.getByRole("button", { name: "ヘルプ", exact: true }).click();
      await page
        .getByRole("region", { name: "操作ツアー" })
        .getByRole("button", { name: scenarioTitle })
        .click();

      for (let step = 0; step < 5; step += 1) {
        const tour = page.getByRole("dialog", { name: new RegExp(`^${scenarioTitle}:`) });
        await expect(tour).toBeVisible();
        await expect(tour.getByText("この画面では対象を表示できないため")).toHaveCount(0);
        await tour.getByRole("button", { name: step === 4 ? "完了" : "次へ" }).click();
      }

      await expect(
        page.getByRole("dialog", { name: new RegExp(`^${scenarioTitle}:`) }),
      ).toHaveCount(0);
    }
  });

  test("分析メニューからチーム分析を開き、人別とチーム別で切り替えられる", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: "分析", exact: true }).click();
    await page.getByRole("button", { name: "チーム分析", exact: true }).click();

    const workload = page.getByRole("region", { name: "チーム分析・要員計画" });
    await expect(workload).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "チーム分析・要員計画", level: 1 }),
    ).toBeVisible();
    await expect(workload.getByText("表示メンバー")).toBeVisible();
    await expect(workload.getByRole("combobox", { name: "表示チーム" })).toHaveValue("all");
    await expect(workload.getByText(`${yearMonthLabel(0)} - ${yearMonthLabel(11)}`)).toBeVisible();
    await expect(workload.getByLabel("要員判断")).toContainText("要員不足");
    await expect(workload.getByLabel("要員判断")).toContainText("過負荷");
    await expect(workload.getByLabel("要員判断")).toContainText("アサイン候補");
    await expect(workload.getByLabel("月・週の時間軸").getByText(yearMonthLabel(0))).toBeVisible();
    await expect(workload.getByLabel("月・週の時間軸").getByText("W1")).toHaveCount(12);
    await expect(page.getByRole("button", { name: "ガント", exact: true })).toHaveCount(0);

    await workload.getByRole("button", { name: "チーム別", exact: true }).click();
    await expect(workload.getByText("表示チーム", { exact: true })).toBeVisible();
    await expect(workload.getByRole("button", { name: "クラウド基盤チーム" })).toBeVisible();
    await expect(workload.getByRole("button", { name: "業務システム事業部" })).toBeVisible();
    await expect(workload.getByText(/チーム$/).first()).toBeVisible();
  });

  test("要員要求から仮アサインを計画へ反映できる", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: "分析", exact: true }).click();
    await page.getByRole("button", { name: "チーム分析", exact: true }).click();
    const workload = page.getByRole("region", { name: "チーム分析・要員計画" });
    await showSeedPlanningPeriod(workload);

    await workload.getByRole("button", { name: "要員要求追加" }).click();
    const demandEditor = page.getByRole("complementary", { name: "要員要求編集" });
    await demandEditor.getByLabel("必要な役割").fill("インフラ");
    await demandEditor.getByLabel("必要人数").fill("1");
    await demandEditor.getByLabel("配分率").fill("60");
    await demandEditor.getByRole("button", { name: "要求を追加" }).click();

    const demand = workload.getByRole("button", {
      name: /CRM連携基盤構築 \/ インフラ 1名/,
    });
    await expect(demand).toBeVisible();
    await demand.click();
    const assignmentEditor = page.getByRole("complementary", { name: "アサイン編集" });
    await assignmentEditor.getByLabel("メンバー").selectOption("fe");
    await assignmentEditor.getByLabel("状態").selectOption("draft");
    await assignmentEditor.getByRole("button", { name: "計画へ反映" }).click();

    await expect(demand).toHaveCount(0);
    await expect(workload.getByRole("button", { name: /インフラ \/ 60%/ })).toBeVisible();
    await expect(workload.getByLabel("高橋 美咲の月別アサイン率")).toContainText("%");

    await page.getByRole("button", { name: "保存", exact: true }).click();
    const saveReview = page.getByRole("dialog", { name: "保存前確認" });
    await expect(saveReview).toContainText("保存範囲: 要員計画");
    await expect(saveReview).toContainText("アサイン計画");
    await saveReview.getByRole("button", { name: "閉じる" }).click();
  });

  test("日報を提出し、案件実績とコメントへ連携できる", async ({ page, request }) => {
    const reportDate = todayKey();
    const reportYear = reportDate.slice(0, 4);
    const headers = await loginApi(request);
    const existingResponse = await request.get("/api/daily-reports", { headers });
    const existing = (await existingResponse.json()) as {
      date: string;
      id: string;
      memberId: string;
    }[];
    for (const report of existing.filter(
      (item) => item.date === reportDate && item.memberId === "yk",
    )) {
      await request.delete(`/api/daily-reports/${report.id}`, { headers });
    }

    await login(page);
    await page.getByRole("button", { name: "日報", exact: true }).click();
    const dailyReport = page.getByRole("region", { name: "日報", exact: true });
    await expect(dailyReport).toBeVisible();
    const initialTeamReports = dailyReport.getByRole("region", { name: "みんなの日報" });
    await expect(initialTeamReports).toBeVisible();
    await expect(initialTeamReports.getByLabel("対象日")).toHaveValue(reportDate);
    await initialTeamReports.getByRole("button", { name: "自分の日報を提出" }).click();
    await expect(dailyReport.getByLabel("日報日付")).toHaveValue(reportDate);
    await dailyReport.getByLabel("本日のまとめ").fill("基本設計レビューを実施しました。");
    await dailyReport.getByLabel("作業内容").fill("レビュー指摘の整理");
    await dailyReport.getByRole("button", { name: "提出して実績反映" }).click();
    await expect(
      dailyReport.getByRole("article").getByText("提出済み", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("日報を提出し、案件実績へ反映しました。")).toBeVisible();

    await dailyReport.getByLabel("日報コメント").fill("確認しました。明日の対応もお願いします。");
    await dailyReport.getByRole("button", { name: "コメントを追加" }).click();
    await expect(dailyReport.getByText("確認しました。明日の対応もお願いします。")).toBeVisible();

    await dailyReport.getByRole("button", { name: "みんなの日報" }).click();
    const teamReports = dailyReport.getByRole("region", { name: "みんなの日報" });
    await expect(teamReports.getByRole("button", { name: "自分の日報を確認" })).toBeVisible();
    await expect(teamReports).toContainText("/ 6名");
    await expect(teamReports.getByRole("row", { name: /山田 健太/ })).toContainText(
      "基本設計レビューを実施しました。",
    );
    await expect(teamReports.getByRole("row", { name: /伊藤 大輔/ })).toContainText("未提出");
    await teamReports.getByRole("button", { name: "山田 健太の日報へコメント" }).click();
    await expect(teamReports.getByText("レビュー指摘の整理", { exact: true })).toBeVisible();
    await teamReports.getByLabel("山田 健太へのコメント").fill("一覧から確認しました。");
    await teamReports.getByRole("button", { name: "コメントを送信" }).click();
    await expect(page.getByText("コメントを追加しました。")).toBeVisible();

    await teamReports.getByRole("button", { name: "山田 健太の日報を開く" }).click();
    await dailyReport.getByRole("button", { name: "日報を削除" }).click();
    const deleteDialog = page.getByRole("dialog", { name: "日報の削除確認" });
    await expect(deleteDialog).toContainText("案件実績も同時に取り消されます");
    await deleteDialog.getByRole("button", { name: "キャンセル" }).click();
    await expect(deleteDialog).toHaveCount(0);

    await page.getByRole("button", { name: "分析", exact: true }).click();
    await page.getByRole("button", { name: "個人分析", exact: true }).click();
    const personalAnalytics = page.getByRole("region", { name: "個人分析" });
    await expect(personalAnalytics.getByLabel("対象年")).toHaveValue(reportYear);
    await expect(personalAnalytics.getByLabel("対象メンバー")).toBeVisible();
    await expect(personalAnalytics).toContainText(`${reportYear}年にやったこと`);
    await expect(personalAnalytics).toContainText("レビュー指摘の整理");
    await expect(personalAnalytics).toContainText("これまでのプロジェクト実績");

    const savedReportsResponse = await request.get("/api/daily-reports", { headers });
    const savedReports = (await savedReportsResponse.json()) as {
      date: string;
      id: string;
      memberId: string;
    }[];
    const saved = savedReports.find((item) => item.date === reportDate && item.memberId === "yk");
    expect(saved).toBeTruthy();
    if (saved) {
      await request.delete(`/api/daily-reports/${saved.id}`, { headers });
    }
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

  test("フルHDではガントが画面下端まで表示領域を利用する", async ({ page }) => {
    await page.setViewportSize({ height: 1080, width: 1920 });
    await login(page);
    const projectCard = page.locator("article.portfolio-card").filter({
      hasText: "販売管理システム刷新",
    });
    await projectCard.getByRole("button", { name: "Ganttへ" }).click();

    const timeline = page.locator(".timeline-body");
    const taskTable = page.locator(".task-table");
    await expect(timeline).toBeVisible();
    const timelineBox = await timeline.boundingBox();
    const taskTableBox = await taskTable.boundingBox();
    expect(timelineBox).not.toBeNull();
    expect(taskTableBox).not.toBeNull();
    expect(timelineBox?.height ?? 0).toBeGreaterThanOrEqual(820);
    expect((timelineBox?.y ?? 0) + (timelineBox?.height ?? 0)).toBeGreaterThanOrEqual(1040);
    expect(Math.abs((timelineBox?.height ?? 0) - (taskTableBox?.height ?? 0))).toBeLessThan(2);
  });

  test("週次進捗でタスク件数と完了件数を確認できる", async ({ page }) => {
    await login(page);
    const projectCard = page.locator("article.portfolio-card").filter({
      hasText: "販売管理システム刷新",
    });
    await projectCard.getByRole("button", { name: "Ganttへ" }).click();
    await page.getByRole("button", { name: "週次報告", exact: true }).click();

    const weeklyReport = page.getByRole("region", { name: "週次報告" });
    const overview = weeklyReport.getByLabel("プロジェクト全体の計画と実績");
    await expect(overview.getByText("全タスク").locator("..")).toContainText("9件");
    await expect(overview.getByText("完了済み").locator("..")).toContainText("3件");
    await expect(overview.getByText("未完了").locator("..")).toContainText("6件");
    await expect(overview).toContainText("全体完了率");
    await expect(weeklyReport.getByRole("columnheader", { name: "対象タスク" })).toBeVisible();
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

  test("Ganttの担当者フィルターとキーボード範囲選択が操作予算内で動く", async ({ page }) => {
    await login(page);
    const projectCard = page.locator("article.portfolio-card").filter({
      hasText: "販売管理システム刷新",
    });
    await projectCard.getByRole("button", { name: "Ganttへ" }).click();
    await expect(page.getByRole("button", { name: "タスク追加" })).toBeVisible();

    const assigneeFilter = page.getByLabel("担当者フィルター");
    await expect(assigneeFilter.locator('option[value="unassigned"]')).toHaveText("未割当");
    const filterStartedAt = Date.now();
    await assigneeFilter.selectOption("be");
    await expect(
      page.getByRole("button", {
        name: "3.2 API実装（C#） のタスク名を編集",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "1.1 現行業務ヒアリング のタスク名を編集",
        exact: true,
      }),
    ).toHaveCount(0);
    expect(Date.now() - filterStartedAt).toBeLessThan(1000);

    await assigneeFilter.selectOption("all");
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

  test("ガントバーの選択で開始日に移動しドラッグをEscで取り消せる", async ({ page }) => {
    await login(page);
    const projectCard = page.locator("article.portfolio-card").filter({
      hasText: "販売管理システム刷新",
    });
    await projectCard.getByRole("button", { name: "Ganttへ" }).click();
    await expect(page.getByRole("button", { name: "タスク追加" })).toBeVisible();

    const timelineBody = page.locator(".timeline-body");
    // 初期表示内にありつつ左寄せでスクロールが発生するタスクを使い、
    // 画面外の要素へマウス操作する不安定なテストを避ける。
    const taskBar = page.locator('.timeline-canvas .gantt-bar[data-task-id="current-review"]');
    await expect(taskBar).toBeVisible();
    await timelineBody.evaluate((element) => {
      element.scrollLeft = 0;
    });
    await expect.poll(() => timelineBody.evaluate((element) => element.scrollLeft)).toBe(0);

    const initialBox = await taskBar.boundingBox();
    if (!initialBox) {
      throw new Error("操作対象のガントバーが見つかりません。");
    }
    const initialScrollLeft = await timelineBody.evaluate((element) => element.scrollLeft);
    const centerX = initialBox.x + initialBox.width / 2;
    const centerY = initialBox.y + initialBox.height / 2;

    // クリック時の手ぶれではドラッグせず、開始日を左側の基準位置へ寄せる。
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 3, centerY);
    await page.mouse.up();

    await expect(taskBar).not.toHaveClass(/is-dragging/);
    await expect
      .poll(() => timelineBody.evaluate((element) => element.scrollLeft))
      .toBeGreaterThan(initialScrollLeft);
    const bodyBoxAfterSelection = await timelineBody.boundingBox();
    const selectedBox = await taskBar.boundingBox();
    if (!bodyBoxAfterSelection || !selectedBox) {
      throw new Error("選択後の開始日位置を取得できません。");
    }
    expect(selectedBox.x - bodyBoxAfterSelection.x).toBeCloseTo(
      bodyBoxAfterSelection.width * 0.14 + 7,
      0,
    );

    // 意図して動かし始めても、Escで確定せず元の位置へ戻せる。
    const selectedCenterX = selectedBox.x + selectedBox.width / 2;
    const selectedCenterY = selectedBox.y + selectedBox.height / 2;
    await page.mouse.move(selectedCenterX, selectedCenterY);
    await page.mouse.down();
    await page.mouse.move(selectedCenterX + 18, selectedCenterY);
    await expect(taskBar).toHaveClass(/is-dragging/);
    await page.keyboard.press("Escape");
    await page.mouse.up();

    await expect(taskBar).not.toHaveClass(/is-dragging/);
    const cancelledBox = await taskBar.boundingBox();
    expect(cancelledBox?.x).toBeCloseTo(selectedBox.x, 0);

    const bodyBox = await timelineBody.boundingBox();
    const scrollableBarBox = await taskBar.boundingBox();
    if (!bodyBox || !scrollableBarBox) {
      throw new Error("タイムラインのドラッグ領域が見つかりません。");
    }
    const originalLeft = await taskBar.evaluate((element) => element.style.left);
    const scrollStart = await timelineBody.evaluate((element) => element.scrollLeft);

    await page.mouse.move(
      scrollableBarBox.x + scrollableBarBox.width / 2,
      scrollableBarBox.y + scrollableBarBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(bodyBox.x + bodyBox.width - 3, scrollableBarBox.y + 6);
    await expect
      .poll(() => timelineBody.evaluate((element) => element.scrollLeft))
      .toBeGreaterThan(scrollStart);
    await page.keyboard.press("Escape");
    await page.mouse.up();

    await expect(taskBar).not.toHaveClass(/is-dragging/);
    await expect.poll(() => taskBar.evaluate((element) => element.style.transform)).toBe("");
    await expect.poll(() => taskBar.evaluate((element) => element.style.left)).toBe(originalLeft);
  });

  test("左側のタスク行を選択しても開始日に移動する", async ({ page }) => {
    await login(page);
    const projectCard = page.locator("article.portfolio-card").filter({
      hasText: "販売管理システム刷新",
    });
    await projectCard.getByRole("button", { name: "Ganttへ" }).click();

    const timelineBody = page.locator(".timeline-body");
    const taskRow = page.locator('.task-table-row[data-task-id="db-if-design"]');
    const taskBar = page.locator('.timeline-canvas .gantt-bar[data-task-id="db-if-design"]');
    await timelineBody.evaluate((element) => {
      element.scrollLeft = 0;
    });
    await taskRow.getByRole("button", { name: /DB \/ IF設計 のタスク名を編集/ }).click();

    await expect(taskRow).toHaveClass(/selected/);
    await expect
      .poll(() => timelineBody.evaluate((element) => element.scrollLeft))
      .toBeGreaterThan(0);
    const bodyBox = await timelineBody.boundingBox();
    const barBox = await taskBar.boundingBox();
    if (!bodyBox || !barBox) {
      throw new Error("開始日位置を取得できません。");
    }
    expect(barBox.x - bodyBox.x).toBeCloseTo(bodyBox.width * 0.14 + 7, 0);
  });

  test("複数選択したガントバーをまとめてドラッグ移動できる", async ({ page }) => {
    await login(page);
    const projectCard = page.locator("article.portfolio-card").filter({
      hasText: "販売管理システム刷新",
    });
    await projectCard.getByRole("button", { name: "Ganttへ" }).click();

    const firstRow = page.locator('.task-table-row[data-task-id="db-if-design"]');
    const secondRow = page.locator('.task-table-row[data-task-id="basic-review"]');
    await firstRow.click();
    await secondRow.click({ modifiers: ["Meta"] });
    await expect(firstRow).toHaveClass(/selected/);
    await expect(secondRow).toHaveClass(/selected/);

    const firstBar = page.locator('.timeline-canvas .gantt-bar[data-task-id="db-if-design"]');
    const secondBar = page.locator('.timeline-canvas .gantt-bar[data-task-id="basic-review"]');
    const firstBefore = await firstBar.boundingBox();
    const secondBefore = await secondBar.boundingBox();
    if (!firstBefore || !secondBefore) {
      throw new Error("複数移動するバーが見つかりません。");
    }

    await page.mouse.move(
      firstBefore.x + firstBefore.width / 2,
      firstBefore.y + firstBefore.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(firstBefore.x + firstBefore.width / 2 + 24, firstBefore.y + 6);
    await expect(page.locator(".drag-preview-bubble")).toContainText("2件");
    await page.mouse.up();

    const firstAfter = await firstBar.boundingBox();
    const secondAfter = await secondBar.boundingBox();
    expect(firstAfter).not.toBeNull();
    expect(secondAfter).not.toBeNull();
    const firstDelta = (firstAfter?.x ?? 0) - firstBefore.x;
    const secondDelta = (secondAfter?.x ?? 0) - secondBefore.x;
    expect(firstDelta).toBeGreaterThan(0);
    expect(secondDelta).toBeCloseTo(firstDelta, 0);
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
    await expect(page.getByText("開始日", { exact: true })).toBeVisible();
    await expect(page.getByText("終了日", { exact: true })).toBeVisible();
    await expect(page.locator(".task-date-cell").first()).toBeVisible();
    await expect(page.locator(".timeline-body")).toHaveCount(0);
    await expect(page.locator(".gantt-shell.table-view .table-header")).toHaveCSS(
      "position",
      "sticky",
    );
    await expect(page.locator(".gantt-shell.table-view .task-title").first()).toHaveCSS(
      "position",
      "sticky",
    );

    const titleHeader = page.getByRole("button", { name: "タスク名で並べ替え" });
    await titleHeader.click();
    await expect(titleHeader.locator("..")).toHaveAttribute("aria-sort", "ascending");
    await titleHeader.click();
    await expect(titleHeader.locator("..")).toHaveAttribute("aria-sort", "descending");
    await page.getByRole("button", { name: "階層順" }).click();
    await expect(page.getByRole("button", { name: "階層順" })).toBeDisabled();

    await viewModeControl.getByRole("button", { name: "ガント" }).click();
    await expect(page.locator(".timeline-body")).toBeVisible();
  });

  test("ポップアップは外側クリックと項目選択で閉じる", async ({ page }) => {
    await login(page);

    await page.getByRole("button", { name: "通知" }).click();
    await expect(page.locator(".notification-popover")).toBeVisible();
    await page.locator("main").click({ position: { x: 700, y: 600 } });
    await expect(page.locator(".notification-popover")).toHaveCount(0);

    const projectCard = page.locator("article.portfolio-card").filter({
      hasText: "販売管理システム刷新",
    });
    await projectCard.getByRole("button", { name: "Ganttへ" }).click();
    await page.getByRole("button", { name: "分析", exact: true }).click();
    await expect(page.getByLabel("分析のサブメニュー")).toBeVisible();
    await page.getByRole("button", { name: "プロジェクト分析", exact: true }).click();
    await expect(page.getByLabel("分析のサブメニュー")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "プロジェクト分析" })).toBeVisible();
  });

  test("Nキーで選択行の下へタスクを直接追加できる", async ({ page }) => {
    await login(page);
    const projectCard = page.locator("article.portfolio-card").filter({
      hasText: "販売管理システム刷新",
    });
    await projectCard.getByRole("button", { name: "Ganttへ" }).click();

    const anchorRow = page.locator('.task-table-row[data-task-id="db-if-design"]');
    await anchorRow.click();
    await expect(anchorRow).toHaveClass(/selected/);
    await page.keyboard.press("n");

    await expect(page.getByRole("dialog", { name: "タスク追加" })).toHaveCount(0);
    const titleInput = page.locator('.task-table-row.selected input[data-inline-field="title"]');
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toHaveValue("新しい作業項目");
  });
});
