import type { Dispatch, SetStateAction } from "react";

import type { ScheduleWorkspace } from "../../../data/scheduleRepository";
import type { Attachment } from "../../../types/schedule";

type UseProjectAttachmentsOptions = {
  projectId: string;
  setWorkspace: Dispatch<SetStateAction<ScheduleWorkspace>>;
};

/** 添付メタデータを案件単位で更新し、スケジュール編集からI/O境界を分離します。 */
export function useProjectAttachments({ projectId, setWorkspace }: UseProjectAttachmentsOptions) {
  function updateAttachments(updater: (current: Attachment[]) => Attachment[]) {
    setWorkspace((current) => ({
      ...current,
      schedules: current.schedules.map((snapshot) =>
        snapshot.project.id === projectId
          ? { ...snapshot, attachments: updater(snapshot.attachments ?? []) }
          : snapshot,
      ),
    }));
  }

  return {
    addAttachment: (attachment: Attachment) =>
      updateAttachments((current) => [
        attachment,
        ...current.filter((item) => item.id !== attachment.id),
      ]),
    deleteAttachment: (attachmentId: string) =>
      updateAttachments((current) => current.filter((item) => item.id !== attachmentId)),
  };
}
