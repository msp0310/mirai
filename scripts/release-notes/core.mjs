const conventionalCommitPattern = /^([a-z]+)(?:\(([^)]+)\))?(!)?:\s+(.+)$/u;
const breakingChangePattern = /(?:^|\n)BREAKING[ -]CHANGE:\s*(.+(?:\n(?!\w[\w-]*:).+)*)/iu;

export function normalizeVersion(version) {
  const normalized = version.trim().replace(/^v/u, "");
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(normalized)) {
    throw new Error(`バージョンはSemVer形式で指定してください: ${version}`);
  }

  return normalized;
}

export function parseCommit({ hash, shortHash, subject, body = "" }) {
  const match = subject.match(conventionalCommitPattern);
  const breakingMatch = body.match(breakingChangePattern);

  if (!match) {
    return {
      hash,
      shortHash,
      subject,
      body,
      type: null,
      scope: null,
      description: subject,
      breaking: Boolean(breakingMatch),
      breakingDescription: breakingMatch?.[1]?.trim() ?? null,
    };
  }

  return {
    hash,
    shortHash,
    subject,
    body,
    type: match[1],
    scope: match[2] ?? null,
    description: match[4],
    breaking: Boolean(match[3] || breakingMatch),
    breakingDescription: breakingMatch?.[1]?.trim() ?? null,
  };
}

export function organizeCommits(commits, config) {
  const typeToSection = new Map(
    config.sections.flatMap((section) => section.types.map((type) => [type, section.title])),
  );
  const sectionEntries = new Map(config.sections.map((section) => [section.title, []]));
  const fallbackEntries = [];
  const breakingEntries = [];
  const ignoredTypes = new Set(config.ignoredTypes);

  for (const commit of commits) {
    if (commit.breaking) {
      breakingEntries.push(commit);
    }

    if (commit.type && ignoredTypes.has(commit.type)) {
      continue;
    }

    const sectionTitle = commit.type ? typeToSection.get(commit.type) : null;
    if (sectionTitle) {
      sectionEntries.get(sectionTitle).push(commit);
    } else {
      fallbackEntries.push(commit);
    }
  }

  const sections = config.sections
    .map((section) => ({ title: section.title, commits: sectionEntries.get(section.title) }))
    .filter((section) => section.commits.length > 0);

  if (fallbackEntries.length > 0) {
    sections.push({ title: config.fallbackSectionTitle, commits: fallbackEntries });
  }

  return { sections, breakingEntries };
}

function commitLink(commit, repositoryUrl) {
  const label = commit.shortHash || commit.hash.slice(0, 8);
  if (!repositoryUrl) {
    return `\`${label}\``;
  }

  return `[\`${label}\`](${repositoryUrl.replace(/\/$/u, "")}/commit/${commit.hash})`;
}

function commitLine(commit, config) {
  const scope = commit.scope ? (config.scopeLabels[commit.scope] ?? commit.scope) : null;
  const scopeLabel = scope ? `**${scope}** ` : "";
  return `- ${scopeLabel}${commit.description} (${commitLink(commit, config.repositoryUrl)})`;
}

export function buildReleaseNotes({ version, date, fromLabel, toLabel, commits, config }) {
  const normalizedVersion = normalizeVersion(version);
  const { sections, breakingEntries } = organizeCommits(commits, config);
  const visibleCount = sections.reduce((total, section) => total + section.commits.length, 0);
  const sectionSummary = sections
    .map((section) => `${section.title}${section.commits.length}件`)
    .join("、");
  const lines = [
    `# ${config.productName} v${normalizedVersion} リリースノート`,
    "",
    `- リリース日: ${date}`,
    `- 対象範囲: \`${fromLabel}\` から \`${toLabel}\``,
    "",
    "## 概要",
    "",
    visibleCount > 0
      ? `このリリースには${sectionSummary}を含む、合計${visibleCount}件の変更があります。`
      : "このリリースには、リリースノートの対象となる変更はありません。",
    "",
    "> この概要は自動生成されています。公開前に利用者へ伝えたい要点を追記してください。",
    "",
  ];

  for (const section of sections) {
    lines.push(`## ${section.title}`, "");
    lines.push(...section.commits.map((commit) => commitLine(commit, config)), "");
  }

  lines.push("## 破壊的変更", "");
  if (breakingEntries.length === 0) {
    lines.push("ありません。", "");
  } else {
    lines.push(
      ...breakingEntries.map((commit) => {
        const detail = commit.breakingDescription
          ? `${commit.description}: ${commit.breakingDescription}`
          : commit.description;
        return `- ${detail} (${commitLink(commit, config.repositoryUrl)})`;
      }),
      "",
    );
  }

  lines.push(
    "## アップグレード時の注意",
    "",
    "特別な手順はありません。",
    "",
    "> DB移行、設定変更、再ログインなどが必要な場合は、公開前にこの節を更新してください。",
    "",
  );

  return `${lines.join("\n").trimEnd()}\n`;
}
