import type { DracordClient } from '@dracord/sdk';
import type { MessageAttachment } from '@dracord/types';

/** RN: expo-image-picker URI → presign PUT (File API yok). */
export async function uploadImageFromUri(
  client: DracordClient,
  uri: string,
  filename: string,
  contentType: string,
): Promise<MessageAttachment> {
  const res = await fetch(uri);
  const blob = await res.blob();
  const presign = await client.presignUpload({
    filename,
    contentType: contentType || blob.type || 'image/jpeg',
    folder: 'attachments',
  });
  const put = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType || blob.type || 'image/jpeg' },
    body: blob,
  });
  if (!put.ok) {
    throw new Error(`Yükleme başarısız (${put.status})`);
  }
  return {
    id: presign.key,
    url: presign.publicUrl,
    filename,
    contentType: contentType || blob.type || 'image/jpeg',
    size: blob.size,
  };
}
