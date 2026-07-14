using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Globalization;
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
        if (missingMembers > 0) errors.Add($"社員NO未設定の要員が{missingMembers}名あります。");
        if (missingProjects > 0) errors.Add($"プロジェクトNO未設定の案件が{missingProjects}件あります。");
        var duplicateMembers = DuplicateCount(memberNumbers);
        var duplicateProjects = DuplicateCount(projectNumbers);
        if (duplicateMembers > 0) errors.Add($"重複する社員NOが{duplicateMembers}件あります。");
        if (duplicateProjects > 0) errors.Add($"重複するプロジェクトNOが{duplicateProjects}件あります。");

        var teams = await db.Teams.AsNoTracking().ToListAsync(cancellationToken);
        var members = await db.Members.AsNoTracking().ToListAsync(cancellationToken);
        var projects = await db.Projects.AsNoTracking().ToListAsync(cancellationToken);
        var included = snapshot.Projects.Where(item => !ShouldExclude(item, excludePastProjects)).ToArray();
        var skipped = snapshot.Projects.Count - included.Length;
        if (skipped > 0) warnings.Add($"削除・失注・過去案件の{skipped}件を同期対象外にします。");

        var teamCreated = snapshot.Teams.Count(item => !teams.Any(existing => IsMatch(existing.ExternalSource, existing.ExternalId, item.TeamId) || existing.Name == item.TeamName));
        var memberCreated = snapshot.Members.Count(item => !members.Any(existing =>
            IsMatch(existing.ExternalSource, existing.ExternalId, item.MemberId) ||
            existing.EmployeeNo == item.EmployeeNo ||
            (existing.Name == item.Name && members.Count(candidate => candidate.Name == item.Name) == 1)));
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

        var memberMap = new Dictionary<string, MemberEntity>(StringComparer.OrdinalIgnoreCase);
        foreach (var source in snapshot.Members)
        {
            var employeeNo = source.EmployeeNo.Trim();
            var member = members.FirstOrDefault(item => IsMatch(item.ExternalSource, item.ExternalId, source.MemberId))
                ?? members.FirstOrDefault(item => item.EmployeeNo == employeeNo);
            var nameMatches = members.Where(item => item.Name == source.Name.Trim()).ToArray();
            if (member is null && nameMatches.Length == 1) member = nameMatches[0];
            if (member is null)
            {
                member = new MemberEntity { Id = StableId("member", source.MemberId), CapacityHours = 40 };
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
            member.Color = MemberColors[SHA256.HashData(Encoding.UTF8.GetBytes(employeeNo))[0] % MemberColors.Length];
            var isInactive = source.EmploymentStatus is "7" or "9";
            member.Status = isInactive ? "inactive" : "active";
            member.InactiveAt = isInactive ? NormalizeDate(source.PeriodTo) : null;
            member.ExternalSource = Source;
            member.ExternalId = source.MemberId;
            memberMap[employeeNo] = member;
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
                team.Members.Add(new TeamMemberEntity { TeamId = team.Id, MemberId = memberMap[source.EmployeeNo.Trim()].Id });
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

        var now = DateTimeOffset.UtcNow.ToString("O");
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
            if (!memberMap.TryGetValue(source.EmployeeNo.Trim(), out var member)) continue;
            var project = projectMap[source.ProjectId];
            if (project.Members.All(item => item.MemberId != member.Id))
                project.Members.Add(new ProjectMemberEntity { ProjectId = project.Id, MemberId = member.Id, ProjectRole = "member" });
        }
        foreach (var source in includedProjects)
        {
            if (source.ManagerEmployeeNo is null || !memberMap.TryGetValue(source.ManagerEmployeeNo.Trim(), out var manager)) continue;
            var project = projectMap[source.ProjectId];
            var membership = project.Members.FirstOrDefault(item => item.MemberId == manager.Id);
            if (membership is null)
                project.Members.Add(new ProjectMemberEntity { ProjectId = project.Id, MemberId = manager.Id, ProjectRole = "owner" });
            else
                membership.ProjectRole = "owner";
        }
        foreach (var source in includedProjects)
        {
            if (source.SalesEmployeeNo is null || !memberMap.TryGetValue(source.SalesEmployeeNo.Trim(), out var sales)) continue;
            var project = projectMap[source.ProjectId];
            if (project.Members.All(item => item.MemberId != sales.Id))
                project.Members.Add(new ProjectMemberEntity { ProjectId = project.Id, MemberId = sales.Id, ProjectRole = "viewer" });
        }

        foreach (var source in snapshot.Allocations
                     .Where(item => projectMap.ContainsKey(item.ProjectId))
                     .GroupBy(item => $"{item.ProjectId}:{item.EmployeeNo}:{item.WorkMonth}", StringComparer.OrdinalIgnoreCase)
                     .Select(group => group.Last()))
        {
            if (!memberMap.TryGetValue(source.EmployeeNo.Trim(), out var member) || !TryMonthRange(source.WorkMonth, out var start, out var end)) continue;
            var project = projectMap[source.ProjectId];
            project.Assignments.Add(new ProjectAssignmentEntity
            {
                Id = StableId("assignment", $"{source.ProjectId}:{source.EmployeeNo}:{source.WorkMonth}"),
                ProjectId = project.Id,
                MemberId = member.Id,
                Role = member.Role,
                StartDate = start,
                EndDate = end,
                AllocationPercent = Math.Clamp(source.PlannedPercent, 0, 100),
                Status = "confirmed",
                ExternalSource = Source,
                ExternalId = $"{source.ProjectId}:{source.EmployeeNo}:{source.WorkMonth}"
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
