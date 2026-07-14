using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Schedule.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPjmgtIntegration : Migration
    {
        private static readonly string[] ExternalKeyColumns = ["ExternalSource", "ExternalId"];

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ExternalId",
                table: "Teams",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalSource",
                table: "Teams",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CustomerName",
                table: "Projects",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalId",
                table: "Projects",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalSource",
                table: "Projects",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OrderingCompanyName",
                table: "Projects",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalId",
                table: "ProjectAssignments",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalSource",
                table: "ProjectAssignments",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmployeeNo",
                table: "Members",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalId",
                table: "Members",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalSource",
                table: "Members",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PjmgtIntegrationSettings",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", nullable: false),
                    BaseUrl = table.Column<string>(type: "TEXT", nullable: false),
                    ExcludePastProjects = table.Column<bool>(type: "INTEGER", nullable: false),
                    LastConnectionCheckedAt = table.Column<string>(type: "TEXT", nullable: true),
                    LastConnectionSucceeded = table.Column<bool>(type: "INTEGER", nullable: true),
                    LastConnectionMessage = table.Column<string>(type: "TEXT", nullable: true),
                    LastSyncedAt = table.Column<string>(type: "TEXT", nullable: true),
                    LastSyncSummaryJson = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PjmgtIntegrationSettings", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Teams_ExternalSource_ExternalId",
                table: "Teams",
                columns: ExternalKeyColumns,
                unique: true,
                filter: "ExternalSource IS NOT NULL AND ExternalId IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Projects_ExternalSource_ExternalId",
                table: "Projects",
                columns: ExternalKeyColumns,
                unique: true,
                filter: "ExternalSource IS NOT NULL AND ExternalId IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectAssignments_ExternalSource_ExternalId",
                table: "ProjectAssignments",
                columns: ExternalKeyColumns,
                unique: true,
                filter: "ExternalSource IS NOT NULL AND ExternalId IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Members_EmployeeNo",
                table: "Members",
                column: "EmployeeNo",
                unique: true,
                filter: "EmployeeNo IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Members_ExternalSource_ExternalId",
                table: "Members",
                columns: ExternalKeyColumns,
                unique: true,
                filter: "ExternalSource IS NOT NULL AND ExternalId IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PjmgtIntegrationSettings");

            migrationBuilder.DropIndex(
                name: "IX_Teams_ExternalSource_ExternalId",
                table: "Teams");

            migrationBuilder.DropIndex(
                name: "IX_Projects_ExternalSource_ExternalId",
                table: "Projects");

            migrationBuilder.DropIndex(
                name: "IX_ProjectAssignments_ExternalSource_ExternalId",
                table: "ProjectAssignments");

            migrationBuilder.DropIndex(
                name: "IX_Members_EmployeeNo",
                table: "Members");

            migrationBuilder.DropIndex(
                name: "IX_Members_ExternalSource_ExternalId",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "ExternalId",
                table: "Teams");

            migrationBuilder.DropColumn(
                name: "ExternalSource",
                table: "Teams");

            migrationBuilder.DropColumn(
                name: "CustomerName",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "ExternalId",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "ExternalSource",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "OrderingCompanyName",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "ExternalId",
                table: "ProjectAssignments");

            migrationBuilder.DropColumn(
                name: "ExternalSource",
                table: "ProjectAssignments");

            migrationBuilder.DropColumn(
                name: "EmployeeNo",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "ExternalId",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "ExternalSource",
                table: "Members");
        }
    }
}
