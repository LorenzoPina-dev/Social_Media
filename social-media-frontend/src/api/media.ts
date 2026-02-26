// src/api/media.ts

import axios from 'axios';
import { apiClient } from './client';
import { unwrapData } from './envelope';

interface PresignedResponse {
  media_id: string;
  upload_url: string;
  expires_in: number;
  storage_key: string;
}

export interface UploadedMedia {
  mediaId: string;
  storageKey: string;
  mediaType: string;
}

/**
 * Gestisce l'intero flusso di upload:
 * 1. Chiede l'URL presigned al backend
 * 2. Carica il file direttamente sullo storage (PUT)
 * 3. Conferma l'upload al backend
 */
export async function uploadMedia(file: File): Promise<UploadedMedia> {
  // STEP 1: Richiedi URL Presigned
  const startRes = await apiClient.post('/api/v1/media/upload/presigned', {
    filename: file.name,
    content_type: file.type,
    size_bytes: file.size
  });

  const { upload_url, media_id, storage_key } = unwrapData<PresignedResponse>(startRes.data);

  // STEP 2: Carica il file direttamente sullo storage
  // NOTA: Qui NON usiamo apiClient per evitare di inviare il token Authorization a S3/MinIO.
  // È FONDAMENTALE che il Content-Type corrisponda a quello dichiarato nello Step 1.
  await axios.put(upload_url, file, {
    headers: {
      'Content-Type': file.type
    }
  });

  // STEP 3: Conferma l'upload al backend
  // Questo passaggio notifica al sistema che il file è pronto per essere processato
  await apiClient.post(`/api/v1/media/upload/confirm/${media_id}`);

  return {
    mediaId: media_id,
    storageKey: storage_key,
    mediaType: file.type,
  };
}
