import { globalStyle, style } from "@vanilla-extract/css";

export const page = style({ display: "grid", gap: 14, padding: "18px 20px 28px" });
export const header = style({
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 18,
});
export const pickers = style({ display: "flex", alignItems: "flex-end", gap: 10 });
export const picker = style({
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "#68778e",
  fontSize: 10,
  fontWeight: 700,
});
export const metrics = style({
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 10,
});
export const metric = style({
  display: "flex",
  minHeight: 82,
  alignItems: "center",
  gap: 12,
  border: "1px solid #dce4ef",
  borderRadius: 7,
  background: "#fff",
  padding: "12px 14px",
});
export const chartGrid = style({ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12 });
export const panel = style({
  display: "grid",
  minHeight: 230,
  gap: 12,
  border: "1px solid #dce4ef",
  borderRadius: 7,
  background: "#fff",
  padding: "13px 14px",
});
export const monthlyChart = style({
  display: "grid",
  height: 165,
  gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
  alignItems: "end",
  gap: 10,
});
export const categoryList = style({ display: "grid", alignContent: "start", gap: 12 });
export const activityPanel = style({
  display: "grid",
  gap: 8,
  border: "1px solid #dce4ef",
  borderRadius: 7,
  background: "#fff",
  padding: "13px 14px",
});
export const activityList = style({ display: "grid" });
export const historyPanel = style({
  display: "grid",
  gap: 8,
  border: "1px solid #dce4ef",
  borderRadius: 7,
  background: "#fff",
  padding: "13px 14px",
});
export const tableWrap = style({ overflow: "auto" });

globalStyle(`${header} > div`, { display: "grid", gap: 3 });
globalStyle(`${header} > div > span`, { color: "#60718a", fontSize: 10, fontWeight: 700 });
globalStyle(`${header} h2`, { margin: 0, color: "#172238", fontSize: 22, letterSpacing: 0 });
globalStyle(`${header} p`, { margin: 0, color: "#738198", fontSize: 11, fontWeight: 600 });
globalStyle(`${picker} select`, {
  height: 34,
  minWidth: 130,
  border: "1px solid #ccd8e7",
  borderRadius: 6,
  color: "#33435b",
  background: "#fff",
  padding: "0 9px",
  fontSize: 10,
  fontWeight: 700,
});
globalStyle(`${metric} > span`, {
  display: "grid",
  width: 36,
  height: 36,
  placeItems: "center",
  borderRadius: 6,
  color: "#235bcf",
  background: "#edf4ff",
});
globalStyle(`${metric} svg`, { width: 18, height: 18 });
globalStyle(`${metric} > div`, { display: "grid", gap: 2 });
globalStyle(`${metric} small`, { color: "#718096", fontSize: 9, fontWeight: 700 });
globalStyle(`${metric} strong`, { color: "#1e304a", fontSize: 21, letterSpacing: 0 });
globalStyle(`${panel} > header, ${activityPanel} > header, ${historyPanel} > header`, {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
});
globalStyle(
  `${panel} > header strong, ${activityPanel} > header strong, ${historyPanel} > header strong`,
  { color: "#30425d", fontSize: 11 },
);
globalStyle(
  `${panel} > header span, ${activityPanel} > header span, ${historyPanel} > header span`,
  { color: "#7a8799", fontSize: 9, fontWeight: 700 },
);
globalStyle(`${monthlyChart} > div`, {
  display: "grid",
  height: "100%",
  gridTemplateRows: "18px minmax(0, 1fr) 18px",
  gap: 4,
  alignItems: "end",
  textAlign: "center",
});
globalStyle(`${monthlyChart} > div > span`, { color: "#566780", fontSize: 8, fontWeight: 700 });
globalStyle(`${monthlyChart} > div > div`, {
  position: "relative",
  height: "100%",
  overflow: "hidden",
  borderRadius: 4,
  background: "#f0f3f8",
});
globalStyle(`${monthlyChart} i`, {
  position: "absolute",
  right: 0,
  bottom: 0,
  left: 0,
  borderRadius: "4px 4px 0 0",
  background: "#4d7fe9",
});
globalStyle(`${monthlyChart} small`, { color: "#758399", fontSize: 8, fontWeight: 700 });
globalStyle(`${categoryList} > div`, {
  display: "grid",
  gridTemplateColumns: "80px minmax(0, 1fr) 48px",
  alignItems: "center",
  gap: 8,
});
globalStyle(`${categoryList} > div > span`, { color: "#52637c", fontSize: 9, fontWeight: 700 });
globalStyle(`${categoryList} > div > div`, {
  height: 7,
  overflow: "hidden",
  borderRadius: 4,
  background: "#edf1f6",
});
globalStyle(`${categoryList} i`, {
  display: "block",
  height: "100%",
  borderRadius: 4,
  background: "#20a77a",
});
globalStyle(`${categoryList} b`, { color: "#2a3d59", fontSize: 9, textAlign: "right" });
globalStyle(`${categoryList} p, ${activityList} > p`, { color: "#8591a3", fontSize: 10 });
globalStyle(`${activityList} article`, {
  display: "grid",
  gridTemplateColumns: "54px minmax(0, 1fr) 80px 48px",
  alignItems: "center",
  gap: 10,
  borderTop: "1px solid #e7ebf1",
  padding: "9px 2px",
});
globalStyle(`${activityList} time`, { color: "#728097", fontSize: 9, fontWeight: 700 });
globalStyle(`${activityList} article > div`, { display: "grid", gap: 2, minWidth: 0 });
globalStyle(`${activityList} article > div strong`, {
  overflow: "hidden",
  color: "#2f405a",
  fontSize: 10,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
globalStyle(`${activityList} article > div span`, { color: "#7b899c", fontSize: 8 });
globalStyle(`${activityList} article > small`, { color: "#53657e", fontSize: 8, fontWeight: 700 });
globalStyle(`${activityList} article > b`, { color: "#2057c6", fontSize: 10, textAlign: "right" });
globalStyle(`${tableWrap} table`, {
  width: "100%",
  minWidth: 780,
  borderCollapse: "collapse",
  tableLayout: "fixed",
  fontSize: 9,
});
globalStyle(`${tableWrap} th`, {
  height: 34,
  borderBottom: "1px solid #dce4ef",
  color: "#6c7a90",
  background: "#f7f9fc",
  padding: "0 9px",
  fontSize: 8,
  textAlign: "left",
});
globalStyle(`${tableWrap} td`, {
  height: 46,
  borderBottom: "1px solid #e7ebf1",
  color: "#53627a",
  padding: "7px 9px",
});
globalStyle(`${tableWrap} td strong`, { color: "#2b3d58" });
globalStyle(`${tableWrap} td b`, { color: "#2057c6" });
