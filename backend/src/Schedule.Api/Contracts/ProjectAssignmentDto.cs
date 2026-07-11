namespace Schedule.Api.Contracts;

/// <summary>案件へのメンバー参画計画を表すAPI契約です。</summary>
public sealed record ProjectAssignmentDto(
    string Id,
    string MemberId,
    string Role,
    string StartDate,
    string EndDate,
    int AllocationPercent,
    string Status);
