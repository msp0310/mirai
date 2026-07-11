using Microsoft.EntityFrameworkCore;
using Schedule.Api.Application;
using Schedule.Api.Contracts;
using Schedule.Api.Domain;
using System.Data;

namespace Schedule.Api.Infrastructure;

/// <summary>ローカル開発環境に必要な最小データを冪等に投入します。</summary>
public static class SeedData
{
    private const string InitialMigrationId = "20260709195739_InitialCreate";
    private const string EfCoreProductVersion = "10.0.9";
    private static readonly string[] BusinessTeamMemberIds = ["yk", "st", "ui", "fe", "be", "qa"];
    private static readonly string[] CloudTeamMemberIds = ["yk", "be", "qa"];

    /// <summary>MigrationでDBスキーマを準備し、許可された環境だけ開発用データを投入します。</summary>
    public static async Task EnsureSeededAsync(
        ScheduleDbContext db,
        bool seedDevelopmentData,
        CancellationToken cancellationToken)
    {
        await ConfigureSqliteAsync(db, cancellationToken);
        if (await HasLegacySchemaAsync(db, cancellationToken))
        {
            // 旧EnsureCreated環境は既存テーブルを作り直さず、初期Migrationを適用済みとして扱います。
            await db.Database.EnsureCreatedAsync(cancellationToken);
        }
        else
        {
            await db.Database.MigrateAsync(cancellationToken);
        }

        await EnsureAuthSchemaAsync(db, cancellationToken);
        await EnsureIssueSchemaAsync(db, cancellationToken);
        await EnsureWorkLogSchemaAsync(db, cancellationToken);
        await EnsureMigrationBaselineAsync(db, cancellationToken);
        // 既存DBは初期Migrationをベースライン登録した後、将来の未適用Migrationだけを適用します。
        await db.Database.MigrateAsync(cancellationToken);
        if (!seedDevelopmentData)
        {
            return;
        }

        await EnsureAuthUserSeededAsync(db, cancellationToken);
        await EnsureIssueSeededAsync(db, cancellationToken);
        await EnsureWorkLogSeededAsync(db, cancellationToken);

        if (await db.Projects.AnyAsync(cancellationToken))
        {
            return;
        }

        var teams = new[]
        {
            new TeamEntity
            {
                Id = "business-solutions",
                Name = "業務システム事業部",
                Code = "業",
                Description = "基幹・業務システム開発を担当するチーム"
            },
            new TeamEntity
            {
                Id = "cloud-platform",
                Name = "クラウド基盤チーム",
                Code = "基",
                Description = "認証基盤、クラウド移行、運用基盤を担当するチーム"
            }
        };
        db.Teams.AddRange(teams);

        var members = new[]
        {
            Member("yk", "山田 健太", "YK", "PM", "#675df6"),
            Member("st", "佐藤 翔", "ST", "PL", "#ff7a8a"),
            Member("ui", "鈴木 優子", "UI", "SE", "#35b979"),
            Member("fe", "高橋 美咲", "FE", "FE", "#2f80ed"),
            Member("be", "伊藤 大輔", "BE", "BE", "#8b70f6"),
            Member("qa", "中村 彩", "QA", "QA", "#0ea5a3")
        };
        db.Members.AddRange(members);

        teams[0].Members.AddRange(BusinessTeamMemberIds.Select(memberId => new TeamMemberEntity
        {
            TeamId = teams[0].Id,
            MemberId = memberId
        }));
        teams[1].Members.AddRange(CloudTeamMemberIds.Select(memberId => new TeamMemberEntity
        {
            TeamId = teams[1].Id,
            MemberId = memberId
        }));

        AddProject(
            db,
            Project(
                "site-renewal",
                "business-solutions",
                "販売管理システム刷新",
                "販売管理システム刷新",
                "inProgress",
                ["yk", "st", "ui", "fe", "be", "qa"],
                "2025-04-28",
                "2025-06-22",
                "結合テスト開始",
                "2025-06-05"),
            Calendar("calendar-site-renewal"),
            [
                Task("root", null, "販売管理システム刷新（全体）", "summary", "inProgress", "2025-05-05", "2025-06-20", 41, ["yk"], "#5865e8", true),
                Task("phase-requirements", "root", "1. 要件定義", "phase", "done", "2025-05-05", "2025-05-16", 100, ["yk"], "#0ea5a3", true),
                Task("current-review", "phase-requirements", "1.1 現行業務ヒアリング", "task", "done", "2025-05-05", "2025-05-08", 100, ["yk"], "#89b7ff"),
                Task("requirement-list", "phase-requirements", "1.2 業務要件整理", "task", "done", "2025-05-09", "2025-05-14", 100, ["yk", "st"], "#89b7ff", dependencies: ["current-review"]),
                Task("requirement-approval", "phase-requirements", "要件定義承認", "milestone", "done", "2025-05-16", "2025-05-16", 100, ["yk"], "#0f69c9", dependencies: ["requirement-list"]),
                Task("phase-design", "root", "2. 基本設計", "phase", "inProgress", "2025-05-19", "2025-06-06", 53, ["yk", "st", "ui"], "#2f73e0", true, dependencies: ["requirement-approval"]),
                Task("screen-design", "phase-design", "2.1 画面・帳票設計", "task", "done", "2025-05-19", "2025-05-23", 100, ["yk"], "#89b7ff"),
                Task("db-if-design", "phase-design", "2.2 DB / IF設計", "task", "inProgress", "2025-05-23", "2025-05-30", 65, ["st"], "#89b7ff", dependencies: ["screen-design"]),
                Task("basic-review", "phase-design", "2.3 基本設計レビュー", "task", "inProgress", "2025-05-30", "2025-06-06", 35, ["ui"], "#89b7ff", dependencies: ["db-if-design"]),
                Task("phase-build", "root", "3. 詳細設計・実装", "phase", "inProgress", "2025-06-02", "2025-06-13", 9, ["fe", "be"], "#29a862", true, dependencies: ["basic-review"]),
                Task("detail-design", "phase-build", "3.1 詳細設計", "task", "inProgress", "2025-06-02", "2025-06-06", 35, ["fe"], "#9addb8"),
                Task("api-build", "phase-build", "3.2 API実装（C#）", "task", "notStarted", "2025-06-03", "2025-06-11", 0, ["be"], "#dfe7ef"),
                Task("frontend-build", "phase-build", "3.3 フロント実装", "task", "notStarted", "2025-06-06", "2025-06-13", 0, ["fe", "be"], "#dfe7ef"),
                Task("phase-release", "root", "4. 結合・移行・リリース", "phase", "delayed", "2025-06-10", "2025-06-20", 0, ["qa", "yk"], "#f7933d", true),
                Task("integration-test", "phase-release", "4.1 結合テスト", "task", "notStarted", "2025-06-10", "2025-06-17", 0, ["qa"], "#ffc184"),
                Task("release-judge", "phase-release", "本番リリース判定", "milestone", "notStarted", "2025-06-20", "2025-06-20", 0, ["yk"], "#0f69c9")
            ]);

        AddProject(
            db,
            Project(
                "crm-integration",
                "business-solutions",
                "CRM連携基盤構築",
                "CRM連携基盤構築",
                "planning",
                ["st", "fe", "be", "qa"],
                "2025-05-12",
                "2025-07-06",
                "外部IFレビュー",
                "2025-06-12"),
            Calendar("calendar-crm"),
            [
                Task("crm-root", null, "CRM連携基盤構築（全体）", "summary", "inProgress", "2025-05-12", "2025-07-02", 24, ["st"], "#5865e8", true),
                Task("crm-plan", "crm-root", "1. 方式設計", "phase", "inProgress", "2025-05-12", "2025-05-30", 58, ["st", "be"], "#0ea5a3", true),
                Task("crm-api-list", "crm-plan", "1.1 連携API棚卸し", "task", "done", "2025-05-12", "2025-05-16", 100, ["st"], "#8bd4d2"),
                Task("crm-auth", "crm-plan", "1.2 認証方式検討", "task", "inProgress", "2025-05-19", "2025-05-28", 55, ["be"], "#8bd4d2"),
                Task("crm-if-review", "crm-plan", "外部IFレビュー", "milestone", "notStarted", "2025-06-12", "2025-06-12", 0, ["st"], "#0f69c9"),
                Task("crm-build", "crm-root", "2. 実装・テスト", "phase", "notStarted", "2025-06-03", "2025-07-02", 0, ["fe", "be", "qa"], "#29a862", true),
                Task("crm-sync", "crm-build", "2.1 データ同期バッチ", "task", "notStarted", "2025-06-03", "2025-06-16", 0, ["be"], "#9addb8"),
                Task("crm-screen", "crm-build", "2.2 連携状態画面", "task", "notStarted", "2025-06-10", "2025-06-24", 0, ["fe"], "#9addb8"),
                Task("crm-test", "crm-build", "2.3 結合テスト", "task", "notStarted", "2025-06-24", "2025-07-02", 0, ["qa"], "#9addb8")
            ],
            [
                Issue(
                    "crm-issue-auth-review",
                    "認証方式の顧客確認が未完了",
                    "OAuth連携時の権限範囲について顧客確認待ち。方式設計の確定条件として管理する。",
                    "inProgress",
                    "high",
                    "question",
                    ["st"],
                    ["crm-auth"],
                    "2025-05-28",
                    "uniface/schedule-manager",
                    42,
                    "https://github.com/uniface/schedule-manager/issues/42"),
                Issue(
                    "crm-issue-rate-limit",
                    "CRM APIのレート制限リスク",
                    "夜間バッチの同期件数が増えた場合にAPI制限へ到達する可能性がある。",
                    "open",
                    "medium",
                    "risk",
                    ["be"],
                    ["crm-sync"],
                    "2025-06-06")
            ],
            [
                WorkLog(
                    "crm-worklog-ops-check",
                    "crm-integration",
                    "2025-05-22",
                    "be",
                    2.5m,
                    "maintenance",
                    "連携バッチ監視設定の確認",
                    "初回運用で監視通知の宛先と再実行手順を確認。",
                    "crm-sync",
                    null,
                    true),
                WorkLog(
                    "crm-worklog-customer-question",
                    "crm-integration",
                    "2025-05-23",
                    "st",
                    1.25m,
                    "support",
                    "顧客からの権限範囲問い合わせ対応",
                    "OAuth権限の説明資料を更新。",
                    "crm-auth",
                    "crm-issue-auth-review",
                    true)
            ]);

        AddProject(
            db,
            Project(
                "cloud-migration",
                "cloud-platform",
                "認証基盤クラウド移行",
                "認証基盤クラウド移行",
                "inProgress",
                ["yk", "be", "qa"],
                "2025-05-05",
                "2025-06-29",
                "移行リハーサル",
                "2025-06-18"),
            Calendar("calendar-cloud"),
            [
                Task("cloud-root", null, "認証基盤クラウド移行（全体）", "summary", "inProgress", "2025-05-07", "2025-06-27", 38, ["yk"], "#4b6ddf", true),
                Task("cloud-assessment", "cloud-root", "1. 現状調査", "phase", "done", "2025-05-07", "2025-05-21", 100, ["yk", "be"], "#0ea5a3", true),
                Task("cloud-inventory", "cloud-assessment", "1.1 サーバー・ジョブ棚卸し", "task", "done", "2025-05-07", "2025-05-14", 100, ["be"], "#8bd4d2"),
                Task("cloud-risk", "cloud-assessment", "1.2 移行リスク整理", "task", "done", "2025-05-15", "2025-05-21", 100, ["yk"], "#8bd4d2"),
                Task("cloud-design", "cloud-root", "2. 移行設計", "phase", "inProgress", "2025-05-22", "2025-06-13", 44, ["be"], "#2f73e0", true),
                Task("cloud-network", "cloud-design", "2.1 ネットワーク設計", "task", "inProgress", "2025-05-22", "2025-06-02", 64, ["be"], "#89b7ff"),
                Task("cloud-runbook", "cloud-design", "2.2 運用手順書", "task", "inProgress", "2025-06-03", "2025-06-13", 25, ["qa"], "#89b7ff"),
                Task("cloud-rehearsal", "cloud-root", "移行リハーサル", "milestone", "notStarted", "2025-06-18", "2025-06-18", 0, ["yk", "be"], "#0f69c9"),
                Task("cloud-switch", "cloud-root", "3. 本番切替", "phase", "notStarted", "2025-06-19", "2025-06-27", 0, ["yk", "be", "qa"], "#f7933d", true)
            ]);

        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>旧来の手動スキーマが存在するかを確認します。</summary>
    private static async Task<bool> HasLegacySchemaAsync(
        ScheduleDbContext db,
        CancellationToken cancellationToken)
    {
        var connection = db.Database.GetDbConnection();
        if (connection.State != System.Data.ConnectionState.Open)
        {
            await connection.OpenAsync(cancellationToken);
        }

        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT EXISTS(
                SELECT 1 FROM sqlite_master
                WHERE type = 'table' AND name IN ('Projects', 'Users')
            );
            """;
        return Convert.ToInt32(
            await command.ExecuteScalarAsync(cancellationToken),
            System.Globalization.CultureInfo.InvariantCulture) == 1;
    }

    /// <summary>旧DBをMigration管理へ移行するための初期履歴を冪等に登録します。</summary>
    private static async Task EnsureMigrationBaselineAsync(
        ScheduleDbContext db,
        CancellationToken cancellationToken)
    {
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
                "MigrationId" TEXT NOT NULL CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY,
                "ProductVersion" TEXT NOT NULL
            );
            """, cancellationToken);
        await db.Database.ExecuteSqlRawAsync($"""
            INSERT OR IGNORE INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
            VALUES ('{InitialMigrationId}', '{EfCoreProductVersion}');
            """, cancellationToken);
    }

