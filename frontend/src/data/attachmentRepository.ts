import type { Attachment, AttachmentOwnerType } from "../types/schedule";
import { authRepository } from "./authRepository";
import { requestJson } from "./apiClient";

async function requestAuthenticated<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const token = authRepository.getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return requestJson<T>(path, { ...init, headers });
}

/** 案件配下の添付メタデータを取得します。 */
export function getProjectAttachments(projectId: string) {
  return requestAuthenticated<Attachment[]>(
    `/projects/${encodeURIComponent(projectId)}/attachments`,
  );
}

/** 課題・作業ログ・タスクコメントなどへファイルをアップロードします。 */
export function uploadAttachment({
  file,
  ownerId,
  ownerType,
  parentId,
  projectId,
}: {
  file: File;
  ownerId: string;
  ownerType: AttachmentOwnerType;
  parentId?: string;
  projectId: string;
}) {
  const body = new FormData();
  body.append("file", file);
  body.append("ownerType", ownerType);
  body.append("ownerId", ownerId);
  if (parentId) body.append("parentId", parentId);
  return requestAuthenticated<Attachment>(
    `/projects/${encodeURIComponent(projectId)}/attachments`,
    { body, method: "POST" },
  );
}

/** 添付メタデータと保存本体を削除します。 */
export function deleteAttachment(projectId: string, attachmentId: string) {
  return requestAuthenticated<void>(
    `/projects/${encodeURIComponent(projectId)}/attachments/${encodeURIComponent(attachmentId)}`,
    { method: "DELETE" },
  );
}

/** 認証付きで添付をダウンロードします。 */
export async function downloadAttachment(attachment: Attachment) {
  const headers = new Headers();
  const token = authRepository.getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(attachment.downloadUrl, { headers });
  if (!response.ok) {
    throw new Error("ファイルをダウンロードできませんでした。");
  }
  return response.blob();
}
