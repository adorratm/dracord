import type { DracordClient } from '@dracord/sdk';
import type { MessageAttachment } from '@dracord/types';

/** RN: expo-image-picker URI → presign PUT (File API yok). */
export async function uploadImageFromUri(
  client: DracordClient,
  uri: string,
  filename: string,
  contentType: string,
  folder: 'attachments' | 'stickers' | 'avatars' | 'banners' = 'attachments',
): Promise<MessageAttachment> {
  const res = await fetch(uri);
  const blob = await res.blob();
  const type = contentType || blob.type || 'image/jpeg';
  const presign = await client.presignUpload({
    filename,
    contentType: type,
    folder,
  });
  const put = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': type },
    body: blob,
  });
  if (!put.ok) {
    throw new Error(`Yükleme başarısız (${put.status})`);
  }
  return {
    id: presign.key,
    url: presign.publicUrl,
    filename,
    contentType: type,
    size: blob.size,
  };
}
