using System.Text.Json.Serialization;

namespace Schedule.Api.Contracts;

/// <summary>PJMGT接続設定の管理画面向け表現です。</summary>
public sealed record PjmgtIntegrationSettingsDto(
    string BaseUrl,
    bool ExcludePastProjects,
    bool ApiKeyConfigured,
    string? LastConnectionCheckedAt,
    bool? LastConnectionSucceeded,
    string? LastConnectionMessage,
    string? LastSyncedAt,
    PjmgtSyncSummaryDto? LastSyncSummary);

public sealed record UpdatePjmgtIntegrationSettingsRequest(string BaseUrl, bool ExcludePastProjects);

public sealed record PjmgtConnectionTestResultDto(bool Succeeded, string Message, string CheckedAt);

public sealed record PjmgtSyncSummaryDto(
    int TeamsCreated,
    int TeamsUpdated,
    int MembersCreated,
    int MembersUpdated,
    int ProjectsCreated,
    int ProjectsUpdated,
    int ProjectsArchived,
    int ProjectsSkipped,
    int AssignmentsImported,
    IReadOnlyList<string> Warnings,
    IReadOnlyList<string> Errors);

public sealed record PjmgtSyncResultDto(string SyncedAt, PjmgtSyncSummaryDto Summary);

/// <summary>PJMGTの各RESTリソースを同期単位へ集約した内部契約です。</summary>
public sealed class PjmgtSnapshotDto
{
    public string? GeneratedAt { get; init; }
    public IReadOnlyList<PjmgtTeamDto> Teams { get; init; } = [];
    public IReadOnlyList<PjmgtMemberDto> Members { get; init; } = [];
    public IReadOnlyList<PjmgtProjectDto> Projects { get; init; } = [];
    public IReadOnlyList<PjmgtProjectMemberDto> ProjectMembers { get; init; } = [];
    public IReadOnlyList<PjmgtAllocationDto> Allocations { get; init; } = [];
}

public sealed record PjmgtTeamDto(string TeamId, string TeamName, string? Status);

public sealed record PjmgtMemberDto(
    string MemberId,
    string EmployeeNo,
    string Name,
    string? TeamId,
    string? ClassName,
    string? MailAddress,
    string? EmploymentStatus,
    string? PeriodFrom,
    string? PeriodTo);

public sealed record PjmgtProjectDto(
    string ProjectId,
    string ProjectNo,
    string ProjectName,
    string? DeliveryDestination,
    string? OrderingCompanyName,
    string? TeamId,
    string? ManagerEmployeeNo,
    string? SalesEmployeeNo,
    [property: JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)] int SalesStatus,
    string? PeriodFrom,
    string? PeriodTo);

public sealed record PjmgtProjectMemberDto(string ProjectId, string EmployeeNo);

public sealed record PjmgtAllocationDto(
    string ProjectId,
    string EmployeeNo,
    string WorkMonth,
    [property: JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)] int PlannedPercent);
