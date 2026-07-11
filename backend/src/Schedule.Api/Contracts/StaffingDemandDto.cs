namespace Schedule.Api.Contracts;

/// <summary>案件が必要としている未充足要員を表すAPI契約です。</summary>
public sealed record StaffingDemandDto(
    string Id,
    string Role,
    string StartDate,
    string EndDate,
    int RequiredCount,
    int AllocationPercent,
    string Status);
