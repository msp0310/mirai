import assert from "node:assert/strict";
import test from "node:test";

import { buildReleaseNotes, normalizeVersion, organizeCommits, parseCommit } from "./core.mjs";

const config = {
  productName: "Mirai",
  repositoryUrl: "https://example.com/mirai",
  sections: [
    { title: "新機能", types: ["feat"] },
    { title: "不具合修正", types: ["fix"] },
  ],
  ignoredTypes: ["docs"],
  fallbackSectionTitle: "その他の変更",
  scopeLabels: { gantt: "ガント" },
};

function commit(subject, body = "") {
  return parseCommit({ hash: "1234567890abcdef", shortHash: "12345678", subject, body });
}

test("Conventional Commitのtype・scope・破壊的変更を解析できる", () => {
  const parsed = commit("feat(gantt)!: 表示方式を変更", "BREAKING CHANGE: 設定の再保存が必要です");

  assert.equal(parsed.type, "feat");
  assert.equal(parsed.scope, "gantt");
  assert.equal(parsed.description, "表示方式を変更");
  assert.equal(parsed.breaking, true);
  assert.equal(parsed.breakingDescription, "設定の再保存が必要です");
});

test("対象typeを分類し、ドキュメント変更を除外できる", () => {
  const organized = organizeCommits(
    [commit("feat(gantt): バーを追加"), commit("fix: 保存を修正"), commit("docs: README更新")],
    config,
  );

  assert.deepEqual(
    organized.sections.map((section) => [section.title, section.commits.length]),
    [
      ["新機能", 1],
      ["不具合修正", 1],
    ],
  );
});

test("日本語のリリースノートを生成できる", () => {
  const markdown = buildReleaseNotes({
    version: "v1.2.0",
    date: "2026-07-12",
    fromLabel: "v1.1.0",
    toLabel: "HEAD",
    commits: [commit("feat(gantt): バーを追加")],
    config,
  });

  assert.match(markdown, /^# Mirai v1\.2\.0 リリースノート/mu);
  assert.match(markdown, /## 新機能/u);
  assert.match(markdown, /\*\*ガント\*\* バーを追加/u);
  assert.match(markdown, /https:\/\/example\.com\/mirai\/commit\/1234567890abcdef/u);
  assert.match(markdown, /## 破壊的変更\n\nありません。/u);
});

test("SemVer以外のバージョンを拒否する", () => {
  assert.throws(() => normalizeVersion("next"), /SemVer/u);
});
