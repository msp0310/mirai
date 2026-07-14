import { globalStyle, style } from "@vanilla-extract/css";

export const panel = style({
  display: "grid",
  gap: 10,
  borderTop: "1px solid #edf1f6",
  paddingTop: 14,
});

export const heading = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  color: "#172033",
  fontSize: 13,
  fontWeight: 750,
});

export const headingLabel = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
});

export const headingIcon = style({
  width: 17,
  height: 17,
  color: "#2864ea",
});

export const count = style({
  color: "#718096",
  fontSize: 11,
  fontWeight: 700,
});

export const dropzone = style({
  display: "grid",
  minHeight: 66,
  placeItems: "center",
  border: "1px dashed #b9cbea",
  borderRadius: 8,
  color: "#52627a",
  background: "#f8fbff",
  padding: "12px 16px",
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 700,
  textAlign: "center",
  transition: "border-color 120ms ease, background 120ms ease",
});

export const dropzoneActive = style({
  borderColor: "#2864ea",
  color: "#1649bf",
  background: "#eef4ff",
});

export const dropzoneDisabled = style({
  cursor: "not-allowed",
  opacity: 0.55,
});

export const dropzoneIcon = style({
  width: 18,
  height: 18,
  marginBottom: 4,
  color: "#2864ea",
});

export const error = style({
  margin: 0,
  border: "1px solid #f2b9ad",
  borderRadius: 6,
  color: "#a83718",
  background: "#fff4f1",
  padding: "7px 9px",
  fontSize: 11,
  fontWeight: 650,
});

export const list = style({
  display: "grid",
  gap: 6,
  margin: 0,
  padding: 0,
  listStyle: "none",
});

export const item = style({
  display: "grid",
  gridTemplateColumns: "24px minmax(0, 1fr) auto",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
  border: "1px solid #e2e8f1",
  borderRadius: 7,
  background: "#fff",
  padding: "7px 8px",
});

export const fileIcon = style({
  display: "grid",
  width: 24,
  height: 24,
  placeItems: "center",
  borderRadius: 5,
  color: "#2864ea",
  background: "#edf4ff",
});

globalStyle(`${fileIcon} svg`, {
  width: 15,
  height: 15,
});

export const fileInfo = style({
  display: "grid",
  minWidth: 0,
  gap: 2,
});

export const fileName = style({
  overflow: "hidden",
  color: "#263750",
  fontSize: 11,
  fontWeight: 750,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const fileMeta = style({
  overflow: "hidden",
  color: "#7b8798",
  fontSize: 10,
  fontWeight: 600,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const actions = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
});

export const action = style({
  display: "grid",
  width: 28,
  height: 28,
  placeItems: "center",
  border: "1px solid transparent",
  borderRadius: 5,
  color: "#63728a",
  background: "transparent",
  padding: 0,
  cursor: "pointer",
});

globalStyle(`${action}:hover, ${action}:focus-visible`, {
  borderColor: "#c8d8f4",
  color: "#1649bf",
  background: "#f1f6ff",
  outline: 0,
});

export const dangerAction = style({
  color: "#c4473e",
});

export const empty = style({
  margin: 0,
  color: "#7b8798",
  fontSize: 11,
  fontWeight: 600,
});
