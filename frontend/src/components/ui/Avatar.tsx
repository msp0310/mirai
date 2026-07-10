import type { CSSProperties } from "react";
import type { Member } from "../../types/schedule";
import * as styles from "./Avatar.css";

type AvatarProps = {
  member: Pick<Member, "id" | "initials" | "color">;
};

/** メンバーのイニシャルとテーマカラーを使ってアバターを表示します。 */
export function Avatar({ member }: AvatarProps) {
  return (
    <span
      className={styles.avatar}
      style={{ "--avatar-color": member.color } as CSSProperties}
      title={member.id}
    >
      {member.initials}
    </span>
  );
}
