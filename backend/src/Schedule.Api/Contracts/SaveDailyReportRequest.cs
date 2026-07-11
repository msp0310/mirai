namespace Schedule.Api.Contracts;

/// <summary>日報の作成・更新要求です。</summary>
public sealed record SaveDailyReportRequest(
    string MemberId,
    string Date,
    string Status,
    string Summary,
    string? Blockers,
    string? NextPlan,
    IReadOnlyList<DailyReportEntryDto> Entries,
    IReadOnlyList<DailyReportCommentDto> Comments,
    int Version);
