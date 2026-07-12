# System Evaluation Audit

Date: 2026-07-09
Product: SI project / Gantt management prototype
Scope: Projects portfolio, project Gantt, overview, resource workload, project settings, master settings
Capture tool: Codex in-app Browser

## Captured Steps

1. Project Gantt: `screenshots/01-project-gantt.png`
   Health: strong core workflow, but dense.

2. Projects portfolio: `screenshots/02-project-portfolio.png`
   Health: structurally strong entry point.

3. Project overview: `screenshots/03-project-overview.png`
   Health: useful PM summary, needs stronger action priority.

4. Resource workload: `screenshots/04-resource-view.png`
   Health: high operational value, visually heavy.

5. Project settings: `screenshots/05-project-settings.png`
   Health: correct project scope, some labeling ambiguity.

6. Master settings: `screenshots/06-master-settings.png`
   Health: correct admin scope, needs stronger master-data affordance.

## Overall Assessment

The system model is now directionally right:

- `team > project > gantt/task` is visible through the Projects portfolio and team cards.
- The Gantt is positioned as the main project execution surface.
- Resource, overview, calendar, milestones, and activity are project-level child views.
- Sidebar settings represents workspace/master administration.
- Topbar project settings represents the active project.
- Save scope now matches user expectation: project screens save `this Gantt`; admin saves `master settings`.

This is no longer just a Gantt screen. It is becoming a project operations console for SI teams.

## Strengths

1. Information architecture now matches the domain.
   The portfolio screen makes team selection explicit before entering project work. This resolves the earlier mismatch where `案件` and `ガント` looked like siblings.

2. Gantt editing surface is operationally dense.
   The Gantt has hierarchy, filters, scale controls, day/week/month controls, dependency visuals, save state, import/export, and project-level tabs. It feels closer to a real PM workbench than a static chart.

3. Resource view has genuine value for system companies.
   Weekly workload by person, capacity, utilization, and team-wide scope address a real SI pain: parallel projects and member overload.

4. Status overview has the right PM signals.
   Delay, effort, next milestone, completion rate, phase progress, health checks, and milestone summaries are the right families of information.

5. Settings split is conceptually correct.
   Project settings contains project-specific information; master settings contains team/member/calendar management. This supports future API boundaries.

6. The current frontend is API-ready in shape.
   Project-level save scope, project IDs, team IDs, member IDs, local draft separation, and change review are all pointing toward a future C# API and SQLite persistence model.

## UX Risks

1. Save state still reads broader than it acts.
   The scope is now correct, but users may still wonder whether resource display settings, favorites, filters, and portfolio state are saved with the Gantt or globally.

2. The Gantt toolbar is powerful but visually crowded.
   It has many useful controls, but the first-time user may not know the difference between hierarchy, dependency, baseline, move, filters, and display options.

3. Overview is descriptive, not yet decisional.
   The overview shows risk signals, but the next action is not always obvious. For example, health check rows link to Gantt, but priority order and severity grouping could be stronger.

4. Resource view is valuable but scan-heavy.
   The weekly matrix is useful for PMs, but overload cells, available capacity, and project contribution need stronger visual hierarchy for repeated daily use.

5. Portfolio cards contain a lot of dense metadata.
   Progress, status, milestone, members, task count, workdays, and action buttons are all present. This is useful, but high-card density may become harder when there are dozens of projects.

6. Project settings and master settings have similar visual language.
   The conceptual split is correct, but the UI could make the scope distinction stronger with clearer page subtitles and more explicit save language.

## Accessibility Risks

1. Several icon-only controls depend on hover/title text.
   The app has many icon buttons. Some have labels, but keyboard and screen-reader verification is still needed.

2. Dense tables and timeline grids need keyboard traversal testing.
   Gantt and Resource are highly interactive grid-like surfaces. Screenshots cannot prove keyboard access, focus order, or screen-reader structure.

3. Color is doing meaningful work.
   Status, workload warnings, today highlights, progress, and member chips all use color. Text labels exist in many places, but contrast and color-independent meaning should be verified.

4. Horizontal scrolling is expected but should be communicated.
   Gantt and Resource require horizontal scroll. This is acceptable for the domain, but keyboard and touchpad ergonomics need explicit testing.

## Priority Recommendations

1. Define the persistence contract explicitly in the UI and API plan.
   Recommended save units:
   - Project Gantt: tasks, hierarchy, dates, dependencies, milestones, project calendar, project settings.
   - Master settings: teams, members, default calendars.
   - Local display state: filters, open panels, zoom, collapsed rows, favorites.
     Decide which are synced to the backend and which remain user preferences.

2. Add a project activity / schedule-change analytics model next.
   This should become a first-class `Activity` or `Analytics` view, not just a log. Track task date change count, before/after dates, changedBy, changedAt, reason, and impact days.

3. Strengthen portfolio scaling.
   Add grouping, compact/list mode, status lanes or saved filters before project count grows. Cards are good for the MVP, but not enough for 50+ projects.

4. Make Resource a PM decision tool.
   Add overload summary, member drilldown, cross-project contribution breakdown, and warnings such as `next 2 weeks overloaded`.

5. Clarify scope labels everywhere.
   Use consistent labels:
   - `このガント`
   - `このプロジェクト`
   - `このチーム`
   - `管理設定`
     Avoid mixing `プロジェクト`, `案件`, and `ガント` in the same operation unless the distinction is intentional.

6. Add role-based scenarios before backend design.
   At minimum:
   - PM creates a project and builds a schedule.
   - PM assigns members and detects overload.
   - Member checks assigned tasks.
   - Manager reviews team portfolio.
   - Admin edits team/member/calendar master data.

7. Verify keyboard-first Gantt workflows.
   Since this product depends on speed, confirm:
   - Arrow navigation
   - Indent/outdent
   - Inline edit
   - Date shift
   - Undo/redo
   - Save
   - Move within hierarchy

## Evidence Limits

- This audit is based on screenshots and DOM-visible state from the current frontend prototype.
- It does not prove full keyboard accessibility, screen-reader behavior, mobile ergonomics, backend data integrity, multi-user conflict handling, or permission design.
- Resource was initially captured during a loading state and then recaptured after the view stabilized; the accepted file is `screenshots/04-resource-view.png`.

## Suggested Next Product Decisions

1. Finalize data ownership:
   team, member, calendar, project, gantt task, milestone, activity, schedule-change event.

2. Decide permission model:
   admin, manager, PM, member, viewer.

3. Decide API save units:
   `PUT /projects/{id}`, `PUT /projects/{id}/tasks`, `PUT /teams/{id}`, `PUT /members/{id}`, `POST /schedule-changes`.

4. Decide analytics MVP:
   task date-change count, phase churn, member overload trend, milestone risk.

5. Decide display-state persistence:
   server-side user preference or browser-local preference.
