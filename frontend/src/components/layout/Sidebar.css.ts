import { globalStyle, style } from "@vanilla-extract/css";

export const navigationShell = style({
  position: "sticky",
  top: 0,
  zIndex: 40,
  display: "flex",
  width: "max-content",
  height: "100vh",
  flex: "0 0 auto",
  "@media": {
    "(max-width: 760px)": {
      position: "static",
      width: "100%",
      height: "auto",
      flexDirection: "column",
    },
  },
});

export const sidebar = style({
  display: "flex",
  width: 56,
  height: "100%",
  flex: "0 0 56px",
  flexDirection: "column",
  alignItems: "center",
  gap: 10,
  boxSizing: "border-box",
  padding: "12px 5px 10px",
  color: "#dbe8ff",
  background: "linear-gradient(180deg, #0f2b4a 0%, #0a1d33 100%)",
  "@media": {
    "(max-width: 760px)": {
      width: "100%",
      height: 60,
      flex: "0 0 auto",
      flexDirection: "row",
      alignItems: "stretch",
      gap: 6,
      overflowX: "auto",
      padding: "6px 8px",
    },
  },
});

export const brandMark = style({
  display: "grid",
  width: 38,
  height: 38,
  flex: "0 0 38px",
  placeItems: "center",
  color: "#173a64",
  "@media": {
    "(max-width: 760px)": {
      width: 42,
      height: 48,
      flexBasis: 42,
    },
  },
});

globalStyle(`${brandMark} img`, {
  display: "block",
  width: 30,
  height: 32,
  objectFit: "contain",
});

export const navStack = style({
  display: "flex",
  width: "100%",
  minHeight: 0,
  flex: 1,
  flexDirection: "column",
  gap: 6,
  overflowY: "visible",
  scrollbarWidth: "none",
  "@media": {
    "(max-width: 760px)": {
      minWidth: 0,
      flex: "1 1 auto",
      flexDirection: "row",
      overflowX: "auto",
      overflowY: "hidden",
    },
  },
});

globalStyle(`${navStack}::-webkit-scrollbar`, {
  display: "none",
});

export const globalFooter = style({
  display: "grid",
  width: "100%",
  gap: 4,
  borderTop: "1px solid rgba(219, 232, 255, 0.16)",
  paddingTop: 8,
  "@media": {
    "(max-width: 760px)": {
      display: "flex",
      width: "auto",
      flex: "0 0 auto",
      borderTop: 0,
      borderLeft: "1px solid rgba(219, 232, 255, 0.16)",
      paddingTop: 0,
      paddingLeft: 6,
    },
  },
});

export const navGroup = style({
  display: "grid",
  width: "100%",
  gap: 4,
  "@media": {
    "(max-width: 760px)": {
      display: "flex",
      width: "auto",
      flex: "0 0 auto",
    },
  },
});

export const navItem = style({
  display: "grid",
  width: "100%",
  minHeight: 56,
  boxSizing: "border-box",
  placeItems: "center",
  gap: 4,
  border: 0,
  borderRadius: 8,
  color: "inherit",
  background: "transparent",
  opacity: 0.84,
  padding: "6px 2px",
  transition: "background 140ms ease, color 140ms ease, opacity 140ms ease",
  ":hover": {
    color: "#fff",
    background: "transparent",
    opacity: 1,
  },
  ":focus-visible": {
    outline: "2px solid #8fb5ff",
    outlineOffset: 1,
  },
  "@media": {
    "(max-width: 760px)": {
      width: 58,
      minHeight: 48,
      flex: "0 0 58px",
      paddingBlock: 4,
    },
  },
});

export const navItemActive = style({
  color: "#fff",
  background: "transparent",
  boxShadow: "none",
  opacity: 1,
});

export const navItemWithChildren = style({
  position: "relative",
  width: "100%",
  "@media": {
    "(max-width: 760px)": {
      width: 58,
      flex: "0 0 58px",
    },
  },
});

export const navSubmenu = style({
  position: "absolute",
  top: 0,
  left: "calc(100% + 8px)",
  zIndex: 50,
  display: "grid",
  minWidth: 164,
  gap: 2,
  border: "1px solid #dfe6ef",
  borderRadius: 8,
  background: "#fff",
  boxShadow: "0 12px 28px rgba(24, 45, 78, 0.18)",
  padding: 6,
  "@media": {
    "(max-width: 760px)": {
      top: "calc(100% + 6px)",
      left: 0,
    },
  },
});

export const navSubItem = style({
  minHeight: 34,
  border: "1px solid transparent",
  borderRadius: 6,
  color: "#25334a",
  background: "#fff",
  padding: "7px 9px",
  textAlign: "left",
});

export const navSubItemActive = style({
  borderColor: "transparent",
  color: "#1450cf",
  background: "#fff",
});

globalStyle(`${navItem} svg`, {
  width: 19,
  height: 19,
  strokeWidth: 1.65,
});

