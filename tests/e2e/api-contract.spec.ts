import { request as httpRequest } from "node:http";
import { zstdDecompressSync } from "node:zlib";

import { type APIRequestContext, type APIResponse, expect, test } from "@playwright/test";

type RawHttpResponse = {
  body: Buffer;
  headers: Record<string, string | string[] | undefined>;
  statusCode: number;
};

function getRawApiResponse(
  path: string,
  cookieHeader: string,
  acceptEncoding = "zstd",
): Promise<RawHttpResponse> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": acceptEncoding,
          Cookie: cookieHeader,
        },
        host: "127.0.0.1",
        method: "GET",
        path,
        port: 5080,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          resolve({
            body: Buffer.concat(chunks),
            headers: response.headers,
            statusCode: response.statusCode ?? 0,
          });
        });
      },
    );
    request.on("error", reject);
    request.end();
  });
}

type AuthSession = {
  cookieHeader: string;
  csrfToken: string;
};

async function login(request: APIRequestContext): Promise<AuthSession> {
  const response = await request.post("/api/auth/login", {
    data: { email: "pm@example.com", password: "Password123!" },
  });
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { user: { email: string } };
  expect(body.user.email).toBe("pm@example.com");
  expect(body).not.toHaveProperty("accessToken");
  const state = await request.storageState();
  const sessionCookie = state.cookies.find((cookie) => cookie.name === "mirai_session");
  const csrfCookie = state.cookies.find((cookie) => cookie.name === "mirai_csrf");
  if (!sessionCookie || !csrfCookie) {
    throw new Error("認証Cookieを取得できませんでした。");
  }
  return {
    cookieHeader: `${sessionCookie.name}=${sessionCookie.value}; ${csrfCookie.name}=${csrfCookie.value}`,
    csrfToken: csrfCookie.value,
  };
}

function csrfHeaders(session: AuthSession) {
  return { "X-CSRF-Token": session.csrfToken };
}

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
  await login(request);

  const summaryResponse = await request.get("/api/projects/summary");
  expect(summaryResponse.ok()).toBe(true);
  const summaries = (await summaryResponse.json()) as {
    project: { id: string; workspace: string };
    taskCount: number;
    progress: number;
  }[];

  expect(summaries.length).toBeGreaterThan(0);
  expect(summaries[0]?.project.id).toBeTruthy();
  expect(summaries[0]?.project.workspace).toBeTruthy();
  expect(summaries[0]?.taskCount).toBeGreaterThanOrEqual(0);
  expect(summaries[0]?.progress).toBeGreaterThanOrEqual(0);
});

test("ZstandardでAPIレスポンスを圧縮し、復元できる", async ({ request }) => {
  const session = await login(request);

  const response = await getRawApiResponse(
    "/api/projects/site-renewal/schedule",
    session.cookieHeader,
  );

  expect(response.statusCode).toBe(200);
  expect(response.headers["content-encoding"]).toBe("zstd");
  expect(response.headers.vary).toContain("Accept-Encoding");
  const schedule = JSON.parse(zstdDecompressSync(response.body).toString("utf8")) as {
    project: { id: string };
    tasks: { id: string }[];
  };
  expect(schedule.project.id).toBe("site-renewal");
  expect(schedule.tasks.length).toBeGreaterThan(0);

  const gzipResponse = await getRawApiResponse(
    "/api/projects/site-renewal/schedule",
    session.cookieHeader,
    "gzip",
  );
  expect(gzipResponse.headers["content-encoding"]).toBe("gzip");
});

test("案件一覧は個別スケジュールより小さく、短時間で取得できる", async ({ request }) => {
  await login(request);

  const startedAt = performance.now();
  const summaryResponse = await request.get("/api/projects/summary");
  const elapsedMs = performance.now() - startedAt;
  const summaryBody = await summaryResponse.text();

  const scheduleResponse = await request.get("/api/projects/site-renewal/schedule");
  const scheduleBody = await scheduleResponse.text();

  expect(summaryResponse.ok()).toBe(true);
  expect(scheduleResponse.ok()).toBe(true);
  expect(summaryBody.length).toBeLessThan(scheduleBody.length);
  expect(elapsedMs, `案件サマリー取得が${elapsedMs.toFixed(1)}msかかりました`).toBeLessThan(1500);
});

test("全案件詳細を返す旧ワークスペースAPIは公開しない", async ({ request }) => {
  await login(request);

  const response = await request.get("/api/workspace");

  expect(response.status()).toBe(404);
});

