using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using Schedule.Api.Contracts;

namespace Schedule.Api.Application;

public sealed class PjmgtOptions
{
    public const string SectionName = "Pjmgt";
    public string ApiKey { get; set; } = "";
}

/// <summary>PJMGTの汎用REST APIをページング取得し、同期用スナップショットへ集約します。</summary>
public sealed class PjmgtClient(HttpClient httpClient, IOptions<PjmgtOptions> options)
{
    private const int PageSize = 200;
    private const int MaximumPages = 10_000;
    private readonly PjmgtOptions options = options.Value;

    public bool ApiKeyConfigured => !string.IsNullOrWhiteSpace(options.ApiKey);

    public async Task TestConnectionAsync(string baseUrl, CancellationToken cancellationToken)
    {
        using var request = CreateRequest(HttpMethod.Get, baseUrl, "");
        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
    }

    public async Task<PjmgtSnapshotDto> GetSnapshotAsync(string baseUrl, CancellationToken cancellationToken)
    {
        var teamsTask = GetAllAsync<PjmgtApiTeamDto>(baseUrl, "teams", cancellationToken);
        var membersTask = GetAllAsync<PjmgtApiMemberDto>(baseUrl, "members", cancellationToken);
        var projectsTask = GetAllAsync<PjmgtApiProjectDto>(baseUrl, "projects?include_deleted=true", cancellationToken);
        var projectMembersTask = GetAllAsync<PjmgtApiProjectMemberDto>(baseUrl, "project-members", cancellationToken);
        var manhoursTask = GetAllAsync<PjmgtApiProjectManhourDto>(baseUrl, "project-manhours", cancellationToken);
        await Task.WhenAll(teamsTask, membersTask, projectsTask, projectMembersTask, manhoursTask);

        var teams = await teamsTask;
        var members = await membersTask;
        var projects = await projectsTask;
        var projectMembers = await projectMembersTask;
        var manhours = await manhoursTask;
        var membersById = members.ToDictionary(item => item.Id);

        var unknownMemberReferences = projectMembers.Count(item => !membersById.ContainsKey(item.Member.Id)) +
            manhours.Count(item => !membersById.ContainsKey(item.Member.Id));
        if (unknownMemberReferences > 0)
        {
            throw new InvalidDataException($"PJMGTの要員参照を{unknownMemberReferences}件解決できませんでした。");
        }

        return new PjmgtSnapshotDto
        {
            GeneratedAt = DateTimeOffset.UtcNow.ToString("O"),
            Teams = teams.Select(item => new PjmgtTeamDto(
                item.Id.ToString(System.Globalization.CultureInfo.InvariantCulture),
                item.Name,
                item.Status)).ToArray(),
            Members = members.Select(item => new PjmgtMemberDto(
                item.Id.ToString(System.Globalization.CultureInfo.InvariantCulture),
                item.EmployeeNo,
                item.Name,
                ToId(item.Team),
                null,
                null,
                item.EmploymentStatus,
                item.PeriodFrom,
                item.PeriodTo)).ToArray(),
            Projects = projects.Select(item => new PjmgtProjectDto(
                item.Id.ToString(System.Globalization.CultureInfo.InvariantCulture),
                item.ProjectNo,
                item.Name,
                item.DeliveryDestination,
                item.Company?.Name,
                ToId(item.Team),
                EmployeeNo(item.ManagerMember, membersById),
                EmployeeNo(item.SalesMember, membersById),
                item.SalesStatus.Id,
                item.Dates.PeriodFrom,
                item.Dates.PeriodTo)).ToArray(),
            ProjectMembers = projectMembers.Select(item => new PjmgtProjectMemberDto(
                item.Project.Id.ToString(System.Globalization.CultureInfo.InvariantCulture),
                membersById[item.Member.Id].EmployeeNo)).ToArray(),
            Allocations = manhours.Where(item => item.ScheduledWorkRatio > 0).Select(item => new PjmgtAllocationDto(
                item.Project.Id.ToString(System.Globalization.CultureInfo.InvariantCulture),
                membersById[item.Member.Id].EmployeeNo,
                item.WorkMonth.Replace("-", "", StringComparison.Ordinal),
                item.ScheduledWorkRatio)).ToArray()
        };
    }

