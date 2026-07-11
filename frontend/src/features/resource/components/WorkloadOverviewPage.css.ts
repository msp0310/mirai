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

export const timelineControls = style({
  display: "flex",
  alignItems: "center",
  gap: 10,
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

export const timelineEntityHead = style({
  gridRow: "span 2",
});

export const monthHead = style({
  minHeight: 28,
  borderBottom: "1px solid #d6dfeb",
  padding: "7px 8px",
  textAlign: "center",
});

export const weekHead = style({
  minHeight: 28,
  padding: "7px 6px",
  textAlign: "center",
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
export const decisionPanel = style({
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  borderTop: "1px solid #dce4ef",
  borderBottom: "1px solid #dce4ef",
  background: "#fff",
});
export const decisionColumn = style({
  minWidth: 0,
  padding: "10px 12px 12px",
  borderRight: "1px solid #e2e8f0",
  selectors: { "&:last-child": { borderRight: 0 } },
});
export const decisionHeader = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 7,
  color: "#40516a",
  fontSize: 11,
});
export const decisionHeaderTitle = style({ fontWeight: 900 });
export const decisionHeaderCount = style({ color: "#6c7a90", fontWeight: 800 });
export const decisionList = style({
  display: "grid",
  gap: 5,
  maxHeight: 148,
  overflowY: "auto",
});
export const decisionAction = style({
  display: "grid",
  minWidth: 0,
  gap: 2,
  border: "1px solid #e0e7f0",
  borderRadius: 5,
  color: "#31435e",
  background: "#f9fbfd",
  padding: "7px 8px",
  cursor: "pointer",
  textAlign: "left",
});
export const decisionItem = style({
  display: "flex",
  minWidth: 0,
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  border: "1px solid #f0d0cb",
  borderRadius: 5,
  color: "#8f342e",
  background: "#fff5f3",
  padding: "7px 8px",
});
export const decisionTitle = style({
  overflow: "hidden",
  fontSize: 10,
  fontWeight: 900,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
export const decisionDetail = style({
  overflow: "hidden",
  color: "#77859a",
  fontSize: 9,
  fontWeight: 700,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
export const decisionValue = style({ flex: "0 0 auto", fontSize: 10, fontWeight: 900 });
export const decisionEmpty = style({
  color: "#8a97a9",
  fontSize: 10,
  fontWeight: 700,
  padding: "8px 2px",
});
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
  overflow: "auto",
  border: "1px solid #dce4ef",
  borderRadius: 7,
  background: "#fff",
});
export const planHeader = style({
  display: "grid",
  gridTemplateColumns: "220px 1fr",
  minHeight: 58,
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
  gridTemplateRows: "29px 29px",
});
export const planMonthRow = style({
  display: "grid",
});
export const planMonth = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRight: "1px solid #d8e1ec",
  borderBottom: "1px solid #d8e1ec",
  color: "#4e5e76",
  fontSize: 10,
  fontWeight: 900,
});
export const planWeekRow = style({
  display: "grid",
});
export const planWeek = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRight: "1px solid #e3e9f2",
  padding: "0 3px",
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
  backgroundImage: "linear-gradient(90deg, transparent calc(100% - 1px), #e7ecf3 0)",
  backgroundRepeat: "repeat-x",
});
export const monthlyAllocationRow = style({
  position: "absolute",
  inset: "0 0 auto",
  zIndex: 1,
  display: "grid",
  height: 28,
  borderBottom: "1px solid #e1e7ef",
  background: "rgba(247, 249, 252, 0.94)",
});
export const monthlyAllocation = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRight: "1px solid #dfe6ef",
  fontSize: 9,
  fontWeight: 900,
});
export const monthlyAllocationOver = style({ color: "#b7352c", background: "#fff0ee" });
export const monthlyAllocationFull = style({ color: "#9a5a00", background: "#fff7e8" });
export const monthlyAllocationAvailable = style({ color: "#13724e", background: "#edf9f4" });
export const monthlyAllocationEmpty = style({ color: "#9aa6b7", background: "#f7f9fc" });
export const shortageScroll = style({
  overflowX: "auto",
  border: "1px solid #e4d5bc",
  borderRadius: 7,
  background: "#fffdf8",
});
export const shortageTimeline = style({
  display: "grid",
  gridTemplateColumns: "220px 1fr",
  minHeight: 54,
});
export const shortageLabel = style({
  display: "flex",
  alignItems: "center",
  borderRight: "1px solid #e6dcc9",
  padding: "0 12px",
  color: "#6b5638",
  fontSize: 11,
  fontWeight: 900,
});
export const shortageMonths = style({ display: "grid" });
export const shortageMonth = style({
  display: "grid",
  alignContent: "center",
  gap: 2,
  minWidth: 0,
  borderRight: "1px solid #ece3d4",
  padding: "7px 5px",
  color: "#8a7a65",
  background: "#fffdf8",
  textAlign: "center",
});
export const shortageMonthTitle = style({ fontSize: 9, fontWeight: 900 });
export const shortageMonthDetail = style({
  overflow: "hidden",
  fontSize: 9,
  fontWeight: 800,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
export const shortageMonthActive = style({ color: "#9d4c17", background: "#fff3df" });
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
