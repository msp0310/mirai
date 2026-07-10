import { useEffect, useRef } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

type ShortcutGroup = {
  title: string;
  wide?: boolean;
  items: {
    keys: string[];
    label: string;
  }[];
};

const shortcutGroups: ShortcutGroup[] = [
  {
    title: "全体・操作",
    items: [
      { keys: ["?"], label: "ショートカットを表示" },
      { keys: ["Esc"], label: "開いているパネルやダイアログを閉じる" },
      {
        keys: ["Alt", "1..6"],
        label:
          "プロジェクト内の ガント / 概要 / リソース / カレンダー / マイルストーン / 履歴 を切替",
      },
      { keys: ["Ctrl/Cmd", "K"], label: "プロジェクト検索を開く" },
      { keys: ["Ctrl/Cmd", "S"], label: "ローカル保存" },
      { keys: ["N"], label: "タスクを追加" },
      { keys: ["/"], label: "タスク検索" },
      { keys: ["F"], label: "フィルターを開閉" },
    ],
  },
  {
    title: "Gantt選択",
    items: [
      { keys: ["Shift", "Click"], label: "連続した複数行を選択" },
      { keys: ["Ctrl/Cmd", "Click"], label: "行を追加選択" },
      { keys: ["↑", "↓"], label: "行を選択" },
      { keys: ["Shift", "↑", "↓"], label: "選択範囲を上下に広げる" },
      { keys: ["PageUp", "PageDown"], label: "大きく行移動" },
      { keys: ["Shift", "Page/Home/End"], label: "移動先まで範囲選択" },
      { keys: ["Home"], label: "選択行の開始日にスクロール" },
      { keys: ["End"], label: "末尾行へ移動" },
      { keys: ["T"], label: "今日へ移動" },
      { keys: ["1", "2", "3"], label: "表示粒度を日・週・月に切替" },
    ],
  },
  {
    title: "Gantt編集",
    wide: true,
    items: [
      { keys: ["Ctrl/Cmd", "C"], label: "選択行をコピー" },
      { keys: ["Ctrl/Cmd", "V"], label: "コピーした行を貼り付け" },
      { keys: ["U"], label: "選択行の上に挿入" },
      { keys: ["L"], label: "選択行の下に挿入" },
      { keys: ["→"], label: "選択行の階層を1段下げる" },
      { keys: ["←"], label: "選択行の階層を1段上げる" },
      { keys: ["Ctrl/Cmd", "<"], label: "選択行を上に移動" },
      { keys: ["Ctrl/Cmd", ">"], label: "選択行を下に移動" },
      { keys: ["Alt", "←", "→"], label: "選択行の日付を1日移動" },
      { keys: ["F2"], label: "選択行のタスク名を編集" },
      { keys: ["Enter"], label: "選択行のタスク名を編集" },
      { keys: ["Shift", "Enter"], label: "選択行の下に挿入" },
      { keys: ["Ctrl/Cmd", "D"], label: "選択行を複製" },
      { keys: ["Ctrl/Cmd", "A"], label: "表示中の行を全選択" },
      { keys: ["Delete"], label: "選択行を削除" },
      { keys: ["Ctrl/Cmd", "Z"], label: "元に戻す" },
      { keys: ["Ctrl/Cmd", "Y"], label: "やり直す" },
      { keys: ["Enter"], label: "入力を確定" },
      { keys: ["Esc"], label: "入力をキャンセル" },
    ],
  },
];

type ShortcutHelpSheetProps = {
  onClose: () => void;
};

/** 利用可能なキーボードショートカットをカテゴリ別に案内します。 */
export function ShortcutHelpSheet({ onClose }: ShortcutHelpSheetProps) {
  const sheetRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    sheetRef.current?.scrollTo({ top: 0 });
  }, []);

  return (
    <div className="shortcut-overlay" onMouseDown={onClose}>
      <aside
        aria-label="キーボードショートカット"
        aria-modal="true"
        className="shortcut-sheet"
        onMouseDown={(event) => event.stopPropagation()}
        ref={sheetRef}
        role="dialog"
      >
        <div className="panel-heading">
          <strong>ショートカット</strong>
          <button aria-label="閉じる" className="close-button" onClick={onClose} type="button">
            <XMarkIcon />
          </button>
        </div>
        <div className="shortcut-groups">
          {shortcutGroups.map((group) => (
            <section className={`shortcut-group${group.wide ? " is-wide" : ""}`} key={group.title}>
              <h3>{group.title}</h3>
              <dl>
                {group.items.map((item) => (
                  <div className="shortcut-row" key={`${group.title}-${item.label}`}>
                    <dt>
                      {item.keys.map((key) => (
                        <kbd key={key}>{key}</kbd>
                      ))}
                    </dt>
                    <dd>{item.label}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
}
