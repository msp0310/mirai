import { globalStyle, style } from "@vanilla-extract/css";

export const page = style({ display: "grid", gap: 14, padding: "18px 20px 28px" });
export const pageHeader = style({
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 16,
});
export const heading = style({ margin: 0, color: "#172238", fontSize: 22, letterSpacing: 0 });
export const description = style({
  display: "block",
  marginTop: 4,
  color: "#69778d",
  fontSize: 12,
  fontWeight: 700,
});
export const layout = style({
  display: "grid",
  gridTemplateColumns: "230px minmax(0, 1fr)",
  minHeight: "calc(100vh - 150px)",
  borderTop: "1px solid #dce4ef",
});
export const reportList = style({
  display: "grid",
  alignContent: "start",
  gap: 5,
  borderRight: "1px solid #dce4ef",
  padding: "12px 10px 12px 0",
});
export const reportListItem = style({
  display: "grid",
  gap: 3,
  border: "1px solid transparent",
  borderRadius: 6,
  color: "#33435b",
  background: "transparent",
  padding: "9px 10px",
  cursor: "pointer",
  textAlign: "left",
});
export const reportListItemActive = style({ borderColor: "#a9c1f5", background: "#eef4ff" });
export const empty = style({ color: "#8591a3", fontSize: 10, fontWeight: 700, padding: 8 });
export const welcome = style({
  display: "grid",
  placeContent: "center",
  gap: 6,
  color: "#68778e",
  textAlign: "center",
});
export const primaryButton = style({
  display: "inline-flex",
  height: 34,
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  border: 0,
  borderRadius: 6,
  color: "#fff",
  background: "#2864ea",
  padding: "0 13px",
  fontSize: 11,
  fontWeight: 900,
  cursor: "pointer",
  selectors: { "&:disabled": { cursor: "default", opacity: 0.45 } },
});
export const secondaryButton = style({
  display: "inline-flex",
  height: 32,
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
  border: "1px solid #cbd8e9",
  borderRadius: 6,
  color: "#365276",
  background: "#fff",
  padding: "0 11px",
  fontSize: 10,
  fontWeight: 800,
  cursor: "pointer",
  selectors: { "&:disabled": { cursor: "default", opacity: 0.45 } },
});
export const buttonIcon = style({ width: 15, height: 15 });
export const editor = style({ minWidth: 0, padding: "12px 0 0 16px" });
export const editorHeader = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  borderBottom: "1px solid #e1e7ef",
  paddingBottom: 11,
});
export const headerFields = style({ display: "flex", alignItems: "center", gap: 8 });
export const editorActions = style({ display: "flex", alignItems: "center", gap: 7 });
export const dateInput = style({
  height: 34,
  border: "1px solid #d4deeb",
  borderRadius: 6,
  padding: "0 9px",
  fontSize: 11,
  fontWeight: 800,
});
export const select = style({
  minWidth: 0,
  height: 34,
  border: "1px solid #d4deeb",
  borderRadius: 6,
  color: "#31415a",
  background: "#fff",
  padding: "0 8px",
  fontSize: 10,
  fontWeight: 700,
});
export const submitted = style({
  borderRadius: 999,
  color: "#087249",
  background: "#e7f7f0",
  padding: "5px 8px",
  fontSize: 9,
  fontWeight: 900,
});
export const draft = style({
  borderRadius: 999,
  color: "#795a16",
  background: "#fff5d8",
  padding: "5px 8px",
  fontSize: 9,
  fontWeight: 900,
});
export const iconButton = style({
  display: "grid",
  width: 32,
  height: 32,
  placeItems: "center",
  border: "1px solid #d7e0ec",
  borderRadius: 6,
  color: "#66758b",
  background: "#fff",
  cursor: "pointer",
});
export const editorBody = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 290px",
  gap: 18,
  paddingTop: 14,
});
export const editorMain = style({ display: "grid", minWidth: 0, gap: 15 });
export const editorSide = style({
  display: "grid",
  alignContent: "start",
  gap: 14,
  borderLeft: "1px solid #e2e8f0",
  paddingLeft: 14,
});
export const markdownField = style({
  display: "grid",
  minWidth: 0,
  gridTemplateColumns: "1fr 1fr",
  gap: 7,
  color: "#53627a",
  fontSize: 10,
  fontWeight: 900,
});
export const preview = style({
  minHeight: 126,
  overflow: "auto",
  border: "1px solid #e0e6ef",
  borderRadius: 6,
  background: "#f9fbfd",
  padding: 10,
});
export const entrySection = style({
  display: "grid",
  gap: 8,
  borderTop: "1px solid #e1e7ef",
  borderBottom: "1px solid #e1e7ef",
  padding: "12px 0",
});
export const sectionHeader = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
});
export const entry = style({
  display: "grid",
  gridTemplateColumns: "1.3fr 1.3fr 70px 92px 32px",
  gap: 6,
  alignItems: "center",
});
export const hoursInput = style({
  width: "100%",
  height: 34,
  border: "1px solid #d4deeb",
  borderRadius: 6,
  padding: "0 8px",
  fontSize: 11,
  fontWeight: 800,
});
export const summaryInput = style({
  gridColumn: "1 / -1",
  width: "100%",
  height: 34,
  border: "1px solid #d4deeb",
  borderRadius: 6,
  padding: "0 8px",
  fontSize: 11,
});
export const entryDelete = style({ gridColumn: 5, gridRow: 1 });
export const twoColumns = style({ display: "grid", gridTemplateColumns: "1fr", gap: 12 });
export const actualSummary = style({
  display: "grid",
  gap: 7,
  borderBottom: "1px solid #e1e7ef",
  paddingBottom: 12,
  color: "#40516a",
  fontSize: 10,
});
export const comments = style({ display: "grid", gap: 8 });
export const comment = style({
  display: "grid",
  gap: 6,
  borderBottom: "1px solid #e6ebf2",
  paddingBottom: 9,
});
export const commentInput = style({
  minHeight: 84,
  resize: "vertical",
  border: "1px solid #d5deea",
  borderRadius: 6,
  padding: 9,
  fontFamily: "inherit",
  fontSize: 11,
});
export const message = style({
  position: "fixed",
  right: 18,
  bottom: 18,
  zIndex: 10,
  border: "1px solid #d6e0ed",
  borderRadius: 7,
  background: "#fff",
  boxShadow: "0 10px 30px rgba(29, 45, 70, 0.14)",
  padding: "10px 13px",
  color: "#40516a",
  fontSize: 10,
  fontWeight: 800,
});

globalStyle(`${iconButton} > svg`, { width: 15, height: 15 });
globalStyle(`${markdownField} > strong`, { gridColumn: "1 / -1" });
globalStyle(`${markdownField} > textarea`, {
  minHeight: 126,
  resize: "vertical",
  border: "1px solid #d5deea",
  borderRadius: 6,
  padding: 10,
  color: "#263750",
  fontFamily: "inherit",
  fontSize: 11,
  lineHeight: 1.6,
});
globalStyle(`${sectionHeader} > div`, {
  display: "flex",
  alignItems: "baseline",
  gap: 8,
  color: "#34465f",
  fontSize: 11,
});
globalStyle(`${sectionHeader} span`, { color: "#728097", fontSize: 10, fontWeight: 800 });
globalStyle(`${actualSummary} > div`, { display: "flex", justifyContent: "space-between", gap: 8 });
globalStyle(`${actualSummary} b`, { color: "#174dbd" });
globalStyle(`${comments} > h3`, { margin: 0, color: "#34465f", fontSize: 12, letterSpacing: 0 });
globalStyle(`${comment} > header`, {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  color: "#40516a",
  fontSize: 9,
});
globalStyle(`${comment} time`, { color: "#8a96a8" });
