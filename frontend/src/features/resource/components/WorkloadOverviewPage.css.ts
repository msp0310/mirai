import { style } from "@vanilla-extract/css";

export const page = style({
  display: "grid",
  gap: 16,
  padding: "18px 20px 28px",
});

export const header = style({
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 16,
});

export const heading = style({
  margin: 0,
  color: "#172238",
  fontSize: 22,
  letterSpacing: 0,
});

export const description = style({
  display: "block",
  marginTop: 4,
  color: "#69778d",
  fontSize: 12,
  fontWeight: 700,
});

export const segmented = style({
  display: "inline-flex",
  height: 34,
  padding: 3,
  border: "1px solid #d6e0ee",
  borderRadius: 7,
  background: "#f4f7fb",
});

export const segment = style({
  minWidth: 82,
  border: 0,
  borderRadius: 5,
  color: "#506078",
  background: "transparent",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
});

export const segmentActive = style({
  color: "#174dbd",
  background: "#fff",
  boxShadow: "0 1px 4px rgba(35, 56, 91, 0.12)",
});

export const summary = style({
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 10,
});

export const summaryItem = style({
  minHeight: 72,
  border: "1px solid #dce4ef",
  borderRadius: 7,
  background: "#fff",
  padding: "12px 14px",
});

export const summaryLabel = style({
  display: "block",
  color: "#69778d",
  fontSize: 11,
  fontWeight: 800,
});

export const summaryValue = style({
  display: "block",
  marginTop: 4,
  color: "#172238",
  fontSize: 24,
  fontWeight: 900,
  letterSpacing: 0,
});

export const controls = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  borderTop: "1px solid #dfe6ef",
  borderBottom: "1px solid #dfe6ef",
  padding: "9px 0",
});

export const select = style({
  width: 220,
  height: 34,
  border: "1px solid #d5dfed",
  borderRadius: 6,
  color: "#31415a",
  background: "#fff",
  padding: "0 10px",
  fontSize: 12,
  fontWeight: 700,
});

export const pager = style({
  display: "flex",
  alignItems: "center",
  gap: 6,
});

export const pagerButton = style({
  display: "grid",
  width: 32,
  height: 32,
  placeItems: "center",
  border: "1px solid #d5dfed",
  borderRadius: 6,
  color: "#40516b",
  background: "#fff",
  cursor: "pointer",
  selectors: { "&:disabled": { cursor: "default", opacity: 0.35 } },
});

export const pagerIcon = style({ width: 15, height: 15 });

export const period = style({
  minWidth: 154,
  color: "#53627a",
  fontSize: 11,
  fontWeight: 800,
  textAlign: "center",
});

export const gridScroll = style({
  overflow: "auto",
  border: "1px solid #dce4ef",
  borderRadius: 7,
  background: "#fff",
});

export const grid = style({
  display: "grid",
  minWidth: 980,
});

export const cell = style({
  minHeight: 58,
  borderRight: "1px solid #e4eaf2",
  borderBottom: "1px solid #e4eaf2",
  padding: "9px 10px",
});

export const head = style({
  minHeight: 44,
  color: "#5f6e84",
  background: "#f7f9fc",
  fontSize: 11,
  fontWeight: 900,
});

export const entityCell = style({
  position: "sticky",
  left: 0,
  zIndex: 2,
  display: "flex",
  minWidth: 0,
  alignItems: "center",
  gap: 9,
  background: "#fff",
});

