import { style, styleVariants } from "@vanilla-extract/css";

export const viewport = style({
  bottom: 22,
  display: "grid",
  gap: 10,
  pointerEvents: "none",
  position: "fixed",
  right: 22,
  width: "min(360px, calc(100vw - 32px))",
  zIndex: 32,
});

export const message = style({
  alignItems: "start",
  background: "rgba(255, 255, 255, 0.96)",
  border: "1px solid rgba(211, 220, 233, 0.92)",
  borderRadius: 8,
  boxShadow: "0 18px 42px rgba(23, 32, 51, 0.18)",
  display: "grid",
  gap: 10,
  gridTemplateColumns: "22px minmax(0, 1fr) 28px",
  padding: 12,
  pointerEvents: "auto",
});

export const icon = style({
  height: 22,
  width: 22,
});

export const iconByTone = styleVariants({
  info: { color: "#2864ea" },
  success: { color: "#159154" },
  warning: { color: "#c46a10" },
});

export const content = style({
  minWidth: 0,
});

export const title = style({
  color: "#172033",
  display: "block",
  fontSize: 13,
  fontWeight: 750,
  lineHeight: 1.3,
});

export const detail = style({
  color: "#647086",
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1.45,
  margin: "3px 0 0",
});

export const dismiss = style({
  alignItems: "center",
  background: "transparent",
  border: 0,
  borderRadius: 7,
  color: "#7a8798",
  cursor: "pointer",
  display: "grid",
  height: 28,
  justifyContent: "center",
  padding: 0,
  selectors: {
    "&:hover": {
      background: "#f1f5fb",
      color: "#172033",
    },
  },
  width: 28,
});

export const dismissIcon = style({
  height: 16,
  width: 16,
});
