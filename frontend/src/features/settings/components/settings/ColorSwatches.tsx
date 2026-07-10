import type { CSSProperties } from "react";

const memberColors = ["#675df6", "#ff7a8a", "#35b979", "#2f80ed", "#f0a928", "#00a7a7", "#8b70f6"];

/** メンバーやチームに設定する表示色を選択します。 */
export function ColorSwatches({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (color: string) => void;
  value: string;
}) {
  return (
    <div className="member-color-swatches" aria-label={label}>
      {memberColors.map((color) => (
        <button
          aria-label={`${label}: ${color}`}
          className={color === value ? "selected" : ""}
          key={color}
          onClick={() => onChange(color)}
          style={{ "--swatch-color": color } as CSSProperties}
          type="button"
        />
      ))}
    </div>
  );
}

/** メンバー一覧で次に使う色を決定します。 */
export function getNextMemberColor(index: number) {
  return memberColors[index % memberColors.length];
}
