import type { TaskCsvImportDraft } from "../../../data/scheduleImportExport";
import type { Member } from "../../../types/schedule";

/** Brabio要員を既存要員へ照合し、タスクの担当者IDも既存IDへ置き換えます。 */
export function resolveTaskImportMembers(
  existingMembers: Member[],
  members: Member[],
  draft: TaskCsvImportDraft,
) {
  const existingById = new Map(existingMembers.map((member) => [member.id, member]));
  const existingByName = new Map(
    existingMembers.map((member) => [normalizeMemberName(member.name), member]),
  );
  const importedById = new Map<string, Member>();
  const importedByName = new Map<string, Member>();
  const memberIdMap = new Map<string, string>();
  const membersToCreate: Member[] = [];

  members.forEach((member) => {
    const normalizedName = normalizeMemberName(member.name);
    const matchedMember =
      existingById.get(member.id) ??
      existingByName.get(normalizedName) ??
      importedById.get(member.id) ??
      importedByName.get(normalizedName);
    if (matchedMember) {
      memberIdMap.set(member.id, matchedMember.id);
      return;
    }
    membersToCreate.push(member);
    importedById.set(member.id, member);
    importedByName.set(normalizedName, member);
    memberIdMap.set(member.id, member.id);
  });

  return {
    draft: remapImportAssignees(draft, memberIdMap),
    membersToCreate,
  };
}

function remapImportAssignees(draft: TaskCsvImportDraft, memberIdMap: Map<string, string>) {
  const assigneesIndex = draft.mapping.assignees;
  if (assigneesIndex == null || memberIdMap.size === 0) {
    return draft;
  }
  return {
    ...draft,
    rows: draft.rows.map((row) => {
      const current = row[assigneesIndex] ?? "";
      const remapped = current
        .split(/[/,、;；\n]+/)
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => memberIdMap.get(value) ?? value)
        .join("\n");
      if (remapped === current) {
        return row;
      }
      const nextRow = [...row];
      nextRow[assigneesIndex] = remapped;
      return nextRow;
    }),
  };
}

function normalizeMemberName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}
