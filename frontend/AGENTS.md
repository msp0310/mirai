# Frontend Instructions

Run the local frontend server yourself and open the preview in the in-app
browser. Do not give the user server-start instructions when you can run it.
Use `npm run dev -- --port 5174`.

The app normally runs against the ASP.NET Core API at `http://127.0.0.1:5080`
through the Vite `/api` proxy. Online/API behavior is the product default.

## Product Context

COMPASS is a schedule app for system companies managing SI / commissioned software
development projects. Use project language, phases, roles, and examples from
system development delivery rather than web production.

Keep the visible structure aligned with `Team > Project > Task`:

- `Projects` is the portfolio/card view before entering the Gantt.
- `Gantt`, `Issues`, `WorkLogs`, `Resource`, `Calendar`, `Milestones`, and
  history are project-scoped.
- Sidebar project menus should appear as project operations, not global master
  operations.
- Master settings manage teams, members/login, and calendars.
- Project settings manage project status, project members, and project-specific
  configuration.

## UI And UX Preferences

- Keep the design modern SaaS, but operational and dense. Avoid marketing-style
  hero layouts.
- Gantt readability matters more than decorative UI. Favor task-name visibility,
  stable row height, and predictable keyboard/mouse behavior.
- Task names should be text-first by default. Use deliberate edit triggers such
  as click/F2/Enter rather than always-on inputs.
- Progress is not a default left-table column; show progress and assignee
  metadata near/on the Gantt bars.
- Completed tasks should read as muted/gray.
- The Gantt day view should show day numbers centered in the header.
- Do not show the task detail panel just because a bar is clicked; reserve it
  for deliberate detail actions such as double-click or explicit buttons.
- Keyboard and multi-select behavior should stay Brabio-like:
  Shift-click for ranges, Ctrl/Cmd-click for additive selection, Shift+Up/Down
  to extend selection, arrow keys for hierarchy/row movement where implemented,
  F2 for rename, Esc for clearing/closing.

## Implementation Notes

- Use TypeScript throughout.
- Keep components split by responsibility; avoid adding large, tangled UI files
  when a focused component would be clearer.
- Prefer existing data shapes in `types/schedule.ts` and repository adapters in
  `data/` before introducing new state contracts.
- Use `localScheduleStorage` only for local draft/view state. Project payload
  saves should flow through the API repository when online.
- Brabio XLSX import is Brabio-specific. Do not reintroduce generic column
  mapping or preview UI unless the user asks for a generic importer.
- If durable product feedback changes direction, update this file.

## Visual QA

Before finishing UI changes:

- Check the in-app browser whenever possible.
- Verify text fit and overlap in the current viewport.
- Watch for Gantt bar label/assignee overlap and horizontal scroll edge cases.
- Run `npm run check`; run `npm run build` for wider changes.
