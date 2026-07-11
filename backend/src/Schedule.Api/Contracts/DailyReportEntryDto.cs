namespace Schedule.Api.Contracts;

/// <summary>日報に記載する案件別の作業実績明細です。</summary>
public sealed record DailyReportEntryDto(
    string Id,
    string ProjectId,
    string? TaskId,
    decimal Hours,
    string Category,
    string Summary,
    string? Note,
    string? WorkLogId = null);
