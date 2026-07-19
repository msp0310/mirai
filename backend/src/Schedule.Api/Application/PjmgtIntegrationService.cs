using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Globalization;
using System.Net.Mail;
using Microsoft.EntityFrameworkCore;
using Schedule.Api.Contracts;
using Schedule.Api.Domain;
using Schedule.Api.Infrastructure;

namespace Schedule.Api.Application;

/// <summary>PJMGTのチーム・要員・案件・月別アサインをCOMPASSへ同期します。</summary>
public sealed class PjmgtIntegrationService(
    ScheduleDbContext db,
    PjmgtClient client,
    AuditLogService auditLogs)
{
    private const string Source = "pjmgt";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly string[] MemberColors = ["#2563eb", "#7c3aed", "#0891b2", "#059669", "#d97706", "#dc2626"];

    public async Task<PjmgtIntegrationSettingsDto> GetSettingsAsync(CancellationToken cancellationToken)
    {
        var setting = await db.PjmgtIntegrationSettings.AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == Source, cancellationToken);
        return ToDto(setting ?? new PjmgtIntegrationSettingEntity());
    }

    public async Task<PjmgtIntegrationSettingsDto> SaveSettingsAsync(
        UpdatePjmgtIntegrationSettingsRequest request,
        AuthUserDto user,
        CancellationToken cancellationToken)
    {
        var normalizedUrl = NormalizeUrl(request.BaseUrl);
        var setting = await GetOrCreateSettingAsync(cancellationToken);
        setting.BaseUrl = normalizedUrl;
        setting.ExcludePastProjects = request.ExcludePastProjects;
        await db.SaveChangesAsync(cancellationToken);
        await auditLogs.RecordAsync(user, "pjmgt.settings.save", "system", null, "integration", Source,
            new { baseUrl = normalizedUrl, request.ExcludePastProjects }, cancellationToken);
        return ToDto(setting);
    }

    public async Task<PjmgtConnectionTestResultDto> TestConnectionAsync(CancellationToken cancellationToken)
    {
        var setting = await GetConfiguredSettingAsync(cancellationToken);
        var checkedAt = DateTimeOffset.UtcNow.ToString("O");
        try
        {
            await client.TestConnectionAsync(setting.BaseUrl, cancellationToken);
            setting.LastConnectionSucceeded = true;
            setting.LastConnectionMessage = "PJMGT APIへ接続できました。";
        }
        catch (Exception error) when (error is HttpRequestException or TaskCanceledException)
        {
            setting.LastConnectionSucceeded = false;
            setting.LastConnectionMessage = "PJMGT APIへ接続できませんでした。URL・APIキー・稼働状態を確認してください。";
        }
        setting.LastConnectionCheckedAt = checkedAt;
        await db.SaveChangesAsync(cancellationToken);
        return new PjmgtConnectionTestResultDto(
            setting.LastConnectionSucceeded == true,
            setting.LastConnectionMessage,
            checkedAt);
    }

    public async Task<PjmgtSyncSummaryDto> PreviewAsync(CancellationToken cancellationToken)
    {
        var setting = await GetConfiguredSettingAsync(cancellationToken);
        var snapshot = await client.GetSnapshotAsync(setting.BaseUrl, cancellationToken);
        return await BuildSummaryAsync(snapshot, setting.ExcludePastProjects, cancellationToken);
    }

    public async Task<PjmgtSyncResultDto> SyncAsync(AuthUserDto user, CancellationToken cancellationToken)
    {
        var setting = await GetConfiguredSettingAsync(cancellationToken);
        var snapshot = await client.GetSnapshotAsync(setting.BaseUrl, cancellationToken);
        var summary = await BuildSummaryAsync(snapshot, setting.ExcludePastProjects, cancellationToken);
        if (summary.Errors.Count > 0)
        {
            throw new InvalidDataException(string.Join(" ", summary.Errors));
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await ApplySnapshotAsync(snapshot, setting.ExcludePastProjects, cancellationToken);
        var syncedAt = DateTimeOffset.UtcNow.ToString("O");
        setting.LastSyncedAt = syncedAt;
        setting.LastSyncSummaryJson = JsonSerializer.Serialize(summary, JsonOptions);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        await auditLogs.RecordAsync(user, "pjmgt.sync", "system", null, "integration", Source, summary, cancellationToken);
        return new PjmgtSyncResultDto(syncedAt, summary);
    }

    /// <summary>COMPASS案件に対応するPJMGT詳細画面のURLを返します。</summary>
    public async Task<string?> GetProjectWebUrlAsync(string projectId, CancellationToken cancellationToken)
    {
        var project = await db.Projects.AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == projectId, cancellationToken);
        if (project is not { ExternalSource: Source } || string.IsNullOrWhiteSpace(project.ExternalId))
            return null;

        var setting = await GetConfiguredSettingAsync(cancellationToken);
        const string apiSuffix = "/api/v1";
        var baseUrl = setting.BaseUrl.TrimEnd('/');
        if (!baseUrl.EndsWith(apiSuffix, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("PJMGT接続先URLから画面URLを特定できません。");

        var webBaseUrl = baseUrl[..^apiSuffix.Length];
        return $"{webBaseUrl}/pj/pj-list/?type=details&pid={Uri.EscapeDataString(project.ExternalId)}";
    }

    private async Task<PjmgtSyncSummaryDto> BuildSummaryAsync(
        PjmgtSnapshotDto snapshot,
        bool excludePastProjects,
        CancellationToken cancellationToken)
    {
        var errors = new List<string>();
        var warnings = new List<string>();
        var memberNumbers = snapshot.Members.Select(item => item.EmployeeNo?.Trim() ?? "").ToArray();
        var projectNumbers = snapshot.Projects.Select(item => item.ProjectNo?.Trim() ?? "").ToArray();
        var missingMembers = memberNumbers.Count(string.IsNullOrWhiteSpace);
        var missingProjects = projectNumbers.Count(string.IsNullOrWhiteSpace);
        if (missingMembers > 0) warnings.Add($"社員NO未設定の要員{missingMembers}名はPJMGT要員IDで取り込みます。");
        if (missingProjects > 0) errors.Add($"プロジェクトNO未設定の案件が{missingProjects}件あります。");
        var duplicateMembers = DuplicateCount(memberNumbers);
        var duplicateProjects = DuplicateCount(projectNumbers);
        if (duplicateMembers > 0) errors.Add($"重複する社員NOが{duplicateMembers}件あります。");
        if (duplicateProjects > 0) errors.Add($"重複するプロジェクトNOが{duplicateProjects}件あります。");

        var accountSources = GetAccountSources(snapshot.Members, out var missingEmails, out var invalidEmails, out var duplicateEmails);
        if (missingEmails > 0) warnings.Add($"メールアドレス未設定の要員{missingEmails}名はログインアカウントを作成しません。");
        if (invalidEmails > 0) warnings.Add($"メールアドレス不正の要員{invalidEmails}名はログインアカウントを作成しません。");
        if (duplicateEmails > 0) warnings.Add($"同一メールアドレスの要員{duplicateEmails}名を1つのログインアカウントに集約します。");
        if (accountSources.Length > 0 && !client.InitialPasswordConfigured)
            errors.Add("PJMGT同期ユーザーの初期パスワードが設定されていません。");

        var teams = await db.Teams.AsNoTracking().ToListAsync(cancellationToken);
        var members = await db.Members.AsNoTracking().ToListAsync(cancellationToken);
        var projects = await db.Projects.AsNoTracking().ToListAsync(cancellationToken);
        var included = snapshot.Projects.Where(item => !ShouldExclude(item, excludePastProjects)).ToArray();
        var skipped = snapshot.Projects.Count - included.Length;
        if (skipped > 0) warnings.Add($"削除・失注・過去案件の{skipped}件を同期対象外にします。");

        var teamCreated = snapshot.Teams.Count(item => !teams.Any(existing => IsMatch(existing.ExternalSource, existing.ExternalId, item.TeamId) || existing.Name == item.TeamName));
        var memberCreated = snapshot.Members.Count(item => !members.Any(existing =>
            IsMatch(existing.ExternalSource, existing.ExternalId, item.MemberId) ||
            existing.Id == StableId("member", item.MemberId) ||
            (!string.IsNullOrWhiteSpace(item.EmployeeNo) && existing.EmployeeNo == item.EmployeeNo.Trim()) ||
            (existing.ExternalSource is null && existing.Name == item.Name &&
             members.Count(candidate => candidate.ExternalSource is null && candidate.Name == item.Name) == 1)));
        var projectCreated = included.Count(item => !projects.Any(existing => IsMatch(existing.ExternalSource, existing.ExternalId, item.ProjectId) || existing.ProjectNo == item.ProjectNo));
        var archived = projects.Count(existing =>
            existing.ExternalSource == Source &&
            existing.ArchivedAt is null &&
            (snapshot.Projects.FirstOrDefault(item => item.ProjectId == existing.ExternalId) is not { } source ||
             ShouldExclude(source, excludePastProjects)));

        return new PjmgtSyncSummaryDto(
            teamCreated,
            snapshot.Teams.Count - teamCreated,
            memberCreated,
            snapshot.Members.Count - memberCreated,
            projectCreated,
            included.Length - projectCreated,
            archived,
            skipped,
            snapshot.Allocations.Count(item => included.Any(project => project.ProjectId == item.ProjectId)),
            warnings,
            errors);
    }

    private async Task ApplySnapshotAsync(PjmgtSnapshotDto snapshot, bool excludePastProjects, CancellationToken cancellationToken)
    {
        var teams = await db.Teams.Include(item => item.Members).ToListAsync(cancellationToken);
        var members = await db.Members.ToListAsync(cancellationToken);
        var users = await db.Users.ToListAsync(cancellationToken);
        var projects = await db.Projects
            .Include(item => item.Calendar)
            .Include(item => item.Members)
            .Include(item => item.Assignments)
            .ToListAsync(cancellationToken);

        var teamMap = new Dictionary<string, TeamEntity>(StringComparer.Ordinal);
        foreach (var source in snapshot.Teams)
        {
            var team = teams.FirstOrDefault(item => IsMatch(item.ExternalSource, item.ExternalId, source.TeamId))
                ?? teams.FirstOrDefault(item => item.Name == source.TeamName);
            if (team is null)
            {
                team = new TeamEntity { Id = StableId("team", source.TeamId) };
                teams.Add(team);
                db.Teams.Add(team);
            }
            team.Name = source.TeamName.Trim();
            team.Code = CreateTeamCode(source.TeamName);
            team.Description = "PJMGTから同期";
            team.ExternalSource = Source;
            team.ExternalId = source.TeamId;
            teamMap[source.TeamId] = team;
        }

        var memberMap = new Dictionary<string, MemberEntity>(StringComparer.Ordinal);
        foreach (var source in snapshot.Members)
        {
            var employeeNo = NullIfBlank(source.EmployeeNo);
            var stableMemberId = StableId("member", source.MemberId);
            var member = members.FirstOrDefault(item => IsMatch(item.ExternalSource, item.ExternalId, source.MemberId))
                // 旧同期で同姓同名が統合され外部IDだけ上書きされた要員は、安定内部IDから元の要員へ戻します。
                ?? members.FirstOrDefault(item => item.Id == stableMemberId)
                ?? (employeeNo is null ? null : members.FirstOrDefault(item => item.EmployeeNo == employeeNo));
            // 外部IDが異なる同姓同名を同一人物として上書きしないよう、名前照合は未連携要員だけに限定します。
            var nameMatches = members
                .Where(item => item.ExternalSource is null && item.Name == source.Name.Trim())
                .ToArray();
            if (member is null && nameMatches.Length == 1) member = nameMatches[0];
            if (member is null)
            {
                member = new MemberEntity { Id = stableMemberId, CapacityHours = 40 };
                members.Add(member);
                db.Members.Add(member);
            }
            member.EmployeeNo = employeeNo;
            member.Name = source.Name.Trim();
            member.Initials = CreateInitials(source.Name);
            if (!string.IsNullOrWhiteSpace(source.ClassName))
                member.Role = NormalizeRole(source.ClassName);
            else if (string.IsNullOrWhiteSpace(member.Role))
                member.Role = "SE";
            member.Color = MemberColors[SHA256.HashData(Encoding.UTF8.GetBytes(source.MemberId))[0] % MemberColors.Length];
            var isInactive = source.EmploymentStatus is "7" or "9";
            member.Status = isInactive ? "inactive" : "active";
            member.InactiveAt = isInactive ? NormalizeDate(source.PeriodTo) : null;
            member.ExternalSource = Source;
            member.ExternalId = source.MemberId;
            memberMap[source.MemberId] = member;
        }

        var accountSources = GetAccountSources(snapshot.Members, out _, out _, out _);
        var now = DateTimeOffset.UtcNow.ToString("O");
        foreach (var source in accountSources)
        {
            var member = memberMap[source.MemberId];
            var normalizedEmail = AuthService.NormalizeEmail(source.MailAddress!);
            var groupMemberIds = snapshot.Members
                .Where(item => NormalizeValidEmail(item.MailAddress) == normalizedEmail)
                .Select(item => memberMap[item.MemberId].Id)
                .ToHashSet(StringComparer.Ordinal);
            var account = users.FirstOrDefault(item => item.MemberId == member.Id)
                ?? users.FirstOrDefault(item => item.MemberId is not null && groupMemberIds.Contains(item.MemberId))
                ?? users.FirstOrDefault(item => item.EmailNormalized == normalizedEmail);

            if (account is not null && account.MemberId is null)
                throw new InvalidDataException($"メールアドレス {source.MailAddress} は既存の未連携アカウントで使用されています。");

            if (account is null)
            {
                account = new UserEntity
                {
                    Id = StableId("user", source.MemberId),
                    CreatedAt = now,
                    PasswordHash = PasswordHasher.HashPassword(client.InitialPassword),
                    PasswordChangedAt = now,
                    PasswordResetRequired = true
                };
                users.Add(account);
                db.Users.Add(account);
            }

            account.MemberId = member.Id;
            account.Email = source.MailAddress!.Trim();
            account.EmailNormalized = normalizedEmail;
            account.Name = source.Name.Trim();
            account.Role = SystemRoles.User;
            account.IsActive = true;
        }

        var syncedMemberIds = memberMap.Values.Select(item => item.Id).ToHashSet(StringComparer.Ordinal);
        foreach (var team in teams)
        {
            foreach (var membership in team.Members.Where(item => syncedMemberIds.Contains(item.MemberId)).ToArray())
                team.Members.Remove(membership);
        }
        foreach (var source in snapshot.Members)
        {
            if (source.TeamId is not null && teamMap.TryGetValue(source.TeamId, out var team))
            {
                team.Members.Add(new TeamMemberEntity { TeamId = team.Id, MemberId = memberMap[source.MemberId].Id });
            }
        }

        var includedProjects = snapshot.Projects.Where(item => !ShouldExclude(item, excludePastProjects)).ToArray();
        var projectMap = new Dictionary<string, ProjectEntity>(StringComparer.Ordinal);
        foreach (var source in includedProjects)
        {
            var project = projects.FirstOrDefault(item => IsMatch(item.ExternalSource, item.ExternalId, source.ProjectId))
                ?? projects.FirstOrDefault(item => item.ProjectNo == source.ProjectNo);
            var start = NormalizeDate(source.PeriodFrom) ?? DateOnly.FromDateTime(DateTime.Today).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            var end = NormalizeDate(source.PeriodTo) ?? DateOnly.FromDateTime(DateTime.Today.AddMonths(1)).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            if (project is null)
            {
                project = new ProjectEntity
                {
                    Id = StableId("project", source.ProjectId),
                    Calendar = new CalendarEntity
                    {
                        Id = StableId("calendar", source.ProjectId),
                        Name = "標準カレンダー"
                    }
                };
                project.Calendar.ProjectId = project.Id;
                projects.Add(project);
                db.Projects.Add(project);
            }
            project.Calendar ??= new CalendarEntity
            {
                Id = StableId("calendar", source.ProjectId),
                ProjectId = project.Id,
                Name = "標準カレンダー"
            };
            project.ProjectNo = source.ProjectNo.Trim();
            project.Name = source.ProjectName.Trim();
            project.Workspace = source.ProjectName.Trim();
            project.CustomerName = NullIfBlank(source.DeliveryDestination);
            project.OrderingCompanyName = NullIfBlank(source.OrderingCompanyName);
            project.TeamId = source.TeamId is not null && teamMap.TryGetValue(source.TeamId, out var team) ? team.Id : null;
            project.RangeStart = start;
            project.RangeEnd = end;
            project.NextMilestoneTitle = "契約終了";
            project.NextMilestoneDate = end;
            project.LifecycleStatus = source.SalesStatus == 8 ? "completed" : DateOnly.Parse(start, CultureInfo.InvariantCulture) > DateOnly.FromDateTime(DateTime.Today) ? "planning" : "inProgress";
            project.Status = "active";
            project.ArchivedAt = null;
            project.ExternalSource = Source;
            project.ExternalId = source.ProjectId;
            project.Version += 1;
            projectMap[source.ProjectId] = project;
        }

        foreach (var project in projects.Where(item => item.ExternalSource == Source))
        {
            var source = snapshot.Projects.FirstOrDefault(item => item.ProjectId == project.ExternalId);
            if (source is null || ShouldExclude(source, excludePastProjects))
            {
                project.Status = "archived";
                project.ArchivedAt ??= now;
            }
        }

        foreach (var project in projectMap.Values)
        {
            var syncedMemberships = project.Members.Where(item => syncedMemberIds.Contains(item.MemberId)).ToArray();
            foreach (var membership in syncedMemberships) project.Members.Remove(membership);
            var syncedAssignments = project.Assignments.Where(item => item.ExternalSource == Source).ToArray();
            foreach (var assignment in syncedAssignments) project.Assignments.Remove(assignment);
        }

        foreach (var source in snapshot.ProjectMembers.Where(item => projectMap.ContainsKey(item.ProjectId)))
        {
            if (!memberMap.TryGetValue(source.MemberId, out var member)) continue;
            var project = projectMap[source.ProjectId];
            if (project.Members.All(item => item.MemberId != member.Id))
                project.Members.Add(new ProjectMemberEntity { ProjectId = project.Id, MemberId = member.Id, ProjectRole = "member" });
        }
        foreach (var source in includedProjects)
        {
            if (source.ManagerMemberId is null || !memberMap.TryGetValue(source.ManagerMemberId, out var manager)) continue;
            var project = projectMap[source.ProjectId];
            var membership = project.Members.FirstOrDefault(item => item.MemberId == manager.Id);
            if (membership is null)
                project.Members.Add(new ProjectMemberEntity { ProjectId = project.Id, MemberId = manager.Id, ProjectRole = "owner" });
            else
                membership.ProjectRole = "owner";
        }
        foreach (var source in includedProjects)
        {
            if (source.SalesMemberId is null || !memberMap.TryGetValue(source.SalesMemberId, out var sales)) continue;
            var project = projectMap[source.ProjectId];
            if (project.Members.All(item => item.MemberId != sales.Id))
                project.Members.Add(new ProjectMemberEntity { ProjectId = project.Id, MemberId = sales.Id, ProjectRole = "viewer" });
        }

        foreach (var source in snapshot.Allocations
                     .Where(item => projectMap.ContainsKey(item.ProjectId))
                     .GroupBy(item => $"{item.ProjectId}:{item.MemberId}:{item.WorkMonth}", StringComparer.Ordinal)
                     .Select(group => group.Last()))
        {
            if (!memberMap.TryGetValue(source.MemberId, out var member) || !TryMonthRange(source.WorkMonth, out var start, out var end)) continue;
            var project = projectMap[source.ProjectId];
            project.Assignments.Add(new ProjectAssignmentEntity
            {
                Id = StableId("assignment", $"{source.ProjectId}:{source.MemberId}:{source.WorkMonth}"),
                ProjectId = project.Id,
                MemberId = member.Id,
                Role = member.Role,
                StartDate = start,
                EndDate = end,
                AllocationPercent = Math.Clamp(source.PlannedPercent, 0, 100),
                Status = "confirmed",
                ExternalSource = Source,
                ExternalId = $"{source.ProjectId}:{source.MemberId}:{source.WorkMonth}"
            });
        }
    }

    private async Task<PjmgtIntegrationSettingEntity> GetOrCreateSettingAsync(CancellationToken cancellationToken)
    {
        var setting = await db.PjmgtIntegrationSettings.SingleOrDefaultAsync(item => item.Id == Source, cancellationToken);
        if (setting is not null) return setting;
        setting = new PjmgtIntegrationSettingEntity();
        db.PjmgtIntegrationSettings.Add(setting);
        return setting;
    }

    private static PjmgtMemberDto[] GetAccountSources(
        IReadOnlyList<PjmgtMemberDto> members,
        out int missingEmails,
        out int invalidEmails,
        out int duplicateEmails)
    {
        missingEmails = members.Count(item => string.IsNullOrWhiteSpace(item.MailAddress));
        invalidEmails = members.Count(item => !string.IsNullOrWhiteSpace(item.MailAddress) && NormalizeValidEmail(item.MailAddress) is null);
        var groups = members
            .Select(item => new { Member = item, Email = NormalizeValidEmail(item.MailAddress) })
            .Where(item => item.Email is not null)
            .GroupBy(item => item.Email!, StringComparer.Ordinal)
            .ToArray();
        duplicateEmails = groups.Sum(group => group.Count() - 1);

        return groups.Select(group => group
                .Select(item => item.Member)
                .OrderBy(item => item.EmploymentStatus is "7" or "9")
                .ThenBy(item => string.IsNullOrWhiteSpace(item.EmployeeNo))
                .ThenByDescending(item => int.TryParse(item.MemberId, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id) ? id : int.MinValue)
                .First())
            .ToArray();
    }

    private static string? NormalizeValidEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email) || !MailAddress.TryCreate(email.Trim(), out var parsed)) return null;
        return AuthService.NormalizeEmail(parsed.Address);
    }

    private async Task<PjmgtIntegrationSettingEntity> GetConfiguredSettingAsync(CancellationToken cancellationToken)
    {
        var setting = await GetOrCreateSettingAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(setting.BaseUrl)) throw new InvalidOperationException("PJMGTの接続先URLを設定してください。");
        return setting;
    }

    private PjmgtIntegrationSettingsDto ToDto(PjmgtIntegrationSettingEntity setting) => new(
        setting.BaseUrl,
        setting.ExcludePastProjects,
        client.ApiKeyConfigured,
        setting.LastConnectionCheckedAt,
        setting.LastConnectionSucceeded,
        setting.LastConnectionMessage,
        setting.LastSyncedAt,
        string.IsNullOrWhiteSpace(setting.LastSyncSummaryJson)
            ? null
            : JsonSerializer.Deserialize<PjmgtSyncSummaryDto>(setting.LastSyncSummaryJson, JsonOptions));

    private static string NormalizeUrl(string value)
    {
        if (!Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri) || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            throw new ArgumentException("接続先URLはhttp://またはhttps://で始まるURLを指定してください。");
        return uri.ToString().TrimEnd('/');
    }

    private static bool ShouldExclude(PjmgtProjectDto project, bool excludePastProjects)
    {
        if (project.SalesStatus is 7 or 9) return true;
        if (!excludePastProjects) return false;
        if (project.SalesStatus == 8) return true;
        return DateOnly.TryParse(project.PeriodTo, out var end) && end < DateOnly.FromDateTime(DateTime.Today);
    }

    private static bool IsMatch(string? source, string? id, string targetId) => source == Source && id == targetId;
    private static int DuplicateCount(IEnumerable<string> values) => values.Where(value => !string.IsNullOrWhiteSpace(value)).GroupBy(value => value, StringComparer.OrdinalIgnoreCase).Count(group => group.Count() > 1);
    private static string? NullIfBlank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static string? NormalizeDate(string? value) => DateOnly.TryParse(value, CultureInfo.InvariantCulture, out var date) ? date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) : null;
    private static string CreateTeamCode(string name) => string.Concat(name.Trim().Take(2)).ToUpperInvariant();
    private static string CreateInitials(string name) => string.Concat(name.Replace(" ", "", StringComparison.Ordinal).Take(2));
    private static string NormalizeRole(string? role) => role?.Trim().ToUpperInvariant() switch { "PM" => "PM", "PL" => "PL", "PG" => "PG", "SE" => "SE", _ => "SE" };

    private static bool TryMonthRange(string value, out string start, out string end)
    {
        if (value.Length == 6 && int.TryParse(value[..4], out var year) && int.TryParse(value[4..], out var month) && month is >= 1 and <= 12)
        {
            var first = new DateOnly(year, month, 1);
            start = first.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            end = first.AddMonths(1).AddDays(-1).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            return true;
        }
        start = end = "";
        return false;
    }

    private static string StableId(string type, string value)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes($"{Source}:{type}:{value}"));
        return $"{Source}-{type}-{Convert.ToHexString(hash.AsSpan(0, 8)).ToLowerInvariant()}";
    }
}