    /// <summary>読み取りと書き込みの同時利用に適したSQLite接続設定を適用します。</summary>
    private static async Task ConfigureSqliteAsync(
        ScheduleDbContext db,
        CancellationToken cancellationToken)
    {
        await db.Database.ExecuteSqlRawAsync("PRAGMA foreign_keys = ON;", cancellationToken);
        await db.Database.ExecuteSqlRawAsync("PRAGMA journal_mode = WAL;", cancellationToken);
        await db.Database.ExecuteSqlRawAsync("PRAGMA synchronous = NORMAL;", cancellationToken);
    }

    private static async Task EnsureAuthSchemaAsync(
        ScheduleDbContext db,
        CancellationToken cancellationToken)
    {
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS Users (
                Id TEXT NOT NULL CONSTRAINT PK_Users PRIMARY KEY,
                MemberId TEXT NULL,
                Email TEXT NOT NULL,
                EmailNormalized TEXT NOT NULL,
                Name TEXT NOT NULL,
                Role TEXT NOT NULL,
                PasswordHash TEXT NOT NULL,
                IsActive INTEGER NOT NULL,
                CreatedAt TEXT NOT NULL,
                LastLoginAt TEXT NULL,
                PasswordChangedAt TEXT NULL,
                PasswordResetRequired INTEGER NOT NULL DEFAULT 0
            );
            """, cancellationToken);
        await EnsureColumnAsync(db, "Users", "MemberId", "TEXT NULL", cancellationToken);
        await EnsureColumnAsync(db, "Users", "LastLoginAt", "TEXT NULL", cancellationToken);
        await EnsureColumnAsync(db, "Users", "PasswordChangedAt", "TEXT NULL", cancellationToken);
        await EnsureColumnAsync(
            db,
            "Users",
            "PasswordResetRequired",
            "INTEGER NOT NULL DEFAULT 0",
            cancellationToken);
        await db.Database.ExecuteSqlRawAsync("""
            CREATE UNIQUE INDEX IF NOT EXISTS IX_Users_EmailNormalized
            ON Users (EmailNormalized);
            """, cancellationToken);
        await db.Database.ExecuteSqlRawAsync("""
            CREATE UNIQUE INDEX IF NOT EXISTS IX_Users_MemberId
            ON Users (MemberId)
            WHERE MemberId IS NOT NULL;
            """, cancellationToken);
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS AuthSessions (
                Id TEXT NOT NULL CONSTRAINT PK_AuthSessions PRIMARY KEY,
                UserId TEXT NOT NULL,
                TokenHash TEXT NOT NULL,
                CreatedAt TEXT NOT NULL,
                ExpiresAt TEXT NOT NULL,
                RevokedAt TEXT NULL,
                CONSTRAINT FK_AuthSessions_Users_UserId
                    FOREIGN KEY (UserId) REFERENCES Users (Id) ON DELETE CASCADE
            );
            """, cancellationToken);
        await db.Database.ExecuteSqlRawAsync("""
            CREATE UNIQUE INDEX IF NOT EXISTS IX_AuthSessions_TokenHash
            ON AuthSessions (TokenHash);
            """, cancellationToken);
        await db.Database.ExecuteSqlRawAsync("""
            CREATE INDEX IF NOT EXISTS IX_AuthSessions_UserId_ExpiresAt
            ON AuthSessions (UserId, ExpiresAt);
            """, cancellationToken);
    }

    private static async Task EnsureColumnAsync(
        ScheduleDbContext db,
        string tableName,
        string columnName,
        string definition,
        CancellationToken cancellationToken)
    {
        var connection = db.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
        {
            await connection.OpenAsync(cancellationToken);
        }

        await using (var command = connection.CreateCommand())
        {
            command.CommandText = $"PRAGMA table_info({tableName});";
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                if (string.Equals(
                    reader.GetString(1),
                    columnName,
                    StringComparison.OrdinalIgnoreCase))
                {
                    return;
                }
            }
        }

        await using var alterCommand = connection.CreateCommand();
        alterCommand.CommandText = $"ALTER TABLE {tableName} ADD COLUMN {columnName} {definition};";
        await alterCommand.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task EnsureAuthUserSeededAsync(
        ScheduleDbContext db,
        CancellationToken cancellationToken)
    {
        var email = "pm@example.com";
        var normalizedEmail = AuthService.NormalizeEmail(email);
        var existingUser = await db.Users.SingleOrDefaultAsync(
            user => user.EmailNormalized == normalizedEmail,
            cancellationToken);
        if (existingUser is not null)
        {
            existingUser.MemberId ??= "yk";
            existingUser.Name = existingUser.Name == "プロジェクトマネージャー"
                ? "山田 健太"
                : existingUser.Name;
            existingUser.Role = "admin";
            existingUser.IsActive = true;
            existingUser.PasswordChangedAt ??= DateTimeOffset.UtcNow.ToString("O");
            await db.SaveChangesAsync(cancellationToken);
            return;
        }

        db.Users.Add(new UserEntity
        {
            Id = "demo-pm",
            MemberId = "yk",
            Email = email,
            EmailNormalized = normalizedEmail,
            Name = "山田 健太",
            Role = "admin",
            PasswordHash = PasswordHasher.HashPassword("Password123!"),
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow.ToString("O"),
            PasswordChangedAt = DateTimeOffset.UtcNow.ToString("O")
        });
        await db.SaveChangesAsync(cancellationToken);
    }

    private static async Task EnsureIssueSchemaAsync(
        ScheduleDbContext db,
        CancellationToken cancellationToken)
    {
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS ProjectIssues (
                Id TEXT NOT NULL CONSTRAINT PK_ProjectIssues PRIMARY KEY,
                ProjectId TEXT NOT NULL,
                Title TEXT NOT NULL,
                Body TEXT NOT NULL,
                Status TEXT NOT NULL,
                Priority TEXT NOT NULL,
                Type TEXT NOT NULL,
                AssigneeIdsJson TEXT NOT NULL DEFAULT '[]',
                TaskIdsJson TEXT NOT NULL DEFAULT '[]',
                RepliesJson TEXT NOT NULL DEFAULT '[]',
                DueDate TEXT NULL,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NOT NULL,
                ClosedAt TEXT NULL,
                GitHubRepository TEXT NULL,
                GitHubIssueNumber INTEGER NULL,
                GitHubUrl TEXT NULL,
                GitHubState TEXT NULL,
                GitHubSyncStatus TEXT NULL,
                GitHubLastSyncedAt TEXT NULL,
                CONSTRAINT FK_ProjectIssues_Projects_ProjectId
                    FOREIGN KEY (ProjectId) REFERENCES Projects (Id) ON DELETE CASCADE
            );
            """, cancellationToken);
        if (!await HasColumnAsync(db, "ProjectIssues", "RepliesJson", cancellationToken))
        {
            await db.Database.ExecuteSqlRawAsync("""
                ALTER TABLE ProjectIssues
                ADD COLUMN RepliesJson TEXT NOT NULL DEFAULT '[]';
                """, cancellationToken);
        }
        await db.Database.ExecuteSqlRawAsync("""
            CREATE INDEX IF NOT EXISTS IX_ProjectIssues_ProjectId_UpdatedAt
            ON ProjectIssues (ProjectId, UpdatedAt);
            """, cancellationToken);
    }

    private static async Task EnsureWorkLogSchemaAsync(
        ScheduleDbContext db,
        CancellationToken cancellationToken)
    {
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS ProjectWorkLogs (
                Id TEXT NOT NULL CONSTRAINT PK_ProjectWorkLogs PRIMARY KEY,
                ProjectId TEXT NOT NULL,
                Date TEXT NOT NULL,
                MemberId TEXT NOT NULL,
                Hours TEXT NOT NULL,
                Category TEXT NOT NULL,
                Summary TEXT NOT NULL,
                Note TEXT NULL,
                TaskId TEXT NULL,
                IssueId TEXT NULL,
                Billable INTEGER NOT NULL,
                CreatedBy TEXT NOT NULL,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NOT NULL,
                CONSTRAINT FK_ProjectWorkLogs_Projects_ProjectId
                    FOREIGN KEY (ProjectId) REFERENCES Projects (Id) ON DELETE CASCADE
            );
            """, cancellationToken);
        await db.Database.ExecuteSqlRawAsync("""
            CREATE INDEX IF NOT EXISTS IX_ProjectWorkLogs_ProjectId_Date
            ON ProjectWorkLogs (ProjectId, Date);
            """, cancellationToken);
    }

    private static async Task<bool> HasColumnAsync(
        ScheduleDbContext db,
        string tableName,
        string columnName,
        CancellationToken cancellationToken)
    {
        var connection = db.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
        {
            await connection.OpenAsync(cancellationToken);
        }

        await using var command = connection.CreateCommand();
        command.CommandText = $"PRAGMA table_info({tableName});";
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            if (string.Equals(reader.GetString(1), columnName, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    private static async Task EnsureIssueSeededAsync(
        ScheduleDbContext db,
        CancellationToken cancellationToken)
    {
        if (await db.ProjectIssues.AnyAsync(cancellationToken))
        {
            return;
        }

        if (!await db.Projects.AnyAsync(project => project.Id == "crm-integration", cancellationToken))
        {
            return;
        }

        db.ProjectIssues.AddRange(
            ScheduleMapper.ToEntity(
                Issue(
                    "crm-issue-auth-review",
                    "認証方式の顧客確認が未完了",
                    "OAuth連携時の権限範囲について顧客確認待ち。方式設計の確定条件として管理する。",
                    "inProgress",
                    "high",
                    "question",
                    ["st"],
                    ["crm-auth"],
                    "2025-05-28",
                    "uniface/schedule-manager",
                    42,
                    "https://github.com/uniface/schedule-manager/issues/42"),
                "crm-integration"),
            ScheduleMapper.ToEntity(
                Issue(
                    "crm-issue-rate-limit",
                    "CRM APIのレート制限リスク",
                    "夜間バッチの同期件数が増えた場合にAPI制限へ到達する可能性がある。",
                    "open",
                    "medium",
                    "risk",
                    ["be"],
                    ["crm-sync"],
                    "2025-06-06"),
                "crm-integration"));
        await db.SaveChangesAsync(cancellationToken);
    }

    private static async Task EnsureWorkLogSeededAsync(
        ScheduleDbContext db,
        CancellationToken cancellationToken)
    {
        if (await db.ProjectWorkLogs.AnyAsync(cancellationToken))
        {
            return;
        }

        if (!await db.Projects.AnyAsync(project => project.Id == "crm-integration", cancellationToken))
        {
            return;
        }

        db.ProjectWorkLogs.AddRange(
            WorkLog(
                "crm-worklog-ops-check",
                "crm-integration",
                "2025-05-22",
                "be",
                2.5m,
                "maintenance",
                "連携バッチ監視設定の確認",
                "初回運用で監視通知の宛先と再実行手順を確認。",
                "crm-sync",
                null,
                true),
            WorkLog(
                "crm-worklog-customer-question",
                "crm-integration",
                "2025-05-23",
                "st",
                1.25m,
                "support",
                "顧客からの権限範囲問い合わせ対応",
                "OAuth権限の説明資料を更新。",
                "crm-auth",
                "crm-issue-auth-review",
                true));
        await db.SaveChangesAsync(cancellationToken);
    }

    private static MemberEntity Member(
        string id,
        string name,
        string initials,
        string role,
        string color)
    {
        return new MemberEntity
        {
            Id = id,
            Name = name,
            Initials = initials,
            Role = role,
            Color = color,
            CapacityHours = 7.5m,
            Status = "active"
        };
    }

    private static ProjectDto Project(
        string id,
        string teamId,
        string name,
        string workspace,
        string lifecycleStatus,
        IReadOnlyList<string> memberIds,
        string rangeStart,
        string rangeEnd,
        string nextMilestoneTitle,
        string nextMilestoneDate)
    {
        return new ProjectDto(
            id,
            teamId,
            name,
            workspace,
            lifecycleStatus,
            memberIds,
            rangeStart,
            rangeEnd,
            new NextMilestoneDto(nextMilestoneTitle, nextMilestoneDate),
            "active",
            null,
            1,
            memberIds.Select((memberId, index) => new ProjectAssignmentDto(
                $"{id}-assignment-{memberId}",
                memberId,
                GetStaffingRole(memberId),
                rangeStart,
                rangeEnd,
                index == 0 ? 50 : 80,
                "confirmed")).ToArray(),
            [new StaffingDemandDto(
                $"{id}-demand-be",
                "BE",
                rangeStart,
                rangeEnd,
                1,
                50,
                "open")]);
    }

    private static string GetStaffingRole(string memberId) => memberId switch
    {
        "yk" => "PM",
        "st" => "PL",
        "fe" => "FE",
        "be" => "BE",
        "qa" => "QA",
        _ => "SE"
    };

    private static CalendarDefinitionDto Calendar(string id)
    {
        return new CalendarDefinitionDto(
            id,
            "標準カレンダー",
            [1, 2, 3, 4, 5],
            [
                new CalendarHolidayDto("2025-05-03", "憲法記念日"),
                new CalendarHolidayDto("2025-05-04", "みどりの日"),
                new CalendarHolidayDto("2025-05-05", "こどもの日"),
                new CalendarHolidayDto("2025-05-06", "振替休日")
            ]);
    }

    private static ScheduleTaskDto Task(
        string id,
        string? parentId,
        string title,
        string type,
        string status,
        string start,
        string end,
        int progress,
        IReadOnlyList<string> assigneeIds,
        string color,
        bool? expanded = null,
        IReadOnlyList<string>? dependencies = null)
    {
        return new ScheduleTaskDto(
            id,
            parentId,
            title,
            type,
            status,
            start,
            end,
            progress,
            assigneeIds,
            null,
            color,
            expanded,
            dependencies,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null);
    }

    private static ProjectIssueDto Issue(
        string id,
        string title,
        string body,
        string status,
        string priority,
        string type,
        IReadOnlyList<string> assigneeIds,
        IReadOnlyList<string> taskIds,
        string? dueDate,
        string? githubRepository = null,
        int? githubIssueNumber = null,
        string? githubUrl = null)
    {
        var now = DateTimeOffset.UtcNow.ToString("O");
        var github = githubRepository is not null || githubIssueNumber is not null || githubUrl is not null
            ? new ProjectIssueGitHubDto(
                githubRepository,
                githubIssueNumber,
                githubUrl,
                "open",
                "linked",
                null)
            : null;
        return new ProjectIssueDto(
            id,
            title,
            body,
            status,
            priority,
            type,
            assigneeIds,
            taskIds,
            dueDate,
            now,
            now,
            null,
            [],
            github);
    }

    private static ProjectWorkLogEntity WorkLog(
        string id,
        string projectId,
        string date,
        string memberId,
        decimal hours,
        string category,
        string summary,
        string? note,
        string? taskId,
        string? issueId,
        bool billable)
    {
        var now = DateTimeOffset.UtcNow.ToString("O");
        return new ProjectWorkLogEntity
        {
            Id = id,
            ProjectId = projectId,
            Date = date,
            MemberId = memberId,
            Hours = hours,
            Category = category,
            Summary = summary,
            Note = note,
            TaskId = taskId,
            IssueId = issueId,
            Billable = billable,
            CreatedBy = "システム",
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    private static void AddProject(
        ScheduleDbContext db,
        ProjectDto project,
        CalendarDefinitionDto calendar,
        IReadOnlyList<ScheduleTaskDto> tasks,
        IReadOnlyList<ProjectIssueDto>? issues = null,
        IReadOnlyList<ProjectWorkLogEntity>? workLogs = null)
    {
        var projectEntity = ScheduleMapper.ToEntity(project, project.Version);
        projectEntity.Calendar = ScheduleMapper.ToEntity(calendar, project.Id);
        projectEntity.Members = (project.MemberIds ?? [])
            .Select(memberId => new ProjectMemberEntity
            {
                ProjectId = project.Id,
                MemberId = memberId
            })
            .ToList();
        projectEntity.Tasks = tasks
            .Select((task, index) => ScheduleMapper.ToEntity(task, project.Id, index))
            .ToList();
        projectEntity.Issues = (issues ?? [])
            .Select(issue => ScheduleMapper.ToEntity(issue, project.Id))
            .ToList();
        projectEntity.WorkLogs = (workLogs ?? [])
            .ToList();
        projectEntity.Assignments = (project.Assignments ?? [])
            .Select(assignment => new ProjectAssignmentEntity
            {
                Id = assignment.Id,
                ProjectId = project.Id,
                MemberId = assignment.MemberId,
                Role = assignment.Role,
                StartDate = assignment.StartDate,
                EndDate = assignment.EndDate,
                AllocationPercent = assignment.AllocationPercent,
                Status = assignment.Status
            })
            .ToList();
        projectEntity.StaffingDemands = (project.StaffingDemands ?? [])
            .Select(demand => new StaffingDemandEntity
            {
                Id = demand.Id,
                ProjectId = project.Id,
                Role = demand.Role,
                StartDate = demand.StartDate,
                EndDate = demand.EndDate,
                RequiredCount = demand.RequiredCount,
                AllocationPercent = demand.AllocationPercent,
                Status = demand.Status
            })
            .ToList();
        db.Projects.Add(projectEntity);
    }
}