globalStyle(`${navItem} span`, {
  maxWidth: "100%",
  color: "inherit",
  fontSize: 9,
  fontWeight: 650,
  lineHeight: 1.15,
  overflowWrap: "anywhere",
  textAlign: "center",
});

globalStyle(`${navSubItem} span`, {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1.25,
  textAlign: "left",
});

export const helpButton = style({
  display: "grid",
  width: "100%",
  minHeight: 50,
  placeItems: "center",
  gap: 3,
  border: 0,
  borderRadius: 8,
  color: "inherit",
  background: "transparent",
  opacity: 0.84,
  padding: "5px 2px",
  ":hover": {
    color: "#fff",
    background: "transparent",
    opacity: 1,
  },
  "@media": {
    "(max-width: 760px)": {
      width: 54,
      minHeight: 48,
      flex: "0 0 54px",
    },
  },
});

export const helpButtonActive = style({
  color: "#fff",
  background: "transparent",
  opacity: 1,
});

globalStyle(`${helpButton} svg`, {
  width: 19,
  height: 19,
});

globalStyle(`${helpButton} span`, {
  fontSize: 9,
  fontWeight: 650,
  lineHeight: 1.1,
});

export const projectSidebar = style({
  position: "relative",
  display: "flex",
  width: 168,
  height: "100%",
  flex: "0 0 168px",
  flexDirection: "column",
  boxSizing: "border-box",
  overflowX: "hidden",
  overflowY: "auto",
  borderRight: "1px solid #dfe6ef",
  color: "#26364e",
  background: "#fff",
  transition: "width 160ms ease, flex-basis 160ms ease",
  scrollbarWidth: "thin",
  "@media": {
    "(max-width: 760px)": {
      width: "100%",
      height: "auto",
      maxHeight: 214,
      flexBasis: "auto",
      borderRight: 0,
      borderBottom: "1px solid #dfe6ef",
    },
  },
});

export const projectSidebarCollapsed = style({
  width: 0,
  flexBasis: 0,
  borderRight: 0,
  overflow: "hidden",
  "@media": {
    "(max-width: 760px)": {
      width: "100%",
      height: 0,
      maxHeight: 0,
      flexBasis: 0,
      borderBottom: 0,
    },
  },
});

export const projectHeader = style({
  position: "relative",
  display: "grid",
  width: 168,
  minHeight: 102,
  boxSizing: "border-box",
  alignContent: "center",
  gap: 8,
  borderBottom: "1px solid #e7ecf3",
  padding: "16px 28px 14px 14px",
  "@media": {
    "(max-width: 760px)": {
      width: "100%",
      minHeight: 68,
      paddingBlock: 10,
    },
  },
});

globalStyle(`${projectHeader} > strong`, {
  display: "-webkit-box",
  overflow: "hidden",
  color: "#17233a",
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.45,
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
});

export const projectMeta = style({
  display: "flex",
  minWidth: 0,
  alignItems: "center",
  gap: 6,
});

