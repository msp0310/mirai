using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Schedule.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDailyReports : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DailyReportEntryId",
                table: "ProjectWorkLogs",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DailyReportId",
                table: "ProjectWorkLogs",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "DailyReports",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", nullable: false),
                    MemberId = table.Column<string>(type: "TEXT", nullable: false),
                    Date = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    Summary = table.Column<string>(type: "TEXT", nullable: false),
                    Blockers = table.Column<string>(type: "TEXT", nullable: true),
                    NextPlan = table.Column<string>(type: "TEXT", nullable: true),
                    EntriesJson = table.Column<string>(type: "TEXT", nullable: false),
                    CommentsJson = table.Column<string>(type: "TEXT", nullable: false),
                    SubmittedAt = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<string>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<string>(type: "TEXT", nullable: false),
                    Version = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DailyReports", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProjectWorkLogs_DailyReportId",
                table: "ProjectWorkLogs",
                column: "DailyReportId");

            migrationBuilder.CreateIndex(
                name: "IX_DailyReports_MemberId_Date",
                table: "DailyReports",
                columns: ["MemberId", "Date"],
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DailyReports");

            migrationBuilder.DropIndex(
                name: "IX_ProjectWorkLogs_DailyReportId",
                table: "ProjectWorkLogs");

            migrationBuilder.DropColumn(
                name: "DailyReportEntryId",
                table: "ProjectWorkLogs");

            migrationBuilder.DropColumn(
                name: "DailyReportId",
                table: "ProjectWorkLogs");
        }
    }
}
