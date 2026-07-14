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
  fontWeight: 600,
});
export const pageActions = style({ display: "flex", alignItems: "center", gap: 10 });
export const viewSwitch = style({
  display: "inline-flex",
  height: 34,
  alignItems: "center",
  border: "1px solid #cbd8e9",
  borderRadius: 6,
  overflow: "hidden",
  background: "#fff",
});
export const viewSwitchActive = style({
  color: "#174dbd !important",
  background: "#edf4ff !important",
});
export const layout = style({
  display: "grid",
  gridTemplateColumns: "190px minmax(0, 1fr)",
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
export const listHeading = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "2px 8px 7px",
  color: "#5b6a80",
  fontSize: 10,
});
export const reportListItem = style({
  display: "grid",
  gap: 5,
  border: "1px solid transparent",
  borderRadius: 6,
  color: "#33435b",
  background: "transparent",
  padding: "10px 11px",
  cursor: "pointer",
  textAlign: "left",
  selectors: { "&:hover": { background: "#f4f7fb" } },
});
export const reportListItemActive = style({ borderColor: "#a9c1f5", background: "#eef4ff" });
export const reportDate = style({ color: "#65758c", fontSize: 10, fontWeight: 700 });
export const reportMeta = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  color: "#74839a",
});
export const empty = style({ color: "#8591a3", fontSize: 10, fontWeight: 600, padding: 8 });
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
  fontWeight: 750,
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
  fontWeight: 700,
  cursor: "pointer",
  selectors: { "&:disabled": { cursor: "default", opacity: 0.45 } },
});
export const buttonIcon = style({ width: 15, height: 15 });
export const editor = style({ minWidth: 0, padding: "12px 0 0 14px" });
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
  fontWeight: 700,
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
  fontWeight: 600,
});
export const submitted = style({
  borderRadius: 999,
  color: "#087249",
  background: "#e7f7f0",
  padding: "5px 8px",
  fontSize: 9,
  fontWeight: 750,
});
export const draft = style({
  borderRadius: 999,
  color: "#795a16",
  background: "#fff5d8",
  padding: "5px 8px",
  fontSize: 9,
  fontWeight: 750,
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
  gridTemplateColumns: "minmax(0, 1fr) 260px",
  gap: 16,
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
  gap: 8,
  color: "#53627a",
  fontSize: 10,
  fontWeight: 750,
});
export const markdownHeader = style({
  display: "flex",
  minHeight: 28,
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
});
export const modeSwitch = style({
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid #d6dfeb",
  borderRadius: 5,
  overflow: "hidden",
  background: "#fff",
});
export const modeActive = style({ color: "#174dbd !important", background: "#edf4ff !important" });
export const preview = style({
  minHeight: 112,
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
  gridTemplateColumns: "1fr 1.25fr 82px 72px 32px",
  gap: 6,
  alignItems: "center",
  border: "1px solid #e0e6ef",
  borderRadius: 6,
  background: "#fbfcfe",
  padding: 8,
  "@media": {
    "screen and (max-width: 1100px)": {
      gridTemplateColumns: "minmax(0, 1fr) 82px 72px 32px",
    },
  },
});
export const entryLabels = style({
  display: "grid",
  gridTemplateColumns: "1fr 1.25fr 82px 72px 32px",
  gap: 6,
  padding: "0 1px",
  color: "#74839a",
  fontSize: 9,
  fontWeight: 700,
  "@media": { "screen and (max-width: 1100px)": { display: "none" } },
});
export const hoursInput = style({
  width: "100%",
  height: 34,
  border: "1px solid #d4deeb",
  borderRadius: 6,
  padding: "0 8px",
  fontSize: 11,
  fontWeight: 700,
});
export const progressInput = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 18px",
  height: 34,
  alignItems: "center",
  overflow: "hidden",
  border: "1px solid #d4deeb",
  borderRadius: 6,
  background: "#fff",
  color: "#617089",
  fontSize: 10,
  fontWeight: 700,
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
export const entryDelete = style({
  gridColumn: 5,
  gridRow: 1,
  "@media": { "screen and (max-width: 1100px)": { gridColumn: 4, gridRow: 3 } },
});
export const twoColumns = style({ display: "grid", gridTemplateColumns: "1fr", gap: 12 });
export const actualSummary = style({
  display: "grid",
  gap: 7,
  borderBottom: "1px solid #e1e7ef",
  paddingBottom: 12,
  color: "#40516a",
  fontSize: 10,
});
export const actualWarning = style({ color: "#b75b18", fontSize: 9, fontWeight: 700 });
export const actualHint = style({ color: "#65758c", fontSize: 9, lineHeight: 1.5 });
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
  fontWeight: 700,
});
export const dialogOverlay = style({
  position: "fixed",
  inset: 0,
  zIndex: 100,
  display: "grid",
  placeItems: "center",
  background: "rgba(20, 31, 49, 0.38)",
  padding: 20,
});
export const deleteDialog = style({
  display: "grid",
  width: "min(430px, 100%)",
  overflow: "hidden",
  border: "1px solid #d7e0ec",
  borderRadius: 7,
  background: "#fff",
  boxShadow: "0 20px 55px rgba(20, 34, 55, 0.22)",
});
export const deleteConfirmButton = style({
  color: "#fff !important",
  borderColor: "#d64747 !important",
  background: "#d64747 !important",
});

