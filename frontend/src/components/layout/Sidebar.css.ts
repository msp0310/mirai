import { globalStyle, style } from "@vanilla-extract/css";

export const sidebar = style({
  position: "sticky",
  top: 0,
  zIndex: 40,
  display: "flex",
  height: "100vh",
  flexDirection: "column",
  alignItems: "center",
  gap: 18,
  padding: "16px 8px",
  color: "#dbe8ff",
  background: "linear-gradient(180deg, #0f2b4a 0%, #0a1d33 100%)",
  "@media": {
    "(max-width: 760px)": {
      position: "static",
      width: "100%",
      minWidth: 0,
      maxWidth: "100vw",
      height: "auto",
      flexDirection: "row",
      overflowX: "auto",
    },
  },
});

export const navStack = style({
  display: "flex",
  width: "100%",
  flex: 1,
  flexDirection: "column",
  gap: 10,
  overflowY: "visible",
  scrollbarWidth: "none",
  "@media": {
    "(max-width: 760px)": {
      maxWidth: "100%",
      minWidth: 0,
      flex: "1 1 auto",
      flexDirection: "row",
      contain: "paint",
      overflowX: "auto",
      scrollbarWidth: "none",
    },
  },
});

globalStyle(`${navStack}::-webkit-scrollbar`, {
  display: "none",
});

export const navGroup = style({
  display: "grid",
  gap: 5,
  "@media": {
    "(max-width: 760px)": {
      display: "flex",
      flex: "0 0 auto",
      alignItems: "stretch",
    },
  },
});

globalStyle(`${navGroup} + ${navGroup}`, {
  borderTop: "1px solid rgba(219, 232, 255, 0.18)",
  paddingTop: 10,
});

globalStyle(`${navGroup} + ${navGroup}`, {
  "@media": {
    "(max-width: 760px)": {
      borderTop: 0,
      borderLeft: "1px solid rgba(219, 232, 255, 0.18)",
      paddingTop: 0,
      paddingLeft: 8,
    },
  },
});

export const navGroupLabel = style({
  display: "block",
  paddingInline: 2,
  color: "rgba(219, 232, 255, 0.68)",
  fontSize: 8,
  fontWeight: 850,
  letterSpacing: 0,
  lineHeight: 1,
  textAlign: "center",
  "@media": {
    "(max-width: 760px)": {
      display: "none",
    },
  },
});

export const navItem = style({
  display: "grid",
  minHeight: 50,
  placeItems: "center",
  gap: 4,
  border: 0,
  borderRadius: 8,
  color: "inherit",
  background: "transparent",
  opacity: 0.84,
  padding: "5px 3px",
  "@media": {
    "(max-width: 760px)": {
      flex: "0 0 64px",
    },
  },
});

export const navItemActive = style({
  color: "#fff",
  background: "rgba(66, 126, 245, 0.28)",
  opacity: 1,
});

export const navItemWithChildren = style({
  position: "relative",
  "@media": {
    "(max-width: 760px)": {
      flex: "0 0 64px",
    },
  },
});

export const navSubmenu = style({
  position: "absolute",
  top: 0,
  left: "calc(100% + 8px)",
  zIndex: 30,
  display: "grid",
  gap: 2,
  minWidth: 160,
  border: "1px solid #dfe6ef",
  borderRadius: 8,
  background: "#fff",
  boxShadow: "0 12px 28px rgba(24, 45, 78, 0.18)",
  padding: 6,
  "@media": {
    "(max-width: 760px)": {
      top: "calc(100% + 6px)",
      left: 0,
      minWidth: 148,
    },
  },
});

export const navSubItem = style({
  minHeight: 32,
  border: "1px solid transparent",
  borderRadius: 6,
  color: "#25334a",
  background: "#fff",
  padding: "7px 9px",
  textAlign: "left",
  "@media": {
    "(max-width: 760px)": {
      minHeight: 50,
      padding: "7px 9px",
    },
  },
});

export const navSubItemActive = style({
  borderColor: "#bad1ff",
  color: "#1649bf",
  background: "#edf4ff",
});

globalStyle(`${navItem} svg`, {
  width: 19,
  height: 19,
});

globalStyle(`${navItem} span`, {
  maxWidth: "100%",
  color: "inherit",
  fontSize: 8,
  fontWeight: 750,
  lineHeight: 1.15,
  overflowWrap: "anywhere",
  textAlign: "center",
});

globalStyle(`${navSubItem} span`, {
  display: "block",
  fontSize: 11,
  fontWeight: 800,
  lineHeight: 1.2,
  overflowWrap: "anywhere",
  textAlign: "left",
});

export const helpButton = style({
  width: 32,
  height: 32,
  flex: "0 0 auto",
  border: "1px solid rgba(255, 255, 255, 0.24)",
  borderRadius: "50%",
  color: "inherit",
  background: "transparent",
  fontWeight: 800,
});

export const helpButtonActive = style({
  color: "#fff",
  borderColor: "rgba(103, 155, 255, 0.92)",
  background: "rgba(66, 126, 245, 0.34)",
});

globalStyle(`${helpButton} svg`, {
  width: 17,
  height: 17,
});
