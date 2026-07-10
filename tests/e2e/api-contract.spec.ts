import { expect, test } from "@playwright/test";

test("認証が必要なAPIは未認証リクエストを401で拒否する", async ({ request }) => {
  const response = await request.get("/api/workspace/summary");

  expect(response.status()).toBe(401);
});

test("不正なログイン情報ではセッションを発行しない", async ({ request }) => {
  const response = await request.post("/api/auth/login", {
    data: { email: "pm@example.com", password: "wrong-password" },
  });

  expect(response.status()).toBe(401);
});

test("認証後に軽量案件サマリーAPIを取得できる", async ({ request }) => {
  const loginResponse = await request.post("/api/auth/login", {
    data: { email: "pm@example.com", password: "Password123!" },
  });
  expect(loginResponse.ok()).toBe(true);
  const session = (await loginResponse.json()) as { token: string };

  const summaryResponse = await request.get("/api/projects/summary", {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  expect(summaryResponse.ok()).toBe(true);
  const summaries = (await summaryResponse.json()) as Array<{
    project: { id: string; workspace: string };
    taskCount: number;
    progress: number;
  }>;

  expect(summaries.length).toBeGreaterThan(0);
  expect(summaries[0]?.project.id).toBeTruthy();
  expect(summaries[0]?.project.workspace).toBeTruthy();
  expect(summaries[0]?.taskCount).toBeGreaterThanOrEqual(0);
  expect(summaries[0]?.progress).toBeGreaterThanOrEqual(0);
});

test("案件サマリーは全件ワークスペースより小さく、短時間で取得できる", async ({ request }) => {
  const loginResponse = await request.post("/api/auth/login", {
    data: { email: "pm@example.com", password: "Password123!" },
  });
  expect(loginResponse.ok()).toBe(true);
  const session = (await loginResponse.json()) as { token: string };
  const headers = { Authorization: `Bearer ${session.token}` };

  const startedAt = performance.now();
  const summaryResponse = await request.get("/api/projects/summary", { headers });
  const elapsedMs = performance.now() - startedAt;
  const summaryBody = await summaryResponse.text();

  const workspaceResponse = await request.get("/api/workspace", { headers });
  const workspaceBody = await workspaceResponse.text();

  expect(summaryResponse.ok()).toBe(true);
  expect(workspaceResponse.ok()).toBe(true);
  expect(summaryBody.length).toBeLessThan(workspaceBody.length);
  expect(elapsedMs, `案件サマリー取得が${elapsedMs.toFixed(1)}msかかりました`).toBeLessThan(1_500);
});

test("初期表示用ワークスペースサマリーは詳細タスクを含まない", async ({ request }) => {
  const loginResponse = await request.post("/api/auth/login", {
    data: { email: "pm@example.com", password: "Password123!" },
  });
  expect(loginResponse.ok()).toBe(true);
  const session = (await loginResponse.json()) as { token: string };

  const summaryResponse = await request.get("/api/workspace/summary", {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  expect(summaryResponse.ok()).toBe(true);
  const summary = (await summaryResponse.json()) as {
    projects: Array<{ taskCount: number }>;
    teams: Array<{ id: string }>;
  };

  expect(summary.teams.length).toBeGreaterThan(0);
  expect(summary.projects.length).toBeGreaterThan(0);
  expect(summary.projects[0]?.taskCount).toBeGreaterThanOrEqual(0);
  expect(summary).not.toHaveProperty("schedules");
});

test("プロジェクトスケジュールを同一内容で差分保存できる", async ({ request }) => {
  const loginResponse = await request.post("/api/auth/login", {
    data: { email: "pm@example.com", password: "Password123!" },
  });
  expect(loginResponse.ok()).toBe(true);
  const session = (await loginResponse.json()) as { token: string };
  const headers = { Authorization: `Bearer ${session.token}` };

  const scheduleResponse = await request.get("/api/projects/site-renewal/schedule", { headers });
  expect(scheduleResponse.ok()).toBe(true);
  const schedule = await scheduleResponse.json();

  const saveResponse = await request.put("/api/projects/site-renewal/schedule", {
    data: {
      calendar: schedule.calendar,
      expectedVersion: schedule.project.version,
      issues: schedule.issues ?? [],
      members: schedule.members,
      project: schedule.project,
      tasks: schedule.tasks,
      workLogs: schedule.workLogs ?? [],
    },
    headers,
  });
  expect(saveResponse.ok()).toBe(true);
  const saved = (await saveResponse.json()) as { schedule: { tasks: unknown[] } };
  expect(saved.schedule.tasks).toHaveLength(schedule.tasks.length);

  const conflictResponse = await request.put("/api/projects/site-renewal/schedule", {
    data: {
      calendar: schedule.calendar,
      expectedVersion: schedule.project.version,
      issues: schedule.issues ?? [],
      members: schedule.members,
      project: schedule.project,
      tasks: schedule.tasks,
      workLogs: schedule.workLogs ?? [],
    },
    headers,
  });
  expect(conflictResponse.status()).toBe(409);
});

test("不正なタスク階層を保存せず400で拒否する", async ({ request }) => {
  const loginResponse = await request.post("/api/auth/login", {
    data: { email: "pm@example.com", password: "Password123!" },
  });
  expect(loginResponse.ok()).toBe(true);
  const session = (await loginResponse.json()) as { token: string };
  const headers = { Authorization: `Bearer ${session.token}` };
  const scheduleResponse = await request.get("/api/projects/site-renewal/schedule", { headers });
  const schedule = await scheduleResponse.json();
  const invalidTasks = schedule.tasks.map((task: { id: string }, index: number) =>
    index === 0 ? { ...task, parentId: "missing-parent" } : task,
  );

  const response = await request.put("/api/projects/site-renewal/schedule", {
    data: {
      calendar: schedule.calendar,
      expectedVersion: schedule.project.version,
      issues: schedule.issues ?? [],
      members: schedule.members,
      project: schedule.project,
      tasks: invalidTasks,
      workLogs: schedule.workLogs ?? [],
    },
    headers,
  });
  expect(response.status()).toBe(400);
});

test("案件の作業ログへ添付ファイルを保存・取得・削除できる", async ({ request }) => {
  const loginResponse = await request.post("/api/auth/login", {
    data: { email: "pm@example.com", password: "Password123!" },
  });
  expect(loginResponse.ok()).toBe(true);
  const session = (await loginResponse.json()) as { token: string };
  const headers = { Authorization: `Bearer ${session.token}` };

  const scheduleResponse = await request.get("/api/projects/crm-integration/schedule", { headers });
  expect(scheduleResponse.ok()).toBe(true);
  const schedule = (await scheduleResponse.json()) as {
    workLogs: Array<{ id: string }>;
  };
  const workLogId = schedule.workLogs[0]?.id;
  expect(workLogId).toBeTruthy();

  const uploadResponse = await request.post("/api/projects/crm-integration/attachments", {
    headers,
    multipart: {
      ownerType: "workLog",
      ownerId: workLogId as string,
      file: {
        name: "operation-log.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("運用保守の確認ログ\n", "utf8"),
      },
    },
  });
  expect(uploadResponse.ok()).toBe(true);
  const attachment = (await uploadResponse.json()) as {
    id: string;
    fileName: string;
    sizeBytes: number;
    sha256: string;
    downloadUrl: string;
  };
  expect(attachment.fileName).toBe("operation-log.txt");
  expect(attachment.sizeBytes).toBeGreaterThan(0);
  expect(attachment.sha256).toHaveLength(64);

  try {
    const listResponse = await request.get("/api/projects/crm-integration/attachments", {
      headers,
    });
    expect(listResponse.ok()).toBe(true);
    const attachments = (await listResponse.json()) as Array<{ id: string }>;
    expect(attachments.some((item) => item.id === attachment.id)).toBe(true);

    const downloadResponse = await request.get(attachment.downloadUrl, { headers });
    expect(downloadResponse.ok()).toBe(true);
    expect(await downloadResponse.text()).toBe("運用保守の確認ログ\n");
  } finally {
    const deleteResponse = await request.delete(
      `/api/projects/crm-integration/attachments/${attachment.id}`,
      { headers },
    );
    expect(deleteResponse.status()).toBe(204);
  }
});
