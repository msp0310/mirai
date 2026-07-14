import { globalStyle, style } from "@vanilla-extract/css";

export const tourPanel = style({
  alignItems: "center",
  background: "#f7f9fc",
  borderBottom: "1px solid #dce4ef",
  display: "grid",
  gap: 16,
  gridTemplateColumns: "minmax(180px, 0.55fr) minmax(0, 1.45fr)",
  padding: "14px 18px",
  "@media": {
    "screen and (max-width: 900px)": {
      gridTemplateColumns: "1fr",
    },
  },
});

export const tourHeading = style({
  display: "grid",
  gap: 3,
});

globalStyle(`${tourHeading} span`, {
  color: "#63748b",
  fontSize: 11,
  fontWeight: 600,
});

globalStyle(`${tourHeading} strong`, {
  color: "#17243a",
  fontSize: 14,
});

export const tourList = style({
  display: "grid",
  gap: 8,
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
});

export const tourButton = style({
  alignItems: "center",
  background: "#ffffff",
  border: "1px solid #d4deeb",
  borderRadius: 6,
  color: "#30435e",
  cursor: "pointer",
  display: "grid",
  fontSize: 12,
  fontWeight: 700,
  gap: 8,
  gridTemplateColumns: "18px 1fr",
  minHeight: 40,
  padding: "8px 10px",
  textAlign: "left",
  selectors: {
    "&:hover": { borderColor: "#79a2f6", color: "#1d5fcf" },
  },
});

globalStyle(`${tourButton} svg`, {
  height: 18,
  width: 18,
});
