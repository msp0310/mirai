# Repository Instructions

COMPASS is an SI-focused schedule management product. It combines a
React/Vite frontend with an ASP.NET Core Web API and SQLite backend.

## Product Direction

- The app is for system companies managing commissioned software development and
  operations projects. Use SI delivery language: teams, projects, phases,
  tasks, milestones, issues, work logs, members, PM/PL/SE/FE/BE/QA, and
  project settings.
- The main information structure is `Team > Project > Task`. Projects belong to
  a team, and unassigned team values should be represented as `null` with the
  display label `未所属`, not as a fake team record.
- Keep the project portfolio first. Users should be able to scan project cards
  before entering a project-level Gantt.
- Project-level actions belong to the selected project. Global/admin master
  data belongs under management settings.
- Keep PM schedule-change analytics as a real roadmap direction. Schedule
  change counts and task-level churn should feed future estimation and risk
  analysis.

## Runtime

- Frontend dev server: run from `frontend/` with `npm run dev -- --port 5174`.
- Backend API: run from the repository root with
  `dotnet run --project backend/src/Schedule.Api/Schedule.Api.csproj --urls http://127.0.0.1:5080`.
- The frontend Vite proxy sends `/api` to `http://127.0.0.1:5080`.
- Online/API mode is the default. Do not silently fall back to mock auth or mock
  data unless explicitly enabled for a specific debugging task.
- The API targets .NET 10. Use the SDK pinned in `global.json`.
- Initial online admin account for local development is seeded by the API:
  `pm@example.com` / `Password123!`. Do not show this as visible helper text on
  the login screen unless the user asks for demo affordances.

## Verification

- Prefer live in-app browser verification for UI behavior.
- For frontend changes, run `npm run check` at minimum; run `npm run build` for
  broader UI or routing changes.
- For backend changes, run `dotnet build backend/ScheduleManager.sln`.
- If both sides are touched, verify an online login through the Vite URL:
  `http://127.0.0.1:5174/#crm-integration`.
- Keep dev servers running when the user needs to inspect the app.

## Commit Convention

- Use Conventional Commits for commit messages: `feat`, `fix`, `docs`,
  `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, or `revert`.
- Use a focused scope when useful, such as `gantt`, `api`, or `auth`.
- Keep one purpose per commit and write the description in concise Japanese or
  English.
- See `CONTRIBUTING.md` for the full format and breaking-change rules.

## Backend Guidelines

- Use singular DTO names such as `ProjectDto`, `MemberDto`, and
  `CalendarHolidayDto`.
- Keep the first API boundary project-level: workspace read, project schedule
  GET/PUT, auth, members, issues, work logs, and calendar holiday import.
- Preserve optimistic version behavior for project schedule saves.
- Keep SQLite persistence simple and explicit; do not introduce a second
  database or authentication framework without a product reason.

## Frontend Guidelines

- Use TypeScript and keep components small enough to maintain.
- Prefer existing local modules and patterns before adding new abstractions.
- Keep Gantt interactions dense and Brabio-like, but with modern SaaS polish.
- Use icons for compact toolbar actions where possible.
- Do not add landing-page or marketing-style screens; build usable app screens.
- When changing layout, check that text does not overlap or overflow at the
  in-app browser viewport.

### Frontend Architecture

- Organize product code by feature. Keep feature-specific components, hooks,
  state, types, and pure calculations inside `features/<feature>/`.
- Put genuinely reusable UI in shared `components/` and reusable hooks in
  shared `hooks/`. Do not move code into shared folders only because it is used
  twice; first confirm that the concepts and change reasons are the same.
- Keep page and route components focused on composition. Move substantial UI
  sections into components, stateful interaction into purpose-specific hooks,
  and deterministic calculations into `lib/` modules.
- Split components by responsibility and state ownership, not by line count
  alone. Re-evaluate components around 400-500 lines, components with several
  unrelated effects, or components that coordinate multiple independent
  workflows.
- Keep state close to its consumers. Use `useState` for simple local input and
  open/closed state, and use Jotai when sibling components need shared state,
  prop drilling becomes significant, or isolated subscriptions improve render
  performance.
- Jotai atoms may be global, feature-scoped, or component-scoped. Place
  feature atoms under `features/<feature>/state` and colocate component-only
  atoms near their owner. Scope atoms with a `Provider` at the page or
  workbench boundary when instances must not share state.
- Do not import another feature's internal atoms, components, or helpers
  directly. Expose deliberate public components, hooks, types, or actions from
  the owning feature and depend on those interfaces instead.
- Prefer derived atoms or render-time derivation over mirrored state and
  synchronization effects. Use `useEffect` for synchronization with external
  systems, not for values that can be calculated from existing state.
- Keep API calls and business workflows out of primitive atoms. Put them in
  feature services or action hooks, and let atoms represent the minimum state
  that consumers need to subscribe to.
- Avoid large catch-all prop objects and context values. Pass cohesive models
  or explicit props, and keep high-frequency state subscriptions narrow.
- Write code comments in Japanese. Comments should explain non-obvious intent,
  constraints, or trade-offs rather than restating the code.
