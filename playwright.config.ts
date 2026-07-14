import { defineConfig, devices } from "@playwright/test";

/**
 * COMPASSのE2E実行設定です。
 * フロントとAPIを同時に起動し、既に開発サーバーが動いている場合は再利用します。
 */
export default defineConfig({
  testDir: "./tests",
  // API統合テストは共有SQLiteを更新するため、直列実行して検証結果を再現可能にします。
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  expect: { timeout: 5000 },
  use: {
    baseURL: "http://127.0.0.1:5174",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    ...devices["Desktop Chrome"],
  },
  webServer: [
    {
      command: "npm run dev -- --port 5174",
      cwd: "./frontend",
      url: "http://127.0.0.1:5174/",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command:
        "dotnet run --project backend/src/Schedule.Api/Schedule.Api.csproj --urls http://127.0.0.1:5080",
      env: { ASPNETCORE_ENVIRONMENT: "Development" },
      url: "http://127.0.0.1:5080/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
