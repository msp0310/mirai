/** 依存線をタスクバーの右端から左端へ直角に接続します。 */
export function buildDependencyPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
) {
  const mid = Math.max(sourceX + 16, (sourceX + targetX) / 2);
  return `M ${sourceX} ${sourceY} H ${mid} V ${targetY} H ${targetX}`;
}
