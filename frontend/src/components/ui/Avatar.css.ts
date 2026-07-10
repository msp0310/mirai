import { style } from "@vanilla-extract/css";

/** 共通アバターの見た目を定義します。色だけはメンバーごとに差し替えます。 */
export const avatar = style({
  alignItems: "center",
  background: "color-mix(in srgb, var(--avatar-color) 16%, #fff)",
  borderRadius: 7,
  color: "var(--avatar-color)",
  display: "grid",
  fontSize: 12,
  fontWeight: 900,
  height: 28,
  placeItems: "center",
  selectors: {
    "& + &": {
      border: "2px solid #fff",
      marginLeft: -8,
    },
  },
  width: 28,
});
