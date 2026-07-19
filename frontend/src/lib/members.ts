import type { Member } from "../types/schedule";
export function isMemberActive(member: Pick<Member, "status">) {
  return member.status !== "inactive";
}
export function getActiveMembers(members: Member[]) {
  return members.filter(isMemberActive);
}
export function getActiveTeamMembers(members: Member[], teamMemberIds: string[]) {
  const teamMemberIdSet = new Set(teamMemberIds);
  return members.filter((member) => teamMemberIdSet.has(member.id) && isMemberActive(member));
}
export function getAssignableMembers(members: Member[], selectedIds: string[] = []) {
  const selectedIdSet = new Set(selectedIds);
  return members.filter((member) => isMemberActive(member) || selectedIdSet.has(member.id));
}
export function getMemberStatusLabel(member: Pick<Member, "status">) {
  return isMemberActive(member) ? "有効" : "休止中";
}
