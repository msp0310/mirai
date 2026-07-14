import { globalStyle } from "@vanilla-extract/css";

globalStyle(".workbench", {
  display: "flex",
  flexDirection: "column",
  height: "calc(100dvh - 128px)",
  minHeight: 480,
  overflow: "hidden",
  "@media": {
    "screen and (max-width: 1120px)": {
      height: "calc(100dvh - 180px)",
    },
    "screen and (max-width: 760px)": {
      height: "auto",
      minHeight: 0,
      overflow: "visible",
    },
  },
});

globalStyle(".workbench .gantt-shell", {
  flex: "1 1 auto",
  gridTemplateRows: "78px minmax(0, 1fr)",
  minHeight: 0,
});

globalStyle(".workbench .gantt-shell.table-view", {
  gridTemplateRows: "44px minmax(0, 1fr)",
});

globalStyle(".workbench .task-table, .workbench .timeline-body", {
  height: "100%",
  minHeight: 0,
  "@media": {
    "screen and (max-width: 760px)": {
      height: "clamp(360px, calc(100dvh - 280px), 560px)",
    },
  },
});