test("初期表示用ワークスペースサマリーは詳細タスクを含まない", async ({ request }) => {
  await login(request);

  const summaryResponse = await request.get("/api/workspace/summary");
  expect(summaryResponse.ok()).toBe(true);
  const summary = (await summaryResponse.json()) as {
    projects: { taskCount: number }[];
    teams: { id: string }[];
  };

  expect(summary.teams.length).toBeGreaterThan(0);
  expect(summary.projects.length).toBeGreaterThan(0);
  expect(summary.projects[0]?.taskCount).toBeGreaterThanOrEqual(0);
  expect(summary).not.toHaveProperty("schedules");
});

test("日報の作業明細を案件実績へ反映し、削除時に取り消せる", async ({ request }) => {
  const session = await login(request);
  const headers = csrfHeaders(session);
  const reportId = "e2e-daily-report";
  await request.delete(`/api/daily-reports/${reportId}`, { headers });

  const saveResponse = await request.put(`/api/daily-reports/${reportId}`, {
    data: {
      blockers: "確認事項なし",
      comments: [],
      date: "2025-05-20",
      entries: [
        {
          category: "meeting",
          hours: 1.5,
          id: "entry-1",
          projectId: "site-renewal",
          summary: "日報API確認",
          taskId: "task-ui-design",
        },
      ],
      memberId: "yk",
      nextPlan: "設計を継続",
      status: "submitted",
      summary: "日報保存テスト",
      version: 0,
    },
    headers,
  });
  expect(saveResponse.ok()).toBe(true);
  const report = (await saveResponse.json()) as {
    entries: { workLogId: string }[];
    version: number;
  };
  expect(report.version).toBe(1);
  expect(report.entries[0]?.workLogId).toBeTruthy();

  const commentResponse = await request.post(`/api/daily-reports/${reportId}/comments`, {
    data: { body: "APIからの確認コメント" },
    headers,
  });
  expect(commentResponse.ok()).toBe(true);
  const commentedReport = await commentResponse.json();
  expect(commentedReport.comments).toContainEqual(
    expect.objectContaining({ body: "APIからの確認コメント" }),
  );

  const reminderResponse = await request.post("/api/daily-reports/reminders", {
    data: { date: "2025-05-20", memberIds: ["yk"], teamId: "business-solutions" },
    headers,
  });
  expect(reminderResponse.ok()).toBe(true);
  const reminders = (await reminderResponse.json()) as { id: string }[];
  expect(reminders).toHaveLength(1);
  const reminderListResponse = await request.get("/api/daily-reports/reminders", { headers });
  expect(reminderListResponse.ok()).toBe(true);
  const reminderReadResponse = await request.post(
    `/api/daily-reports/reminders/${reminders[0]?.id}/read`,
    { headers },
  );
  expect(reminderReadResponse.status()).toBe(204);

  const scheduleResponse = await request.get("/api/projects/site-renewal/schedule", { headers });
  const schedule = (await scheduleResponse.json()) as {
    calendar: unknown;
    issues: unknown[];
    members: unknown[];
    project: { version: number };
    tasks: unknown[];
    workLogs: { dailyReportId?: string; hours: number; summary: string }[];
  };
  expect(schedule.workLogs).toContainEqual(
    expect.objectContaining({ dailyReportId: reportId, hours: 1.5, summary: "日報API確認" }),
  );

  let staleProjectSave: APIResponse | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const currentScheduleResponse = await request.get("/api/projects/site-renewal/schedule", {
      headers,
    });
    const currentSchedule = (await currentScheduleResponse.json()) as typeof schedule;
    staleProjectSave = await request.put("/api/projects/site-renewal/schedule", {
      data: {
        calendar: currentSchedule.calendar,
        expectedVersion: currentSchedule.project.version,
        issues: currentSchedule.issues ?? [],
        members: currentSchedule.members,
        project: currentSchedule.project,
        tasks: currentSchedule.tasks,
        workLogs: currentSchedule.workLogs.filter((log) => log.dailyReportId !== reportId),
      },
      headers,
    });
    if (staleProjectSave.ok()) {
      break;
    }
    expect(staleProjectSave.status()).toBe(409);
  }
  expect(staleProjectSave?.ok()).toBe(true);
  const protectedScheduleResponse = await request.get("/api/projects/site-renewal/schedule", {
    headers,
  });
  const protectedSchedule = (await protectedScheduleResponse.json()) as {
    workLogs: { dailyReportId?: string }[];
  };
  expect(protectedSchedule.workLogs.some((log) => log.dailyReportId === reportId)).toBe(true);

  const deleteResponse = await request.delete(`/api/daily-reports/${reportId}`, { headers });
  expect(deleteResponse.status()).toBe(204);
  const restoredScheduleResponse = await request.get("/api/projects/site-renewal/schedule", {
    headers,
  });
  const restoredSchedule = (await restoredScheduleResponse.json()) as {
    workLogs: { dailyReportId?: string }[];
  };
  expect(restoredSchedule.workLogs.some((log) => log.dailyReportId === reportId)).toBe(false);
});