    private async Task<IReadOnlyList<T>> GetAllAsync<T>(
        string baseUrl,
        string resource,
        CancellationToken cancellationToken)
    {
        var result = new List<T>();
        var page = 1;
        var totalPages = 1;
        do
        {
            var separator = resource.Contains('?') ? "&" : "?";
            var path = $"{resource}{separator}page={page}&per_page={PageSize}&sort=id";
            using var request = CreateRequest(HttpMethod.Get, baseUrl, path);
            using var response = await httpClient.SendAsync(request, cancellationToken);
            response.EnsureSuccessStatusCode();
            var collection = await response.Content.ReadFromJsonAsync<PjmgtApiCollection<T>>(cancellationToken)
                ?? throw new InvalidDataException($"PJMGTの{resource}レスポンスが空です。");
            result.AddRange(collection.Data);
            totalPages = Math.Max(collection.Meta.TotalPages, 1);
            if (totalPages > MaximumPages)
            {
                throw new InvalidDataException($"PJMGTの{resource}ページ数が上限を超えています。");
            }
            page += 1;
        }
        while (page <= totalPages);

        return result;
    }

    private HttpRequestMessage CreateRequest(HttpMethod method, string baseUrl, string path)
    {
        var request = new HttpRequestMessage(method, $"{baseUrl.TrimEnd('/')}/{path}");
        if (ApiKeyConfigured)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.ApiKey);
        }
        return request;
    }

    private static string? ToId(PjmgtApiIdNameDto? item) =>
        item?.Id.ToString(System.Globalization.CultureInfo.InvariantCulture);

    private static string? EmployeeNo(
        PjmgtApiIdNameDto? reference,
        Dictionary<int, PjmgtApiMemberDto> membersById) =>
        reference is not null && membersById.TryGetValue(reference.Id, out var member)
            ? member.EmployeeNo
            : null;
}

internal sealed class PjmgtApiCollection<T>
{
    public IReadOnlyList<T> Data { get; init; } = [];
    public PjmgtApiMetaDto Meta { get; init; } = new();
}

internal sealed class PjmgtApiMetaDto
{
    [JsonPropertyName("total_pages")]
    public int TotalPages { get; init; }
}

internal sealed record PjmgtApiIdNameDto(int Id, string? Name);

internal sealed record PjmgtApiTeamDto(int Id, string Name, string? Status);

internal sealed class PjmgtApiMemberDto
{
    public int Id { get; init; }
    [JsonPropertyName("employee_no")]
    public string EmployeeNo { get; init; } = "";
    public string Name { get; init; } = "";
    public PjmgtApiIdNameDto? Team { get; init; }
    [JsonPropertyName("employment_status")]
    public string? EmploymentStatus { get; init; }
    [JsonPropertyName("period_from")]
    public string? PeriodFrom { get; init; }
    [JsonPropertyName("period_to")]
    public string? PeriodTo { get; init; }
}

internal sealed class PjmgtApiProjectDto
{
    public int Id { get; init; }
    [JsonPropertyName("project_no")]
    public string ProjectNo { get; init; } = "";
    public string Name { get; init; } = "";
    [JsonPropertyName("delivery_destination")]
    public string? DeliveryDestination { get; init; }
    public PjmgtApiIdNameDto? Company { get; init; }
    public PjmgtApiIdNameDto? Team { get; init; }
    [JsonPropertyName("manager_member")]
    public PjmgtApiIdNameDto? ManagerMember { get; init; }
    [JsonPropertyName("sales_member")]
    public PjmgtApiIdNameDto? SalesMember { get; init; }
    [JsonPropertyName("sales_status")]
    public PjmgtApiIdNameDto SalesStatus { get; init; } = new(0, null);
    public PjmgtApiProjectDatesDto Dates { get; init; } = new();
}

internal sealed class PjmgtApiProjectDatesDto
{
    [JsonPropertyName("period_from")]
    public string? PeriodFrom { get; init; }
    [JsonPropertyName("period_to")]
    public string? PeriodTo { get; init; }
}

internal sealed class PjmgtApiProjectMemberDto
{
    public PjmgtApiProjectSummaryDto Project { get; init; } = new();
    public PjmgtApiIdNameDto Member { get; init; } = new(0, null);
}

internal sealed class PjmgtApiProjectManhourDto
{
    public PjmgtApiProjectSummaryDto Project { get; init; } = new();
    public PjmgtApiIdNameDto Member { get; init; } = new(0, null);
    [JsonPropertyName("work_month")]
    public string WorkMonth { get; init; } = "";
    [JsonPropertyName("scheduled_work_ratio")]
    public int ScheduledWorkRatio { get; init; }
}

internal sealed class PjmgtApiProjectSummaryDto
{
    public int Id { get; init; }
}