globalStyle(`${iconButton} > svg`, { width: 15, height: 15 });
globalStyle(`${viewSwitch} > button`, {
  height: "100%",
  border: 0,
  borderRight: "1px solid #dbe3ee",
  color: "#5f6f86",
  background: "transparent",
  padding: "0 12px",
  fontSize: 10,
  fontWeight: 700,
  cursor: "pointer",
});
globalStyle(`${viewSwitch} > button:last-child`, { borderRight: 0 });
globalStyle(`${markdownField} > textarea`, {
  minHeight: 112,
  resize: "vertical",
  border: "1px solid #d5deea",
  borderRadius: 6,
  padding: 10,
  color: "#263750",
  fontFamily: "inherit",
  fontSize: 11,
  lineHeight: 1.6,
});
globalStyle(`${modeSwitch} > button`, {
  display: "inline-flex",
  height: 25,
  alignItems: "center",
  gap: 4,
  border: 0,
  color: "#66758b",
  background: "transparent",
  padding: "0 8px",
  fontSize: 9,
  fontWeight: 700,
  cursor: "pointer",
});
globalStyle(`${modeSwitch} svg`, { width: 12, height: 12 });
globalStyle(`${sectionHeader} > div`, {
  display: "flex",
  alignItems: "baseline",
  gap: 8,
  color: "#34465f",
  fontSize: 11,
});
globalStyle(`${sectionHeader} span`, { color: "#728097", fontSize: 10, fontWeight: 700 });
globalStyle(`${progressInput} > input`, {
  width: "100%",
  height: "100%",
  border: 0,
  outline: 0,
  padding: "0 2px 0 8px",
  fontSize: 11,
  fontWeight: 700,
});
globalStyle(`${entry} > select:nth-child(1)`, {
  "@media": { "screen and (max-width: 1100px)": { gridColumn: "1 / -1", gridRow: 1 } },
});
globalStyle(`${entry} > select:nth-child(2)`, {
  "@media": { "screen and (max-width: 1100px)": { gridColumn: "1 / -1", gridRow: 2 } },
});
globalStyle(`${entry} > ${progressInput}`, {
  "@media": { "screen and (max-width: 1100px)": { gridColumn: 1, gridRow: 3 } },
});
globalStyle(`${entry} > ${hoursInput}`, {
  "@media": { "screen and (max-width: 1100px)": { gridColumn: 2, gridRow: 3 } },
});
globalStyle(`${entry} > ${summaryInput}`, {
  "@media": { "screen and (max-width: 1100px)": { gridColumn: "1 / -1", gridRow: 4 } },
});
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
globalStyle(`${deleteDialog} > header`, {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  borderBottom: "1px solid #e4e9f0",
  padding: "14px 16px",
});
globalStyle(`${deleteDialog} > header > div`, { display: "grid", gap: 3 });
globalStyle(`${deleteDialog} > header strong`, { color: "#24334c", fontSize: 13 });
globalStyle(`${deleteDialog} > header span`, { color: "#7a8799", fontSize: 9, fontWeight: 600 });
globalStyle(`${deleteDialog} > header button`, {
  display: "grid",
  width: 28,
  height: 28,
  placeItems: "center",
  border: 0,
  color: "#66758b",
  background: "transparent",
  cursor: "pointer",
});
globalStyle(`${deleteDialog} > header svg`, { width: 16, height: 16 });
globalStyle(`${deleteDialog} > section`, {
  display: "grid",
  gridTemplateColumns: "28px minmax(0, 1fr)",
  gap: 10,
  margin: 14,
  border: "1px solid #f0c7c7",
  borderRadius: 6,
  color: "#8f3030",
  background: "#fff7f7",
  padding: 12,
});
globalStyle(`${deleteDialog} > section > svg`, { width: 20, height: 20 });
globalStyle(`${deleteDialog} > section strong`, { fontSize: 10 });
globalStyle(`${deleteDialog} > section p`, { margin: "4px 0 0", color: "#765b5b", fontSize: 9 });
globalStyle(`${deleteDialog} > footer`, {
  display: "flex",
  justifyContent: "flex-end",
  gap: 7,
  borderTop: "1px solid #e4e9f0",
  padding: "11px 14px",
});
globalStyle(`${deleteDialog} > footer button`, {
  height: 32,
  border: "1px solid #ccd7e5",
  borderRadius: 6,
  color: "#4d5e76",
  background: "#fff",
  padding: "0 12px",
  fontSize: 9,
  fontWeight: 750,
  cursor: "pointer",
});
