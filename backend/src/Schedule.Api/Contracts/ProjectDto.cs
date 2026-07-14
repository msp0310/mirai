namespace Schedule.Api.Contracts;

/// <summary>ProjectDtoのAPI入出力契約です。</summary>
public sealed record ProjectDto(
    string Id,
    string? TeamId,
    string Name,
    string Workspace,
    string? LifecycleStatus,
    IReadOnlyList<string>? MemberIds,
    string RangeStart,
    string RangeEnd,
    NextMilestoneDto NextMilestone,
    string? Status,
    string? ArchivedAt,
    int Version,
    IReadOnlyList<ProjectAssignmentDto>? Assignments = null,
    IReadOnlyList<StaffingDemandDto>? StaffingDemands = null,
    string? ProjectNo = null,
    IReadOnlyList<ProjectMemberDto>? Memberships = null,
    string? CustomerName = null,
    string? OrderingCompanyName = null);
