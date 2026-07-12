type SelectionModifierState = {
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
};

/** マウス・キーボードイベントの修飾キーをタスク選択オプションへ変換します。 */
export function getTaskSelectionOptions(event: SelectionModifierState) {
  return {
    additive: Boolean(event.ctrlKey || event.metaKey),
    range: Boolean(event.shiftKey),
  };
}
