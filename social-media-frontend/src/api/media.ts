import { apiClient } from './client';

export interface PresignedUrlResponse {
  mediaId: string;
  uploadUrl: string;
  expiresIn: number;
}

export interface MediaStatusResponse {
  id: string;
  status: 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED';
  cdn_url?: string;
  thumbnail_url?: string;
  error?: string;
}

export interface MediaListResponse {
  items: MediaStatusResponse[];
  total: number;
  offset: number;
  limit: number;
}

export const getPresignedUrl = async (data: {
  filename: string;
  contentType: string;
  sizeBytes: number;
}) => {
  return apiClient.post<PresignedUrlResponse>('/api/v1/media/upload/presigned', data);
};

export const uploadMedia = async (
  uploadUrl: string,
  file: File,
  onProgress?: (progress: number) => void
) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = (event.loaded / event.total) * 100;
        onProgress(progress);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response);
      } else {
        reject(new Error('Upload failed'));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Upload failed')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
};

export const confirmUpload = async (mediaId: string) => {
  return apiClient.post(`/api/v1/media/upload/confirm/${mediaId}`);
};

export const getMediaList = async (params?: { limit?: number; offset?: number }) => {
  return apiClient.get<MediaListResponse>('/api/v1/media', { params });
};

export const getMediaStatus = async (mediaId: string) => {
  return apiClient.get<MediaStatusResponse>(`/api/v1/media/${mediaId}/status`);
};

export const deleteMedia = async (mediaId: string) => {
  return apiClient.delete(`/api/v1/media/${mediaId}`);
};