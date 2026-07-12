/** 指定したタスクのタイトル編集欄へフォーカスを移します。 */
export function focusTaskTitleEditor(taskId: string) {
  const rowSelector = `.task-table-row[data-task-id="${taskId}"]`;
  const inputSelector = `${rowSelector} input[data-inline-field="title"]`;

  function focusInput() {
    const input = document.querySelector<HTMLInputElement>(inputSelector);
    if (!input) {
      return false;
    }
    input.focus();
    input.select();
    return true;
  }

  if (focusInput()) {
    return;
  }
  document
    .querySelector<HTMLElement>(`${rowSelector} [data-title-edit-trigger="true"]`)
    ?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, detail: 2 }));
  window.requestAnimationFrame(focusInput);
}

/** テキストファイルをブラウザからダウンロードします。 */
export function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** 遅延ロード中のプロジェクトビューに表示する共通プレースホルダーです。 */
export function ViewLoading({ label }: { label: string }) {
  return <div className="view-loading">{label}</div>;
}
