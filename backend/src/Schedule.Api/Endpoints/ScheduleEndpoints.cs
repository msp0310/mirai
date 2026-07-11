using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Schedule.Api.Application;
using Schedule.Api.Contracts;

namespace Schedule.Api.Endpoints;

/// <summary>ワークスペース、プロジェクトスケジュール、休日のHTTPルートを登録します。</summary>
public static class ScheduleEndpoints
{
    /// <summary>スケジュール関連のMinimal APIルートを登録します。</summary>
    public static RouteGroupBuilder MapScheduleEndpoints(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api");

        api.MapGet("/health", () => Results.Ok(new
        {
            status = "ok",
            service = "Schedule.Api",
            checkedAt = DateTimeOffset.UtcNow
        }));

        api.MapGet("/workspace", async (
            ScheduleService schedules,
            CancellationToken cancellationToken) =>
        {
            return Results.Ok(await schedules.GetWorkspaceAsync(cancellationToken));
        });

        api.MapGet("/workspace/summary", async (
            ScheduleService schedules,
            CancellationToken cancellationToken) =>
        {
            return Results.Ok(await schedules.GetWorkspaceSummaryAsync(cancellationToken));
        });

        api.MapGet("/projects/summary", async (
            ScheduleService schedules,
            CancellationToken cancellationToken) =>
        {
            return Results.Ok(await schedules.GetProjectSummariesAsync(cancellationToken));
        });

        api.MapGet("/projects/{projectId}/schedule", async Task<Results<Ok<ScheduleSnapshotDto>, NotFound>> (
            string projectId,
            ScheduleService schedules,
            CancellationToken cancellationToken) =>
        {
            var schedule = await schedules.GetProjectScheduleAsync(projectId, cancellationToken);
            return schedule is null ? TypedResults.NotFound() : TypedResults.Ok(schedule);
        });

        api.MapPut("/projects/{projectId}/schedule", async Task<Results<Ok<SaveScheduleResponse>, NotFound, Conflict<object>, BadRequest<object>>> (
            string projectId,
            HttpContext context,
            SaveScheduleRequest request,
            ScheduleService schedules,
            CancellationToken cancellationToken) =>
        {
            var validationError = ScheduleRequestValidator.Validate(projectId, request);
            if (validationError is not null)
            {
                return TypedResults.BadRequest<object>(new { message = validationError });
            }

            try
            {
                var changedBy = (context.Items["CurrentUser"] as AuthUserDto)?.Name ?? "操作ユーザー";
                var result = await schedules.SaveProjectScheduleAsync(
                    projectId,
                    request,
                    changedBy,
                    cancellationToken);
                return result is null ? TypedResults.NotFound() : TypedResults.Ok(result);
            }
            catch (ScheduleConflictException conflict)
            {
                return TypedResults.Conflict<object>(new
                {
                    message = "Schedule has been updated by another save.",
                    currentVersion = conflict.CurrentVersion
                });
            }
        });

        api.MapGet("/projects/{projectId}/changes", async (
            string projectId,
            ScheduleService schedules,
            CancellationToken cancellationToken) =>
        {
            return Results.Ok(await schedules.GetChangeLogsAsync(projectId, cancellationToken));
        });

        api.MapGet("/projects/{projectId}/attachments", async (
            string projectId,
            AttachmentService attachments,
            CancellationToken cancellationToken) =>
        {
            return Results.Ok(await attachments.ListAsync(projectId, cancellationToken));
        });

        api.MapPost("/projects/{projectId}/attachments", async (
            string projectId,
            HttpContext context,
            [FromForm] string ownerType,
            [FromForm] string ownerId,
            [FromForm] string? parentId,
            [FromForm] IFormFile? file,
            AttachmentService attachments,
            CancellationToken cancellationToken) =>
        {
            if (context.Items["CurrentUser"] is not AuthUserDto user)
            {
                return Results.Unauthorized();
            }

            var result = await attachments.UploadAsync(
                projectId,
                ownerType,
                ownerId,
                parentId,
                file,
                user,
                cancellationToken);
            return result.StatusCode switch
            {
                StatusCodes.Status404NotFound => Results.NotFound(),
                StatusCodes.Status400BadRequest => Results.BadRequest(new { message = result.Error }),
                _ => Results.Ok(result.Attachment)
            };
        })
        .DisableAntiforgery();

        api.MapGet("/projects/{projectId}/attachments/{attachmentId}/download", async (
            string projectId,
            string attachmentId,
            AttachmentService attachments,
            CancellationToken cancellationToken) =>
        {
            var download = await attachments.OpenDownloadAsync(projectId, attachmentId, cancellationToken);
            return download is null
                ? Results.NotFound()
                : Results.File(
                    download.Stream,
                    download.ContentType,
                    download.FileName,
                    enableRangeProcessing: true,
                    lastModified: null,
                    entityTag: null);
        });

        api.MapDelete("/projects/{projectId}/attachments/{attachmentId}", async (
            string projectId,
            string attachmentId,
            AttachmentService attachments,
            CancellationToken cancellationToken) =>
        {
            var deleted = await attachments.DeleteAsync(projectId, attachmentId, cancellationToken);
            return deleted ? Results.NoContent() : Results.NotFound();
        });

        api.MapGet("/holidays/japan", async (
            DateOnly? from,
            DateOnly? to,
            JapaneseHolidayService holidays,
            CancellationToken cancellationToken) =>
        {
            return Results.Ok(await holidays.GetHolidaysAsync(from, to, cancellationToken));
        });

        return api;
    }
}