export const entityText = style({ minWidth: 0 });
export const entityName = style({
  display: "block",
  overflow: "hidden",
  color: "#25334a",
  fontSize: 12,
  fontWeight: 900,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
export const entityMeta = style({
  display: "block",
  marginTop: 2,
  color: "#7b8799",
  fontSize: 10,
  fontWeight: 700,
});

export const weekCell = style({
  display: "grid",
  alignContent: "start",
  gap: 5,
  background: "#fff",
});

export const loadLine = style({ display: "flex", alignItems: "baseline", gap: 5 });
export const loadValue = style({ color: "#263750", fontSize: 13, fontWeight: 900 });
export const loadHours = style({ color: "#778399", fontSize: 10, fontWeight: 700 });
export const loadTrack = style({
  height: 4,
  overflow: "hidden",
  borderRadius: 999,
  background: "#e8eef6",
});
export const loadBar = style({ height: "100%", borderRadius: 999, background: "#2e6be6" });
export const loadWarning = style({ background: "#e6a229" });
export const loadDanger = style({ background: "#e05c4f" });

export const projectLinks = style({ display: "flex", minWidth: 0, gap: 4, overflow: "hidden" });
export const projectLink = style({
  overflow: "hidden",
  maxWidth: 112,
  border: 0,
  color: "#2458c5",
  background: "transparent",
  padding: 0,
  fontSize: 9,
  fontWeight: 800,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  cursor: "pointer",
});

export const teamButton = style({
  border: 0,
  color: "#25334a",
  background: "transparent",
  padding: 0,
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
  textAlign: "left",
});

export const empty = style({
  padding: 32,
  color: "#728097",
  fontSize: 12,
  fontWeight: 700,
  textAlign: "center",
});

export const planActions = style({ display: "flex", alignItems: "center", gap: 8 });
export const primaryAction = style({
  height: 34,
  border: 0,
  borderRadius: 6,
  color: "#fff",
  background: "#2864ea",
  padding: "0 13px",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
});
export const secondaryAction = style({
  height: 34,
  border: "1px solid #cbd8e9",
  borderRadius: 6,
  color: "#365276",
  background: "#fff",
  padding: "0 12px",
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
});
export const demandBand = style({ display: "grid", gap: 7 });
export const demandHeading = style({ color: "#57667d", fontSize: 11, fontWeight: 900 });
export const demands = style({ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 });
export const demand = style({
  flex: "0 0 220px",
  minWidth: 0,
  border: "1px solid #f0c992",
  borderRadius: 7,
  color: "#62451d",
  background: "#fff9ef",
  padding: "9px 10px",
  cursor: "pointer",
  textAlign: "left",
});
export const demandTitle = style({
  display: "block",
  overflow: "hidden",
  fontSize: 11,
  fontWeight: 900,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
export const demandMeta = style({
  display: "block",
  marginTop: 3,
  color: "#8a6a3f",
  fontSize: 9,
  fontWeight: 700,
});
export const planBoard = style({
  overflow: "hidden",
  border: "1px solid #dce4ef",
  borderRadius: 7,
  background: "#fff",
});
export const planHeader = style({
  display: "grid",
  gridTemplateColumns: "220px 1fr",
  minHeight: 44,
  borderBottom: "1px solid #dce4ef",
  background: "#f7f9fc",
});
export const planMemberHead = style({
  display: "flex",
  alignItems: "center",
  borderRight: "1px solid #dce4ef",
  padding: "0 12px",
  color: "#5f6e84",
  fontSize: 11,
  fontWeight: 900,
});
export const planWeeks = style({
  display: "grid",
  gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
});
export const planWeek = style({
  display: "flex",
  alignItems: "center",
  borderRight: "1px solid #e3e9f2",
  padding: "0 8px",
  color: "#5f6e84",
  fontSize: 10,
  fontWeight: 900,
});
export const planRow = style({
  display: "grid",
  gridTemplateColumns: "220px 1fr",
  minHeight: 58,
  borderBottom: "1px solid #e4eaf2",
});
export const planMember = style({
  display: "flex",
  alignItems: "center",
  gap: 9,
  borderRight: "1px solid #dce4ef",
  padding: "8px 11px",
});
export const planTrack = style({
  position: "relative",
  minWidth: 0,
  background:
    "repeating-linear-gradient(90deg, transparent 0, transparent calc(16.666% - 1px), #e7ecf3 calc(16.666% - 1px), #e7ecf3 16.666%)",
});
export const assignmentBar = style({
  position: "absolute",
  top: 10,
  height: 36,
  overflow: "hidden",
  border: "1px solid color-mix(in srgb, var(--assignment-color) 70%, #1d2b42)",
  borderRadius: 5,
  color: "#20324e",
  background: "color-mix(in srgb, var(--assignment-color) 32%, #fff)",
  padding: "4px 7px",
  cursor: "pointer",
  textAlign: "left",
});
export const assignmentDraft = style({ borderStyle: "dashed", opacity: 0.8 });
export const assignmentName = style({
  display: "block",
  overflow: "hidden",
  fontSize: 10,
  fontWeight: 900,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
export const assignmentMeta = style({
  display: "block",
  marginTop: 2,
  fontSize: 8,
  fontWeight: 800,
  whiteSpace: "nowrap",
});
export const overlay = style({
  position: "fixed",
  inset: 0,
  zIndex: 30,
  background: "rgba(18, 29, 47, 0.2)",
});
export const editor = style({
  position: "fixed",
  top: 76,
  right: 14,
  zIndex: 31,
  display: "grid",
  width: 360,
  maxHeight: "calc(100vh - 92px)",
  gap: 13,
  overflowY: "auto",
  border: "1px solid #d7e0ec",
  borderRadius: 8,
  background: "#fff",
  boxShadow: "0 18px 44px rgba(25, 43, 72, 0.2)",
  padding: 16,
});
export const editorHeader = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
});
export const editorTitle = style({ margin: 0, color: "#1c2a41", fontSize: 16, letterSpacing: 0 });
export const closeButton = style({
  border: 0,
  color: "#66758b",
  background: "transparent",
  fontSize: 20,
  cursor: "pointer",
});
export const field = style({
  display: "grid",
  gap: 5,
  color: "#5d6b80",
  fontSize: 10,
  fontWeight: 900,
});
export const input = style({
  width: "100%",
  height: 36,
  border: "1px solid #d4deeb",
  borderRadius: 6,
  color: "#273850",
  background: "#fff",
  padding: "0 9px",
  fontSize: 12,
  fontWeight: 700,
});
export const dateFields = style({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 });
export const editorActions = style({
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  borderTop: "1px solid #e5eaf1",
  paddingTop: 12,
});
export const deleteAction = style({
  height: 34,
  border: "1px solid #efc3c0",
  borderRadius: 6,
  color: "#c74339",
  background: "#fff",
  padding: "0 11px",
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
});
