using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Schedule.Api.Application;
using Schedule.Api.Endpoints;
using Schedule.Api.Infrastructure;
using Microsoft.AspNetCore.Http.Features;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);

builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.AddResponseCompression(options => options.EnableForHttps = true);
builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
    {
        policy
            .WithOrigins(
                "http://127.0.0.1:5173",
                "http://localhost:5173",
                "http://127.0.0.1:5174",
                "http://localhost:5174")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var connectionString = builder.Configuration.GetConnectionString("ScheduleDb")
    ?? "Data Source=schedule-manager.db";
builder.Services.AddDbContext<ScheduleDbContext>(options =>
    options.UseSqlite(connectionString));
builder.Services.AddHttpClient<JapaneseHolidayService>(client =>
{
    // 外部の祝日APIが応答しない場合に、アプリ全体の操作を待たせません。
    client.Timeout = TimeSpan.FromSeconds(10);
});
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<ScheduleService>();
builder.Services.AddScoped<AttachmentService>();
builder.Services.AddScoped<DailyReportService>();
builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 50 * 1024 * 1024;
});

var app = builder.Build();

// 予期しない例外の詳細を外部へ返さず、一定形式のエラーに変換します。
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var exception = context.Features.Get<IExceptionHandlerFeature>()?.Error;
        ApiLog.UnhandledApiException(app.Logger, exception, context.Request.Path.ToString());
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await context.Response.WriteAsJsonAsync(new
        {
            message = "サーバーで予期しないエラーが発生しました。"
        });
    });
});

// Dockerの本番イメージでは、Viteで生成した画面をAPIと同じホストから配信します。
app.UseDefaultFiles();
app.UseStaticFiles();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("frontend");
app.UseResponseCompression();
app.Use(async (context, next) =>
{
    if (!RequiresAuthentication(context.Request))
    {
        await next();
        return;
    }

    var auth = context.RequestServices.GetRequiredService<AuthService>();
    var user = await auth.GetUserByTokenAsync(
        AuthService.GetBearerToken(context.Request),
        context.RequestAborted);
    if (user is null)
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        await context.Response.WriteAsJsonAsync(new
        {
            message = "Authentication is required."
        });
        return;
    }

    context.Items["CurrentUser"] = user;
    await next();
});
app.MapAuthEndpoints();
app.MapScheduleEndpoints();
app.MapDailyReportEndpoints();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ScheduleDbContext>();
    var seedDevelopmentData = app.Environment.IsDevelopment() ||
        app.Configuration.GetValue<bool>("Schedule:SeedDevelopmentData");
    await SeedData.EnsureSeededAsync(db, seedDevelopmentData, CancellationToken.None);
}

app.Run();

static bool RequiresAuthentication(HttpRequest request)
{
    if (!request.Path.StartsWithSegments("/api"))
    {
        return false;
    }

    if (HttpMethods.IsOptions(request.Method))
    {
        return false;
    }

    if (request.Path.Equals("/api/health", StringComparison.OrdinalIgnoreCase))
    {
        return false;
    }

    if (request.Path.Equals("/api/auth/login", StringComparison.OrdinalIgnoreCase))
    {
        return false;
    }

    return true;
}

/// <summary>APIの予期しない例外を構造化ログへ記録します。</summary>
internal static partial class ApiLog
{
    [LoggerMessage(
        EventId = 500,
        Level = LogLevel.Error,
        Message = "Unhandled API exception: {Path}")]
    public static partial void UnhandledApiException(ILogger logger, Exception? exception, string path);
}
