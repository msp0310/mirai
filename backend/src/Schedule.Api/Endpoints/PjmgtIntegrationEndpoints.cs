using Schedule.Api.Application;
using Schedule.Api.Contracts;

namespace Schedule.Api.Endpoints;

/// <summary>システム管理者向けのPJMGT接続設定・同期ルートを登録します。</summary>
public static class PjmgtIntegrationEndpoints
{
    public static IEndpointRouteBuilder MapPjmgtIntegrationEndpoints(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api/admin/integrations/pjmgt");

        api.MapGet("/settings", async (HttpContext context, PjmgtIntegrationService service, CancellationToken token) =>
        {
            if (!IsAdmin(context)) return Results.StatusCode(StatusCodes.Status403Forbidden);
            return Results.Ok(await service.GetSettingsAsync(token));
        });

        api.MapPut("/settings", async (UpdatePjmgtIntegrationSettingsRequest request, HttpContext context,
            PjmgtIntegrationService service, CancellationToken token) =>
        {
            if (context.Items["CurrentUser"] is not AuthUserDto user || user.Role != SystemRoles.Admin)
                return Results.StatusCode(StatusCodes.Status403Forbidden);
            try { return Results.Ok(await service.SaveSettingsAsync(request, user, token)); }
            catch (ArgumentException error) { return Results.BadRequest(new { message = error.Message }); }
        });

        api.MapPost("/test", async (HttpContext context, PjmgtIntegrationService service, CancellationToken token) =>
        {
            if (!IsAdmin(context)) return Results.StatusCode(StatusCodes.Status403Forbidden);
            try { return Results.Ok(await service.TestConnectionAsync(token)); }
            catch (InvalidOperationException error) { return Results.BadRequest(new { message = error.Message }); }
        });

        api.MapPost("/preview", async (HttpContext context, PjmgtIntegrationService service, CancellationToken token) =>
        {
            if (!IsAdmin(context)) return Results.StatusCode(StatusCodes.Status403Forbidden);
            try { return Results.Ok(await service.PreviewAsync(token)); }
            catch (InvalidOperationException error) { return Results.BadRequest(new { message = error.Message }); }
            catch (HttpRequestException) { return Results.Problem("PJMGT APIから同期データを取得できませんでした。", statusCode: StatusCodes.Status502BadGateway); }
            catch (InvalidDataException error) { return Results.BadRequest(new { message = error.Message }); }
        });

        api.MapPost("/sync", async (HttpContext context, PjmgtIntegrationService service, CancellationToken token) =>
        {
            if (context.Items["CurrentUser"] is not AuthUserDto user || user.Role != SystemRoles.Admin)
                return Results.StatusCode(StatusCodes.Status403Forbidden);
            try { return Results.Ok(await service.SyncAsync(user, token)); }
            catch (InvalidOperationException error) { return Results.BadRequest(new { message = error.Message }); }
            catch (HttpRequestException) { return Results.Problem("PJMGT APIから同期データを取得できませんでした。", statusCode: StatusCodes.Status502BadGateway); }
            catch (InvalidDataException error) { return Results.BadRequest(new { message = error.Message }); }
        });

        return app;
    }

    private static bool IsAdmin(HttpContext context) =>
        context.Items["CurrentUser"] is AuthUserDto { Role: SystemRoles.Admin };
}