globalStyle(`${projectMeta} > span`, {
  overflow: "hidden",
  minWidth: 0,
  color: "#6b7890",
  fontSize: 10,
  fontWeight: 600,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

globalStyle(`${projectMeta} > em`, {
  flex: "0 0 auto",
  borderRadius: 999,
  color: "#167448",
  background: "#e7f8ef",
  padding: "3px 6px",
  fontSize: 9,
  fontStyle: "normal",
  fontWeight: 650,
  lineHeight: 1,
});

export const projectSidebarToggle = style({
  position: "absolute",
  top: 12,
  right: 6,
  display: "grid",
  width: 24,
  height: 24,
  placeItems: "center",
  border: 0,
  borderRadius: 6,
  color: "#6b7890",
  background: "transparent",
  ":hover": {
    color: "#174bbf",
    background: "#edf4ff",
  },
});

globalStyle(`${projectSidebarToggle} svg`, {
  width: 15,
  height: 15,
});

export const projectSidebarReveal = style({
  position: "absolute",
  top: 62,
  left: 56,
  zIndex: 52,
  display: "grid",
  width: 28,
  height: 34,
  placeItems: "center",
  border: "1px solid #cdd9e8",
  borderLeft: 0,
  borderRadius: "0 7px 7px 0",
  color: "#365273",
  background: "#fff",
  boxShadow: "0 5px 14px rgba(25, 45, 78, 0.12)",
  ":hover": {
    color: "#1649bf",
    background: "#edf4ff",
  },
  "@media": {
    "(max-width: 760px)": {
      top: 60,
      left: 12,
      borderLeft: "1px solid #cdd9e8",
      borderTop: 0,
      borderRadius: "0 0 7px 7px",
    },
  },
});

globalStyle(`${projectSidebarReveal} svg`, {
  width: 15,
  height: 15,
});

export const projectNav = style({
  display: "grid",
  width: 168,
  gap: 12,
  padding: "12px 8px 18px",
  boxSizing: "border-box",
  "@media": {
    "(max-width: 760px)": {
      width: "max-content",
      minWidth: "100%",
      gridAutoFlow: "column",
      gridAutoColumns: "max-content",
      alignItems: "start",
      gap: 10,
      overflowX: "auto",
      paddingBlock: 8,
    },
  },
});

export const projectNavGroup = style({
  display: "grid",
  gap: 3,
  "@media": {
    "(max-width: 760px)": {
      gridAutoFlow: "column",
      gridAutoColumns: "max-content",
      alignItems: "center",
      gap: 4,
    },
  },
});

export const projectNavEntry = style({
  display: "grid",
  minWidth: 0,
});

globalStyle(`${projectNavGroup} > span`, {
  display: "block",
  color: "#8995a7",
  padding: "0 8px 2px",
  fontSize: 9,
  fontWeight: 650,
  lineHeight: 1,
  "@media": {
    "(max-width: 760px)": {
      display: "none",
    },
  },
});

export const projectNavItem = style({
  position: "relative",
  display: "flex",
  width: "100%",
  minHeight: 34,
  alignItems: "center",
  gap: 8,
  border: 0,
  borderRadius: 6,
  color: "#43526a",
  background: "transparent",
  padding: "6px 8px",
  textAlign: "left",
  ":hover": {
    color: "#174bbf",
    background: "transparent",
  },
  ":focus-visible": {
    outline: "2px solid #8fb5ff",
    outlineOffset: 1,
  },
  "@media": {
    "(max-width: 760px)": {
      width: "auto",
      minHeight: 36,
      paddingInline: 10,
    },
  },
});

export const projectNavItemActive = style({
  color: "#1450cf",
  background: "transparent",
  boxShadow: "none",
});

globalStyle(`${projectNavItem} svg`, {
  width: 16,
  height: 16,
  flex: "0 0 auto",
  strokeWidth: 1.7,
});

globalStyle(`${projectNavItem} span`, {
  overflow: "hidden",
  minWidth: 0,
  fontSize: 11,
  fontWeight: 600,
  lineHeight: 1.25,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const importExportOverlay = style({
  position: "fixed",
  zIndex: 80,
  inset: 0,
  display: "grid",
  placeItems: "center",
  background: "rgba(15, 28, 46, 0.22)",
  padding: 16,
});

export const importExportDialog = style({
  display: "grid",
  width: "min(520px, calc(100vw - 32px))",
  maxHeight: "calc(100vh - 32px)",
  boxSizing: "border-box",
  gap: 16,
  overflowY: "auto",
  border: "1px solid #dbe4f0",
  borderRadius: 10,
  color: "#25334a",
  background: "#fff",
  boxShadow: "0 24px 56px rgba(23, 32, 51, 0.22)",
  padding: 18,
});

export const importExportHeader = style({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
});

globalStyle(`${importExportHeader} > div`, {
  display: "grid",
  gap: 4,
});

globalStyle(`${importExportHeader} strong`, {
  color: "#17233a",
  fontSize: 16,
  fontWeight: 700,
});

globalStyle(`${importExportHeader} span`, {
  color: "#6b7890",
  fontSize: 11,
  fontWeight: 500,
});

export const importExportClose = style({
  display: "grid",
  width: 30,
  height: 30,
  flex: "0 0 auto",
  placeItems: "center",
  border: 0,
  borderRadius: 6,
  color: "#66758b",
  background: "transparent",
  ":hover": {
    color: "#174bbf",
    background: "#f2f6ff",
  },
  ":focus-visible": {
    outline: "2px solid #8fb5ff",
    outlineOffset: 1,
  },
});

globalStyle(`${importExportClose} svg`, {
  width: 18,
  height: 18,
});

export const importExportSection = style({
  display: "grid",
  gap: 8,
});

globalStyle(`${importExportSection} > strong`, {
  color: "#536178",
  fontSize: 10,
  fontWeight: 650,
});

export const importExportActions = style({
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 8,
  "@media": {
    "(max-width: 560px)": {
      gridTemplateColumns: "1fr",
    },
  },
});

export const importExportAction = style({
  display: "grid",
  minHeight: 70,
  gridTemplateColumns: "28px minmax(0, 1fr)",
  alignItems: "center",
  gap: 10,
  border: "1px solid #dfe6ef",
  borderRadius: 8,
  color: "#26364e",
  background: "#fff",
  padding: "10px 11px",
  textAlign: "left",
  ":hover": {
    borderColor: "#a9c1ef",
    background: "#f7f9fd",
  },
  ":focus-visible": {
    outline: "2px solid #8fb5ff",
    outlineOffset: 1,
  },
});

globalStyle(`${importExportAction} > svg`, {
  width: 20,
  height: 20,
  color: "#3568d4",
  strokeWidth: 1.65,
});

globalStyle(`${importExportAction} > span`, {
  display: "grid",
  minWidth: 0,
  gap: 3,
});

globalStyle(`${importExportAction} strong`, {
  overflow: "hidden",
  fontSize: 12,
  fontWeight: 650,
  lineHeight: 1.25,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

globalStyle(`${importExportAction} small`, {
  color: "#77859a",
  fontSize: 10,
  fontWeight: 500,
  lineHeight: 1.3,
});
