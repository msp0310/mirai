using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Schedule.Api.Application;
using Schedule.Api.Contracts;
using Schedule.Api.Domain;
using Schedule.Api.Infrastructure;
using Xunit;

namespace Schedule.Api.Tests;

public sealed class PjmgtIntegrationServiceTests
{
    [Fact]
    public async Task SyncImportsCurrentProjectsAndPlannedWorkOnly()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var dbOptions = new DbContextOptionsBuilder<ScheduleDbContext>().UseSqlite(connection).Options;
        await using var db = new ScheduleDbContext(dbOptions);
        await db.Database.EnsureCreatedAsync();
        db.PjmgtIntegrationSettings.Add(new PjmgtIntegrationSettingEntity
        {
            BaseUrl = "https://pjmgt.example.test/pjmgt/api/v1",
            ExcludePastProjects = true
        });
        await db.SaveChangesAsync();

        var today = DateOnly.FromDateTime(DateTime.Today);
        var currentStart = today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var currentEnd = today.AddMonths(1).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var oldEnd = today.AddDays(-1).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var workMonth = today.ToString("yyyy-MM", CultureInfo.InvariantCulture);
        using var httpClient = new HttpClient(new PjmgtApiHandler(currentStart, currentEnd, oldEnd, workMonth));
        var client = new PjmgtClient(httpClient, Options.Create(new PjmgtOptions { ApiKey = "secret" }));
        var auditLogs = new AuditLogService(db, new HttpContextAccessor());
        var service = new PjmgtIntegrationService(db, client, auditLogs);
        var user = new AuthUserDto("admin", null, "admin@example.com", "管理者", SystemRoles.Admin, false);

        await client.TestConnectionAsync("https://pjmgt.example.test/pjmgt/api/v1", CancellationToken.None);
        var preview = await service.PreviewAsync(CancellationToken.None);
        Assert.Equal(1, preview.ProjectsCreated);
        Assert.Equal(1, preview.ProjectsSkipped);
        Assert.Equal(1, preview.AssignmentsImported);
        Assert.Empty(preview.Errors);

        await service.SyncAsync(user, CancellationToken.None);

        var project = await db.Projects.Include(item => item.Assignments).Include(item => item.Members).SingleAsync();
        Assert.Equal("PJ-001", project.ProjectNo);
        Assert.Equal("納品先A", project.CustomerName);
        Assert.Equal("発注元A", project.OrderingCompanyName);
        Assert.Single(project.Assignments);
        Assert.Equal(60, project.Assignments[0].AllocationPercent);
        Assert.Single(project.Members);
        var member = await db.Members.SingleAsync();
        Assert.Equal("E001", member.EmployeeNo);
        Assert.Equal("active", member.Status);

        await service.SyncAsync(user, CancellationToken.None);
        Assert.Single(await db.Projects.ToListAsync());
        Assert.Single(await db.ProjectAssignments.ToListAsync());
    }

    private sealed class PjmgtApiHandler(
        string currentStart,
        string currentEnd,
        string oldEnd,
        string workMonth) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Assert.Equal("Bearer", request.Headers.Authorization?.Scheme);
            Assert.Equal("secret", request.Headers.Authorization?.Parameter);
            var uri = Assert.IsType<Uri>(request.RequestUri);

            if (uri.AbsolutePath.EndsWith("/api/v1/", StringComparison.Ordinal))
                return Json(new { name = "PJMGT External REST API", version = "v1" });

            var query = System.Web.HttpUtility.ParseQueryString(uri.Query);
            Assert.Equal("1", query["page"]);
            Assert.Equal("200", query["per_page"]);
            Assert.Equal("id", query["sort"]);

            if (uri.AbsolutePath.EndsWith("/teams", StringComparison.Ordinal))
                return Collection([new { id = 10, name = "開発部", status = "0" }]);

            if (uri.AbsolutePath.EndsWith("/members", StringComparison.Ordinal))
                return Collection([new
                {
                    id = 20,
                    employee_no = "E001",
                    name = "山田 太郎",
                    team = new { id = 10, name = "開発部" },
                    employment_status = "1",
                    period_from = currentStart,
                    period_to = (string?)null
                }]);

            if (uri.AbsolutePath.EndsWith("/projects", StringComparison.Ordinal))
            {
                Assert.Equal("true", query["include_deleted"]);
                return Collection([
                    Project(30, "PJ-001", "現行案件", "納品先A", "発注元A", currentEnd),
                    Project(31, "PJ-OLD", "過去案件", "納品先B", "発注元B", oldEnd)
                ]);
            }

            if (uri.AbsolutePath.EndsWith("/project-members", StringComparison.Ordinal))
                return Collection([new
                {
                    id = 40,
                    project = new { id = 30, project_no = "PJ-001", name = "現行案件", sales_status = new { id = 1, name = "進行中" } },
                    member = new { id = 20, name = "山田 太郎" }
                }]);

            if (uri.AbsolutePath.EndsWith("/project-manhours", StringComparison.Ordinal))
                return Collection([
                    Manhour(50, 60, 120),
                    Manhour(51, 0, 80)
                ]);

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound));
        }

        private object Project(int id, string projectNo, string name, string deliveryDestination, string companyName, string periodTo) => new
        {
            id,
            project_no = projectNo,
            name,
            sales_status = new { id = 1, name = "進行中" },
            company = new { id = 1, name = companyName, short_name = companyName },
            sales_member = (object?)null,
            manager_member = new { id = 20, name = "山田 太郎" },
            team = new { id = 10, name = "開発部" },
            delivery_destination = deliveryDestination,
            dates = new { period_from = currentStart, period_to = periodTo }
        };

        private object Manhour(int id, int scheduledWorkRatio, int actualWorkRatio) => new
        {
            id,
            project = new { id = 30, project_no = "PJ-001", name = "現行案件", sales_status = new { id = 1, name = "進行中" } },
            member = new { id = 20, name = "山田 太郎" },
            work_month = workMonth,
            scheduled_work_ratio = scheduledWorkRatio,
            actual_work_ratio = actualWorkRatio
        };

        private static Task<HttpResponseMessage> Collection<T>(IReadOnlyList<T> data) => Json(new
        {
            data,
            meta = new { page = 1, per_page = 200, total = data.Count, total_pages = 1 }
        });

        private static Task<HttpResponseMessage> Json<T>(T value)
        {
            var json = JsonSerializer.Serialize(value, new JsonSerializerOptions(JsonSerializerDefaults.Web));
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            });
        }
    }
}
