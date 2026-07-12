import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const outputPath = resolve(process.argv[2] ?? "/tmp/mirai-performance-10000.json");
const taskCount = 10_000;
const phaseCount = 100;
const tasksPerPhase = taskCount / phaseCount;
const projectStart = "2025-04-01";
const projectEnd = "2026-12-31";
const colors = ["#2864ea", "#11a7a4", "#e46d2c", "#7657d9", "#d94b68"];

function toDateKey(offset) {
  const date = new Date(`${projectStart}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

const members = Array.from({ length: 10 }, (_, index) => {
  const number = String(index + 1).padStart(2, "0");
  return {
    capacityHours: 8,
    color: colors[index % colors.length],
    id: `performance-member-${number}`,
    initials: `P${number}`,
    name: `性能確認メンバー${number}`,
    role: index % 2 === 0 ? "SE" : "BE",
    status: "active",
  };
});

const tasks = [
  {
    assigneeIds: [],
    color: "#2864ea",
    end: projectEnd,
    expanded: true,
    id: "performance-root",
    parentId: null,
    progress: 46,
    start: projectStart,
    status: "inProgress",
    title: "10,000件性能確認プロジェクト",
    type: "summary",
  },
];

for (let phaseIndex = 0; phaseIndex < phaseCount; phaseIndex += 1) {
  const phaseNumber = String(phaseIndex + 1).padStart(3, "0");
  const phaseStart = toDateKey((phaseIndex * 6) % 600);
  const phaseEnd = toDateKey(Math.min(((phaseIndex * 6) % 600) + 20, 639));
  tasks.push({
    assigneeIds: [],
    color: colors[phaseIndex % colors.length],
    end: phaseEnd,
    expanded: true,
    id: `performance-phase-${phaseNumber}`,
    parentId: "performance-root",
    progress: phaseIndex % 4 === 0 ? 100 : 40,
    start: phaseStart,
    status: phaseIndex % 4 === 0 ? "done" : "inProgress",
    title: `工程 ${phaseNumber}`,
    type: "phase",
  });

  for (let taskIndex = 0; taskIndex < tasksPerPhase; taskIndex += 1) {
    const taskNumber = phaseIndex * tasksPerPhase + taskIndex + 1;
    const startOffset = (phaseIndex * 6 + taskIndex * 3) % 639;
    const start = toDateKey(startOffset);
    const end = toDateKey(Math.min(startOffset + (taskIndex % 5), 639));
    const isDone = taskNumber % 5 === 0;
    const isDelayed = !isDone && taskNumber % 17 === 0;
    tasks.push({
      assigneeIds: [members[taskNumber % members.length].id],
      color: colors[taskNumber % colors.length],
      end,
      id: `performance-task-${String(taskNumber).padStart(5, "0")}`,
      parentId: `performance-phase-${phaseNumber}`,
      progress: isDone ? 100 : isDelayed ? 35 : taskNumber % 4 === 0 ? 65 : 0,
      start,
      status: isDone
        ? "done"
        : isDelayed
          ? "delayed"
          : taskNumber % 4 === 0
            ? "inProgress"
            : "notStarted",
      title: `性能確認タスク ${String(taskNumber).padStart(5, "0")}`,
      type: "task",
    });
  }
}

const fixture = {
  calendar: {
    holidays: [],
    id: "performance-calendar",
    name: "性能確認用カレンダー",
    workWeek: [1, 2, 3, 4, 5],
  },
  issues: [],
  members,
  project: {
    lifecycleStatus: "inProgress",
    memberIds: members.map((member) => member.id),
    name: "10,000件性能確認",
    nextMilestone: { date: "2025-10-01", title: "性能確認完了" },
    rangeEnd: projectEnd,
    rangeStart: projectStart,
    status: "active",
    teamId: "performance-team",
    workspace: "10,000件性能確認プロジェクト",
  },
  tasks,
  workLogs: [],
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(fixture)}\n`, "utf8");
console.log(`生成しました: ${outputPath}`);
console.log(`作業タスク ${taskCount}件 / 工程 ${phaseCount}件 / 総行 ${tasks.length}行`);
