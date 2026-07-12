import { globalStyle, style } from "@vanilla-extract/css";

export const root = style({
  inset: 0,
  pointerEvents: "auto",
  position: "fixed",
  zIndex: 200,
});

export const spotlight = style({
  border: "2px solid #2f6fed",
  borderRadius: 6,
  boxShadow: "0 0 0 9999px rgba(12, 25, 45, 0.58), 0 0 0 4px rgba(47, 111, 237, 0.2)",
  pointerEvents: "none",
  position: "fixed",
  transition: "inset 160ms ease, width 160ms ease, height 160ms ease",
  zIndex: 201,
});

export const card = style({
  background: "#ffffff",
  border: "1px solid #d8e2f0",
  borderRadius: 8,
  boxShadow: "0 18px 46px rgba(17, 35, 62, 0.24)",
  color: "#17243a",
  maxWidth: "calc(100vw - 24px)",
  padding: 18,
  pointerEvents: "auto",
  position: "fixed",
  width: 360,
  zIndex: 202,
  selectors: {
    "&:focus": { outline: "none" },
  },
  "@media": {
    "screen and (max-width: 640px)": {
      bottom: "12px !important",
      left: "12px !important",
      right: "12px !important",
      top: "auto !important",
      width: "auto",
    },
  },
});

export const header = style({
  alignItems: "flex-start",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
});

export const eyebrow = style({
  color: "#2f6fed",
  display: "block",
  fontSize: 11,
  fontWeight: 800,
  marginBottom: 5,
});

export const title = style({
  fontSize: 17,
  lineHeight: 1.4,
  margin: 0,
});

export const closeButton = style({
  alignItems: "center",
  background: "transparent",
  border: 0,
  color: "#607089",
  cursor: "pointer",
  display: "inline-flex",
  height: 28,
  justifyContent: "center",
  padding: 4,
  width: 28,
  selectors: {
    "&:hover": { background: "#f0f4fa", color: "#17243a" },
  },
});

globalStyle(`${closeButton} svg`, {
  height: 18,
  width: 18,
});

export const body = style({
  color: "#52627a",
  fontSize: 13,
  lineHeight: 1.75,
  margin: "12px 0 16px",
});

export const missing = style({
  background: "#fff7e6",
  border: "1px solid #f3d495",
  borderRadius: 6,
  color: "#795417",
  fontSize: 12,
  marginBottom: 14,
  padding: "8px 10px",
});

export const progress = style({
  display: "grid",
  gap: 5,
  gridTemplateColumns: "repeat(var(--tour-step-count), minmax(0, 1fr))",
  marginBottom: 16,
});

export const progressItem = style({
  background: "#dfe7f2",
  borderRadius: 2,
  height: 4,
});

export const progressItemActive = style({
  background: "#2f6fed",
});

export const footer = style({
  alignItems: "center",
  display: "flex",
  gap: 8,
  justifyContent: "space-between",
});

export const stepCount = style({
  color: "#708096",
  fontSize: 11,
  fontWeight: 700,
});

export const actions = style({
  display: "flex",
  gap: 8,
});

export const secondaryButton = style({
  background: "#ffffff",
  border: "1px solid #d2dceb",
  borderRadius: 6,
  color: "#40526b",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 700,
  minHeight: 34,
  padding: "7px 12px",
  selectors: {
    "&:hover": { background: "#f5f8fc" },
    "&:disabled": { cursor: "default", opacity: 0.45 },
  },
});

export const primaryButton = style({
  background: "#2f6fed",
  border: "1px solid #2f6fed",
  borderRadius: 6,
  color: "#ffffff",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 800,
  minHeight: 34,
  padding: "7px 14px",
  selectors: {
    "&:hover": { background: "#245dcc" },
  },
});
