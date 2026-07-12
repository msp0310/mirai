#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { buildReleaseNotes, normalizeVersion, parseCommit } from "./release-notes/core.mjs";

const rootDirectory = resolve(import.meta.dirname, "..");
const recordSeparator = "\u001e";
const fieldSeparator = "\u001f";

function usage() {
  return `Mirai リリースノート生成

使い方:
  npm run release:notes -- --version 0.2.0 [options]

オプション:
  --version <version>  リリースバージョン。省略時はpackage.jsonのversion
  --from <ref>         差分の開始ref。省略時は最新のv*タグ
  --to <ref>           差分の終了ref。既定値はHEAD
  --date <YYYY-MM-DD>  リリース日。既定値は実行日
  --output <path>      出力先。既定値はdocs/releases/v<version>.md
  --stdout             ファイルへ保存せず標準出力へ表示
  --force              既存ファイルを上書き
  --help               このヘルプを表示
`;
}

function parseArguments(argv) {
  const options = { to: "HEAD", force: false, stdout: false };
  const valueOptions = new Set(["--version", "--from", "--to", "--date", "--output"]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") {
      options.help = true;
      continue;
    }
    if (argument === "--force") {
      options.force = true;
      continue;
    }
    if (argument === "--stdout") {
      options.stdout = true;
      continue;
    }
    if (!valueOptions.has(argument)) {
      throw new Error(`不明なオプションです: ${argument}`);
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${argument} の値を指定してください。`);
    }
    options[argument.slice(2)] = value;
    index += 1;
  }

  return options;
}

function git(args, { allowFailure = false } = {}) {
  try {
    return execFileSync("git", args, {
      cwd: rootDirectory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", allowFailure ? "ignore" : "inherit"],
    }).trim();
  } catch (error) {
    if (allowFailure) {
      return null;
    }
    throw error;
  }
}

function assertGitRef(ref, optionName) {
  if (!git(["rev-parse", "--verify", `${ref}^{commit}`], { allowFailure: true })) {
    throw new Error(`${optionName} に指定したGit refが見つかりません: ${ref}`);
  }
}

function latestTag(prefix, to) {
  return git(["describe", "--tags", "--abbrev=0", "--match", `${prefix}*`, to], {
    allowFailure: true,
  });
}

function readCommits(from, to) {
  const range = from ? `${from}..${to}` : to;
  const format = `%H%x1f%h%x1f%s%x1f%b%x1e`;
  const output = git(["log", `--format=${format}`, "--no-merges", range]);
  if (!output) {
    return [];
  }

  return output
    .split(recordSeparator)
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [hash, shortHash, subject, ...bodyParts] = record.split(fieldSeparator);
      return parseCommit({ hash, shortHash, subject, body: bodyParts.join(fieldSeparator).trim() });
    });
}

function localDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function validateDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new Error(`日付はYYYY-MM-DD形式で指定してください: ${date}`);
  }
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }

  const packageJson = JSON.parse(readFileSync(resolve(rootDirectory, "package.json"), "utf8"));
  const config = JSON.parse(
    readFileSync(resolve(rootDirectory, "release-notes.config.json"), "utf8"),
  );
  const version = normalizeVersion(options.version ?? packageJson.version);
  const date = options.date ?? localDate();
  validateDate(date);

  assertGitRef(options.to, "--to");
  const from = options.from ?? latestTag(config.tagPrefix, options.to);
  if (from) {
    assertGitRef(from, "--from");
  }

  const commits = readCommits(from, options.to);
  const markdown = buildReleaseNotes({
    version,
    date,
    fromLabel: from ?? "初回コミット",
    toLabel: options.to,
    commits,
    config,
  });

  if (options.stdout) {
    process.stdout.write(markdown);
    return;
  }

  const outputPath = resolve(
    rootDirectory,
    options.output ?? `${config.outputDirectory}/${config.tagPrefix}${version}.md`,
  );
  if (existsSync(outputPath) && !options.force) {
    throw new Error(
      `出力先が既に存在します。上書きする場合は --force を指定してください: ${outputPath}`,
    );
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, markdown, "utf8");
  process.stdout.write(`リリースノートを生成しました: ${outputPath}\n`);
  process.stdout.write(`対象コミット: ${commits.length}件 (${from ?? "初回"}..${options.to})\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`リリースノートの生成に失敗しました: ${error.message}\n`);
  process.exitCode = 1;
}