test("プロジェクトスケジュールを同一内容で差分保存できる", async ({ request }) => {
  const session = await login(request);
  const headers = csrfHeaders(session);

  let scheduleResponse = await request.get("/api/projects/site-renewal/schedule", { headers });
  let schedule = await scheduleResponse.json();
  let saveResponse: APIResponse | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    saveResponse = await request.put("/api/projects/site-renewal/schedule", {
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
    if (saveResponse.ok()) {
      break;
    }
    expect(saveResponse.status()).toBe(409);
    scheduleResponse = await request.get("/api/projects/site-renewal/schedule", { headers });
    schedule = await scheduleResponse.json();
  }
  expect(saveResponse?.ok()).toBe(true);
  if (!saveResponse) {
    throw new Error("案件保存レスポンスを取得できませんでした。");
  }
  const saved = (await saveResponse.json()) as {
    schedule: {
      project: { assignments: unknown[]; staffingDemands: unknown[] };
      tasks: unknown[];
    };
  };
  expect(saved.schedule.tasks).toHaveLength(schedule.tasks.length);
  expect(Array.isArray(saved.schedule.project.assignments)).toBe(true);
  expect(Array.isArray(saved.schedule.project.staffingDemands)).toBe(true);

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

test("タスク計画専用APIは案件設定・課題・工数を維持して保存する", async ({ request }) => {
  const session = await login(request);
  const headers = csrfHeaders(session);
  const endpoint = "/api/projects/site-renewal";
  const scheduleResponse = await request.get(`${endpoint}/schedule`, { headers });
  const schedule = await scheduleResponse.json();

  const saveResponse = await request.put(`${endpoint}/tasks`, {
    data: {
      changeReason: "タスク計画専用APIの契約確認",
      expectedVersion: schedule.project.version,
      tasks: schedule.tasks,
    },
    headers,
  });

  expect(saveResponse.ok()).toBe(true);
  const saved = await saveResponse.json();
  expect(saved.schedule.project.version).toBe(schedule.project.version + 1);
  expect(saved.schedule.issues).toHaveLength(schedule.issues.length);
  expect(saved.schedule.workLogs).toHaveLength(schedule.workLogs.length);
  expect(saved.schedule.tasks).toHaveLength(schedule.tasks.length);

  const conflictResponse = await request.put(`${endpoint}/tasks`, {
    data: {
      expectedVersion: schedule.project.version,
      tasks: schedule.tasks,
    },
    headers,
  });
  expect(conflictResponse.status()).toBe(409);
});

test("プロジェクトNo.を案件情報として保存・取得できる", async ({ request }) => {
  const session = await login(request);
  const headers = csrfHeaders(session);
  const endpoint = "/api/projects/cloud-migration/schedule";
  const originalResponse = await request.get(endpoint, { headers });
  const original = await originalResponse.json();
  const testProjectNo = "PJ-E2E-999";

  const saveResponse = await request.put(endpoint, {
    data: {
      calendar: original.calendar,
      expectedVersion: original.project.version,
      issues: original.issues ?? [],
      members: original.members,
      project: { ...original.project, projectNo: testProjectNo },
      tasks: original.tasks,
      workLogs: original.workLogs ?? [],
    },
    headers,
  });
  expect(saveResponse.ok()).toBe(true);
  const saved = await saveResponse.json();
  expect(saved.schedule.project.projectNo).toBe(testProjectNo);

  const restoreResponse = await request.put(endpoint, {
    data: {
      calendar: saved.schedule.calendar,
      expectedVersion: saved.schedule.project.version,
      issues: saved.schedule.issues ?? [],
      members: saved.schedule.members,
      project: { ...saved.schedule.project, projectNo: original.project.projectNo ?? null },
      tasks: saved.schedule.tasks,
      workLogs: saved.schedule.workLogs ?? [],
    },
    headers,
  });
  expect(restoreResponse.ok()).toBe(true);
});

test("不正なタスク階層を保存せず400で拒否する", async ({ request }) => {
  const session = await login(request);
  const headers = csrfHeaders(session);
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
  const session = await login(request);
  const headers = csrfHeaders(session);

  const scheduleResponse = await request.get("/api/projects/crm-integration/schedule", { headers });
  expect(scheduleResponse.ok()).toBe(true);
  const schedule = (await scheduleResponse.json()) as {
    workLogs: { id: string }[];
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
    const attachments = (await listResponse.json()) as { id: string }[];
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
