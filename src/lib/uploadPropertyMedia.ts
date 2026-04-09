import { supabase } from '../services/supabase';
import { guessImageContentType, guessVideoContentType, isVideoUrl } from '../utils/media';

export async function uploadPropertyMediaToStorage(localUri: string): Promise<string> {
  if (localUri.startsWith('http://') || localUri.startsWith('https://')) {
    return localUri;
  }

  const response = await fetch(localUri);
  if (!response.ok) {
    throw new Error(`Erreur lecture média: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  const withoutQuery = localUri.split('?')[0];
  const rawExt = withoutQuery.includes('.') ? withoutQuery.split('.').pop() || 'jpg' : 'jpg';
  const fileExt = rawExt.toLowerCase();
  const isVideo = isVideoUrl(localUri) || ['mp4', 'mov', 'm4v', 'webm', 'mkv'].includes(fileExt);

  const contentType = isVideo ? guessVideoContentType(fileExt) : guessImageContentType(fileExt);
  const safeExt = isVideo ? (fileExt.match(/^(mp4|mov|m4v|webm|mkv)$/i) ? fileExt : 'mp4') : fileExt;

  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${safeExt}`;

  const { error: uploadError } = await supabase.storage.from('property-images').upload(fileName, uint8Array, {
    contentType,
    cacheControl: '3600',
    upsert: false,
  });

  if (uploadError) {
    throw uploadError;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('property-images').getPublicUrl(fileName);
  return publicUrl;
}
