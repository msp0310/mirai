using Schedule.Api.Application;
using Schedule.Api.Contracts;

namespace Schedule.Api.Endpoints;

/// <summary>個人日報の取得・保存・削除ルートを登録します。</summary>
public static class DailyReportEndpoints
{
    public static IEndpointRouteBuilder MapDailyReportEndpoints(this IEndpointRouteBuilder app)
    {
        var reports = app.MapGroup("/api/daily-reports");
        reports.MapGet("/", async (DailyReportService service, CancellationToken cancellationToken) =>
            Results.Ok(await service.ListAsync(cancellationToken)));

        reports.MapPut("/{reportId}", async (
            string reportId,
            HttpContext context,
            SaveDailyReportRequest request,
            DailyReportService service,
            CancellationToken cancellationToken) =>
        {
            if (context.Items["CurrentUser"] is not AuthUserDto user) return Results.Unauthorized();
            if (string.IsNullOrWhiteSpace(request.Summary) || request.Entries.Count == 0)
            {
                return Results.BadRequest(new { message = "日報のまとめと作業明細を入力してください。" });
            }
            try
            {
                var result = await service.SaveAsync(reportId, request, user, cancellationToken);
                return result is null ? Results.NotFound() : Results.Ok(result);
            }
            catch (ArgumentException error)
            {
                return Results.BadRequest(new { message = error.Message });
            }
            catch (DailyReportConflictException conflict)
            {
                return Results.Conflict(new { message = "日報が更新されています。", currentVersion = conflict.CurrentVersion });
            }
        });

        reports.MapDelete("/{reportId}", async (
            string reportId,
            DailyReportService service,
            CancellationToken cancellationToken) =>
            await service.DeleteAsync(reportId, cancellationToken) ? Results.NoContent() : Results.NotFound());
        return app;
    }
}
